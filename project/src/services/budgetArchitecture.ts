import {
  EMPTY_USER_APP_DATA,
  type UserAppData,
} from '../userDataStorage';
import {
  EMPTY_USER_SETTINGS,
  type UserSettings,
} from './userFirebaseSync';

export const DEFAULT_MONTHLY_BUDGET_ID = 'personal-monthly-default';

export type AppShellView = 'active-budget' | 'personal-budgets' | 'shared-budgets';

export type BudgetSettingsInitMode = 'copy-default' | 'linked' | 'copy-from';

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

export function loadBudgetFinancialLocal(budgetId: string): UserAppData {
  try {
    const raw = localStorage.getItem(`${LS_FINANCIAL_PREFIX}${budgetId}`);
    if (!raw) return { ...EMPTY_USER_APP_DATA };
    return { ...EMPTY_USER_APP_DATA, ...JSON.parse(raw) };
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

export function initializeBudgetSettingsForNewPersonalBudget(
  meta: PersonalBudgetMeta,
  registry: BudgetRegistryState,
  globalDefaults: UserSettings,
  settingsCache: Record<string, UserSettings>,
): Record<string, UserSettings> {
  const next = { ...settingsCache };
  const storageKey = resolveSettingsStorageKey(meta.id, registry);

  if (meta.settingsMode === 'linked' && meta.linkedBudgetId) {
    const sourceKey = resolveSettingsStorageKey(meta.linkedBudgetId, registry);
    const source = next[sourceKey] ?? loadBudgetSettingsLocal(sourceKey) ?? globalDefaults;
    next[storageKey] = { ...source };
    saveBudgetSettingsLocal(storageKey, next[storageKey]);
    return next;
  }

  if (meta.settingsMode === 'copy-from' && meta.copiedFromBudgetId) {
    const sourceKey = resolveSettingsStorageKey(meta.copiedFromBudgetId, registry);
    const source = next[sourceKey] ?? loadBudgetSettingsLocal(sourceKey) ?? globalDefaults;
    next[storageKey] = { ...source };
    saveBudgetSettingsLocal(storageKey, next[storageKey]);
    return next;
  }

  next[storageKey] = { ...globalDefaults };
  saveBudgetSettingsLocal(storageKey, next[storageKey]);
  return next;
}

export function snapshotUserAppData(input: {
  expenses: UserAppData['expenses'];
  customCategories: UserAppData['customCategories'];
  budgetsByMonth: UserAppData['budgetsByMonth'];
  budgetOriginalByMonth: UserAppData['budgetOriginalByMonth'];
  subBudgetsByMonth: UserAppData['subBudgetsByMonth'];
  autoTransferByMonth: UserAppData['autoTransferByMonth'];
}): UserAppData {
  return {
    expenses: input.expenses,
    customCategories: input.customCategories,
    budgetsByMonth: input.budgetsByMonth,
    budgetOriginalByMonth: input.budgetOriginalByMonth,
    subBudgetsByMonth: input.subBudgetsByMonth,
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
