import { isSupportedCurrency, type ExpenseCurrency } from '../constants/currencies';

const STORAGE_KEY = 'money_manager_manual_exchange_overrides_v1';
const OVERRIDES_UPDATED_EVENT = 'manual-exchange-overrides-updated';
export const MANUAL_RATE_24H_MS = 24 * 60 * 60 * 1000;

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

export interface ManualExchangeOverrideEntry {
  id: string;
  baseCurrency: ExpenseCurrency;
  quoteCurrency: ExpenseCurrency;
  rate: number;
  isActive: boolean;
  updatedAt: number;
  /**
   * When true (default), this rate applies ONLY between baseCurrency ↔ quoteCurrency.
   * When false, all cross-currency projections use this entry as a general override.
   */
  pairSpecific: boolean;
  /** Unix ms — when set, entry auto-expires after this timestamp (24h local saves). */
  expiresAt?: number | null;
  /** True when synced from Firestore forever save (no local expiry). */
  cloudPersisted?: boolean;
}

/** Cloud shape persisted to / read from Firestore. */
export interface CloudManualExchangeOverride {
  id?: string;
  baseCurrency: ExpenseCurrency;
  quoteCurrency: ExpenseCurrency;
  rate: number;
  isActive?: boolean;
  updatedAt?: number;
  pairSpecific?: boolean;
  expiresAt?: number | null;
  cloudPersisted?: boolean;
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
      baseCurrency: fromCurrency as ExpenseCurrency,
      quoteCurrency: toCurrency as ExpenseCurrency,
      normalizedRate: rate,
    };
  }

  return {
    baseCurrency: toCurrency as ExpenseCurrency,
    quoteCurrency: fromCurrency as ExpenseCurrency,
    normalizedRate: 1 / rate,
  };
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Active and not past optional expiry timestamp. */
export function isManualOverrideEntryLive(
  entry: ManualExchangeOverrideEntry,
  now = Date.now(),
): boolean {
  if (!entry.isActive) return false;
  if (entry.expiresAt != null && entry.expiresAt <= now) return false;
  return true;
}

function parseExpiresAt(item: Record<string, unknown>): number | null | undefined {
  if (item.expiresAt === null) return null;
  if (typeof item.expiresAt === 'number' && Number.isFinite(item.expiresAt)) return item.expiresAt;
  return undefined;
}

function dispatchOverridesUpdated(): void {
  window.dispatchEvent(new CustomEvent(OVERRIDES_UPDATED_EVENT));
}

export function subscribeManualOverridesUpdated(listener: () => void): () => void {
  window.addEventListener(OVERRIDES_UPDATED_EVENT, listener);
  return () => window.removeEventListener(OVERRIDES_UPDATED_EVENT, listener);
}

/**
 * Parse stored entries, migrating legacy `source/expiresAt` shape to `isActive`.
 * Legacy `local_24h` entries become inactive if expired, active if still fresh.
 * Legacy `cloud` entries become isActive: true.
 */
function safeParseEntries(raw: string | null): ManualExchangeOverrideEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();

    return parsed
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item): ManualExchangeOverrideEntry | null => {
        const baseCurrency = item.baseCurrency;
        const quoteCurrency = item.quoteCurrency;
        const rate = item.rate;
        const updatedAt = item.updatedAt;

        if (
          typeof baseCurrency !== 'string' ||
          typeof quoteCurrency !== 'string' ||
          !isSupportedCurrency(baseCurrency) ||
          !isSupportedCurrency(quoteCurrency) ||
          baseCurrency === quoteCurrency ||
          typeof rate !== 'number' ||
          !isFinitePositive(rate) ||
          typeof updatedAt !== 'number'
        ) {
          return null;
        }

        // Resolve isActive — new field takes priority; migrate legacy source/expiresAt
        let isActive: boolean;
        if (typeof item.isActive === 'boolean') {
          isActive = item.isActive;
        } else {
          // Legacy migration
          const source = item.source;
          const expiresAt = item.expiresAt;
          if (source === 'local_24h') {
            isActive = typeof expiresAt === 'number' ? expiresAt > now : false;
          } else {
            isActive = true; // cloud entries were always active
          }
        }

        const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : generateId();
        const parsedExpiresAt = parseExpiresAt(item);
        const legacySource = item.source;
        const cloudPersisted =
          item.cloudPersisted === true ||
          legacySource === 'cloud';

        return {
          id,
          baseCurrency: baseCurrency as ExpenseCurrency,
          quoteCurrency: quoteCurrency as ExpenseCurrency,
          rate,
          isActive,
          updatedAt,
          pairSpecific: item.pairSpecific !== false,
          ...(parsedExpiresAt !== undefined ? { expiresAt: parsedExpiresAt } : {}),
          ...(cloudPersisted ? { cloudPersisted: true } : {}),
        };
      })
      .filter((e): e is ManualExchangeOverrideEntry => e !== null);
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

// ── Public read API ────────────────────────────────────────────────────────

/** All stored entries (active + inactive) sorted newest first. */
export function listAllManualExchangeOverrides(): ManualExchangeOverrideEntry[] {
  return readEntries().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Only isActive, non-expired entries sorted newest first. */
export function listActiveManualExchangeOverrides(): ManualExchangeOverrideEntry[] {
  const now = Date.now();
  return readEntries()
    .filter((e) => isManualOverrideEntryLive(e, now))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Only archived (inactive) entries sorted newest first. */
export function listArchivedManualExchangeOverrides(): ManualExchangeOverrideEntry[] {
  return readEntries()
    .filter((e) => !e.isActive)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Resolve the active override rate for a specific pair, respecting pairSpecific scope.
 *
 * Resolution order:
 *  1. Pair-specific active entry exactly matching `from → to` (or inverse).
 *  2. Global active entry (pairSpecific === false) matching `from → to` (or inverse) as a fallback.
 *
 * Returns null if no applicable active override is found.
 */
export function getManualExchangeOverrideForPair(
  fromCurrency: string,
  toCurrency: string,
): number | null {
  if (fromCurrency === toCurrency) return null;
  if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) return null;

  const entries = readEntries().filter((e) => isManualOverrideEntryLive(e));
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

  // Phase 2: global override (pairSpecific === false)
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

/** Alias kept for callers that use the original name. */
export function getManualExchangeOverride(fromCurrency: string, toCurrency: string): number | null {
  return getManualExchangeOverrideForPair(fromCurrency, toCurrency);
}

/** Active override for a pair including metadata (used by simulator display). */
export function getActiveManualExchangeOverrideSnapshot(
  fromCurrency: string,
  toCurrency: string,
): { rate: number; updatedAt: number; pairSpecific: boolean; expiresAt?: number | null; cloudPersisted?: boolean } | null {
  if (fromCurrency === toCurrency) return null;
  if (!isSupportedCurrency(fromCurrency) || !isSupportedCurrency(toCurrency)) return null;

  const entries = readEntries().filter((e) => isManualOverrideEntryLive(e));
  const from = fromCurrency as ExpenseCurrency;
  const to = toCurrency as ExpenseCurrency;

  const direct = entries.find((e) => e.baseCurrency === from && e.quoteCurrency === to);
  if (direct) {
    return {
      rate: direct.rate,
      updatedAt: direct.updatedAt,
      pairSpecific: direct.pairSpecific,
      expiresAt: direct.expiresAt,
      cloudPersisted: direct.cloudPersisted,
    };
  }

  const inverse = entries.find((e) => e.baseCurrency === to && e.quoteCurrency === from);
  if (inverse) {
    return {
      rate: 1 / inverse.rate,
      updatedAt: inverse.updatedAt,
      pairSpecific: inverse.pairSpecific,
      expiresAt: inverse.expiresAt,
      cloudPersisted: inverse.cloudPersisted,
    };
  }

  return null;
}

export function hasActiveManualOverrideForPair(fromCurrency: string, toCurrency: string): boolean {
  return getManualExchangeOverrideForPair(fromCurrency, toCurrency) != null;
}

// ── Write API ──────────────────────────────────────────────────────────────

/**
 * Upsert a manual rate override. Creates a new record with isActive: true.
 * Any other active record for the same canonical pair is deactivated
 * to prevent ambiguous lookups.
 */
export function upsertManualExchangeOverride(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  pairSpecific = true,
  options?: { expiresAt?: number | null; cloudPersisted?: boolean },
): ManualExchangeOverrideEntry | null {
  const normalized = normalizePair(fromCurrency, toCurrency, rate);
  if (!normalized) return null;

  const entries = readEntries();
  const now = Date.now();

  // Deactivate any existing active entry for this exact canonical pair
  const deactivated = entries.map((entry) => {
    if (
      entry.isActive &&
      entry.baseCurrency === normalized.baseCurrency &&
      entry.quoteCurrency === normalized.quoteCurrency
    ) {
      return { ...entry, isActive: false };
    }
    return entry;
  });

  const newEntry: ManualExchangeOverrideEntry = {
    id: generateId(),
    baseCurrency: normalized.baseCurrency,
    quoteCurrency: normalized.quoteCurrency,
    rate: normalized.normalizedRate,
    isActive: true,
    updatedAt: now,
    pairSpecific,
    expiresAt: options?.expiresAt ?? null,
    cloudPersisted: options?.cloudPersisted ?? false,
  };

  deactivated.push(newEntry);
  writeEntries(deactivated);
  dispatchOverridesUpdated();
  return newEntry;
}

/** Toggle a stored entry's active state by id. */
export function setManualOverrideActive(id: string, active: boolean): boolean {
  const entries = readEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return false;

  const entry = entries[idx]!;

  if (active) {
    // Deactivate any other active entry for the same pair before activating this one
    for (let i = 0; i < entries.length; i++) {
      if (
        i !== idx &&
        entries[i]!.isActive &&
        entries[i]!.baseCurrency === entry.baseCurrency &&
        entries[i]!.quoteCurrency === entry.quoteCurrency
      ) {
        entries[i] = { ...entries[i]!, isActive: false };
      }
    }
  }

  entries[idx] = { ...entry, isActive: active, updatedAt: Date.now() };
  writeEntries(entries);
  dispatchOverridesUpdated();
  return true;
}

/** Permanently delete a stored entry by id. */
export function deleteManualExchangeOverride(id: string): boolean {
  const entries = readEntries();
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) return false;
  writeEntries(next);
  dispatchOverridesUpdated();
  return true;
}

/**
 * Archive (soft-delete) an active entry by id — sets `isActive: false`.
 * The entry stays in storage and appears in the Historical Log.
 */
export function archiveManualExchangeOverride(id: string): boolean {
  return setManualOverrideActive(id, false);
}

/**
 * Reactivate an archived entry by creating a fresh active record from it.
 * Uses `upsertManualExchangeOverride` so any existing active entry for the
 * same pair is automatically deactivated first.
 */
export function reactivateManualExchangeOverride(
  entry: ManualExchangeOverrideEntry,
): ManualExchangeOverrideEntry | null {
  return upsertManualExchangeOverride(
    entry.baseCurrency,
    entry.quoteCurrency,
    entry.rate,
    entry.pairSpecific,
  );
}

// ── Legacy compatibility wrappers (used by ExchangeRateSimulator and Firebase sync) ──

/**
 * @deprecated Use `upsertManualExchangeOverride` directly.
 * Saves as an active record (replaces 24h concept).
 */
export function saveManualExchangeOverride24h(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  pairSpecific = true,
): boolean {
  return (
    upsertManualExchangeOverride(fromCurrency, toCurrency, rate, pairSpecific, {
      expiresAt: Date.now() + MANUAL_RATE_24H_MS,
      cloudPersisted: false,
    }) != null
  );
}

/**
 * @deprecated Use `upsertManualExchangeOverride` directly.
 */
export function upsertCloudManualExchangeOverride(
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
  rate: number,
  pairSpecific = true,
): boolean {
  return (
    upsertManualExchangeOverride(fromCurrency, toCurrency, rate, pairSpecific, {
      expiresAt: null,
      cloudPersisted: true,
    }) != null
  );
}

/**
 * Merge cloud overrides into local storage on login.
 * Cloud entries are merged by canonical pair (baseCurrency+quoteCurrency).
 * A cloud entry with a newer updatedAt supersedes the matching local entry.
 */
export function replaceCloudManualExchangeOverrides(
  cloudOverrides: CloudManualExchangeOverride[],
): void {
  const now = Date.now();
  const local = readEntries();

  const merged = [...local];

  for (const cloud of cloudOverrides) {
    if (!isFinitePositive(cloud.rate) || cloud.baseCurrency === cloud.quoteCurrency) continue;
    if (!isSupportedCurrency(cloud.baseCurrency) || !isSupportedCurrency(cloud.quoteCurrency)) continue;

    const cloudUpdatedAt = cloud.updatedAt ?? now;
    const cloudIsActive = cloud.isActive !== false; // default to active if not specified (legacy)
    const cloudId = cloud.id ?? generateId();

    const existingIdx = merged.findIndex(
      (e) => e.baseCurrency === cloud.baseCurrency && e.quoteCurrency === cloud.quoteCurrency,
    );

    if (existingIdx >= 0) {
      const existing = merged[existingIdx]!;
      if (cloudUpdatedAt >= existing.updatedAt) {
        merged[existingIdx] = {
          ...existing,
          id: existing.id, // keep local id
          rate: cloud.rate,
          isActive: cloudIsActive,
          pairSpecific: cloud.pairSpecific !== false,
          updatedAt: cloudUpdatedAt,
          expiresAt: cloud.expiresAt ?? null,
          cloudPersisted: cloud.cloudPersisted ?? true,
        };
      }
    } else {
      merged.push({
        id: cloudId,
        baseCurrency: cloud.baseCurrency,
        quoteCurrency: cloud.quoteCurrency,
        rate: cloud.rate,
        isActive: cloudIsActive,
        pairSpecific: cloud.pairSpecific !== false,
        updatedAt: cloudUpdatedAt,
        expiresAt: cloud.expiresAt ?? null,
        cloudPersisted: cloud.cloudPersisted ?? true,
      });
    }
  }

  writeEntries(merged);
  dispatchOverridesUpdated();
}

/**
 * @deprecated Kept for cleanup on sign-out. Removes a specific entry by pair.
 */
export function removeCloudManualExchangeOverride(
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
): boolean {
  const normalized = normalizePair(fromCurrency, toCurrency, 1);
  if (!normalized) return false;

  const entries = readEntries();
  const next = entries.filter(
    (e) => !(e.baseCurrency === normalized.baseCurrency && e.quoteCurrency === normalized.quoteCurrency),
  );
  if (next.length === entries.length) return false;
  writeEntries(next);
  dispatchOverridesUpdated();
  return true;
}

export function clearAllManualExchangeOverridesLocal(): void {
  lsDelete(STORAGE_KEY);
  resetInMemoryFallback();
  dispatchOverridesUpdated();
}

/** Alias for sign-out cleanup — clears all local override entries. */
export function clearCloudManualExchangeOverrides(): void {
  clearAllManualExchangeOverridesLocal();
}

/** @deprecated No longer needed — kept for call-site compatibility. */
export function hasAnyActive24hManualOverride(): boolean {
  return listActiveManualExchangeOverrides().length > 0;
}

/** @deprecated Use `deleteManualExchangeOverride` by id. */
export function removeLocalManualExchangeOverride(fromCurrency: string, toCurrency: string): boolean {
  const normalized = normalizePair(fromCurrency, toCurrency, 1);
  if (!normalized) return false;

  const entries = readEntries();
  const entry = entries.find(
    (e) => e.baseCurrency === normalized.baseCurrency && e.quoteCurrency === normalized.quoteCurrency,
  );
  if (!entry) return false;
  return deleteManualExchangeOverride(entry.id);
}

/** @deprecated Legacy type alias — no longer used in new code. */
export type ManualRateSaveMode = '24h' | 'forever';
/** @deprecated Legacy type — no longer used in new code. */
export type ManualOverrideSource = 'local_24h' | 'cloud';
