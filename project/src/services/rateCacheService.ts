/**
 * ============================================================================
 *  OFFLINE-FIRST EXCHANGE RATE CACHE & FALLBACK STRATEGY
 * ============================================================================
 *
 * A single, unified rate ledger keyed per DATE and per CURRENCY PAIR that powers
 * every conversion in the app while minimizing API usage and enabling full
 * offline operation.
 *
 * ── Unified storage schema ─────────────────────────────────────────────────
 * Each entry is keyed `YYYY-MM-DD_FROM_TO` and keeps three DISTINCT fields:
 *
 *   { apiRate: number | null, lastFetched: string | null (ISO), manualRate: number | null }
 *
 * `apiRate` + `lastFetched` are owned by the API-fetch layer; `manualRate`
 * mirrors the user's manual override (single source of truth lives in
 * `manualExchangeOverrideService`) so the unified entry is fully self-describing
 * and resolvable offline. Guests persist to localStorage; authenticated users
 * additionally persist/merge through Firebase (wired by `useRateCacheSync`).
 *
 * ── Non-destructive resolution priority ────────────────────────────────────
 *   P1  manualRate present (≠ null)        → ALWAYS used for the UI.
 *   P2  manualRate null & apiRate valid     → use cached apiRate.
 *   P3  no/expired apiRate                  → fetch live (or fall back offline).
 *
 * ── 24h TTL & background refresh ───────────────────────────────────────────
 * For the live (today) date, an `apiRate` older than 24h is stale and triggers
 * a refresh. Crucially, refresh happens EVEN while a manualRate is active
 * (background updating), so deleting the manual override instantly falls back on
 * a fresh, accurate real-world rate. Historical dates are immutable: once an
 * `apiRate` is stored for a past date it never expires.
 *
 * ── Offline-first resilience ───────────────────────────────────────────────
 * Because every fetched rate is indexed locally (and in the cloud for members),
 * `resolveRate` always returns the best available number without the network —
 * a fresh cache hit, or a stale-but-usable last-known `apiRate` — and only marks
 * `needsRefresh` so callers can opportunistically update when connectivity
 * returns. API failures never throw to the UI.
 * ============================================================================
 */

import { isSupportedCurrency, type ExpenseCurrency } from '../constants/currencies';
import {
  computeDirectUnitRateFromIlsPivot,
  fetchExchangeRates,
  fetchHistoricalDirectRate,
  getCachedExchangeRates,
  getLocalTodayIso,
  type ExchangeRates,
} from './exchangeRateService';
import { getManualExchangeOverride } from './manualExchangeOverrideService';

const STORAGE_KEY = 'unified_rate_cache_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RATE_CACHE_UPDATED_EVENT = 'rate-cache-updated';

/** Unified per-date, per-pair rate entry (the persisted schema). */
export interface RateCacheEntry {
  /** Last real API rate (1 FROM = apiRate TO). `null` until first fetched. */
  apiRate: number | null;
  /** ISO timestamp of the last successful API fetch (`null` until fetched). */
  lastFetched: string | null;
  /** Active manual override rate, or `null` when none is set. */
  manualRate: number | null;
}

export type RateCacheStore = Record<string, RateCacheEntry>;

export type RateResolutionSource = 'manual' | 'cache' | 'stale-cache' | 'none';

export interface RateResolution {
  /** Best available rate per the priority flow, or `null` if nothing is known. */
  rate: number | null;
  /** Which tier produced `rate`. */
  source: RateResolutionSource;
  /**
   * True when the API rate should be (re)fetched — missing, or older than 24h on
   * the live date. Set even when a manual rate is winning (background refresh).
   */
  needsRefresh: boolean;
  /** The raw entry backing this pair/date (after manual mirroring). */
  entry: RateCacheEntry;
}

// ───────────────────────── In-memory + localStorage ────────────────────────

let memoryStore: RateCacheStore | null = null;
const pendingFetches = new Map<string, Promise<number | null>>();

function dispatchUpdated(): void {
  try {
    window.dispatchEvent(new CustomEvent(RATE_CACHE_UPDATED_EVENT));
  } catch {
    // SSR / non-DOM contexts — ignore.
  }
}

export function subscribeRateCacheUpdated(listener: () => void): () => void {
  window.addEventListener(RATE_CACHE_UPDATED_EVENT, listener);
  return () => window.removeEventListener(RATE_CACHE_UPDATED_EVENT, listener);
}

function isValidEntry(value: unknown): value is RateCacheEntry {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  const apiRateOk = e.apiRate === null || (typeof e.apiRate === 'number' && e.apiRate > 0);
  const lastFetchedOk = e.lastFetched === null || typeof e.lastFetched === 'string';
  const manualOk = e.manualRate === null || (typeof e.manualRate === 'number' && e.manualRate > 0);
  return apiRateOk && lastFetchedOk && manualOk;
}

/** Normalize an arbitrary object into a clean {@link RateCacheStore}. */
export function parseRateCacheStore(raw: unknown): RateCacheStore {
  if (!raw || typeof raw !== 'object') return {};
  const out: RateCacheStore = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isValidEntry(value)) continue;
    const e = value as RateCacheEntry;
    out[key] = {
      apiRate: e.apiRate ?? null,
      lastFetched: e.lastFetched ?? null,
      manualRate: e.manualRate ?? null,
    };
  }
  return out;
}

function readStore(): RateCacheStore {
  if (memoryStore) return memoryStore;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    memoryStore = raw ? parseRateCacheStore(JSON.parse(raw)) : {};
  } catch {
    memoryStore = {};
  }
  return memoryStore;
}

function writeStore(store: RateCacheStore, notify = true): void {
  memoryStore = store;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota / private-mode — in-memory copy still serves this session.
  }
  if (notify) dispatchUpdated();
}

/** Snapshot of the entire store (for cloud serialization). */
export function getRateCacheSnapshot(): RateCacheStore {
  return { ...readStore() };
}

// ───────────────────────── Keys & date helpers ─────────────────────────────

function clampToTodayIfFuture(dateIso: string): string {
  const today = getLocalTodayIso();
  return dateIso > today ? today : dateIso;
}

export function buildRateKey(dateIso: string, from: string, to: string): string {
  return `${dateIso}_${from}_${to}`;
}

function isLiveDate(dateIso: string): boolean {
  return dateIso === getLocalTodayIso();
}

/** Whether a stored `apiRate` is still trustworthy for this date. */
function isApiRateFresh(dateIso: string, entry: RateCacheEntry): boolean {
  if (entry.apiRate == null || !(entry.apiRate > 0)) return false;
  if (!isLiveDate(dateIso)) {
    // Historical dates are immutable — any stored API rate is permanently valid.
    return true;
  }
  if (!entry.lastFetched) return false;
  const fetchedAt = Date.parse(entry.lastFetched);
  if (!Number.isFinite(fetchedAt)) return false;
  return Date.now() - fetchedAt < CACHE_TTL_MS;
}

function emptyEntry(): RateCacheEntry {
  return { apiRate: null, lastFetched: null, manualRate: null };
}

// ───────────────────────── Read / resolve ──────────────────────────────────

/**
 * Read the stored entry for a pair/date. Manual overrides are strictly scoped
 * to the live (today) context: only today's resolution mirrors the active
 * override. Historical dates use the manual rate explicitly stored under THAT
 * date key (normally none) — so a manual rate defined today never retroactively
 * alters a past date. Also checks the inverse pair so one direction populates
 * both ways.
 */
function readEntryWithInverse(
  dateIso: string,
  from: ExpenseCurrency,
  to: ExpenseCurrency,
): RateCacheEntry {
  const store = readStore();
  const live = isLiveDate(dateIso);

  const direct = store[buildRateKey(dateIso, from, to)];
  if (direct) {
    return {
      ...direct,
      manualRate: live ? getManualExchangeOverride(from, to) : (direct.manualRate ?? null),
    };
  }

  const inverse = store[buildRateKey(dateIso, to, from)];
  if (inverse && inverse.apiRate && inverse.apiRate > 0) {
    const historicalManual =
      inverse.manualRate != null && inverse.manualRate > 0 ? 1 / inverse.manualRate : null;
    return {
      apiRate: 1 / inverse.apiRate,
      lastFetched: inverse.lastFetched,
      manualRate: live ? getManualExchangeOverride(from, to) : historicalManual,
    };
  }

  return { ...emptyEntry(), manualRate: live ? getManualExchangeOverride(from, to) : null };
}

/**
 * Synchronous, offline-first resolution following the strict priority flow.
 * Never performs network I/O. Use {@link ensureRate} to (re)fetch.
 */
export function resolveRate(
  dateIso: string,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
): RateResolution {
  if (fromCurrency === toCurrency) {
    return { rate: 1, source: 'cache', needsRefresh: false, entry: emptyEntry() };
  }
  if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) {
    return { rate: null, source: 'none', needsRefresh: false, entry: emptyEntry() };
  }

  const safeDate = clampToTodayIfFuture(dateIso);
  const entry = readEntryWithInverse(safeDate, fromCurrency, toCurrency);
  const fresh = isApiRateFresh(safeDate, entry);
  // Background-refresh requirement: live date always wants a fresh API rate when
  // the cache is missing or older than 24h — regardless of an active manual rate.
  const needsRefresh = !fresh;

  // P1 — Manual override always wins for the displayed value.
  if (entry.manualRate != null && entry.manualRate > 0) {
    return { rate: entry.manualRate, source: 'manual', needsRefresh, entry };
  }

  // P2 — Valid cached API rate.
  if (fresh) {
    return { rate: entry.apiRate, source: 'cache', needsRefresh: false, entry };
  }

  // P3 — Nothing fresh. Offline-first: still surface a stale API rate if we have
  // one so the UI never breaks; mark needsRefresh so callers can update later.
  if (entry.apiRate != null && entry.apiRate > 0) {
    return { rate: entry.apiRate, source: 'stale-cache', needsRefresh: true, entry };
  }

  return { rate: null, source: 'none', needsRefresh: true, entry };
}

/** Synchronous best-effort rate (manual → fresh cache → stale cache → null). */
export function getRate(
  dateIso: string,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
): number | null {
  return resolveRate(dateIso, fromCurrency, toCurrency).rate;
}

/**
 * Read ONLY the stored `apiRate` for a date/pair — never the mirrored manual
 * override. Used when an expense explicitly opts out of manual rates and must
 * resolve from the date-scoped historical API snapshot.
 */
export function getApiRateForDate(
  dateIso: string,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
): number | null {
  if (fromCurrency === toCurrency) return 1;
  const safeDate = clampToTodayIfFuture(dateIso);
  const store = readStore();
  const direct = store[buildRateKey(safeDate, fromCurrency, toCurrency)];
  if (direct?.apiRate != null && direct.apiRate > 0) return direct.apiRate;
  const inverse = store[buildRateKey(safeDate, toCurrency, fromCurrency)];
  if (inverse?.apiRate != null && inverse.apiRate > 0) return 1 / inverse.apiRate;
  return null;
}

// ───────────────────────── Write / fetch ───────────────────────────────────

/** Persist a freshly fetched API rate (and stamp `lastFetched`). */
export function recordApiRate(
  dateIso: string,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
  apiRate: number,
  fetchedAtIso: string = new Date().toISOString(),
): void {
  if (!(apiRate > 0) || fromCurrency === toCurrency) return;
  const safeDate = clampToTodayIfFuture(dateIso);
  const store = { ...readStore() };
  const key = buildRateKey(safeDate, fromCurrency, toCurrency);
  // Only the live (today) entry mirrors the active manual override. Historical
  // entries keep their own (normally null) manualRate untouched, so today's
  // manual rate can never leak onto a past date.
  const manualRate = isLiveDate(safeDate)
    ? getManualExchangeOverride(fromCurrency, toCurrency)
    : (store[key]?.manualRate ?? null);
  store[key] = {
    apiRate,
    lastFetched: fetchedAtIso,
    manualRate,
  };
  writeStore(store);
}

/**
 * Mirror the current manual override into the persisted entry so the unified
 * schema stays complete (and the cloud copy reflects manual state). Does NOT
 * touch `apiRate`/`lastFetched`. Safe to call whenever overrides change.
 */
export function syncManualRate(
  dateIso: string,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
): void {
  if (fromCurrency === toCurrency) return;
  const safeDate = clampToTodayIfFuture(dateIso);
  const manualRate = getManualExchangeOverride(fromCurrency, toCurrency);
  const store = { ...readStore() };
  const key = buildRateKey(safeDate, fromCurrency, toCurrency);
  const existing = store[key] ?? emptyEntry();
  if (existing.manualRate === manualRate) return;
  store[key] = { ...existing, manualRate };
  writeStore(store);
}

async function fetchApiRate(
  dateIso: string,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
): Promise<number | null> {
  // Live date: derive the direct rate from the cached/live ILS pivot snapshot —
  // this reuses the single daily ILS fetch instead of one call per pair.
  if (isLiveDate(dateIso)) {
    const live: ExchangeRates | null =
      getCachedExchangeRates() ?? (await fetchExchangeRates().catch(() => null));
    if (!live) return null;
    return computeDirectUnitRateFromIlsPivot(fromCurrency, toCurrency, live.ilsToForeign);
  }
  // Historical date: dedicated per-date provider (already cached downstream).
  return fetchHistoricalDirectRate(dateIso, fromCurrency, toCurrency).catch(() => null);
}

/**
 * Resolve a rate, performing a network refresh when the API rate is stale or
 * missing. The returned value still honors the manual-override priority (P1),
 * but a stale API rate is refreshed in the background so the fallback stays
 * fresh. Network failures resolve to the best offline value (never throw).
 *
 * De-duplicates concurrent fetches for the same key.
 */
export async function ensureRate(
  dateIso: string,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
): Promise<number | null> {
  const resolution = resolveRate(dateIso, fromCurrency, toCurrency);
  if (!resolution.needsRefresh) return resolution.rate;

  const safeDate = clampToTodayIfFuture(dateIso);
  const key = buildRateKey(safeDate, fromCurrency, toCurrency);

  let inflight = pendingFetches.get(key);
  if (!inflight) {
    inflight = (async () => {
      const apiRate = await fetchApiRate(safeDate, fromCurrency, toCurrency);
      if (apiRate != null && apiRate > 0) {
        recordApiRate(safeDate, fromCurrency, toCurrency, apiRate);
      }
      return apiRate;
    })().finally(() => pendingFetches.delete(key));
    pendingFetches.set(key, inflight);
  }

  const apiRate = await inflight;

  // Manual rate keeps priority for the displayed value even after refresh.
  if (resolution.source === 'manual') return resolution.rate;
  if (apiRate != null && apiRate > 0) return apiRate;
  // Offline / fetch failed — fall back to whatever we resolved synchronously.
  return resolution.rate;
}

/**
 * Background sweep: refresh every live-date entry whose API rate is stale or
 * missing, including pairs currently masked by a manual override. Returns the
 * number of entries refreshed. Safe to call on app start / focus / reconnect.
 */
export async function refreshStaleLiveRates(): Promise<number> {
  const today = getLocalTodayIso();
  const store = readStore();
  const targets: Array<{ from: ExpenseCurrency; to: ExpenseCurrency }> = [];

  for (const key of Object.keys(store)) {
    if (!key.startsWith(`${today}_`)) continue;
    const [, from, to] = key.split('_');
    if (!from || !to || !isSupportedCurrency(from) || !isSupportedCurrency(to)) continue;
    if (isApiRateFresh(today, store[key])) continue;
    targets.push({ from, to });
  }

  let refreshed = 0;
  await Promise.all(
    targets.map(async ({ from, to }) => {
      const apiRate = await fetchApiRate(today, from, to);
      if (apiRate != null && apiRate > 0) {
        recordApiRate(today, from, to, apiRate);
        refreshed += 1;
      }
    }),
  );
  return refreshed;
}

// ───────────────────────── Cloud merge (Firebase) ──────────────────────────

/**
 * Merge a remote store into the local one. Newest `lastFetched` wins for
 * `apiRate`; historical (immutable) entries are preserved. Manual rates are
 * re-mirrored from the local override service (the override service remains the
 * source of truth — the cloud rate cache only carries API history).
 */
export function mergeRemoteRateCache(remote: RateCacheStore): void {
  const local = { ...readStore() };
  let changed = false;

  for (const [key, remoteEntry] of Object.entries(remote)) {
    const localEntry = local[key];
    if (!localEntry) {
      local[key] = { ...remoteEntry };
      changed = true;
      continue;
    }
    const localTs = localEntry.lastFetched ? Date.parse(localEntry.lastFetched) : 0;
    const remoteTs = remoteEntry.lastFetched ? Date.parse(remoteEntry.lastFetched) : 0;
    if (remoteEntry.apiRate != null && remoteTs > localTs) {
      local[key] = {
        ...localEntry,
        apiRate: remoteEntry.apiRate,
        lastFetched: remoteEntry.lastFetched,
      };
      changed = true;
    }
  }

  if (changed) {
    // Re-mirror manual rates so merged entries stay schema-complete, without
    // re-broadcasting (the caller controls cloud write-back).
    writeStore(local, false);
    dispatchUpdated();
  }
}

/** Reset the in-memory cache (e.g. on sign-out) without clearing persisted history. */
export function resetRateCacheMemory(): void {
  memoryStore = null;
}

// ───────────────────────── Time Capsule v2 helpers ─────────────────────────

/**
 * Slice the unified store to every entry whose key starts with `${dateIso}_`.
 * Returns a new store containing only API-rate history (manualRate stripped to
 * null so live manual overrides never leak into a frozen expense snapshot).
 */
export function sliceRateCacheForDate(dateIso: string): RateCacheStore {
  const store = readStore();
  const prefix = `${dateIso}_`;
  const slice: RateCacheStore = {};
  for (const [key, entry] of Object.entries(store)) {
    if (!key.startsWith(prefix)) continue;
    // Strip any live-mirrored manual rate — capsule.manualRates is the sole source
    // of truth for manual overrides; the matrix only carries historical API rates.
    slice[key] = { apiRate: entry.apiRate, lastFetched: entry.lastFetched, manualRate: null };
  }
  return slice;
}

/**
 * For a transaction-date refresh (expense edit, date field changed): ensure that
 * every requested pair has an API rate in the global cache for `dateIso`, then
 * re-slice and return the updated matrix entries.
 *
 * Does NOT touch manual rates, fees, or any other capsule field — only the
 * historical API rate matrix is updated.
 */
export async function ensureHistoricalRatesForDate(
  dateIso: string,
  pairs: ReadonlyArray<{ from: ExpenseCurrency; to: ExpenseCurrency }>,
): Promise<RateCacheStore> {
  await Promise.allSettled(pairs.map(({ from, to }) => ensureRate(dateIso, from, to)));
  return sliceRateCacheForDate(dateIso);
}
