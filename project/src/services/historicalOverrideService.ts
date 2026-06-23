/**
 * Historical Override Archive — atomic rate/fee records keyed by date scope + pair/currency.
 *
 * Uniqueness:
 *  - Rates: no overlapping date ranges per canonical alphabetical pair (e.g. ILS_USD)
 *  - Fees: no overlapping date ranges for the same fee currency
 *  - Rate values stored in canonical direction (lexicographically smaller ISO → larger ISO)
 *
 * All entries require concrete startDate and endDate (single-day: startDate === endDate).
 */

import { isSupportedCurrency, type ExpenseCurrency } from '../constants/currencies';
import { GLOBAL_COMMISSION_CURRENCY } from './currencyCommissionService';
import { getLocalTodayIso } from './exchangeRateService';

export const HISTORICAL_OVERRIDES_STORAGE_KEY = 'money_manager_historical_overrides_v1';
const HISTORICAL_UPDATED_EVENT = 'historical-overrides-updated';

export type HistoricalOverridesUpdatedDetail = {
  /** Automation-flag patch only — listeners should not reset ephemeral form injection. */
  automationOnly?: boolean;
};

export type HistoricalOverrideAutomationApplyMode = 'both' | 'rateOnly' | 'feeOnly' | 'none';

export interface HistoricalOverrideEntry {
  /** Legacy mirror of `startDate` for backward compatibility. */
  date: string;
  startDate: string;
  endDate: string;
  fromCurrency: ExpenseCurrency;
  toCurrency: ExpenseCurrency;
  manualRate: number | null;
  feePercent: number | null;
  updatedAt: number;
  applyAutomatically?: boolean;
  hideBannerPermanently?: boolean;
  automationApplyMode?: HistoricalOverrideAutomationApplyMode;
}

export interface HistoricalOverrideBannerContext {
  rateEntry: HistoricalOverrideEntry | null;
  feeEntry: HistoricalOverrideEntry | null;
}

export interface NewExpenseHistoricalApplied {
  rateEntry: HistoricalOverrideEntry | null;
  feeEntry: HistoricalOverrideEntry | null;
}

export interface HistoricalOverrideBannerOptions {
  applyAutomatically: boolean;
  hideBannerPermanently: boolean;
}

export type HistoricalOverrideWriteFailureReason = 'invalid_dates' | 'overlap';

export type HistoricalOverrideWriteResult =
  | { ok: true; entry: HistoricalOverrideEntry }
  | { ok: false; reason: HistoricalOverrideWriteFailureReason };

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

function timestampToLocalDateIso(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseAutomationApplyMode(value: unknown): HistoricalOverrideAutomationApplyMode | undefined {
  if (value === 'both' || value === 'rateOnly' || value === 'feeOnly' || value === 'none') {
    return value;
  }
  return undefined;
}

export function entryHasRate(entry: HistoricalOverrideEntry): boolean {
  return entry.manualRate != null && entry.manualRate > 0;
}

export function entryHasFee(entry: HistoricalOverrideEntry): boolean {
  return entry.feePercent != null && entry.feePercent > 0;
}

export function isRateHistoricalEntry(entry: HistoricalOverrideEntry): boolean {
  return entryHasRate(entry);
}

export function isFeeHistoricalEntry(entry: HistoricalOverrideEntry): boolean {
  return entryHasFee(entry) && !entryHasRate(entry);
}

/** Fee currency encoded on a fee-only historical row. */
export function resolveHistoricalFeeCurrency(entry: HistoricalOverrideEntry): ExpenseCurrency | 'ALL' {
  if (entry.fromCurrency === GLOBAL_COMMISSION_CURRENCY || entry.toCurrency === GLOBAL_COMMISSION_CURRENCY) {
    return GLOBAL_COMMISSION_CURRENCY;
  }
  if (entry.fromCurrency === 'ILS') return entry.toCurrency;
  if (entry.toCurrency === 'ILS') return entry.fromCurrency;
  return entry.fromCurrency;
}

/** Lexicographic canonical order for a two-way rate pair (e.g. ILS + USD → ILS, USD). */
export function canonicalizeHistoricalRatePair(
  currencyA: ExpenseCurrency,
  currencyB: ExpenseCurrency,
): { fromCurrency: ExpenseCurrency; toCurrency: ExpenseCurrency } {
  if (currencyA <= currencyB) {
    return { fromCurrency: currencyA, toCurrency: currencyB };
  }
  return { fromCurrency: currencyB, toCurrency: currencyA };
}

/** Stable alphabetical pair id — `ILS_USD`, never `USD_ILS`. */
export function canonicalHistoricalRatePairKey(
  currencyA: ExpenseCurrency,
  currencyB: ExpenseCurrency,
): string {
  const { fromCurrency, toCurrency } = canonicalizeHistoricalRatePair(currencyA, currencyB);
  return `${fromCurrency}_${toCurrency}`;
}

/**
 * Normalize a user/base rate (1 `originalFrom` = rate × `originalTo`) into canonical storage.
 */
export function normalizeRateValueForCanonicalStorage(
  originalFrom: ExpenseCurrency,
  originalTo: ExpenseCurrency,
  rate: number,
): {
  fromCurrency: ExpenseCurrency;
  toCurrency: ExpenseCurrency;
  manualRate: number;
} {
  const { fromCurrency, toCurrency } = canonicalizeHistoricalRatePair(originalFrom, originalTo);
  const manualRate =
    originalFrom === fromCurrency && originalTo === toCurrency ? rate : 1 / rate;
  return { fromCurrency, toCurrency, manualRate };
}

/** Canonicalize stored from/to + rate so reverse pairs collapse to one row. */
export function normalizeHistoricalRateEntry(entry: HistoricalOverrideEntry): HistoricalOverrideEntry {
  if (!entryHasRate(entry) || entry.manualRate == null || entry.manualRate <= 0) return entry;
  const { fromCurrency, toCurrency, manualRate } = normalizeRateValueForCanonicalStorage(
    entry.fromCurrency,
    entry.toCurrency,
    entry.manualRate,
  );
  return { ...entry, fromCurrency, toCurrency, manualRate };
}

/** Stable storage key — rate rows use canonical pair; fee rows never collide with rates. */
export function historicalEntryKey(entry: HistoricalOverrideEntry): string {
  const end = entry.endDate;
  if (entryHasRate(entry)) {
    const { fromCurrency, toCurrency } = canonicalizeHistoricalRatePair(
      entry.fromCurrency,
      entry.toCurrency,
    );
    return `rate__${entry.startDate}__${end}__${fromCurrency}__${toCurrency}`;
  }
  const feeCurrency = resolveHistoricalFeeCurrency(entry);
  return `fee__${entry.startDate}__${end}__${feeCurrency}`;
}

export function historicalDateInRange(dateIso: string, entry: HistoricalOverrideEntry): boolean {
  if (dateIso < entry.startDate) return false;
  return dateIso <= entry.endDate;
}

/** True when two inclusive ISO date spans share at least one calendar day. */
export function historicalDateRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA <= endB && endA >= startB;
}

function entriesShareRatePair(a: HistoricalOverrideEntry, b: HistoricalOverrideEntry): boolean {
  return (
    canonicalHistoricalRatePairKey(a.fromCurrency, a.toCurrency) ===
    canonicalHistoricalRatePairKey(b.fromCurrency, b.toCurrency)
  );
}

function entriesShareFeeCurrency(a: HistoricalOverrideEntry, b: HistoricalOverrideEntry): boolean {
  return resolveHistoricalFeeCurrency(a) === resolveHistoricalFeeCurrency(b);
}

function entriesConflictOnOverlap(
  proposed: HistoricalOverrideEntry,
  existing: HistoricalOverrideEntry,
): boolean {
  if (
    !historicalDateRangesOverlap(
      proposed.startDate,
      proposed.endDate,
      existing.startDate,
      existing.endDate,
    )
  ) {
    return false;
  }

  if (entryHasRate(proposed) && entryHasRate(existing) && entriesShareRatePair(proposed, existing)) {
    return true;
  }

  if (
    isFeeHistoricalEntry(proposed) &&
    isFeeHistoricalEntry(existing) &&
    entriesShareFeeCurrency(proposed, existing)
  ) {
    return true;
  }

  return false;
}

/** Find a stored row that overlaps the proposed span in the same rate/fee currency context. */
export function findOverlappingHistoricalEntry(
  proposed: HistoricalOverrideEntry,
  entries: HistoricalOverrideEntry[],
  excludeKeys?: string[],
): HistoricalOverrideEntry | null {
  const exclude = new Set(excludeKeys ?? []);
  for (const existing of entries) {
    if (exclude.has(historicalEntryKey(existing))) continue;
    if (entriesConflictOnOverlap(proposed, existing)) return existing;
  }
  return null;
}

function pruneOverlappingGroup(
  entries: HistoricalOverrideEntry[],
  groupKey: (entry: HistoricalOverrideEntry) => string,
): HistoricalOverrideEntry[] {
  const groups = new Map<string, HistoricalOverrideEntry[]>();
  for (const entry of entries) {
    const key = groupKey(entry);
    const bucket = groups.get(key) ?? [];
    bucket.push(entry);
    groups.set(key, bucket);
  }

  const kept: HistoricalOverrideEntry[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => b.updatedAt - a.updatedAt);
    const groupKept: HistoricalOverrideEntry[] = [];
    for (const entry of sorted) {
      const overlapsKept = groupKept.some((other) =>
        historicalDateRangesOverlap(
          entry.startDate,
          entry.endDate,
          other.startDate,
          other.endDate,
        ),
      );
      if (!overlapsKept) groupKept.push(entry);
    }
    kept.push(...groupKept);
  }
  return kept;
}

/** Drop legacy overlapping rows — newest `updatedAt` wins within each currency context. */
function pruneOverlappingEntries(entries: HistoricalOverrideEntry[]): HistoricalOverrideEntry[] {
  const rateEntries = entries.filter((e) => entryHasRate(e));
  const feeEntries = entries.filter((e) => isFeeHistoricalEntry(e));
  const keptRates = pruneOverlappingGroup(rateEntries, (e) =>
    canonicalHistoricalRatePairKey(e.fromCurrency, e.toCurrency),
  );
  const keptFees = pruneOverlappingGroup(feeEntries, (e) => String(resolveHistoricalFeeCurrency(e)));
  return [...keptRates, ...keptFees];
}

function normalizeEntryForWrite(entry: HistoricalOverrideEntry): HistoricalOverrideEntry | null {
  if (entry.startDate.length !== 10 || entry.endDate.length !== 10) return null;
  if (entry.startDate > entry.endDate) return null;

  const endDate = entry.endDate.length === 10 ? entry.endDate : entry.startDate;
  let normalized: HistoricalOverrideEntry = {
    ...entry,
    date: entry.startDate,
    startDate: entry.startDate,
    endDate,
    applyAutomatically: entry.applyAutomatically ?? false,
    hideBannerPermanently: entry.hideBannerPermanently ?? false,
  };

  if (entryHasRate(normalized)) {
    normalized = normalizeHistoricalRateEntry(normalized);
  }

  return normalized;
}

export function validateHistoricalOverrideUpdate(
  previous: HistoricalOverrideEntry,
  updated: HistoricalOverrideEntry,
): HistoricalOverrideWriteFailureReason | null {
  const next = normalizeEntryForWrite(updated);
  if (!next) return 'invalid_dates';

  const prevKey = historicalEntryKey(previous);
  const normalizedPrevKey = historicalEntryKey(
    entryHasRate(previous) ? normalizeHistoricalRateEntry(previous) : previous,
  );
  const excludeKeys = prevKey === normalizedPrevKey ? [prevKey] : [prevKey, normalizedPrevKey];

  const overlap = findOverlappingHistoricalEntry(next, readEntries(), excludeKeys);
  return overlap ? 'overlap' : null;
}

function coerceEndDate(startDate: string, endDate: unknown): string | null {
  if (typeof endDate === 'string' && endDate.length === 10) return endDate;
  if (endDate === null || endDate === 'Forever' || endDate === 'forever') return startDate;
  return startDate;
}

function normalizeHistoricalEntry(item: unknown): HistoricalOverrideEntry | null {
  if (!item || typeof item !== 'object') return null;
  const e = item as Record<string, unknown>;

  const legacyDate = typeof e.date === 'string' && e.date.length === 10 ? e.date : '';
  const startDate =
    typeof e.startDate === 'string' && e.startDate.length === 10 ? e.startDate : legacyDate;
  if (startDate.length !== 10) return null;

  const endDate = coerceEndDate(startDate, e.endDate);
  if (!endDate || startDate > endDate) return null;

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

  const hasValidRate = manualRate != null && manualRate > 0;
  const hasValidFee = feePercent != null && feePercent > 0;
  if (!hasValidRate && !hasValidFee) return null;

  let entry: HistoricalOverrideEntry = {
    date: startDate,
    startDate,
    endDate,
    fromCurrency: e.fromCurrency,
    toCurrency: e.toCurrency,
    manualRate,
    feePercent,
    updatedAt: e.updatedAt,
    applyAutomatically: e.applyAutomatically === true,
    hideBannerPermanently: e.hideBannerPermanently === true,
    automationApplyMode: parseAutomationApplyMode(e.automationApplyMode),
  };

  if (hasValidRate) {
    entry = normalizeHistoricalRateEntry(entry);
  }

  return entry;
}

/** Split legacy combined rows into atomic rate-only + fee-only records. */
function expandCombinedEntries(entries: HistoricalOverrideEntry[]): HistoricalOverrideEntry[] {
  const expanded: HistoricalOverrideEntry[] = [];
  for (const entry of entries) {
    const hasRate = entryHasRate(entry);
    const hasFee = entryHasFee(entry);
    if (hasRate && hasFee) {
      expanded.push({
        ...entry,
        feePercent: null,
        applyAutomatically: entry.applyAutomatically,
        hideBannerPermanently: entry.hideBannerPermanently,
        automationApplyMode:
          entry.automationApplyMode === 'feeOnly' ? undefined : entry.automationApplyMode,
      });
      expanded.push({
        ...entry,
        manualRate: null,
        applyAutomatically: entry.applyAutomatically,
        hideBannerPermanently: entry.hideBannerPermanently,
        automationApplyMode:
          entry.automationApplyMode === 'rateOnly' ? undefined : entry.automationApplyMode,
      });
    } else {
      expanded.push(entry);
    }
  }
  return expanded;
}

/** Keep the newest row per atomic storage key. */
function dedupeAtomicEntries(entries: HistoricalOverrideEntry[]): HistoricalOverrideEntry[] {
  const byKey = new Map<string, HistoricalOverrideEntry>();
  for (const entry of entries) {
    const key = historicalEntryKey(entry);
    const prev = byKey.get(key);
    if (!prev || entry.updatedAt >= prev.updatedAt) {
      byKey.set(key, entry);
    }
  }
  return Array.from(byKey.values());
}

function readEntries(): HistoricalOverrideEntry[] {
  const raw = lsRead(HISTORICAL_OVERRIDES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map(normalizeHistoricalEntry)
      .filter((e): e is HistoricalOverrideEntry => e !== null);
    return pruneOverlappingEntries(dedupeAtomicEntries(expandCombinedEntries(normalized)));
  } catch {
    return [];
  }
}

function writeEntries(entries: HistoricalOverrideEntry[]): void {
  lsWrite(
    HISTORICAL_OVERRIDES_STORAGE_KEY,
    JSON.stringify(pruneOverlappingEntries(dedupeAtomicEntries(entries))),
  );
}

function dispatchHistoricalUpdated(detail?: HistoricalOverridesUpdatedDetail): void {
  window.dispatchEvent(new CustomEvent(HISTORICAL_UPDATED_EVENT, { detail }));
}

/** Atomic upsert — overwrites same key; rejects overlapping spans in the same currency context. */
export function upsertHistoricalOverrideEntry(
  entry: HistoricalOverrideEntry,
  options?: { excludeKeys?: string[]; silent?: boolean },
): HistoricalOverrideWriteResult {
  const next = normalizeEntryForWrite(entry);
  if (!next) return { ok: false, reason: 'invalid_dates' };

  const key = historicalEntryKey(next);
  const excludeKeys = new Set(options?.excludeKeys ?? []);
  excludeKeys.add(key);

  const entries = readEntries();
  const overlap = findOverlappingHistoricalEntry(next, entries, Array.from(excludeKeys));
  if (overlap) return { ok: false, reason: 'overlap' };

  const filtered = entries.filter((e) => historicalEntryKey(e) !== key);
  const stored: HistoricalOverrideEntry = { ...next, updatedAt: Date.now() };
  filtered.push(stored);
  writeEntries(filtered);
  if (!options?.silent) {
    dispatchHistoricalUpdated();
  }
  return { ok: true, entry: stored };
}

export function subscribeHistoricalOverridesUpdated(
  listener: (event: Event) => void,
): () => void {
  const handler = (event: Event) => listener(event);
  window.addEventListener(HISTORICAL_UPDATED_EVENT, handler);
  return () => window.removeEventListener(HISTORICAL_UPDATED_EVENT, handler);
}

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

  const automationDefaults = { applyAutomatically: false, hideBannerPermanently: false };

  if (params.rate != null && params.rate > 0) {
    upsertHistoricalOverrideEntry({
      date,
      startDate: date,
      endDate: date,
      fromCurrency: params.baseCurrency,
      toCurrency: params.quoteCurrency,
      manualRate: params.rate,
      feePercent: null,
      updatedAt: Date.now(),
      ...automationDefaults,
    });
  }

  if (
    params.feePercent != null &&
    params.feePercent > 0 &&
    params.feePercent <= 100 &&
    params.baseCurrency !== 'ILS'
  ) {
    upsertHistoricalOverrideEntry({
      date,
      startDate: date,
      endDate: date,
      fromCurrency: params.baseCurrency,
      toCurrency: 'ILS',
      manualRate: null,
      feePercent: params.feePercent,
      updatedAt: Date.now(),
      ...automationDefaults,
    });
  }
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

export function lookupHistoricalOverridesForCurrency(
  dateIso: string,
  currency: ExpenseCurrency,
): HistoricalOverrideBannerContext {
  const empty = { rateEntry: null, feeEntry: null };
  const today = getLocalTodayIso();
  if (dateIso >= today) return empty;
  if (!isSupportedCurrency(currency)) return empty;

  const matching = readEntries().filter(
    (e) =>
      historicalDateInRange(dateIso, e) &&
      (e.fromCurrency === currency || e.toCurrency === currency),
  );

  const rateEntry = pickBestHistoricalEntryForDate(
    matching.filter((e) => entryHasRate(e)),
    dateIso,
  );

  const feeEntry = pickBestHistoricalEntryForDate(
    matching.filter((e) => isFeeHistoricalEntry(e)),
    dateIso,
  );

  return { rateEntry, feeEntry };
}

function pickBestHistoricalEntryForDate(
  candidates: HistoricalOverrideEntry[],
  dateIso: string,
): HistoricalOverrideEntry | null {
  const inRange = candidates.filter((e) => historicalDateInRange(dateIso, e));
  if (inRange.length === 0) return null;
  return inRange.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

const EMPTY_HISTORICAL_APPLIED: NewExpenseHistoricalApplied = {
  rateEntry: null,
  feeEntry: null,
};

function resolveAutoAppliedFromCombinedEntry(
  entry: HistoricalOverrideEntry,
): NewExpenseHistoricalApplied {
  if (!entry.applyAutomatically) return EMPTY_HISTORICAL_APPLIED;
  const mode = entry.automationApplyMode ?? 'both';
  return {
    rateEntry: (mode === 'both' || mode === 'rateOnly') && entryHasRate(entry) ? entry : null,
    feeEntry: (mode === 'both' || mode === 'feeOnly') && entryHasFee(entry) ? entry : null,
  };
}

function shouldApplyRateFromAutomationMode(entry: HistoricalOverrideEntry): boolean {
  if (!entry.applyAutomatically) return false;
  const mode = entry.automationApplyMode ?? 'both';
  if (mode === 'none') return false;
  return mode === 'both' || mode === 'rateOnly';
}

function shouldApplyFeeFromAutomationMode(entry: HistoricalOverrideEntry): boolean {
  if (!entry.applyAutomatically) return false;
  const mode = entry.automationApplyMode ?? 'both';
  if (mode === 'none') return false;
  return mode === 'both' || mode === 'feeOnly';
}

function resolveAutoAppliedFromSeparate(
  rateEntry: HistoricalOverrideEntry | null,
  feeEntry: HistoricalOverrideEntry | null,
): NewExpenseHistoricalApplied {
  let rateApplied: HistoricalOverrideEntry | null = null;
  let feeApplied: HistoricalOverrideEntry | null = null;

  if (rateEntry && shouldApplyRateFromAutomationMode(rateEntry) && entryHasRate(rateEntry)) {
    rateApplied = rateEntry;
  }
  if (feeEntry && shouldApplyFeeFromAutomationMode(feeEntry) && entryHasFee(feeEntry)) {
    feeApplied = feeEntry;
  }

  return { rateEntry: rateApplied, feeEntry: feeApplied };
}

function resolveAutoAppliedFromContext(
  rateEntry: HistoricalOverrideEntry | null,
  feeEntry: HistoricalOverrideEntry | null,
): NewExpenseHistoricalApplied {
  if (rateEntry && feeEntry && historicalEntryKey(rateEntry) === historicalEntryKey(feeEntry)) {
    return resolveAutoAppliedFromCombinedEntry(rateEntry);
  }
  return resolveAutoAppliedFromSeparate(rateEntry, feeEntry);
}

export function resolveNewExpenseHistoricalState(
  dateIso: string,
  currency: ExpenseCurrency,
): {
  showBanner: boolean;
  bannerContext: HistoricalOverrideBannerContext | null;
  autoApplied: NewExpenseHistoricalApplied;
} {
  const context = lookupHistoricalOverridesForCurrency(dateIso, currency);
  const { rateEntry, feeEntry } = context;

  if (!rateEntry && !feeEntry) {
    return { showBanner: false, bannerContext: null, autoApplied: EMPTY_HISTORICAL_APPLIED };
  }

  const showBanner =
    (rateEntry != null && !rateEntry.hideBannerPermanently) ||
    (feeEntry != null && !feeEntry.hideBannerPermanently);

  const autoApplied = resolveAutoAppliedFromContext(rateEntry, feeEntry);

  return {
    showBanner,
    bannerContext: showBanner ? context : null,
    autoApplied,
  };
}

export function patchHistoricalOverrideEntryAutomation(
  entry: HistoricalOverrideEntry,
  patch: {
    applyAutomatically?: boolean;
    hideBannerPermanently?: boolean;
    automationApplyMode?: HistoricalOverrideAutomationApplyMode;
  },
): HistoricalOverrideEntry | null {
  const key = historicalEntryKey(entry);
  const entries = readEntries();
  const idx = entries.findIndex((e) => historicalEntryKey(e) === key);
  if (idx < 0) return null;

  const current = entries[idx];
  const next: HistoricalOverrideEntry = {
    ...current,
    applyAutomatically:
      patch.applyAutomatically !== undefined
        ? patch.applyAutomatically
        : current.applyAutomatically ?? false,
    hideBannerPermanently:
      patch.hideBannerPermanently !== undefined
        ? patch.hideBannerPermanently
        : current.hideBannerPermanently ?? false,
    automationApplyMode:
      patch.automationApplyMode !== undefined
        ? patch.automationApplyMode
        : current.automationApplyMode,
    updatedAt: Date.now(),
  };

  const result = upsertHistoricalOverrideEntry(next, { excludeKeys: [key], silent: true });
  if (result.ok) {
    dispatchHistoricalUpdated({ automationOnly: true });
  }
  return result.ok ? result.entry : null;
}

export function resolveBannerCheckboxDefaults(
  context: HistoricalOverrideBannerContext,
): HistoricalOverrideBannerOptions {
  const { rateEntry, feeEntry } = context;
  const scoped = [rateEntry, feeEntry].filter((e): e is HistoricalOverrideEntry => e != null);

  return {
    applyAutomatically:
      rateEntry?.applyAutomatically === true || feeEntry?.applyAutomatically === true,
    hideBannerPermanently:
      scoped.length > 0 && scoped.every((e) => e.hideBannerPermanently === true),
  };
}

export function applyBannerAutomationFromChoice(
  choice: HistoricalOverrideAutomationApplyMode,
  context: HistoricalOverrideBannerContext,
  options: HistoricalOverrideBannerOptions,
): HistoricalOverrideEntry[] {
  const { rateEntry, feeEntry } = context;

  // Checkbox 1 — persist future auto-apply per granularity (independent of banner suppression).
  const applyAutoForRate =
    choice !== 'none' && options.applyAutomatically && (choice === 'both' || choice === 'rateOnly');
  const applyAutoForFee =
    choice !== 'none' && options.applyAutomatically && (choice === 'both' || choice === 'feeOnly');

  // Checkbox 2 — only controls hideBannerPermanently (UI visibility on next selection).
  const hideBannerPermanently = options.hideBannerPermanently;

  const updated: HistoricalOverrideEntry[] = [];

  if (rateEntry) {
    const patched = patchHistoricalOverrideEntryAutomation(rateEntry, {
      applyAutomatically: applyAutoForRate,
      hideBannerPermanently,
      automationApplyMode:
        choice === 'none'
          ? 'none'
          : choice === 'both' || choice === 'rateOnly'
            ? choice
            : rateEntry.automationApplyMode,
    });
    if (patched) updated.push(patched);
  }

  if (feeEntry) {
    const rateKey = rateEntry ? historicalEntryKey(rateEntry) : null;
    if (!rateKey || historicalEntryKey(feeEntry) !== rateKey) {
      const patched = patchHistoricalOverrideEntryAutomation(feeEntry, {
        applyAutomatically: applyAutoForFee,
        hideBannerPermanently,
        automationApplyMode:
          choice === 'none'
            ? 'none'
            : choice === 'both' || choice === 'feeOnly'
              ? choice
              : feeEntry.automationApplyMode,
      });
      if (patched) updated.push(patched);
    }
  }

  return updated;
}

export function appliedFromHistoricalChoice(
  choice: HistoricalOverrideAutomationApplyMode,
  context: HistoricalOverrideBannerContext,
): NewExpenseHistoricalApplied {
  const { rateEntry, feeEntry } = context;

  switch (choice) {
    case 'both':
      return {
        rateEntry: rateEntry && entryHasRate(rateEntry) ? rateEntry : null,
        feeEntry: feeEntry && entryHasFee(feeEntry) ? feeEntry : null,
      };
    case 'rateOnly':
      return {
        rateEntry: rateEntry && entryHasRate(rateEntry) ? rateEntry : null,
        feeEntry: null,
      };
    case 'feeOnly':
      return {
        rateEntry: null,
        feeEntry: feeEntry && entryHasFee(feeEntry) ? feeEntry : null,
      };
    case 'none':
      return EMPTY_HISTORICAL_APPLIED;
    default:
      return EMPTY_HISTORICAL_APPLIED;
  }
}

/** Infer banner granularity from the entries currently driving the expense form. */
export function inferHistoricalChoiceFromApplied(
  applied: NewExpenseHistoricalApplied,
): HistoricalOverrideAutomationApplyMode {
  const hasRate = applied.rateEntry != null && entryHasRate(applied.rateEntry);
  const hasFee = applied.feeEntry != null && entryHasFee(applied.feeEntry);
  if (hasRate && hasFee) return 'both';
  if (hasRate) return 'rateOnly';
  if (hasFee) return 'feeOnly';
  return 'none';
}

export function historicalAppliedContextFromEntries(
  applied: NewExpenseHistoricalApplied,
): HistoricalOverrideBannerContext | null {
  if (!applied.rateEntry && !applied.feeEntry) return null;
  return { rateEntry: applied.rateEntry, feeEntry: applied.feeEntry };
}

/**
 * Resolve which historical entries drive conversion on submit.
 * - Explicit banner click (lastChoice) → current applied snapshot.
 * - Banner open, ignored → auto-prefill only if present, else live defaults.
 * - Banner closed → use applied auto-apply snapshot if any.
 */
export function resolveHistoricalAppliedForSubmit(
  banner: HistoricalOverrideBannerContext | null,
  applied: NewExpenseHistoricalApplied,
  lastChoice: HistoricalOverrideAutomationApplyMode | null,
): NewExpenseHistoricalApplied {
  if (lastChoice !== null) {
    return applied;
  }

  const hasApplied = applied.rateEntry != null || applied.feeEntry != null;
  if (banner != null) {
    return hasApplied ? applied : EMPTY_HISTORICAL_APPLIED;
  }

  return hasApplied ? applied : EMPTY_HISTORICAL_APPLIED;
}

export function resolveHistoricalRateToIls(
  entry: HistoricalOverrideEntry,
  expenseCurrency: ExpenseCurrency,
): number | null {
  if (!entry.manualRate || !(entry.manualRate > 0)) return null;
  if (expenseCurrency === 'ILS') return 1;

  const normalized = normalizeHistoricalRateEntry(entry);
  const { fromCurrency, toCurrency, manualRate } = normalized;

  // Stored rate: 1 fromCurrency = manualRate × toCurrency (canonical alphabetical direction).
  if (fromCurrency === expenseCurrency && toCurrency === 'ILS') {
    return manualRate;
  }
  if (toCurrency === expenseCurrency && fromCurrency === 'ILS') {
    return manualRate != null && manualRate > 0 ? 1 / manualRate : null;
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

export function updateHistoricalOverrideEntry(
  previous: HistoricalOverrideEntry,
  updated: HistoricalOverrideEntry,
): HistoricalOverrideWriteResult {
  const failure = validateHistoricalOverrideUpdate(previous, updated);
  if (failure) return { ok: false, reason: failure };

  const entries = readEntries();
  const prevKey = historicalEntryKey(previous);
  const keysToRemove = new Set<string>([prevKey]);
  if (entryHasRate(previous)) {
    const normalizedPrev = normalizeHistoricalRateEntry(previous);
    keysToRemove.add(historicalEntryKey(normalizedPrev));
    keysToRemove.add(
      `rate__${previous.startDate}__${previous.endDate}__${previous.toCurrency}__${previous.fromCurrency}`,
    );
  }
  const withoutPrevious = entries.filter((e) => !keysToRemove.has(historicalEntryKey(e)));

  const nextEntry: HistoricalOverrideEntry = {
    ...normalizeEntryForWrite(updated)!,
    updatedAt: Date.now(),
  };

  const nextKey = historicalEntryKey(nextEntry);
  const withoutConflict = withoutPrevious.filter((e) => historicalEntryKey(e) !== nextKey);
  withoutConflict.push(nextEntry);
  writeEntries(withoutConflict);
  dispatchHistoricalUpdated();
  return { ok: true, entry: nextEntry };
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
    const normalizedCloud = entryHasRate(cloudEntry)
      ? normalizeHistoricalRateEntry(cloudEntry)
      : cloudEntry;
    const cloudKey = historicalEntryKey(normalizedCloud);
    const idx = merged.findIndex((e) => historicalEntryKey(e) === cloudKey);
    if (idx >= 0) {
      if (normalizedCloud.updatedAt >= merged[idx].updatedAt) {
        merged[idx] = normalizedCloud;
      }
    } else {
      merged.push(normalizedCloud);
    }
  }

  writeEntries(merged);
  dispatchHistoricalUpdated();
}
