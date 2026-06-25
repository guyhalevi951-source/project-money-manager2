/**
 * Expense conversion pipeline — status-bound, dual-snapshot architecture.
 *
 * At save time, BOTH the manual-rate path and the spot-rate path are computed
 * and stored on the expense.  The user's toggle choice determines which amount
 * becomes the primary ledger `amount`, but both values are immutably preserved
 * so the history card can switch between them at any time.
 *
 * Mathematical flow (foreign → ILS ledger):
 *   rawIls      = amount × unitRate
 *   finalIls    = rawIls × (1 + appliedFeePercent / 100)   when fee active
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
  convertAmountWithActiveRates,
  getAppliedCommissionPercentForPair,
  processTransactionWithUserRules,
  resolveActiveFeePercent,
  toActiveExchangeRatesFromSnapshot,
  toActiveFeesFromCommissionEntries,
} from './transactionProcessingService';
import {
  getManualExchangeOverride,
  hasActiveManualOverrideForPair,
  listActiveManualExchangeOverrides,
} from './manualExchangeOverrideService';
import { getApiRateForDate } from './rateCacheService';
import { roundMoney, smartRoundMoney } from './money';
import {
  formatAmountWithSymbol,
  resolveExpenseDisplayAmount,
  symbolToCurrency,
  type ExpenseDisplayAmount,
} from './displayCurrencyUtils';

export type ConvertExpenseToIlsOptions = {
  displayCurrency?: ExpenseCurrency;
  /** Ignore active manual overrides — use spot rate only. */
  manualRateDisabled?: boolean;
  /** Drop any conversion fee/commission for this conversion. */
  feeDisabled?: boolean;
  /** Transaction date (`YYYY-MM-DD`) for spot-rate resolution. */
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

/**
 * Full dual-rate snapshot captured at expense save time.
 * Both paths (manual + spot) are pre-calculated and stored immutably on the expense.
 */
export interface DualExpenseConversionSnapshot {
  /** Unit rate used for the manual path (null when no active manual override exists). */
  savedManualRate: number | null;
  /** Unit rate used for the spot/market path. */
  savedSpotRate: number;
  /** ILS ledger amount via manual rate + optional fee. */
  amountInManual: number | null;
  /** ILS ledger amount via spot rate + optional fee. */
  amountInSpot: number;
  /** Commission % applied to both paths (0 when no active fee). */
  appliedFeePercent: number;
  /** Whether an active global manual override exists for this pair. */
  manualRateAvailable: boolean;
  /** Whether an active global commission fee exists for this currency. */
  feeAvailable: boolean;
}

/** Resolve the displayed ILS amount from a saved dual snapshot based on user toggles. */
export function resolveExpenseAmountFromSnapshot(
  snapshot: Pick<DualExpenseConversionSnapshot, 'amountInManual' | 'amountInSpot'>,
  options: { manualRateUsed: boolean; feeApplied?: boolean },
): number {
  if (options.manualRateUsed && snapshot.amountInManual != null) {
    return snapshot.amountInManual;
  }
  return snapshot.amountInSpot;
}

/** Commission % for ledger conversion — honors source-currency rules (incl. global ALL). */
function resolveExpenseLedgerFeePercent(fromCurrency: string, feeDisabled: boolean): number {
  if (feeDisabled || fromCurrency === 'ILS') return 0;
  const activeFees = toActiveFeesFromCommissionEntries(listActiveCurrencyCommissions());
  const percent = resolveActiveFeePercent(activeFees, fromCurrency) ?? 0;
  if (!(percent > 0) || percent > 100) return 0;
  return percent;
}

function applyFeeMultiplier(rawIls: number, feePercent: number): number {
  if (!(feePercent > 0)) return roundMoney(rawIls);
  return roundMoney(rawIls * (1 + feePercent / 100));
}

type DualConversionOptions = {
  transactionDate?: string;
  feeDisabled?: boolean;
  displayCurrency?: ExpenseCurrency;
};

/** Foreign-to-foreign display path: convert via display currency then back to ILS ledger. */
function buildDisplayPathDualLedgerSnapshot(
  amount: number,
  from: ExpenseCurrency,
  displayCurrency: ExpenseCurrency,
  liveRates: ExchangeRates,
  feeDisabled: boolean,
): Pick<
  DualExpenseConversionSnapshot,
  'savedManualRate' | 'savedSpotRate' | 'amountInManual' | 'amountInSpot' | 'manualRateAvailable' | 'appliedFeePercent'
> | null {
  if (from === 'ILS' || displayCurrency === 'ILS' || from === displayCurrency) return null;

  const activeFees = toActiveFeesFromCommissionEntries(listActiveCurrencyCommissions());
  const manualOverrides = listActiveManualExchangeOverrides();
  const withManual = toActiveExchangeRatesFromSnapshot(liveRates, manualOverrides);
  const spotOnly = toActiveExchangeRatesFromSnapshot(liveRates, []);

  const feePercent = feeDisabled
    ? 0
    : getAppliedCommissionPercentForPair(activeFees, from, displayCurrency, displayCurrency);

  const manualTx = processTransactionWithUserRules(
    amount,
    from,
    displayCurrency,
    activeFees,
    withManual,
    { displayCurrency },
  );
  const spotTx = processTransactionWithUserRules(
    amount,
    from,
    displayCurrency,
    activeFees,
    spotOnly,
    { displayCurrency },
  );
  if (manualTx == null || spotTx == null) return null;

  const manualIls = convertAmountWithActiveRates(
    manualTx.finalConvertedAmount,
    displayCurrency,
    'ILS',
    spotOnly,
  );
  const spotIls = convertAmountWithActiveRates(
    spotTx.finalConvertedAmount,
    displayCurrency,
    'ILS',
    spotOnly,
  );
  if (manualIls == null || spotIls == null || !(spotIls > 0)) return null;

  const hasDirectManualPair = hasActiveManualOverrideForPair(from, displayCurrency);
  const manualDiffers =
    Math.abs(manualTx.finalConvertedAmount - spotTx.finalConvertedAmount) /
      Math.max(spotTx.finalConvertedAmount, 1e-9) >
    1e-6;
  const manualRateAvailable = hasDirectManualPair || manualDiffers;

  const savedSpotRate = amount > 0 ? spotTx.finalConvertedAmount / amount : spotTx.finalConvertedAmount;
  const savedManualRate =
    manualRateAvailable && amount > 0 ? manualTx.finalConvertedAmount / amount : null;

  return {
    savedManualRate,
    savedSpotRate,
    amountInManual: manualRateAvailable ? roundMoney(manualIls) : null,
    amountInSpot: roundMoney(spotIls),
    manualRateAvailable,
    appliedFeePercent: feePercent,
  };
}

function mergeDualSnapshots(
  ilsPath: DualExpenseConversionSnapshot,
  displayPath: ReturnType<typeof buildDisplayPathDualLedgerSnapshot>,
  feeAvailable: boolean,
): DualExpenseConversionSnapshot {
  if (displayPath == null || !displayPath.manualRateAvailable) {
    return { ...ilsPath, feeAvailable: ilsPath.feeAvailable || feeAvailable };
  }
  return {
    savedManualRate: displayPath.savedManualRate ?? ilsPath.savedManualRate,
    savedSpotRate: displayPath.savedSpotRate ?? ilsPath.savedSpotRate,
    amountInManual: displayPath.amountInManual ?? ilsPath.amountInManual,
    amountInSpot: displayPath.amountInSpot ?? ilsPath.amountInSpot,
    appliedFeePercent: displayPath.appliedFeePercent > 0 ? displayPath.appliedFeePercent : ilsPath.appliedFeePercent,
    manualRateAvailable: true,
    feeAvailable: feeAvailable || ilsPath.feeAvailable,
  };
}

/** Live active manual override rate or spot pivot rate (1 `from` = rate × ILS). */
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

/** Spot-only rate (never manual overrides). */
async function resolveSpotRate(
  dateIso: string,
  fromCurrency: ExpenseCurrency,
  rates: ExchangeRates | null,
): Promise<number | null> {
  if (fromCurrency === 'ILS') return 1;

  const liveRates = rates ?? (await fetchExchangeRates().catch(() => null));
  if (!liveRates) return null;

  // Try unified rate cache first (API-only, no manual)
  const cached = getApiRateForDate(dateIso, fromCurrency, 'ILS');
  if (cached != null && cached > 0) return cached;

  // For past dates, fetch historical
  const today = getLocalTodayIso();
  if (dateIso < today) {
    const historical = await fetchHistoricalDirectRate(dateIso, fromCurrency, 'ILS').catch(() => null);
    if (historical != null && historical > 0) return historical;
  }

  // Fall back to today's live pivot (spot-only)
  const spotOnly = toActiveExchangeRatesFromSnapshot(liveRates, []);
  return convertAmountWithActiveRates(1, fromCurrency, 'ILS', spotOnly) ?? null;
}

function resolveSpotRateSync(
  fromCurrency: ExpenseCurrency,
  rates: ExchangeRates,
): number | null {
  if (fromCurrency === 'ILS') return 1;
  const cached = getApiRateForDate(getLocalTodayIso(), fromCurrency, 'ILS');
  if (cached != null && cached > 0) return cached;
  return computeDirectUnitRateFromIlsPivot(fromCurrency, 'ILS', rates.ilsToForeign);
}

/**
 * Build a DualExpenseConversionSnapshot capturing both rate paths.
 * This is the primary save-time function — always call this on form submit.
 */
export async function recordDualExpenseConversion(
  amount: number,
  currency: string,
  rates: ExchangeRates | null,
  options?: DualConversionOptions,
): Promise<DualExpenseConversionSnapshot | null> {
  const from = currency.trim().toUpperCase() as ExpenseCurrency;
  if (!(amount > 0)) return null;

  const liveRates = rates ?? (await fetchExchangeRates().catch(() => null));
  if (!liveRates) return null;

  if (from === 'ILS') {
    const ils = roundMoney(amount);
    return {
      savedManualRate: null,
      savedSpotRate: 1,
      amountInManual: null,
      amountInSpot: ils,
      appliedFeePercent: 0,
      manualRateAvailable: false,
      feeAvailable: false,
    };
  }

  const transactionDate = options?.transactionDate ?? getLocalTodayIso();
  const feeDisabled = options?.feeDisabled ?? false;
  const feePercent = resolveExpenseLedgerFeePercent(from, feeDisabled);
  const feeAvailable = feePercent > 0;

  // Manual path (ILS pivot)
  const liveResult = resolveLiveManualOrSpotRate(from, liveRates);
  const manualRate = liveResult?.manualRateUsed ? liveResult.rate : null;
  const ilsManualRateAvailable = manualRate != null;

  const amountInManual = manualRate != null
    ? applyFeeMultiplier(smartRoundMoney(amount * manualRate), feePercent)
    : null;

  // Spot path (ILS pivot)
  const spotRate = await resolveSpotRate(transactionDate, from, liveRates);
  if (spotRate == null || !(spotRate > 0)) return null;

  const amountInSpot = applyFeeMultiplier(smartRoundMoney(amount * spotRate), feePercent);

  const ilsPath: DualExpenseConversionSnapshot = {
    savedManualRate: manualRate,
    savedSpotRate: spotRate,
    amountInManual,
    amountInSpot,
    appliedFeePercent: feePercent,
    manualRateAvailable: ilsManualRateAvailable,
    feeAvailable,
  };

  const displayCurrency = options?.displayCurrency;
  if (displayCurrency && displayCurrency !== 'ILS' && displayCurrency !== from) {
    const displayPath = buildDisplayPathDualLedgerSnapshot(
      amount,
      from,
      displayCurrency,
      liveRates,
      feeDisabled,
    );
    return mergeDualSnapshots(ilsPath, displayPath, feeAvailable);
  }

  return ilsPath;
}

// ── Legacy single-path conversion (kept for backward compat during transition) ──

function readOverrideFlags(options?: ConvertExpenseToIlsOptions): {
  manualRateDisabled: boolean;
  feeDisabled: boolean;
} {
  const legacy = options as ConvertExpenseToIlsOptions & {
    disableManualRate?: boolean;
    disableFee?: boolean;
  };
  return {
    manualRateDisabled: Boolean(legacy?.manualRateDisabled ?? (legacy as { disableManualRate?: boolean })?.disableManualRate),
    feeDisabled: Boolean(legacy?.feeDisabled ?? (legacy as { disableFee?: boolean })?.disableFee),
  };
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

  if (from === 'ILS') {
    return { ilsAmount: roundMoney(amount), appliedFeePercent: 0, manualRateUsed: false };
  }

  const feePercent = resolveExpenseLedgerFeePercent(from, feeDisabled);

  let unitRate: number;
  let manualRateUsed: boolean;

  if (manualRateDisabled) {
    const spotRate = await resolveSpotRate(transactionDate, from, liveRates);
    if (spotRate == null || !(spotRate > 0)) return null;
    unitRate = spotRate;
    manualRateUsed = false;
  } else {
    const result = resolveLiveManualOrSpotRate(from, liveRates);
    if (!result) return null;
    unitRate = result.rate;
    manualRateUsed = result.manualRateUsed;
  }

  const rawIls = smartRoundMoney(amount * unitRate);
  const ilsAmount = applyFeeMultiplier(rawIls, feePercent);

  return { ilsAmount, appliedFeePercent: feePercent, manualRateUsed };
}

export function recordExpenseConversionToIls(
  amount: number,
  currency: string,
  rates: ExchangeRates,
  options?: ConvertExpenseToIlsOptions,
): RecordedExpenseConversion | null {
  const from = currency.trim().toUpperCase() as ExpenseCurrency;
  if (!(amount > 0)) return null;

  const { manualRateDisabled, feeDisabled } = readOverrideFlags(options);

  if (from === 'ILS') {
    return { ilsAmount: roundMoney(amount), appliedFeePercent: 0, manualRateUsed: false };
  }

  const feePercent = resolveExpenseLedgerFeePercent(from, feeDisabled);

  let unitRate: number;
  let manualRateUsed: boolean;

  if (manualRateDisabled) {
    const spotRate = resolveSpotRateSync(from, rates);
    if (spotRate == null || !(spotRate > 0)) return null;
    unitRate = spotRate;
    manualRateUsed = false;
  } else {
    const result = resolveLiveManualOrSpotRate(from, rates);
    if (!result) return null;
    unitRate = result.rate;
    manualRateUsed = result.manualRateUsed;
  }

  const rawIls = smartRoundMoney(amount * unitRate);
  const ilsAmount = applyFeeMultiplier(rawIls, feePercent);

  return { ilsAmount, appliedFeePercent: feePercent, manualRateUsed };
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

/**
 * Preserve immutable conversion metadata across edit sessions so toggle
 * state is not wiped when re-saving.
 */
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

/**
 * Returns true when an expense was created while a global manual rate was active
 * for its currency — edit modal checkbox stays visible permanently.
 */
export function expenseHadCreationManualRate(expense: {
  creationHadActiveManualRate?: boolean;
}): boolean {
  return expense.creationHadActiveManualRate === true;
}

/**
 * Returns true when an expense was created while a global commission fee was active
 * for its currency — edit modal checkbox stays visible permanently.
 */
export function expenseHadCreationFee(expense: {
  creationHadActiveFee?: boolean;
}): boolean {
  return expense.creationHadActiveFee === true;
}

/** Edit modal: show manual-rate toggle when creation had it OR snapshot exists. */
export function expenseEditShowsManualRateToggle(expense: {
  creationHadActiveManualRate?: boolean;
  savedManualRate?: number | null;
  amountInManual?: number;
}): boolean {
  return expenseHadCreationManualRate(expense) || expenseHasSavedManualRateSnapshot(expense);
}

/** Edit modal: show fee toggle when creation had it OR fee snapshot exists. */
export function expenseEditShowsFeeToggle(expense: {
  creationHadActiveFee?: boolean;
  feeApplied?: boolean;
  appliedFeePercent?: number;
}): boolean {
  return expenseHadCreationFee(expense) || expenseHasSavedFeeSnapshot(expense);
}

// ── Snapshot visibility helpers (independent of global settings) ─────────────

/**
 * Returns true when an expense has a saved manual rate snapshot that should be
 * displayed in the edit modal, regardless of whether the global rate is still active.
 */
export function expenseHasSavedManualRateSnapshot(expense: {
  savedManualRate?: number | null;
  amountInManual?: number;
}): boolean {
  return (
    (expense.savedManualRate != null && expense.savedManualRate > 0) ||
    expense.amountInManual != null
  );
}

/**
 * Returns true when an expense has a saved fee snapshot that should be displayed
 * in the edit modal, regardless of whether the global fee is still active.
 */
export function expenseHasSavedFeeSnapshot(expense: {
  feeApplied?: boolean;
  appliedFeePercent?: number;
}): boolean {
  return expense.feeApplied === true || (expense.appliedFeePercent ?? 0) > 0;
}

// ── Snapshot-aware edit conversion ────────────────────────────────────────────

export interface SnapshotAwareConversionOptions {
  transactionDate?: string;
  feeDisabled?: boolean;
  displayCurrency?: ExpenseCurrency;
  /** Frozen snapshot from the expense being edited. Used to preserve rates when global settings are archived. */
  existingSnapshot?: {
    savedManualRate?: number | null;
    savedSpotRate?: number;
    appliedFeePercent?: number;
  } | null;
}

/**
 * Snapshot-aware dual conversion for the edit flow.
 *
 * Manual path: use live global active rate if available; fall back to
 * `existingSnapshot.savedManualRate` so the field stays available even when
 * the global override has been archived.
 *
 * Spot path: always recalculate from live/historical spot (date may have changed).
 * Falls back to `existingSnapshot.savedSpotRate` when live data is unavailable.
 *
 * Fee: use the global active fee; fall back to `existingSnapshot.appliedFeePercent`
 * when `feeDisabled` is false but no global fee is active (archived situation).
 */
export async function recordDualExpenseConversionFromSnapshot(
  amount: number,
  currency: string,
  rates: ExchangeRates | null,
  options?: SnapshotAwareConversionOptions,
): Promise<DualExpenseConversionSnapshot | null> {
  const from = currency.trim().toUpperCase() as ExpenseCurrency;
  if (!(amount > 0)) return null;

  const liveRates = rates ?? (await fetchExchangeRates().catch(() => null));
  if (!liveRates) return null;

  if (from === 'ILS') {
    const ils = roundMoney(amount);
    return {
      savedManualRate: null,
      savedSpotRate: 1,
      amountInManual: null,
      amountInSpot: ils,
      appliedFeePercent: 0,
      manualRateAvailable: false,
      feeAvailable: false,
    };
  }

  const transactionDate = options?.transactionDate ?? getLocalTodayIso();
  const feeDisabled = options?.feeDisabled ?? false;
  const existingSnapshot = options?.existingSnapshot;

  // Fee resolution: prefer live active fee, fall back to snapshot fee when not disabled
  let feePercent = resolveExpenseLedgerFeePercent(from, feeDisabled);
  if (feePercent === 0 && !feeDisabled && existingSnapshot?.appliedFeePercent) {
    feePercent = existingSnapshot.appliedFeePercent;
  }
  // Preserve fee metadata when toggled off so edit modal can re-enable the checkbox
  const preservedFeePercent =
    feeDisabled && (existingSnapshot?.appliedFeePercent ?? 0) > 0
      ? existingSnapshot!.appliedFeePercent!
      : feePercent;
  const feeAvailable = preservedFeePercent > 0;

  // Manual path: prefer live global active rate; fall back to saved snapshot rate
  const liveResult = resolveLiveManualOrSpotRate(from, liveRates);
  let manualRate: number | null = liveResult?.manualRateUsed ? liveResult.rate : null;
  if (manualRate == null && existingSnapshot?.savedManualRate != null && existingSnapshot.savedManualRate > 0) {
    manualRate = existingSnapshot.savedManualRate;
  }
  const manualRateAvailable = manualRate != null;

  const amountInManual = manualRate != null
    ? applyFeeMultiplier(smartRoundMoney(amount * manualRate), feeDisabled ? 0 : feePercent)
    : null;

  // Spot path: fresh recalculation; fall back to snapshot spot rate when unavailable
  let spotRate = await resolveSpotRate(transactionDate, from, liveRates);
  if ((spotRate == null || !(spotRate > 0)) && existingSnapshot?.savedSpotRate != null && existingSnapshot.savedSpotRate > 0) {
    spotRate = existingSnapshot.savedSpotRate;
  }
  if (spotRate == null || !(spotRate > 0)) return null;

  const amountInSpot = applyFeeMultiplier(
    smartRoundMoney(amount * spotRate),
    feeDisabled ? 0 : feePercent,
  );

  const ilsPath: DualExpenseConversionSnapshot = {
    savedManualRate: manualRate,
    savedSpotRate: spotRate,
    amountInManual,
    amountInSpot,
    appliedFeePercent: preservedFeePercent,
    manualRateAvailable,
    feeAvailable,
  };

  const displayCurrency = options?.displayCurrency;
  if (displayCurrency && displayCurrency !== 'ILS' && displayCurrency !== from) {
    const displayPath = buildDisplayPathDualLedgerSnapshot(
      amount,
      from,
      displayCurrency,
      liveRates,
      feeDisabled,
    );
    return mergeDualSnapshots(ilsPath, displayPath, feeAvailable);
  }

  return ilsPath;
}

/**
 * Preview display amount for edit modal — snapshot-aware.
 * Calls `recordDualExpenseConversionFromSnapshot` so archived rates are respected.
 */
export async function previewExpenseDisplayAmountFromSnapshot(
  amount: number,
  currency: ExpenseCurrency,
  rates: ExchangeRates | null,
  options: SnapshotAwareConversionOptions & {
    displayCurrency: ExpenseCurrency;
    manualRateDisabled: boolean;
  },
): Promise<ExpenseDisplayPreview | null> {
  const snapshot = await recordDualExpenseConversionFromSnapshot(amount, currency, rates, {
    transactionDate: options.transactionDate,
    feeDisabled: options.feeDisabled,
    displayCurrency: options.displayCurrency,
    existingSnapshot: options.existingSnapshot,
  });
  if (!snapshot) return null;

  const liveRates = rates ?? (await fetchExchangeRates().catch(() => null));
  if (!liveRates) return null;

  const manualRateUsed = !options.manualRateDisabled && snapshot.manualRateAvailable;
  const ilsAmount = resolveExpenseAmountFromSnapshot(snapshot, { manualRateUsed });

  const displayAmount = projectExpensePrimaryDisplayAmount(
    amount,
    currency,
    ilsAmount,
    options.displayCurrency,
    liveRates,
  );

  return { ilsAmount, appliedFeePercent: snapshot.appliedFeePercent, manualRateUsed, displayAmount };
}

// ── Stored expense display (history card ↔ edit modal parity) ─────────────────

/** Fields required to render a saved expense row identically to the edit preview. */
export interface StoredExpenseDisplayFields {
  amount: number;
  originalAmount?: number;
  originalCurrency?: string;
  amountInManual?: number | null;
  amountInSpot?: number;
  savedManualRate?: number | null;
  savedSpotRate?: number;
  manualRateUsed?: boolean;
  feeApplied?: boolean;
  creationHadActiveManualRate?: boolean;
}

export interface StoredExpenseDisplayView {
  ledgerIlsAmount: number;
  primaryDisplayAmount: number;
  showManualBadge: boolean;
  showFeeBadge: boolean;
  showDualRateToggle: boolean;
  showSecondaryLine: boolean;
  manualRateSelected: boolean;
}

/** True when both manual and spot ledger paths are stored and switchable on the history card. */
export function expenseHasDualRateSnapshot(expense: {
  amountInManual?: number | null;
  amountInSpot?: number;
  savedManualRate?: number | null;
  savedSpotRate?: number;
}): boolean {
  return (
    expense.amountInManual != null &&
    expense.amountInSpot != null &&
    (expense.savedManualRate != null ||
      (expense.savedSpotRate != null && expense.savedSpotRate > 0))
  );
}

function storedExpenseShowSecondaryLine(
  expense: Pick<StoredExpenseDisplayFields, 'originalAmount' | 'originalCurrency'>,
  displayCurrency: ExpenseCurrency,
): boolean {
  const hasOriginal =
    expense.originalAmount != null &&
    expense.originalAmount > 0 &&
    Boolean(expense.originalCurrency?.trim());
  if (!hasOriginal) {
    return displayCurrency !== 'ILS';
  }
  const expenseCurrency = symbolToCurrency(expense.originalCurrency!, displayCurrency);
  if (!expenseCurrency) {
    return true;
  }
  return expenseCurrency !== displayCurrency;
}

/** Authoritative ILS ledger for a saved expense — respects dual snapshot + manual toggle. */
export function resolveStoredExpenseLedgerIls(expense: StoredExpenseDisplayFields): number {
  if (expense.amountInManual != null && expense.amountInSpot != null) {
    return resolveExpenseAmountFromSnapshot(
      { amountInManual: expense.amountInManual, amountInSpot: expense.amountInSpot },
      { manualRateUsed: expense.manualRateUsed !== false },
    );
  }
  return expense.amount;
}

/**
 * Sync resolver for history cards — mirrors `previewExpenseDisplayAmountFromSnapshot`
 * using persisted snapshot fields only (no async re-conversion).
 */
export function resolveStoredExpenseDisplayView(
  expense: StoredExpenseDisplayFields,
  displayCurrency: ExpenseCurrency,
  rates: ExchangeRates | null,
): StoredExpenseDisplayView {
  const manualRateSelected = expense.manualRateUsed !== false;
  const ledgerIlsAmount = resolveStoredExpenseLedgerIls(expense);

  const hasOriginal =
    expense.originalAmount != null &&
    expense.originalAmount > 0 &&
    Boolean(expense.originalCurrency?.trim());
  const typedAmount = hasOriginal ? expense.originalAmount! : expense.amount;
  const expenseCurrency = hasOriginal
    ? (symbolToCurrency(expense.originalCurrency!, displayCurrency) ?? 'ILS')
    : 'ILS';

  let primaryDisplayAmount: number;
  if (displayCurrency === 'ILS') {
    primaryDisplayAmount = ledgerIlsAmount;
  } else if (rates) {
    primaryDisplayAmount = projectExpensePrimaryDisplayAmount(
      typedAmount,
      expenseCurrency,
      ledgerIlsAmount,
      displayCurrency,
      rates,
    );
  } else if (expenseCurrency === displayCurrency) {
    primaryDisplayAmount = typedAmount;
  } else {
    primaryDisplayAmount = ledgerIlsAmount;
  }

  const showDualRateToggle = expenseHasDualRateSnapshot(expense);
  const showSecondaryLine =
    showDualRateToggle || storedExpenseShowSecondaryLine(expense, displayCurrency);

  return {
    ledgerIlsAmount,
    primaryDisplayAmount,
    showManualBadge:
      manualRateSelected &&
      (expenseHadCreationManualRate(expense) || expenseHasSavedManualRateSnapshot(expense)),
    showFeeBadge: expense.feeApplied === true,
    showDualRateToggle,
    showSecondaryLine,
    manualRateSelected,
  };
}

/** Format a resolved view into primary/secondary display strings for UI components. */
export function formatStoredExpenseDisplayView(
  view: StoredExpenseDisplayView,
  expense: Pick<StoredExpenseDisplayFields, 'originalAmount' | 'originalCurrency'>,
  displayCurrency: ExpenseCurrency,
  rates: ExchangeRates | null,
): ExpenseDisplayAmount {
  const formatted = resolveExpenseDisplayAmount(
    view.ledgerIlsAmount,
    displayCurrency,
    rates,
    expense.originalAmount,
    expense.originalCurrency,
  );

  const primary = formatAmountWithSymbol(view.primaryDisplayAmount, displayCurrency, {
    forceTwoDecimals: displayCurrency !== 'ILS',
  });

  if (primary === formatted.primary) {
    return formatted;
  }

  return { ...formatted, primary };
}

/** @deprecated Kept for any remaining callers outside the new dual-snapshot flow. */
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
