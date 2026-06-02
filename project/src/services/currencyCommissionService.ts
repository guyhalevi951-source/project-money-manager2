import { isSupportedCurrency, type ExpenseCurrency } from '../constants/currencies';

const STORAGE_KEY = 'money_manager_currency_commissions_v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const COMMISSIONS_UPDATED_EVENT = 'currency-commissions-updated';

/**
 * Safe localStorage helpers with an in-memory fallback.
 * On iOS Safari private mode and some mobile WebViews, localStorage.setItem
 * throws a SecurityError or QuotaExceededError. The fallback ensures data
 * survives for the duration of the current page session even when persistent
 * storage is unavailable (e.g. guest on a private-mode mobile browser).
 */
const _memStore = new Map<string, string>();

function lsRead(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return _memStore.get(key) ?? null;
  }
}

function lsWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
    _memStore.delete(key); // real storage works — no need for the fallback copy
  } catch {
    _memStore.set(key, value); // persist in memory for this session
  }
}

function lsDelete(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
  _memStore.delete(key);
}

function resetInMemoryFallback(): void {
  _memStore.clear();
}

export type CommissionSource = 'local_24h' | 'cloud';

export interface CurrencyCommissionEntry {
  currency: ExpenseCurrency;
  percent: number;
  source: CommissionSource;
  expiresAt: number | null;
  updatedAt: number;
}

export interface CloudCurrencyCommission {
  currency: ExpenseCurrency;
  percent: number;
  updatedAt?: number;
}

function isFinitePercent(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 100;
}

function dispatchCommissionsUpdated(): void {
  window.dispatchEvent(new CustomEvent(COMMISSIONS_UPDATED_EVENT));
}

export function subscribeCurrencyCommissionsUpdated(listener: () => void): () => void {
  window.addEventListener(COMMISSIONS_UPDATED_EVENT, listener);
  return () => window.removeEventListener(COMMISSIONS_UPDATED_EVENT, listener);
}

function safeParseEntries(raw: string | null): CurrencyCommissionEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is CurrencyCommissionEntry => {
        if (!item || typeof item !== 'object') return false;
        const currency = (item as { currency?: unknown }).currency;
        const percent = (item as { percent?: unknown }).percent;
        const source = (item as { source?: unknown }).source;
        const expiresAt = (item as { expiresAt?: unknown }).expiresAt;
        const updatedAt = (item as { updatedAt?: unknown }).updatedAt;

        return (
          typeof currency === 'string' &&
          isSupportedCurrency(currency) &&
          typeof percent === 'number' &&
          isFinitePercent(percent) &&
          (source === 'local_24h' || source === 'cloud') &&
          (typeof expiresAt === 'number' || expiresAt === null) &&
          typeof updatedAt === 'number'
        );
      })
      .map((entry) => ({
        currency: entry.currency,
        percent: entry.percent,
        source: entry.source,
        expiresAt: entry.expiresAt,
        updatedAt: entry.updatedAt,
      }));
  } catch {
    return [];
  }
}

function readEntries(): CurrencyCommissionEntry[] {
  return safeParseEntries(lsRead(STORAGE_KEY));
}

function writeEntries(entries: CurrencyCommissionEntry[]): void {
  lsWrite(STORAGE_KEY, JSON.stringify(entries));
}

function isExpired(entry: CurrencyCommissionEntry, now = Date.now()): boolean {
  return entry.source === 'local_24h' && entry.expiresAt != null && entry.expiresAt <= now;
}

function readActiveEntries(): CurrencyCommissionEntry[] {
  const entries = readEntries();
  const cleaned = entries.filter((entry) => !isExpired(entry));
  if (cleaned.length !== entries.length) {
    writeEntries(cleaned);
    dispatchCommissionsUpdated();
  }
  return cleaned;
}

function findEntryIndex(
  entries: CurrencyCommissionEntry[],
  currency: ExpenseCurrency,
  source?: CommissionSource,
): number {
  return entries.findIndex(
    (entry) => entry.currency === currency && (source ? entry.source === source : true),
  );
}

export function normalizeCommissionCurrency(currency: string): ExpenseCurrency | null {
  const code = currency.trim().toUpperCase();
  if (!isSupportedCurrency(code) || code === 'ILS') return null;
  return code;
}

export function listActiveCurrencyCommissions(): CurrencyCommissionEntry[] {
  return readActiveEntries().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getActiveCurrencyCommissionPercent(currency: string): number | null {
  const normalized = normalizeCommissionCurrency(currency);
  if (!normalized) return null;

  const entry = readActiveEntries().find((item) => item.currency === normalized);
  if (!entry) return null;
  return entry.percent;
}

export function removeLocalCurrencyCommission(currency: ExpenseCurrency): boolean {
  const normalized = normalizeCommissionCurrency(currency);
  if (!normalized) return false;

  const entries = readActiveEntries();
  const next = entries.filter(
    (entry) => !(entry.currency === normalized && entry.source === 'local_24h'),
  );
  if (next.length === entries.length) return false;
  writeEntries(next);
  dispatchCommissionsUpdated();
  return true;
}

export function removeCloudCurrencyCommissionLocal(currency: ExpenseCurrency): boolean {
  const normalized = normalizeCommissionCurrency(currency);
  if (!normalized) return false;

  const entries = readActiveEntries();
  const next = entries.filter(
    (entry) => !(entry.currency === normalized && entry.source === 'cloud'),
  );
  if (next.length === entries.length) return false;
  writeEntries(next);
  dispatchCommissionsUpdated();
  return true;
}

export function saveCurrencyCommission24h(currency: ExpenseCurrency, percent: number): boolean {
  if (!isSupportedCurrency(currency) || currency === 'ILS' || !isFinitePercent(percent)) {
    return false;
  }

  const now = Date.now();
  const nextEntry: CurrencyCommissionEntry = {
    currency,
    percent,
    source: 'local_24h',
    expiresAt: now + DAY_MS,
    updatedAt: now,
  };

  const entries = readActiveEntries();
  const localIndex = findEntryIndex(entries, currency, 'local_24h');
  if (localIndex >= 0) {
    entries[localIndex] = nextEntry;
  } else {
    entries.push(nextEntry);
  }

  const cloudIndex = findEntryIndex(entries, currency, 'cloud');
  if (cloudIndex >= 0) {
    entries.splice(cloudIndex, 1);
  }

  writeEntries(entries);
  dispatchCommissionsUpdated();
  return true;
}

export function upsertCloudCurrencyCommission(currency: ExpenseCurrency, percent: number): boolean {
  if (!isSupportedCurrency(currency) || currency === 'ILS' || !isFinitePercent(percent)) {
    return false;
  }

  const entries = readActiveEntries();
  const cloudEntry: CurrencyCommissionEntry = {
    currency,
    percent,
    source: 'cloud',
    expiresAt: null,
    updatedAt: Date.now(),
  };

  const cloudIndex = findEntryIndex(entries, currency, 'cloud');
  if (cloudIndex >= 0) {
    entries[cloudIndex] = cloudEntry;
  } else {
    entries.push(cloudEntry);
  }

  const localIndex = findEntryIndex(entries, currency, 'local_24h');
  if (localIndex >= 0) {
    entries.splice(localIndex, 1);
  }

  writeEntries(entries);
  dispatchCommissionsUpdated();
  return true;
}

export function replaceCloudCurrencyCommissions(cloudEntries: CloudCurrencyCommission[]): void {
  const now = Date.now();
  const threshold = now - DAY_MS;
  const localOnly = readActiveEntries().filter((entry) => entry.source !== 'cloud');
  const normalizedCloud: CurrencyCommissionEntry[] = [];

  cloudEntries.forEach((entry) => {
    if (!isSupportedCurrency(entry.currency) || entry.currency === 'ILS') return;
    if (!isFinitePercent(entry.percent)) return;
    const updatedAt = entry.updatedAt ?? now;
    if (updatedAt < threshold) return;
    normalizedCloud.push({
      currency: entry.currency,
      percent: entry.percent,
      source: 'cloud',
      expiresAt: null,
      updatedAt,
    });
  });

  writeEntries([...localOnly, ...normalizedCloud]);
  dispatchCommissionsUpdated();
}

export function clearCloudCurrencyCommissions(): void {
  const entries = readActiveEntries();
  const localOnly = entries.filter((entry) => entry.source !== 'cloud');
  if (localOnly.length === entries.length) return;
  writeEntries(localOnly);
  dispatchCommissionsUpdated();
}

export function clearAllCurrencyCommissionsLocal(): void {
  lsDelete(STORAGE_KEY);
  resetInMemoryFallback();
  dispatchCommissionsUpdated();
}
