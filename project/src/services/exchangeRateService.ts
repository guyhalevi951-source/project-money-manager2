import { currencySymbol, type ExpenseCurrency } from '../constants/currencies';
import { getManualExchangeOverride } from './manualExchangeOverrideService';

export type { ExpenseCurrency, CurrencyCode } from '../constants/currencies';
export { CORE_DISPLAY_CURRENCIES as EXPENSE_CURRENCIES, currencySymbol } from '../constants/currencies';

const ER_API_URL = 'https://open.er-api.com/v6/latest/ILS';
const STORAGE_KEY = 'budget_exchange_rates';
const HISTORICAL_RATE_STORAGE_KEY = 'budget_exchange_historical_rates_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

interface HistoricalRateCache {
  [key: string]: {
    rate: number;
    fetchedAt: number;
  };
}

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

export function hasExchangeRate(currency: string, rates: ExchangeRates): boolean {
  if (currency === 'ILS') return true;
  const rate = rates.ilsToForeign[currency];
  return typeof rate === 'number' && rate > 0;
}

export function formatForeignAmount(amount: number, currency: ExpenseCurrency): string {
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${currencySymbol(currency)}${formatted}`;
}

function buildHistoricalRateKey(dateIso: string, fromCurrency: string, toCurrency: string): string {
  return `${dateIso}|${fromCurrency}|${toCurrency}`;
}

function readHistoricalRateCache(): HistoricalRateCache {
  try {
    const raw = window.localStorage.getItem(HISTORICAL_RATE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as HistoricalRateCache;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeHistoricalRateCache(cache: HistoricalRateCache): void {
  window.localStorage.setItem(HISTORICAL_RATE_STORAGE_KEY, JSON.stringify(cache));
}

/**
 * Fetches a historical direct conversion rate (`fromCurrency` -> `toCurrency`) for a specific date.
 * Falls back to current cached rates if the historical provider is unavailable.
 */
export async function fetchHistoricalDirectRate(
  dateIso: string,
  fromCurrency: string,
  toCurrency: string,
): Promise<number | null> {
  if (fromCurrency === toCurrency) return 1;

  const manualRate = getManualExchangeOverride(fromCurrency, toCurrency);
  if (manualRate != null) return manualRate;

  const todayIso = new Date().toISOString().slice(0, 10);
  const safeDate = dateIso > todayIso ? todayIso : dateIso;
  const key = buildHistoricalRateKey(safeDate, fromCurrency, toCurrency);

  const cache = readHistoricalRateCache();
  const cached = cache[key];
  if (cached && typeof cached.rate === 'number' && cached.rate > 0) {
    return cached.rate;
  }

  try {
    const response = await fetch(
      `https://api.frankfurter.app/${safeDate}?from=${fromCurrency}&to=${toCurrency}`,
    );
    if (response.ok) {
      const payload = (await response.json()) as { rates?: Record<string, number> };
      const rate = payload?.rates?.[toCurrency];
      if (typeof rate === 'number' && rate > 0) {
        cache[key] = { rate, fetchedAt: Date.now() };
        writeHistoricalRateCache(cache);
        return rate;
      }
    }
  } catch {
    // Fallback below.
  }

  const liveRates = getCachedExchangeRates() ?? (await fetchExchangeRates().catch(() => null));
  if (!liveRates) return null;
  return convertAmountViaIls(1, fromCurrency, toCurrency, liveRates);
}
