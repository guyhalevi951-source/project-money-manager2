import { currencySymbol, type ExpenseCurrency } from '../constants/currencies';

export type { ExpenseCurrency, CurrencyCode } from '../constants/currencies';
export { CORE_DISPLAY_CURRENCIES as EXPENSE_CURRENCIES, currencySymbol } from '../constants/currencies';

const ER_API_URL = 'https://open.er-api.com/v6/latest/ILS';
const STORAGE_KEY = 'budget_exchange_rates';
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

  const ilsToForeign = rates.ilsToForeign[currency];
  if (!ilsToForeign || ilsToForeign <= 0) return null;

  return ilsAmount * ilsToForeign;
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
