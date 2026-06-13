/**
 * Expense conversion pipeline — deterministic, reactive, single source of truth.
 *
 * Mathematical flow (foreign → ILS ledger, then projected to display):
 *   rawIls      = amount × unitRate
 *   finalIls    = rawIls × (1 + appliedFeePercent / 100)   when fee active
 *   displayAmt  = project(finalIls) per resolveExpenseDisplayAmount rules
 *
 * Modifier combinations:
 *   A  Both active        → live manual (or spot) rate + fee%
 *   B  disableManualRate  → date-scoped apiRate only + fee%
 *   C  disableFee         → rate × 1.0
 *   D  Both disabled      → date-scoped apiRate × 1.0
 */

import { listActiveCurrencyCommissions } from './currencyCommissionService';
import {
  computeDirectUnitRateFromIlsPivot,
  convertIlsToForeign,
  fetchExchangeRates,
  fetchHistoricalDirectRate,
  getLocalTodayIso,
  type ExchangeRates,
  type ExpenseCurrency,
} from './exchangeRateService';
import {
  getManualExchangeOverride,
  listActiveManualExchangeOverrides,
} from './manualExchangeOverrideService';
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
  disableManualRate?: boolean;
  /** Drop any conversion fee/commission for this conversion. */
  disableFee?: boolean;
  /** Transaction date (`YYYY-MM-DD`) for date-scoped API rate resolution. */
  transactionDate?: string;
};

export interface RecordedExpenseConversion {
  ilsAmount: number;
  appliedFeePercent: number;
  manualRateUsed: boolean;
}

export interface ExpenseDisplayPreview extends RecordedExpenseConversion {
  displayAmount: number;
}

/** Commission % for ledger conversion — honors source-currency rules (incl. global ALL). */
function resolveExpenseLedgerFeePercent(fromCurrency: string, disableFee: boolean): number {
  if (disableFee || fromCurrency === 'ILS') return 0;
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
): { rate: number; manualRateUsed: boolean } | null {
  if (from === 'ILS') return { rate: 1, manualRateUsed: false };

  const manualDirect = getManualExchangeOverride(from, 'ILS');
  if (manualDirect != null && manualDirect > 0) {
    return { rate: manualDirect, manualRateUsed: true };
  }

  const withManual = toActiveExchangeRatesFromSnapshot(rates, listActiveManualExchangeOverrides());
  const spotOnly = toActiveExchangeRatesFromSnapshot(rates, []);

  const rateWithManual = convertAmountWithActiveRates(1, from, 'ILS', withManual);
  const rateSpotOnly = convertAmountWithActiveRates(1, from, 'ILS', spotOnly);

  if (rateWithManual == null || !(rateWithManual > 0)) return null;

  const manualUsed =
    rateSpotOnly == null ||
    Math.abs(rateWithManual - rateSpotOnly) / Math.max(rateSpotOnly, 1e-9) > 1e-6;

  return { rate: rateWithManual, manualRateUsed: manualUsed };
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

  const today = getLocalTodayIso();
  if (dateIso < today) {
    const historical = await fetchHistoricalDirectRate(dateIso, fromCurrency, toCurrency).catch(
      () => null,
    );
    if (historical != null && historical > 0) return historical;
  }

  const liveRates = rates ?? (await fetchExchangeRates().catch(() => null));
  if (!liveRates) return null;

  return computeDirectUnitRateFromIlsPivot(fromCurrency, toCurrency, liveRates.ilsToForeign);
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
  return computeDirectUnitRateFromIlsPivot(from, to, rates.ilsToForeign);
}

/**
 * Core deterministic conversion — shared by sync, async, and live preview paths.
 */
function computeExpenseIlsConversion(
  amount: number,
  from: ExpenseCurrency,
  rates: ExchangeRates,
  options: {
    transactionDate: string;
    disableManualRate: boolean;
    disableFee: boolean;
    unitRate: number;
    manualRateUsed: boolean;
  },
): RecordedExpenseConversion {
  const rawIls = from === 'ILS' ? amount : smartRoundMoney(amount * options.unitRate);
  const appliedFeePercent = resolveExpenseLedgerFeePercent(from, options.disableFee);
  const ilsAmount = applyFeeMultiplier(rawIls, appliedFeePercent);

  return {
    ilsAmount,
    appliedFeePercent,
    manualRateUsed: options.manualRateUsed,
  };
}

async function resolveUnitRateToIls(
  from: ExpenseCurrency,
  transactionDate: string,
  rates: ExchangeRates,
  disableManualRate: boolean,
): Promise<{ rate: number; manualRateUsed: boolean } | null> {
  if (from === 'ILS') return { rate: 1, manualRateUsed: false };

  if (disableManualRate) {
    const apiRate = await resolveDateScopedApiRate(transactionDate, from, 'ILS', rates);
    if (apiRate == null || !(apiRate > 0)) return null;
    return { rate: apiRate, manualRateUsed: false };
  }

  return resolveLiveManualOrSpotRate(from, rates);
}

function resolveUnitRateToIlsSync(
  from: ExpenseCurrency,
  transactionDate: string,
  rates: ExchangeRates,
  disableManualRate: boolean,
): { rate: number; manualRateUsed: boolean } | null {
  if (from === 'ILS') return { rate: 1, manualRateUsed: false };

  if (disableManualRate) {
    const apiRate = resolveDateScopedApiRateSync(transactionDate, from, 'ILS', rates);
    if (apiRate == null || !(apiRate > 0)) return null;
    return { rate: apiRate, manualRateUsed: false };
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
  const disableManualRate = Boolean(options?.disableManualRate);
  const disableFee = Boolean(options?.disableFee);

  const unit = await resolveUnitRateToIls(from, transactionDate, liveRates, disableManualRate);
  if (!unit) return null;

  return computeExpenseIlsConversion(amount, from, liveRates, {
    transactionDate,
    disableManualRate,
    disableFee,
    unitRate: unit.rate,
    manualRateUsed: unit.manualRateUsed,
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
  const disableManualRate = Boolean(options?.disableManualRate);
  const disableFee = Boolean(options?.disableFee);

  const unit = resolveUnitRateToIlsSync(from, transactionDate, rates, disableManualRate);
  if (!unit) return null;

  return computeExpenseIlsConversion(amount, from, rates, {
    transactionDate,
    disableManualRate,
    disableFee,
    unitRate: unit.rate,
    manualRateUsed: unit.manualRateUsed,
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

  const displayAmount = projectExpensePrimaryDisplayAmount(
    amount,
    currency,
    recorded.ilsAmount,
    options.displayCurrency,
    liveRates,
  );

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
