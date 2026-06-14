/**
 * Historical Override Archive
 *
 * Stores past manual-rate + fee configurations keyed by date range + currency pair.
 * Entries are written when a live 24 h rate expires or is explicitly deleted —
 * never for today's date (the live-state layer already covers the current day).
 *
 * Storage: localStorage for all users; authenticated users additionally sync to
 * Firebase via `saveHistoricalOverrideToCloud` called from App.tsx on the
 * `historical-overrides-updated` event.
 */

import { isSupportedCurrency, type ExpenseCurrency } from '../constants/currencies';
import { getLocalTodayIso } from './exchangeRateService';

export const HISTORICAL_OVERRIDES_STORAGE_KEY = 'money_manager_historical_overrides_v1';
const HISTORICAL_UPDATED_EVENT = 'historical-overrides-updated';

export interface HistoricalOverrideEntry {
  /**
   * Legacy single-day field — kept in sync with `startDate` for backward compatibility.
   * @deprecated Prefer `startDate` / `endDate`.
   */
  date: string;
  /** Start of the active window (YYYY-MM-DD, inclusive). */
  startDate: string;
  /**
   * End of the active window (YYYY-MM-DD, inclusive).
   * `null` means forever (לתמיד) — display as `startDate ➡️ לתמיד`.
   */
  endDate: string | null;
  /** Normalised base currency (lexicographically smaller of the two). */
  fromCurrency: ExpenseCurrency;
  /** Normalised quote currency (lexicographically larger of the two). */
  toCurrency: ExpenseCurrency;
  /**
   * 1 fromCurrency = manualRate × toCurrency at the time of archiving.
   * null when only a fee entry is archived (no manual rate was in effect).
   */
  manualRate: number | null;
  /** Commission % that was active for fromCurrency at archive time. */
  feePercent: number | null;
  /** Unix-ms timestamp of the archive write. */
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Safe localStorage helpers (mirrors the pattern used in currencyCommissionService)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Serialisation helpers
// ---------------------------------------------------------------------------

function timestampToLocalDateIso(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Stable storage key for an entry (local + Firestore map key). */
export function historicalEntryKey(
  entry: Pick<HistoricalOverrideEntry, 'startDate' | 'endDate' | 'fromCurrency' | 'toCurrency'>,
): string {
  const endPart = entry.endDate ?? 'forever';
  return `${entry.startDate}__${endPart}__${entry.fromCurrency}__${entry.toCurrency}`;
}

/** Whether a calendar date falls inside an entry's active window. */
export function historicalDateInRange(dateIso: string, entry: HistoricalOverrideEntry): boolean {
  if (dateIso < entry.startDate) return false;
  if (entry.endDate === null) return true;
  return dateIso <= entry.endDate;
}

function normalizeHistoricalEntry(item: unknown): HistoricalOverrideEntry | null {
  if (!item || typeof item !== 'object') return null;
  const e = item as Record<string, unknown>;

  const legacyDate = typeof e.date === 'string' && e.date.length === 10 ? e.date : '';
  const startDate =
    typeof e.startDate === 'string' && e.startDate.length === 10 ? e.startDate : legacyDate;
  if (startDate.length !== 10) return null;

  let endDate: string | null;
  if (e.endDate === null || e.endDate === 'Forever' || e.endDate === 'forever') {
    endDate = null;
  } else if (typeof e.endDate === 'string' && e.endDate.length === 10) {
    endDate = e.endDate;
  } else {
    endDate = startDate;
  }

  if (endDate !== null && startDate > endDate) return null;

  if (
    typeof e.fromCurrency !== 'string' ||
    !isSupportedCurrency(e.fromCurrency) ||
    typeof e.toCurrency !== 'string' ||
    !isSupportedCurrency(e.toCurrency)
  ) {
    return null;
  }

  const manualRate =
    e.manualRate === null
      ? null
      : typeof e.manualRate === 'number' && e.manualRate > 0
        ? e.manualRate
        : null;
  const feePercent =
    e.feePercent === null
      ? null
      : typeof e.feePercent === 'number' && e.feePercent > 0 && e.feePercent <= 100
        ? e.feePercent
        : null;

  if (typeof e.updatedAt !== 'number') return null;

  return {
    date: startDate,
    startDate,
    endDate,
    fromCurrency: e.fromCurrency,
    toCurrency: e.toCurrency,
    manualRate,
    feePercent,
    updatedAt: e.updatedAt,
  };
}

function readEntries(): HistoricalOverrideEntry[] {
  const raw = lsRead(HISTORICAL_OVERRIDES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeHistoricalEntry)
      .filter((e): e is HistoricalOverrideEntry => e !== null);
  } catch {
    return [];
  }
}

function writeEntries(entries: HistoricalOverrideEntry[]): void {
  lsWrite(HISTORICAL_OVERRIDES_STORAGE_KEY, JSON.stringify(entries));
}

// ---------------------------------------------------------------------------
// Event bus
// ---------------------------------------------------------------------------

function dispatchHistoricalUpdated(): void {
  window.dispatchEvent(new CustomEvent(HISTORICAL_UPDATED_EVENT));
}

export function subscribeHistoricalOverridesUpdated(listener: () => void): () => void {
  window.addEventListener(HISTORICAL_UPDATED_EVENT, listener);
  return () => window.removeEventListener(HISTORICAL_UPDATED_EVENT, listener);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Archive a manual-rate override entry after it expires or is explicitly deleted
 * by the user (after they confirmed "Yes, save to archive").
 */
export function archiveManualRateOverride(
  params: {
    baseCurrency: ExpenseCurrency;
    quoteCurrency: ExpenseCurrency;
    rate: number | null;
    updatedAt: number;
    feePercent?: number | null;
  },
  options?: { force?: boolean },
): void {
  const date = timestampToLocalDateIso(params.updatedAt);
  const today = getLocalTodayIso();

  if (!options?.force && date === today) return;

  const entries = readEntries();

  const newEntry: HistoricalOverrideEntry = {
    date,
    startDate: date,
    endDate: date,
    fromCurrency: params.baseCurrency,
    toCurrency: params.quoteCurrency,
    manualRate: params.rate != null && params.rate > 0 ? params.rate : null,
    feePercent:
      params.feePercent != null && params.feePercent > 0 && params.feePercent <= 100
        ? params.feePercent
        : null,
    updatedAt: Date.now(),
  };

  const newKey = historicalEntryKey(newEntry);
  const existingIdx = entries.findIndex((e) => historicalEntryKey(e) === newKey);

  if (existingIdx >= 0) {
    entries[existingIdx] = newEntry;
  } else {
    entries.push(newEntry);
  }

  writeEntries(entries);
  dispatchHistoricalUpdated();
}

export function archiveCommissionForCurrency(params: {
  currency: ExpenseCurrency;
  feePercent: number;
  updatedAt: number;
  force?: boolean;
}): void {
  if (params.currency === 'ILS') return;
  archiveManualRateOverride(
    {
      baseCurrency: params.currency,
      quoteCurrency: 'ILS',
      rate: null,
      updatedAt: params.updatedAt,
      feePercent: params.feePercent,
    },
    { force: params.force },
  );
}

export function lookupHistoricalOverrideForCurrency(
  dateIso: string,
  currency: ExpenseCurrency,
): HistoricalOverrideEntry | null {
  const { rateEntry, feeEntry } = lookupHistoricalOverridesForCurrency(dateIso, currency);
  return rateEntry ?? feeEntry;
}

/** Resolves separate archived rate and fee entries for a past date + expense currency. */
export function lookupHistoricalOverridesForCurrency(
  dateIso: string,
  currency: ExpenseCurrency,
): {
  rateEntry: HistoricalOverrideEntry | null;
  feeEntry: HistoricalOverrideEntry | null;
} {
  const empty = { rateEntry: null, feeEntry: null };
  const today = getLocalTodayIso();
  if (dateIso >= today) return empty;
  if (!isSupportedCurrency(currency)) return empty;

  const matching = readEntries().filter(
    (e) =>
      historicalDateInRange(dateIso, e) &&
      (e.fromCurrency === currency || e.toCurrency === currency),
  );

  const rateEntry =
    matching.find((e) => e.manualRate != null && e.manualRate > 0) ?? null;
  const feeEntry =
    matching.find((e) => e.feePercent != null && e.feePercent > 0) ?? null;

  return { rateEntry, feeEntry };
}

export function resolveHistoricalRateToIls(
  entry: HistoricalOverrideEntry,
  expenseCurrency: ExpenseCurrency,
): number | null {
  if (!entry.manualRate || !(entry.manualRate > 0)) return null;

  if (entry.fromCurrency === expenseCurrency && entry.toCurrency === 'ILS') {
    return entry.manualRate;
  }
  if (entry.toCurrency === expenseCurrency && entry.fromCurrency === 'ILS') {
    return 1 / entry.manualRate;
  }
  return null;
}

export function listHistoricalOverrides(): HistoricalOverrideEntry[] {
  return readEntries()
    .slice()
    .sort((a, b) => {
      if (b.startDate !== a.startDate) return b.startDate.localeCompare(a.startDate);
      return b.updatedAt - a.updatedAt;
    });
}

export function deleteHistoricalOverrideEntry(entry: HistoricalOverrideEntry): boolean {
  const targetKey = historicalEntryKey(entry);
  const entries = readEntries();
  const filtered = entries.filter((e) => historicalEntryKey(e) !== targetKey);
  if (filtered.length === entries.length) return false;
  writeEntries(filtered);
  dispatchHistoricalUpdated();
  return true;
}

/**
 * Replace an archived entry after edit-mode save.
 * If the date range or pair changes, the old key is removed and the new entry is upserted.
 */
export function updateHistoricalOverrideEntry(
  previous: HistoricalOverrideEntry,
  updated: HistoricalOverrideEntry,
): boolean {
  if (updated.endDate !== null && updated.startDate > updated.endDate) return false;

  const entries = readEntries();
  const prevKey = historicalEntryKey(previous);
  const prevIdx = entries.findIndex((e) => historicalEntryKey(e) === prevKey);
  if (prevIdx < 0) return false;

  const nextEntry: HistoricalOverrideEntry = {
    ...updated,
    date: updated.startDate,
    updatedAt: Date.now(),
  };
  const nextKey = historicalEntryKey(nextEntry);

  if (prevKey === nextKey) {
    entries[prevIdx] = nextEntry;
  } else {
    entries.splice(prevIdx, 1);
    const dupIdx = entries.findIndex((e) => historicalEntryKey(e) === nextKey);
    if (dupIdx >= 0) {
      entries[dupIdx] = nextEntry;
    } else {
      entries.push(nextEntry);
    }
  }

  writeEntries(entries);
  dispatchHistoricalUpdated();
  return true;
}

export function mergeHistoricalOverridesFromCloud(
  cloudEntries: HistoricalOverrideEntry[],
): void {
  const valid = cloudEntries
    .map((e) => normalizeHistoricalEntry(e))
    .filter((e): e is HistoricalOverrideEntry => e !== null);
  if (valid.length === 0) return;

  const local = readEntries();
  const merged = [...local];

  for (const cloudEntry of valid) {
    const cloudKey = historicalEntryKey(cloudEntry);
    const idx = merged.findIndex((e) => historicalEntryKey(e) === cloudKey);
    if (idx >= 0) {
      if (cloudEntry.updatedAt >= merged[idx].updatedAt) {
        merged[idx] = cloudEntry;
      }
    } else {
      merged.push(cloudEntry);
    }
  }

  writeEntries(merged);
  dispatchHistoricalUpdated();
}
