/**
 * Central direct-pair conversion resolver.
 *
 * Priority for every currency pair:
 *   P1  Manual override (direct pair + inverse 1/rate)
 *   P2  Cached API rate (unified rate cache + app_currency_cache)
 *   P3  Network fetch via {@link fetchDirectPairMarketRate} (Frankfurter → USD pivot)
 *
 * Foreign-to-foreign pairs NEVER use ILS as an intermediary.
 */

import type { ExpenseCurrency } from '../constants/currencies';
import {
  computeCrossRateViaUsdPivot,
  fetchDirectPairMarketRate,
  getCachedExchangeRates,
  getLocalTodayIso,
  isForeignToForeign,
  peekHistoricalDirectRate,
  resolveIlsLegDirectUnitRate,
  type ExchangeRates,
} from './exchangeRateService';
import { getManualExchangeOverrideForPair } from './manualExchangeOverrideService';
import { roundMoney, smartRoundMoney } from './money';
import { ensureRate, resolveRate } from './rateCacheService';
import type { ActiveExchangeRates } from './transactionProcessingService';

export type DirectPairRateSource =
  | 'manual'
  | 'cache'
  | 'stale-cache'
  | 'api'
  | 'usd-pivot'
  | 'none';

export interface DirectPairUnitRateResult {
  rate: number | null;
  source: DirectPairRateSource;
  manualRateUsed: boolean;
}

export { isForeignToForeign };

function normalizeCode(currency: string): string {
  return currency.trim().toUpperCase();
}

function resolveManualPairFromContext(
  activeExchangeRates: ActiveExchangeRates | undefined,
  from: string,
  to: string,
): number | null {
  const pairs = activeExchangeRates?.manualPairs ?? [];

  const directSpecific = pairs.find(
    (p) => p.pairSpecific && p.fromCurrency === from && p.toCurrency === to,
  );
  if (directSpecific && directSpecific.rate > 0) return directSpecific.rate;

  const inverseSpecific = pairs.find(
    (p) => p.pairSpecific && p.fromCurrency === to && p.toCurrency === from,
  );
  if (inverseSpecific && inverseSpecific.rate > 0) return 1 / inverseSpecific.rate;

  const directGlobal = pairs.find(
    (p) => !p.pairSpecific && p.fromCurrency === from && p.toCurrency === to,
  );
  if (directGlobal && directGlobal.rate > 0) return directGlobal.rate;

  const inverseGlobal = pairs.find(
    (p) => !p.pairSpecific && p.fromCurrency === to && p.toCurrency === from,
  );
  if (inverseGlobal && inverseGlobal.rate > 0) return 1 / inverseGlobal.rate;

  return getManualExchangeOverrideForPair(from, to);
}

function resolveSyncSpotFallback(
  from: string,
  to: string,
  ilsToForeign: Record<string, number>,
): { rate: number; source: DirectPairRateSource } | null {
  if (isForeignToForeign(from, to)) {
    const rate = computeCrossRateViaUsdPivot(from, to, ilsToForeign);
    if (rate != null && rate > 0) return { rate, source: 'usd-pivot' };
    return null;
  }

  const rate = resolveIlsLegDirectUnitRate(from, to, ilsToForeign);
  if (rate != null && rate > 0) return { rate, source: 'cache' };
  return null;
}

export interface ResolveDirectPairUnitRateSyncOptions {
  fromCurrency: string;
  toCurrency: string;
  dateIso?: string;
  rates?: ExchangeRates | null;
  activeExchangeRates?: ActiveExchangeRates;
}

/** Offline-first synchronous resolver — never performs network I/O. */
export function resolveDirectPairUnitRateSync(
  options: ResolveDirectPairUnitRateSyncOptions,
): DirectPairUnitRateResult {
  const from = normalizeCode(options.fromCurrency);
  const to = normalizeCode(options.toCurrency);
  const dateIso = options.dateIso ?? getLocalTodayIso();

  if (from === to) {
    return { rate: 1, source: 'cache', manualRateUsed: false };
  }

  const manualRate = resolveManualPairFromContext(options.activeExchangeRates, from, to);
  if (manualRate != null && manualRate > 0) {
    return { rate: manualRate, source: 'manual', manualRateUsed: true };
  }

  const resolution = resolveRate(dateIso, from as ExpenseCurrency, to as ExpenseCurrency);
  if (resolution.rate != null && resolution.rate > 0 && resolution.source !== 'none') {
    return {
      rate: resolution.rate,
      source: resolution.source,
      manualRateUsed: false,
    };
  }

  const liveRates =
    options.rates ??
    (options.activeExchangeRates?.ilsToForeign
      ? ({ ilsToForeign: options.activeExchangeRates.ilsToForeign } as ExchangeRates)
      : getCachedExchangeRates());

  const peeked = peekHistoricalDirectRate(dateIso, from, to, liveRates);
  if (peeked != null && peeked > 0) {
    return { rate: peeked, source: 'cache', manualRateUsed: false };
  }

  const ilsToForeign =
    liveRates?.ilsToForeign ?? options.activeExchangeRates?.ilsToForeign ?? null;
  if (ilsToForeign && dateIso >= getLocalTodayIso()) {
    const fallback = resolveSyncSpotFallback(from, to, ilsToForeign);
    if (fallback) {
      return { rate: fallback.rate, source: fallback.source, manualRateUsed: false };
    }
  }

  return { rate: null, source: 'none', manualRateUsed: false };
}

export interface EnsureDirectPairUnitRateOptions {
  fromCurrency: string;
  toCurrency: string;
  dateIso?: string;
  rates?: ExchangeRates | null;
  activeExchangeRates?: ActiveExchangeRates;
}

/** Async resolver — refreshes stale/missing API rates via the unified cache. */
export async function ensureDirectPairUnitRate(
  options: EnsureDirectPairUnitRateOptions,
): Promise<DirectPairUnitRateResult> {
  const from = normalizeCode(options.fromCurrency);
  const to = normalizeCode(options.toCurrency);
  const dateIso = options.dateIso ?? getLocalTodayIso();

  const sync = resolveDirectPairUnitRateSync(options);
  if (sync.source === 'manual') return sync;

  const resolution = resolveRate(dateIso, from as ExpenseCurrency, to as ExpenseCurrency);
  if (!resolution.needsRefresh && sync.rate != null) return sync;

  const ensured = await ensureRate(dateIso, from as ExpenseCurrency, to as ExpenseCurrency);
  if (resolution.source === 'manual') {
    return { rate: resolution.rate, source: 'manual', manualRateUsed: true };
  }
  if (ensured != null && ensured > 0) {
    return { rate: ensured, source: 'api', manualRateUsed: false };
  }

  return sync.rate != null ? sync : { rate: null, source: 'none', manualRateUsed: false };
}

export { fetchDirectPairMarketRate };

export function convertAmountDirectPair(
  amount: number,
  _fromCurrency: string,
  toCurrency: string,
  unitRate: number,
): number {
  const to = normalizeCode(toCurrency);
  const raw = amount * unitRate;
  return to === 'ILS' ? smartRoundMoney(raw) : roundMoney(raw);
}

export function convertAmountWithDirectPairResolver(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  activeExchangeRates: ActiveExchangeRates,
  dateIso?: string,
): number | null {
  const from = normalizeCode(fromCurrency);
  const to = normalizeCode(toCurrency);

  if (from === to) return amount;
  if (!(amount > 0)) return 0;

  const resolved = resolveDirectPairUnitRateSync({
    fromCurrency: from,
    toCurrency: to,
    dateIso,
    activeExchangeRates,
  });

  if (resolved.rate == null || !(resolved.rate > 0)) return null;
  return convertAmountDirectPair(amount, from, to, resolved.rate);
}
