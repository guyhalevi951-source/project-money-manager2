export type ExpenseCurrency = 'ILS' | 'USD' | 'EUR' | 'GBP';

export const EXPENSE_CURRENCIES: {
  code: ExpenseCurrency;
  symbol: string;
  label: string;
}[] = [
  { code: 'ILS', symbol: '₪', label: 'ILS' },
  { code: 'USD', symbol: '$', label: 'USD' },
  { code: 'EUR', symbol: '€', label: 'EUR' },
  { code: 'GBP', symbol: '£', label: 'GBP' },
];

export const currencySymbol = (code: ExpenseCurrency): string =>
  EXPENSE_CURRENCIES.find((c) => c.code === code)?.symbol ?? code;

/** ILS received per 1 unit of a foreign currency. */
export interface ExchangeRates {
  date: string;
  foreignToIls: Partial<Record<ExpenseCurrency, number>>;
}

const STORAGE_KEY = 'budget_exchange_rates';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FRANKFURTER_FROM_TO_URL =
  'https://api.frankfurter.dev/v1/latest?from=USD,EUR,GBP&to=ILS';
const FOREIGN_CURRENCIES: ExpenseCurrency[] = ['USD', 'EUR', 'GBP'];

interface StoredExchangeRatesPayload {
  fetchedAt: number;
  rates: ExchangeRates;
}

let memoryCache: ExchangeRates | null = null;
let fetchPromise: Promise<ExchangeRates> | null = null;

function readStorageCache(): ExchangeRates | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredExchangeRatesPayload;
    if (!parsed?.fetchedAt || !parsed?.rates?.foreignToIls) return null;
    if (Date.now() - parsed.fetchedAt >= CACHE_TTL_MS) return null;

    return parsed.rates;
  } catch {
    return null;
  }
}

function writeStorageCache(rates: ExchangeRates): void {
  const payload: StoredExchangeRatesPayload = {
    fetchedAt: Date.now(),
    rates,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function hydrateMemoryFromStorage(): ExchangeRates | null {
  if (memoryCache) return memoryCache;

  const fromStorage = readStorageCache();
  if (fromStorage) {
    memoryCache = fromStorage;
  }
  return memoryCache;
}

hydrateMemoryFromStorage();

export function getCachedExchangeRates(): ExchangeRates | null {
  return memoryCache ?? readStorageCache();
}

function parseFromToResponse(data: unknown): ExchangeRates | null {
  if (!data || typeof data !== 'object') return null;

  const payload = data as {
    date?: string;
    rates?: Record<string, number | Record<string, number>>;
  };

  const foreignToIls: Partial<Record<ExpenseCurrency, number>> = {};

  for (const code of FOREIGN_CURRENCIES) {
    const entry = payload.rates?.[code];
    if (typeof entry === 'number' && entry > 0) {
      foreignToIls[code] = entry;
      continue;
    }
    if (entry && typeof entry === 'object') {
      const ilsRate = (entry as Record<string, number>).ILS;
      if (typeof ilsRate === 'number' && ilsRate > 0) {
        foreignToIls[code] = ilsRate;
      }
    }
  }

  if (FOREIGN_CURRENCIES.every((code) => foreignToIls[code] != null)) {
    return {
      date: payload.date ?? new Date().toISOString().slice(0, 10),
      foreignToIls,
    };
  }

  return null;
}

async function fetchPerCurrencyRates(): Promise<ExchangeRates> {
  const pairs = await Promise.all(
    FOREIGN_CURRENCIES.map(async (code) => {
      const response = await fetch(
        `https://api.frankfurter.dev/v1/latest?base=${code}&symbols=ILS`,
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch ${code}/ILS rate`);
      }

      const data = (await response.json()) as {
        date?: string;
        rates?: { ILS?: number };
      };

      const rate = data.rates?.ILS;
      if (!rate || rate <= 0) {
        throw new Error(`Missing ${code}/ILS rate`);
      }

      return { code, rate, date: data.date };
    }),
  );

  return {
    date: pairs.find((pair) => pair.date)?.date ?? new Date().toISOString().slice(0, 10),
    foreignToIls: Object.fromEntries(pairs.map((pair) => [pair.code, pair.rate])) as Partial<
      Record<ExpenseCurrency, number>
    >,
  };
}

async function fetchRatesFromNetwork(): Promise<ExchangeRates> {
  try {
    const response = await fetch(FRANKFURTER_FROM_TO_URL);
    if (response.ok) {
      const parsed = parseFromToResponse(await response.json());
      if (parsed) return parsed;
    }
  } catch {
    // Fall through to the supported v1 per-currency fetch shape.
  }

  return fetchPerCurrencyRates();
}

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

export function convertForeignToIls(
  amount: number,
  currency: ExpenseCurrency,
  rates: ExchangeRates,
): number | null {
  if (currency === 'ILS') return amount;
  if (!(amount > 0)) return 0;

  const foreignToIls = rates.foreignToIls[currency];
  if (!foreignToIls || foreignToIls <= 0) return null;

  return amount * foreignToIls;
}

export function convertIlsToForeign(
  ilsAmount: number,
  currency: ExpenseCurrency,
  rates: ExchangeRates,
): number | null {
  if (currency === 'ILS') return ilsAmount;

  const foreignToIls = rates.foreignToIls[currency];
  if (!foreignToIls || foreignToIls <= 0) return null;

  return ilsAmount / foreignToIls;
}

export function formatForeignAmount(amount: number, currency: ExpenseCurrency): string {
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  if (currency === 'USD') return `$${formatted}`;
  if (currency === 'EUR') return `€${formatted}`;
  if (currency === 'GBP') return `£${formatted}`;
  return `₪${formatted}`;
}
