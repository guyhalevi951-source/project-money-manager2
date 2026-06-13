import {
  EMPTY_USER_APP_DATA,
  type UserAppData,
} from '../userDataStorage';
import {
  EMPTY_USER_SETTINGS,
  type UserSettings,
} from './userFirebaseSync';
import type { ExpenseCurrency } from './exchangeRateService';
import { budgetDebug } from './budgetDebugTrace';
import { roundMoney } from './money';

export interface InitializePersonalBudgetSettingsOptions {
  /** Form-selected display currency — always wins over copied settings. */
  displayCurrency: ExpenseCurrency;
  /** When true (linked + conflict option 2), also update the target budget's currency. */
  updateLinkedTargetCurrency?: boolean;
}

export const DEFAULT_MONTHLY_BUDGET_ID = 'personal-monthly-default';

export type AppShellView = 'active-budget' | 'personal-budgets' | 'shared-budgets';

export type BudgetSettingsInitMode = 'copy-default' | 'linked' | 'copy-from';

export type PersonalBudgetStatus = 'active' | 'archived' | 'trashed';

export interface PersonalBudgetMeta {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalAmount: number;
  isDefaultMonthly?: boolean;
  settingsMode: BudgetSettingsInitMode;
  linkedBudgetId?: string;
  copiedFromBudgetId?: string;
  icon?: string;
  color?: string;
  isLinkedToMain?: boolean;
  /** Category key inside DEFAULT_MONTHLY_BUDGET_ID when isLinkedToMain is true. */
  linkedCategoryId?: string;
  keepAfterDates?: boolean | null;
  status?: PersonalBudgetStatus;
  createdAt: number;
}

export interface SharedBudgetMeta {
  id: string;
  name: string;
  createdAt: number;
}

export interface BudgetRegistryState {
  personal: PersonalBudgetMeta[];
  shared: SharedBudgetMeta[];
}

export const EMPTY_BUDGET_REGISTRY: BudgetRegistryState = {
  personal: [],
  shared: [],
};

const LS_REGISTRY = 'mm_budget_registry';
const LS_FINANCIAL_PREFIX = 'mm_budget_financial_';
const LS_SETTINGS_PREFIX = 'mm_budget_settings_';

export function createBudgetId(prefix: 'personal' | 'shared'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadBudgetRegistryLocal(): BudgetRegistryState {
  try {
    const raw = localStorage.getItem(LS_REGISTRY);
    if (!raw) return { ...EMPTY_BUDGET_REGISTRY };
    const parsed = JSON.parse(raw) as BudgetRegistryState;
    return {
      personal: Array.isArray(parsed.personal) ? parsed.personal : [],
      shared: Array.isArray(parsed.shared) ? parsed.shared : [],
    };
  } catch {
    return { ...EMPTY_BUDGET_REGISTRY };
  }
}

export function saveBudgetRegistryLocal(registry: BudgetRegistryState): void {
  localStorage.setItem(LS_REGISTRY, JSON.stringify(registry));
}

/** Keep registry card `totalAmount` aligned with internal monthly budget (display currency). */
export function patchPersonalBudgetRegistryTotal(
  registry: BudgetRegistryState,
  budgetId: string,
  totalAmount: number,
): BudgetRegistryState {
  if (!Number.isFinite(totalAmount) || totalAmount < 0) return registry;
  const rounded = roundMoney(totalAmount);
  let changed = false;
  const personal = registry.personal.map((budget) => {
    if (budget.id !== budgetId || budget.isDefaultMonthly) return budget;
    if (budget.totalAmount === rounded) return budget;
    changed = true;
    budgetDebug('patchRegistry', {
      budgetId: budgetId.slice(-10),
      previousTotal: budget.totalAmount,
      nextTotal: rounded,
    });
    return { ...budget, totalAmount: rounded };
  });
  if (!changed) {
    budgetDebug('patchRegistry', {
      budgetId: budgetId.slice(-10),
      skipped: true,
      reason: 'no-change-or-not-found',
      requestedTotal: rounded,
      found: registry.personal.some((b) => b.id === budgetId),
      isDefaultMonthly: registry.personal.find((b) => b.id === budgetId)?.isDefaultMonthly ?? null,
    });
  }
  return changed ? { ...registry, personal } : registry;
}

const REGISTRY_LOCAL_PATCH_TTL_MS = 15_000;

/**
 * Prefer recently patched local registry totals over stale Firestore snapshots.
 */
export function mergeRegistryWithRecentLocalPatches(
  local: BudgetRegistryState,
  remote: BudgetRegistryState,
  patchedAtByBudgetId: Record<string, number>,
  ttlMs = REGISTRY_LOCAL_PATCH_TTL_MS,
): BudgetRegistryState {
  const now = Date.now();
  const localById = new Map(local.personal.map((budget) => [budget.id, budget]));
  let changed = false;
  const personal = remote.personal.map((remoteBudget) => {
    const patchedAt = patchedAtByBudgetId[remoteBudget.id];
    if (!patchedAt || now - patchedAt > ttlMs) return remoteBudget;
    const localBudget = localById.get(remoteBudget.id);
    if (!localBudget || localBudget.totalAmount === remoteBudget.totalAmount) {
      return remoteBudget;
    }
    changed = true;
    return { ...remoteBudget, totalAmount: localBudget.totalAmount };
  });
  return changed ? { ...remote, personal } : remote;
}

export function loadBudgetFinancialLocal(budgetId: string): UserAppData {
  try {
    const raw = localStorage.getItem(`${LS_FINANCIAL_PREFIX}${budgetId}`);
    if (!raw) return { ...EMPTY_USER_APP_DATA };
    const parsed = JSON.parse(raw) as Partial<UserAppData>;
    // Defaults first; persisted payload second; never let empty shells clobber structure.
    return {
      ...EMPTY_USER_APP_DATA,
      ...parsed,
      budgetsByMonth: parsed.budgetsByMonth ?? {},
      budgetOriginalByMonth: parsed.budgetOriginalByMonth ?? {},
      subBudgetsByMonth: parsed.subBudgetsByMonth ?? {},
      autoTransferByMonth: parsed.autoTransferByMonth ?? {},
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      customCategories: Array.isArray(parsed.customCategories) ? parsed.customCategories : [],
    };
  } catch {
    return { ...EMPTY_USER_APP_DATA };
  }
}

export function saveBudgetFinancialLocal(budgetId: string, data: UserAppData): void {
  localStorage.setItem(`${LS_FINANCIAL_PREFIX}${budgetId}`, JSON.stringify(data));
}

export function loadBudgetSettingsLocal(storageKey: string): UserSettings | null {
  try {
    const raw = localStorage.getItem(`${LS_SETTINGS_PREFIX}${storageKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as UserSettings;
  } catch {
    return null;
  }
}

export function saveBudgetSettingsLocal(storageKey: string, settings: UserSettings): void {
  localStorage.setItem(`${LS_SETTINGS_PREFIX}${storageKey}`, JSON.stringify(settings));
}

export function resolveSettingsStorageKey(
  budgetId: string,
  registry: BudgetRegistryState,
  visited = new Set<string>(),
): string {
  if (visited.has(budgetId)) return `budget:${budgetId}`;
  visited.add(budgetId);

  const meta = registry.personal.find((b) => b.id === budgetId);
  if (!meta) return `budget:${budgetId}`;

  if (meta.settingsMode === 'linked' && meta.linkedBudgetId) {
    return resolveSettingsStorageKey(meta.linkedBudgetId, registry, visited);
  }

  return `budget:${budgetId}`;
}

export function createDefaultMonthlyBudgetMeta(): PersonalBudgetMeta {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return {
    id: DEFAULT_MONTHLY_BUDGET_ID,
    name: 'monthlyDefaultBudgetName',
    startDate: toIso(start),
    endDate: toIso(end),
    totalAmount: 0,
    isDefaultMonthly: true,
    settingsMode: 'copy-default',
    createdAt: Date.now(),
  };
}

export function ensureDefaultPersonalBudget(
  registry: BudgetRegistryState,
  legacyData?: UserAppData,
): { registry: BudgetRegistryState; financialCache: Record<string, UserAppData> } {
  const financialCache: Record<string, UserAppData> = {};
  let nextRegistry = { ...registry, personal: [...registry.personal], shared: [...registry.shared] };

  const hasDefault = nextRegistry.personal.some((b) => b.id === DEFAULT_MONTHLY_BUDGET_ID);
  if (!hasDefault) {
    nextRegistry.personal.unshift(createDefaultMonthlyBudgetMeta());
  }

  const defaultData = legacyData ?? loadBudgetFinancialLocal(DEFAULT_MONTHLY_BUDGET_ID);
  financialCache[DEFAULT_MONTHLY_BUDGET_ID] = defaultData;
  saveBudgetFinancialLocal(DEFAULT_MONTHLY_BUDGET_ID, defaultData);
  saveBudgetRegistryLocal(nextRegistry);

  return { registry: nextRegistry, financialCache };
}

function pinDisplayCurrencyOnSettings(
  settings: UserSettings,
  displayCurrency: ExpenseCurrency,
): UserSettings {
  return { ...settings, displayCurrency };
}

function writeBudgetSettingsToCache(
  cache: Record<string, UserSettings>,
  storageKey: string,
  settings: UserSettings,
): void {
  cache[storageKey] = settings;
  saveBudgetSettingsLocal(storageKey, settings);
}

export function initializeBudgetSettingsForNewPersonalBudget(
  meta: PersonalBudgetMeta,
  registry: BudgetRegistryState,
  globalDefaults: UserSettings,
  settingsCache: Record<string, UserSettings>,
  options?: InitializePersonalBudgetSettingsOptions,
): Record<string, UserSettings> {
  const next = { ...settingsCache };
  const storageKey = resolveSettingsStorageKey(meta.id, registry);
  const displayCurrency = options?.displayCurrency ?? globalDefaults.displayCurrency;

  if (meta.settingsMode === 'linked' && meta.linkedBudgetId) {
    const sourceKey = resolveSettingsStorageKey(meta.linkedBudgetId, registry);
    const source = next[sourceKey] ?? loadBudgetSettingsLocal(sourceKey) ?? globalDefaults;
    writeBudgetSettingsToCache(
      next,
      storageKey,
      pinDisplayCurrencyOnSettings(source, displayCurrency),
    );

    if (options?.updateLinkedTargetCurrency) {
      const targetSettings = pinDisplayCurrencyOnSettings(
        next[sourceKey] ?? source,
        displayCurrency,
      );
      writeBudgetSettingsToCache(next, sourceKey, targetSettings);
    }
    return next;
  }

  if (meta.settingsMode === 'copy-from' && meta.copiedFromBudgetId) {
    const sourceKey = resolveSettingsStorageKey(meta.copiedFromBudgetId, registry);
    const source = next[sourceKey] ?? loadBudgetSettingsLocal(sourceKey) ?? globalDefaults;
    writeBudgetSettingsToCache(
      next,
      storageKey,
      pinDisplayCurrencyOnSettings(source, displayCurrency),
    );
    return next;
  }

  writeBudgetSettingsToCache(
    next,
    storageKey,
    pinDisplayCurrencyOnSettings(globalDefaults, displayCurrency),
  );
  return next;
}

/**
 * Re-apply form display currency after navigation side-effects (e.g. enterBudget flush)
 * so copied settings cannot win in a last-mile spread override.
 */
export function finalizePersonalBudgetDisplayCurrency(
  meta: PersonalBudgetMeta,
  registry: BudgetRegistryState,
  settingsCache: Record<string, UserSettings>,
  globalDefaults: UserSettings,
  displayCurrency: ExpenseCurrency,
  updateLinkedTargetCurrency?: boolean,
): Record<string, UserSettings> {
  const next = { ...settingsCache };
  const newBudgetKey = resolveSettingsStorageKey(meta.id, registry);
  const existingNew =
    next[newBudgetKey] ?? loadBudgetSettingsLocal(newBudgetKey) ?? globalDefaults;

  writeBudgetSettingsToCache(
    next,
    newBudgetKey,
    pinDisplayCurrencyOnSettings(existingNew, displayCurrency),
  );

  if (updateLinkedTargetCurrency && meta.settingsMode === 'linked' && meta.linkedBudgetId) {
    const targetKey = resolveSettingsStorageKey(meta.linkedBudgetId, registry);
    const existingTarget =
      next[targetKey] ?? loadBudgetSettingsLocal(targetKey) ?? globalDefaults;
    writeBudgetSettingsToCache(
      next,
      targetKey,
      pinDisplayCurrencyOnSettings(existingTarget, displayCurrency),
    );
  }

  return next;
}

export function snapshotUserAppData(input: {
  expenses: UserAppData['expenses'];
  customCategories: UserAppData['customCategories'];
  budgetsByMonth: UserAppData['budgetsByMonth'];
  budgetOriginalByMonth: UserAppData['budgetOriginalByMonth'];
  subBudgetsByMonth: UserAppData['subBudgetsByMonth'];
  subBudgetsOriginalByMonth?: UserAppData['subBudgetsOriginalByMonth'];
  autoTransferByMonth: UserAppData['autoTransferByMonth'];
}): UserAppData {
  return {
    expenses: input.expenses,
    customCategories: input.customCategories,
    budgetsByMonth: input.budgetsByMonth,
    budgetOriginalByMonth: input.budgetOriginalByMonth,
    subBudgetsByMonth: input.subBudgetsByMonth,
    subBudgetsOriginalByMonth: input.subBudgetsOriginalByMonth ?? {},
    autoTransferByMonth: input.autoTransferByMonth,
  };
}

export function getBudgetScopedSettings(
  budgetId: string,
  registry: BudgetRegistryState,
  settingsCache: Record<string, UserSettings>,
  globalDefaults: UserSettings,
): UserSettings {
  const storageKey = resolveSettingsStorageKey(budgetId, registry);
  return (
    settingsCache[storageKey] ??
    loadBudgetSettingsLocal(storageKey) ??
    { ...EMPTY_USER_SETTINGS, ...globalDefaults }
  );
}
