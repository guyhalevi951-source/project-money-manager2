import {
  applyCommissionToAmount,
  shouldApplyCurrencyCommission,
  type CommissionBypassOptions,
} from './commissionMath';
import {
  GLOBAL_COMMISSION_CURRENCY,
  type CommissionCurrency,
  type CurrencyCommissionEntry,
} from './currencyCommissionService';
import type { ExchangeRates } from './exchangeRateService';
import type { ManualExchangeOverrideEntry } from './manualExchangeOverrideService';
import { roundMoney } from './money';

/** Saved commission rule passed into pure processing (no storage reads). */
export interface ActiveFeeRule {
  currency: CommissionCurrency;
  percent: number;
}

/** Spot and manual exchange data for pure conversion (no storage reads). */
export interface ActiveExchangeRates {
  /** ILS-based spot table: `ilsToForeign[USD]` = USD per 1 ILS. */
  ilsToForeign: Record<string, number>;
  /**
   * Optional manual pair overrides.
   * Each entry: 1 `fromCurrency` = `rate` × `toCurrency`.
   * `pairSpecific = true`  → applies only to this exact currency pair.
   * `pairSpecific = false` → global override; applies to every pair requested.
   */
  manualPairs?: ReadonlyArray<{
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    pairSpecific: boolean;
  }>;
}

export interface ProcessTransactionOptions {
  /** App display currency — expenses in this currency skip conversion fees. */
  displayCurrency?: string;
  /** When set, overrides stored fees (e.g. exchange simulator draft). */
  draftFeePercent?: number;
}

/** Standard output for a single processed bank/API transaction. */
export interface ProcessedTransaction {
  originalAmount: number;
  originalCurrency: string;
  appliedFeePercentage: number;
  feeAmountInTargetCurrency: number;
  finalConvertedAmount: number;
}

function normalizeCurrencyCode(currency: string): string {
  return currency.trim().toUpperCase();
}

export function toActiveFeesFromCommissionEntries(
  entries: ReadonlyArray<CurrencyCommissionEntry>,
): ActiveFeeRule[] {
  return entries.map((entry) => ({
    currency: entry.currency,
    percent: entry.percent,
  }));
}

export function toActiveExchangeRatesFromSnapshot(
  rates: ExchangeRates,
  manualOverrides: ReadonlyArray<ManualExchangeOverrideEntry> = [],
): ActiveExchangeRates {
  const manualPairs: Array<{
    fromCurrency: string;
    toCurrency: string;
    rate: number;
    pairSpecific: boolean;
  }> = [];

  for (const entry of manualOverrides) {
    manualPairs.push({
      fromCurrency: entry.baseCurrency,
      toCurrency: entry.quoteCurrency,
      rate: entry.rate,
      pairSpecific: entry.pairSpecific,
    });
    manualPairs.push({
      fromCurrency: entry.quoteCurrency,
      toCurrency: entry.baseCurrency,
      rate: 1 / entry.rate,
      pairSpecific: entry.pairSpecific,
    });
  }

  return {
    ilsToForeign: rates.ilsToForeign,
    manualPairs,
  };
}

/** Saved percent for a currency (specific entry, else global ALL). */
export function resolveActiveFeePercent(
  activeFees: ReadonlyArray<ActiveFeeRule>,
  currency: string,
): number | null {
  const code = normalizeCurrencyCode(currency);
  const specific = activeFees.find((entry) => entry.currency === code);
  if (specific) return specific.percent;

  const global = activeFees.find((entry) => entry.currency === GLOBAL_COMMISSION_CURRENCY);
  return global?.percent ?? null;
}

export function resolveCommissionBypassOptions(
  activeFees: ReadonlyArray<ActiveFeeRule>,
  fromCurrency: string,
  displayCurrency: string,
): CommissionBypassOptions {
  const from = normalizeCurrencyCode(fromCurrency);
  const specific = activeFees.find((entry) => entry.currency === from);
  const global = activeFees.find((entry) => entry.currency === GLOBAL_COMMISSION_CURRENCY);
  const usesGlobalFallback = !specific && global != null;
  const ilsSpecificFee = from === 'ILS' && specific != null;

  return {
    displayCurrency,
    ignoreDisplayCurrencyBypass: usesGlobalFallback || ilsSpecificFee,
  };
}

/** Percent actually applied between two currencies (fee on from-currency + bypass rules). */
export function getAppliedCommissionPercentForPair(
  activeFees: ReadonlyArray<ActiveFeeRule>,
  fromCurrency: string,
  toCurrency: string,
  displayCurrency: string,
  draftPercent?: number,
): number {
  const from = normalizeCurrencyCode(fromCurrency);
  const to = normalizeCurrencyCode(toCurrency);
  if (from === to) return 0;

  const raw =
    draftPercent != null && draftPercent > 0
      ? draftPercent
      : resolveActiveFeePercent(activeFees, from) ?? 0;
  if (!(raw > 0)) return 0;

  const bypassOptions = resolveCommissionBypassOptions(activeFees, from, displayCurrency);
  if (!shouldApplyCurrencyCommission(from, to, bypassOptions)) return 0;

  return raw;
}

function resolveManualPairRate(
  activeExchangeRates: ActiveExchangeRates,
  fromCurrency: string,
  toCurrency: string,
): number | null {
  const from = normalizeCurrencyCode(fromCurrency);
  const to = normalizeCurrencyCode(toCurrency);
  if (from === to) return 1;

  const pairs = activeExchangeRates.manualPairs ?? [];

  // 1. Pair-specific match (exact currency pair only)
  const directSpecific = pairs.find(
    (p) => p.pairSpecific && p.fromCurrency === from && p.toCurrency === to,
  );
  if (directSpecific && directSpecific.rate > 0) return directSpecific.rate;

  const inverseSpecific = pairs.find(
    (p) => p.pairSpecific && p.fromCurrency === to && p.toCurrency === from,
  );
  if (inverseSpecific && inverseSpecific.rate > 0) return 1 / inverseSpecific.rate;

  // 2. Global override (pairSpecific === false): applies to any pair via its stored direction
  const directGlobal = pairs.find(
    (p) => !p.pairSpecific && p.fromCurrency === from && p.toCurrency === to,
  );
  if (directGlobal && directGlobal.rate > 0) return directGlobal.rate;

  const inverseGlobal = pairs.find(
    (p) => !p.pairSpecific && p.fromCurrency === to && p.toCurrency === from,
  );
  if (inverseGlobal && inverseGlobal.rate > 0) return 1 / inverseGlobal.rate;

  return null;
}

/**
 * Converts an amount using injected spot/manual rates only (no localStorage or UI).
 */
export function convertAmountWithActiveRates(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  activeExchangeRates: ActiveExchangeRates,
): number | null {
  const from = normalizeCurrencyCode(fromCurrency);
  const to = normalizeCurrencyCode(toCurrency);

  if (from === to) return amount;
  if (!(amount > 0)) return 0;

  const manualRate = resolveManualPairRate(activeExchangeRates, from, to);
  if (manualRate != null) return amount * manualRate;

  const fromIlsToForeign = from === 'ILS' ? 1 : activeExchangeRates.ilsToForeign[from];
  const toIlsToForeign = to === 'ILS' ? 1 : activeExchangeRates.ilsToForeign[to];

  if (
    typeof fromIlsToForeign !== 'number' ||
    fromIlsToForeign <= 0 ||
    typeof toIlsToForeign !== 'number' ||
    toIlsToForeign <= 0
  ) {
    return null;
  }

  const baseAmount = amount / fromIlsToForeign;
  return baseAmount * toIlsToForeign;
}

/**
 * Processes a raw transaction with user commission and exchange rules.
 * Suitable for batch open-banking imports — pass fees/rates as arguments.
 */
export function processTransactionWithUserRules(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  activeFees: ReadonlyArray<ActiveFeeRule>,
  activeExchangeRates: ActiveExchangeRates,
  options?: ProcessTransactionOptions,
): ProcessedTransaction | null {
  const from = normalizeCurrencyCode(fromCurrency);
  const to = normalizeCurrencyCode(toCurrency);

  if (!(amount > 0) || !from || !to) return null;

  const displayCurrency = options?.displayCurrency ?? 'ILS';
  const spotConverted = convertAmountWithActiveRates(amount, from, to, activeExchangeRates);
  if (spotConverted == null) return null;

  const appliedFeePercentage = getAppliedCommissionPercentForPair(
    activeFees,
    from,
    to,
    displayCurrency,
    options?.draftFeePercent,
  );

  const bypassOptions = resolveCommissionBypassOptions(activeFees, from, displayCurrency);
  const finalConvertedAmount = roundMoney(
    applyCommissionToAmount(spotConverted, appliedFeePercentage, from, to, bypassOptions),
  );
  const feeAmountInTargetCurrency = roundMoney(finalConvertedAmount - roundMoney(spotConverted));

  return {
    originalAmount: amount,
    originalCurrency: from,
    appliedFeePercentage,
    feeAmountInTargetCurrency: feeAmountInTargetCurrency > 0 ? feeAmountInTargetCurrency : 0,
    finalConvertedAmount,
  };
}

/** Batch variant for processing many API transactions with the same target currency. */
export function processTransactionsWithUserRules(
  transactions: ReadonlyArray<{ amount: number; originalCurrency: string }>,
  toCurrency: string,
  activeFees: ReadonlyArray<ActiveFeeRule>,
  activeExchangeRates: ActiveExchangeRates,
  options?: ProcessTransactionOptions,
): ProcessedTransaction[] {
  const results: ProcessedTransaction[] = [];

  for (const transaction of transactions) {
    const processed = processTransactionWithUserRules(
      transaction.amount,
      transaction.originalCurrency,
      toCurrency,
      activeFees,
      activeExchangeRates,
      options,
    );
    if (processed) results.push(processed);
  }

  return results;
}
