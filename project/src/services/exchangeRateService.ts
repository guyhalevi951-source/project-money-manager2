import { currencySymbol, type ExpenseCurrency } from '../constants/currencies';
import {
  getActiveManualExchangeOverrideSnapshot,
  getManualExchangeOverride,
} from './manualExchangeOverrideService';
import { roundMoney, smartRoundMoney } from './money';

export type { ExpenseCurrency, CurrencyCode } from '../constants/currencies';
export { CORE_DISPLAY_CURRENCIES as EXPENSE_CURRENCIES, currencySymbol } from '../constants/currencies';

const ER_API_URL = 'https://open.er-api.com/v6/latest/ILS';
const STORAGE_KEY = 'budget_exchange_rates';
const LEGACY_HISTORICAL_RATE_STORAGE_KEY = 'budget_exchange_historical_rates_v1';
const APP_CURRENCY_CACHE_KEY = 'app_currency_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const TODAY_HISTORICAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Exchange rates from open.er-api.com with base ILS.
 * `ilsToForeign[USD]` = how many USD equal 1 ILS.
 */
export interface ExchangeRates {
  date: string;
  baseCode: 'ILS';
  ilsToForeign: Record<string, number>;
  lastFetchedAt: number;
}

interface StoredExchangeRatesPayload {
  fetchedAt: number;
  last_fetched_timestamp: number;
  rates: Omit<ExchangeRates, 'lastFetchedAt'>;
}

let memoryCache: ExchangeRates | null = null;
let fetchPromise: Promise<ExchangeRates> | null = null;

interface CurrencyCacheEntry {
  rate: number;
  timestamp: number;
  source?: CurrencyCacheSource;
}

type CurrencyCacheStore = Record<string, CurrencyCacheEntry>;
type CurrencyCacheSource = 'historical_api' | 'today_live_fallback' | 'usd_pivot_fallback' | 'legacy';

interface LegacyHistoricalRateCache {
  [key: string]: {
    rate: number;
    fetchedAt: number;
  };
}

let currencyCacheHydrated = false;

function isCacheFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < CACHE_TTL_MS;
}

function readStorageCache(options?: { allowStale?: boolean }): ExchangeRates | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredExchangeRatesPayload;
    const fetchedAt = parsed.last_fetched_timestamp ?? parsed.fetchedAt;
    if (!fetchedAt || !parsed?.rates?.ilsToForeign) return null;
    if (!options?.allowStale && !isCacheFresh(fetchedAt)) return null;

    return {
      ...parsed.rates,
      lastFetchedAt: fetchedAt,
    };
  } catch {
    return null;
  }
}

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function writeStorageCache(rates: ExchangeRates): void {
  const fetchedAt = rates.lastFetchedAt;
  const payload: StoredExchangeRatesPayload = {
    fetchedAt,
    last_fetched_timestamp: fetchedAt,
    rates: {
      date: rates.date,
      baseCode: rates.baseCode,
      ilsToForeign: rates.ilsToForeign,
    },
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function hydrateMemoryFromStorage(): ExchangeRates | null {
  if (memoryCache && isCacheFresh(memoryCache.lastFetchedAt)) return memoryCache;

  const fromStorage = readStorageCache();
  if (fromStorage) {
    memoryCache = fromStorage;
  }
  return memoryCache;
}

hydrateMemoryFromStorage();

export function getCachedExchangeRates(): ExchangeRates | null {
  const cached = memoryCache ?? readStorageCache();
  if (cached && isCacheFresh(cached.lastFetchedAt)) return cached;

  // Offline-first: when the network is unavailable, serve the last-known
  // snapshot past the 24h TTL so dynamic conversions keep working. Online, we
  // still return null here so the fetch layer refreshes after expiry.
  if (isOffline()) {
    const stale = readStorageCache({ allowStale: true });
    if (stale) {
      memoryCache = stale;
      return stale;
    }
  }

  return null;
}

function parseErApiResponse(data: unknown, fetchedAt: number): ExchangeRates | null {
  if (!data || typeof data !== 'object') return null;

  const payload = data as {
    result?: string;
    base_code?: string;
    time_last_update_utc?: string;
    rates?: Record<string, number>;
  };

  if (payload.result !== 'success' || !payload.rates) return null;

  const ilsToForeign: Record<string, number> = { ILS: 1 };
  for (const [code, rate] of Object.entries(payload.rates)) {
    if (typeof rate === 'number' && rate > 0) {
      ilsToForeign[code] = rate;
    }
  }

  if (Object.keys(ilsToForeign).length <= 1) return null;

  return {
    date: payload.time_last_update_utc?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    baseCode: 'ILS',
    ilsToForeign,
    lastFetchedAt: fetchedAt,
  };
}

async function fetchRatesFromNetwork(): Promise<ExchangeRates> {
  const fetchedAt = Date.now();
  const response = await fetch(ER_API_URL);
  if (!response.ok) {
    throw new Error('Failed to fetch exchange rates');
  }

  const parsed = parseErApiResponse(await response.json(), fetchedAt);
  if (!parsed) {
    throw new Error('Invalid exchange rate payload');
  }

  return parsed;
}

/** Returns cached rates or fetches once. Never refetches within the 24-hour TTL. */
export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const cached = getCachedExchangeRates();
  if (cached) return cached;

  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    const rates = await fetchRatesFromNetwork();
    memoryCache = rates;
    writeStorageCache(rates);
    return rates;
  })();

  try {
    return await fetchPromise;
  } catch (error) {
    fetchPromise = null;
    throw error;
  } finally {
    fetchPromise = null;
  }
}

function getForeignToIls(currency: string, rates: ExchangeRates): number | null {
  if (currency === 'ILS') return 1;
  const ilsToForeign = rates.ilsToForeign[currency];
  if (!ilsToForeign || ilsToForeign <= 0) return null;
  return 1 / ilsToForeign;
}

export function convertForeignToIls(
  amount: number,
  currency: string,
  rates: ExchangeRates,
): number | null {
  if (currency === 'ILS') return amount;
  if (!(amount > 0)) return 0;

  const manualRate = getManualExchangeOverride(currency, 'ILS');
  if (manualRate != null) {
    // Smart-round: ILS is the canonical ledger currency
    return smartRoundMoney(amount * manualRate);
  }

  const foreignToIls = getForeignToIls(currency, rates);
  if (foreignToIls == null) return null;

  // Smart-round to snap accumulated float drift (e.g. 499.96 → 500)
  return smartRoundMoney(amount * foreignToIls);
}

export function convertIlsToForeign(
  ilsAmount: number,
  currency: string,
  rates: ExchangeRates,
): number | null {
  if (currency === 'ILS') return ilsAmount;

  const manualRate = getManualExchangeOverride('ILS', currency);
  if (manualRate != null) {
    return roundMoney(ilsAmount * manualRate);
  }

  const ilsToForeign = rates.ilsToForeign[currency];
  if (!ilsToForeign || ilsToForeign <= 0) return null;

  // Standard 2dp for display currencies (don't snap 127.38 GBP to 127)
  return roundMoney(ilsAmount * ilsToForeign);
}

export function isForeignToForeign(fromCurrency: string, toCurrency: string): boolean {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  return from !== 'ILS' && to !== 'ILS' && from !== to;
}

/** Direct unit rate for an ILS-leg pair from the open.er-api ILS table. */
export function resolveIlsLegDirectUnitRate(
  fromCurrency: string,
  toCurrency: string,
  ilsToForeign: Record<string, number>,
): number | null {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (from === to) return 1;

  if (from === 'ILS' && to !== 'ILS') {
    const rate = ilsToForeign[to];
    return typeof rate === 'number' && rate > 0 ? rate : null;
  }

  if (to === 'ILS' && from !== 'ILS') {
    const rate = ilsToForeign[from];
    return typeof rate === 'number' && rate > 0 ? 1 / rate : null;
  }

  return null;
}

/**
 * Cross-rate via explicit USD pivot: (From→USD) × (USD→To).
 * Uses open.er-api ILS-base table for USD legs — never ILS as F2F intermediary.
 */
export function computeCrossRateViaUsdPivot(
  fromCurrency: string,
  toCurrency: string,
  ilsToForeign: Record<string, number>,
): number | null {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (from === to) return 1;

  const usdPerIls = ilsToForeign.USD;
  if (typeof usdPerIls !== 'number' || !(usdPerIls > 0)) return null;

  const fromToUsd =
    from === 'USD'
      ? 1
      : (() => {
          const fromPerIls = ilsToForeign[from];
          return typeof fromPerIls === 'number' && fromPerIls > 0 ? usdPerIls / fromPerIls : null;
        })();

  const usdToTo =
    to === 'USD'
      ? 1
      : (() => {
          const toPerIls = ilsToForeign[to];
          return typeof toPerIls === 'number' && toPerIls > 0 ? toPerIls / usdPerIls : null;
        })();

  if (fromToUsd == null || usdToTo == null || !(fromToUsd > 0) || !(usdToTo > 0)) return null;
  return fromToUsd * usdToTo;
}

function resolveSpotUnitRateSync(
  fromCurrency: string,
  toCurrency: string,
  ilsToForeign: Record<string, number>,
): number | null {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (from === to) return 1;

  if (isForeignToForeign(from, to)) {
    return computeCrossRateViaUsdPivot(from, to, ilsToForeign);
  }
  return resolveIlsLegDirectUnitRate(from, to, ilsToForeign);
}

/**
 * Cross-convert any two currencies via the direct-pair resolver rules.
 * F2F pairs use USD pivot from the cached table; ILS-leg pairs use direct ILS quotes.
 */
export function convertAmountViaIls(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRates,
): number | null {
  if (!(amount > 0)) return null;
  if (fromCurrency === toCurrency) return amount;

  const manualRate = getManualExchangeOverride(fromCurrency, toCurrency);
  if (manualRate != null) {
    const raw = amount * manualRate;
    return toCurrency === 'ILS' ? smartRoundMoney(raw) : roundMoney(raw);
  }

  const unitRate = resolveSpotUnitRateSync(fromCurrency, toCurrency, rates.ilsToForeign);
  if (unitRate == null || !(unitRate > 0)) return null;

  const raw = amount * unitRate;
  return toCurrency === 'ILS' ? smartRoundMoney(raw) : roundMoney(raw);
}

export function hasExchangeRate(currency: string, rates: ExchangeRates): boolean {
  if (currency === 'ILS') return true;
  const rate = rates.ilsToForeign[currency];
  return typeof rate === 'number' && rate > 0;
}

export function formatForeignAmount(amount: number, currency: ExpenseCurrency): string {
  const formatted = roundMoney(amount).toFixed(2);
  return `${currencySymbol(currency)}${formatted}`;
}

/** Local calendar date (`YYYY-MM-DD`) for cache expiry rules. */
export function getLocalTodayIso(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeHistoricalDateIso(dateIso: string): string {
  const todayIso = getLocalTodayIso();
  return dateIso > todayIso ? todayIso : dateIso;
}

function buildCurrencyCacheKey(dateIso: string, fromCurrency: string, toCurrency: string): string {
  return `${dateIso}_${fromCurrency}_${toCurrency}`;
}

function logHistoricalFetchError(
  provider: string,
  context: { dateIso: string; fromCurrency: string; toCurrency: string; url: string },
  error: unknown,
): void {
  console.error('Trend/Historical fetch error:', {
    provider,
    pair: `${context.fromCurrency}/${context.toCurrency}`,
    dateIso: context.dateIso,
    url: context.url,
    error,
  });
}

function logHistoricalFetchHttpError(
  provider: string,
  context: { dateIso: string; fromCurrency: string; toCurrency: string; url: string },
  status: number,
  detail?: unknown,
): void {
  console.error('Trend/Historical fetch HTTP error:', {
    provider,
    pair: `${context.fromCurrency}/${context.toCurrency}`,
    dateIso: context.dateIso,
    url: context.url,
    status,
    detail,
  });
}

function isCacheEntryValid(dateIso: string, entry: CurrencyCacheEntry): boolean {
  if (!(Number.isFinite(entry.rate) && entry.rate > 0)) return false;
  if (!(Number.isFinite(entry.timestamp) && entry.timestamp > 0)) return false;

  const todayIso = getLocalTodayIso();
  if (dateIso < todayIso) {
    // Historical dates are immutable, so only trust rates fetched from historical API.
    return entry.source === 'historical_api';
  }
  if (dateIso > todayIso) return false;

  return Date.now() - entry.timestamp < TODAY_HISTORICAL_CACHE_TTL_MS;
}

function migrateLegacyHistoricalCache(store: CurrencyCacheStore): CurrencyCacheStore {
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_HISTORICAL_RATE_STORAGE_KEY);
    if (!legacyRaw) return store;

    const legacy = JSON.parse(legacyRaw) as LegacyHistoricalRateCache;
    if (!legacy || typeof legacy !== 'object') return store;

    const next = { ...store };
    for (const [legacyKey, legacyEntry] of Object.entries(legacy)) {
      const [datePart, fromCurrency, toCurrency] = legacyKey.split('|');
      if (
        !datePart ||
        !fromCurrency ||
        !toCurrency ||
        typeof legacyEntry?.rate !== 'number' ||
        !(legacyEntry.rate > 0)
      ) {
        continue;
      }

      const cacheKey = buildCurrencyCacheKey(datePart, fromCurrency, toCurrency);
      if (next[cacheKey]) continue;

      next[cacheKey] = {
        rate: legacyEntry.rate,
        timestamp: legacyEntry.fetchedAt ?? Date.now(),
        source: 'legacy',
      };
    }

    window.localStorage.removeItem(LEGACY_HISTORICAL_RATE_STORAGE_KEY);
    return next;
  } catch {
    return store;
  }
}

function readCurrencyCache(): CurrencyCacheStore {
  try {
    const raw = window.localStorage.getItem(APP_CURRENCY_CACHE_KEY);
    let store: CurrencyCacheStore = {};

    if (raw) {
      const parsed = JSON.parse(raw) as CurrencyCacheStore;
      if (parsed && typeof parsed === 'object') {
        store = parsed;
      }
    }

    if (!currencyCacheHydrated) {
      currencyCacheHydrated = true;
      store = migrateLegacyHistoricalCache(store);
      if (Object.keys(store).length > 0) {
        writeCurrencyCache(store);
      }
    }

    return store;
  } catch {
    return {};
  }
}

function pruneCurrencyCacheForQuota(cache: CurrencyCacheStore): CurrencyCacheStore {
  const todayIso = getLocalTodayIso();
  const next: CurrencyCacheStore = { ...cache };

  for (const [key, entry] of Object.entries(next)) {
    const dateIso = key.slice(0, 10);
    if (dateIso === todayIso && !isCacheEntryValid(dateIso, entry)) {
      delete next[key];
    }
  }

  const todayKeys = Object.keys(next).filter((key) => key.startsWith(`${todayIso}_`));
  todayKeys.sort((a, b) => next[a].timestamp - next[b].timestamp);

  while (todayKeys.length > 120) {
    const oldestKey = todayKeys.shift();
    if (!oldestKey) break;
    delete next[oldestKey];
  }

  return next;
}

function writeCurrencyCache(cache: CurrencyCacheStore): void {
  try {
    window.localStorage.setItem(APP_CURRENCY_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    const isQuotaError =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014);

    if (!isQuotaError) return;

    const pruned = pruneCurrencyCacheForQuota(cache);
    try {
      window.localStorage.setItem(APP_CURRENCY_CACHE_KEY, JSON.stringify(pruned));
    } catch {
      // Ignore secondary quota failures; network path remains available.
    }
  }
}

function getCachedCurrencyRate(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
): CurrencyCacheEntry | null {
  const cache = readCurrencyCache();
  const entry = cache[buildCurrencyCacheKey(dateIso, fromCurrency, toCurrency)];
  if (!entry || !isCacheEntryValid(dateIso, entry)) return null;
  return entry;
}

function setCachedCurrencyRate(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  source: CurrencyCacheSource,
): void {
  if (!(rate > 0)) return;

  const cache = readCurrencyCache();
  cache[buildCurrencyCacheKey(dateIso, fromCurrency, toCurrency)] = {
    rate,
    timestamp: Date.now(),
    source,
  };
  writeCurrencyCache(cache);
}

export interface HistoricalRateSnapshot {
  rate: number | null;
  fetchedAt: number | null;
}

export interface FetchHistoricalOptions {
  /** When true, skip localStorage and always hit network providers. */
  bypassCache?: boolean;
}

/** Removes a cached historical direct-rate entry (e.g. when date/pair changes). */
export function clearHistoricalDirectRateCache(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
): void {
  const safeDate = normalizeHistoricalDateIso(dateIso);
  const cache = readCurrencyCache();
  const key = buildCurrencyCacheKey(safeDate, fromCurrency, toCurrency);
  if (!cache[key]) return;
  delete cache[key];
  writeCurrencyCache(cache);
}

/** Synchronous cache read for instant UI updates (no network). */
export function peekHistoricalDirectRate(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
  liveRates: ExchangeRates | null = getCachedExchangeRates(),
): number | null {
  if (fromCurrency === toCurrency) return 1;

  const safeDate = normalizeHistoricalDateIso(dateIso);
  const cached = getCachedCurrencyRate(safeDate, fromCurrency, toCurrency);
  if (!cached) return null;

  return sanitizeDirectUnitRate(fromCurrency, toCurrency, cached.rate, liveRates);
}

/** Synchronous cache read including the stored fetch timestamp. */
export function peekHistoricalDirectRateSnapshot(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
  liveRates: ExchangeRates | null = getCachedExchangeRates(),
): HistoricalRateSnapshot {
  if (fromCurrency === toCurrency) {
    return { rate: 1, fetchedAt: Date.now() };
  }

  const safeDate = normalizeHistoricalDateIso(dateIso);

  // Manual overrides are scoped to the live (today) context only. They must
  // NEVER retroactively rewrite a historical date — a past date always resolves
  // from its own date-specific cached/historical apiRate.
  if (safeDate === getLocalTodayIso()) {
    const manualSnapshot = getActiveManualExchangeOverrideSnapshot(fromCurrency, toCurrency);
    if (manualSnapshot != null) {
      return { rate: manualSnapshot.rate, fetchedAt: manualSnapshot.updatedAt };
    }
  }

  const cached = getCachedCurrencyRate(safeDate, fromCurrency, toCurrency);
  if (!cached) {
    return { rate: null, fetchedAt: null };
  }

  return {
    rate: sanitizeDirectUnitRate(fromCurrency, toCurrency, cached.rate, liveRates),
    fetchedAt: cached.timestamp,
  };
}

/** Whether a network fetch is required for this date/currency pair. */
export function needsNetworkHistoricalFetch(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
): boolean {
  if (fromCurrency === toCurrency) return false;
  const safeDate = normalizeHistoricalDateIso(dateIso);
  return getCachedCurrencyRate(safeDate, fromCurrency, toCurrency) == null;
}

/**
 * Ensures `rate` means: 1 `fromCurrency` = `rate` units of `toCurrency`.
 * When live rates exist, repairs only clear inversions (rate ≈ 1/expected), never valid magnitudes.
 */
function sanitizeDirectUnitRate(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  liveRates: ExchangeRates | null,
): number {
  if (!(rate > 0)) return rate;

  if (liveRates) {
    const expected = resolveSpotUnitRateSync(
      fromCurrency,
      toCurrency,
      liveRates.ilsToForeign,
    );
    if (expected != null && expected > 0) {
      const inverted = 1 / rate;
      const logDirect = Math.abs(Math.log(rate / expected));
      const logInverted = Math.abs(Math.log(inverted / expected));
      if (logInverted + 1e-12 < logDirect) {
        return inverted;
      }
    }
  }

  return rate;
}

async function fetchRateFromFrankfurter(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
): Promise<number | null> {
  const url = `https://api.frankfurter.app/${dateIso}?from=${fromCurrency}&to=${toCurrency}`;
  const context = { dateIso, fromCurrency, toCurrency, url };

  try {
    const response = await fetch(url);
    if (!response.ok) {
      logHistoricalFetchHttpError('Frankfurter', context, response.status);
      return null;
    }

    const payload = (await response.json()) as { rates?: Record<string, number> };
    const rate = payload?.rates?.[toCurrency];
    if (typeof rate === 'number' && rate > 0) {
      return rate;
    }

    console.error('Trend/Historical fetch empty payload (Frankfurter):', {
      pair: `${fromCurrency}/${toCurrency}`,
      dateIso,
      url,
      rates: payload?.rates ?? null,
    });
    return null;
  } catch (error) {
    logHistoricalFetchError('Frankfurter', context, error);
    return null;
  }
}

async function fetchRateFromFrankfurterWithInverse(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
): Promise<number | null> {
  const direct = await fetchRateFromFrankfurter(dateIso, fromCurrency, toCurrency);
  if (direct != null) return direct;

  const inverse = await fetchRateFromFrankfurter(dateIso, toCurrency, fromCurrency);
  if (inverse != null && inverse > 0) {
    return 1 / inverse;
  }

  return null;
}

async function fetchCrossRateViaUsdPivot(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
  liveRates: ExchangeRates | null,
): Promise<number | null> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (from === to) return 1;

  async function resolveLeg(fromLeg: string, toLeg: string): Promise<number | null> {
    if (fromLeg === toLeg) return 1;

    const frankfurterLeg = await fetchRateFromFrankfurterWithInverse(dateIso, fromLeg, toLeg);
    if (frankfurterLeg != null && frankfurterLeg > 0) return frankfurterLeg;

    const rates =
      liveRates ??
      getCachedExchangeRates() ??
      (await fetchExchangeRates().catch(() => null));
    if (!rates) return null;

    if (isForeignToForeign(fromLeg, toLeg)) {
      return computeCrossRateViaUsdPivot(fromLeg, toLeg, rates.ilsToForeign);
    }
    return resolveIlsLegDirectUnitRate(fromLeg, toLeg, rates.ilsToForeign);
  }

  if (from === 'USD') return resolveLeg('USD', to);
  if (to === 'USD') return resolveLeg(from, 'USD');

  const fromToUsd = await resolveLeg(from, 'USD');
  const usdToTo = await resolveLeg('USD', to);
  if (fromToUsd != null && usdToTo != null && fromToUsd > 0 && usdToTo > 0) {
    return fromToUsd * usdToTo;
  }
  return null;
}

/**
 * Fetch a market direct-pair rate: Frankfurter direct, then USD pivot fallback.
 * Never uses ILS as an intermediary for foreign-to-foreign pairs.
 */
export async function fetchDirectPairMarketRate(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
): Promise<number | null> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (from === to) return 1;

  const frankfurterRate = await fetchRateFromFrankfurterWithInverse(dateIso, from, to);
  if (frankfurterRate != null && frankfurterRate > 0) return frankfurterRate;

  const liveRates =
    getCachedExchangeRates() ?? (await fetchExchangeRates().catch(() => null));

  if (!isForeignToForeign(from, to)) {
    if (liveRates) {
      const ilsLeg = resolveIlsLegDirectUnitRate(from, to, liveRates.ilsToForeign);
      if (ilsLeg != null && ilsLeg > 0) return ilsLeg;
    }
    return null;
  }

  const usdPivot = await fetchCrossRateViaUsdPivot(dateIso, from, to, liveRates);
  if (usdPivot != null && usdPivot > 0) return usdPivot;

  if (liveRates) {
    return computeCrossRateViaUsdPivot(from, to, liveRates.ilsToForeign);
  }

  return null;
}

/**
 * Fetches a historical direct conversion rate (`fromCurrency` -> `toCurrency`) for a specific date.
 */
export async function fetchHistoricalDirectRate(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
  options?: FetchHistoricalOptions,
): Promise<number | null> {
  const snapshot = await fetchHistoricalDirectRateSnapshot(
    dateIso,
    fromCurrency,
    toCurrency,
    options,
  );
  return snapshot.rate;
}

export async function fetchHistoricalDirectRateSnapshot(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
  options?: FetchHistoricalOptions,
): Promise<HistoricalRateSnapshot> {
  if (fromCurrency === toCurrency) {
    const fetchedAt = Date.now();
    return { rate: 1, fetchedAt };
  }

  const safeDate = normalizeHistoricalDateIso(dateIso);

  // Manual overrides apply only to the live (today) context. Historical dates
  // always resolve from their own date-specific cached/fetched apiRate, so a
  // manual rate defined today never alters a 6-month-old expense.
  if (safeDate === getLocalTodayIso()) {
    const manualSnapshot = getActiveManualExchangeOverrideSnapshot(fromCurrency, toCurrency);
    if (manualSnapshot != null) {
      return { rate: manualSnapshot.rate, fetchedAt: manualSnapshot.updatedAt };
    }
  }

  const bypassCache = options?.bypassCache === true;

  try {
    const liveRates =
      getCachedExchangeRates() ??
      (await fetchExchangeRates().catch((error) => {
        console.error('Trend/Historical fetch error (live rates):', {
          pair: `${fromCurrency}/${toCurrency}`,
          dateIso: safeDate,
          error,
        });
        return null;
      }));

    if (!bypassCache) {
      const cached = getCachedCurrencyRate(safeDate, fromCurrency, toCurrency);
      if (cached && isCacheEntryValid(safeDate, cached)) {
        const sanitized = sanitizeDirectUnitRate(fromCurrency, toCurrency, cached.rate, liveRates);
        if (sanitized !== cached.rate) {
          setCachedCurrencyRate(
            safeDate,
            fromCurrency,
            toCurrency,
            sanitized,
            cached.source ?? 'historical_api',
          );
        }
        const refreshed = getCachedCurrencyRate(safeDate, fromCurrency, toCurrency);
        return {
          rate: sanitized,
          fetchedAt: refreshed?.timestamp ?? cached.timestamp,
        };
      }
    }

    const frankfurterRate = await fetchRateFromFrankfurterWithInverse(
      safeDate,
      fromCurrency,
      toCurrency,
    );
    if (frankfurterRate != null) {
      const sanitized = sanitizeDirectUnitRate(fromCurrency, toCurrency, frankfurterRate, liveRates);
      setCachedCurrencyRate(safeDate, fromCurrency, toCurrency, sanitized, 'historical_api');
      const stored = getCachedCurrencyRate(safeDate, fromCurrency, toCurrency);
      return { rate: sanitized, fetchedAt: stored?.timestamp ?? Date.now() };
    }

    const usdPivotRate = await fetchCrossRateViaUsdPivot(
      safeDate,
      fromCurrency,
      toCurrency,
      liveRates,
    );
    if (usdPivotRate != null) {
      const sanitized = sanitizeDirectUnitRate(fromCurrency, toCurrency, usdPivotRate, liveRates);
      const source: CurrencyCacheSource =
        safeDate === getLocalTodayIso() ? 'usd_pivot_fallback' : 'historical_api';
      setCachedCurrencyRate(safeDate, fromCurrency, toCurrency, sanitized, source);
      const stored = getCachedCurrencyRate(safeDate, fromCurrency, toCurrency);
      return { rate: sanitized, fetchedAt: stored?.timestamp ?? Date.now() };
    }

    if (!liveRates) {
      console.error('Trend/Historical fetch unavailable:', {
        pair: `${fromCurrency}/${toCurrency}`,
        dateIso: safeDate,
        reason: 'no_live_rates_and_all_providers_failed',
      });
      return { rate: null, fetchedAt: null };
    }

    console.error('Trend/Historical fetch unavailable:', {
      pair: `${fromCurrency}/${toCurrency}`,
      dateIso: safeDate,
      reason: 'all_providers_failed',
    });
    return { rate: null, fetchedAt: null };
  } catch (error) {
    console.error('Trend/Historical fetch error (snapshot):', {
      pair: `${fromCurrency}/${toCurrency}`,
      dateIso: safeDate,
      error,
    });
    return { rate: null, fetchedAt: null };
  }
}
