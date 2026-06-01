import { currencySymbol, type ExpenseCurrency } from '../constants/currencies';
import { getManualExchangeOverride } from './manualExchangeOverrideService';

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
type CurrencyCacheSource = 'historical_api' | 'today_live_fallback' | 'legacy';

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

function readStorageCache(): ExchangeRates | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredExchangeRatesPayload;
    const fetchedAt = parsed.last_fetched_timestamp ?? parsed.fetchedAt;
    if (!fetchedAt || !parsed?.rates?.ilsToForeign) return null;
    if (!isCacheFresh(fetchedAt)) return null;

    return {
      ...parsed.rates,
      lastFetchedAt: fetchedAt,
    };
  } catch {
    return null;
  }
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
  if (!cached) return null;
  if (!isCacheFresh(cached.lastFetchedAt)) return null;
  return cached;
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
    return amount * manualRate;
  }

  const foreignToIls = getForeignToIls(currency, rates);
  if (foreignToIls == null) return null;

  return amount * foreignToIls;
}

export function convertIlsToForeign(
  ilsAmount: number,
  currency: string,
  rates: ExchangeRates,
): number | null {
  if (currency === 'ILS') return ilsAmount;

  const manualRate = getManualExchangeOverride('ILS', currency);
  if (manualRate != null) {
    return ilsAmount * manualRate;
  }

  const ilsToForeign = rates.ilsToForeign[currency];
  if (!ilsToForeign || ilsToForeign <= 0) return null;

  return ilsAmount * ilsToForeign;
}

/**
 * Cross-convert any two currencies using ILS as the base (`ilsToForeign` rates).
 * `baseAmount = amount / ilsToForeign[from]` then `converted = baseAmount * ilsToForeign[to]`.
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
    return amount * manualRate;
  }

  const fromIlsToForeign =
    fromCurrency === 'ILS' ? 1 : rates.ilsToForeign[fromCurrency];
  const toIlsToForeign = toCurrency === 'ILS' ? 1 : rates.ilsToForeign[toCurrency];

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
 * Direct unit rate: 1 `fromCurrency` = result units of `toCurrency`.
 * Uses the same ILS pivot as live rates: `ilsToForeign[to] / ilsToForeign[from]`.
 */
export function computeDirectUnitRateFromIlsPivot(
  fromCurrency: string,
  toCurrency: string,
  ilsToForeign: Record<string, number>,
): number | null {
  if (fromCurrency === toCurrency) return 1;

  const fromIlsToForeign = fromCurrency === 'ILS' ? 1 : ilsToForeign[fromCurrency];
  const toIlsToForeign = toCurrency === 'ILS' ? 1 : ilsToForeign[toCurrency];

  if (
    typeof fromIlsToForeign !== 'number' ||
    fromIlsToForeign <= 0 ||
    typeof toIlsToForeign !== 'number' ||
    toIlsToForeign <= 0
  ) {
    return null;
  }

  return toIlsToForeign / fromIlsToForeign;
}

export function hasExchangeRate(currency: string, rates: ExchangeRates): boolean {
  if (currency === 'ILS') return true;
  const rate = rates.ilsToForeign[currency];
  return typeof rate === 'number' && rate > 0;
}

export function formatForeignAmount(amount: number, currency: ExpenseCurrency): string {
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
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
    const expected = computeDirectUnitRateFromIlsPivot(
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

async function fetchIlsToForeignMapForDate(dateIso: string): Promise<Record<string, number> | null> {
  const endpoints = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateIso}/v1/currencies/ils.min.json`,
    `https://${dateIso}.currency-api.pages.dev/v1/currencies/ils.min.json`,
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateIso}/v1/currencies/ils.json`,
    `https://${dateIso}.currency-api.pages.dev/v1/currencies/ils.json`,
  ];

  for (const url of endpoints) {
    const context = { dateIso, fromCurrency: 'ILS', toCurrency: '*', url };
    try {
      const response = await fetch(url);
      if (!response.ok) {
        logHistoricalFetchHttpError('CurrencyAPI-ILS-map', context, response.status);
        continue;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const ilsPayload = payload.ils as Record<string, unknown> | undefined;
      if (!ilsPayload || typeof ilsPayload !== 'object') {
        console.error('Trend/Historical fetch empty payload (CurrencyAPI-ILS-map):', {
          dateIso,
          url,
        });
        continue;
      }

      const ilsToForeign: Record<string, number> = { ILS: 1 };
      for (const [code, value] of Object.entries(ilsPayload)) {
        if (typeof value === 'number' && value > 0) {
          ilsToForeign[code.toUpperCase()] = value;
        }
      }

      if (Object.keys(ilsToForeign).length > 1) {
        return ilsToForeign;
      }
    } catch (error) {
      logHistoricalFetchError('CurrencyAPI-ILS-map', context, error);
    }
  }

  return null;
}

async function fetchHistoricalRateViaIlsPivot(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
): Promise<number | null> {
  const ilsToForeign = await fetchIlsToForeignMapForDate(dateIso);
  if (!ilsToForeign) return null;
  return computeDirectUnitRateFromIlsPivot(fromCurrency, toCurrency, ilsToForeign);
}

async function fetchRateFromCurrencyApi(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
): Promise<number | null> {
  const base = fromCurrency.toLowerCase();
  const quote = toCurrency.toLowerCase();
  const endpoints = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateIso}/v1/currencies/${base}.min.json`,
    `https://${dateIso}.currency-api.pages.dev/v1/currencies/${base}.min.json`,
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateIso}/v1/currencies/${base}.json`,
    `https://${dateIso}.currency-api.pages.dev/v1/currencies/${base}.json`,
  ];

  for (const url of endpoints) {
    const context = { dateIso, fromCurrency, toCurrency, url };
    try {
      const response = await fetch(url);
      if (!response.ok) {
        logHistoricalFetchHttpError('CurrencyAPI-direct', context, response.status);
        continue;
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const basePayload = payload[base] as Record<string, unknown> | undefined;
      const quoteRate = basePayload?.[quote];
      if (typeof quoteRate === 'number' && quoteRate > 0) {
        return quoteRate;
      }

      console.error('Trend/Historical fetch empty payload (CurrencyAPI-direct):', {
        pair: `${fromCurrency}/${toCurrency}`,
        dateIso,
        url,
      });
    } catch (error) {
      logHistoricalFetchError('CurrencyAPI-direct', context, error);
    }
  }

  return null;
}

/**
 * Fetches a historical direct conversion rate (`fromCurrency` -> `toCurrency`) for a specific date.
 * Falls back to current cached rates if the historical provider is unavailable.
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

    const ilsPivotRate = await fetchHistoricalRateViaIlsPivot(safeDate, fromCurrency, toCurrency);
    if (ilsPivotRate != null) {
      const sanitized = sanitizeDirectUnitRate(fromCurrency, toCurrency, ilsPivotRate, liveRates);
      setCachedCurrencyRate(safeDate, fromCurrency, toCurrency, sanitized, 'historical_api');
      const stored = getCachedCurrencyRate(safeDate, fromCurrency, toCurrency);
      return { rate: sanitized, fetchedAt: stored?.timestamp ?? Date.now() };
    }

    const currencyApiRate = await fetchRateFromCurrencyApi(safeDate, fromCurrency, toCurrency);
    if (currencyApiRate != null) {
      const sanitized = sanitizeDirectUnitRate(fromCurrency, toCurrency, currencyApiRate, liveRates);
      setCachedCurrencyRate(safeDate, fromCurrency, toCurrency, sanitized, 'historical_api');
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

    const fallbackRate = convertAmountViaIls(1, fromCurrency, toCurrency, liveRates);
    if (fallbackRate != null && fallbackRate > 0) {
      const sanitized = sanitizeDirectUnitRate(fromCurrency, toCurrency, fallbackRate, liveRates);
      const todayIso = getLocalTodayIso();
      if (safeDate === todayIso) {
        setCachedCurrencyRate(safeDate, fromCurrency, toCurrency, sanitized, 'today_live_fallback');
        const stored = getCachedCurrencyRate(safeDate, fromCurrency, toCurrency);
        return { rate: sanitized, fetchedAt: stored?.timestamp ?? Date.now() };
      }
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
