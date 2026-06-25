/**
 * Expense conversion pipeline — deterministic, reactive, single source of truth.
 *
 * Mathematical flow (foreign → ILS ledger, then projected to display):
 *   rawIls      = amount × unitRate
 *   finalIls    = rawIls × (1 + appliedFeePercent / 100)   when fee active
 *   displayAmt  = project(finalIls) per resolveExpenseDisplayAmount rules
 *
 * Modifier combinations:
 *   A  Both active         → live manual (or spot) rate + fee%
 *   B  manualRateDisabled  → date-scoped apiRate only + fee%
 *   C  feeDisabled         → rate × 1.0
 *   D  Both disabled       → date-scoped apiRate × 1.0
 */

import { listActiveCurrencyCommissions } from './currencyCommissionService';
import {
  convertIlsToForeign,
  fetchExchangeRates,
  getLocalTodayIso,
  resolveIlsLegDirectUnitRate,
  type ExchangeRates,
  type ExpenseCurrency,
} from './exchangeRateService';
import {
  ensureDirectPairUnitRate,
  resolveDirectPairUnitRateSync,
} from './currencyPairResolver';
import {
  getManualExchangeOverride,
  listActiveManualExchangeOverrides,
} from './manualExchangeOverrideService';
import {
  entryHasRate,
  resolveHistoricalRateToIls,
  resolveHistoricalRateToIlsAsync,
  resolveHistoricalUnitRate,
  type HistoricalOverrideEntry,
} from './historicalOverrideService';
import { getApiRateForDate } from './rateCacheService';
import { roundMoney, smartRoundMoney } from './money';
import {
  convertAmountWithActiveRates,
  resolveActiveFeePercent,
  toActiveExchangeRatesFromSnapshot,
  toActiveFeesFromCommissionEntries,
} from './transactionProcessingService';

export type ConvertExpenseToIlsOptions = {
  displayCurrency?: ExpenseCurrency;
  /** Ignore manual overrides — resolve from the date-scoped `apiRate` only. */
  manualRateDisabled?: boolean;
  /** Drop any conversion fee/commission for this conversion. */
  feeDisabled?: boolean;
  /** Transaction date (`YYYY-MM-DD`) for date-scoped API rate resolution. */
  transactionDate?: string;
  /**
   * When set, bypass the live rate lookup and use this exact rate for
   * the conversion (1 expense-currency = historicalManualRate × ILS).
   * Marks `manualRateUsed = true` on the resulting record.
   * Sourced from `historicalOverrideService.resolveHistoricalRateToIls`.
   */
  historicalManualRate?: number;
  /**
   * Accepted historical rate archive row — resolved async to USD→ILS (or F2F triangulation).
   * Takes precedence over live manual rates when `historicalManualRate` is not set.
   */
  historicalRateEntry?: HistoricalOverrideEntry;
  /**
   * When set, override the live commission lookup with this exact percent.
   * Sourced from a `HistoricalOverrideEntry.feePercent` the user accepted.
   */
  historicalFeePercent?: number;
};

export interface RecordedExpenseConversion {
  ilsAmount: number;
  appliedFeePercent: number;
  manualRateUsed: boolean;
  appliedUnitRateToIls: number;
  appliedRateSource: 'historical' | 'manual_live' | 'api_spot';
}

export interface ExpenseDisplayPreview extends RecordedExpenseConversion {
  displayAmount: number;
}

/** Commission % for ledger conversion — honors source-currency rules (incl. global ALL). */
function resolveExpenseLedgerFeePercent(
  fromCurrency: string,
  feeDisabled: boolean,
  historicalFeePercent?: number,
): number {
  if (feeDisabled || fromCurrency === 'ILS') return 0;
  if (historicalFeePercent != null && historicalFeePercent > 0 && historicalFeePercent <= 100) {
    return historicalFeePercent;
  }
  const activeFees = toActiveFeesFromCommissionEntries(listActiveCurrencyCommissions());
  const percent = resolveActiveFeePercent(activeFees, fromCurrency) ?? 0;
  if (!(percent > 0) || percent > 100) return 0;
  return percent;
}

function applyFeeMultiplier(rawIls: number, feePercent: number): number {
  if (!(feePercent > 0)) return roundMoney(rawIls);
  return roundMoney(rawIls * (1 + feePercent / 100));
}

/** Live manual override or spot table rate (1 `from` = rate × ILS). */
function resolveLiveManualOrSpotRate(
  from: ExpenseCurrency,
  rates: ExchangeRates,
): { rate: number; manualRateUsed: boolean; rateSource: 'manual_live' | 'api_spot' } | null {
  const manualDirect = getManualExchangeOverride(from, 'ILS');
  if (manualDirect != null && manualDirect > 0) {
    return { rate: manualDirect, manualRateUsed: true, rateSource: 'manual_live' };
  }

  const withManual = toActiveExchangeRatesFromSnapshot(rates, listActiveManualExchangeOverrides());
  const spotOnly = toActiveExchangeRatesFromSnapshot(rates, []);

  const rateWithManual = convertAmountWithActiveRates(1, from, 'ILS', withManual);
  const rateSpotOnly = convertAmountWithActiveRates(1, from, 'ILS', spotOnly);

  if (rateWithManual == null || !(rateWithManual > 0)) return null;

  const manualUsed =
    rateSpotOnly == null ||
    Math.abs(rateWithManual - rateSpotOnly) / Math.max(rateSpotOnly, 1e-9) > 1e-6;

  return {
    rate: rateWithManual,
    manualRateUsed: manualUsed,
    rateSource: manualUsed ? 'manual_live' : 'api_spot',
  };
}

/** Date-scoped API rate only — never manual overrides. */
async function resolveDateScopedApiRate(
  dateIso: string,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
  rates: ExchangeRates | null,
): Promise<number | null> {
  if (fromCurrency === toCurrency) return 1;

  const cachedApi = getApiRateForDate(dateIso, fromCurrency, toCurrency);
  if (cachedApi != null && cachedApi > 0) return cachedApi;

  const ensured = await ensureDirectPairUnitRate({
    fromCurrency,
    toCurrency,
    dateIso,
    rates,
  });
  if (ensured.rate != null && ensured.rate > 0) return ensured.rate;

  if (dateIso < getLocalTodayIso()) return null;

  const liveRates = rates ?? (await fetchExchangeRates().catch(() => null));
  if (!liveRates) return null;

  const sync = resolveDirectPairUnitRateSync({
    fromCurrency,
    toCurrency,
    dateIso,
    rates: liveRates,
  });
  return sync.rate;
}

function resolveDateScopedApiRateSync(
  dateIso: string,
  from: ExpenseCurrency,
  to: ExpenseCurrency,
  rates: ExchangeRates,
): number | null {
  if (from === to) return 1;
  const cached = getApiRateForDate(dateIso, from, to);
  if (cached != null && cached > 0) return cached;

  const sync = resolveDirectPairUnitRateSync({
    fromCurrency: from,
    toCurrency: to,
    dateIso,
    rates,
  });
  if (sync.rate != null && sync.rate > 0) return sync.rate;

  if (dateIso < getLocalTodayIso()) return null;

  return resolveIlsLegDirectUnitRate(from, to, rates.ilsToForeign);
}

/**
 * Core deterministic conversion — shared by sync, async, and live preview paths.
 */
function computeExpenseIlsConversion(
  amount: number,
  from: ExpenseCurrency,
  options: {
    transactionDate: string;
    manualRateDisabled: boolean;
    feeDisabled: boolean;
    unitRate: number;
    manualRateUsed: boolean;
    rateSource: 'historical' | 'manual_live' | 'api_spot';
    historicalFeePercent?: number;
  },
): RecordedExpenseConversion {
  const rawIls = from === 'ILS' ? amount : smartRoundMoney(amount * options.unitRate);
  const appliedFeePercent = resolveExpenseLedgerFeePercent(
    from,
    options.feeDisabled,
    options.historicalFeePercent,
  );
  const ilsAmount = applyFeeMultiplier(rawIls, appliedFeePercent);

  return {
    ilsAmount,
    appliedFeePercent,
    manualRateUsed: options.manualRateUsed,
    appliedUnitRateToIls: options.unitRate,
    appliedRateSource: options.rateSource,
  };
}

async function resolveHistoricalManualRateFromEntry(
  entry: HistoricalOverrideEntry,
  from: ExpenseCurrency,
  transactionDate: string,
  rates: ExchangeRates,
): Promise<number | null> {
  return resolveHistoricalRateToIlsAsync(entry, from, (bridge) =>
    resolveDateScopedApiRate(transactionDate, bridge, 'ILS', rates),
  );
}

async function resolveUnitRateToIls(
  from: ExpenseCurrency,
  transactionDate: string,
  rates: ExchangeRates,
  manualRateDisabled: boolean,
  historicalManualRate?: number,
  historicalRateEntry?: HistoricalOverrideEntry,
): Promise<{ rate: number; manualRateUsed: boolean; rateSource: 'historical' | 'manual_live' | 'api_spot' } | null> {
  // Explicit numeric override (highest priority).
  if (historicalManualRate != null && historicalManualRate > 0) {
    return { rate: historicalManualRate, manualRateUsed: true, rateSource: 'historical' };
  }

  // Archived historical rate — direct ILS leg or F2F triangulation.
  if (
    !manualRateDisabled &&
    historicalRateEntry &&
    entryHasRate(historicalRateEntry)
  ) {
    const resolved = await resolveHistoricalManualRateFromEntry(
      historicalRateEntry,
      from,
      transactionDate,
      rates,
    );
    if (resolved != null && resolved > 0) {
      return { rate: resolved, manualRateUsed: true, rateSource: 'historical' };
    }
  }

  if (manualRateDisabled) {
    const apiRate = await resolveDateScopedApiRate(transactionDate, from, 'ILS', rates);
    if (apiRate == null || !(apiRate > 0)) return null;
    return { rate: from === 'ILS' ? 1 : apiRate, manualRateUsed: false, rateSource: 'api_spot' };
  }

  if (from === 'ILS') {
    return { rate: 1, manualRateUsed: false, rateSource: 'api_spot' };
  }

  return resolveLiveManualOrSpotRate(from, rates);
}

function resolveUnitRateToIlsSync(
  from: ExpenseCurrency,
  transactionDate: string,
  rates: ExchangeRates,
  manualRateDisabled: boolean,
  historicalManualRate?: number,
  historicalRateEntry?: HistoricalOverrideEntry,
): { rate: number; manualRateUsed: boolean; rateSource: 'historical' | 'manual_live' | 'api_spot' } | null {
  if (historicalManualRate != null && historicalManualRate > 0) {
    return { rate: historicalManualRate, manualRateUsed: true, rateSource: 'historical' };
  }

  if (
    !manualRateDisabled &&
    historicalRateEntry &&
    entryHasRate(historicalRateEntry)
  ) {
    const direct = resolveHistoricalRateToIls(historicalRateEntry, from);
    if (direct != null && direct > 0) {
      return { rate: direct, manualRateUsed: true, rateSource: 'historical' };
    }
  }

  if (manualRateDisabled) {
    const apiRate = resolveDateScopedApiRateSync(transactionDate, from, 'ILS', rates);
    if (apiRate == null || !(apiRate > 0)) return null;
    return { rate: from === 'ILS' ? 1 : apiRate, manualRateUsed: false, rateSource: 'api_spot' };
  }

  if (from === 'ILS') {
    return { rate: 1, manualRateUsed: false, rateSource: 'api_spot' };
  }

  return resolveLiveManualOrSpotRate(from, rates);
}

/** Primary display line — mirrors `resolveExpenseDisplayAmount`. */
export function projectExpensePrimaryDisplayAmount(
  typedAmount: number,
  currency: ExpenseCurrency,
  ilsAmount: number,
  displayCurrency: ExpenseCurrency,
  rates: ExchangeRates,
): number {
  if (displayCurrency === 'ILS') return ilsAmount;
  if (currency === displayCurrency) return typedAmount;

  const converted = convertIlsToForeign(ilsAmount, displayCurrency, rates);
  if (converted != null) return roundMoney(converted);
  return ilsAmount;
}

function readOverrideFlags(options?: ConvertExpenseToIlsOptions): {
  manualRateDisabled: boolean;
  feeDisabled: boolean;
} {
  const legacy = options as ConvertExpenseToIlsOptions & {
    disableManualRate?: boolean;
    disableFee?: boolean;
  };
  return {
    manualRateDisabled: Boolean(legacy?.manualRateDisabled ?? legacy?.disableManualRate),
    feeDisabled: Boolean(legacy?.feeDisabled ?? legacy?.disableFee),
  };
}

/** ILS ledger rate is always 1; manual flag reflects the display-currency pair override. */
function resolveIlsExpenseManualRateUsed(
  manualRateDisabled: boolean,
  displayCurrency: ExpenseCurrency | undefined,
  rates: ExchangeRates,
): boolean {
  if (manualRateDisabled || !displayCurrency || displayCurrency === 'ILS') return false;

  const manualDirect = getManualExchangeOverride(displayCurrency, 'ILS');
  if (manualDirect != null && manualDirect > 0) return true;

  const withManual = toActiveExchangeRatesFromSnapshot(rates, listActiveManualExchangeOverrides());
  const spotOnly = toActiveExchangeRatesFromSnapshot(rates, []);
  const rateWithManual = convertAmountWithActiveRates(1, 'ILS', displayCurrency, withManual);
  const rateSpotOnly = convertAmountWithActiveRates(1, 'ILS', displayCurrency, spotOnly);
  if (rateWithManual == null || !(rateWithManual > 0)) return false;

  return (
    rateSpotOnly == null ||
    Math.abs(rateWithManual - rateSpotOnly) / Math.max(rateSpotOnly, 1e-9) > 1e-6
  );
}

function applyIlsSourceManualRateFlags(
  from: ExpenseCurrency,
  unit: { manualRateUsed: boolean; rateSource: 'historical' | 'manual_live' | 'api_spot' },
  options: ConvertExpenseToIlsOptions | undefined,
  manualRateDisabled: boolean,
  rates: ExchangeRates,
): { manualRateUsed: boolean; rateSource: 'historical' | 'manual_live' | 'api_spot' } {
  if (from !== 'ILS') {
    return { manualRateUsed: unit.manualRateUsed, rateSource: unit.rateSource };
  }

  if (unit.rateSource === 'historical') {
    return { manualRateUsed: unit.manualRateUsed, rateSource: unit.rateSource };
  }

  const ilsManual = resolveIlsExpenseManualRateUsed(
    manualRateDisabled,
    options?.displayCurrency,
    rates,
  );
  return {
    manualRateUsed: ilsManual,
    rateSource: ilsManual ? 'manual_live' : 'api_spot',
  };
}

/**
 * Preserve immutable conversion metadata across edit sessions so override toggles
 * stay reversible (manualRateUsed / appliedFeePercent are not wiped when disabled).
 */
export function resolveExpenseEditModifierVisibility(
  expense: {
    manualRateUsed?: boolean;
    manualRateDisabled?: boolean;
    appliedFeePercent?: number;
    feeDisabled?: boolean;
  } | null | undefined,
  draft?: { manualRateDisabled?: boolean; feeDisabled?: boolean } | null,
): { showManualRate: boolean; showFee: boolean } {
  return {
    showManualRate: Boolean(
      expense?.manualRateUsed || expense?.manualRateDisabled || draft?.manualRateDisabled,
    ),
    showFee: Boolean(
      (expense?.appliedFeePercent ?? 0) > 0 || expense?.feeDisabled || draft?.feeDisabled,
    ),
  };
}

export function resolvePersistedExpenseConversionMeta(
  prev: { manualRateUsed?: boolean; appliedFeePercent?: number } | null | undefined,
  conversion: RecordedExpenseConversion,
  overrides: { manualRateDisabled: boolean; feeDisabled: boolean },
): Pick<RecordedExpenseConversion, 'manualRateUsed' | 'appliedFeePercent'> {
  const manualRateUsed = Boolean(prev?.manualRateUsed) || conversion.manualRateUsed;
  const prevFee = prev?.appliedFeePercent ?? 0;
  const appliedFeePercent =
    overrides.feeDisabled && prevFee > 0 ? prevFee : conversion.appliedFeePercent;
  return { manualRateUsed, appliedFeePercent };
}

export async function recordExpenseConversionToIlsAsync(
  amount: number,
  currency: string,
  rates: ExchangeRates | null,
  options?: ConvertExpenseToIlsOptions,
): Promise<RecordedExpenseConversion | null> {
  const from = currency.trim().toUpperCase() as ExpenseCurrency;
  if (!(amount > 0)) return null;

  const liveRates = rates ?? (await fetchExchangeRates().catch(() => null));
  if (!liveRates) return null;

  const transactionDate = options?.transactionDate ?? getLocalTodayIso();
  const { manualRateDisabled, feeDisabled } = readOverrideFlags(options);
  const historicalManualRate = options?.historicalManualRate;
  const historicalRateEntry = options?.historicalRateEntry;
  const historicalFeePercent = options?.historicalFeePercent;

  const unit = await resolveUnitRateToIls(
    from,
    transactionDate,
    liveRates,
    manualRateDisabled,
    historicalManualRate,
    historicalRateEntry,
  );
  if (!unit) return null;

  const rateFlags = applyIlsSourceManualRateFlags(
    from,
    unit,
    options,
    manualRateDisabled,
    liveRates,
  );

  return computeExpenseIlsConversion(amount, from, {
    transactionDate,
    manualRateDisabled,
    feeDisabled,
    unitRate: unit.rate,
    manualRateUsed: rateFlags.manualRateUsed,
    rateSource: rateFlags.rateSource,
    historicalFeePercent,
  });
}

export function recordExpenseConversionToIls(
  amount: number,
  currency: string,
  rates: ExchangeRates,
  options?: ConvertExpenseToIlsOptions,
): RecordedExpenseConversion | null {
  const from = currency.trim().toUpperCase() as ExpenseCurrency;
  if (!(amount > 0)) return null;

  const transactionDate = options?.transactionDate ?? getLocalTodayIso();
  const { manualRateDisabled, feeDisabled } = readOverrideFlags(options);
  const historicalManualRate = options?.historicalManualRate;
  const historicalRateEntry = options?.historicalRateEntry;
  const historicalFeePercent = options?.historicalFeePercent;

  const unit = resolveUnitRateToIlsSync(
    from,
    transactionDate,
    rates,
    manualRateDisabled,
    historicalManualRate,
    historicalRateEntry,
  );
  if (!unit) return null;

  const rateFlags = applyIlsSourceManualRateFlags(
    from,
    unit,
    options,
    manualRateDisabled,
    rates,
  );

  return computeExpenseIlsConversion(amount, from, {
    transactionDate,
    manualRateDisabled,
    feeDisabled,
    unitRate: unit.rate,
    manualRateUsed: rateFlags.manualRateUsed,
    rateSource: rateFlags.rateSource,
    historicalFeePercent,
  });
}

export async function previewExpenseDisplayAmount(
  amount: number,
  currency: ExpenseCurrency,
  rates: ExchangeRates | null,
  options: ConvertExpenseToIlsOptions & { displayCurrency: ExpenseCurrency },
): Promise<ExpenseDisplayPreview | null> {
  const recorded = await recordExpenseConversionToIlsAsync(amount, currency, rates, options);
  if (!recorded) return null;

  const liveRates = rates ?? (await fetchExchangeRates().catch(() => null));
  if (!liveRates) return null;

  const displayCurrency = options.displayCurrency;
  const historicalEntry = options.historicalRateEntry;
  const directHistoricalDisplayRate =
    historicalEntry &&
    entryHasRate(historicalEntry) &&
    currency !== displayCurrency &&
    displayCurrency !== 'ILS'
      ? resolveHistoricalUnitRate(historicalEntry, currency, displayCurrency)
      : null;

  let displayAmount: number;
  if (directHistoricalDisplayRate != null && directHistoricalDisplayRate > 0) {
    const { feeDisabled } = readOverrideFlags(options);
    const spotConverted = roundMoney(amount * directHistoricalDisplayRate);
    const feePercent = resolveExpenseLedgerFeePercent(
      currency,
      feeDisabled,
      options.historicalFeePercent,
    );
    displayAmount = applyFeeMultiplier(spotConverted, feePercent);
  } else {
    displayAmount = projectExpensePrimaryDisplayAmount(
      amount,
      currency,
      recorded.ilsAmount,
      displayCurrency,
      liveRates,
    );
  }

  return { ...recorded, displayAmount };
}

export function convertExpenseAmountToIls(
  amount: number,
  currency: string,
  rates: ExchangeRates,
  options?: ConvertExpenseToIlsOptions,
): number | null {
  return recordExpenseConversionToIls(amount, currency, rates, options)?.ilsAmount ?? null;
}
