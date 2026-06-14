import { isSupportedCurrency, type ExpenseCurrency } from '../constants/currencies';
import { getActiveCurrencyCommissionPercent } from './currencyCommissionService';
import { archiveManualRateOverride } from './historicalOverrideService';

const STORAGE_KEY = 'money_manager_manual_exchange_overrides_v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const OVERRIDES_UPDATED_EVENT = 'manual-exchange-overrides-updated';

/**
 * Safe localStorage helpers with an in-memory session fallback.
 * Handles iOS Safari private mode (QuotaExceededError) and restrictive
 * mobile WebViews where localStorage.setItem can throw.
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
    _memStore.delete(key);
  } catch {
    _memStore.set(key, value);
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

export type ManualRateSaveMode = '24h' | 'forever';
export type ManualOverrideSource = 'local_24h' | 'cloud';

export interface ManualExchangeOverrideEntry {
  baseCurrency: ExpenseCurrency;
  quoteCurrency: ExpenseCurrency;
  source: ManualOverrideSource;
  rate: number;
  expiresAt: number | null;
  updatedAt: number;
  /**
   * When true (default), this rate applies ONLY between baseCurrency ↔ quoteCurrency.
   * When false, all cross-currency projections use this entry as a general override
   * (legacy "global" behaviour).
   */
  pairSpecific: boolean;
}

export interface CloudManualExchangeOverride {
  baseCurrency: ExpenseCurrency;
  quoteCurrency: ExpenseCurrency;
  rate: number;
  updatedAt?: number;
  pairSpecific?: boolean;
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
        // Default true for legacy entries that lack the field.
        pairSpecific: (entry as { pairSpecific?: unknown }).pairSpecific !== false,
      }));
  } catch {
    return [];
  }
}

function readEntries(): ManualExchangeOverrideEntry[] {
  return safeParseEntries(lsRead(STORAGE_KEY));
}

function writeEntries(entries: ManualExchangeOverrideEntry[]): void {
  lsWrite(STORAGE_KEY, JSON.stringify(entries));
}

function isExpired(entry: ManualExchangeOverrideEntry, now = Date.now()): boolean {
  return entry.source === 'local_24h' && entry.expiresAt != null && entry.expiresAt <= now;
}

function cleanupExpiredEntries(entries: ManualExchangeOverrideEntry[]): ManualExchangeOverrideEntry[] {
  const now = Date.now();
  const expired = entries.filter((entry) => isExpired(entry, now));

  // Archive expired entries before discarding them.
  for (const entry of expired) {
    const feePercent = getActiveCurrencyCommissionPercent(entry.baseCurrency);
    archiveManualRateOverride({
      baseCurrency: entry.baseCurrency,
      quoteCurrency: entry.quoteCurrency,
      rate: entry.rate,
      updatedAt: entry.updatedAt,
      feePercent,
    });
  }

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

/**
 * Resolve the active override rate for a specific pair, respecting pairSpecific scope.
 *
 * Resolution order:
 *  1. Pair-specific entry exactly matching `from → to` (or inverse).
 *  2. Global entry (pairSpecific === false) matching `from → to` (or inverse) as a legacy fallback.
 *
 * Returns null if no applicable override is found.
 */
export function getManualExchangeOverrideForPair(
  fromCurrency: string,
  toCurrency: string,
): number | null {
  if (fromCurrency === toCurrency) return null;
  if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) return null;

  const entries = readActiveEntries();
  const from = fromCurrency as ExpenseCurrency;
  const to = toCurrency as ExpenseCurrency;

  // Phase 1: pair-specific exact match
  const directSpecific = entries.find(
    (e) => e.pairSpecific && e.baseCurrency === from && e.quoteCurrency === to,
  );
  if (directSpecific) return directSpecific.rate;

  const inverseSpecific = entries.find(
    (e) => e.pairSpecific && e.baseCurrency === to && e.quoteCurrency === from,
  );
  if (inverseSpecific) return 1 / inverseSpecific.rate;

  // Phase 2: global override (pairSpecific === false) – applies to any pair
  const directGlobal = entries.find(
    (e) => !e.pairSpecific && e.baseCurrency === from && e.quoteCurrency === to,
  );
  if (directGlobal) return directGlobal.rate;

  const inverseGlobal = entries.find(
    (e) => !e.pairSpecific && e.baseCurrency === to && e.quoteCurrency === from,
  );
  if (inverseGlobal) return 1 / inverseGlobal.rate;

  return null;
}

/** Legacy alias – resolves the best applicable rate for a pair (respects scope). */
export function getManualExchangeOverride(fromCurrency: string, toCurrency: string): number | null {
  return getManualExchangeOverrideForPair(fromCurrency, toCurrency);
}

/** Active saved manual override for a pair, including metadata for display. */
export function getActiveManualExchangeOverrideSnapshot(
  fromCurrency: string,
  toCurrency: string,
): { rate: number; updatedAt: number; pairSpecific: boolean } | null {
  if (fromCurrency === toCurrency) return null;
  if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) return null;

  const entries = readActiveEntries();
  const from = fromCurrency as ExpenseCurrency;
  const to = toCurrency as ExpenseCurrency;

  const direct = entries.find(
    (e) => e.baseCurrency === from && e.quoteCurrency === to,
  );
  if (direct && direct.rate > 0) {
    return { rate: direct.rate, updatedAt: direct.updatedAt, pairSpecific: direct.pairSpecific };
  }

  const inverse = entries.find(
    (e) => e.baseCurrency === to && e.quoteCurrency === from,
  );
  if (inverse && inverse.rate > 0) {
    return { rate: 1 / inverse.rate, updatedAt: inverse.updatedAt, pairSpecific: inverse.pairSpecific };
  }

  return null;
}

/**
 * Returns true when any active manual override entry is genuinely applicable
 * for the given currency pair under its declared scope.
 */
export function hasActiveManualOverrideForPair(
  fromCurrency: string,
  toCurrency: string,
): boolean {
  return getManualExchangeOverrideForPair(fromCurrency, toCurrency) != null;
}

/**
 * Returns true when any active 24-hour manual override exists anywhere,
 * used by the global reminder in ExpenseAmountField when the pair is relevant.
 */
export function hasAnyActive24hManualOverride(): boolean {
  const now = Date.now();
  return readActiveEntries().some(
    (entry) => entry.source === 'local_24h' && entry.expiresAt != null && entry.expiresAt > now,
  );
}

export function saveManualExchangeOverride24h(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  pairSpecific = true,
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
    pairSpecific,
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
  const entryToRemove = entries.find(
    (e) =>
      e.baseCurrency === normalized.baseCurrency &&
      e.quoteCurrency === normalized.quoteCurrency &&
      e.source === 'local_24h',
  );

  if (!entryToRemove) return false;

  const next = entries.filter(
    (entry) =>
      !(
        entry.baseCurrency === normalized.baseCurrency &&
        entry.quoteCurrency === normalized.quoteCurrency &&
        entry.source === 'local_24h'
      ),
  );
  writeEntries(next);
  dispatchOverridesUpdated();
  return true;
}

export function replaceCloudManualExchangeOverrides(
  cloudOverrides: CloudManualExchangeOverride[],
): void {
  const now = Date.now();
  const threshold = now - DAY_MS;
  const localOnly = readActiveEntries().filter((entry) => entry.source !== 'cloud');
  const normalizedCloud: ManualExchangeOverrideEntry[] = [];
  cloudOverrides.forEach((entry) => {
    if (!isFinitePositive(entry.rate) || entry.baseCurrency === entry.quoteCurrency) return;
    const updatedAt = entry.updatedAt ?? now;
    if (updatedAt < threshold) return;
    normalizedCloud.push({
      baseCurrency: entry.baseCurrency,
      quoteCurrency: entry.quoteCurrency,
      source: 'cloud' as const,
      rate: entry.rate,
      expiresAt: null,
      updatedAt,
      pairSpecific: entry.pairSpecific !== false,
    });
  });

  writeEntries([...localOnly, ...normalizedCloud]);
  dispatchOverridesUpdated();
}

export function upsertCloudManualExchangeOverride(
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
  rate: number,
  pairSpecific = true,
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
    pairSpecific,
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
  const entryToRemove = entries.find(
    (e) =>
      e.baseCurrency === normalized.baseCurrency &&
      e.quoteCurrency === normalized.quoteCurrency &&
      e.source === 'cloud',
  );

  if (!entryToRemove) return false;

  const next = entries.filter(
    (entry) =>
      !(
        entry.baseCurrency === normalized.baseCurrency &&
        entry.quoteCurrency === normalized.quoteCurrency &&
        entry.source === 'cloud'
      ),
  );
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

export function clearAllManualExchangeOverridesLocal(): void {
  lsDelete(STORAGE_KEY);
  resetInMemoryFallback();
  dispatchOverridesUpdated();
}

export function saveManualExchangeOverride(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  mode: ManualRateSaveMode,
  pairSpecific = true,
): boolean {
  if (mode === '24h') {
    return saveManualExchangeOverride24h(fromCurrency, toCurrency, rate, pairSpecific);
  }
  return false;
}
