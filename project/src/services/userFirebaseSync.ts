import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type DocumentReference,
  type Unsubscribe,
} from 'firebase/firestore';
import { type User } from 'firebase/auth';
import { db } from '../firebase';
import {
  EMPTY_USER_APP_DATA,
  loadFromLocalStorage,
  type StoredCustomCategory,
  type StoredExpense,
  type UserAppData,
} from '../userDataStorage';
import { isCustomHexColor, normalizeCustomHex } from '../categories';
import {
  normalizeCustomCurrencies,
  normalizeDisplayCurrency,
  type ExpenseCurrency,
} from './currencyRegistry';
import {
  buildDefaultCurrencyLayout,
  normalizeCurrencyLayout,
  reconcileCurrencyLayout,
  type CurrencyLayoutItem,
} from './currencyLayoutService';
import {
  DEFAULT_THEME_PREFERENCES,
  parseThemePreferences,
  type ThemePreferences,
} from './buttonThemeService';
import {
  GLOBAL_COMMISSION_CURRENCY,
  normalizeCommissionCurrency,
  type CommissionCurrency,
} from './currencyCommissionService';
import { roundMoney } from './money';

const DOC_ID = 'data';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface UserSettings {
  lang: 'he' | 'en';
  keepOriginalValues: boolean;
  displayCurrency: ExpenseCurrency;
  saved_colors: string[];
  custom_currencies: ExpenseCurrency[];
  currency_layout: CurrencyLayoutItem[];
  themePreferences: ThemePreferences;
}

export interface UserCategoriesData {
  customCategories: StoredCustomCategory[];
  budgetsByMonth: Record<string, number>;
  budgetOriginalByMonth: Record<string, { amount: number; currency: string }>;
  subBudgetsByMonth: Record<string, Record<string, number>>;
  autoTransferByMonth: Record<string, boolean>;
}

export interface CloudManualExchangeOverride {
  baseCurrency: ExpenseCurrency;
  quoteCurrency: ExpenseCurrency;
  rate: number;
  updatedAt: number;
}

export interface CloudCurrencyCommission {
  currency: CommissionCurrency;
  percent: number;
  updatedAt: number;
}

export const EMPTY_USER_SETTINGS: UserSettings = {
  lang: 'he',
  keepOriginalValues: false,
  displayCurrency: 'ILS',
  saved_colors: [],
  custom_currencies: [],
  currency_layout: buildDefaultCurrencyLayout(),
  themePreferences: { ...DEFAULT_THEME_PREFERENCES },
};

export const EMPTY_USER_CATEGORIES: UserCategoriesData = {
  customCategories: [],
  budgetsByMonth: {},
  budgetOriginalByMonth: {},
  subBudgetsByMonth: {},
  autoTransferByMonth: {},
};

const SETTINGS_LS_KEYS = {
  lang: 'money-manager-language',
  keepOriginalValues: 'money-manager-keep-original-values',
  displayCurrency: 'money-manager-display-currency',
  savedColors: 'saved_colors',
  customCurrencies: 'money-manager-custom-currencies',
  currencyLayout: 'money-manager-currency-layout',
} as const;

export const shouldSyncToFirestore = (user: User | null): user is User =>
  user !== null && !user.isAnonymous;

const expensesRef = (uid: string) => doc(db, 'users', uid, 'expenses', DOC_ID);
const categoriesRef = (uid: string) => doc(db, 'users', uid, 'categories', DOC_ID);
const settingsRef = (uid: string) => doc(db, 'users', uid, 'settings', DOC_ID);
const manualOverridesRef = (uid: string) => doc(db, 'users', uid, 'manual_exchange_overrides', DOC_ID);
const currencyCommissionsRef = (uid: string) => doc(db, 'users', uid, 'currency_commissions', DOC_ID);
const legacyAppRef = (uid: string) => doc(db, 'users', uid, 'data', 'app');

export type SnapshotMeta = { hasPendingWrites: boolean; exists: boolean };

function normalizeSavedColors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is string => typeof item === 'string' && isCustomHexColor(item))
    .map(normalizeCustomHex);
}

function parseSettings(raw: Record<string, unknown> | undefined): UserSettings {
  if (!raw) return { ...EMPTY_USER_SETTINGS };

  const lang = raw.lang === 'he' || raw.lang === 'en' ? raw.lang : EMPTY_USER_SETTINGS.lang;
  const keepOriginalValues =
    typeof raw.keepOriginalValues === 'boolean'
      ? raw.keepOriginalValues
      : EMPTY_USER_SETTINGS.keepOriginalValues;
  const displayCurrency = normalizeDisplayCurrency(raw.displayCurrency);

  const custom_currencies = normalizeCustomCurrencies(raw.custom_currencies);
  const parsedLayout = normalizeCurrencyLayout(raw.currency_layout);
  const currency_layout =
    parsedLayout.length > 0
      ? reconcileCurrencyLayout(parsedLayout, custom_currencies)
      : buildDefaultCurrencyLayout(custom_currencies);

  const themePreferences = parseThemePreferences(
    raw.themePreferences ?? raw.button_theme,
  );

  return {
    lang,
    keepOriginalValues,
    displayCurrency,
    saved_colors: normalizeSavedColors(raw.saved_colors),
    custom_currencies,
    currency_layout,
    themePreferences,
  };
}

function parseCategories(raw: Record<string, unknown> | undefined): UserCategoriesData {
  if (!raw) return { ...EMPTY_USER_CATEGORIES };
  const budgetsByMonthRaw = (raw.budgetsByMonth as Record<string, number> | undefined) ?? {};
  const budgetOriginalByMonthRaw =
    (raw.budgetOriginalByMonth as Record<string, { amount: number; currency: string }> | undefined) ??
    {};
  const subBudgetsByMonthRaw =
    (raw.subBudgetsByMonth as Record<string, Record<string, number>> | undefined) ?? {};
  return {
    customCategories: (raw.customCategories as StoredCustomCategory[] | undefined) ?? [],
    budgetsByMonth: Object.fromEntries(
      Object.entries(budgetsByMonthRaw).map(([month, amount]) => [month, roundMoney(Number(amount ?? 0))]),
    ),
    budgetOriginalByMonth: Object.fromEntries(
      Object.entries(budgetOriginalByMonthRaw).map(([month, value]) => [
        month,
        { ...value, amount: roundMoney(Number(value?.amount ?? 0)) },
      ]),
    ),
    subBudgetsByMonth: Object.fromEntries(
      Object.entries(subBudgetsByMonthRaw).map(([month, map]) => [
        month,
        Object.fromEntries(
          Object.entries(map ?? {}).map(([key, amount]) => [key, roundMoney(Number(amount ?? 0))]),
        ),
      ]),
    ),
    autoTransferByMonth: (raw.autoTransferByMonth as Record<string, boolean> | undefined) ?? {},
  };
}

function parseExpenses(raw: Record<string, unknown> | undefined): StoredExpense[] {
  return ((raw?.expenses as StoredExpense[] | undefined) ?? []).map((expense) => ({
    ...expense,
    amount: roundMoney(Number(expense.amount ?? 0)),
    originalAmount:
      expense.originalAmount != null ? roundMoney(Number(expense.originalAmount)) : undefined,
  }));
}

function parseCloudCurrencyCommissions(
  raw: Record<string, unknown> | undefined,
): CloudCurrencyCommission[] {
  if (!raw) return [];
  const commissionsRaw = (raw.commissions ?? {}) as Record<string, unknown>;
  if (!commissionsRaw || typeof commissionsRaw !== 'object') return [];

  return Object.values(commissionsRaw)
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const rawCurrency =
        typeof item.currency === 'string' ? item.currency.trim().toUpperCase() : '';
      const currency =
        normalizeCommissionCurrency(rawCurrency) ??
        (rawCurrency === GLOBAL_COMMISSION_CURRENCY ? GLOBAL_COMMISSION_CURRENCY : null);
      const percent = typeof item.percent === 'number' ? item.percent : 0;
      const updatedAt = typeof item.updatedAt === 'number' ? item.updatedAt : Date.now();
      if (!currency) return null;
      return { currency, percent, updatedAt };
    })
    .filter(
      (item): item is CloudCurrencyCommission =>
        item != null &&
        Number.isFinite(item.percent) &&
        item.percent > 0 &&
        item.percent <= 100,
    );
}

function parseCloudManualOverrides(
  raw: Record<string, unknown> | undefined,
): CloudManualExchangeOverride[] {
  if (!raw) return [];
  const overridesRaw = (raw.overrides ?? {}) as Record<string, unknown>;
  if (!overridesRaw || typeof overridesRaw !== 'object') return [];

  return Object.values(overridesRaw)
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const baseCurrency = normalizeDisplayCurrency(item.baseCurrency);
      const quoteCurrency = normalizeDisplayCurrency(item.quoteCurrency);
      const rate = typeof item.rate === 'number' ? item.rate : 0;
      const updatedAt = typeof item.updatedAt === 'number' ? item.updatedAt : Date.now();
      return { baseCurrency, quoteCurrency, rate, updatedAt };
    })
    .filter(
      (item) =>
        item.baseCurrency !== item.quoteCurrency &&
        Number.isFinite(item.rate) &&
        item.rate > 0,
    );
}

function hasFinancialLocalData(data: UserAppData): boolean {
  return (
    data.expenses.length > 0 ||
    data.customCategories.length > 0 ||
    Object.keys(data.budgetsByMonth).length > 0 ||
    Object.keys(data.subBudgetsByMonth).length > 0 ||
    Object.keys(data.autoTransferByMonth).length > 0
  );
}

function hasSettingsLocalData(settings: UserSettings): boolean {
  return (
    settings.lang !== EMPTY_USER_SETTINGS.lang ||
    settings.keepOriginalValues !== EMPTY_USER_SETTINGS.keepOriginalValues ||
    settings.displayCurrency !== EMPTY_USER_SETTINGS.displayCurrency ||
    settings.saved_colors.length > 0 ||
    settings.custom_currencies.length > 0
  );
}

export function loadLegacySettingsFromLocalStorage(): UserSettings {
  const langRaw = window.localStorage.getItem(SETTINGS_LS_KEYS.lang);
  const lang: UserSettings['lang'] =
    langRaw === 'he' || langRaw === 'en' ? langRaw : EMPTY_USER_SETTINGS.lang;

  const keepOriginalValues =
    window.localStorage.getItem(SETTINGS_LS_KEYS.keepOriginalValues) === 'true';

  const currencyRaw = window.localStorage.getItem(SETTINGS_LS_KEYS.displayCurrency);
  const displayCurrency = normalizeDisplayCurrency(currencyRaw);

  let saved_colors: string[] = [];
  try {
    const raw = window.localStorage.getItem(SETTINGS_LS_KEYS.savedColors);
    if (raw) saved_colors = normalizeSavedColors(JSON.parse(raw));
  } catch {
    saved_colors = [];
  }

  let custom_currencies: ExpenseCurrency[] = [];
  try {
    const raw = window.localStorage.getItem(SETTINGS_LS_KEYS.customCurrencies);
    if (raw) custom_currencies = normalizeCustomCurrencies(JSON.parse(raw));
  } catch {
    custom_currencies = [];
  }

  let currency_layout: CurrencyLayoutItem[] = [];
  try {
    const raw = window.localStorage.getItem(SETTINGS_LS_KEYS.currencyLayout);
    if (raw) currency_layout = normalizeCurrencyLayout(JSON.parse(raw));
  } catch {
    currency_layout = [];
  }
  if (currency_layout.length === 0) {
    currency_layout = buildDefaultCurrencyLayout(custom_currencies);
  } else {
    currency_layout = reconcileCurrencyLayout(currency_layout, custom_currencies);
  }

  let themePreferences: ThemePreferences = { ...DEFAULT_THEME_PREFERENCES };
  try {
    const raw =
      window.localStorage.getItem('guest_theme_preferences') ||
      window.localStorage.getItem('money_manager_button_theme_v1');
    if (raw) {
      themePreferences = parseThemePreferences(JSON.parse(raw));
    }
  } catch {
    themePreferences = { ...DEFAULT_THEME_PREFERENCES };
  }

  return {
    lang,
    keepOriginalValues,
    displayCurrency,
    saved_colors,
    custom_currencies,
    currency_layout,
    themePreferences,
  };
}

const EXCHANGE_FEE_LS_KEYS = [
  'money_manager_currency_commissions_v1',
  'money_manager_manual_exchange_overrides_v1',
] as const;

export function clearLegacyLocalStorage(): void {
  // Intentionally preserves `preferred_language` for login-screen language sync after logout.
  for (const key of EXCHANGE_FEE_LS_KEYS) {
    window.localStorage.removeItem(key);
  }
  window.localStorage.removeItem('expenses');
  window.localStorage.removeItem('customCategories');
  window.localStorage.removeItem('budgetsByMonth');
  window.localStorage.removeItem('budgetOriginalByMonth');
  window.localStorage.removeItem('subBudgetsByMonth');
  window.localStorage.removeItem('autoTransferByMonth');
  window.localStorage.removeItem('monthlyBudget');
  window.localStorage.removeItem('subBudgets');
  window.localStorage.removeItem('saved_colors');
  window.localStorage.removeItem(SETTINGS_LS_KEYS.lang);
  window.localStorage.removeItem(SETTINGS_LS_KEYS.keepOriginalValues);
  window.localStorage.removeItem(SETTINGS_LS_KEYS.displayCurrency);
  window.localStorage.removeItem(SETTINGS_LS_KEYS.savedColors);
  window.localStorage.removeItem(SETTINGS_LS_KEYS.customCurrencies);
  window.localStorage.removeItem(SETTINGS_LS_KEYS.currencyLayout);
  window.localStorage.removeItem('auto_transfer_start_month');
  window.localStorage.removeItem('auto_transfer_budget');
}

async function readLegacyFirestoreApp(uid: string): Promise<UserAppData | null> {
  const snapshot = await getDoc(legacyAppRef(uid));
  if (!snapshot.exists()) return null;
  const raw = snapshot.data();
  return {
    expenses: (raw.expenses as StoredExpense[] | undefined) ?? [],
    customCategories: (raw.customCategories as StoredCustomCategory[] | undefined) ?? [],
    budgetsByMonth: (raw.budgetsByMonth as Record<string, number> | undefined) ?? {},
    budgetOriginalByMonth:
      (raw.budgetOriginalByMonth as Record<string, { amount: number; currency: string }> | undefined) ??
      {},
    subBudgetsByMonth:
      (raw.subBudgetsByMonth as Record<string, Record<string, number>> | undefined) ?? {},
    autoTransferByMonth: {},
  };
}

function isExpensesEmpty(data: StoredExpense[]): boolean {
  return data.length === 0;
}

function isCategoriesEmpty(data: UserCategoriesData): boolean {
  return (
    data.customCategories.length === 0 &&
    Object.keys(data.budgetsByMonth).length === 0 &&
    Object.keys(data.budgetOriginalByMonth).length === 0 &&
    Object.keys(data.subBudgetsByMonth).length === 0 &&
    Object.keys(data.autoTransferByMonth).length === 0
  );
}

export async function ensureCloudDataMigrated(uid: string): Promise<void> {
  const [expensesSnap, categoriesSnap, settingsSnap, legacySnap] = await Promise.all([
    getDoc(expensesRef(uid)),
    getDoc(categoriesRef(uid)),
    getDoc(settingsRef(uid)),
    getDoc(legacyAppRef(uid)),
  ]);

  const newStructureExists =
    expensesSnap.exists() || categoriesSnap.exists() || settingsSnap.exists();

  if (newStructureExists) return;

  const localFinancial = loadFromLocalStorage();
  const localSettings = loadLegacySettingsFromLocalStorage();
  const hasLocal =
    hasFinancialLocalData(localFinancial) || hasSettingsLocalData(localSettings);
  const hasLegacyRemote = legacySnap.exists();

  if (!hasLocal && !hasLegacyRemote) return;

  await migrateLegacyDataToCloud(uid);
}

export async function migrateLegacyDataToCloud(uid: string): Promise<void> {
  const localFinancial = loadFromLocalStorage();
  const localSettings = loadLegacySettingsFromLocalStorage();
  const legacyRemote = await readLegacyFirestoreApp(uid);

  const expenses =
    localFinancial.expenses.length > 0
      ? localFinancial.expenses
      : (legacyRemote?.expenses ?? []);

  const categories: UserCategoriesData = {
    customCategories:
      localFinancial.customCategories.length > 0
        ? localFinancial.customCategories
        : (legacyRemote?.customCategories ?? []),
    budgetsByMonth:
      Object.keys(localFinancial.budgetsByMonth).length > 0
        ? localFinancial.budgetsByMonth
        : (legacyRemote?.budgetsByMonth ?? {}),
    budgetOriginalByMonth: localFinancial.budgetOriginalByMonth ?? {},
    subBudgetsByMonth:
      Object.keys(localFinancial.subBudgetsByMonth).length > 0
        ? localFinancial.subBudgetsByMonth
        : (legacyRemote?.subBudgetsByMonth ?? {}),
    autoTransferByMonth: localFinancial.autoTransferByMonth ?? {},
  };

  const settings = hasSettingsLocalData(localSettings)
    ? localSettings
    : { ...EMPTY_USER_SETTINGS };

  const hasAnythingToUpload =
    !isExpensesEmpty(expenses) ||
    !isCategoriesEmpty(categories) ||
    hasSettingsLocalData(settings) ||
    legacyRemote !== null;

  if (!hasAnythingToUpload) return;

  await Promise.all([
    setDoc(
      expensesRef(uid),
      { expenses, updatedAt: serverTimestamp() },
      { merge: true },
    ),
    setDoc(
      categoriesRef(uid),
      {
        customCategories: categories.customCategories,
        budgetsByMonth: categories.budgetsByMonth,
        budgetOriginalByMonth: categories.budgetOriginalByMonth,
        subBudgetsByMonth: categories.subBudgetsByMonth,
        autoTransferByMonth: categories.autoTransferByMonth,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
    setDoc(
      settingsRef(uid),
      {
        lang: settings.lang,
        keepOriginalValues: settings.keepOriginalValues,
        displayCurrency: settings.displayCurrency,
        saved_colors: settings.saved_colors,
        custom_currencies: settings.custom_currencies,
        currency_layout: settings.currency_layout,
        themePreferences: settings.themePreferences,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    ),
  ]);

  clearLegacyLocalStorage();
}

function subscribeDoc<T>(
  ref: DocumentReference,
  parse: (raw: Record<string, unknown> | undefined) => T,
  onData: (data: T, meta: SnapshotMeta) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    ref,
    (snapshot) => {
      const data = snapshot.exists()
        ? parse(snapshot.data() as Record<string, unknown>)
        : parse(undefined);
      onData(data, { hasPendingWrites: snapshot.metadata.hasPendingWrites, exists: snapshot.exists() });
    },
    (error) => onError?.(error),
  );
}

export function subscribeExpenses(
  uid: string,
  onData: (expenses: StoredExpense[], meta: SnapshotMeta) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeDoc(
    expensesRef(uid),
    (raw) => parseExpenses(raw),
    onData,
    onError,
  );
}

export function subscribeCategories(
  uid: string,
  onData: (categories: UserCategoriesData, meta: SnapshotMeta) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeDoc(categoriesRef(uid), parseCategories, onData, onError);
}

export function subscribeSettings(
  uid: string,
  onData: (settings: UserSettings, meta: SnapshotMeta) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeDoc(settingsRef(uid), parseSettings, onData, onError);
}

export function subscribeManualExchangeOverrides(
  uid: string,
  onData: (entries: CloudManualExchangeOverride[], meta: SnapshotMeta) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeDoc(
    manualOverridesRef(uid),
    (raw) => parseCloudManualOverrides(raw),
    onData,
    onError,
  );
}

export function subscribeCurrencyCommissions(
  uid: string,
  onData: (entries: CloudCurrencyCommission[], meta: SnapshotMeta) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return subscribeDoc(
    currencyCommissionsRef(uid),
    (raw) => parseCloudCurrencyCommissions(raw),
    onData,
    onError,
  );
}

export async function saveExpensesToCloud(uid: string, expenses: StoredExpense[]): Promise<void> {
  await setDoc(expensesRef(uid), { expenses, updatedAt: serverTimestamp() }, { merge: true });
}

export async function saveCategoriesToCloud(
  uid: string,
  categories: UserCategoriesData,
): Promise<void> {
  await setDoc(
    categoriesRef(uid),
    {
      customCategories: categories.customCategories,
      budgetsByMonth: categories.budgetsByMonth,
      budgetOriginalByMonth: categories.budgetOriginalByMonth,
      subBudgetsByMonth: categories.subBudgetsByMonth,
      autoTransferByMonth: categories.autoTransferByMonth,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveSettingsToCloud(uid: string, settings: UserSettings): Promise<void> {
  await setDoc(
    settingsRef(uid),
    {
      lang: settings.lang,
      keepOriginalValues: settings.keepOriginalValues,
      displayCurrency: settings.displayCurrency,
      saved_colors: settings.saved_colors,
      custom_currencies: settings.custom_currencies,
      currency_layout: settings.currency_layout,
      themePreferences: settings.themePreferences,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

function normalizeOverridePair(
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
  rate: number,
) {
  if (!(Number.isFinite(rate) && rate > 0) || fromCurrency === toCurrency) return null;
  if (fromCurrency < toCurrency) {
    return { baseCurrency: fromCurrency, quoteCurrency: toCurrency, normalizedRate: rate };
  }
  return {
    baseCurrency: toCurrency,
    quoteCurrency: fromCurrency,
    normalizedRate: 1 / rate,
  };
}

function manualPairKey(baseCurrency: ExpenseCurrency, quoteCurrency: ExpenseCurrency): string {
  return `${baseCurrency}__${quoteCurrency}`;
}

export async function saveManualExchangeOverrideToCloud(
  uid: string,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
  rate: number,
): Promise<void> {
  const normalized = normalizeOverridePair(fromCurrency, toCurrency, rate);
  if (!normalized) return;
  const pairKey = manualPairKey(normalized.baseCurrency, normalized.quoteCurrency);

  await setDoc(
    manualOverridesRef(uid),
    {
      overrides: {
        [pairKey]: {
          baseCurrency: normalized.baseCurrency,
          quoteCurrency: normalized.quoteCurrency,
          rate: normalized.normalizedRate,
          createdAt: serverTimestamp(),
          updatedAt: Date.now(),
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveCurrencyCommissionToCloud(
  uid: string,
  currency: CommissionCurrency,
  percent: number,
): Promise<void> {
  if (
    normalizeCommissionCurrency(currency) == null ||
    !(Number.isFinite(percent) && percent > 0 && percent <= 100)
  ) {
    return;
  }

  await setDoc(
    currencyCommissionsRef(uid),
    {
      commissions: {
        [currency]: {
          currency,
          percent,
          createdAt: serverTimestamp(),
          updatedAt: Date.now(),
        },
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteCurrencyCommissionFromCloud(
  uid: string,
  currency: CommissionCurrency,
): Promise<void> {
  if (normalizeCommissionCurrency(currency) == null) return;

  await setDoc(
    currencyCommissionsRef(uid),
    {
      commissions: {
        [currency]: deleteField(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteManualExchangeOverrideFromCloud(
  uid: string,
  fromCurrency: ExpenseCurrency,
  toCurrency: ExpenseCurrency,
): Promise<void> {
  if (fromCurrency === toCurrency) return;
  const baseCurrency = fromCurrency < toCurrency ? fromCurrency : toCurrency;
  const quoteCurrency = fromCurrency < toCurrency ? toCurrency : fromCurrency;
  const pairKey = manualPairKey(baseCurrency, quoteCurrency);

  await setDoc(
    manualOverridesRef(uid),
    {
      overrides: {
        [pairKey]: deleteField(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

function resolveFeeEntryTimestampMs(value: unknown): number | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as { createdAt?: unknown; updatedAt?: unknown };

  const createdAt = item.createdAt;
  if (createdAt && typeof createdAt === 'object' && 'toMillis' in createdAt) {
    const toMillis = (createdAt as { toMillis?: () => number }).toMillis;
    if (typeof toMillis === 'function') {
      const ms = toMillis.call(createdAt);
      if (typeof ms === 'number' && Number.isFinite(ms)) return ms;
    }
  }
  if (typeof createdAt === 'number' && Number.isFinite(createdAt)) return createdAt;

  if (typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)) return item.updatedAt;
  return null;
}

export async function pruneExpiredCloudExchangeFees(uid: string): Promise<void> {
  const threshold = Date.now() - DAY_MS;

  const commissionsSnap = await getDoc(currencyCommissionsRef(uid));
  const commissionsRaw = (commissionsSnap.data()?.commissions ?? {}) as Record<string, unknown>;
  const expiredCommissions = Object.entries(commissionsRaw)
    .filter(([, value]) => {
      const timestampMs = resolveFeeEntryTimestampMs(value);
      return timestampMs != null && timestampMs < threshold;
    })
    .map(([currency]) => currency);
  if (expiredCommissions.length > 0) {
    await setDoc(
      currencyCommissionsRef(uid),
      {
        commissions: Object.fromEntries(expiredCommissions.map((currency) => [currency, deleteField()])),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  const overridesSnap = await getDoc(manualOverridesRef(uid));
  const overridesRaw = (overridesSnap.data()?.overrides ?? {}) as Record<string, unknown>;
  const expiredOverrides = Object.entries(overridesRaw)
    .filter(([, value]) => {
      const timestampMs = resolveFeeEntryTimestampMs(value);
      return timestampMs != null && timestampMs < threshold;
    })
    .map(([pairKey]) => pairKey);
  if (expiredOverrides.length > 0) {
    await setDoc(
      manualOverridesRef(uid),
      {
        overrides: Object.fromEntries(expiredOverrides.map((pairKey) => [pairKey, deleteField()])),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }
}

export function appendSavedColor(colors: string[], hex: string): string[] {
  const normalized = normalizeCustomHex(hex);
  if (!isCustomHexColor(normalized)) return colors;
  if (colors.includes(normalized)) return colors;
  return [...colors, normalized];
}

export { EMPTY_USER_APP_DATA };
