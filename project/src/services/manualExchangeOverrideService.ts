import { isSupportedCurrency, type ExpenseCurrency } from '../constants/currencies';

const STORAGE_KEY = 'money_manager_manual_exchange_overrides_v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const OVERRIDES_UPDATED_EVENT = 'manual-exchange-overrides-updated';

export type ManualRateSaveMode = '24h' | 'forever';
export type ManualOverrideSource = 'local_24h' | 'cloud';

export interface ManualExchangeOverrideEntry {
  baseCurrency: ExpenseCurrency;
  quoteCurrency: ExpenseCurrency;
  source: ManualOverrideSource;
  rate: number;
  expiresAt: number | null;
  updatedAt: number;
}

export interface CloudManualExchangeOverride {
  baseCurrency: ExpenseCurrency;
  quoteCurrency: ExpenseCurrency;
  rate: number;
  updatedAt?: number;
}

function isFinitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function normalizePair(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
): { baseCurrency: ExpenseCurrency; quoteCurrency: ExpenseCurrency; normalizedRate: number } | null {
  if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) return null;
  if (fromCurrency === toCurrency || !isFinitePositive(rate)) return null;

  if (fromCurrency < toCurrency) {
    return {
      baseCurrency: fromCurrency,
      quoteCurrency: toCurrency,
      normalizedRate: rate,
    };
  }

  return {
    baseCurrency: toCurrency,
    quoteCurrency: fromCurrency,
    normalizedRate: 1 / rate,
  };
}

function dispatchOverridesUpdated(): void {
  window.dispatchEvent(new CustomEvent(OVERRIDES_UPDATED_EVENT));
}

export function subscribeManualOverridesUpdated(listener: () => void): () => void {
  window.addEventListener(OVERRIDES_UPDATED_EVENT, listener);
  return () => window.removeEventListener(OVERRIDES_UPDATED_EVENT, listener);
}

function safeParseEntries(raw: string | null): ManualExchangeOverrideEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is ManualExchangeOverrideEntry => {
        if (!item || typeof item !== 'object') return false;
        const baseCurrency = (item as { baseCurrency?: unknown }).baseCurrency;
        const quoteCurrency = (item as { quoteCurrency?: unknown }).quoteCurrency;
        const source = (item as { source?: unknown }).source;
        const rate = (item as { rate?: unknown }).rate;
        const expiresAt = (item as { expiresAt?: unknown }).expiresAt;
        const updatedAt = (item as { updatedAt?: unknown }).updatedAt;

        return (
          typeof baseCurrency === 'string' &&
          typeof quoteCurrency === 'string' &&
          isSupportedCurrency(baseCurrency) &&
          isSupportedCurrency(quoteCurrency) &&
          baseCurrency !== quoteCurrency &&
          (source === 'local_24h' || source === 'cloud') &&
          typeof rate === 'number' &&
          isFinitePositive(rate) &&
          (typeof expiresAt === 'number' || expiresAt === null) &&
          typeof updatedAt === 'number'
        );
      })
      .map((entry) => ({
        baseCurrency: entry.baseCurrency,
        quoteCurrency: entry.quoteCurrency,
        source: entry.source,
        rate: entry.rate,
        expiresAt: entry.expiresAt,
        updatedAt: entry.updatedAt,
      }));
  } catch {
    return [];
  }
}

function readEntries(): ManualExchangeOverrideEntry[] {
  return safeParseEntries(window.localStorage.getItem(STORAGE_KEY));
}

function writeEntries(entries: ManualExchangeOverrideEntry[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function isExpired(entry: ManualExchangeOverrideEntry, now = Date.now()): boolean {
  return entry.source === 'local_24h' && entry.expiresAt != null && entry.expiresAt <= now;
}

function cleanupExpiredEntries(entries: ManualExchangeOverrideEntry[]): ManualExchangeOverrideEntry[] {
  const now = Date.now();
  return entries.filter((entry) => !isExpired(entry, now));
}

function readActiveEntries(): ManualExchangeOverrideEntry[] {
  const entries = readEntries();
  const cleaned = cleanupExpiredEntries(entries);
  if (cleaned.length !== entries.length) {
    writeEntries(cleaned);
    dispatchOverridesUpdated();
  }
  return cleaned;
}

function findEntryIndex(
  entries: ManualExchangeOverrideEntry[],
  baseCurrency: ExpenseCurrency,
  quoteCurrency: ExpenseCurrency,
  source?: ManualOverrideSource,
): number {
  return entries.findIndex(
    (entry) =>
      entry.baseCurrency === baseCurrency &&
      entry.quoteCurrency === quoteCurrency &&
      (source ? entry.source === source : true),
  );
}

export function listActiveManualExchangeOverrides(): ManualExchangeOverrideEntry[] {
  return readActiveEntries().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getManualExchangeOverride(fromCurrency: string, toCurrency: string): number | null {
  if (fromCurrency === toCurrency) return 1;
  if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) return null;

  const entries = readActiveEntries();
  const direct = entries.find(
    (entry) => entry.baseCurrency === fromCurrency && entry.quoteCurrency === toCurrency,
  );
  if (direct) return direct.rate;

  const inverse = entries.find(
    (entry) => entry.baseCurrency === toCurrency && entry.quoteCurrency === fromCurrency,
  );
  if (inverse) return 1 / inverse.rate;

  return null;
}

export function saveManualExchangeOverride24h(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
): boolean {
  const normalized = normalizePair(fromCurrency, toCurrency, rate);
  if (!normalized) return false;

  const now = Date.now();
  const nextEntry: ManualExchangeOverrideEntry = {
    baseCurrency: normalized.baseCurrency,
    quoteCurrency: normalized.quoteCurrency,
    source: 'local_24h',
    rate: normalized.normalizedRate,
    expiresAt: now + DAY_MS,
    updatedAt: now,
  };

  const entries = readActiveEntries();
  const index = findEntryIndex(
    entries,
    normalized.baseCurrency,
    normalized.quoteCurrency,
    'local_24h',
  );

  if (index >= 0) {
    entries[index] = nextEntry;
  } else {
    entries.push(nextEntry);
  }

  const cloudIndex = findEntryIndex(
    entries,
    normalized.baseCurrency,
    normalized.quoteCurrency,
    'cloud',
  );
  if (cloudIndex >= 0) {
    entries.splice(cloudIndex, 1);
  }

  writeEntries(entries);
  dispatchOverridesUpdated();
  return true;
}

export function removeLocalManualExchangeOverride(fromCurrency: string, toCurrency: string): boolean {
  const normalized = normalizePair(fromCurrency, toCurrency, 1);
  if (!normalized) return false;

  const entries = readActiveEntries();
  const next = entries.filter(
    (entry) =>
      !(
        entry.baseCurrency === normalized.baseCurrency &&
        entry.quoteCurrency === normalized.quoteCurrency &&
        entry.source === 'local_24h'
      ),
  );
  if (next.length === entries.length) return false;
  writeEntries(next);
  dispatchOverridesUpdated();
  return true;
}

export function replaceCloudManualExchangeOverrides(
  cloudOverrides: CloudManualExchangeOverride[],
): void {
  const localOnly = readActiveEntries().filter((entry) => entry.source !== 'cloud');
  const normalizedCloud: ManualExchangeOverrideEntry[] = [];
  cloudOverrides.forEach((entry) => {
      const normalized = normalizePair(entry.baseCurrency, entry.quoteCurrency, entry.rate);
      if (!normalized) return;
      normalizedCloud.push({
        baseCurrency: normalized.baseCurrency,
        quoteCurrency: normalized.quoteCurrency,
        source: 'cloud' as const,
        rate: normalized.normalizedRate,
        expiresAt: null,
        updatedAt: entry.updatedAt ?? Date.now(),
      });
    });

  writeEntries([...localOnly, ...normalizedCloud]);
  dispatchOverridesUpdated();
}

export function upsertCloudManualExchangeOverride(
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
  rate: number,
): boolean {
  const normalized = normalizePair(fromCurrency, toCurrency, rate);
  if (!normalized) return false;
  const entries = readActiveEntries();
  const cloudEntry: ManualExchangeOverrideEntry = {
    baseCurrency: normalized.baseCurrency,
    quoteCurrency: normalized.quoteCurrency,
    source: 'cloud',
    rate: normalized.normalizedRate,
    expiresAt: null,
    updatedAt: Date.now(),
  };
  const index = findEntryIndex(
    entries,
    normalized.baseCurrency,
    normalized.quoteCurrency,
    'cloud',
  );
  if (index >= 0) {
    entries[index] = cloudEntry;
  } else {
    entries.push(cloudEntry);
  }
  const localIndex = findEntryIndex(
    entries,
    normalized.baseCurrency,
    normalized.quoteCurrency,
    'local_24h',
  );
  if (localIndex >= 0) {
    entries.splice(localIndex, 1);
  }
  writeEntries(entries);
  dispatchOverridesUpdated();
  return true;
}

export function removeCloudManualExchangeOverride(
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
): boolean {
  const normalized = normalizePair(fromCurrency, toCurrency, 1);
  if (!normalized) return false;
  const entries = readActiveEntries();
  const next = entries.filter(
    (entry) =>
      !(
        entry.baseCurrency === normalized.baseCurrency &&
        entry.quoteCurrency === normalized.quoteCurrency &&
        entry.source === 'cloud'
      ),
  );
  if (next.length === entries.length) return false;
  writeEntries(next);
  dispatchOverridesUpdated();
  return true;
}

export function clearCloudManualExchangeOverrides(): void {
  const entries = readActiveEntries();
  const localOnly = entries.filter((entry) => entry.source !== 'cloud');
  if (localOnly.length === entries.length) return;
  writeEntries(localOnly);
  dispatchOverridesUpdated();
}

export function saveManualExchangeOverride(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  mode: ManualRateSaveMode,
): boolean {
  if (mode === '24h') {
    return saveManualExchangeOverride24h(fromCurrency, toCurrency, rate);
  }
  return false;
}
