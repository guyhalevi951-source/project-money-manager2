import { isSupportedCurrency, type ExpenseCurrency } from '../constants/currencies';

const STORAGE_KEY = 'money_manager_currency_commissions_v1';
const COMMISSIONS_UPDATED_EVENT = 'currency-commissions-updated';

/** Applies the saved fee to every expense/conversion currency (including ILS). */
export const GLOBAL_COMMISSION_CURRENCY = 'ALL' as const;

export type CommissionCurrency = ExpenseCurrency | typeof GLOBAL_COMMISSION_CURRENCY;

/**
 * Safe localStorage helpers with an in-memory fallback.
 * On iOS Safari private mode and some mobile WebViews, localStorage.setItem
 * throws a SecurityError or QuotaExceededError.
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

export interface CurrencyCommissionEntry {
  id: string;
  currency: CommissionCurrency;
  percent: number;
  isActive: boolean;
  updatedAt: number;
}

/** Cloud shape persisted to / read from Firestore. */
export interface CloudCurrencyCommission {
  id?: string;
  currency: CommissionCurrency;
  percent: number;
  isActive?: boolean;
  updatedAt?: number;
}

function isFinitePercent(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 100;
}

function isValidCommissionCurrency(currency: string): currency is CommissionCurrency {
  if (currency === GLOBAL_COMMISSION_CURRENCY) return true;
  return isSupportedCurrency(currency);
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function dispatchCommissionsUpdated(): void {
  window.dispatchEvent(new CustomEvent(COMMISSIONS_UPDATED_EVENT));
}

export function subscribeCurrencyCommissionsUpdated(listener: () => void): () => void {
  window.addEventListener(COMMISSIONS_UPDATED_EVENT, listener);
  return () => window.removeEventListener(COMMISSIONS_UPDATED_EVENT, listener);
}

/**
 * Parse stored entries, migrating legacy `source/expiresAt` shape to `isActive`.
 */
function safeParseEntries(raw: string | null): CurrencyCommissionEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();

    return parsed
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item): CurrencyCommissionEntry | null => {
        const currency = item.currency;
        const percent = item.percent;
        const updatedAt = item.updatedAt;

        if (
          typeof currency !== 'string' ||
          !isValidCommissionCurrency(currency) ||
          typeof percent !== 'number' ||
          !isFinitePercent(percent) ||
          typeof updatedAt !== 'number'
        ) {
          return null;
        }

        // Resolve isActive — new field takes priority; migrate legacy source/expiresAt
        let isActive: boolean;
        if (typeof item.isActive === 'boolean') {
          isActive = item.isActive;
        } else {
          const source = item.source;
          const expiresAt = item.expiresAt;
          if (source === 'local_24h') {
            isActive = typeof expiresAt === 'number' ? expiresAt > now : false;
          } else {
            isActive = true; // cloud entries were always active
          }
        }

        const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : generateId();

        return {
          id,
          currency: currency as CommissionCurrency,
          percent,
          isActive,
          updatedAt,
        };
      })
      .filter((e): e is CurrencyCommissionEntry => e !== null);
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

// ── Public read API ────────────────────────────────────────────────────────

export function normalizeCommissionCurrency(currency: string): CommissionCurrency | null {
  const code = currency.trim().toUpperCase();
  if (code === GLOBAL_COMMISSION_CURRENCY) return GLOBAL_COMMISSION_CURRENCY;
  if (!isSupportedCurrency(code)) return null;
  return code as CommissionCurrency;
}

/** All stored entries (active + inactive) sorted newest first. */
export function listAllCurrencyCommissions(): CurrencyCommissionEntry[] {
  return readEntries().slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Only isActive entries sorted newest first. */
export function listActiveCurrencyCommissions(): CurrencyCommissionEntry[] {
  return readEntries()
    .filter((e) => e.isActive)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Saved percent for an exact commission target (active only, no global fallback). */
export function getSavedCommissionPercentForCurrency(currency: CommissionCurrency): number | null {
  const normalized = normalizeCommissionCurrency(currency);
  if (!normalized) return null;
  const entry = readEntries().find((item) => item.currency === normalized && item.isActive);
  return entry?.percent ?? null;
}

/** Active fee for an expense/conversion currency (specific active entry, else global ALL). */
export function getActiveCurrencyCommissionPercent(currency: string): number | null {
  const code = currency.trim().toUpperCase();
  if (!isSupportedCurrency(code)) return null;

  const entries = readEntries().filter((e) => e.isActive);
  const specific = entries.find((item) => item.currency === code);
  if (specific) return specific.percent;

  const global = entries.find((item) => item.currency === GLOBAL_COMMISSION_CURRENCY);
  return global?.percent ?? null;
}

// ── Write API ──────────────────────────────────────────────────────────────

/**
 * Upsert a commission entry. Creates a new active record.
 * Any existing active record for the same currency is deactivated first.
 */
export function upsertCurrencyCommission(
  currency: CommissionCurrency,
  percent: number,
): CurrencyCommissionEntry | null {
  const normalized = normalizeCommissionCurrency(currency);
  if (!normalized || !isFinitePercent(percent)) return null;

  const entries = readEntries();
  const now = Date.now();

  // Deactivate any existing active entry for this currency
  const deactivated = entries.map((entry) => {
    if (entry.isActive && entry.currency === normalized) {
      return { ...entry, isActive: false };
    }
    return entry;
  });

  const newEntry: CurrencyCommissionEntry = {
    id: generateId(),
    currency: normalized,
    percent,
    isActive: true,
    updatedAt: now,
  };

  deactivated.push(newEntry);
  writeEntries(deactivated);
  dispatchCommissionsUpdated();
  return newEntry;
}

/** Toggle a stored entry's active state by id. */
export function setCurrencyCommissionActive(id: string, active: boolean): boolean {
  const entries = readEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return false;

  const entry = entries[idx]!;

  if (active) {
    // Deactivate any other active entry for the same currency
    for (let i = 0; i < entries.length; i++) {
      if (i !== idx && entries[i]!.isActive && entries[i]!.currency === entry.currency) {
        entries[i] = { ...entries[i]!, isActive: false };
      }
    }
  }

  entries[idx] = { ...entry, isActive: active, updatedAt: Date.now() };
  writeEntries(entries);
  dispatchCommissionsUpdated();
  return true;
}

/** Permanently delete a stored entry by id. */
export function deleteCurrencyCommission(id: string): boolean {
  const entries = readEntries();
  const next = entries.filter((e) => e.id !== id);
  if (next.length === entries.length) return false;
  writeEntries(next);
  dispatchCommissionsUpdated();
  return true;
}

// ── Legacy compatibility wrappers ──────────────────────────────────────────

/** @deprecated Use `upsertCurrencyCommission` directly. */
export function saveCurrencyCommission24h(currency: CommissionCurrency, percent: number): boolean {
  return upsertCurrencyCommission(currency, percent) != null;
}

/** @deprecated Use `upsertCurrencyCommission` directly. */
export function upsertCloudCurrencyCommission(
  currency: CommissionCurrency,
  percent: number,
): boolean {
  return upsertCurrencyCommission(currency, percent) != null;
}

/**
 * Merge cloud commissions into local storage on login.
 * Cloud entry with newer updatedAt supersedes matching local entry.
 */
export function replaceCloudCurrencyCommissions(cloudEntries: CloudCurrencyCommission[]): void {
  const now = Date.now();
  const local = readEntries();
  const merged = [...local];

  for (const cloud of cloudEntries) {
    const normalized = normalizeCommissionCurrency(cloud.currency);
    if (!normalized || !isFinitePercent(cloud.percent)) continue;

    const cloudUpdatedAt = cloud.updatedAt ?? now;
    const cloudIsActive = cloud.isActive !== false;
    const cloudId = cloud.id ?? generateId();

    const existingIdx = merged.findIndex((e) => e.currency === normalized);
    if (existingIdx >= 0) {
      const existing = merged[existingIdx]!;
      if (cloudUpdatedAt >= existing.updatedAt) {
        merged[existingIdx] = {
          ...existing,
          percent: cloud.percent,
          isActive: cloudIsActive,
          updatedAt: cloudUpdatedAt,
        };
      }
    } else {
      merged.push({
        id: cloudId,
        currency: normalized,
        percent: cloud.percent,
        isActive: cloudIsActive,
        updatedAt: cloudUpdatedAt,
      });
    }
  }

  writeEntries(merged);
  dispatchCommissionsUpdated();
}

/** @deprecated Kept for sign-out cleanup. */
export function removeLocalCurrencyCommission(currency: CommissionCurrency): boolean {
  const normalized = normalizeCommissionCurrency(currency);
  if (!normalized) return false;
  const entries = readEntries();
  const entry = entries.find((e) => e.currency === normalized);
  if (!entry) return false;
  return deleteCurrencyCommission(entry.id);
}

/** @deprecated Kept for cleanup calls. */
export function removeCloudCurrencyCommissionLocal(currency: CommissionCurrency): boolean {
  return removeLocalCurrencyCommission(currency);
}

/** Alias for sign-out cleanup — clears all local commission entries. */
export function clearCloudCurrencyCommissions(): void {
  clearAllCurrencyCommissionsLocal();
}

export function clearAllCurrencyCommissionsLocal(): void {
  lsDelete(STORAGE_KEY);
  resetInMemoryFallback();
  dispatchCommissionsUpdated();
}

export function isGlobalCommissionCurrency(
  currency: CommissionCurrency,
): currency is typeof GLOBAL_COMMISSION_CURRENCY {
  return currency === GLOBAL_COMMISSION_CURRENCY;
}

/** @deprecated Legacy type alias. */
export type CommissionSource = 'local_24h' | 'cloud';
