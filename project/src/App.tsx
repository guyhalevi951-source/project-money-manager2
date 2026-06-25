import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  type ChangeEvent,
  type MutableRefObject,
  type ReactNode,
  type TouchEvent,
} from 'react';
import { flushSync } from 'react-dom';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import {
  Wallet,
  TrendingDown,
  Plus,
  Trash2,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  PieChart as PieChartIcon,
  LayoutDashboard,
  Receipt,
  Search,
  Pencil,
  RotateCcw,
  Globe,
  Layers,
  ChevronUp,
  Menu,
  User as UserIcon,
  LogOut,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import {
  CATEGORIES,
  ICON_OPTIONS,
  resolveIcon,
  resolveBudgetFormIcon,
  DEFAULT_CATEGORY_COLOR,
  hexForColor,
  aggregateByCategory,
  lookupCategory,
  type Category,
} from './categories';
import appLogo from './assets/app-logo.png';
import CreateCategoryForm from './components/CreateCategoryForm';
import CategoryIconBadge from './components/CategoryIconBadge';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { updateProfile } from 'firebase/auth';
import { auth, signOutUser } from './firebase';
import AuthPage from './components/AuthPage';
import UserProfileMenu from './components/UserProfileMenu';
import ProfilePage from './components/ProfilePage';
import { PROFILE_PLAIN_OPEN_EVENT, SETTINGS_NAVIGATE_EVENT } from './components/ProfileSettingsSections';
import BudgetDrawerMenu from './components/BudgetDrawerMenu';
import PersonalBudgetsPage, { type CreatePersonalBudgetInput } from './components/PersonalBudgetsPage';
import SharedBudgetsPage from './components/SharedBudgetsPage';
import { SettingsPersistenceProvider } from './context/SettingsPersistenceContext';
import {
  applyIsolatedCloudSessionSeed,
  rehydrateIsolatedGuestSession,
} from './services/settingsPersistenceEngine';
import ExpenseAmountField from './components/ExpenseAmountField';
import SelectedDaySummary from './components/SelectedDaySummary';
import ExpenseAmountDisplay from './components/ExpenseAmountDisplay';
import DisplayMoney, { DisplayCurrencyAmount } from './components/DisplayMoney';
import { useDisplayProjection } from './hooks/useDisplayProjection';
import { useRateCacheSync } from './hooks/useRateCacheSync';
import CategoryColorChip from './components/CategoryColorChip';
import { LocalizedUserText, LtrNumeric, useLanguage } from './LanguageContext';
import { formatTranslation, localizeCategoryLabel } from './translations';
import {
  formatAmountParts,
  formatAmountWithSymbol,
  convertDisplayAmountToLedgerCurrency,
  symbolToCurrency,
  type AmountDisplayParts,
} from './services/displayCurrencyUtils';
import {
  buildMoneyProjectionContext,
  immutableFromExpense,
  sumMoneyProjections,
} from './services/immutableMoney';
import { DisplayCurrencyInlineMenu } from './components/DisplayCurrencySelector';
import { themeCategoryProps } from './services/buttonThemeService';
import {
  clearAllCurrencyCommissionsLocal,
  clearCloudCurrencyCommissions,
  listActiveCurrencyCommissions,
  replaceCloudCurrencyCommissions,
} from './services/currencyCommissionService';
import {
  previewExpenseDisplayAmount,
  recordExpenseConversionToIlsAsync,
  resolvePersistedExpenseConversionMeta,
  resolveExpenseEditModifierVisibility,
} from './services/expenseConversionService';
import {
  currencySymbolTriggerClass,
  currencyUtilityButtonClass,
  filterBarActiveTabClass,
  filterBarContainerClass,
  filterBarInactiveTabClass,
  filterDropdownWrapperClass,
  filterInsetPanelClass,
  primaryActionAccentIconClass,
  primaryActionButtonClass,
  primaryActionDisabled,
  utilityNavActiveTabClass,
  utilityNavButtonLgClass,
  utilityNavIconBadgeClass,
  utilityNavMenuToggleClass,
  utilityIconButtonGhostClass,
} from './styles/actionButtonStyles';
import {
  surfaceInputClass,
  surfaceInputLgClass,
  surfaceInputSmClass,
  surfaceModalClass,
  surfaceModalLgClass,
  surfacePanelClass,
  surfaceSearchInputClass,
  subCardClass,
  subCardNestedItemClass,
  subCardNestedListStackClass,
  subCardRowClass,
  subCardTableHeadClass,
  subCardAccordionShellClass,
  subCardAccordionShellTriggerClass,
  subCardAccordionBodyClass,
  subCardAccordionContentClass,
  themeCardClass,
  themeFooterClass,
  themeHeaderClass,
  themePageLoadingClass,
  themePageRootClass,
  typographyBodyClass,
  typographyLabelClass,
  typographyMutedClass,
  typographyTitleClass,
  themeTextMutedClass,
  themeTextClass,
  APP_THEME_SCOPE,
  themeAntiClipVisibleClass,
  themeScrollRoutePageClass,
  themeScrollRouteShellClass,
  themeScrollSafeContentClass,
  themeScrollViewportClass,
  emptyStateIconWellClass,
  progressTrackClass,
} from './styles/themeSurfaceStyles';
import {
  clearAllManualExchangeOverridesLocal,
  clearCloudManualExchangeOverrides,
  listActiveManualExchangeOverrides,
  replaceCloudManualExchangeOverrides,
} from './services/manualExchangeOverrideService';
import {
  appliedFromHistoricalChoice,
  applyBannerAutomationFromChoice,
  inferHistoricalChoiceFromApplied,
  historicalEntryKey,
  historicalAppliedContextFromEntries,
  mergeHistoricalOverridesFromCloud,
  resolveHistoricalAppliedForSubmit,
  resolveNewExpenseHistoricalState,
  subscribeHistoricalOverridesUpdated,
  type HistoricalOverridesUpdatedDetail,
  type HistoricalOverrideBannerOptions,
  type HistoricalOverrideEntry,
  type NewExpenseHistoricalApplied,
} from './services/historicalOverrideService';
import {
  currencySymbol,
  fetchExchangeRates,
  getCachedExchangeRates,
  getLocalTodayIso,
  type ExpenseCurrency,
} from './services/exchangeRateService';
import { layoutToPinnedCodes } from './services/currencyLayoutService';
import {
  EMPTY_USER_APP_DATA,
  loadFromLocalStorage,
  normalizeStoredExpense,
  saveToLocalStorage,
  type StoredCustomCategory,
  type UserAppData,
} from './userDataStorage';
import {
  createBudgetId,
  DEFAULT_MONTHLY_BUDGET_ID,
  ensureDefaultPersonalBudget,
  getBudgetScopedSettings,
  initializeBudgetSettingsForNewPersonalBudget,
  finalizePersonalBudgetDisplayCurrency,
  loadBudgetFinancialLocal,
  loadBudgetRegistryLocal,
  patchPersonalBudgetRegistryTotal,
  mergeRegistryWithRecentLocalPatches,
  resolveSettingsStorageKey,
  saveBudgetFinancialLocal,
  saveBudgetRegistryLocal,
  saveBudgetSettingsLocal,
  snapshotUserAppData,
  type AppShellView,
  type BudgetRegistryState,
  type PersonalBudgetMeta,
} from './services/budgetArchitecture';
import {
  buildInitialPersonalBudgetFinancial,
  convertBudgetFinancialToDisplayCurrency,
  convertTargetBudgetFinancialForCurrencyChange,
  convertRegistryBudgetTotalAmount,
  armFinancialConversionGuard,
  clearFinancialConversionGuard,
  deriveRegistryTotalFromFinancialMonth,
  ensurePersonalBudgetFinancialSeeded,
  overlayFormMonthlySeed,
  isFinancialConversionGuardActive,
  resolveBudgetFinancialForEntry,
  resolveFinancialViewMonthDate,
  shouldRejectEmptyIncomingFinancial,
  shouldRejectStaleIncomingFinancial,
} from './services/budgetFinancialCurrencyService';
import {
  loadBudgetFinancialCloud,
  loadBudgetRegistryCloud,
  migrateLegacyFinancialToDefaultBudget,
  saveBudgetFinancialCloud,
  saveBudgetRegistryCloud,
  subscribeBudgetFinancial,
  subscribeBudgetRegistry,
  dualWriteLinkedBudgetCreationCloud,
  dualWriteMirroredExpenseCloud,
} from './services/budgetCloudSync';
import {
  budgetDebug,
  snapshotFinancialForLog,
  snapshotRegistryTotalsForLog,
} from './services/budgetDebugTrace';
import {
  injectLinkedBudgetIntoMainFinancial,
  buildMirroredExpense,
  loadMainBudgetFinancial,
  mirrorExpenseIntoMainFinancial,
  resolveLinkedBudgetMeta,
} from './services/linkedBudgetSync';
import {
  consumePendingAuthLang,
  readGuestLang,
  setGuestLangActive,
  writePreferredLanguage,
} from './services/authLanguagePreference';
import {
  DEFAULT_GUEST_AVATAR_URL,
  GUEST_AVATAR_STORAGE_KEY,
  getGuestAvatarFromStorage,
  sanitizeAvatarUrl,
} from './services/avatarService';
import {
  clearRegisteredSessionLocalStorage,
  DEFAULT_UI_PREFERENCES,
  EMPTY_USER_SETTINGS,
  type UserSettings,
  type UiPreferences,
  ensureCloudDataMigrated,
  loadHistoricalOverridesFromCloud,
  pruneExpiredCloudExchangeFees,
  saveHistoricalOverrideToCloud,
  saveSettingsToCloud,
  shouldSyncToFirestore,
  subscribeCurrencyCommissions,
  subscribeManualExchangeOverrides,
  subscribeSettings,
} from './services/userFirebaseSync';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { parseMoneyInput, smartRoundMoney, sanitizeMoneyInputDraft, sumMoney } from './services/money';
import MoneyAmountInput from './components/MoneyAmountInput';
import HistoricalOverridePrompt, {
  type HistoricalOverrideApplyChoice,
  type HistoricalOverrideBannerContext,
} from './components/HistoricalOverridePrompt';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  // Canonical date stored as ISO 'YYYY-MM-DD' for reliable month filtering.
  date: string;
  originalAmount?: number;
  originalCurrency?: string;
  /** Commission % baked into `amount` when converted (0 = none). */
  appliedFeePercent?: number;
  /** True when a manual exchange-rate override was used to convert this record. */
  manualRateUsed?: boolean;
  /** Immutable submit-time conversion unit: 1 input currency = X ILS. */
  appliedUnitRateToIls?: number;
  /** Immutable submit-time source of `appliedUnitRateToIls`. */
  appliedRateSource?: 'historical' | 'manual_live' | 'api_spot';
  /** Optional historical archive context key used for submit-time conversion. */
  appliedRateContextKey?: string;
  /** Conversion date used to resolve historical/date-scoped rates. */
  appliedConversionDate?: string;
  /** Persistent override: ignore manual rates, resolve from the date-scoped API rate. */
  manualRateDisabled?: boolean;
  /** Persistent override: drop any conversion fee multiplier for this record. */
  feeDisabled?: boolean;
}

// Sentinel value used by the category <select> to trigger the "add custom" flow
const ADD_CUSTOM_VALUE = '__add_custom__';

// --- Date helpers -----------------------------------------------------------
const pad2 = (n: number) => String(n).padStart(2, '0');

// ISO date string ('YYYY-MM-DD') in local time.
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Month bucket key ('YYYY-MM') used to group/filter expenses.
const monthKeyOf = (iso: string) => iso.slice(0, 7);
const monthKeyOfDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const monthOrder = (monthKey: string) => {
  const [y, m] = monthKey.split('-').map((n) => parseInt(n, 10));
  return y * 12 + (m - 1);
};

// Accepts either an ISO date or a legacy he-IL 'D.M.YYYY' string and returns ISO.
// Keeps historical data working after the move to ISO storage.
const normalizeDate = (raw: string): string => {
  if (!raw) return toISODate(new Date());
  if (raw.includes('-')) return raw;
  const cleaned = raw.replace(/[^\d.]/g, '');
  const parts = cleaned.split('.').map((p) => parseInt(p, 10));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    const [d, m, y] = parts;
    return `${y}-${pad2(m)}-${pad2(d)}`;
  }
  return toISODate(new Date());
};

// ISO -> localized display date.
const formatDisplayDate = (iso: string, lang: 'he' | 'en' = 'he'): string => {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US');
};

// Parse an ISO 'YYYY-MM-DD' into a local Date (midnight).
const parseISO = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
};

// Short numeric date like "1.1.2024" (used for week ranges).
const formatShort = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;

// Week starts on Sunday (common in IL).
const startOfWeek = (d: Date): Date => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - x.getDay());
  return x;
};
const endOfWeek = (d: Date): Date => {
  const s = startOfWeek(d);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
};
const weekNumber = (d: Date): number => {
  const firstWeekStart = startOfWeek(new Date(d.getFullYear(), 0, 1));
  const thisWeekStart = startOfWeek(d);
  return Math.round((thisWeekStart.getTime() - firstWeekStart.getTime()) / (7 * 86400000)) + 1;
};

// Linear-interpolate two hex colors by `amount` (0..1).
const mixHex = (hex: string, target: string, amount: number): string => {
  const parse = (h: string) => [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16));
  const a = parse(hex);
  const b = parse(target);
  return (
    '#' +
    a
      .map((v, i) => Math.max(0, Math.min(255, Math.round(v + (b[i] - v) * amount))).toString(16).padStart(2, '0'))
      .join('')
  );
};

// Two-tone chart fills: vibrant base for spent, soft tint for remaining budget.
const remainingFill = (hex: string) => mixHex(hex, '#ffffff', 0.42);

// Bright warning color for overspent envelopes.
// Distinct slice colors for daily analytics donuts / trend dots.
const DAILY_SLICE_COLORS = [
  '#eab308',
  '#14b8a6',
  '#f43f5e',
  '#6366f1',
  '#10b981',
  '#f97316',
  '#ec4899',
  '#06b6d4',
  '#8b5cf6',
];

const ANALYTICS_SLIDE_COUNT = 3;
// Dots render right-to-left: index 0 = rightmost dot, index 2 = leftmost dot.
// dir="ltr" is forced on the container so this is language-independent.
const ANALYTICS_CHART_ORDER = [2, 1, 0] as const;
const ANALYTICS_CHART_HEIGHT = 320;
const ANALYTICS_DONUT_SIZE = 192;
const ANALYTICS_LINE_HEIGHT = 240;
const GENERAL_KEY = '__general__';
/** Persisted on a month with no allocations so deletes are not re-filled by inheritance. */
const SUB_BUDGET_MONTH_MARKER = '__sb_init__';

const isSubBudgetCategoryKey = (key: string): boolean =>
  key !== GENERAL_KEY && key !== SUB_BUDGET_MONTH_MARKER;

const subBudgetCategoryKeys = (monthMap: Record<string, number>): string[] =>
  Object.keys(monthMap).filter(isSubBudgetCategoryKey);

const hasPositiveSubBudgets = (monthMap: Record<string, number>): boolean =>
  subBudgetCategoryKeys(monthMap).some((k) => (monthMap[k] ?? 0) > 0);

const markSubBudgetMonthInitialized = (monthMap: Record<string, number>): Record<string, number> => {
  if (hasPositiveSubBudgets(monthMap)) {
    const next = { ...monthMap };
    delete next[SUB_BUDGET_MONTH_MARKER];
    return next;
  }
  return { [SUB_BUDGET_MONTH_MARKER]: 0 };
};

const withoutSubBudgetKey = (
  monthMap: Record<string, number>,
  keyToRemove: string,
): Record<string, number> =>
  Object.fromEntries(
    Object.entries(monthMap).filter(([k]) => k !== keyToRemove),
  ) as Record<string, number>;

const monthHasSubBudgetRecord = (
  data: Record<string, Record<string, number>>,
  monthKey: string,
): boolean => Object.prototype.hasOwnProperty.call(data, monthKey);

const monthHasExplicitBudgetRecord = (
  data: Record<string, number>,
  monthKey: string,
): boolean => Object.prototype.hasOwnProperty.call(data, monthKey);

const monthHasExplicitAutoTransferRecord = (
  data: Record<string, boolean>,
  monthKey: string,
): boolean => Object.prototype.hasOwnProperty.call(data, monthKey);

const previousMonthKey = (monthKey: string): string => {
  const [y, m] = monthKey.split('-').map((n) => parseInt(n, 10));
  const prev = new Date(y, (m || 1) - 2, 1);
  return monthKeyOfDate(prev);
};

/** ILS ledger writes use smartRoundMoney to snap conversion drift (e.g. 499.99 → 500). */
const roundMoneyAmount = (value: number): number => smartRoundMoney(value);

const compareSubBudgetCategoryKeys = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

const findNearestPriorMonthWithSubBudgets = (
  targetMonthKey: string,
  subBudgetsByMonth: Record<string, Record<string, number>>,
): string | null => {
  const targetOrder = monthOrder(targetMonthKey);
  const candidates = Object.keys(subBudgetsByMonth).filter((key) => {
    if (monthOrder(key) >= targetOrder) return false;
    return hasPositiveSubBudgets(subBudgetsByMonth[key] ?? {});
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => monthOrder(b) - monthOrder(a));
  return candidates[0] ?? null;
};

const EMPTY_NEW_EXPENSE_HISTORICAL_APPLIED: NewExpenseHistoricalApplied = {
  rateEntry: null,
  feeEntry: null,
};

function isAutomationOnlyHistoricalUpdate(event: Event): boolean {
  if (!(event instanceof CustomEvent)) return false;
  const detail = event.detail as HistoricalOverridesUpdatedDetail | undefined;
  return detail?.automationOnly === true;
}

// Top-level navigation tabs.
const TABS = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'analytics', icon: PieChartIcon },
  { id: 'subbudgets', icon: Wallet },
  { id: 'expenses', icon: Receipt },
] as const;
type MainTabId = (typeof TABS)[number]['id'];
type TabId = MainTabId | 'profile';

type HistoryTimeFilter = 'daily' | 'weekly' | 'monthly' | 'yearly';

const HISTORY_TIME_FILTERS: { id: HistoryTimeFilter }[] = [
  { id: 'daily' },
  { id: 'weekly' },
  { id: 'monthly' },
  { id: 'yearly' },
];

/** Identical column template for expense history header + data rows (desktop). */
const EXPENSE_HISTORY_ROW_GRID =
  'grid w-full grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1.25fr)_minmax(0,1fr)_4.5rem] items-center gap-x-3';

function shouldShowExpenseEquivalentLine(
  expense: { originalAmount?: number; originalCurrency?: string },
  displayCurrency: ExpenseCurrency,
): boolean {
  const hasOriginal =
    expense.originalAmount != null &&
    expense.originalAmount > 0 &&
    Boolean(expense.originalCurrency?.trim());
  if (!hasOriginal) {
    return displayCurrency !== 'ILS';
  }
  const expenseCurrency = symbolToCurrency(expense.originalCurrency!, displayCurrency);
  if (!expenseCurrency) {
    return true;
  }
  return expenseCurrency !== displayCurrency;
}

const expenseMatchesHistoryTimeFilter = (
  expenseDate: string,
  filter: HistoryTimeFilter,
  today: Date = new Date()
): boolean => {
  const iso = normalizeDate(expenseDate);
  const d = parseISO(iso);
  const todayIso = toISODate(today);

  switch (filter) {
    case 'daily':
      return iso === todayIso;
    case 'weekly': {
      const weekStart = startOfWeek(today);
      const weekEnd = endOfWeek(today);
      weekEnd.setHours(23, 59, 59, 999);
      return d >= weekStart && d <= weekEnd;
    }
    case 'monthly':
      return monthKeyOf(iso) === monthKeyOfDate(today);
    case 'yearly':
      return d.getFullYear() === today.getFullYear();
    default:
      return true;
  }
};

interface CollapsibleNavMenuProps {
  activeTab: TabId;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTabSelect: (id: TabId) => void;
  variant: 'mobile' | 'desktop';
  userEmail?: string | null;
  onLogout?: () => void;
}

// Collapsible nav: header dropdown on mobile, compact toggle on desktop.
function CollapsibleNavMenu({
  activeTab,
  open,
  onOpenChange,
  onTabSelect,
  variant,
  userEmail,
  onLogout,
}: CollapsibleNavMenuProps) {
  const { tr, dir } = useLanguage();
  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const ActiveIcon = active.icon;
  const tabLabel = (tabId: TabId) => {
    switch (tabId) {
      case 'dashboard':
        return tr('tabDashboard');
      case 'analytics':
        return tr('tabAnalytics');
      case 'subbudgets':
        return tr('tabSubbudgets');
      case 'expenses':
        return tr('tabExpenses');
      case 'profile':
        return tr('profile');
      default:
        return tabId;
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const toggleOpen = () => onOpenChange(!open);

  // Desktop-only backdrop (rendered inside the menu component for the sidebar)
  const backdrop =
    variant === 'desktop' ? (
      <button
        type="button"
        aria-label={tr('closeMenu')}
        onClick={() => onOpenChange(false)}
        className={`fixed inset-0 z-40 hidden bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:block ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />
    ) : null;

  const tabButton = (tab: (typeof TABS)[number], index: number) => {
    const Icon = tab.icon;
    const isActive = tab.id === activeTab;

    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => onTabSelect(tab.id)}
        style={{ transitionDelay: open ? `${index * 40}ms` : '0ms' }}
        className={`flex items-center gap-2.5 rounded-2xl border text-sm font-medium transition-all duration-300 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
          variant === 'mobile' ? 'w-full px-4 py-3.5' : 'w-full px-3 py-2.5'
        } ${
          isActive
            ? utilityNavActiveTabClass
            : `${utilityNavButtonLgClass} border-[var(--btn-nav-border)]`
        } ${
          open
            ? 'opacity-100 translate-y-0 scale-100'
            : variant === 'mobile'
              ? 'opacity-0 translate-y-3 scale-95 pointer-events-none'
              : 'opacity-0 -translate-y-1 scale-95 pointer-events-none'
        }`}
        aria-current={isActive ? 'page' : undefined}
      >
        <span
          className={`shrink-0 flex items-center justify-center rounded-xl ${
            variant === 'mobile' ? 'w-10 h-10' : 'w-9 h-9'
          } ${utilityNavIconBadgeClass} ${isActive ? 'opacity-90' : ''}`}
        >
          <Icon
            className={`${variant === 'mobile' ? 'w-5 h-5' : 'w-4 h-4'} ${
              isActive
                ? 'text-[var(--btn-primary-fg,var(--color-category-5))]'
                : primaryActionAccentIconClass
            }`}
          />
        </span>
        <span className={`flex-1 truncate ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{tabLabel(tab.id)}</span>
      </button>
    );
  };

  if (variant === 'mobile') {
    return (
      <div className="relative md:hidden">
        {backdrop}
        <button
          type="button"
          onClick={toggleOpen}
          aria-label={open ? tr('closeMenu') : tr('tabDashboard')}
          aria-expanded={open}
          aria-haspopup="menu"
          className={`h-10 w-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 active:scale-95 ${utilityNavMenuToggleClass}`}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <div
          role="menu"
          aria-hidden={!open}
          className={`absolute top-full mt-2 end-0 z-[60] flex w-[min(100vw-2rem,22rem)] flex-col gap-1.5 rounded-2xl p-2 backdrop-blur-md transition-all duration-200 ease-out origin-top ${filterDropdownWrapperClass} ${
            open
              ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
          }`}
        >
          {userEmail && (
            <p className={`truncate border-b border-[var(--page-border)] px-2 py-1 text-xs ${themeTextMutedClass}`} title={userEmail}>
              {userEmail}
            </p>
          )}
          {TABS.map((tab, i) => tabButton(tab, i))}
          {onLogout && (
            <button
              type="button"
              onClick={() => {
                onLogout();
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm font-medium hover:bg-rose-500/20 transition-all active:scale-[0.98]"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span className={`flex-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{tr('logout')}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Desktop: compact toggle in header, dropdown panel below it.
  return (
    <>
      {backdrop}
      <div className="hidden md:block relative">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          aria-haspopup="menu"
          className={`flex items-center gap-2 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
            open ? utilityNavActiveTabClass : utilityNavButtonLgClass
          }`}
        >
          <span className={`w-8 h-8 ${utilityNavIconBadgeClass}`}>
            <ActiveIcon className={`w-4 h-4 ${primaryActionAccentIconClass}`} />
          </span>
          <span className={themeTextClass}>{tabLabel(active.id)}</span>
          <ChevronUp
            className={`w-4 h-4 ${themeTextMutedClass} transition-transform duration-300 ease-in-out ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        <div
          role="menu"
          aria-hidden={!open}
          className={`absolute top-full mt-2 end-0 min-w-[12.5rem] p-2 rounded-2xl backdrop-blur-md flex flex-col gap-1.5 transition-all duration-300 ease-in-out origin-top ${filterDropdownWrapperClass} ${
            open
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
          }`}
        >
          {TABS.map((tab, i) => tabButton(tab, i))}
          {onLogout && (
            <>
              <div className="h-px bg-[var(--page-border)] my-1" />
              {userEmail && (
                <p className={`px-2 py-1 text-[11px] truncate ${themeTextMutedClass}`} title={userEmail}>
                  {userEmail}
                </p>
              )}
              <button
                type="button"
                onClick={() => {
                  onLogout();
                  onOpenChange(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-rose-300 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/30 transition-all"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {tr('logout')}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

interface MobileBottomNavProps {
  activeTab: TabId;
  onOpenProfile: () => void;
  onTabSelect: (id: TabId) => void;
}

function MobileBottomNav({ activeTab, onOpenProfile, onTabSelect }: MobileBottomNavProps) {
  const { tr, dir } = useLanguage();

  const items = useMemo(
    () => [
      {
        key: 'profile',
        icon: UserIcon,
        label: tr('profile'),
        isActive: activeTab === 'profile',
        onClick: () => onOpenProfile(),
      },
      {
        key: 'expenses',
        icon: Receipt,
        label: tr('tabExpenses'),
        isActive: activeTab === 'expenses',
        onClick: () => onTabSelect('expenses'),
      },
      {
        key: 'analytics',
        icon: PieChartIcon,
        label: tr('tabAnalytics'),
        isActive: activeTab === 'analytics',
        onClick: () => onTabSelect('analytics'),
      },
      {
        key: 'subbudgets',
        icon: Wallet,
        label: tr('tabSubbudgets'),
        isActive: activeTab === 'subbudgets',
        onClick: () => onTabSelect('subbudgets'),
      },
      {
        key: 'dashboard',
        icon: LayoutDashboard,
        label: tr('tabDashboard'),
        isActive: activeTab === 'dashboard',
        onClick: () => onTabSelect('dashboard'),
      },
    ],
    [tr, activeTab, onOpenProfile, onTabSelect],
  );

  return (
    <nav
      aria-label={tr('tabDashboard')}
      className="fixed bottom-0 left-0 z-[100] flex w-full border-t border-[var(--page-border)] bg-[var(--page-surface)]/90 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_30px_-5px_rgba(0,0,0,0.12)] backdrop-blur-lg md:hidden"
    >
      <div dir={dir} className="flex min-h-16 w-full items-center justify-between py-1.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              onClick={item.onClick}
              aria-current={item.isActive ? 'page' : undefined}
              className="flex min-h-[3.25rem] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center px-1 touch-manipulation transition-transform active:scale-95"
            >
              <span
                className={`mb-1 flex items-center justify-center transition-all duration-300 ${
                  item.isActive
                    ? 'rounded-full bg-emerald-100 px-4 py-1 dark:bg-emerald-900/40'
                    : 'px-4 py-1'
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 ${item.isActive ? 'text-emerald-500' : themeTextMutedClass}`}
                />
              </span>
              <span
                className={`line-clamp-2 max-w-full whitespace-normal px-0.5 text-center text-[10px] leading-tight ${
                  item.isActive ? `font-medium text-emerald-500` : themeTextMutedClass
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

interface MonthNavigationBarProps {
  monthLabel: string;
  monthValue: string;
  isCurrentMonth: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoToCurrent: () => void;
  onMonthChange: (monthKey: string) => void;
  compact?: boolean;
  className?: string;
}

function MonthNavigationBar({
  monthLabel,
  monthValue,
  isCurrentMonth,
  onPrev,
  onNext,
  onGoToCurrent,
  onMonthChange,
  compact = false,
  className = '',
}: MonthNavigationBarProps) {
  const { tr } = useLanguage();
  const monthInputRef = useRef<HTMLInputElement>(null);

  const openMonthPicker = () => {
    const inputEl = monthInputRef.current;
    if (!inputEl) return;
    const pickerCapable = inputEl as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerCapable.showPicker === 'function') {
      pickerCapable.showPicker();
      return;
    }
    inputEl.click();
  };

  const handleMonthInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value) onMonthChange(value);
  };

  const navButtonClass = [
    'relative z-10 flex shrink-0 cursor-pointer items-center justify-center',
    'pointer-events-auto min-h-11 min-w-11 p-3',
    'rounded-full text-neutral-400',
    'transition-colors hover:bg-white/10 active:scale-95',
    'touch-manipulation',
  ].join(' ');
  const chevronClass = compact ? 'pointer-events-none h-5 w-5' : 'pointer-events-none h-6 w-6';
  const labelTextClass = compact
    ? 'text-sm sm:text-base font-semibold capitalize truncate'
    : 'text-base sm:text-lg font-semibold capitalize truncate';

  return (
    <div
      dir="ltr"
      className={['relative z-50 flex items-center justify-between gap-2', className].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        onClick={onPrev}
        className={navButtonClass}
        aria-label={tr('prevMonth')}
        title={tr('prevMonth')}
      >
        <ChevronLeft className={chevronClass} />
      </button>

      <div className="flex min-w-0 flex-col items-center">
        <button
          type="button"
          onClick={openMonthPicker}
          className="relative flex min-w-0 cursor-pointer items-center gap-2 text-neutral-100 transition-all hover:opacity-80"
          aria-label={tr('date')}
          title={tr('date')}
        >
          <CalendarDays className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} shrink-0 text-emerald-400`} />
          <span className={labelTextClass}>{monthLabel}</span>
          <input
            ref={monthInputRef}
            type="month"
            value={monthValue}
            onChange={handleMonthInputChange}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
            tabIndex={-1}
            aria-hidden
          />
        </button>
        {!isCurrentMonth && (
          <button
            type="button"
            onClick={onGoToCurrent}
            className="mt-0.5 text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300 active:opacity-70"
          >
            {tr('backToCurrentMonth')}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        className={navButtonClass}
        aria-label={tr('nextMonth')}
        title={tr('nextMonth')}
      >
        <ChevronRight className={chevronClass} />
      </button>
    </div>
  );
}

interface ExpenseSummaryProps {
  expenses: Expense[];
  categories: Category[];
}

type DonutLegendItem = {
  key: string;
  label: string;
  hex: string;
  amount: number;
  percentage: number;
  icon?: Category['icon'];
  colorClass?: string;
  ring?: boolean;
};

// Reusable donut + side legend block for analytics carousel slides.
function AnalyticsDonutPanel({
  total,
  donutData,
  legend,
  paddingSlices,
  chartKey,
  donutSize = ANALYTICS_DONUT_SIZE,
}: {
  total: number;
  donutData: { name: string; value: number; hex: string }[];
  legend: DonutLegendItem[];
  paddingSlices: boolean;
  chartKey: string;
  donutSize?: number;
}) {
  const { tr } = useLanguage();
  const projection = useDisplayProjection();
  return (
    <div className="flex items-center gap-4 w-full h-full min-h-0">
      <div
        className="relative shrink-0"
        style={{ width: donutSize, height: donutSize, minWidth: donutSize, minHeight: donutSize }}
      >
        <ResponsiveContainer width={donutSize} height={donutSize} key={chartKey}>
          <PieChart>
            <Pie
              data={donutData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="100%"
              paddingAngle={paddingSlices ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {donutData.map((entry, i) => (
                <Cell key={i} fill={entry.hex} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <DisplayCurrencyAmount amount={total} className="text-xl sm:text-2xl font-bold leading-none" />
          <span className={`text-[11px] mt-1 ${typographyMutedClass}`}>{tr('totalShort')}</span>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {legend.length === 0 ? (
          <p className={`text-sm ${typographyMutedClass}`}>{tr('noData')}</p>
        ) : (
          legend.slice(0, 6).map((item) => (
            <div key={item.key} className="flex items-center gap-2.5 text-sm min-w-0">
              {item.icon && item.colorClass ? (
                <CategoryIconBadge
                  icon={item.icon}
                  hex={item.hex}
                  colorClass={item.colorClass}
                  size="compact"
                />
              ) : (
                <span
                  className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                    item.ring ? 'border-[3px] bg-transparent' : ''
                  }`}
                  style={
                    item.ring
                      ? { borderColor: item.hex }
                      : { backgroundColor: item.hex }
                  }
                  aria-hidden
                />
              )}
              <span className={`truncate flex-1 ${typographyBodyClass}`}>{item.label}</span>
              <span className={`font-medium shrink-0 tabular-nums ${typographyMutedClass}`}>
                {item.percentage > 0 ? (
                  `${item.percentage.toFixed(2)}%`
                ) : (
                  projection.format(item.amount)
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const formatDayLabel = (iso: string, lang: 'he' | 'en' = 'he'): string => {
  const d = parseISO(iso);
  return d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short' });
};

// Tooltip / hover label for trend chart (e.g. "31 במאי" or "31/05/2026").
const formatTrendDateLabel = (iso: string, lang: 'he' | 'en' = 'he'): string => {
  const d = parseISO(iso);
  const short = d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short' });
  const numeric = `${d.getDate()}/${pad2(d.getMonth() + 1)}`;
  return `${short} · ${numeric}`;
};

type TrendSeriesPoint = {
  iso: string;
  day: number;
  dayLabel: string;
  dateLabel: string;
  amount: number;
  hex: string;
};

// Builds a continuous timeline: every day (or month in year view) with amount 0 when empty.
const buildContinuousTrendSeries = (
  view: SummaryView,
  anchor: Date,
  amountByDate: Record<string, number>,
  lang: 'he' | 'en' = 'he',
  hourlyAmounts?: number[],
): { dailySeries: TrendSeriesPoint[]; periodDayCount: number } => {
  const points: TrendSeriesPoint[] = [];

  if (view === 'daily') {
    const dayIso = toISODate(anchor);
    const buckets = hourlyAmounts ?? Array(24).fill(0);
    if (hourlyAmounts == null) {
      const dayTotal = amountByDate[dayIso] ?? 0;
      buckets[12] = dayTotal;
    }
    for (let hour = 0; hour < 24; hour++) {
      points.push({
        iso: `${dayIso}_${pad2(hour)}`,
        day: hour,
        dayLabel: pad2(hour),
        dateLabel: `${pad2(hour)}:00`,
        amount: buckets[hour] ?? 0,
        hex: DAILY_SLICE_COLORS[hour % DAILY_SLICE_COLORS.length],
      });
    }
    return { dailySeries: points, periodDayCount: 1 };
  }

  if (view === 'month') {
    const y = anchor.getFullYear();
    const m = anchor.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${y}-${pad2(m + 1)}-${pad2(day)}`;
      const amount = amountByDate[iso] ?? 0;
      points.push({
        iso,
        day,
        dayLabel: String(day),
        dateLabel: formatTrendDateLabel(iso, lang),
        amount,
        hex: DAILY_SLICE_COLORS[(day - 1) % DAILY_SLICE_COLORS.length],
      });
    }
    return { dailySeries: points, periodDayCount: daysInMonth };
  }

  if (view === 'week') {
    const start = startOfWeek(anchor);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = toISODate(d);
      const amount = amountByDate[iso] ?? 0;
      points.push({
        iso,
        day: d.getDate(),
        dayLabel: d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { weekday: 'narrow' }),
        dateLabel: formatTrendDateLabel(iso, lang),
        amount,
        hex: DAILY_SLICE_COLORS[i % DAILY_SLICE_COLORS.length],
      });
    }
    return { dailySeries: points, periodDayCount: 7 };
  }

  const y = anchor.getFullYear();
  const amountByMonth: Record<string, number> = {};
  for (const [iso, amount] of Object.entries(amountByDate)) {
    const monthKey = iso.slice(0, 7);
    amountByMonth[monthKey] = (amountByMonth[monthKey] || 0) + amount;
  }
  for (let m = 0; m < 12; m++) {
    const iso = `${y}-${pad2(m + 1)}-01`;
    const monthKey = `${y}-${pad2(m + 1)}`;
    const amount = amountByMonth[monthKey] ?? 0;
    const monthLongLabel = new Date(y, m, 1).toLocaleDateString(
      lang === 'he' ? 'he-IL' : 'en-US',
      { month: 'long' },
    );
    points.push({
      iso,
      day: m + 1,
      dayLabel: monthLongLabel,
      dateLabel: new Date(y, m, 1).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'long', year: 'numeric' }),
      amount,
      hex: DAILY_SLICE_COLORS[m % DAILY_SLICE_COLORS.length],
    });
  }
  return { dailySeries: points, periodDayCount: 12 };
};

// Hebrew date string for the static selected-day summary (e.g. "31 במאי").
const formatTooltipDate = (iso: string, lang: 'he' | 'en' = 'he'): string => {
  const d = parseISO(iso);
  return d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'long' });
};

const TREND_SELECTED_DOT_FILL = '#2563eb';
const TREND_TRACK_STROKE = '#3f3f46';
const TREND_DOT_FILL = '#525252';
const TREND_DOT_STROKE = '#404040';

function defaultTrendSelectionIso(
  series: TrendSeriesPoint[],
  view: SummaryView,
  anchor: Date,
): string | null {
  if (series.length === 0) return null;

  const todayIso = toISODate(new Date());
  const todayInSeries = series.find((p) => p.iso === todayIso);

  if (view === 'daily') {
    const lastWithAmount = [...series].reverse().find((p) => p.amount > 0);
    if (lastWithAmount) return lastWithAmount.iso;
    return series[12]?.iso ?? series[0]?.iso ?? null;
  }
  if (view === 'month' && monthKeyOf(todayIso) === monthKeyOfDate(anchor) && todayInSeries) {
    return todayInSeries.iso;
  }
  if (view === 'week') {
    const s = startOfWeek(anchor);
    const e = endOfWeek(anchor);
    const t = parseISO(todayIso);
    if (t >= s && t <= e && todayInSeries) return todayInSeries.iso;
  }
  if (view === 'year' && anchor.getFullYear() === new Date().getFullYear()) {
    const monthPoint = series.find((p) => p.iso.startsWith(todayIso.slice(0, 7)));
    if (monthPoint) return monthPoint.iso;
  }

  const lastWithAmount = [...series].reverse().find((p) => p.amount > 0);
  return lastWithAmount?.iso ?? series[series.length - 1].iso;
}

function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const onChange = () => setCoarse(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return coarse;
}

function trendPointFromChartState(
  state: unknown,
  dailySeries: TrendSeriesPoint[],
): TrendSeriesPoint | null {
  if (!state || typeof state !== 'object') return null;
  const chartState = state as {
    activeTooltipIndex?: number;
    activeIndex?: number;
    activePayload?: ReadonlyArray<{ payload?: TrendSeriesPoint }>;
  };
  const fromPayload = chartState.activePayload?.[0]?.payload;
  if (fromPayload?.iso) return fromPayload;
  const idx = chartState.activeTooltipIndex ?? chartState.activeIndex;
  if (typeof idx === 'number' && dailySeries[idx]) return dailySeries[idx];
  return null;
}

// Dark-themed analytics: swipeable category / daily donuts + daily trend line.
function ExpenseSummary({ expenses, categories }: ExpenseSummaryProps) {
  const { tr, lang } = useLanguage();
  // Every analytics aggregation below is computed from amounts projected from each
  // expense's immutable baseline into the active display currency.
  const projection = useDisplayProjection();
  const [view, setView] = useState<SummaryView>('month');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [chartSlide, setChartSlide] = useState(0);
  const [chartDirection, setChartDirection] = useState<'forward' | 'backward'>('forward');
  const [selectedTrendIso, setSelectedTrendIso] = useState<string | null>(null);
  const isCoarsePointer = useCoarsePointer();
  const touchStartXRef = useRef<number | null>(null);
  const showMultiChartViews = view !== 'daily';
  const maxChartSlideIndex = showMultiChartViews ? ANALYTICS_SLIDE_COUNT - 1 : 0;
  const trendXAxisInterval =
    view === 'month' ? 6 : view === 'year' ? 1 : view === 'daily' ? 3 : 0;

  const goToChartSlide = useCallback((nextIndex: number) => {
    const clampedNextIndex = Math.max(0, Math.min(maxChartSlideIndex, nextIndex));
    setChartSlide((current) => {
      if (clampedNextIndex === current) return current;
      setChartDirection(clampedNextIndex > current ? 'forward' : 'backward');
      return clampedNextIndex;
    });
  }, [maxChartSlideIndex]);

  useEffect(() => {
    if (view === 'daily') {
      setChartSlide(0);
    }
  }, [view]);
  const chartSlideVariants = useMemo(
    () => ({
      enter: (direction: 'forward' | 'backward') => ({
        x: direction === 'forward' ? '-100%' : '100%',
        opacity: 0,
      }),
      center: { x: 0, opacity: 1 },
      exit: (direction: 'forward' | 'backward') => ({
        x: direction === 'forward' ? '100%' : '-100%',
        opacity: 0,
      }),
    }),
    [],
  );

  const shift = (dir: number) => {
    setAnchor((a) => {
      const x = new Date(a);
      if (view === 'daily') x.setDate(x.getDate() + dir);
      else if (view === 'week') x.setDate(x.getDate() + dir * 7);
      else if (view === 'month') x.setMonth(x.getMonth() + dir);
      else x.setFullYear(x.getFullYear() + dir);
      return x;
    });
  };

  const anchorMonthKey = monthKeyOfDate(anchor);

  const inPeriod = (rawDate: string): boolean => {
    const iso = normalizeDate(rawDate);
    const d = parseISO(iso);
    if (view === 'daily') return iso === toISODate(anchor);
    if (view === 'year') return d.getFullYear() === anchor.getFullYear();
    if (view === 'month') return monthKeyOf(iso) === anchorMonthKey;
    const s = startOfWeek(anchor);
    const e = endOfWeek(anchor);
    return d >= s && d <= new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59);
  };

  const periodExpenses = useMemo(
    () =>
      expenses
        .filter((e) => inPeriod(e.date))
        .map((e) => ({ ...e, date: normalizeDate(e.date) })),
    [expenses, view, anchor, anchorMonthKey]
  );

  // Project each expense's baseline into the active display currency ONCE, then
  // drive every chart/legend/trend total from these `amount`s so the whole
  // analytics screen stays consistent across ILS / USD / GBP / EUR.
  const periodExpensesDisplay = useMemo(
    () => periodExpenses.map((e) => ({ ...e, amount: projection.projectExpense(e) })),
    [periodExpenses, projection],
  );

  const chartPeriodKey =
    view === 'daily'
      ? `${view}-${toISODate(anchor)}`
      : `${view}-${anchorMonthKey}-${anchor.getFullYear()}-${anchor.getMonth()}-${weekNumber(anchor)}`;

  const total = periodExpensesDisplay.reduce((sum, e) => sum + e.amount, 0);

  const breakdown = useMemo(
    () => aggregateByCategory(periodExpensesDisplay, categories),
    [periodExpensesDisplay, categories]
  );

  const categoryDonutData =
    breakdown.length > 0
      ? breakdown.map((b) => ({ name: b.label, value: b.amount, hex: b.hex }))
      : [{ name: '', value: 1, hex: '#27272a' }];

  const dailyBreakdown = useMemo(() => {
    if (view === 'daily') {
      return periodExpensesDisplay
        .map((e, i) => {
          const cat = lookupCategory(e.category, categories);
          const label = e.description.trim() || cat.label;
          return {
            date: e.id,
            label,
            amount: e.amount,
            hex: DAILY_SLICE_COLORS[i % DAILY_SLICE_COLORS.length],
            percentage: total > 0 ? (e.amount / total) * 100 : 0,
          };
        })
        .sort((a, b) => b.amount - a.amount);
    }

    const grouped = periodExpensesDisplay.reduce<Record<string, number>>((acc, e) => {
      const iso = normalizeDate(e.date);
      acc[iso] = (acc[iso] || 0) + e.amount;
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([date, amount], i) => ({
        date,
        label: formatDayLabel(date, lang),
        amount,
        hex: DAILY_SLICE_COLORS[i % DAILY_SLICE_COLORS.length],
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [view, periodExpensesDisplay, categories, total, lang]);

  const dailyDonutData =
    dailyBreakdown.length > 0
      ? dailyBreakdown.map((d) => ({ name: d.label, value: d.amount, hex: d.hex }))
      : [{ name: '', value: 1, hex: '#27272a' }];

  const amountByDate = useMemo(
    () =>
      periodExpensesDisplay.reduce<Record<string, number>>((acc, e) => {
        const iso = normalizeDate(e.date);
        acc[iso] = (acc[iso] || 0) + e.amount;
        return acc;
      }, {}),
    [periodExpensesDisplay],
  );

  const hourlyAmounts = useMemo(() => {
    if (view !== 'daily') return undefined;
    const buckets = Array(24).fill(0);
    periodExpensesDisplay.forEach((e, i) => {
      const hour = 8 + (i % 12);
      buckets[hour] += e.amount;
    });
    return buckets;
  }, [view, periodExpensesDisplay]);

  const { dailySeries, periodDayCount } = useMemo(
    () => buildContinuousTrendSeries(view, anchor, amountByDate, lang, hourlyAmounts),
    [view, anchor, amountByDate, lang, hourlyAmounts],
  );

  const average = periodDayCount > 0 ? total / periodDayCount : 0;
  // Floor the Y-axis at ~250 ILS projected into the active display currency so the
  // trend keeps a sensible baseline scale regardless of the selected currency.
  const trendFloor = projection.projectOriginalOrIls(null, 250);
  const trendMax = Math.max(trendFloor, ...dailySeries.map((d) => d.amount), 1);

  useEffect(() => {
    const nextIso = defaultTrendSelectionIso(dailySeries, view, anchor);
    setSelectedTrendIso((prev) => (prev === nextIso ? prev : nextIso));
  }, [dailySeries, view, anchor]);

  const selectedTrendPoint = useMemo(
    () => dailySeries.find((p) => p.iso === selectedTrendIso) ?? null,
    [dailySeries, selectedTrendIso],
  );

  const applyTrendSelectionFromChartState = useCallback(
    (state: unknown) => {
      const point = trendPointFromChartState(state, dailySeries);
      if (point) setSelectedTrendIso(point.iso);
    },
    [dailySeries],
  );

  const trendChartHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartSlide !== 2) return;
    const root = trendChartHostRef.current;
    if (!root) return;

    let rafId: number | null = null;
    const neutralizeRechartsFocus = () => {
      root.querySelectorAll('.recharts-wrapper, .recharts-surface, svg').forEach((node) => {
        if (node instanceof HTMLElement) {
          // Avoid re-writing unchanged attributes; this prevents observer loops.
          if (node.getAttribute('tabindex') !== '-1') {
            node.setAttribute('tabindex', '-1');
          }
          node.style.outline = 'none';
          node.style.boxShadow = 'none';
        }
        if (node instanceof SVGElement) {
          node.setAttribute('focusable', 'false');
          node.style.outline = 'none';
        }
      });
    };

    neutralizeRechartsFocus();
    const observer = new MutationObserver(() => {
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        neutralizeRechartsFocus();
      });
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (rafId != null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [chartSlide, chartPeriodKey, dailySeries.length]);

  let periodLabel = '';
  let periodSubtitle = '';
  if (view === 'daily') {
    periodLabel = formatTrendDateLabel(toISODate(anchor), lang);
  } else if (view === 'year') {
    periodLabel = `${anchor.getFullYear()}`;
  } else if (view === 'month') {
    periodLabel = anchor.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'long', year: 'numeric' });
  } else {
    periodLabel = `${tr('weekPrefix')} ${weekNumber(anchor)}`;
    periodSubtitle = `${formatShort(startOfWeek(anchor))} - ${formatShort(endOfWeek(anchor))}`;
  }

  const chipOffsets = [-3, -2, -1, 0, 1];
  const chips = chipOffsets.map((offset) => {
    const d = new Date(anchor);
    if (view === 'daily') d.setDate(d.getDate() + offset);
    else if (view === 'week') d.setDate(d.getDate() + offset * 7);
    else if (view === 'month') d.setMonth(d.getMonth() + offset);
    else d.setFullYear(d.getFullYear() + offset);

    let label: string;
    if (view === 'daily') label = formatDayLabel(toISODate(d), lang);
    else if (view === 'year') label = `${d.getFullYear()}`;
    else if (view === 'month') label = d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'short' });
    else label = `${tr('weekPrefix')} ${weekNumber(d)}`;

    return { offset, date: d, label };
  });

  const views: { id: SummaryView; label: string }[] = [
    { id: 'daily', label: tr('viewDaily') },
    { id: 'week', label: tr('viewWeek') },
    { id: 'month', label: tr('viewMonth') },
    { id: 'year', label: tr('viewYear') },
  ];

  const formatTrendSummaryDate = useCallback(
    (iso: string, summaryLang: 'he' | 'en') => {
      const hourMatch = iso.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})$/);
      if (view === 'daily' && hourMatch) {
        const [, dayPart, hour] = hourMatch;
        return `${formatTrendDateLabel(dayPart, summaryLang)} · ${hour}:00`;
      }
      if (view === 'daily') {
        return formatTrendDateLabel(iso.slice(0, 10), summaryLang);
      }
      return formatTooltipDate(iso, summaryLang);
    },
    [view],
  );

  const handleCarouselDragEnd = (_: unknown, info: PanInfo) => {
    const offset = info.offset.x;
    const velocity = info.velocity.x;
    // RTL-friendly flow:
    // finger left->right => move to the graph on the right (dot index -1)
    // finger right->left => move to the graph on the left (dot index +1)
    if (offset < -50 || velocity < -400) {
      goToChartSlide(chartSlide - 1);
    } else if (offset > 50 || velocity > 400) {
      goToChartSlide(chartSlide + 1);
    }
  };

  const handleTrendTouchStartCapture = (event: TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const handleTrendTouchEndCapture = (event: TouchEvent<HTMLDivElement>) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX == null) return;

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const deltaX = endX - startX;
    const threshold = 35;
    if (Math.abs(deltaX) < threshold) return;

    if (deltaX > 0) {
      goToChartSlide(chartSlide + 1);
      return;
    }
    goToChartSlide(chartSlide - 1);
  };

  const categoryLegend: DonutLegendItem[] = breakdown.map((b) => ({
    key: b.value,
    label: b.label,
    hex: b.hex,
    amount: b.amount,
    percentage: b.percentage,
    icon: b.icon,
    colorClass: b.color,
  }));

  const dailyLegend: DonutLegendItem[] = dailyBreakdown.map((d) => ({
    key: d.date,
    label: d.label,
    hex: d.hex,
    amount: d.amount,
    percentage: 0,
    ring: true,
  }));

  return (
    <div className={`mx-auto max-w-2xl ${themeCardClass} p-4 sm:p-6`}>
      <div>
        <div className="mb-4">
          <div className={`flex items-center gap-2 ${typographyTitleClass}`}>
            <PieChartIcon className="h-6 w-6 shrink-0 text-emerald-400" />
            <h2 className="text-lg font-bold sm:text-xl">{tr('tabAnalytics')}</h2>
          </div>
          <p className={`mt-1 text-xs ${typographyMutedClass}`}>{tr('tabAnalyticsDesc')}</p>
        </div>

        <div className={filterBarContainerClass}>
          {views.map((v) => (
            <button
              type="button"
              key={v.id}
              onClick={() => {
                if (view === v.id) return;
                if (v.id === 'daily') setChartSlide(0);
                setView(v.id);
              }}
              className={`flex-1 py-2.5 text-sm ${
                view === v.id ? filterBarActiveTabClass : filterBarInactiveTabClass
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div dir="ltr" className="flex items-center gap-1 mt-4">
          <button
            type="button"
            onClick={() => shift(-1)}
            className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl active:scale-95 transition-all ${utilityIconButtonGhostClass}`}
            aria-label={tr('prev')}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 overflow-x-auto no-scrollbar">
            <div className="flex items-center justify-between gap-1 min-w-max px-1">
              {chips.map((chip) => {
                const active = chip.offset === 0;
                return (
                  <button
                    key={chip.offset}
                    type="button"
                    onClick={() => setAnchor(chip.date)}
                    className={`relative px-3 py-2 text-sm whitespace-nowrap transition-colors ${
                      active ? 'text-white font-semibold' : 'text-neutral-500 hover:text-neutral-300'
                    }`}
                  >
                    {chip.label}
                    {active && (
                      <span className="absolute -bottom-0.5 inset-x-2 h-0.5 rounded-full bg-yellow-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => shift(1)}
            className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl active:scale-95 transition-all ${utilityIconButtonGhostClass}`}
            aria-label={tr('next')}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-3 text-center">
          <p className={`text-base font-semibold capitalize ${typographyTitleClass}`}>{periodLabel}</p>
          {periodSubtitle && <p className={`text-xs mt-0.5 ${typographyMutedClass}`}>{periodSubtitle}</p>}
        </div>

        {/* Swipeable chart carousel — order is fixed and language-independent. */}
        <div
          dir="ltr"
          className={`relative mt-6 w-full touch-pan-y overflow-hidden outline-none focus:outline-none focus-visible:outline-none ${filterInsetPanelClass}`}
          style={{ height: ANALYTICS_CHART_HEIGHT, minHeight: ANALYTICS_CHART_HEIGHT }}
        >
          {/* Swipe layer disabled on trend slide (and daily view) so hover/tap reaches the chart */}
          <motion.div
            className={`absolute inset-0 ${!showMultiChartViews || chartSlide === 2 ? 'pointer-events-none z-0' : 'z-10'}`}
            drag={!showMultiChartViews || chartSlide === 2 ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            dragMomentum={false}
            onDragEnd={handleCarouselDragEnd}
            aria-hidden
          />

          <AnimatePresence mode="popLayout" initial={false}>
            {chartSlide === 0 && (
              <motion.div
                key={`slide-0-${chartPeriodKey}`}
                className="absolute inset-0 flex h-full w-full flex-col px-1"
                style={{ height: ANALYTICS_CHART_HEIGHT }}
                custom={chartDirection}
                variants={chartSlideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
              >
                <h3 className={`mb-3 shrink-0 text-center text-lg font-bold md:text-xl ${typographyTitleClass}`}>
                  {tr('chartCategorySplit')}
                </h3>
                <div className={`flex min-h-0 flex-1 items-center ${view === 'daily' ? 'justify-center' : ''}`}>
                <AnalyticsDonutPanel
                  chartKey={`category-donut-${chartPeriodKey}`}
                  total={total}
                  donutData={categoryDonutData}
                  legend={categoryLegend}
                  paddingSlices={breakdown.length > 1}
                />
                </div>
              </motion.div>
            )}

            {showMultiChartViews && chartSlide === 1 && (
              <motion.div
                key={`slide-1-${chartPeriodKey}`}
                className="absolute inset-0 flex h-full w-full flex-col px-1"
                style={{ height: ANALYTICS_CHART_HEIGHT }}
                custom={chartDirection}
                variants={chartSlideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
              >
                <h3 className={`mb-3 shrink-0 text-center text-lg font-bold md:text-xl ${typographyTitleClass}`}>
                  {tr('chartDailySplit')}
                </h3>
                <div className="flex min-h-0 flex-1 items-center">
                {dailyBreakdown.length === 0 ? (
                  <div className="flex h-full w-full flex-col items-center justify-center px-4 text-center">
                    <PieChartIcon className={`mb-2 h-10 w-10 ${typographyMutedClass}`} />
                    <p className={`text-sm ${typographyMutedClass}`}>{tr('noDailyBreakdown')}</p>
                  </div>
                ) : (
                  <AnalyticsDonutPanel
                    chartKey={`daily-donut-${chartPeriodKey}`}
                    total={total}
                    donutData={dailyDonutData}
                    legend={dailyLegend}
                    paddingSlices={dailyBreakdown.length > 1}
                  />
                )}
                </div>
              </motion.div>
            )}

            {showMultiChartViews && chartSlide === 2 && (
              <motion.div
                key={`slide-2-${chartPeriodKey}`}
                className="absolute inset-0 z-20 flex h-full w-full flex-col overflow-visible px-2 pt-2 outline-none focus:outline-none focus-visible:outline-none"
                style={{ height: ANALYTICS_CHART_HEIGHT }}
                custom={chartDirection}
                variants={chartSlideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: 'spring', stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
              >
                <h3 className={`mb-3 shrink-0 text-center text-lg font-bold md:text-xl ${typographyTitleClass}`}>
                  {tr('chartSpendingOverTime')}
                </h3>
                <div className="mb-2 flex shrink-0 items-start justify-between gap-3">
                  <div className={`space-y-0.5 text-sm ${typographyLabelClass}`}>
                    <p>
                      <span className="text-neutral-500">{tr('totalShort')}: </span>
                      <DisplayCurrencyAmount amount={total} className={`font-semibold inline-block ${typographyBodyClass}`} />
                    </p>
                    <p>
                      <span className="text-neutral-500">{tr('average')}: </span>
                      <DisplayCurrencyAmount amount={average} className={`font-semibold inline-block ${typographyBodyClass}`} />
                    </p>
                  </div>
                </div>

                {dailySeries.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-neutral-500">{tr('noChartData')}</p>
                  </div>
                ) : (
                  <div
                    ref={trendChartHostRef}
                    className="insights-trend-chart relative z-20 min-h-0 w-full flex-1 overflow-visible outline-none [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none active:outline-none [&_*:active]:shadow-none [&_*:active]:outline-none [&_*:focus-visible]:shadow-none [&_*:focus-visible]:outline-none [&_*:focus]:shadow-none [&_*:focus]:outline-none [&_.recharts-cartesian-axis]:pointer-events-none [&_.recharts-cartesian-grid]:pointer-events-none [&_.recharts-reference-line]:pointer-events-none [&_.recharts-surface:active]:outline-none [&_.recharts-surface:focus-visible]:outline-none [&_.recharts-surface:focus]:outline-none [&_.recharts-tooltip-cursor]:pointer-events-none [&_.recharts-wrapper:active]:outline-none [&_.recharts-wrapper:focus-visible]:outline-none [&_.recharts-wrapper:focus]:outline-none [&_canvas:active]:outline-none [&_canvas:focus]:outline-none [&_svg:active]:outline-none [&_svg:focus]:outline-none"
                    style={{
                      height: ANALYTICS_LINE_HEIGHT,
                      minHeight: ANALYTICS_LINE_HEIGHT,
                      outline: 'none',
                    }}
                    tabIndex={-1}
                    onTouchStartCapture={handleTrendTouchStartCapture}
                    onTouchEndCapture={handleTrendTouchEndCapture}
                    onPointerDownCapture={() => {
                      queueMicrotask(() => {
                        trendChartHostRef.current
                          ?.querySelectorAll('.recharts-wrapper, .recharts-surface, svg')
                          .forEach((node) => {
                            if (node instanceof HTMLElement) {
                              node.setAttribute('tabindex', '-1');
                              node.blur();
                              node.style.outline = 'none';
                              node.style.boxShadow = 'none';
                            }
                          });
                      });
                    }}
                  >
                    <ResponsiveContainer
                      width="100%"
                      height={ANALYTICS_LINE_HEIGHT}
                      key={`line-chart-${chartPeriodKey}`}
                      className="overflow-visible outline-none focus:outline-none focus-visible:outline-none"
                      style={{ outline: 'none' }}
                    >
                      <LineChart
                        data={dailySeries}
                        margin={{ top: 28, right: 12, left: 4, bottom: 8 }}
                        className="outline-none focus:outline-none focus-visible:outline-none"
                        style={{ overflow: 'visible', outline: 'none' }}
                        onMouseMove={(state) => {
                          if (isCoarsePointer) return;
                          applyTrendSelectionFromChartState(state);
                        }}
                        onClick={(state) => {
                          applyTrendSelectionFromChartState(state);
                        }}
                      >
                        <Tooltip
                          trigger={isCoarsePointer ? 'click' : 'hover'}
                          cursor={false}
                          content={() => null}
                          isAnimationActive={false}
                        />
                        <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 6" vertical={false} className="pointer-events-none" />
                        <XAxis
                          dataKey="dayLabel"
                          tick={{ fill: '#525252', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          interval={trendXAxisInterval}
                          tickFormatter={(value) => {
                            if (view !== 'year') return String(value);
                            if (typeof value !== 'string') return '';
                            return value.replace(/\d+/g, '').trim();
                          }}
                          className="pointer-events-none"
                        />
                        <YAxis
                          domain={[0, trendMax]}
                          ticks={[0, Math.round(trendMax / 2), trendMax]}
                          tick={{ fill: '#525252', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                          tickFormatter={(v) => String(v)}
                          className="pointer-events-none"
                        />
                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke={TREND_TRACK_STROKE}
                          strokeWidth={2}
                          connectNulls
                          activeDot={false}
                          dot={({ cx, cy, payload, index }) => {
                            if (cx == null || cy == null || !payload) return null;
                            const p = payload as TrendSeriesPoint;
                            const isSelected = p.iso === selectedTrendIso;
                            const fill = isSelected
                              ? TREND_SELECTED_DOT_FILL
                              : p.amount > 0
                                ? p.hex
                                : TREND_DOT_FILL;
                            const visibleR = isSelected ? 8 : p.amount > 0 ? 4 : 3;
                            const hitR = Math.max(visibleR + 10, 18);

                            return (
                              <g
                                key={`trend-dot-${index}`}
                                style={{ cursor: 'pointer', outline: 'none' }}
                                onMouseEnter={() => {
                                  if (!isCoarsePointer) setSelectedTrendIso(p.iso);
                                }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedTrendIso(p.iso);
                                }}
                              >
                                <circle cx={cx} cy={cy} r={hitR} fill="transparent" />
                                {isSelected && (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={12}
                                    fill={TREND_SELECTED_DOT_FILL}
                                    opacity={0.12}
                                  />
                                )}
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={visibleR}
                                  fill={fill}
                                  fillOpacity={isSelected ? 1 : p.amount > 0 ? 0.55 : 0.85}
                                  stroke={isSelected ? TREND_DOT_STROKE : TREND_DOT_STROKE}
                                  strokeWidth={isSelected ? 1 : 0.75}
                                />
                              </g>
                            );
                          }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {showMultiChartViews && chartSlide === 2 && selectedTrendPoint && (
          <SelectedDaySummary point={selectedTrendPoint} formatDate={formatTrendSummaryDate} />
        )}

        {/* Carousel pagination dots — hidden in daily view (category chart only) */}
        {showMultiChartViews && (
          <div
            dir="ltr"
            className={`flex flex-row justify-center items-center gap-2 ${chartSlide === 2 && selectedTrendPoint ? 'mt-4' : 'mt-5'}`}
            role="tablist"
            aria-label={tr('analyticsViews')}
          >
            {ANALYTICS_CHART_ORDER.map((i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={chartSlide === i}
                aria-label={`${tr('viewPrefix')} ${i + 1}`}
                onClick={() => goToChartSlide(i)}
                className={`rounded-full transition-all duration-300 ease-in-out ${
                  chartSlide === i
                    ? 'w-6 h-2 bg-sky-500/90 shadow shadow-sky-500/20'
                    : 'w-2 h-2 bg-neutral-700 hover:bg-neutral-600'
                }`}
              />
            ))}
          </div>
        )}

        {/* Detailed category list — companion to category chart (always visible in daily view) */}
        {chartSlide === 0 && (
        <div className={`space-y-5 ${showMultiChartViews ? 'mt-8' : 'mt-6'}`}>
          {breakdown.length === 0 ? (
            <div className="text-center py-12">
              <div className={`${emptyStateIconWellClass} w-16 h-16 mx-auto mb-4`}>
                <PieChartIcon className={`w-8 h-8 ${themeTextMutedClass}`} />
              </div>
              <p className={themeTextMutedClass}>{tr('noExpensesInPeriod')}</p>
              <p className={`text-sm mt-1 ${typographyMutedClass}`}>{tr('choosePeriodOrAdd')}</p>
            </div>
          ) : (
            breakdown.map((b) => (
                <div key={b.value} className="flex items-center gap-3">
                  <CategoryIconBadge icon={b.icon} hex={b.hex} colorClass={b.color} size="large" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="font-semibold truncate">
                          <LocalizedUserText text={b.value} />
                        </span>
                        <span className="text-xs text-neutral-500 shrink-0">
                          <LtrNumeric>{b.percentage.toFixed(2)}%</LtrNumeric>
                        </span>
                      </div>
                      <LtrNumeric className="font-semibold shrink-0">
                        <DisplayCurrencyAmount amount={b.amount} className="inline-block" />
                      </LtrNumeric>
                    </div>
                    <div className={`h-2 ${progressTrackClass}`}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(2, b.percentage)}%`, backgroundColor: b.hex }}
                      />
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
        )}
      </div>
    </div>
  );
}

interface Envelope {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  hex: string;
  allocated: number;
  spent: number;
  isGeneral: boolean;
}

interface SubBudgetTrackerProps {
  budget: number;
  monthLabel: string;
  monthExpenses: Expense[];
  categories: Category[];
  /** Immutable budget baseline (Source of Truth) for lossless display projection. */
  budgetOriginal?: { amount: number; currency: ExpenseCurrency };
  subBudgets: Record<string, number>;
  /** Immutable per-category baselines (Source of Truth) for lossless display. */
  subBudgetsOriginal: Record<string, { amount: number; currency: ExpenseCurrency }>;
  onSaveSubBudgets: (
    draft: Record<string, number>,
    draftOriginal: Record<string, { amount: number; currency: ExpenseCurrency }>,
  ) => Promise<void>;
  isMainBudget: boolean;
  linkedBudgetsExpanded: boolean;
  regularBudgetsExpanded: boolean;
  subBudgetPreviewExpanded: boolean;
  subBudgetOverviewExpanded: boolean;
  onLinkedBudgetsExpandedChange: (expanded: boolean) => void;
  onRegularBudgetsExpandedChange: (expanded: boolean) => void;
  onSubBudgetPreviewExpandedChange: (expanded: boolean) => void;
  onSubBudgetOverviewExpandedChange: (expanded: boolean) => void;
}

function SubBudgetCollapsibleSection({
  title,
  expanded,
  onExpandedChange,
  children,
}: {
  title: string;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  children: ReactNode;
}) {
  return (
    // Shell owns rounded corners + overflow-hidden + outer padding.
    // Content is always inset from the edges — corners never look sharp.
    <div className={subCardAccordionShellClass}>
      <button
        type="button"
        onClick={() => onExpandedChange(!expanded)}
        aria-expanded={expanded}
        className={`flex w-full items-center justify-between gap-2 ${subCardAccordionShellTriggerClass}`}
      >
        <span className={`text-sm font-semibold sm:text-base ${typographyTitleClass}`}>{title}</span>
        <ChevronUp
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${expanded ? '' : 'rotate-180'}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            // No overflow-hidden here — the outer shell owns the clip boundary.
            style={{ overflow: 'visible' }}
          >
            <div className={subCardAccordionBodyClass}>
              <div className={subCardAccordionContentClass}>{children}</div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SubBudgetCategoryRows({
  categories,
  draftSubBudgets,
  draftSubBudgetsOriginal,
  displayCurrency,
  onCommitField,
}: {
  categories: Category[];
  draftSubBudgets: Record<string, number>;
  draftSubBudgetsOriginal: Record<string, { amount: number; currency: ExpenseCurrency }>;
  displayCurrency: ExpenseCurrency;
  onCommitField: (
    categoryValue: string,
    amount: number | null,
    original: { amount: number; currency: ExpenseCurrency } | null,
  ) => void;
}) {
  const pendingCommitRef = useRef<{ categoryValue: string; amount: number | null } | null>(null);

  return (
    <div className="space-y-2">
      {categories.map((cat) => {
        const catHex = hexForColor(cat.color);
        const allocated = draftSubBudgets[cat.value] ?? 0;
        const baseline = draftSubBudgetsOriginal[cat.value] ?? null;
        return (
          <div key={cat.value} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/20"
              style={{ backgroundColor: catHex }}
            />
            <span className={`flex-1 truncate text-sm ${typographyLabelClass}`}>
              <LocalizedUserText text={cat.value} />
            </span>
            <LtrNumeric className="text-sm text-neutral-500">
              {currencySymbol(displayCurrency)}
            </LtrNumeric>
            <MoneyAmountInput
              value={allocated}
              baseline={baseline}
              displayCurrency={displayCurrency}
              onCommit={(amount) => {
                pendingCommitRef.current = { categoryValue: cat.value, amount };
              }}
              onCommitOriginal={(original) => {
                const pending = pendingCommitRef.current;
                if (pending?.categoryValue === cat.value) {
                  onCommitField(cat.value, pending.amount, original);
                  pendingCommitRef.current = null;
                }
              }}
              className={`w-24 text-left ${surfaceInputSmClass}`}
            />
          </div>
        );
      })}
    </div>
  );
}

function BudgetOverLimitBanner({ label }: { label: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 rounded-b-xl border-t border-rose-500/40 bg-rose-500/15 px-2 py-1.5 text-center text-[11px] font-bold leading-tight text-rose-300 sm:text-xs">
      {label}
    </div>
  );
}

const budgetChartContainerClass =
  'relative h-40 w-40 shrink-0 pointer-events-none sm:h-48 sm:w-48';

/** Shared Budget Status / Sub-Budget chart row geometry. */
const budgetTrackerRowGridClass =
  'grid min-h-[18rem] w-full grid-cols-1 items-center gap-4 sm:min-h-[19rem] sm:grid-cols-[1fr_minmax(11rem,12rem)] sm:gap-6';

const budgetTrackerChartCoreClass =
  'flex flex-col items-center justify-center text-center';

const budgetTrackerChartTitleClass =
  'mb-3 max-w-full px-2 text-base font-semibold sm:mb-4 sm:text-lg';

const budgetTrackerLegendSideClass = (isRtl: boolean) =>
  [
    'flex w-full max-w-[14rem] sm:max-w-none',
    isRtl ? 'items-end text-right' : 'items-start text-left',
  ].join(' ');

/** Accent panel wrapping only numeric stats + color legend (not the donut chart). */
function BudgetStatsLegendPanel({
  isOver,
  overBanner,
  children,
}: {
  isOver: boolean;
  overBanner?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={[
        'relative w-full rounded-xl border p-3 shadow-inner',
        isOver ? 'border-rose-500/60 bg-rose-950/80' : `border-emerald-500/25 ${surfacePanelClass}`,
        isOver ? 'pb-9' : '',
      ].join(' ')}
    >
      <div className="space-y-2.5">{children}</div>
      {overBanner}
    </div>
  );
}

function BudgetChartLegend({
  items,
  title,
  centered = false,
}: {
  title: string;
  items: ReadonlyArray<{ color: string; label: string }>;
  centered?: boolean;
}) {
  return (
    <div className={`w-full space-y-1 px-0.5 text-[11px] ${centered ? 'text-center' : ''} ${typographyMutedClass}`}>
      <p className={`font-semibold ${typographyBodyClass}`}>{title}</p>
      {items.map((item) => (
        <div key={item.label} className={`flex items-center gap-2 ${centered ? 'justify-center' : ''}`}>
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// Envelope budgeting: allocate the global budget into per-category sub-budgets,
// with a two-tone donut (spent vs. remaining) and per-envelope progress bars.
function SubBudgetTracker({
  budget,
  monthLabel,
  monthExpenses,
  categories,
  budgetOriginal,
  subBudgets,
  subBudgetsOriginal,
  onSaveSubBudgets,
  isMainBudget,
  linkedBudgetsExpanded,
  regularBudgetsExpanded,
  subBudgetPreviewExpanded,
  subBudgetOverviewExpanded,
  onLinkedBudgetsExpandedChange,
  onRegularBudgetsExpandedChange,
  onSubBudgetPreviewExpandedChange,
  onSubBudgetOverviewExpandedChange,
}: SubBudgetTrackerProps) {
  const { tr, ensureUserContents, dir, lang, displayCurrency } = useLanguage();
  // Visualization projection layer: every chart/stat below is computed from each
  // entity's immutable baseline projected into the active display currency, so the
  // donut slices, progress bars and labels stay 100% consistent with the text.
  const projection = useDisplayProjection();

  const [subChartSlide, setSubChartSlide] = useState(0);
  const [subChartDirection, setSubChartDirection] = useState<'forward' | 'backward'>('forward');
  const [draftSubBudgets, setDraftSubBudgets] = useState<Record<string, number>>(() => ({ ...subBudgets }));
  const [draftSubBudgetsOriginal, setDraftSubBudgetsOriginal] = useState<
    Record<string, { amount: number; currency: ExpenseCurrency }>
  >(() => ({ ...subBudgetsOriginal }));
  const isSavingRef = useRef(false);

  useEffect(() => {
    setDraftSubBudgets({ ...subBudgets });
    setDraftSubBudgetsOriginal({ ...subBudgetsOriginal });
  }, [subBudgets, subBudgetsOriginal, monthLabel]);

  // Spent per category, projected from EACH expense's immutable baseline into the
  // active display currency (single hop), then summed — never chained through ILS.
  const spentByCatDisplay = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const e of monthExpenses) {
      acc[e.category] = roundMoneyAmount((acc[e.category] ?? 0) + projection.projectExpense(e));
    }
    return acc;
  }, [monthExpenses, projection]);

  const categoryValues = useMemo(
    () => categories.map((c) => c.value).sort(compareSubBudgetCategoryKeys),
    [categories],
  );

  useEffect(() => {
    void ensureUserContents(categoryValues);
  }, [categoryValues, ensureUserContents]);

  const commitSubBudgetField = useCallback(
    async (
      categoryValue: string,
      amount: number | null,
      original: { amount: number; currency: ExpenseCurrency } | null,
    ) => {
      const nextDraft = { ...draftSubBudgets };
      if (amount === null || amount <= 0) {
        delete nextDraft[categoryValue];
      } else {
        nextDraft[categoryValue] = roundMoneyAmount(amount);
      }

      const nextOriginal = { ...draftSubBudgetsOriginal };
      if (original === null || !(original.amount > 0)) {
        delete nextOriginal[categoryValue];
      } else {
        nextOriginal[categoryValue] = original;
      }

      const changed = categoryValues.some(
        (value) =>
          roundMoneyAmount(nextDraft[value] ?? 0) !== roundMoneyAmount(subBudgets[value] ?? 0),
      );

      setDraftSubBudgets(nextDraft);
      setDraftSubBudgetsOriginal(nextOriginal);

      if (!changed || isSavingRef.current) return;
      isSavingRef.current = true;
      try {
        await onSaveSubBudgets(nextDraft, nextOriginal);
      } finally {
        isSavingRef.current = false;
      }
    },
    [categoryValues, draftSubBudgets, draftSubBudgetsOriginal, onSaveSubBudgets, subBudgets],
  );

  // Budget limit projected from its immutable baseline (zero-math when the view
  // currency matches what the user typed); legacy budgets fall back to the ILS ledger.
  const budgetDisplay = useMemo(
    () => roundMoneyAmount(projection.projectOriginalOrIls(budgetOriginal, budget)),
    [projection, budgetOriginal, budget],
  );

  // Per-category allocation projected from each sub-budget's own baseline.
  const allocatedByCatDisplay = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const value of categoryValues) {
      const ils = draftSubBudgets[value] ?? 0;
      if (!(ils > 0)) continue;
      acc[value] = roundMoneyAmount(
        projection.projectOriginalOrIls(draftSubBudgetsOriginal[value], ils),
      );
    }
    return acc;
  }, [categoryValues, draftSubBudgets, draftSubBudgetsOriginal, projection]);

  const allocatedTotal = roundMoneyAmount(
    categoryValues.reduce((sum, value) => sum + (allocatedByCatDisplay[value] ?? 0), 0),
  );
  const generalAllocated = roundMoneyAmount(Math.max(0, budgetDisplay - allocatedTotal));

  // Spending that falls outside any budgeted category draws from the General pool.
  const unbudgetedSpent = Object.entries(spentByCatDisplay)
    .filter(([v]) => !categoryValues.includes(v))
    .reduce((s, [, amt]) => roundMoneyAmount(s + amt), 0);

  const totalSpent = projection.sumExpenses(monthExpenses);

  const envelopes: Envelope[] = useMemo(() => {
    const list: Envelope[] = categoryValues.map((v) => {
      const cat = lookupCategory(v, categories);
      return {
        key: v,
        label: cat.label,
        icon: cat.icon,
        color: cat.color,
        hex: hexForColor(cat.color),
        allocated: allocatedByCatDisplay[v] ?? 0,
        spent: spentByCatDisplay[v] || 0,
        isGeneral: false,
      };
    });

    if (generalAllocated > 0 || unbudgetedSpent > 0) {
      list.push({
        key: GENERAL_KEY,
        label: tr('generalUnallocated'),
        icon: Wallet,
        color: 'bg-gray-500',
        hex: '#737373',
        allocated: generalAllocated,
        spent: unbudgetedSpent,
        isGeneral: true,
      });
    }

    return list;
  }, [
    categoryValues,
    categories,
    allocatedByCatDisplay,
    spentByCatDisplay,
    generalAllocated,
    unbudgetedSpent,
    tr,
  ]);
  const usedOverviewAmount = Math.min(totalSpent, budgetDisplay);
  const remainingOverviewAmount = Math.max(0, budgetDisplay - totalSpent);
  const isBudgetStatusOver = budgetDisplay > 0 && totalSpent > budgetDisplay;
  const budgetStatusExceededAmount = roundMoneyAmount(Math.max(0, totalSpent - budgetDisplay));
  const budgetStatusOverLabel = formatTranslation(lang, 'overBudgetExceededBy', {
    amount: projection.format(budgetStatusExceededAmount),
  });
  const overviewChartData = (
    [
      { id: 'used', value: Math.max(usedOverviewAmount, 0), fill: '#15803d' },
      { id: 'remaining', value: Math.max(remainingOverviewAmount, 0), fill: '#86efac' },
    ] as const
  ).filter((item) => item.value > 0);

  const subCategoryCharts = useMemo(
    () =>
      envelopes
        .filter((env) => !env.isGeneral && (env.allocated > 0 || env.spent > 0))
        .map((env) => ({
          ...env,
          spentAmount: Math.min(env.spent, env.allocated),
          remainingAmount: Math.max(0, env.allocated - env.spent),
          isOverBudget: env.spent > env.allocated,
          exceededAmount: roundMoneyAmount(Math.max(0, env.spent - env.allocated)),
        })),
    [envelopes],
  );

  useEffect(() => {
    setSubChartSlide((prev) => Math.min(prev, Math.max(subCategoryCharts.length - 1, 0)));
  }, [subCategoryCharts.length]);

  const goToSubChartSlide = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(subCategoryCharts.length - 1, nextIndex));
      setSubChartSlide((current) => {
        if (clamped === current) return current;
        setSubChartDirection(clamped > current ? 'forward' : 'backward');
        return clamped;
      });
    },
    [subCategoryCharts.length],
  );

  const activeSubChart = subCategoryCharts[subChartSlide] ?? null;
  const activeSubChartPieData = useMemo(() => {
    if (!activeSubChart) return [];
    const slices = [
      {
        id: 'spent' as const,
        value: Math.max(activeSubChart.spentAmount, 0),
        fill: activeSubChart.hex,
      },
      {
        id: 'remaining' as const,
        value: Math.max(activeSubChart.remainingAmount, 0),
        fill: remainingFill(activeSubChart.hex),
      },
    ].filter((item) => item.value > 0);
    if (slices.length > 0) return slices;
    return [
      {
        id: 'remaining' as const,
        value: 1,
        fill: remainingFill(activeSubChart.hex),
      },
    ];
  }, [activeSubChart]);
  const activeSubOverLabel =
    activeSubChart && activeSubChart.isOverBudget
      ? formatTranslation(lang, 'overBudgetExceededBy', { amount: projection.format(activeSubChart.exceededAmount) })
      : '';

  const subChartVariants = useMemo(
    () => ({
      // forward (later index): slides LEFT — new enters from left, old exits right
      // backward (earlier index): slides RIGHT — new enters from right, old exits left
      enter: (direction: 'forward' | 'backward') => ({
        x: direction === 'forward' ? '-100%' : '100%',
        opacity: 0,
      }),
      center: { x: 0, opacity: 1 },
      exit: (direction: 'forward' | 'backward') => ({
        x: direction === 'forward' ? '100%' : '-100%',
        opacity: 0,
      }),
    }),
    [],
  );

  const linkedCategories = useMemo(
    () => categories.filter((category) => category.isLinkedBudget),
    [categories],
  );
  const regularCategories = useMemo(
    () => categories.filter((category) => !category.isLinkedBudget),
    [categories],
  );
  const sectionActionLabel = isMainBudget ? tr('addOrUpdateSubBudget') : tr('changeBudget');

  return (
    <div className={`${themeCardClass} p-4 sm:p-6 mb-6 sm:mb-8`}>
      <div className="mb-4">
        <p className={`text-sm ${themeTextMutedClass}`}>
          {tr('subBudgetsSubtitle')} • {monthLabel}
        </p>
      </div>

      {budget <= 0 ? (
        <div className="text-center py-8">
          <div className={`${emptyStateIconWellClass} w-14 h-14 mx-auto mb-3`}>
            <Wallet className={`w-7 h-7 ${themeTextMutedClass}`} />
          </div>
          <p className={typographyBodyClass}>{tr('setMonthlyBudgetFirst')}</p>
          <p className={`text-sm mt-1 ${themeTextMutedClass}`}>{tr('thenSplitSubBudgets')}</p>
        </div>
      ) : (
        <>
          {/* Main budget chart: used vs remaining */}
          <SubBudgetCollapsibleSection
            title={tr('subBudgetsTitle')}
            expanded={subBudgetOverviewExpanded}
            onExpandedChange={onSubBudgetOverviewExpandedChange}
          >
            <div className={`p-3 sm:p-5 ${subCardClass}`}>
              <div className={budgetTrackerRowGridClass}>
                <div className={budgetTrackerChartCoreClass}>
                  <p className={`${budgetTrackerChartTitleClass} ${typographyTitleClass}`}>
                    {tr('budgetStatus')}
                  </p>
                  <div className={budgetChartContainerClass}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={overviewChartData.length > 0 ? overviewChartData : [{ id: 'remaining', value: 1, fill: '#86efac' }]}
                          dataKey="value"
                          nameKey="id"
                          cx="50%"
                          cy="50%"
                          innerRadius="64%"
                          outerRadius="100%"
                          paddingAngle={1}
                          stroke="#0a0a0a"
                          strokeWidth={2}
                          isAnimationActive={false}
                        >
                          {(overviewChartData.length > 0 ? overviewChartData : [{ id: 'remaining', value: 1, fill: '#86efac' }]).map((slice) => (
                            <Cell key={slice.id} fill={slice.fill} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <DisplayCurrencyAmount amount={usedOverviewAmount} className={`text-xl font-bold ${typographyTitleClass}`} />
                      <span className="mt-1 text-[11px] text-neutral-500">
                        <LtrNumeric>{tr('outOf')} {projection.format(budgetDisplay)}</LtrNumeric>
                      </span>
                    </div>
                  </div>
                </div>

                <div className={budgetTrackerLegendSideClass(dir === 'rtl')}>
                  <BudgetStatsLegendPanel
                    isOver={isBudgetStatusOver}
                    overBanner={
                      isBudgetStatusOver ? <BudgetOverLimitBanner label={budgetStatusOverLabel} /> : undefined
                    }
                  >
                    <div className="space-y-1">
                      <p className="text-xs text-neutral-400">
                        {tr('spentLabel')}: <DisplayCurrencyAmount amount={totalSpent} className="inline-block" />
                      </p>
                      <p className="text-xs text-neutral-400">
                        {tr('remainingLabel')}: <DisplayCurrencyAmount amount={remainingOverviewAmount} className="inline-block" />
                      </p>
                      <p className="text-xs text-neutral-500">
                        {tr('totalBudgetLabel')}: <DisplayCurrencyAmount amount={budgetDisplay} className="inline-block" />
                      </p>
                      <p className={`text-xs ${isBudgetStatusOver ? 'text-rose-300' : 'text-emerald-300'}`}>
                        {tr('spentLabel')}{' '}
                        {budgetDisplay > 0 ? `${((totalSpent / budgetDisplay) * 100).toFixed(0)}%` : '0%'}
                      </p>
                      <p className="text-xs text-emerald-200">
                        {tr('remainingLabel')}{' '}
                        {budgetDisplay > 0 ? `${((remainingOverviewAmount / budgetDisplay) * 100).toFixed(0)}%` : '0%'}
                      </p>
                    </div>
                    <BudgetChartLegend
                      title={tr('subBudgetLegendTitle')}
                      items={[
                        { color: '#15803d', label: tr('subBudgetLegendUsed') },
                        { color: '#86efac', label: tr('subBudgetLegendRemaining') },
                      ]}
                    />
                  </BudgetStatsLegendPanel>
                </div>
              </div>
            </div>
          </SubBudgetCollapsibleSection>

          {/* Sub-category preview — collapsible card with chart, metrics, and category nav at bottom */}
          <div className="mt-6">
            <SubBudgetCollapsibleSection
              title={tr('regularSubBudgetsSectionTitle')}
              expanded={subBudgetPreviewExpanded}
              onExpandedChange={onSubBudgetPreviewExpandedChange}
            >
              {subCategoryCharts.length === 0 ? (
                <p className="text-center text-sm text-neutral-500">{tr('startByAddingSubBudget')}</p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className={`relative w-full overflow-hidden p-3 sm:p-4 ${subCardClass}`}>
                    <AnimatePresence mode="popLayout" initial={false}>
                      {activeSubChart && (
                        <motion.div
                          key={`sub-chart-${activeSubChart.key}-${subChartSlide}`}
                          custom={subChartDirection}
                          variants={subChartVariants}
                          initial="enter"
                          animate="center"
                          exit="exit"
                          transition={{
                            x: { type: 'spring', stiffness: 300, damping: 30 },
                            opacity: { duration: 0.2 },
                          }}
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          dragElastic={0.12}
                          dragMomentum={false}
                          onDragEnd={(_, info: PanInfo) => {
                            if (Math.abs(info.offset.x) < 50) return;
                            if (info.offset.x < 0) {
                              goToSubChartSlide(subChartSlide + 1);
                              return;
                            }
                            goToSubChartSlide(subChartSlide - 1);
                          }}
                          className={`relative ${budgetTrackerRowGridClass}`}
                        >
                          <div className={budgetTrackerChartCoreClass}>
                            <p className={`${budgetTrackerChartTitleClass} ${typographyTitleClass}`}>
                              <LocalizedUserText text={activeSubChart.key} />
                            </p>
                            <div className={budgetChartContainerClass}>
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={activeSubChartPieData}
                                    dataKey="value"
                                    nameKey="id"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius="62%"
                                    outerRadius="100%"
                                    paddingAngle={1}
                                    stroke="#0a0a0a"
                                    strokeWidth={2}
                                    isAnimationActive={false}
                                  >
                                    {activeSubChartPieData.map((slice) => (
                                      <Cell key={slice.id} fill={slice.fill} />
                                    ))}
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          <div className={budgetTrackerLegendSideClass(dir === 'rtl')}>
                            <BudgetStatsLegendPanel
                              isOver={activeSubChart.isOverBudget}
                              overBanner={
                                activeSubChart.isOverBudget ? (
                                  <BudgetOverLimitBanner label={activeSubOverLabel} />
                                ) : undefined
                              }
                            >
                              <div className="space-y-1">
                                <p className="text-xs text-neutral-400">
                                  {tr('spentLabel')}:{' '}
                                  <DisplayCurrencyAmount amount={activeSubChart.spent} className="inline-block" />
                                </p>
                                <p className="text-xs text-neutral-400">
                                  {tr('remainingLabel')}:{' '}
                                  <DisplayCurrencyAmount
                                    amount={activeSubChart.remainingAmount}
                                    className="inline-block"
                                  />
                                </p>
                                <p className="text-xs text-neutral-500">
                                  {tr('totalBudgetLabel')}:{' '}
                                  <DisplayCurrencyAmount
                                    amount={activeSubChart.allocated}
                                    className="inline-block"
                                  />
                                </p>
                                <p
                                  className={`text-xs ${activeSubChart.isOverBudget ? 'text-rose-300' : 'text-emerald-300'}`}
                                >
                                  {tr('spentLabel')}{' '}
                                  {activeSubChart.allocated > 0
                                    ? `${((activeSubChart.spent / activeSubChart.allocated) * 100).toFixed(0)}%`
                                    : '0%'}
                                </p>
                                <p className="text-xs text-emerald-200">
                                  {tr('remainingLabel')}{' '}
                                  {activeSubChart.allocated > 0
                                    ? `${((activeSubChart.remainingAmount / activeSubChart.allocated) * 100).toFixed(0)}%`
                                    : '0%'}
                                </p>
                              </div>
                              <BudgetChartLegend
                                title={tr('subBudgetLegendTitle')}
                                items={[
                                  { color: activeSubChart.hex, label: tr('subBudgetLegendUsed') },
                                  {
                                    color: remainingFill(activeSubChart.hex),
                                    label: tr('subBudgetLegendRemaining'),
                                  },
                                ]}
                              />
                            </BudgetStatsLegendPanel>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="flex flex-row flex-wrap items-stretch justify-start gap-2 border-t border-[var(--color-sub-cards-border)] pt-4">
                    {subCategoryCharts.map((env, index) => {
                      const Icon = env.icon;
                      const isActive = index === subChartSlide;
                      return (
                        <button
                          key={`sub-btn-${env.key}`}
                          type="button"
                          onClick={() => goToSubChartSlide(index)}
                          className={`flex min-h-[2.75rem] min-w-[5.5rem] flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl border px-2 py-2 text-center transition-all sm:min-w-[6.5rem] sm:flex-none ${
                            isActive ? 'ring-2 ring-white/40' : 'hover:scale-[1.01]'
                          }`}
                          style={{ borderColor: `${env.hex}66`, backgroundColor: `${env.hex}22` }}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-white" />
                          <span className="truncate text-xs font-semibold text-white sm:text-sm">
                            <LocalizedUserText text={env.key} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </SubBudgetCollapsibleSection>
          </div>

          {/* Per-category budget limits (1:1 with categories list) */}
          <div className="mt-6 border-t border-neutral-800 pt-5">
            {isMainBudget ? (
              <div className="space-y-4">
                <SubBudgetCollapsibleSection
                  title={tr('linkedBudgetsSectionTitle')}
                  expanded={linkedBudgetsExpanded}
                  onExpandedChange={onLinkedBudgetsExpandedChange}
                >
                  {linkedCategories.length === 0 ? (
                    <p className={`text-center text-sm ${themeTextMutedClass}`}>
                      {tr('noData')}
                    </p>
                  ) : (
                    <>
                      <p className={`mb-2 text-xs font-medium ${typographyMutedClass}`}>
                        {sectionActionLabel}
                      </p>
                      <SubBudgetCategoryRows
                        categories={linkedCategories}
                        draftSubBudgets={draftSubBudgets}
                        draftSubBudgetsOriginal={draftSubBudgetsOriginal}
                        displayCurrency={displayCurrency}
                        onCommitField={commitSubBudgetField}
                      />
                    </>
                  )}
                </SubBudgetCollapsibleSection>

                <SubBudgetCollapsibleSection
                  title={tr('addOrUpdateSubBudget')}
                  expanded={regularBudgetsExpanded}
                  onExpandedChange={onRegularBudgetsExpandedChange}
                >
                  {regularCategories.length === 0 ? (
                    <p className={`text-center text-sm ${themeTextMutedClass}`}>
                      {tr('noData')}
                    </p>
                  ) : (
                    <>
                      <p className={`mb-2 text-xs font-medium ${typographyMutedClass}`}>
                        {sectionActionLabel}
                      </p>
                      <SubBudgetCategoryRows
                        categories={regularCategories}
                        draftSubBudgets={draftSubBudgets}
                        draftSubBudgetsOriginal={draftSubBudgetsOriginal}
                        displayCurrency={displayCurrency}
                        onCommitField={commitSubBudgetField}
                      />
                    </>
                  )}
                </SubBudgetCollapsibleSection>
              </div>
            ) : (
              <SubBudgetCollapsibleSection
                title={tr('addOrUpdateSubBudget')}
                expanded={regularBudgetsExpanded}
                onExpandedChange={onRegularBudgetsExpandedChange}
              >
                <p className={`mb-2 text-xs font-medium ${typographyMutedClass}`}>
                  {sectionActionLabel}
                </p>
                <SubBudgetCategoryRows
                  categories={categories}
                  draftSubBudgets={draftSubBudgets}
                  draftSubBudgetsOriginal={draftSubBudgetsOriginal}
                  displayCurrency={displayCurrency}
                  onCommitField={commitSubBudgetField}
                />
              </SubBudgetCollapsibleSection>
            )}
            <div className="flex items-center justify-between pt-4 text-xs">
                <LtrNumeric className="text-neutral-500">
                  {tr('allocated')}:{' '}
                  <DisplayCurrencyAmount amount={allocatedTotal} className="inline-block" /> /{' '}
                  <DisplayCurrencyAmount amount={budgetDisplay} className="inline-block" />
                </LtrNumeric>
                <LtrNumeric
                  className={
                    allocatedTotal > budgetDisplay ? 'text-rose-400 font-medium' : 'text-neutral-500'
                  }
                >
                  {allocatedTotal > budgetDisplay ? (
                    <>
                      {tr('overBudget')}:{' '}
                      <DisplayCurrencyAmount
                        amount={allocatedTotal - budgetDisplay}
                        className="inline-block font-medium"
                      />
                    </>
                  ) : (
                    <>
                      {tr('unallocated')}:{' '}
                      <DisplayCurrencyAmount amount={generalAllocated} className="inline-block" />
                    </>
                  )}
                </LtrNumeric>
              </div>
          </div>
        </>
      )}
    </div>
  );
}

type BudgetChangeMode = 'keep' | 'reset';

interface BudgetChangeModalProps {
  open: boolean;
  newBudget: number;
  currentBudget: number;
  monthLabel: string;
  onSelect: (mode: BudgetChangeMode) => void;
  onClose: () => void;
}

// Premium dark confirmation sheet shown when the monthly budget changes while
// the active month already has sub-budget allocations. Each option acts ONLY on
// the active month's data.
function BudgetChangeModal({
  open,
  newBudget,
  currentBudget,
  monthLabel,
  onSelect,
  onClose,
}: BudgetChangeModalProps) {
  const { tr, dir, formatMoney } = useLanguage();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const options: {
    mode: BudgetChangeMode;
    icon: LucideIcon;
    title: string;
    desc: string;
    accent: string;
    ring: string;
    iconBg: string;
  }[] = [
    {
      mode: 'keep',
      icon: Check,
      title: tr('budgetOptionKeepTitle'),
      desc: tr('budgetOptionKeepDesc'),
      accent: 'hover:border-indigo-500/60 hover:bg-indigo-950/30',
      ring: 'focus-visible:ring-indigo-500/40',
      iconBg: 'bg-indigo-950/60 text-indigo-300 border border-indigo-900/50',
    },
    {
      mode: 'reset',
      icon: RotateCcw,
      title: tr('budgetOptionResetTitle'),
      desc: tr('budgetOptionResetDesc'),
      accent: 'hover:border-indigo-400/60 hover:bg-indigo-950/30',
      ring: 'focus-visible:ring-indigo-500/40',
      iconBg: 'bg-indigo-950/60 text-indigo-300 border border-indigo-900/50',
    },
  ];

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        aria-label={tr('close')}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      />

      {/* Sheet / card */}
      <div
        className={`relative w-full sm:max-w-lg p-5 sm:p-7 max-h-[92vh] overflow-y-auto ${surfaceModalLgClass}`}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-700" />

        <div className="flex items-start gap-3 mb-1">
          <div className={`${utilityNavIconBadgeClass} p-2.5 shrink-0`}>
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 id="budget-modal-title" className={`text-base sm:text-lg font-bold leading-snug ${typographyTitleClass}`}>
              {tr('budgetChangeTitle')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 -mt-1 -ml-1 p-2 rounded-lg transition-all ${utilityIconButtonGhostClass}`}
            aria-label={tr('close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-neutral-400 leading-relaxed mb-4">
          {tr('budgetChangeDesc')}
        </p>

        {/* Old -> new budget summary */}
        <div className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 mb-5 ${surfacePanelClass}`}>
          <span className="text-xs text-neutral-500 capitalize truncate">{monthLabel}</span>
          <div className="flex items-center gap-2 shrink-0">
            <LtrNumeric className="text-sm text-neutral-500 line-through">{formatMoney(currentBudget)}</LtrNumeric>
            <ChevronLeft className="w-4 h-4 text-neutral-600" />
            <DisplayMoney amount={newBudget} className="text-base font-bold text-emerald-400 inline-block" />
          </div>
        </div>

        {/* Option buttons */}
        <div className="space-y-3">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => onSelect(opt.mode)}
                className={`w-full text-right flex items-center gap-3.5 p-4 rounded-2xl transition-all active:scale-[0.99] outline-none focus-visible:ring-2 ${surfacePanelClass} ${opt.accent} ${opt.ring}`}
              >
                <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${opt.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold text-sm leading-snug ${typographyTitleClass}`}>{opt.title}</p>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">{opt.desc}</p>
                </div>
                <ChevronLeft className="w-5 h-5 text-neutral-600 shrink-0" />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`mt-4 w-full py-3 text-sm ${utilityNavButtonLgClass}`}
        >
          {tr('cancel')}
        </button>
      </div>
    </div>
  );
}

type FinancialSummaryCurrencyAnchor = 'budget' | 'expenses' | 'status';

const FINANCIAL_CURRENCY_MENU_WIDTH_PX = 288;
const FINANCIAL_CURRENCY_MENU_MOBILE_MAX_HEIGHT_PX = 450;

type FinancialCurrencyMenuLayout = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function computeFinancialCurrencyMenuLayout(
  trigger: HTMLElement,
  anchor: FinancialSummaryCurrencyAnchor,
  dir: 'ltr' | 'rtl',
): FinancialCurrencyMenuLayout {
  const gap = 6;
  const edgePad = 8;
  const width = Math.min(FINANCIAL_CURRENCY_MENU_WIDTH_PX, window.innerWidth - edgePad * 2);
  const maxHeightCap = Math.min(window.innerHeight * 0.65, FINANCIAL_CURRENCY_MENU_MOBILE_MAX_HEIGHT_PX);

  const rect = trigger.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportHeight = viewport?.height ?? window.innerHeight;
  const viewportBottom = viewportTop + viewportHeight;

  const spaceBelow = viewportBottom - rect.bottom - gap - edgePad;
  const spaceAbove = rect.top - viewportTop - gap - edgePad;
  const openUpward = spaceBelow < 140 && spaceAbove > spaceBelow;

  const maxHeight = Math.min(maxHeightCap, Math.max(160, openUpward ? spaceAbove : spaceBelow));
  const top = openUpward
    ? Math.max(viewportTop + edgePad, rect.top - gap - maxHeight)
    : rect.bottom + gap;

  const alignEnd =
    (anchor === 'status' && dir === 'ltr') || (anchor === 'budget' && dir === 'rtl');
  const alignStart =
    (anchor === 'budget' && dir === 'ltr') || (anchor === 'status' && dir === 'rtl');

  let left: number;
  if (alignEnd) {
    left = Math.max(edgePad, Math.min(rect.right - width, window.innerWidth - width - edgePad));
  } else if (alignStart) {
    left = Math.max(edgePad, Math.min(rect.left, window.innerWidth - width - edgePad));
  } else {
    left = Math.max(
      edgePad,
      Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - edgePad),
    );
  }

  return { top, left, width, maxHeight };
}

const financialSummaryCurrencyMenuScrollClass =
  'overflow-y-auto overscroll-contain touch-pan-y scroll-smooth [-webkit-overflow-scrolling:touch]';

const FINANCIAL_SUMMARY_AMOUNT_CONTAINER_CLASS =
  '@container [container-type:inline-size] w-full min-w-0 max-w-full';

/** Default size for normal amounts; shrinks only as character count grows. */
function financialSummaryAmountTypographyClass(amountText: string): string {
  const charLen = amountText.length;
  if (charLen <= 9) return 'text-sm sm:text-base md:text-2xl';
  if (charLen <= 12) return 'text-xs sm:text-sm md:text-xl';
  if (charLen <= 16) return 'text-[10px] sm:text-xs md:text-lg';
  if (charLen <= 20) return 'text-[9px] sm:text-[10px] md:text-base';
  if (charLen <= 24) return 'text-[8px] sm:text-[9px] md:text-sm';
  return 'text-[8px] sm:text-[9px] md:text-xs';
}

/** Budget input / placeholder — same length tiers; truncate always applied on the field. */
function budgetMoneyFieldTypographyClass(visibleCharLen: number): string {
  if (visibleCharLen <= 8) return 'text-sm sm:text-lg';
  if (visibleCharLen <= 14) return 'text-xs sm:text-base';
  if (visibleCharLen <= 20) return 'text-[11px] sm:text-sm';
  if (visibleCharLen <= 28) return 'text-[10px] sm:text-xs';
  if (visibleCharLen <= 36) return 'text-[9px] sm:text-[10px]';
  return 'text-[8px] sm:text-[9px]';
}

function FinancialSummaryAmount({
  parts,
  amountClassName,
  menuAnchor,
  activeMenuAnchor,
  onToggleMenu,
  onCurrencyPicked,
  menuContainerRef,
  menuPortalRef,
}: {
  parts: AmountDisplayParts;
  amountClassName: string;
  menuAnchor: FinancialSummaryCurrencyAnchor;
  activeMenuAnchor: FinancialSummaryCurrencyAnchor | null;
  onToggleMenu: (anchor: FinancialSummaryCurrencyAnchor) => void;
  onCurrencyPicked: () => void;
  menuContainerRef: MutableRefObject<HTMLDivElement | null>;
  menuPortalRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const { tr, dir } = useLanguage();
  const isOpen = menuAnchor === activeMenuAnchor;
  const symbolButtonRef = useRef<HTMLButtonElement>(null);
  const [currencyMenuLayout, setCurrencyMenuLayout] = useState<FinancialCurrencyMenuLayout | null>(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      setCurrencyMenuLayout(null);
      return;
    }

    const updateLayout = () => {
      const trigger = symbolButtonRef.current;
      if (!trigger) return;
      setCurrencyMenuLayout(computeFinancialCurrencyMenuLayout(trigger, menuAnchor, dir));
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    window.addEventListener('scroll', updateLayout, true);
    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', updateLayout);
    visualViewport?.addEventListener('scroll', updateLayout);
    return () => {
      window.removeEventListener('resize', updateLayout);
      window.removeEventListener('scroll', updateLayout, true);
      visualViewport?.removeEventListener('resize', updateLayout);
      visualViewport?.removeEventListener('scroll', updateLayout);
    };
  }, [isOpen, menuAnchor, dir]);

  const menuPanel = (
    <DisplayCurrencyInlineMenu onSelected={onCurrencyPicked} className="py-2" />
  );
  const signedAmountText = parts.sign ? `${parts.sign}${parts.amount}` : parts.amount;
  const amountTypographyClass = financialSummaryAmountTypographyClass(signedAmountText);
  const amountContainerFluidClass =
    signedAmountText.length > 9 ? 'text-[length:clamp(0.5rem,11cqw,1.5rem)]' : '';

  return (
    <div
      ref={isOpen ? menuContainerRef : undefined}
      className={`relative flex w-full min-w-0 max-w-full items-center justify-center overflow-visible md:overflow-visible ${FINANCIAL_SUMMARY_AMOUNT_CONTAINER_CLASS}`}
    >
      <LtrNumeric className="inline-flex max-w-full min-w-0 items-baseline justify-center text-center font-bold leading-tight">
        <span className="inline-flex min-w-0 max-w-full items-center gap-2">
          <button
            ref={symbolButtonRef}
            type="button"
            onClick={() => onToggleMenu(menuAnchor)}
            className={currencySymbolTriggerClass}
            {...themeCategoryProps('currency')}
            aria-label={tr('displayCurrency')}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            {parts.symbol}
          </button>
          <span
            className={`block min-w-0 max-w-full truncate tabular-nums ${amountContainerFluidClass} ${amountClassName} ${amountTypographyClass}`}
          >
            {signedAmountText}
          </span>
        </span>
      </LtrNumeric>
      {isOpen && currencyMenuLayout
        ? createPortal(
            <div
              ref={menuPortalRef}
              className={`fixed z-[100] px-1.5 ${financialSummaryCurrencyMenuScrollClass} ${filterDropdownWrapperClass}`}
              style={{
                top: currencyMenuLayout.top,
                left: currencyMenuLayout.left,
                width: currencyMenuLayout.width,
                maxHeight: currencyMenuLayout.maxHeight,
              }}
            >
              {menuPanel}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function App() {
  const {
    tr,
    dir,
    lang,
    setLang,
    getUserContent,
    ensureUserContents,
    keepOriginalValues,
    formatMoney,
    displayCurrency,
    savedColors,
    customCurrencies,
    currencyLayout,
    themePreferences,
    settingsPersistence,
    setSettingsPersistence,
    applySettingsFromCloud,
  } = useLanguage();
  const rateCacheWarmupCurrencies = useMemo(
    () => layoutToPinnedCodes(currencyLayout),
    [currencyLayout],
  );
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  // Offline-first exchange-rate cache: localStorage for guests, Firebase for
  // members; background-refreshes stale live rates even under manual overrides.
  useRateCacheSync({
    user,
    authReady,
    displayCurrency: displayCurrency as ExpenseCurrency,
    warmupCurrencies: rateCacheWarmupCurrencies,
  });
  const [settingsCloudReady, setSettingsCloudReady] = useState(false);
  const suppressCloudSaveRef = useRef(true);
  const financialLocalVersionRef = useRef<Record<string, number>>({});
  const registryPatchedAtRef = useRef<Record<string, number>>({});
  const financialPersistTimerRef = useRef<number | null>(null);
  const currencyConversionGenerationRef = useRef(0);
  const selectedMonthKeyRef = useRef<string>(monthKeyOfDate(new Date()));
  const activeFinancialSnapshotRef = useRef<{
    budgetId: string | null;
    data: UserAppData;
  }>({ budgetId: null, data: { ...EMPTY_USER_APP_DATA } });
  const locallyEditedSubBudgetMonthsRef = useRef<Set<string>>(new Set());
  const commitFinancialPayloadRef = useRef<
    (payload: UserAppData, options?: { cloud?: boolean }) => void
  >(() => {});
  const skipNextSettingsSaveRef = useRef(false);
  const skipDisplayCurrencyConversionRef = useRef(false);
  const scopedDisplayCurrencyRef = useRef<ExpenseCurrency>('ILS');
  const pendingAuthLangRef = useRef<'he' | 'en' | null>(null);
  const hadAuthenticatedUserRef = useRef(false);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setAvatarUrl('');
      } else if (firebaseUser.isAnonymous) {
        setAvatarUrl(getGuestAvatarFromStorage());
      } else {
        setAvatarUrl(sanitizeAvatarUrl(firebaseUser.photoURL, ''));
      }
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Monthly budget is scoped per month ('YYYY-MM' -> amount) so changing one
  // month never affects another month's history.
  const [budgetsByMonth, setBudgetsByMonth] = useState<Record<string, number>>({});
  const [budgetOriginalByMonth, setBudgetOriginalByMonth] = useState<
    Record<string, { amount: number; currency: ExpenseCurrency }>
  >({});
  const [budgetInput, setBudgetInput] = useState<string>('');

  // Budget-change confirmation modal state.
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [pendingBudget, setPendingBudget] = useState<number | null>(null);
  const [pendingBudgetOriginal, setPendingBudgetOriginal] = useState<{
    amount: number;
    currency: ExpenseCurrency;
  } | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    currency: displayCurrency as ExpenseCurrency,
    category: CATEGORIES[0]?.value ?? '',
    date: toISODate(new Date()),
  });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseDraft, setEditExpenseDraft] = useState<{
    description: string;
    amount: string;
    currency: ExpenseCurrency;
    category: string;
    date: string;
    manualRateDisabled: boolean;
    feeDisabled: boolean;
  } | null>(null);
  /** Frozen expense record at edit-open — modifier visibility uses historical state, not live overrides. */
  const [editExpenseSnapshot, setEditExpenseSnapshot] = useState<Expense | null>(null);
  const [editPreviewAmount, setEditPreviewAmount] = useState<number | null>(null);
  const [editExpenseRatesReady, setEditExpenseRatesReady] = useState(true);
  const [recentlyUpdatedExpenseId, setRecentlyUpdatedExpenseId] = useState<string | null>(null);
  const [expenseRatesReady, setExpenseRatesReady] = useState(true);

  // Historical override prompt — new expense form
  const [newExpenseHistoricalBanner, setNewExpenseHistoricalBanner] =
    useState<HistoricalOverrideBannerContext | null>(null);
  const [newExpenseHistoricalApplied, setNewExpenseHistoricalApplied] =
    useState<NewExpenseHistoricalApplied>(EMPTY_NEW_EXPENSE_HISTORICAL_APPLIED);
  /** Last explicit banner button choice for the current date/currency context (submit source of truth). */
  const [newExpenseHistoricalLastChoice, setNewExpenseHistoricalLastChoice] =
    useState<HistoricalOverrideApplyChoice | null>(null);
  /** Live banner checkbox state — used to persist automation on submit without re-clicking buttons. */
  const [newExpenseHistoricalBannerOptions, setNewExpenseHistoricalBannerOptions] =
    useState<HistoricalOverrideBannerOptions | null>(null);

  const [showBudgetSaved, setShowBudgetSaved] = useState(false);
  const [autoTransferByMonth, setAutoTransferByMonth] = useState<Record<string, boolean>>({});

  // Active top-level navigation tab.
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [profileInitialCurrencySections, setProfileInitialCurrencySections] = useState<
    ('display' | 'exchange' | 'manual-rate' | 'commissions')[] | null
  >(null);
  const profileReturnTabRef = useRef<MainTabId>('dashboard');
  const pendingPlainProfileOpenRef = useRef(false);
  const [navOpen, setNavOpen] = useState(false);
  const [budgetDrawerOpen, setBudgetDrawerOpen] = useState(false);
  const [appShellView, setAppShellView] = useState<AppShellView>('active-budget');
  const [activeBudgetId, setActiveBudgetId] = useState<string>(DEFAULT_MONTHLY_BUDGET_ID);
  const [uiPreferences, setUiPreferences] = useState<UiPreferences>(DEFAULT_UI_PREFERENCES);
  const [budgetRegistry, setBudgetRegistry] = useState<BudgetRegistryState>({
    personal: [],
    shared: [],
  });

  useEffect(() => {
    if (!shouldSyncToFirestore(user)) {
      setUiPreferences(DEFAULT_UI_PREFERENCES);
    }
  }, [user]);
  const [budgetSystemReady, setBudgetSystemReady] = useState(false);
  const budgetFinancialCacheRef = useRef<Record<string, UserAppData>>({});
  /** Expires-at timestamps; only blocks stale empty snapshots during currency conversion. */
  const financialConversionGuardRef = useRef<Record<string, number>>({});
  const budgetSettingsCacheRef = useRef<Record<string, UserSettings>>({});
  const activeBudgetSettingsKeyRef = useRef<string>(`budget:${DEFAULT_MONTHLY_BUDGET_ID}`);
  const appShellViewRef = useRef<AppShellView>(appShellView);
  const activeBudgetIdRef = useRef(activeBudgetId);
  const budgetRegistryRef = useRef(budgetRegistry);
  const budgetBootstrappedRef = useRef(false);
  const budgetBootstrapUserIdRef = useRef<string | null>(null);
  /** True once the user explicitly enters a budget — blocks async bootstrap from forcing default. */
  const userBudgetChoiceClaimedRef = useRef(false);
  const applySettingsFromCloudRef = useRef(applySettingsFromCloud);
  const applyActiveBudgetSettingsRef = useRef<
    (budgetId: string, registry: BudgetRegistryState) => void
  >(() => {});
  const flushActiveBudgetSettingsRef = useRef<() => void>(() => {});
  const setLangRef = useRef(setLang);
  const isProfileView = activeTab === 'profile';
  const isInsideActiveBudget = appShellView === 'active-budget';
  const isScrollRoute = isProfileView || appShellView !== 'active-budget';

  // Keep new-expense currency aligned with global display currency (Financial Summary shortcuts, Settings, etc.).
  useEffect(() => {
    setNewExpense((prev) =>
      prev.currency === displayCurrency ? prev : { ...prev, currency: displayCurrency as ExpenseCurrency },
    );
  }, [displayCurrency]);

  const handleTabSelect = (id: TabId) => {
    setActiveTab(id);
    setNavOpen(false);
    if (id !== 'profile') {
      setProfileInitialCurrencySections(null);
    }
  };

  /**
   * Announce a Settings section target via URL hash + custom event.
   *
   * Uses `history.replaceState` (no native browser jump) and then dispatches
   * `SETTINGS_NAVIGATE_EVENT` so `ProfileSettingsSections` / `ProfilePage`
   * open the right accordion and snap scroll to the element — whether the
   * profile tab is freshly mounted or already visible.
   */
  const navigateToSettingsSection = useCallback((hashKey: string) => {
    window.history.replaceState(null, '', `#${hashKey}`);
    window.dispatchEvent(new CustomEvent(SETTINGS_NAVIGATE_EVENT, { detail: hashKey }));
  }, []);

  const clearProfileSettingsHash = useCallback(() => {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }, []);

  const finishPlainProfileOpen = useCallback(() => {
    window.dispatchEvent(new CustomEvent(PROFILE_PLAIN_OPEN_EVENT));
  }, []);

  const openProfile = useCallback(
    (currencySections?: ('display' | 'exchange' | 'manual-rate' | 'commissions')[] | null) => {
      setNavOpen(false);
      const sections = Array.isArray(currencySections) ? currencySections : null;
      setProfileInitialCurrencySections(sections);
      flushActiveBudgetSettingsRef.current();
      applyActiveBudgetSettingsRef.current(activeBudgetId, budgetRegistryRef.current);
      if (activeTab !== 'profile') {
        profileReturnTabRef.current = activeTab as MainTabId;
      }

      if (sections) {
        // Deep-link helpers set the hash before calling openProfile.
      } else {
        clearProfileSettingsHash();
        if (activeTab === 'profile') {
          finishPlainProfileOpen();
        } else {
          pendingPlainProfileOpenRef.current = true;
        }
      }

      setActiveTab('profile');
    },
    [activeTab, activeBudgetId, clearProfileSettingsHash, finishPlainProfileOpen],
  );

  useLayoutEffect(() => {
    if (activeTab !== 'profile' || !pendingPlainProfileOpenRef.current) return;
    pendingPlainProfileOpenRef.current = false;
    finishPlainProfileOpen();
  }, [activeTab, finishPlainProfileOpen]);

  const openSettingsExchangeRates = useCallback(() => {
    navigateToSettingsSection('settings-exchange');
    openProfile(['exchange']);
  }, [navigateToSettingsSection, openProfile]);

  const openSettingsManualRate = useCallback(() => {
    navigateToSettingsSection('settings-manual-rate');
    openProfile(['manual-rate']);
  }, [navigateToSettingsSection, openProfile]);

  const openSettingsCommissions = useCallback(() => {
    navigateToSettingsSection('settings-commissions');
    openProfile(['commissions']);
  }, [navigateToSettingsSection, openProfile]);

  // Reactive watcher: detect historical overrides when the user picks a past date + currency
  // in the New Expense form.
  const refreshNewExpenseHistoricalState = useCallback(() => {
    const isoDate = normalizeDate(newExpense.date);

    setNewExpenseHistoricalLastChoice(null);
    setNewExpenseHistoricalBannerOptions(null);

    if (isoDate >= getLocalTodayIso()) {
      setNewExpenseHistoricalBanner(null);
      setNewExpenseHistoricalApplied(EMPTY_NEW_EXPENSE_HISTORICAL_APPLIED);
      return;
    }

    const resolved = resolveNewExpenseHistoricalState(
      isoDate,
      newExpense.currency as ExpenseCurrency,
    );

    setNewExpenseHistoricalApplied(resolved.autoApplied);

    const suppressBanner = newExpense.currency === displayCurrency;
    if (!suppressBanner && resolved.showBanner && resolved.bannerContext) {
      setNewExpenseHistoricalBanner(resolved.bannerContext);
    } else {
      setNewExpenseHistoricalBanner(null);
    }
  }, [displayCurrency, newExpense.date, newExpense.currency]);

  /** After automation-flag patches — refresh banner visibility / auto-apply without clearing one-shot injections. */
  const refreshNewExpenseHistoricalFromAutomation = useCallback(() => {
    const isoDate = normalizeDate(newExpense.date);
    if (isoDate >= getLocalTodayIso()) return;

    const resolved = resolveNewExpenseHistoricalState(
      isoDate,
      newExpense.currency as ExpenseCurrency,
    );

    if (resolved.autoApplied.rateEntry || resolved.autoApplied.feeEntry) {
      setNewExpenseHistoricalApplied(resolved.autoApplied);
    }

    const suppressBanner = newExpense.currency === displayCurrency;
    if (!suppressBanner && resolved.showBanner && resolved.bannerContext) {
      setNewExpenseHistoricalBanner(resolved.bannerContext);
    } else if (!suppressBanner && !resolved.showBanner) {
      setNewExpenseHistoricalBanner(null);
    } else if (suppressBanner) {
      setNewExpenseHistoricalBanner(null);
    }
  }, [displayCurrency, newExpense.date, newExpense.currency]);

  useEffect(() => {
    refreshNewExpenseHistoricalState();
  }, [refreshNewExpenseHistoricalState]);

  useEffect(() => {
    return subscribeHistoricalOverridesUpdated((event) => {
      if (isAutomationOnlyHistoricalUpdate(event)) {
        refreshNewExpenseHistoricalFromAutomation();
      } else {
        refreshNewExpenseHistoricalState();
      }
    });
  }, [refreshNewExpenseHistoricalState, refreshNewExpenseHistoricalFromAutomation]);

  const newExpenseIsoDate = normalizeDate(newExpense.date);

  const newExpenseHistoricalFeePercent = useMemo(() => {
    const fee = newExpenseHistoricalApplied.feeEntry?.feePercent;
    return fee != null && fee > 0 && fee <= 100 ? fee : undefined;
  }, [newExpenseHistoricalApplied.feeEntry]);

  const persistHistoricalAutomationUpdates = useCallback(
    async (updatedEntries: HistoricalOverrideEntry[]) => {
      const currentUser = auth.currentUser;
      if (!shouldSyncToFirestore(currentUser)) return;
      for (const entry of updatedEntries) {
        await saveHistoricalOverrideToCloud(currentUser.uid, entry).catch(() => {});
      }
    },
    [],
  );

  const handleNewExpenseHistoricalChoice = useCallback(
    (choice: HistoricalOverrideApplyChoice, options: HistoricalOverrideBannerOptions) => {
      if (!newExpenseHistoricalBanner) return;

      const context = newExpenseHistoricalBanner;

      setNewExpenseHistoricalLastChoice(choice);
      setNewExpenseHistoricalBannerOptions(options);
      setNewExpenseHistoricalApplied(appliedFromHistoricalChoice(choice, context));
      setNewExpenseHistoricalBanner(null);

      const updatedEntries = applyBannerAutomationFromChoice(choice, context, options);
      void persistHistoricalAutomationUpdates(updatedEntries);
    },
    [newExpenseHistoricalBanner, persistHistoricalAutomationUpdates],
  );

  // Sync newly archived historical overrides to Firestore whenever a new entry is written.
  useEffect(() => {
    return subscribeHistoricalOverridesUpdated(() => {
      const currentUser = auth.currentUser;
      if (!shouldSyncToFirestore(currentUser)) return;
      // Import listHistoricalOverrides lazily to avoid a module-level circular
      // dependency; the service is already bundled.
      import('./services/historicalOverrideService')
        .then(({ listHistoricalOverrides }) => {
          const entries = listHistoricalOverrides();
          if (entries.length === 0) return;
          // Sync only the most recent entry (each archive event writes one entry).
          const latest = entries[0];
          void saveHistoricalOverrideToCloud(currentUser.uid, latest).catch(() => {});
        })
        .catch(() => {});
    });
  }, []);

  const handleQuickLanguageToggle = () => {
    const nextLang = lang === 'he' ? 'en' : 'he';
    // Keep parity with profile settings language switch flow.
    writePreferredLanguage(nextLang);
    setLang(nextLang);
  };

  const closeProfile = () => {
    setProfileInitialCurrencySections(null);
    clearProfileSettingsHash();
    setActiveTab(profileReturnTabRef.current);
  };

  const handleLogout = async () => {
    try {
      cancelPendingFinancialCloudSave();
      flushActiveBudgetFinancial({ cloud: true });
      clearAllCurrencyCommissionsLocal();
      clearAllManualExchangeOverridesLocal();
      clearCloudCurrencyCommissions();
      clearCloudManualExchangeOverrides();
      clearRegisteredSessionLocalStorage();
      saveToLocalStorage(EMPTY_USER_APP_DATA);
      resetAppData();
      skipNextSettingsSaveRef.current = true;
      setSettingsPersistence('local');
      rehydrateIsolatedGuestSession(applySettingsFromCloud);
      setAvatarUrl(getGuestAvatarFromStorage());
      setNavOpen(false);
      setBudgetDrawerOpen(false);
      setAppShellView('active-budget');
      setActiveBudgetId(DEFAULT_MONTHLY_BUDGET_ID);
      setBudgetRegistry({ personal: [], shared: [] });
      setBudgetSystemReady(false);
      budgetFinancialCacheRef.current = {};
      financialConversionGuardRef.current = {};
      budgetSettingsCacheRef.current = {};
      budgetBootstrappedRef.current = false;
      budgetBootstrapUserIdRef.current = null;
      userBudgetChoiceClaimedRef.current = false;
      setActiveTab('dashboard');
      await signOutUser();
    } catch {
      // sign-out errors are rare; user state will sync via onAuthStateChanged
    }
  };

  const handleSaveAvatar = async (selectedUrl: string) => {
    if (!user) return;
    const safeAvatarUrl = sanitizeAvatarUrl(selectedUrl, DEFAULT_GUEST_AVATAR_URL);
    if (user.isAnonymous) {
      window.localStorage.setItem(GUEST_AVATAR_STORAGE_KEY, safeAvatarUrl);
      setAvatarUrl(safeAvatarUrl);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) return;
    await updateProfile(currentUser, { photoURL: safeAvatarUrl });
    setAvatarUrl(safeAvatarUrl);
  };

  const handleAutoTransferBudgetChange = (nextValue: boolean) => {
    setAutoTransferByMonth((prev) => ({ ...prev, [selectedMonthKey]: nextValue }));
  };

  // Search query for the Expenses history page.
  const [search, setSearch] = useState('');
  const [timeFilter, setTimeFilter] = useState<HistoryTimeFilter>('daily');

  // The month currently being viewed (stored as the 1st of that month).
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Custom (user-created) categories, persisted separately from the built-in ones.
  // Icon components can't be serialized, so we store an icon *name* + color class.
  const [customCategories, setCustomCategories] = useState<StoredCustomCategory[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [newCategoryIcon, setNewCategoryIcon] = useState(ICON_OPTIONS[0].name);
  const [categoryError, setCategoryError] = useState('');

  // Per-category sub-budget allocations, scoped per month:
  // monthKey ('YYYY-MM') -> { categoryValue -> amount }.
  const [subBudgetsByMonth, setSubBudgetsByMonth] = useState<
    Record<string, Record<string, number>>
  >({});

  // Immutable per-category sub-budget baselines (Source of Truth):
  // monthKey -> categoryKey -> { amount, currency } captured exactly as typed.
  // `subBudgetsByMonth` above stays the ILS canonical ledger used for allocation
  // math; this map drives lossless display projection (zero-math reversion).
  const [subBudgetsOriginalByMonth, setSubBudgetsOriginalByMonth] = useState<
    Record<string, Record<string, { amount: number; currency: ExpenseCurrency }>>
  >({});

  // The full list of selectable categories: built-ins + user-created.
  const allCategories: Category[] = [
    ...CATEGORIES.map((c) => ({ ...c, label: localizeCategoryLabel(c.value, lang) })),
    ...customCategories.map((c) => ({
      value: c.value,
      label: getUserContent(c.label),
      color: c.color,
      icon: c.isLinkedBudget ? resolveBudgetFormIcon(c.iconName) : resolveIcon(c.iconName),
      isLinkedBudget: c.isLinkedBudget,
      sourceBudgetId: c.sourceBudgetId,
    })),
  ];

  // The month currently in focus ('YYYY-MM') and its budget + sub-budgets.
  // Deriving these keeps the rest of the component working with simple values.
  const selectedMonthKey = monthKeyOfDate(selectedDate);
  const getAutoTransferStatusForMonth = useCallback(
    (targetMonthKey: string): boolean => {
      if (monthHasExplicitAutoTransferRecord(autoTransferByMonth, targetMonthKey)) {
        return autoTransferByMonth[targetMonthKey] ?? true;
      }

      const explicitMonthKeys = Object.keys(autoTransferByMonth);
      if (explicitMonthKeys.length === 0) return true;

      const earliestOrder = Math.min(...explicitMonthKeys.map((key) => monthOrder(key)));
      let cursorMonthKey = previousMonthKey(targetMonthKey);

      while (monthOrder(cursorMonthKey) >= earliestOrder) {
        if (monthHasExplicitAutoTransferRecord(autoTransferByMonth, cursorMonthKey)) {
          return autoTransferByMonth[cursorMonthKey] ?? true;
        }
        cursorMonthKey = previousMonthKey(cursorMonthKey);
      }

      return true;
    },
    [autoTransferByMonth],
  );

  const getBudgetResolutionForMonth = useCallback(
    (targetMonthKey: string): { amountIls: number; sourceMonthKey: string | null } => {
      // STEP A: explicit month budget always wins.
      if (monthHasExplicitBudgetRecord(budgetsByMonth, targetMonthKey)) {
        return { amountIls: budgetsByMonth[targetMonthKey] ?? 0, sourceMonthKey: targetMonthKey };
      }

      // Auto-transfer state for this target month controls inheritance.
      if (!getAutoTransferStatusForMonth(targetMonthKey)) {
        return { amountIls: 0, sourceMonthKey: null };
      }

      const explicitBudgetMonthKeys = Object.keys(budgetsByMonth);
      if (explicitBudgetMonthKeys.length === 0) return { amountIls: 0, sourceMonthKey: null };

      const earliestBudgetOrder = Math.min(...explicitBudgetMonthKeys.map((key) => monthOrder(key)));
      let cursorMonthKey = previousMonthKey(targetMonthKey);

      while (monthOrder(cursorMonthKey) >= earliestBudgetOrder) {
        if (!getAutoTransferStatusForMonth(cursorMonthKey)) {
          return { amountIls: 0, sourceMonthKey: null };
        }
        if (monthHasExplicitBudgetRecord(budgetsByMonth, cursorMonthKey)) {
          return { amountIls: budgetsByMonth[cursorMonthKey] ?? 0, sourceMonthKey: cursorMonthKey };
        }
        cursorMonthKey = previousMonthKey(cursorMonthKey);
      }

      return { amountIls: 0, sourceMonthKey: null };
    },
    [budgetsByMonth, getAutoTransferStatusForMonth],
  );

  const selectedBudgetResolution = useMemo(
    () => getBudgetResolutionForMonth(selectedMonthKey),
    [getBudgetResolutionForMonth, selectedMonthKey],
  );
  const budget = selectedBudgetResolution.amountIls;
  const selectedBudgetSourceMonthKey = selectedBudgetResolution.sourceMonthKey;
  const selectedBudgetDisplayLabel = useMemo(() => {
    if (selectedBudgetSourceMonthKey) {
      const original = budgetOriginalByMonth[selectedBudgetSourceMonthKey];
      if (original && original.currency === displayCurrency) {
        return formatAmountWithSymbol(original.amount, displayCurrency);
      }
    }
    return formatMoney(budget);
  }, [
    selectedBudgetSourceMonthKey,
    budgetOriginalByMonth,
    displayCurrency,
    budget,
    formatMoney,
  ]);
  const budgetInputVisibleLength = useMemo(() => {
    const typedLen = budgetInput.trim().length;
    if (typedLen > 0) return typedLen;
    if (budget > 0) return `${tr('currentAmountPrefix')}: ${selectedBudgetDisplayLabel}`.length;
    return tr('enterAmount').length;
  }, [budgetInput, budget, tr, selectedBudgetDisplayLabel]);
  const budgetInputTextClass = useMemo(
    () => budgetMoneyFieldTypographyClass(budgetInputVisibleLength),
    [budgetInputVisibleLength],
  );

  const activePersonalBudgetMeta = useMemo(
    () => budgetRegistry.personal.find((b) => b.id === activeBudgetId) ?? null,
    [budgetRegistry.personal, activeBudgetId],
  );

  /** Dashboard budget card title: monthly default vs. named personal budget. */
  const budgetSetterTitle = useMemo(() => {
    const isMainBudget =
      activeBudgetId === DEFAULT_MONTHLY_BUDGET_ID ||
      activePersonalBudgetMeta?.isDefaultMonthly === true;
    if (isMainBudget) return tr('addMonthlyBudget');
    return formatTranslation(lang, 'addBudgetFor', {
      name: activePersonalBudgetMeta?.name ?? '',
    });
  }, [activeBudgetId, activePersonalBudgetMeta, lang, tr]);
  const showBudgetCurrentAmountOverlay = useMemo(
    () => budget > 0 && budgetInput.trim().length === 0,
    [budget, budgetInput],
  );
  const updateBudgetLabel = tr('updateBudget');
  const budgetSavedLabel = tr('budgetSaved');
  const getBudgetButtonTextClass = useCallback((label: string): string => {
    const len = label.trim().length;
    if (len < 8) return 'text-sm sm:text-base leading-tight';
    if (len <= 14) return 'text-sm sm:text-sm leading-tight';
    return 'text-[10px] sm:text-xs leading-tight';
  }, []);
  const renderBudgetButtonText = useCallback(
    (label: string) => {
      const tokens = label.split(/(\s+)/);
      return (
        <span className={`w-full px-0.5 text-center break-keep ${getBudgetButtonTextClass(label)}`.trim()}>
          {tokens.map((token, index) => {
            const isWhitespace = /^\s+$/.test(token);
            if (isWhitespace) return <span key={`ws-${index}`}>{token}</span>;
            const hasCompoundConnector = token.includes('-') || token.includes('_');
            if (hasCompoundConnector) {
              return (
                <span key={`tk-${index}`} className="inline-block whitespace-nowrap">
                  {token}
                </span>
              );
            }
            return <span key={`tk-${index}`}>{token}</span>;
          })}
        </span>
      );
    },
    [getBudgetButtonTextClass],
  );
  const isAutoTransferEnabledForSelectedMonth = useMemo(
    () => getAutoTransferStatusForMonth(selectedMonthKey),
    [getAutoTransferStatusForMonth, selectedMonthKey],
  );
  const subBudgets = subBudgetsByMonth[selectedMonthKey] ?? {};
  const subBudgetsOriginal = subBudgetsOriginalByMonth[selectedMonthKey] ?? {};

  const patchSubBudgetsByMonth = useCallback(
    (
      monthKey: string,
      patch: (monthMap: Record<string, number>) => Record<string, number>,
      // Optional immutable-baseline patch applied to subBudgetsOriginalByMonth in
      // lockstep with the ILS ledger patch so both persist atomically.
      originalPatch?: (
        monthMap: Record<string, { amount: number; currency: ExpenseCurrency }>,
      ) => Record<string, { amount: number; currency: ExpenseCurrency }>,
    ) => {
      locallyEditedSubBudgetMonthsRef.current.add(monthKey);

      const currentMonth = subBudgetsByMonth[monthKey] ?? {};
      const patchedMonth = patch(currentMonth);
      const nextSubBudgetsByMonth = { ...subBudgetsByMonth, [monthKey]: patchedMonth };

      const nextSubBudgetsOriginalByMonth = originalPatch
        ? {
            ...subBudgetsOriginalByMonth,
            [monthKey]: originalPatch(subBudgetsOriginalByMonth[monthKey] ?? {}),
          }
        : subBudgetsOriginalByMonth;

      if (originalPatch) {
        setSubBudgetsOriginalByMonth(nextSubBudgetsOriginalByMonth);
      }
      setSubBudgetsByMonth(nextSubBudgetsByMonth);

      if (!dataReady) return;

      const payload = snapshotUserAppData({
        expenses,
        customCategories,
        budgetsByMonth,
        budgetOriginalByMonth,
        subBudgetsByMonth: nextSubBudgetsByMonth,
        subBudgetsOriginalByMonth: nextSubBudgetsOriginalByMonth,
        autoTransferByMonth,
      });

      if (user?.isAnonymous) {
        saveToLocalStorage(payload);
      }

      commitFinancialPayloadRef.current(payload, { cloud: true });
    },
    [
      subBudgetsByMonth,
      subBudgetsOriginalByMonth,
      budgetsByMonth,
      budgetOriginalByMonth,
      autoTransferByMonth,
      customCategories,
      dataReady,
      expenses,
      user,
    ],
  );

  useEffect(() => {
    const texts = new Set<string>();
    customCategories.forEach((c) => {
      texts.add(c.label);
      texts.add(c.value);
    });
    expenses.forEach((e) => {
      texts.add(e.category);
      texts.add(e.description);
    });
    Object.values(subBudgetsByMonth).forEach((monthMap) => {
      subBudgetCategoryKeys(monthMap).forEach((key) => texts.add(key));
    });
    void ensureUserContents(Array.from(texts));
  }, [customCategories, expenses, subBudgetsByMonth, ensureUserContents, lang, keepOriginalValues]);

  // Automatic month inheritance — only while inside an active budget (prevents stale writes on registry routes).
  useEffect(() => {
    if (appShellView !== 'active-budget') return;

    const hasExplicitSubBudgetMonth = monthHasSubBudgetRecord(
      subBudgetsByMonth,
      selectedMonthKey,
    );
    if (hasExplicitSubBudgetMonth) return;

    if (!hasExplicitSubBudgetMonth) {
      const subSourceMonthKey = findNearestPriorMonthWithSubBudgets(
        selectedMonthKey,
        subBudgetsByMonth,
      );
      if (subSourceMonthKey) {
        const inheritedSubBudgets = { ...(subBudgetsByMonth[subSourceMonthKey] ?? {}) };
        delete inheritedSubBudgets[SUB_BUDGET_MONTH_MARKER];
        setSubBudgetsByMonth((prev) => ({
          ...prev,
          [selectedMonthKey]: inheritedSubBudgets,
        }));
        // Carry the immutable baselines forward in lockstep so the inherited
        // month projects losslessly instead of re-deriving from the ILS ledger.
        const inheritedOriginal = { ...(subBudgetsOriginalByMonth[subSourceMonthKey] ?? {}) };
        delete inheritedOriginal[SUB_BUDGET_MONTH_MARKER];
        setSubBudgetsOriginalByMonth((prev) => ({
          ...prev,
          [selectedMonthKey]: inheritedOriginal,
        }));
      }
    }
  }, [appShellView, selectedMonthKey, subBudgetsByMonth, subBudgetsOriginalByMonth]);

  const writeFinancialToCache = useCallback((budgetId: string, snapshot: UserAppData) => {
    budgetFinancialCacheRef.current[budgetId] = snapshot;
    saveBudgetFinancialLocal(budgetId, snapshot);
    financialLocalVersionRef.current[budgetId] = Date.now();
  }, []);

  const commitFinancialPayload = useCallback(
    (payload: UserAppData, options?: { cloud?: boolean }) => {
      const budgetId = activeBudgetIdRef.current;
      if (!budgetId || appShellViewRef.current !== 'active-budget') return;

      writeFinancialToCache(budgetId, payload);
      activeFinancialSnapshotRef.current = { budgetId, data: payload };

      if (!options?.cloud) return;

      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.isAnonymous) return;

      if (financialPersistTimerRef.current != null) {
        window.clearTimeout(financialPersistTimerRef.current);
        financialPersistTimerRef.current = null;
      }
      void saveBudgetFinancialCloud(currentUser.uid, budgetId, payload).catch(() => {
        // Non-blocking; debounced persist or a later edit will retry.
      });
    },
    [writeFinancialToCache],
  );
  commitFinancialPayloadRef.current = commitFinancialPayload;

  const buildCurrentFinancialPayload = useCallback(
    (expenseOverride?: Expense[]): UserAppData =>
      snapshotUserAppData({
        expenses: expenseOverride ?? expenses,
        customCategories,
        budgetsByMonth,
        budgetOriginalByMonth,
        subBudgetsByMonth,
        subBudgetsOriginalByMonth,
        autoTransferByMonth,
      }),
    [
      expenses,
      customCategories,
      budgetsByMonth,
      budgetOriginalByMonth,
      subBudgetsByMonth,
      subBudgetsOriginalByMonth,
      autoTransferByMonth,
    ],
  );

  const applyAppData = (
    data: typeof EMPTY_USER_APP_DATA,
    source = 'unspecified',
    budgetIdOverride?: string | null,
  ) => {
    const snapshot = snapshotUserAppData({
      expenses: data.expenses,
      customCategories: data.customCategories,
      budgetsByMonth: data.budgetsByMonth,
      budgetOriginalByMonth: data.budgetOriginalByMonth,
      subBudgetsByMonth: data.subBudgetsByMonth,
      subBudgetsOriginalByMonth: data.subBudgetsOriginalByMonth,
      autoTransferByMonth: data.autoTransferByMonth,
    });
    const budgetId = budgetIdOverride ?? activeBudgetIdRef.current;
    budgetDebug('applyAppData', {
      source,
      budgetId: budgetId?.slice(-10) ?? null,
      ...snapshotFinancialForLog(snapshot),
    });
    if (budgetId) {
      activeFinancialSnapshotRef.current = { budgetId, data: snapshot };
      writeFinancialToCache(budgetId, snapshot);
    }
    setExpenses(
      data.expenses.map((e) => ({
        ...normalizeStoredExpense(e),
        date: normalizeDate(e.date),
      })),
    );
    setCustomCategories(data.customCategories);
    setBudgetsByMonth(data.budgetsByMonth);
    setBudgetOriginalByMonth(
      (data.budgetOriginalByMonth as Record<string, { amount: number; currency: ExpenseCurrency }> | undefined) ??
        {},
    );
    setAutoTransferByMonth(data.autoTransferByMonth ?? {});
    setSubBudgetsByMonth(data.subBudgetsByMonth);
    setSubBudgetsOriginalByMonth(
      (data.subBudgetsOriginalByMonth as
        | Record<string, Record<string, { amount: number; currency: ExpenseCurrency }>>
        | undefined) ?? {},
    );
  };

  useLayoutEffect(() => {
    selectedMonthKeyRef.current = selectedMonthKey;
    if (appShellView !== 'active-budget' || !activeBudgetId) return;
    activeFinancialSnapshotRef.current = {
      budgetId: activeBudgetId,
      data: snapshotUserAppData({
        expenses,
        customCategories,
        budgetsByMonth,
        budgetOriginalByMonth,
        subBudgetsByMonth,
        subBudgetsOriginalByMonth,
        autoTransferByMonth,
      }),
    };
  }, [
    appShellView,
    activeBudgetId,
    selectedMonthKey,
    expenses,
    customCategories,
    budgetsByMonth,
    budgetOriginalByMonth,
    subBudgetsByMonth,
    subBudgetsOriginalByMonth,
    autoTransferByMonth,
  ]);

  const resetAppData = () => {
    locallyEditedSubBudgetMonthsRef.current.clear();
    setExpenses([]);
    setCustomCategories([]);
    setBudgetsByMonth({});
    setBudgetOriginalByMonth({});
    setAutoTransferByMonth({});
    setSubBudgetsByMonth({});
    setSubBudgetsOriginalByMonth({});
    setBudgetInput('');
    setSearch('');
    setNewExpense({
      description: '',
      amount: '',
      currency: displayCurrency as ExpenseCurrency,
      category: CATEGORIES[0]?.value ?? '',
      date: toISODate(new Date()),
    });
    setExpenseRatesReady(true);
  };

  const buildCurrentSettingsSnapshot = useCallback(
    (): UserSettings => ({
      lang,
      keepOriginalValues,
      displayCurrency,
      saved_colors: savedColors,
      custom_currencies: customCurrencies,
      currency_layout: currencyLayout,
      themePreferences,
    }),
    [
      lang,
      keepOriginalValues,
      displayCurrency,
      savedColors,
      customCurrencies,
      currencyLayout,
      themePreferences,
    ],
  );

  const buildGlobalSettingsForCloud = useCallback(
    (nextUiPreferences?: UiPreferences): UserSettings => ({
      ...buildCurrentSettingsSnapshot(),
      uiPreferences: nextUiPreferences ?? uiPreferences,
    }),
    [buildCurrentSettingsSnapshot, uiPreferences],
  );

  const persistUiPreferences = useCallback(
    (patch: Partial<UiPreferences>) => {
      setUiPreferences((prev) => {
        const next = { ...prev, ...patch };
        if (user && shouldSyncToFirestore(user)) {
          void saveSettingsToCloud(user.uid, buildGlobalSettingsForCloud(next));
        }
        return next;
      });
    },
    [buildGlobalSettingsForCloud, user],
  );

  const flushBudgetFinancialById = useCallback(
    (budgetId: string | null, options?: { cloud?: boolean }) => {
      if (!budgetId) return;

      const snapshot =
        activeFinancialSnapshotRef.current.budgetId === budgetId
          ? activeFinancialSnapshotRef.current.data
          : budgetFinancialCacheRef.current[budgetId] ?? loadBudgetFinancialLocal(budgetId);

      writeFinancialToCache(budgetId, snapshot);

      if (options?.cloud) {
        const currentUser = auth.currentUser;
        if (currentUser && !currentUser.isAnonymous) {
          void saveBudgetFinancialCloud(currentUser.uid, budgetId, snapshot).catch(() => {});
        }
      }
    },
    [writeFinancialToCache],
  );

  const cancelPendingFinancialCloudSave = useCallback(() => {
    if (financialPersistTimerRef.current != null) {
      window.clearTimeout(financialPersistTimerRef.current);
      financialPersistTimerRef.current = null;
    }
  }, []);

  const flushActiveBudgetFinancial = useCallback(
    (options?: { cloud?: boolean }) => {
      cancelPendingFinancialCloudSave();
      flushBudgetFinancialById(activeBudgetIdRef.current, options);
    },
    [cancelPendingFinancialCloudSave, flushBudgetFinancialById],
  );

  const flushActiveBudgetSettings = useCallback(() => {
    if (!activeBudgetId) return;
    const storageKey = resolveSettingsStorageKey(activeBudgetId, budgetRegistry);
    const snapshot = buildCurrentSettingsSnapshot();
    budgetSettingsCacheRef.current[storageKey] = snapshot;
    saveBudgetSettingsLocal(storageKey, snapshot);
    activeBudgetSettingsKeyRef.current = storageKey;
  }, [activeBudgetId, budgetRegistry, buildCurrentSettingsSnapshot]);

  const applyActiveBudgetSettings = useCallback(
    (budgetId: string, registry: BudgetRegistryState) => {
      const storageKey = resolveSettingsStorageKey(budgetId, registry);
      activeBudgetSettingsKeyRef.current = storageKey;
      const scoped = getBudgetScopedSettings(
        budgetId,
        registry,
        budgetSettingsCacheRef.current,
        EMPTY_USER_SETTINGS,
      );
      skipNextSettingsSaveRef.current = true;
      skipDisplayCurrencyConversionRef.current = true;
      applySettingsFromCloud(scoped);
      scopedDisplayCurrencyRef.current = scoped.displayCurrency as ExpenseCurrency;
    },
    [applySettingsFromCloud],
  );

  applySettingsFromCloudRef.current = applySettingsFromCloud;
  applyActiveBudgetSettingsRef.current = applyActiveBudgetSettings;
  flushActiveBudgetSettingsRef.current = flushActiveBudgetSettings;
  setLangRef.current = setLang;
  appShellViewRef.current = appShellView;
  activeBudgetIdRef.current = activeBudgetId;
  budgetRegistryRef.current = budgetRegistry;

  const commitPersonalBudgetRegistryTotal = useCallback(
    (budgetId: string, displayTotal: number) => {
      const nextRegistry = patchPersonalBudgetRegistryTotal(
        budgetRegistryRef.current,
        budgetId,
        displayTotal,
      );
      if (nextRegistry === budgetRegistryRef.current) return;
      budgetRegistryRef.current = nextRegistry;
      registryPatchedAtRef.current[budgetId] = Date.now();
      setBudgetRegistry(nextRegistry);
      saveBudgetRegistryLocal(nextRegistry);
      const currentUser = auth.currentUser;
      if (currentUser && !currentUser.isAnonymous) {
        void saveBudgetRegistryCloud(currentUser.uid, nextRegistry).catch(() => {});
      }
    },
    [],
  );

  const invalidateInFlightCurrencyConversion = useCallback(() => {
    currencyConversionGenerationRef.current += 1;
  }, []);

  const syncRegistryTotalFromFinancialSnapshot = useCallback(
    (budgetId: string | null) => {
      if (!budgetId) return;
      const meta = budgetRegistryRef.current.personal.find((b) => b.id === budgetId);
      if (!meta || meta.isDefaultMonthly) return;

      const financial =
        activeFinancialSnapshotRef.current.budgetId === budgetId
          ? activeFinancialSnapshotRef.current.data
          : budgetFinancialCacheRef.current[budgetId];
      if (!financial) return;

      const scopedCurrency = getBudgetScopedSettings(
        budgetId,
        budgetRegistryRef.current,
        budgetSettingsCacheRef.current,
        {
          ...EMPTY_USER_SETTINGS,
          displayCurrency: scopedDisplayCurrencyRef.current,
        },
      ).displayCurrency as ExpenseCurrency;

      const registryTotal = deriveRegistryTotalFromFinancialMonth(
        financial,
        selectedMonthKeyRef.current,
        scopedCurrency,
        getCachedExchangeRates(),
      );
      if (registryTotal != null && registryTotal > 0) {
        commitPersonalBudgetRegistryTotal(budgetId, registryTotal);
      }
    },
    [commitPersonalBudgetRegistryTotal],
  );

  const enterBudget = useCallback(
    (
      budgetId: string,
      registryOverride?: BudgetRegistryState,
      options?: { skipSettingsFlush?: boolean; initialSelectedDate?: Date },
    ) => {
      userBudgetChoiceClaimedRef.current = true;
      budgetDebug('enterBudget:start', {
        budgetId: budgetId.slice(-10),
        hasRegistryOverride: Boolean(registryOverride),
        skipSettingsFlush: options?.skipSettingsFlush ?? false,
        initialSelectedDate: options?.initialSelectedDate?.toISOString() ?? null,
        activeBudgetIdBefore: activeBudgetIdRef.current?.slice(-10) ?? null,
        reactStateBefore: snapshotFinancialForLog({
          budgetsByMonth,
          budgetOriginalByMonth,
          autoTransferByMonth,
        }),
      });
      invalidateInFlightCurrencyConversion();
      syncRegistryTotalFromFinancialSnapshot(activeBudgetIdRef.current);
      flushActiveBudgetFinancial({ cloud: true });
      if (!options?.skipSettingsFlush) {
        flushActiveBudgetSettings();
      }
      const registry = registryOverride ?? budgetRegistry;
      let cached = resolveBudgetFinancialForEntry(
        budgetId,
        budgetFinancialCacheRef.current,
        loadBudgetFinancialLocal,
      );
      const meta = registry.personal.find((b) => b.id === budgetId);
      if (meta && !meta.isDefaultMonthly) {
        const scopedCurrency = getBudgetScopedSettings(
          budgetId,
          registry,
          budgetSettingsCacheRef.current,
          buildCurrentSettingsSnapshot(),
        ).displayCurrency as ExpenseCurrency;
        const seeded = ensurePersonalBudgetFinancialSeeded(
          cached,
          meta,
          scopedCurrency,
          getCachedExchangeRates(),
        );
        if (seeded !== cached) {
          cached = seeded;
          writeFinancialToCache(budgetId, cached);
        }
      }
      writeFinancialToCache(budgetId, cached);

      const viewDate =
        options?.initialSelectedDate ?? resolveFinancialViewMonthDate(cached, meta);
      if (viewDate) {
        flushSync(() => setSelectedDate(viewDate));
      }

      budgetDebug('enterBudget:resolved', {
        budgetId: budgetId.slice(-10),
        metaTotalAmount: meta?.totalAmount ?? null,
        settingsMode: meta?.settingsMode ?? null,
        viewDate: viewDate?.toISOString() ?? null,
        cached: snapshotFinancialForLog(cached),
        cacheRef: snapshotFinancialForLog(budgetFinancialCacheRef.current[budgetId]),
        localStorage: snapshotFinancialForLog(loadBudgetFinancialLocal(budgetId)),
      });

      setActiveBudgetId(budgetId);
      activeBudgetIdRef.current = budgetId;
      budgetDebug('enterBudget:preApply', {
        budgetId: budgetId.slice(-10),
        selectedMonthKeyAfterFlushSync: monthKeyOfDate(viewDate ?? selectedDate),
      });
      applyAppData(cached, 'enterBudget', budgetId);
      applyActiveBudgetSettings(budgetId, registry);
      appShellViewRef.current = 'active-budget';
      setAppShellView('active-budget');
      setActiveTab('dashboard');
      setBudgetDrawerOpen(false);
    },
    [
      flushActiveBudgetFinancial,
      flushActiveBudgetSettings,
      applyActiveBudgetSettings,
      budgetRegistry,
      buildCurrentSettingsSnapshot,
      invalidateInFlightCurrencyConversion,
      syncRegistryTotalFromFinancialSnapshot,
    ],
  );

  const navigateAppShell = useCallback(
    (view: AppShellView) => {
      if (view === 'active-budget') return;
      invalidateInFlightCurrencyConversion();
      syncRegistryTotalFromFinancialSnapshot(activeBudgetIdRef.current);
      flushActiveBudgetFinancial({ cloud: true });
      flushActiveBudgetSettings();
      activeFinancialSnapshotRef.current = {
        budgetId: null,
        data: { ...EMPTY_USER_APP_DATA },
      };
      if (activeTab === 'profile') {
        setProfileInitialCurrencySections(null);
        setActiveTab(profileReturnTabRef.current);
      }
      appShellViewRef.current = view;
      setAppShellView(view);
      setBudgetDrawerOpen(false);
      setNavOpen(false);
    },
    [flushActiveBudgetFinancial, flushActiveBudgetSettings, activeTab, invalidateInFlightCurrencyConversion, syncRegistryTotalFromFinancialSnapshot],
  );

  const getBudgetDisplayCurrency = useCallback(
    (budgetId: string): ExpenseCurrency =>
      getBudgetScopedSettings(
        budgetId,
        budgetRegistry,
        budgetSettingsCacheRef.current,
        buildCurrentSettingsSnapshot(),
      ).displayCurrency as ExpenseCurrency,
    [budgetRegistry, buildCurrentSettingsSnapshot],
  );

  const handleCreatePersonalBudget = useCallback(
    (input: CreatePersonalBudgetInput) => {
      const id = createBudgetId('personal');
      const meta: PersonalBudgetMeta = {
        id,
        name: input.name,
        startDate: input.startDate,
        endDate: input.endDate,
        // Stored in the budget's display currency (matches budgetOriginalByMonth.amount).
        totalAmount: roundMoneyAmount(input.totalAmount),
        settingsMode: input.settingsMode,
        linkedBudgetId: input.linkedBudgetId,
        copiedFromBudgetId: input.copiedFromBudgetId,
        icon: input.icon,
        color: input.color,
        isLinkedToMain: input.isLinkedToMain,
        keepAfterDates: input.keepAfterDates,
        status: input.status,
        createdAt: Date.now(),
      };

      budgetDebug('create:start', {
        budgetId: id.slice(-10),
        totalAmount: meta.totalAmount,
        settingsMode: input.settingsMode,
        copiedFromBudgetId: input.copiedFromBudgetId ?? null,
        linkedBudgetId: input.linkedBudgetId ?? null,
        formCurrency: input.displayCurrency,
        startDate: input.startDate || null,
      });

      const formCurrency = input.displayCurrency;

      const targetOldCurrency: ExpenseCurrency | null =
        input.settingsMode === 'linked' && input.linkedBudgetId
          ? (getBudgetScopedSettings(
              input.linkedBudgetId,
              budgetRegistry,
              budgetSettingsCacheRef.current,
              buildCurrentSettingsSnapshot(),
            ).displayCurrency as ExpenseCurrency)
          : null;

      const buildInitialFinancial = async () => {
        let baseFinancial: UserAppData = { ...EMPTY_USER_APP_DATA };
        if (input.settingsMode === 'copy-from' && input.copiedFromBudgetId) {
          const sourceFinancial =
            budgetFinancialCacheRef.current[input.copiedFromBudgetId] ??
            loadBudgetFinancialLocal(input.copiedFromBudgetId);
          // Copy categories/expenses/etc. but strip monthly allocations — form amount wins last.
          baseFinancial = {
            ...sourceFinancial,
            budgetsByMonth: {},
            budgetOriginalByMonth: {},
          };
        }

        const seededCore = await buildInitialPersonalBudgetFinancial(
          input.totalAmount,
          formCurrency,
          input.startDate,
        );
        const now = new Date();
        const monthKey =
          input.startDate?.slice(0, 7) ??
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const ilsAmount = seededCore.budgetsByMonth[monthKey] ?? 0;

        return overlayFormMonthlySeed(
          baseFinancial,
          monthKey,
          roundMoneyAmount(input.totalAmount),
          formCurrency,
          ilsAmount,
        );
      };

      void buildInitialFinancial().then(async (initialFinancial) => {
        budgetDebug('create:initialFinancial', {
          budgetId: id.slice(-10),
          financial: snapshotFinancialForLog(initialFinancial),
        });

        let mainFinancialUpdate: UserAppData | undefined;
        let targetFinancialUpdate: UserAppData | undefined;
        const now = new Date();
        const monthKey =
          input.startDate?.slice(0, 7) ??
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const ilsAmount = initialFinancial.budgetsByMonth[monthKey] ?? 0;

        const shouldConvertTargetFinancial =
          Boolean(input.updateTargetBudgetCurrency) &&
          input.settingsMode === 'linked' &&
          Boolean(input.linkedBudgetId) &&
          targetOldCurrency != null &&
          targetOldCurrency !== formCurrency;

        let conversionRates = getCachedExchangeRates();
        if (shouldConvertTargetFinancial && !conversionRates) {
          conversionRates = (await fetchExchangeRates().catch(() => null)) ?? null;
        }

        if (shouldConvertTargetFinancial && input.linkedBudgetId && conversionRates) {
          const targetId = input.linkedBudgetId;
          const targetMetaBefore =
            budgetRegistry.personal.find((budget) => budget.id === targetId) ?? null;
          const sourceFinancial =
            budgetFinancialCacheRef.current[targetId] ??
            loadBudgetFinancialLocal(targetId) ??
            { ...EMPTY_USER_APP_DATA };

          targetFinancialUpdate = convertTargetBudgetFinancialForCurrencyChange(
            sourceFinancial,
            targetOldCurrency!,
            formCurrency,
            conversionRates,
            {
              registryMeta: targetMetaBefore,
              registryTotalAmountBefore: targetMetaBefore?.totalAmount ?? 0,
            },
          );
          budgetFinancialCacheRef.current[targetId] = targetFinancialUpdate;
          saveBudgetFinancialLocal(targetId, targetFinancialUpdate);
          armFinancialConversionGuard(financialConversionGuardRef.current, targetId);

          if (activeBudgetIdRef.current === targetId) {
            applyAppData(targetFinancialUpdate, 'create:targetCurrencyConvert');
          }
        }

        let nextRegistry: BudgetRegistryState = {
          ...budgetRegistry,
          personal: [...budgetRegistry.personal, meta],
        };

        if (shouldConvertTargetFinancial && input.linkedBudgetId && conversionRates) {
          nextRegistry = {
            ...nextRegistry,
            personal: nextRegistry.personal.map((budget) => {
              if (budget.id !== input.linkedBudgetId || !(budget.totalAmount > 0)) {
                return budget;
              }
              const convertedTotal = convertRegistryBudgetTotalAmount(
                budget.totalAmount,
                targetOldCurrency!,
                formCurrency,
                conversionRates!,
              );
              if (convertedTotal == null) return budget;
              return { ...budget, totalAmount: roundMoneyAmount(convertedTotal) };
            }),
          };
        }

        // Dual-write: mirror linked budget as a sub-budget category in the main budget.
        if (input.isLinkedToMain) {
          const mainFinancialBase =
            input.linkedBudgetId === DEFAULT_MONTHLY_BUDGET_ID && targetFinancialUpdate
              ? targetFinancialUpdate
              : loadMainBudgetFinancial(
                  budgetFinancialCacheRef.current,
                  loadBudgetFinancialLocal,
                );

          const injected = injectLinkedBudgetIntoMainFinancial(mainFinancialBase, {
            personalBudgetId: id,
            name: input.name,
            totalAmountIls: ilsAmount,
            totalAmountDisplay: roundMoneyAmount(input.totalAmount),
            displayCurrency: formCurrency,
            icon: input.icon,
            color: input.color,
            monthKey,
          });
          meta.linkedCategoryId = injected.linkedCategoryId;
          mainFinancialUpdate = injected.financial;
          budgetFinancialCacheRef.current[DEFAULT_MONTHLY_BUDGET_ID] = mainFinancialUpdate;
          saveBudgetFinancialLocal(DEFAULT_MONTHLY_BUDGET_ID, mainFinancialUpdate);

          if (activeBudgetIdRef.current === DEFAULT_MONTHLY_BUDGET_ID) {
            applyAppData(mainFinancialUpdate, 'create:linkedMainInject');
          }
        }

        budgetFinancialCacheRef.current[id] = initialFinancial;
        saveBudgetFinancialLocal(id, initialFinancial);
        budgetSettingsCacheRef.current = initializeBudgetSettingsForNewPersonalBudget(
          meta,
          nextRegistry,
          buildCurrentSettingsSnapshot(),
          budgetSettingsCacheRef.current,
          {
            displayCurrency: formCurrency,
            updateLinkedTargetCurrency: Boolean(input.updateTargetBudgetCurrency),
          },
        );

        setBudgetRegistry(nextRegistry);
        saveBudgetRegistryLocal(nextRegistry);

        const seedViewDate = resolveFinancialViewMonthDate(initialFinancial, meta);

        const conversionGuardIds = new Set<string>();
        if (targetFinancialUpdate && input.linkedBudgetId) {
          conversionGuardIds.add(input.linkedBudgetId);
        }
        if (mainFinancialUpdate && input.linkedBudgetId === DEFAULT_MONTHLY_BUDGET_ID) {
          conversionGuardIds.add(DEFAULT_MONTHLY_BUDGET_ID);
        }

        if (user && !user.isAnonymous) {
          const cloudWrites: Promise<void>[] = [];

          if (mainFinancialUpdate) {
            cloudWrites.push(
              dualWriteLinkedBudgetCreationCloud(
                user.uid,
                nextRegistry,
                id,
                initialFinancial,
                mainFinancialUpdate,
              ),
            );
          } else {
            cloudWrites.push(saveBudgetRegistryCloud(user.uid, nextRegistry));
            cloudWrites.push(saveBudgetFinancialCloud(user.uid, id, initialFinancial));
          }

          if (targetFinancialUpdate && input.linkedBudgetId) {
            const targetId = input.linkedBudgetId;
            const mainAlreadyPersisted =
              targetId === DEFAULT_MONTHLY_BUDGET_ID && Boolean(mainFinancialUpdate);
            if (!mainAlreadyPersisted) {
              cloudWrites.push(saveBudgetFinancialCloud(user.uid, targetId, targetFinancialUpdate));
            }
          }

          try {
            await Promise.all(cloudWrites);
          } catch {
            // Local cache remains authoritative until the next successful save.
          } finally {
            for (const guardId of conversionGuardIds) {
              clearFinancialConversionGuard(financialConversionGuardRef.current, guardId);
            }
          }
        } else {
          for (const guardId of conversionGuardIds) {
            clearFinancialConversionGuard(financialConversionGuardRef.current, guardId);
          }
        }

        budgetDebug('create:preEnterBudget', {
          budgetId: id.slice(-10),
          monthKey,
          seedViewDate: seedViewDate?.toISOString() ?? null,
          cache: snapshotFinancialForLog(budgetFinancialCacheRef.current[id]),
          localStorage: snapshotFinancialForLog(loadBudgetFinancialLocal(id)),
          registryTotal: meta.totalAmount,
        });

        enterBudget(id, nextRegistry, {
          skipSettingsFlush: true,
          initialSelectedDate: seedViewDate ?? undefined,
        });
        budgetSettingsCacheRef.current = finalizePersonalBudgetDisplayCurrency(
          meta,
          nextRegistry,
          budgetSettingsCacheRef.current,
          buildCurrentSettingsSnapshot(),
          formCurrency,
          input.updateTargetBudgetCurrency,
        );
        applyActiveBudgetSettings(id, nextRegistry);
        budgetDebug('create:postEnterBudget', {
          budgetId: id.slice(-10),
          note: 'sync-closure-after-enterBudget (may still be stale until next render)',
          reactBudgetsByMonth: budgetsByMonth,
          reactBudgetOriginalByMonth: budgetOriginalByMonth,
          selectedMonthKey,
          displayCurrency,
        });
        requestAnimationFrame(() => {
          budgetDebug('create:postEnterBudget:raf', {
            budgetId: id.slice(-10),
            activeBudgetId: activeBudgetIdRef.current?.slice(-10) ?? null,
            cache: snapshotFinancialForLog(budgetFinancialCacheRef.current[id]),
            localStorage: snapshotFinancialForLog(loadBudgetFinancialLocal(id)),
          });
        });
      });
    },
    [
      applyActiveBudgetSettings,
      applyAppData,
      budgetRegistry,
      buildCurrentSettingsSnapshot,
      enterBudget,
      user,
    ],
  );

  const expenseDescriptionLabel = useCallback(
    (description: string) => {
      const trimmed = description.trim();
      return trimmed.length > 0 ? trimmed : tr('expenseNoDescription');
    },
    [tr],
  );

  // Real-time sync: Firestore for signed-in users, localStorage for guests.
  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;
    let unsubBudgetRegistry: (() => void) | undefined;
    let unsubSettings: (() => void) | undefined;
    let unsubManualOverrides: (() => void) | undefined;
    let unsubCurrencyCommissions: (() => void) | undefined;
    let initialRegistry = false;
    let initialFinancial = false;
    let initialSettings = false;

    const markReadyIfComplete = () => {
      if (cancelled) return;
      if (initialRegistry && initialFinancial && initialSettings) {
        suppressCloudSaveRef.current = true;
        setDataReady(true);
      }
    };

    const initUserData = async () => {
      suppressCloudSaveRef.current = true;
      const sessionUserId = user?.uid ?? null;
      if (sessionUserId !== budgetBootstrapUserIdRef.current) {
        budgetBootstrappedRef.current = false;
        budgetBootstrapUserIdRef.current = sessionUserId;
        userBudgetChoiceClaimedRef.current = false;
      }
      const shouldBootstrapBudget = !budgetBootstrappedRef.current;

      if (!user) {
        if (hadAuthenticatedUserRef.current) {
          resetAppData();
          clearAllCurrencyCommissionsLocal();
          clearAllManualExchangeOverridesLocal();
        }
        hadAuthenticatedUserRef.current = false;

        setGuestLangActive(false);
        pendingAuthLangRef.current = null;
        setSettingsPersistence('local');
        clearCloudManualExchangeOverrides();
        clearCloudCurrencyCommissions();
        void listActiveCurrencyCommissions();
        void listActiveManualExchangeOverrides();
        skipNextSettingsSaveRef.current = true;
        rehydrateIsolatedGuestSession(applySettingsFromCloudRef.current);
        setDataReady(true);
        return;
      }

      hadAuthenticatedUserRef.current = !user.isAnonymous;
      if (shouldBootstrapBudget) {
        setDataReady(false);
        setSettingsCloudReady(false);
      }

      if (user.isAnonymous) {
        setGuestLangActive(true);
        setSettingsPersistence('local');
        void listActiveCurrencyCommissions();
        void listActiveManualExchangeOverrides();
        clearCloudManualExchangeOverrides();
        clearCloudCurrencyCommissions();
        if (shouldBootstrapBudget) {
          budgetBootstrappedRef.current = true;
          const guestLang = readGuestLang();
          if (guestLang) {
            setLangRef.current(guestLang, { persist: false });
          }
          const legacy = loadFromLocalStorage();
          const registryLocal = loadBudgetRegistryLocal();
          const { registry, financialCache } = ensureDefaultPersonalBudget(registryLocal, legacy);
          setBudgetRegistry(registry);
          budgetFinancialCacheRef.current = {
            ...budgetFinancialCacheRef.current,
            ...financialCache,
          };
          if (!userBudgetChoiceClaimedRef.current) {
            setActiveBudgetId(DEFAULT_MONTHLY_BUDGET_ID);
            setAppShellView('active-budget');
            applyAppData(financialCache[DEFAULT_MONTHLY_BUDGET_ID] ?? legacy, 'bootstrap:guest');
            applyActiveBudgetSettingsRef.current(DEFAULT_MONTHLY_BUDGET_ID, registry);
          }
          setBudgetSystemReady(true);
        }
        setDataReady(true);
        return;
      }

      setGuestLangActive(false);
      pendingAuthLangRef.current = consumePendingAuthLang();
      setSettingsPersistence('cloud');
      skipNextSettingsSaveRef.current = true;
      if (shouldBootstrapBudget) {
        applyIsolatedCloudSessionSeed(applySettingsFromCloudRef.current);
      }
      const uid = user.uid;

      try {
        await pruneExpiredCloudExchangeFees(uid);
        if (cancelled) return;
        await ensureCloudDataMigrated(uid);
        if (cancelled) return;

        if (shouldBootstrapBudget) {
          budgetBootstrappedRef.current = true;
          let registry = await loadBudgetRegistryCloud(uid);
          if (registry.personal.length === 0) {
            registry = await migrateLegacyFinancialToDefaultBudget(uid);
          }
          if (cancelled) return;

          setBudgetRegistry(registry);
          saveBudgetRegistryLocal(registry);

          const financial = await loadBudgetFinancialCloud(uid, DEFAULT_MONTHLY_BUDGET_ID);
          if (cancelled) return;

          budgetFinancialCacheRef.current[DEFAULT_MONTHLY_BUDGET_ID] = financial;
          if (!userBudgetChoiceClaimedRef.current) {
            setActiveBudgetId(DEFAULT_MONTHLY_BUDGET_ID);
            setAppShellView('active-budget');
            applyAppData(financial, 'bootstrap:cloud');
            applyActiveBudgetSettingsRef.current(DEFAULT_MONTHLY_BUDGET_ID, registry);
          }
          setBudgetSystemReady(true);
          initialRegistry = true;
          initialFinancial = true;
          markReadyIfComplete();
        }

        unsubBudgetRegistry = subscribeBudgetRegistry(
          uid,
          (nextRegistry, meta) => {
            if (cancelled || meta.hasPendingWrites) return;
            const merged = mergeRegistryWithRecentLocalPatches(
              budgetRegistryRef.current,
              nextRegistry,
              registryPatchedAtRef.current,
            );
            budgetRegistryRef.current = merged;
            budgetDebug('subscribeRegistry:incoming', {
              hasPendingWrites: meta.hasPendingWrites,
              totals: snapshotRegistryTotalsForLog(merged.personal),
              mergedLocalPatches: merged !== nextRegistry,
            });
            setBudgetRegistry(merged);
            saveBudgetRegistryLocal(merged);
          },
          () => {
            if (!cancelled) setBudgetRegistry({ personal: [], shared: [] });
          },
        );

        unsubSettings = subscribeSettings(
          uid,
          (settings, meta) => {
            if (cancelled || meta.hasPendingWrites) return;

            setUiPreferences(settings.uiPreferences ?? DEFAULT_UI_PREFERENCES);

            if (appShellViewRef.current === 'active-budget') {
              const pendingLang = pendingAuthLangRef.current;
              if (pendingLang) {
                pendingAuthLangRef.current = null;
                setLangRef.current(pendingLang, { persist: false });
              }
              skipNextSettingsSaveRef.current = true;
              applyActiveBudgetSettingsRef.current(
                activeBudgetIdRef.current,
                budgetRegistryRef.current,
              );
            }

            if (!initialSettings) {
              initialSettings = true;
              setSettingsCloudReady(true);
              markReadyIfComplete();
            }
          },
          () => {
            if (!cancelled) {
              setSettingsCloudReady(true);
              if (!initialSettings) {
                initialSettings = true;
                markReadyIfComplete();
              }
            }
          },
        );

        unsubManualOverrides = subscribeManualExchangeOverrides(
          uid,
          (entries, meta) => {
            if (cancelled || meta.hasPendingWrites) return;
            replaceCloudManualExchangeOverrides(entries);
            void pruneExpiredCloudExchangeFees(uid);
          },
          () => {
            if (!cancelled) {
              clearCloudManualExchangeOverrides();
            }
          },
        );

        unsubCurrencyCommissions = subscribeCurrencyCommissions(
          uid,
          (entries, meta) => {
            if (cancelled || meta.hasPendingWrites) return;
            replaceCloudCurrencyCommissions(entries);
            void pruneExpiredCloudExchangeFees(uid);
          },
          () => {
            if (!cancelled) {
              clearCloudCurrencyCommissions();
            }
          },
        );

        // Load historical overrides from Firestore on login (best-effort; merge with local).
        void loadHistoricalOverridesFromCloud(uid)
          .then((cloudEntries) => {
            if (!cancelled && cloudEntries.length > 0) {
              mergeHistoricalOverridesFromCloud(cloudEntries);
            }
          })
          .catch(() => {});
      } catch {
        if (!cancelled) {
          resetAppData();
          setDataReady(true);
        }
      }
    };

    void initUserData();

    return () => {
      cancelled = true;
      unsubBudgetRegistry?.();
      unsubSettings?.();
      unsubManualOverrides?.();
      unsubCurrencyCommissions?.();
    };
  }, [user, authReady, setSettingsPersistence]);

  // Purge exchange-fee documents older than 24h while a signed-in user session is active.
  useEffect(() => {
    if (!user || user.isAnonymous) return;

    const uid = user.uid;
    const runPrune = () => {
      void pruneExpiredCloudExchangeFees(uid);
    };

    runPrune();
    const intervalId = window.setInterval(runPrune, 24 * 60 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') runPrune();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);

  // Real-time sync for active budget financial data (registered users).
  useEffect(() => {
    if (!user || user.isAnonymous || !budgetSystemReady || !dataReady || appShellView !== 'active-budget') {
      return;
    }

    let cancelled = false;
    suppressCloudSaveRef.current = true;
    const subscribedBudgetId = activeBudgetId;
    const subscribedAt = Date.now();
    const unsub = subscribeBudgetFinancial(
      user.uid,
      subscribedBudgetId,
      (data, meta) => {
        if (cancelled || meta.hasPendingWrites || appShellViewRef.current !== 'active-budget') return;
        if (activeBudgetIdRef.current !== subscribedBudgetId) return;

        const cached = budgetFinancialCacheRef.current[subscribedBudgetId];
        const guardActive = isFinancialConversionGuardActive(
          financialConversionGuardRef.current,
          subscribedBudgetId,
        );
        budgetDebug('subscribeFinancial:incoming', {
          budgetId: subscribedBudgetId.slice(-10),
          firestoreExists: meta.exists,
          hasPendingWrites: meta.hasPendingWrites,
          guardActive,
          incoming: snapshotFinancialForLog(data),
          cachedBefore: snapshotFinancialForLog(cached),
        });
        if (
          shouldRejectEmptyIncomingFinancial(cached, data, meta, guardActive)
        ) {
          budgetDebug('subscribeFinancial:rejected', {
            budgetId: subscribedBudgetId.slice(-10),
            reason: 'shouldRejectEmptyIncomingFinancial',
            firestoreExists: meta.exists,
            guardActive,
          });
          return;
        }

        if (
          shouldRejectStaleIncomingFinancial(
            cached,
            data,
            financialLocalVersionRef.current[subscribedBudgetId],
            subscribedAt,
          )
        ) {
          budgetDebug('subscribeFinancial:rejected', {
            budgetId: subscribedBudgetId.slice(-10),
            reason: 'shouldRejectStaleIncomingFinancial',
            localWriteAt: financialLocalVersionRef.current[subscribedBudgetId] ?? null,
            subscribedAt,
          });
          return;
        }

        budgetFinancialCacheRef.current[subscribedBudgetId] = data;
        financialLocalVersionRef.current[subscribedBudgetId] = Date.now();
        budgetDebug('subscribeFinancial:applied', {
          budgetId: subscribedBudgetId.slice(-10),
          incoming: snapshotFinancialForLog(data),
        });
        applyAppData(data, 'subscribeFinancial', subscribedBudgetId);
      },
      () => {
        if (!cancelled && appShellViewRef.current === 'active-budget' && activeBudgetIdRef.current === subscribedBudgetId) {
          budgetDebug('subscribeFinancial:onMissing', {
            budgetId: subscribedBudgetId.slice(-10),
          });
          const cached = resolveBudgetFinancialForEntry(
            subscribedBudgetId,
            budgetFinancialCacheRef.current,
            loadBudgetFinancialLocal,
          );
          budgetFinancialCacheRef.current[subscribedBudgetId] = cached;
          applyAppData(cached, 'subscribeFinancial:onMissing', subscribedBudgetId);
        }
      },
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user, budgetSystemReady, dataReady, activeBudgetId, appShellView]);

  // Persist scoped budget settings while inside an active budget.
  useEffect(() => {
    if (!isInsideActiveBudget || !activeBudgetId) return;
    const storageKey = resolveSettingsStorageKey(activeBudgetId, budgetRegistry);
    const snapshot = buildCurrentSettingsSnapshot();
    budgetSettingsCacheRef.current[storageKey] = snapshot;
    saveBudgetSettingsLocal(storageKey, snapshot);
  }, [
    lang,
    keepOriginalValues,
    displayCurrency,
    savedColors,
    customCurrencies,
    currencyLayout,
    themePreferences,
    isInsideActiveBudget,
    activeBudgetId,
    budgetRegistry,
    buildCurrentSettingsSnapshot,
  ]);

  // When the user changes display currency inside a budget, convert financial payloads
  // and sync the converted total to the registry card (not the raw pre-conversion amount).
  useEffect(() => {
    if (!isInsideActiveBudget || !activeBudgetId) return;

    if (skipDisplayCurrencyConversionRef.current) {
      skipDisplayCurrencyConversionRef.current = false;
      scopedDisplayCurrencyRef.current = displayCurrency;
      return;
    }

    const previousCurrency = scopedDisplayCurrencyRef.current;
    if (previousCurrency === displayCurrency) return;

    const budgetId = activeBudgetIdRef.current;
    if (!budgetId) return;

    const activeMeta = budgetRegistryRef.current.personal.find((b) => b.id === budgetId);
    if (!activeMeta || activeMeta.isDefaultMonthly) {
      scopedDisplayCurrencyRef.current = displayCurrency;
      return;
    }

    const conversionGeneration = currencyConversionGenerationRef.current;

    const runConversion = async () => {
      if (conversionGeneration !== currencyConversionGenerationRef.current) return;

      const rates =
        getCachedExchangeRates() ?? (await fetchExchangeRates().catch(() => null));
      if (!rates) {
        scopedDisplayCurrencyRef.current = displayCurrency;
        return;
      }

      if (conversionGeneration !== currencyConversionGenerationRef.current) return;

      const sourceFinancial =
        activeFinancialSnapshotRef.current.budgetId === budgetId
          ? activeFinancialSnapshotRef.current.data
          : budgetFinancialCacheRef.current[budgetId];
      if (!sourceFinancial) {
        scopedDisplayCurrencyRef.current = displayCurrency;
        return;
      }

      const convertedFinancial = convertBudgetFinancialToDisplayCurrency(
        sourceFinancial,
        previousCurrency,
        displayCurrency,
        rates,
      );

      if (conversionGeneration !== currencyConversionGenerationRef.current) return;

      armFinancialConversionGuard(financialConversionGuardRef.current, budgetId);
      writeFinancialToCache(budgetId, convertedFinancial);
      activeFinancialSnapshotRef.current = { budgetId, data: convertedFinancial };
      applyAppData(convertedFinancial, 'displayCurrencyChange', budgetId);

      const registryMonthKey = selectedMonthKeyRef.current;
      const convertedRegistryTotal =
        deriveRegistryTotalFromFinancialMonth(
          convertedFinancial,
          registryMonthKey,
          displayCurrency,
          rates,
        ) ??
        convertRegistryBudgetTotalAmount(
          activeMeta.totalAmount,
          previousCurrency,
          displayCurrency,
          rates,
        );

      if (conversionGeneration !== currencyConversionGenerationRef.current) return;

      if (convertedRegistryTotal != null && convertedRegistryTotal > 0) {
        commitPersonalBudgetRegistryTotal(budgetId, convertedRegistryTotal);
      }

      scopedDisplayCurrencyRef.current = displayCurrency;
      clearFinancialConversionGuard(financialConversionGuardRef.current, budgetId);

      const currentUser = auth.currentUser;
      if (currentUser && !currentUser.isAnonymous) {
        void saveBudgetFinancialCloud(currentUser.uid, budgetId, convertedFinancial).catch(
          () => {},
        );
      }
    };

    void runConversion();
  }, [
    displayCurrency,
    isInsideActiveBudget,
    activeBudgetId,
    commitPersonalBudgetRegistryTotal,
    writeFinancialToCache,
  ]);

  // Persist financial changes per budgetId: localStorage for guests, debounced Firestore for accounts.
  useEffect(() => {
    if (!dataReady || !user || appShellView !== 'active-budget') return;

    const payload = snapshotUserAppData({
      expenses,
      customCategories,
      budgetsByMonth,
      budgetOriginalByMonth,
      subBudgetsByMonth,
      subBudgetsOriginalByMonth,
      autoTransferByMonth,
    });

    writeFinancialToCache(activeBudgetId, payload);

    budgetDebug('financialPersist', {
      budgetId: activeBudgetId.slice(-10),
      suppressNext: suppressCloudSaveRef.current,
      payload: snapshotFinancialForLog(payload),
      isAnonymous: user.isAnonymous,
    });

    if (user.isAnonymous) {
      saveBudgetRegistryLocal(budgetRegistry);
      return;
    }

    if (suppressCloudSaveRef.current) {
      suppressCloudSaveRef.current = false;
      return;
    }

    const uid = user.uid;
    const budgetId = activeBudgetId;
    cancelPendingFinancialCloudSave();
    const timer = window.setTimeout(() => {
      financialPersistTimerRef.current = null;
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== uid || currentUser.isAnonymous) return;
      if (appShellViewRef.current !== 'active-budget') return;
      if (activeBudgetIdRef.current !== budgetId) return;
      void saveBudgetFinancialCloud(uid, budgetId, payload).catch(() => {
        // Non-blocking; next edit will retry.
      });
    }, 400);
    financialPersistTimerRef.current = timer;

    return () => {
      if (financialPersistTimerRef.current != null) {
        window.clearTimeout(financialPersistTimerRef.current);
        financialPersistTimerRef.current = null;
      }
    };
  }, [
    expenses,
    customCategories,
    budgetsByMonth,
    budgetOriginalByMonth,
    autoTransferByMonth,
    subBudgetsByMonth,
    subBudgetsOriginalByMonth,
    dataReady,
    user,
    activeBudgetId,
    appShellView,
    budgetRegistry,
    cancelPendingFinancialCloudSave,
  ]);

  // Budget update entry point. If the active month already has sub-budget
  // allocations, we ask how to reconcile them via the confirmation modal;
  // otherwise the new budget is applied immediately.
  const handleSetBudget = () => {
    const inputAmount = parseMoneyInput(budgetInput);
    if (inputAmount === null || inputAmount < 0) return;

    const resolveBudgetIlsAmount = async (): Promise<number | null> => {
      if (displayCurrency === 'ILS') return roundMoneyAmount(inputAmount);
      const rates = getCachedExchangeRates() ?? (await fetchExchangeRates().catch(() => null));
      if (!rates) return null;
      const converted = convertDisplayAmountToLedgerCurrency(inputAmount, displayCurrency, rates);
      if (converted == null) return null;
      return roundMoneyAmount(converted);
    };

    void resolveBudgetIlsAmount().then((amount) => {
      if (amount == null || amount < 0) return;
      const original = {
        amount: roundMoneyAmount(inputAmount),
        currency: displayCurrency,
      } as const;
      const hasAllocations = hasPositiveSubBudgets(subBudgets);
      if (hasAllocations) {
        setPendingBudget(amount);
        setPendingBudgetOriginal(original);
        setShowBudgetModal(true);
      } else {
        applyBudgetChange(amount, 'keep', original);
      }
    });
  };

  // Applies the new budget to the active month and reconciles its sub-budgets
  // per the chosen option. All writes are scoped to `selectedMonthKey`, so
  // other months are never touched.
  const applyBudgetChange = (
    amount: number,
    mode: BudgetChangeMode,
    original: { amount: number; currency: ExpenseCurrency },
  ) => {
    budgetDebug('applyBudgetChange:start', {
      activeBudgetId: activeBudgetIdRef.current?.slice(-10) ?? null,
      selectedMonthKey,
      amountIls: roundMoneyAmount(amount),
      originalAmount: roundMoneyAmount(original.amount),
      originalCurrency: original.currency,
      mode,
    });

    setBudgetsByMonth((prev) => ({ ...prev, [selectedMonthKey]: roundMoneyAmount(amount) }));
    setBudgetOriginalByMonth((prev) => ({
      ...prev,
      [selectedMonthKey]: { ...original, amount: roundMoneyAmount(original.amount) },
    }));

    const budgetId = activeBudgetIdRef.current;
    const activeMeta = budgetRegistryRef.current.personal.find((b) => b.id === budgetId);
    if (budgetId && activeMeta && !activeMeta.isDefaultMonthly) {
      const registryTotal =
        deriveRegistryTotalFromFinancialMonth(
          {
            expenses,
            customCategories,
            budgetsByMonth: {
              ...budgetsByMonth,
              [selectedMonthKey]: roundMoneyAmount(amount),
            },
            budgetOriginalByMonth: {
              ...budgetOriginalByMonth,
              [selectedMonthKey]: {
                ...original,
                amount: roundMoneyAmount(original.amount),
              },
            },
            subBudgetsByMonth,
            subBudgetsOriginalByMonth,
            autoTransferByMonth,
          },
          selectedMonthKey,
          original.currency,
          getCachedExchangeRates(),
        ) ?? roundMoneyAmount(original.amount);

      commitPersonalBudgetRegistryTotal(budgetId, registryTotal);
    } else {
      budgetDebug('applyBudgetChange:registrySkipped', {
        budgetId: budgetId?.slice(-10) ?? null,
        hasMeta: Boolean(activeMeta),
        isDefaultMonthly: activeMeta?.isDefaultMonthly ?? null,
        reason: 'guard-not-personal-budget',
      });
    }

    if (mode === 'reset') {
      // Wipe this month's allocations only.
      patchSubBudgetsByMonth(selectedMonthKey, () => markSubBudgetMonthInitialized({}));
    }

    setBudgetInput('');
    setPendingBudget(null);
    setPendingBudgetOriginal(null);
    setShowBudgetModal(false);
    setShowBudgetSaved(true);
    setTimeout(() => setShowBudgetSaved(false), 2000);
  };

  const handleCloseBudgetModal = () => {
    setShowBudgetModal(false);
    setPendingBudget(null);
    setPendingBudgetOriginal(null);
  };

  // Add new expense
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const enteredAmount = parseFloat(newExpense.amount);
    const inputCurrency = newExpense.currency;

    if (isNaN(enteredAmount) || !(enteredAmount > 0)) return;

    const submitApplied = resolveHistoricalAppliedForSubmit(
      newExpenseHistoricalBanner,
      newExpenseHistoricalApplied,
      newExpenseHistoricalLastChoice,
    );

    const persistAutomationOnSubmit = async (): Promise<void> => {
      const options = newExpenseHistoricalBannerOptions;
      if (!options?.applyAutomatically) return;

      const context =
        newExpenseHistoricalBanner ?? historicalAppliedContextFromEntries(submitApplied);
      if (!context) return;

      const choice =
        newExpenseHistoricalLastChoice ?? inferHistoricalChoiceFromApplied(submitApplied);

      const updatedEntries = applyBannerAutomationFromChoice(choice, context, options);
      await persistHistoricalAutomationUpdates(updatedEntries);
    };

    const resolveConversion = async (): Promise<{
      ilsAmount: number;
      appliedFeePercent: number;
      manualRateUsed: boolean;
      appliedUnitRateToIls: number;
      appliedRateSource: 'historical' | 'manual_live' | 'api_spot';
      appliedRateContextKey?: string;
      appliedConversionDate: string;
    } | null> => {
      const rates = getCachedExchangeRates();
      const isoDate = normalizeDate(newExpense.date);

      const historicalRateEntry = submitApplied.rateEntry ?? undefined;
      const historicalFeePercent = submitApplied.feeEntry?.feePercent ?? undefined;

      const recorded = await recordExpenseConversionToIlsAsync(enteredAmount, inputCurrency, rates, {
        displayCurrency,
        transactionDate: isoDate,
        historicalRateEntry,
        historicalFeePercent,
      });
      if (recorded == null) return null;

      return {
        ...recorded,
        ilsAmount: roundMoneyAmount(recorded.ilsAmount),
        appliedRateContextKey: historicalRateEntry ? historicalEntryKey(historicalRateEntry) : undefined,
        appliedConversionDate: isoDate,
      };
    };

    void persistAutomationOnSubmit().then(() => {
      void resolveConversion().then((conversion) => {
        if (conversion == null || !(conversion.ilsAmount > 0)) return;

        const isoDate = normalizeDate(newExpense.date);
        const expense: Expense = {
          id: Date.now().toString(),
          description: newExpense.description.trim(),
          amount: conversion.ilsAmount,
          category: newExpense.category,
          date: isoDate,
          originalAmount: roundMoneyAmount(enteredAmount),
          originalCurrency: inputCurrency,
          appliedFeePercent: conversion.appliedFeePercent,
          manualRateUsed: conversion.manualRateUsed,
          appliedUnitRateToIls: conversion.appliedUnitRateToIls,
          appliedRateSource: conversion.appliedRateSource,
          appliedRateContextKey: conversion.appliedRateContextKey,
          appliedConversionDate: conversion.appliedConversionDate,
          manualRateDisabled: false,
          feeDisabled: false,
        };

        const nextExpenses = [expense, ...expenses];
        setExpenses(nextExpenses);
        setNewExpense((prev) => ({
          description: '',
          amount: '',
          currency: prev.currency,
          category: prev.category,
          date: toISODate(new Date()),
        }));
        setNewExpenseHistoricalBanner(null);
        setNewExpenseHistoricalApplied(EMPTY_NEW_EXPENSE_HISTORICAL_APPLIED);
        setNewExpenseHistoricalLastChoice(null);
        setNewExpenseHistoricalBannerOptions(null);
        setExpenseRatesReady(true);

      // Dual-write (Task 2): mirror expense into main budget when source budget is linked.
      const linkedMeta = resolveLinkedBudgetMeta(activeBudgetId, budgetRegistry);
      if (linkedMeta?.linkedCategoryId) {
        const mainFinancial = loadMainBudgetFinancial(
          budgetFinancialCacheRef.current,
          loadBudgetFinancialLocal,
        );
        const mirroredExpense = buildMirroredExpense(
          expense,
          linkedMeta.id,
          linkedMeta.linkedCategoryId,
        );
        const updatedMainFinancial = mirrorExpenseIntoMainFinancial(mainFinancial, mirroredExpense);
        budgetFinancialCacheRef.current[DEFAULT_MONTHLY_BUDGET_ID] = updatedMainFinancial;
        saveBudgetFinancialLocal(DEFAULT_MONTHLY_BUDGET_ID, updatedMainFinancial);

        if (user && !user.isAnonymous) {
          const sourceFinancial = snapshotUserAppData({
            expenses: nextExpenses,
            customCategories,
            budgetsByMonth,
            budgetOriginalByMonth,
            subBudgetsByMonth,
            subBudgetsOriginalByMonth,
            autoTransferByMonth,
          });
          // Parallel cloud dual-write: source budget + mirrored main-budget expense.
          void dualWriteMirroredExpenseCloud(
            user.uid,
            activeBudgetId,
            sourceFinancial,
            updatedMainFinancial,
          ).catch(() => {
            // Non-blocking; debounced effect may retry source save.
          });
        }
      }

      const [y, m] = isoDate.split('-').map((n) => parseInt(n, 10));
      setSelectedDate(new Date(y, m - 1, 1));
      });
    });
  };

  const expenseSubmitBlocked = displayCurrency !== 'ILS' && !expenseRatesReady;
  const editExpenseSubmitBlocked =
    !!editExpenseDraft &&
    (editExpenseDraft.currency !== 'ILS' && !editExpenseRatesReady);

  // Delete expense
  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter(expense => expense.id !== id));
  };

  const getExpenseEditCurrency = useCallback(
    (expense: Expense): ExpenseCurrency => {
      if (expense.originalCurrency) {
        return symbolToCurrency(expense.originalCurrency, displayCurrency) ?? displayCurrency;
      }
      return 'ILS';
    },
    [displayCurrency],
  );

  const handleEditExpenseStart = (expense: Expense) => {
    const editCurrency = getExpenseEditCurrency(expense);
    const editAmount =
      expense.originalAmount != null && expense.originalAmount > 0
        ? expense.originalAmount
        : roundMoneyAmount(expense.amount);
    setEditingExpenseId(expense.id);
    setEditExpenseRatesReady(true);
    setEditExpenseSnapshot(expense);
    setEditExpenseDraft({
      description: expense.description,
      amount: String(editAmount),
      currency: editCurrency,
      category: expense.category,
      date: normalizeDate(expense.date),
      manualRateDisabled: Boolean(expense.manualRateDisabled),
      feeDisabled: Boolean(expense.feeDisabled),
    });
  };

  const handleEditExpenseCancel = () => {
    setEditingExpenseId(null);
    setEditExpenseDraft(null);
    setEditExpenseSnapshot(null);
    setEditExpenseRatesReady(true);
    setEditPreviewAmount(null);
  };

  // Live preview: recomputes instantly when amount, currency, date, or either
  // modifier checkbox changes — mirrors the exact conversion + fee pipeline.
  const editDraftAmount = editExpenseDraft?.amount;
  const editDraftCurrency = editExpenseDraft?.currency;
  const editDraftDate = editExpenseDraft?.date;
  const editDraftManualRateDisabled = editExpenseDraft?.manualRateDisabled ?? false;
  const editDraftFeeDisabled = editExpenseDraft?.feeDisabled ?? false;
  const editModifierVisibility = useMemo(
    () => resolveExpenseEditModifierVisibility(editExpenseSnapshot, editExpenseDraft),
    [editExpenseSnapshot, editExpenseDraft],
  );
  useEffect(() => {
    if (
      editDraftAmount == null ||
      editDraftCurrency == null ||
      editDraftDate == null ||
      (!editModifierVisibility.showManualRate && !editModifierVisibility.showFee)
    ) {
      setEditPreviewAmount(null);
      return;
    }

    const typed = parseFloat(editDraftAmount);
    if (!(typed > 0)) {
      setEditPreviewAmount(null);
      return;
    }

    let cancelled = false;
    const rates = getCachedExchangeRates();
    const date = normalizeDate(editDraftDate);

    void previewExpenseDisplayAmount(typed, editDraftCurrency, rates, {
      displayCurrency,
      transactionDate: date,
      manualRateDisabled: editDraftManualRateDisabled,
      feeDisabled: editDraftFeeDisabled,
    }).then((preview) => {
      if (!cancelled) {
        setEditPreviewAmount(preview?.displayAmount ?? null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    editDraftAmount,
    editDraftCurrency,
    editDraftDate,
    editDraftManualRateDisabled,
    editDraftFeeDisabled,
    editModifierVisibility,
    displayCurrency,
  ]);

  const handleEditExpenseSave = () => {
    if (!editingExpenseId || !editExpenseDraft) return;

    const typedAmount = parseFloat(editExpenseDraft.amount);
    if (isNaN(typedAmount) || !(typedAmount > 0)) return;

    const { manualRateDisabled, feeDisabled } = editExpenseDraft;
    const prevExpense = expenses.find((expense) => expense.id === editingExpenseId);

    const resolveConversion = async (): Promise<{
      ilsAmount: number;
      appliedFeePercent: number;
      manualRateUsed: boolean;
      appliedUnitRateToIls: number;
      appliedRateSource: 'historical' | 'manual_live' | 'api_spot';
      appliedRateContextKey?: string;
      appliedConversionDate: string;
    } | null> => {
      const normalizedDate = normalizeDate(editExpenseDraft.date);
      const rates = getCachedExchangeRates();

      const recorded = await recordExpenseConversionToIlsAsync(
        typedAmount,
        editExpenseDraft.currency,
        rates,
        {
          displayCurrency,
          transactionDate: normalizedDate,
          manualRateDisabled,
          feeDisabled,
        },
      );
      if (recorded == null) return null;
      return {
        ...recorded,
        ilsAmount: roundMoneyAmount(recorded.ilsAmount),
        appliedRateContextKey: prevExpense?.appliedRateContextKey,
        appliedConversionDate: normalizedDate,
      };
    };

    void resolveConversion().then((conversion) => {
      if (conversion == null || !(conversion.ilsAmount > 0)) return;

      const normalizedDate = normalizeDate(editExpenseDraft.date);
      const normalizedDescription = editExpenseDraft.description.trim();
      const roundedTypedAmount = roundMoneyAmount(typedAmount);
      const persistedMeta = resolvePersistedExpenseConversionMeta(prevExpense, conversion, {
        manualRateDisabled,
        feeDisabled,
      });

      const nextExpenses = expenses.map((expense) =>
        expense.id === editingExpenseId
          ? {
              ...expense,
              description: normalizedDescription,
              amount: conversion.ilsAmount,
              category: editExpenseDraft.category,
              date: normalizedDate,
              originalAmount: roundedTypedAmount,
              originalCurrency: editExpenseDraft.currency,
              appliedFeePercent: persistedMeta.appliedFeePercent,
              manualRateUsed: persistedMeta.manualRateUsed,
              appliedUnitRateToIls: conversion.appliedUnitRateToIls,
              appliedRateSource: conversion.appliedRateSource,
              appliedRateContextKey: conversion.appliedRateContextKey,
              appliedConversionDate: conversion.appliedConversionDate,
              manualRateDisabled,
              feeDisabled,
            }
          : expense,
      );

      const payload = buildCurrentFinancialPayload(nextExpenses);
      setExpenses(nextExpenses);
      commitFinancialPayload(payload, { cloud: true });
      suppressCloudSaveRef.current = false;

      setRecentlyUpdatedExpenseId(editingExpenseId);
      window.setTimeout(() => {
        setRecentlyUpdatedExpenseId((current) => (current === editingExpenseId ? null : current));
      }, 1800);

      setEditingExpenseId(null);
      setEditExpenseDraft(null);
      setEditExpenseSnapshot(null);
      setEditPreviewAmount(null);
      setEditExpenseRatesReady(true);
      setEditHistoricalCandidate(null);
      setEditHistoricalAccepted(null);
    });
  };

  // Handle category dropdown change. Selecting the sentinel opens the "add" input
  // instead of changing the selected category.
  const handleCategoryChange = (value: string) => {
    if (value === ADD_CUSTOM_VALUE) {
      setIsAddingCategory(true);
      setCategoryError('');
      return;
    }
    setNewExpense({ ...newExpense, category: value });
  };

  // Create a new custom category and select it immediately.
  const handleAddCategory = () => {
    const name = newCategoryName.trim();

    if (!name) {
      setCategoryError(tr('categoryNameRequired'));
      return;
    }
    if (name === ADD_CUSTOM_VALUE) {
      setCategoryError(tr('invalidCategoryName'));
      return;
    }

    const exists = allCategories.some((c) => c.value === name);
    if (exists) {
      setCategoryError(tr('categoryAlreadyExists'));
      return;
    }

    setCustomCategories([
      ...customCategories,
      { value: name, label: name, color: newCategoryColor, iconName: newCategoryIcon },
    ]);
    setNewExpense({ ...newExpense, category: name });
    resetCategoryForm();
    setIsAddingCategory(false);
  };

  // Reset the inline create-category form to its defaults.
  const resetCategoryForm = () => {
    setNewCategoryName('');
    setNewCategoryColor(DEFAULT_CATEGORY_COLOR);
    setNewCategoryIcon(ICON_OPTIONS[0].name);
    setCategoryError('');
  };

  // Cancel the add-category flow without creating anything.
  const handleCancelAddCategory = () => {
    setIsAddingCategory(false);
    resetCategoryForm();
  };

  // Sub-budget handlers — allocations are keyed by category ID (1:1 with categories).
  const handleSaveSubBudgets = useCallback(
    (
      draft: Record<string, number>,
      draftOriginal: Record<string, { amount: number; currency: ExpenseCurrency }>,
    ) => {
      patchSubBudgetsByMonth(
        selectedMonthKey,
        (monthMap) => {
          let next = { ...monthMap };
          for (const cat of allCategories) {
            if (!isSubBudgetCategoryKey(cat.value)) continue;
            const amount = draft[cat.value] ?? 0;
            next =
              amount > 0
                ? { ...next, [cat.value]: roundMoneyAmount(amount) }
                : withoutSubBudgetKey(next, cat.value);
          }
          return markSubBudgetMonthInitialized(next);
        },
        // Immutable baseline patch: store the exact typed amount + currency per
        // allocation so display projects losslessly; drop cleared allocations.
        (originalMap) => {
          const next = { ...originalMap };
          for (const cat of allCategories) {
            if (!isSubBudgetCategoryKey(cat.value)) continue;
            const amount = draft[cat.value] ?? 0;
            const baseline = draftOriginal[cat.value];
            if (amount > 0 && baseline && baseline.amount > 0) {
              next[cat.value] = { amount: baseline.amount, currency: baseline.currency };
            } else {
              delete next[cat.value];
            }
          }
          return next;
        },
      );
    },
    [allCategories, patchSubBudgetsByMonth, selectedMonthKey],
  );

  // Month navigation (selectedMonthKey is derived above with budget/subBudgets).
  const monthLabel = selectedDate.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'long', year: 'numeric' });
  const isCurrentMonth = selectedMonthKey === monthKeyOfDate(new Date());
  const goToMonth = (offset: number) => {
    setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth() + offset, 1));
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const handleMonthKeySelect = (monthKey: string) => {
    const [y, m] = monthKey.split('-').map((n) => parseInt(n, 10));
    if (!y || !m) return;
    setSelectedDate(new Date(y, m - 1, 1));
  };

  // Expenses for the selected month only (filtered by ISO date).
  const monthExpenses = expenses.filter((e) => monthKeyOf(e.date) === selectedMonthKey);

  // Calculate total expenses (for the selected month)
  const totalExpenses = sumMoney(monthExpenses.map((expense) => expense.amount));
  const isOverBudget = totalExpenses > budget && budget > 0;
  const remaining = roundMoneyAmount(budget - totalExpenses);
  const financialProjection = useDisplayProjection();
  const budgetOriginalForDisplay = useMemo(() => {
    const sourceKey = selectedBudgetSourceMonthKey ?? selectedMonthKey;
    return sourceKey ? budgetOriginalByMonth[sourceKey] : undefined;
  }, [selectedBudgetSourceMonthKey, selectedMonthKey, budgetOriginalByMonth]);
  const totalExpensesDisplayAmount = useMemo(
    () => roundMoneyAmount(financialProjection.sumExpenses(monthExpenses)),
    [financialProjection, monthExpenses],
  );
  const budgetDisplayAmount = useMemo(
    () =>
      roundMoneyAmount(
        financialProjection.projectOriginalOrIls(budgetOriginalForDisplay, budget),
      ),
    [financialProjection, budgetOriginalForDisplay, budget],
  );
  const remainingDisplayAmount = useMemo(
    () => roundMoneyAmount(budgetDisplayAmount - totalExpensesDisplayAmount),
    [budgetDisplayAmount, totalExpensesDisplayAmount],
  );
  const selectedBudgetDisplayParts = useMemo(
    () =>
      formatAmountParts(budgetDisplayAmount, financialProjection.displayCurrency, {
        forceTwoDecimals: financialProjection.displayCurrency !== 'ILS',
      }),
    [budgetDisplayAmount, financialProjection],
  );

  useLayoutEffect(() => {
    if (appShellView !== 'active-budget' || activeTab !== 'dashboard') return;
    budgetDebug('financialSummary:render', {
      activeBudgetId: activeBudgetId?.slice(-10) ?? null,
      selectedMonthKey,
      selectedDate: selectedDate.toISOString(),
      budgetsByMonth,
      budgetOriginalByMonth,
      autoTransferByMonth,
      displayCurrency,
      resolution: selectedBudgetResolution,
      budgetIls: budget,
      sourceMonthKey: selectedBudgetSourceMonthKey,
      displayLabel: selectedBudgetDisplayLabel,
      budgetDisplayAmount,
      displayPartsAmount: selectedBudgetDisplayParts.amount,
      displayPartsSymbol: selectedBudgetDisplayParts.symbol,
      stateSource: 'App.tsx useState (NOT Context/Zustand)',
    });
  }, [
    appShellView,
    activeTab,
    activeBudgetId,
    selectedMonthKey,
    selectedDate,
    budgetsByMonth,
    budgetOriginalByMonth,
    autoTransferByMonth,
    displayCurrency,
    selectedBudgetResolution,
    budget,
    selectedBudgetSourceMonthKey,
    selectedBudgetDisplayLabel,
    selectedBudgetDisplayParts,
    budgetDisplayAmount,
  ]);

  const totalExpensesDisplayParts = useMemo(
    () =>
      formatAmountParts(totalExpensesDisplayAmount, financialProjection.displayCurrency, {
        forceTwoDecimals: financialProjection.displayCurrency !== 'ILS',
      }),
    [totalExpensesDisplayAmount, financialProjection],
  );
  const remainingDisplayParts = useMemo(
    () =>
      formatAmountParts(remainingDisplayAmount, financialProjection.displayCurrency, {
        forceTwoDecimals: financialProjection.displayCurrency !== 'ILS',
      }),
    [remainingDisplayAmount, financialProjection],
  );
  const statusRates = getCachedExchangeRates();
  const [financialCurrencyMenuAnchor, setFinancialCurrencyMenuAnchor] =
    useState<FinancialSummaryCurrencyAnchor | null>(null);
  const financialCurrencyMenuRef = useRef<HTMLDivElement>(null);
  const financialCurrencyMenuPortalRef = useRef<HTMLDivElement>(null);
  const toggleFinancialCurrencyMenu = useCallback((anchor: FinancialSummaryCurrencyAnchor) => {
    setFinancialCurrencyMenuAnchor((prev) => (prev === anchor ? null : anchor));
  }, []);
  const closeFinancialCurrencyMenu = useCallback(() => {
    setFinancialCurrencyMenuAnchor(null);
  }, []);
  const handleFinancialCurrencyPicked = useCallback(() => {
    closeFinancialCurrencyMenu();
  }, [closeFinancialCurrencyMenu]);
  useEffect(() => {
    if (!financialCurrencyMenuAnchor) return;

    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (financialCurrencyMenuRef.current?.contains(target)) return;
      if (financialCurrencyMenuPortalRef.current?.contains(target)) return;
      closeFinancialCurrencyMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeFinancialCurrencyMenu();
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [financialCurrencyMenuAnchor, closeFinancialCurrencyMenu]);

  // Get category info
  const getCategoryInfo = (categoryValue: string): Category =>
    lookupCategory(categoryValue, allCategories);

  // Full history for the Expenses page: time range + search, newest-first.
  const historyExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();

    return expenses
      .filter((e) => expenseMatchesHistoryTimeFilter(e.date, timeFilter))
      .filter((e) => {
        if (!q) return true;
        return (
          e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [expenses, search, timeFilter]);

  // History rollup projected from each expense's immutable baseline → display
  // currency, so the total matches the (baseline-aware) per-row amounts. Falls
  // back to the raw ILS sum only when a non-ILS view has no rates yet.
  const historyTotalIls = historyExpenses.reduce((s, e) => s + e.amount, 0);
  const historyTotal = useMemo(() => {
    if (displayCurrency === 'ILS') return roundMoneyAmount(historyTotalIls);
    if (!statusRates) return null;
    const ctx = buildMoneyProjectionContext(displayCurrency, {
      rates: statusRates,
      applyFees: false,
    });
    return sumMoneyProjections(
      historyExpenses.map((expense) => immutableFromExpense(expense)),
      displayCurrency,
      ctx,
    );
  }, [historyExpenses, displayCurrency, statusRates, historyTotalIls]);
  const recentExpenseCurrencies = useMemo<ExpenseCurrency[]>(() => {
    return [...expenses]
      .sort((a, b) => {
        if (a.date === b.date) {
          const idA = Number.parseInt(a.id, 10);
          const idB = Number.parseInt(b.id, 10);
          return (Number.isFinite(idB) ? idB : 0) - (Number.isFinite(idA) ? idA : 0);
        }
        return a.date < b.date ? 1 : -1;
      })
      .map((expense) => {
        if (!expense.originalCurrency) return 'ILS';
        return symbolToCurrency(expense.originalCurrency) ?? 'ILS';
      });
  }, [expenses]);

  // Reusable month selector card (Sub-Budgets tab).
  const monthSelector = (
    <div className={`${themeCardClass} p-3 sm:p-4 mb-6 sm:mb-8`}>
      <MonthNavigationBar
        monthLabel={monthLabel}
        monthValue={selectedMonthKey}
        isCurrentMonth={isCurrentMonth}
        onPrev={() => goToMonth(-1)}
        onNext={() => goToMonth(1)}
        onGoToCurrent={goToCurrentMonth}
        onMonthChange={handleMonthKeySelect}
      />
    </div>
  );

  if (!authReady || (user && !dataReady)) {
    return (
      <div
        dir={dir}
        className={themePageLoadingClass}
      >
        <Loader2 className="w-9 h-9 text-emerald-500 animate-spin" aria-label={tr('loading')} />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const userName = user.isAnonymous
    ? tr('guest')
    : (user.displayName || user.email?.split('@')[0] || tr('user'));
  const googleAvatarUrl =
    user.providerData.find((provider) => provider.providerId === 'google.com')?.photoURL ?? null;
  const defaultUserAvatarUrl = user.isAnonymous
    ? DEFAULT_GUEST_AVATAR_URL
    : `https://api.dicebear.com/8.x/fun-emoji/svg?seed=${encodeURIComponent(user.uid)}`;
  const currentAvatarUrl = sanitizeAvatarUrl(avatarUrl || user.photoURL, defaultUserAvatarUrl);

  return (
    <SettingsPersistenceProvider
      user={user}
      authReady={authReady}
      dataReady={dataReady}
      settingsCloudReady={settingsCloudReady}
      settingsPersistence={settingsPersistence}
      skipNextSaveRef={skipNextSettingsSaveRef}
      applySettingsFromCloud={applySettingsFromCloud}
      lang={lang}
      keepOriginalValues={keepOriginalValues}
      displayCurrency={displayCurrency}
      saved_colors={savedColors}
      custom_currencies={customCurrencies}
      currency_layout={currencyLayout}
      themePreferences={themePreferences}
    >
    <motion.div
      dir={dir}
      data-theme-scope={APP_THEME_SCOPE}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={[themePageRootClass, isScrollRoute ? themeScrollRoutePageClass : ''].filter(Boolean).join(' ')}
    >
      {/* Header + desktop nav */}
      <header
        className={themeHeaderClass}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (!isInsideActiveBudget) {
                  enterBudget(activeBudgetId);
                } else {
                  handleTabSelect('dashboard');
                }
              }}
              aria-label={tr('tabDashboard')}
              className="flex min-w-0 cursor-pointer items-center gap-3 rounded-xl text-start outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:opacity-80"
            >
              <img
                src={appLogo}
                alt=""
                aria-hidden
                data-brand-logo-static
                className="brand-logo-static h-11 w-11 shrink-0 object-contain [image-rendering:crisp-edges]"
                style={{ imageRendering: '-webkit-optimize-contrast' } as React.CSSProperties}
                decoding="async"
                fetchPriority="high"
              />
              <div className="min-w-0">
                <h1 className={`truncate text-lg font-bold sm:text-2xl ${typographyTitleClass}`}>{tr('appName')}</h1>
                <p className={`hidden truncate text-xs sm:block ${themeTextMutedClass}`}>{tr('appTagline')}</p>
              </div>
            </button>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <BudgetDrawerMenu
                open={budgetDrawerOpen}
                onOpenChange={setBudgetDrawerOpen}
                onNavigate={navigateAppShell}
              />
              <button
                type="button"
                onClick={handleQuickLanguageToggle}
                title={tr('authSwitchLanguage')}
                aria-label={tr('authSwitchLanguage')}
                className={`inline-flex h-10 w-10 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${utilityNavMenuToggleClass}`}
              >
                <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <div className="hidden md:block">
                <UserProfileMenu
                  avatarUrl={currentAvatarUrl}
                  onOpenProfile={() => openProfile()}
                />
              </div>
              {isInsideActiveBudget && (
                <CollapsibleNavMenu
                  variant="desktop"
                  activeTab={activeTab}
                  open={navOpen}
                  onOpenChange={setNavOpen}
                  onTabSelect={handleTabSelect}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      <div className={isScrollRoute ? themeScrollRouteShellClass : 'relative flex min-h-0 flex-1 flex-col'}>
      <main
        className={[
          'relative z-0 mx-auto w-full max-w-5xl min-h-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8',
          isScrollRoute
            ? `${themeScrollViewportClass} ${themeScrollSafeContentClass}`
            : `${themeAntiClipVisibleClass} ${isInsideActiveBudget ? 'max-md:pb-24' : 'max-md:pb-6'} md:pb-10`,
        ].join(' ')}
      >
        {isProfileView ? (
          <ProfilePage
            user={user}
            userName={userName}
            currentAvatarUrl={currentAvatarUrl}
            googleAvatarUrl={googleAvatarUrl}
            onBack={closeProfile}
            onSaveAvatar={handleSaveAvatar}
            onLogout={handleLogout}
            recentExpenseCurrencies={recentExpenseCurrencies}
            initialCurrencySections={profileInitialCurrencySections}
          />
        ) : appShellView === 'personal-budgets' ? (
          <PersonalBudgetsPage
            budgets={budgetRegistry.personal}
            activeBudgetId={activeBudgetId}
            displayCurrency={displayCurrency}
            getBudgetDisplayCurrency={getBudgetDisplayCurrency}
            onEnterBudget={enterBudget}
            onCreateBudget={handleCreatePersonalBudget}
          />
        ) : appShellView === 'shared-budgets' ? (
          <SharedBudgetsPage />
        ) : (
          <>
        {/* ============================ DASHBOARD ============================ */}
        {activeTab === 'dashboard' && (
          <>
            {/* Financial summary — row 2 uses a fixed height so all three amount cells share one baseline */}
            <div className={`mb-6 overflow-visible md:overflow-visible ${themeCardClass} p-4 shadow-sm sm:mb-8 sm:p-6`}>
              <div
                dir={dir}
                className="relative mb-4 grid grid-cols-1 items-center gap-y-3 sm:min-h-[3.5rem] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-x-2"
              >
                <div className="pointer-events-none max-w-fit shrink-0 justify-self-start sm:col-start-1 sm:row-start-1">
                  <h2 className={`text-start text-lg font-bold md:text-xl ${typographyTitleClass}`}>
                    {tr('financialSummaryTitle')}
                  </h2>
                </div>
                <div className="relative z-50 w-full max-w-[min(100%,20rem)] justify-self-center px-1 sm:col-start-2 sm:row-start-1">
                  <MonthNavigationBar
                    compact
                    className="pointer-events-auto"
                    monthLabel={monthLabel}
                    monthValue={selectedMonthKey}
                    isCurrentMonth={isCurrentMonth}
                    onPrev={() => goToMonth(-1)}
                    onNext={() => goToMonth(1)}
                    onGoToCurrent={goToCurrentMonth}
                    onMonthChange={handleMonthKeySelect}
                  />
                </div>
                <div className="hidden min-w-0 sm:col-start-3 sm:block" aria-hidden />
              </div>
              <div className={`overflow-visible md:overflow-visible p-3 sm:p-4 ${filterInsetPanelClass}`}>
              <table className="w-full table-fixed border-collapse overflow-visible md:overflow-visible">
                <tbody>
                  <tr>
                    <td className="w-1/3 border-x border-[var(--surface-input-border)] px-2 pb-2 text-center align-bottom">
                      <span className={`flex min-h-[2.5rem] items-end justify-center text-xs leading-snug md:text-sm ${typographyMutedClass}`}>
                        {tr('monthlyBudget')}
                      </span>
                    </td>
                    <td className="w-1/3 border-x border-[var(--surface-input-border)] px-2 pb-2 text-center align-bottom">
                      <span className={`flex min-h-[2.5rem] items-end justify-center text-xs leading-snug md:text-sm ${typographyMutedClass}`}>
                        {tr('totalExpenses')}
                      </span>
                    </td>
                    <td className="w-1/3 border-x border-[var(--surface-input-border)] px-2 pb-2 text-center align-bottom">
                      <span className={`flex min-h-[2.5rem] items-end justify-center text-xs leading-snug md:text-sm ${typographyMutedClass}`}>
                        {tr('budgetStatus')}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="h-[4.5rem] min-h-[4.5rem] max-h-[4.5rem] overflow-visible md:overflow-visible border-x border-[var(--surface-input-border)] px-1 text-center align-middle sm:px-2">
                      <div className={`flex h-full min-h-0 w-full items-center justify-center overflow-visible md:overflow-visible ${FINANCIAL_SUMMARY_AMOUNT_CONTAINER_CLASS}`}>
                        <FinancialSummaryAmount
                          parts={selectedBudgetDisplayParts}
                          amountClassName={typographyBodyClass}
                          menuAnchor="budget"
                          activeMenuAnchor={financialCurrencyMenuAnchor}
                          onToggleMenu={toggleFinancialCurrencyMenu}
                          onCurrencyPicked={handleFinancialCurrencyPicked}
                          menuContainerRef={financialCurrencyMenuRef}
                          menuPortalRef={financialCurrencyMenuPortalRef}
                        />
                      </div>
                    </td>
                    <td className="h-[4.5rem] min-h-[4.5rem] max-h-[4.5rem] overflow-visible md:overflow-visible border-x border-[var(--surface-input-border)] px-1 text-center align-middle sm:px-2">
                      <div className={`flex h-full min-h-0 w-full items-center justify-center overflow-visible md:overflow-visible ${FINANCIAL_SUMMARY_AMOUNT_CONTAINER_CLASS}`}>
                        <FinancialSummaryAmount
                          parts={totalExpensesDisplayParts}
                          amountClassName={isOverBudget ? 'text-rose-400' : typographyBodyClass}
                          menuAnchor="expenses"
                          activeMenuAnchor={financialCurrencyMenuAnchor}
                          onToggleMenu={toggleFinancialCurrencyMenu}
                          onCurrencyPicked={handleFinancialCurrencyPicked}
                          menuContainerRef={financialCurrencyMenuRef}
                          menuPortalRef={financialCurrencyMenuPortalRef}
                        />
                      </div>
                    </td>
                    <td className="h-[4.5rem] min-h-[4.5rem] max-h-[4.5rem] overflow-visible md:overflow-visible border-x border-[var(--surface-input-border)] px-1 text-center align-middle sm:px-2">
                      <div className={`flex h-full min-h-0 w-full items-center justify-center overflow-visible md:overflow-visible ${FINANCIAL_SUMMARY_AMOUNT_CONTAINER_CLASS}`}>
                        <FinancialSummaryAmount
                          parts={remainingDisplayParts}
                          amountClassName={isOverBudget ? 'text-rose-400' : typographyBodyClass}
                          menuAnchor="status"
                          activeMenuAnchor={financialCurrencyMenuAnchor}
                          onToggleMenu={toggleFinancialCurrencyMenu}
                          onCurrencyPicked={handleFinancialCurrencyPicked}
                          menuContainerRef={financialCurrencyMenuRef}
                          menuPortalRef={financialCurrencyMenuPortalRef}
                        />
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="h-8 border-x border-[var(--surface-input-border)] px-2 align-top" aria-hidden />
                    <td className="h-8 border-x border-[var(--surface-input-border)] px-2 align-top" aria-hidden />
                    <td className={`h-8 border-x border-[var(--surface-input-border)] px-2 pt-1 text-center align-top text-[10px] leading-snug md:text-xs ${typographyMutedClass}`}>
                      {remaining >= 0 ? tr('remainingInBudget') : tr('overBudget')}
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
              <div
                dir={dir}
                className="mt-4 flex w-full flex-row flex-nowrap justify-start gap-2 overflow-x-auto pt-2 [-webkit-overflow-scrolling:touch] no-scrollbar sm:gap-3 sm:pt-4"
              >
                <button
                  type="button"
                  onClick={openSettingsManualRate}
                  className={currencyUtilityButtonClass}
                  title={tr('settingsCurrencySubManualRate')}
                  aria-label={tr('settingsCurrencySubManualRate')}
                >
                  {tr('settingsCurrencySubManualRate')}
                </button>
                <button
                  type="button"
                  onClick={openSettingsCommissions}
                  className={currencyUtilityButtonClass}
                  title={tr('settingsCurrencySubCommissions')}
                  aria-label={tr('settingsCurrencySubCommissions')}
                >
                  {tr('settingsCurrencySubCommissions')}
                </button>
              </div>
            </div>

            {/* Monthly budget setter */}
            <div className={`mb-4 w-full ${themeCardClass} p-4 sm:mb-6 sm:p-6`}>
              <h2 className={`mb-4 flex items-center gap-2 text-base font-semibold sm:text-lg ${typographyTitleClass}`}>
                <Wallet className="h-5 w-5 shrink-0 text-emerald-400" />
                {budgetSetterTitle}
              </h2>
              <div className="w-full">
                <div className="min-w-0 w-full">
                  <label className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>
                    {tr('budgetAmountLabel')} ({currencySymbol(displayCurrency)})
                  </label>
                  <div className="flex w-full items-center justify-start gap-4">
                    <div className="relative w-auto min-w-[12rem] max-w-full shrink-0 overflow-hidden sm:min-w-[250px] sm:max-w-sm">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(sanitizeMoneyInputDraft(e.target.value))}
                        placeholder={showBudgetCurrentAmountOverlay ? '' : tr('enterAmount')}
                        className={`block h-10 w-full truncate px-2 py-1.5 sm:h-12 sm:px-4 sm:py-3 ${budgetInputTextClass} ${surfaceInputClass}`}
                      />
                      {showBudgetCurrentAmountOverlay && (
                        <div
                          aria-hidden
                          className={`pointer-events-none absolute inset-0 flex min-w-0 items-center gap-1 overflow-hidden px-2 py-1.5 sm:px-4 sm:py-3 ${budgetInputTextClass} text-[var(--surface-input-placeholder,var(--color-category-5-muted))]`}
                        >
                          <span className="shrink-0">{tr('currentAmountPrefix')}:</span>
                          {lang === 'he' ? (
                            <span
                              dir="ltr"
                              className="block min-w-0 max-w-full flex-1 basis-0 truncate text-left tabular-nums [unicode-bidi:isolate]"
                            >
                              {selectedBudgetDisplayLabel}
                            </span>
                          ) : (
                            <span className="block min-w-0 max-w-full flex-1 basis-0 truncate tabular-nums">
                              {selectedBudgetDisplayLabel}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleSetBudget}
                      className={`flex h-10 flex-none shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden px-3 py-2 text-center sm:h-12 sm:px-4 ${primaryActionButtonClass}`}
                    >
                      {showBudgetSaved ? (
                        <>
                          <Check className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
                          {renderBudgetButtonText(budgetSavedLabel)}
                        </>
                      ) : (
                        renderBudgetButtonText(updateBudgetLabel)
                      )}
                    </button>
                  </div>
                  <div className="mt-2 flex w-full flex-col gap-2">
                    <label
                      htmlFor="budget-auto-transfer"
                      className="flex min-w-0 cursor-pointer flex-row flex-wrap items-center justify-start gap-2 text-xs text-gray-400"
                    >
                      <span className="text-start">{tr('budgetAutoTransferNote')}</span>
                      <input
                        id="budget-auto-transfer"
                        type="checkbox"
                        checked={isAutoTransferEnabledForSelectedMonth}
                        onChange={(e) => handleAutoTransferBudgetChange(e.target.checked)}
                        className="ml-0 h-4 w-4 shrink-0 rounded border-gray-600 bg-neutral-800 text-emerald-500 focus:ring-emerald-500/30"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

        {/* Add Expense Form */}
        <div className={`relative isolate z-10 ${themeCardClass} p-4 sm:p-6 mb-6 sm:mb-8`}>
          <h2 className={`text-base sm:text-lg font-semibold mb-4 sm:mb-6 flex items-center gap-2 ${typographyTitleClass}`}>
            <Plus className={`w-5 h-5 ${primaryActionAccentIconClass}`} />
            {tr('addExpenseTitle')}
          </h2>

          <form onSubmit={handleAddExpense} className="flex flex-col gap-4">
            {/* Row 1: Category + Amount */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <label className={`block text-sm font-medium mb-2 ${typographyLabelClass}`}>{tr('category')}</label>
                <select
                  value={isAddingCategory ? ADD_CUSTOM_VALUE : newExpense.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className={surfaceInputLgClass}
                >
                  {allCategories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                  <option value={ADD_CUSTOM_VALUE}>{tr('addNewCategory')}</option>
                </select>
              </div>

              <div className="min-w-0 w-full sm:flex-1">
              <ExpenseAmountField
                amount={newExpense.amount}
                currency={newExpense.currency}
                onAmountChange={(amount) => setNewExpense({ ...newExpense, amount })}
                onCurrencyChange={(currency) => setNewExpense({ ...newExpense, currency })}
                onRatesReadyChange={setExpenseRatesReady}
                onOpenExchangeRatesSettings={openSettingsExchangeRates}
                transactionDate={newExpenseIsoDate}
                historicalRateEntry={newExpenseHistoricalApplied.rateEntry ?? undefined}
                historicalFeePercent={newExpenseHistoricalFeePercent}
                snapInputGroupToColumnEnd
              />
              </div>
            </div>

            {/* Row 2: Description + Date + Submit */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="w-full shrink-0 sm:w-44">
                <label className={`block text-sm font-medium mb-2 ${typographyLabelClass}`}>
                  {tr('descriptionOptional')}
                </label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  placeholder={tr('exampleExpensePlaceholder')}
                  className={surfaceInputLgClass}
                />
              </div>

              <div className="w-full shrink-0 sm:w-44">
                <label className={`block text-sm font-medium mb-2 ${typographyLabelClass}`}>{tr('date')}</label>
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                  className={`${surfaceInputLgClass} [color-scheme:dark]`}
                  required
                />
              </div>

              <div className="shrink-0 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={expenseSubmitBlocked}
                  className={`h-12 w-full min-w-[10.5rem] shrink-0 px-6 flex items-center justify-center gap-2 ${primaryActionButtonClass} ${primaryActionDisabled}`}
                >
                  <Plus className="w-5 h-5" />
                  {tr('addExpense')}
                </button>
              </div>
            </div>

            {/* Historical override prompt — shown when a past date+currency has archived overrides */}
            <AnimatePresence>
              {newExpenseHistoricalBanner && (
                <HistoricalOverridePrompt
                  context={newExpenseHistoricalBanner}
                  onChoice={handleNewExpenseHistoricalChoice}
                  onOptionsChange={setNewExpenseHistoricalBannerOptions}
                />
              )}
            </AnimatePresence>

            {isAddingCategory && (
              <div className="flex justify-start">
                <CreateCategoryForm
                  name={newCategoryName}
                  onNameChange={(v) => {
                    setNewCategoryName(v);
                    if (categoryError) setCategoryError('');
                  }}
                  color={newCategoryColor}
                  onColorChange={setNewCategoryColor}
                  iconName={newCategoryIcon}
                  onIconChange={setNewCategoryIcon}
                  error={categoryError}
                  onSubmit={handleAddCategory}
                  onCancel={handleCancelAddCategory}
                />
              </div>
            )}
          </form>
        </div>

          </>
        )}

        {/* ============================ ANALYTICS =========================== */}
        {activeTab === 'analytics' && (
          <ExpenseSummary expenses={expenses} categories={allCategories} />
        )}

        {/* =========================== SUB-BUDGETS ========================== */}
        {activeTab === 'subbudgets' && (
          <>
            {monthSelector}

            <SubBudgetTracker
              budget={budget}
              monthLabel={monthLabel}
              monthExpenses={monthExpenses}
              categories={allCategories}
              budgetOriginal={budgetOriginalByMonth[selectedMonthKey]}
              subBudgets={subBudgets}
              subBudgetsOriginal={subBudgetsOriginal}
              onSaveSubBudgets={handleSaveSubBudgets}
              isMainBudget={activeBudgetId === DEFAULT_MONTHLY_BUDGET_ID}
              linkedBudgetsExpanded={uiPreferences.linkedBudgetsExpanded}
              regularBudgetsExpanded={uiPreferences.regularBudgetsExpanded}
              subBudgetPreviewExpanded={uiPreferences.subBudgetPreviewExpanded}
              subBudgetOverviewExpanded={uiPreferences.subBudgetOverviewExpanded}
              onLinkedBudgetsExpandedChange={(expanded) =>
                persistUiPreferences({ linkedBudgetsExpanded: expanded })
              }
              onRegularBudgetsExpandedChange={(expanded) =>
                persistUiPreferences({ regularBudgetsExpanded: expanded })
              }
              onSubBudgetPreviewExpandedChange={(expanded) =>
                persistUiPreferences({ subBudgetPreviewExpanded: expanded })
              }
              onSubBudgetOverviewExpandedChange={(expanded) =>
                persistUiPreferences({ subBudgetOverviewExpanded: expanded })
              }
            />
          </>
        )}

        {/* ============================ EXPENSES ============================ */}
        {activeTab === 'expenses' && (
        <div className={`w-full ${themeCardClass}`}>
          <div className="border-b border-[var(--main-card-surface-border)] p-4 sm:p-6">
            <h2 className={`text-base sm:text-lg font-semibold ${typographyTitleClass}`}>{tr('expenseHistoryTitle')}</h2>
            <p className={`text-sm mt-1 ${typographyMutedClass}`}>
              {historyExpenses.length} • {tr('totalShort')}{' '}
              {historyTotal != null ? (
                <DisplayCurrencyAmount amount={historyTotal} className="inline-block font-medium" />
              ) : (
                <DisplayMoney amount={historyTotalIls} className="inline-block font-medium" />
              )}
            </p>

            <div
              className={`${filterBarContainerClass} mt-4`}
              role="tablist"
              aria-label={tr('periodFilterLabel')}
            >
              {HISTORY_TIME_FILTERS.map((filter) => {
                const isActive = timeFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setTimeFilter(filter.id)}
                    className={`flex-1 py-2.5 text-sm ${
                      isActive ? filterBarActiveTabClass : filterBarInactiveTabClass
                    }`}
                  >
                    <span>{({
                      daily: tr('filterDaily'),
                      weekly: tr('filterWeekly'),
                      monthly: tr('filterMonthly'),
                      yearly: tr('filterYearly'),
                    })[filter.id]}</span>
                  </button>
                );
              })}
            </div>

            <div className="relative mt-4">
              <Search className="w-5 h-5 text-neutral-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('searchByDescriptionOrCategory')}
                className={surfaceSearchInputClass}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 p-1.5 rounded-lg"
                  aria-label={tr('clearSearch')}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {historyExpenses.length === 0 ? (
            <div className="p-10 sm:p-12 text-center">
              <div className={`${emptyStateIconWellClass} w-16 h-16 mx-auto mb-4`}>
                <TrendingDown className={`w-8 h-8 ${themeTextMutedClass}`} />
              </div>
              <p className={`text-base sm:text-lg ${typographyBodyClass}`}>
                {search ? tr('noResults') : expenses.length === 0 ? tr('noExpensesYet') : tr('noExpensesForPeriod')}
              </p>
              <p className="text-neutral-500 text-sm mt-1">
                {search
                  ? tr('tryAnotherTerm')
                  : expenses.length === 0
                    ? tr('addFirstExpense')
                    : tr('tryAnotherPeriod')}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: card list (native-app feel) */}
              <ul className={`md:hidden w-full ${subCardNestedListStackClass}`} data-nested-list-stack>
                {historyExpenses.map((expense) => {
                  const categoryInfo = getCategoryInfo(expense.category);
                  const IconComponent = categoryInfo.icon;

                  return (
                    <li key={expense.id} className={`w-full ${subCardNestedItemClass} ${subCardRowClass}`} data-nested-list-item>
                      <div className="flex items-center gap-3">
                        <CategoryIconBadge
                          icon={IconComponent}
                          colorClass={categoryInfo.color}
                        />
                        <div className="min-w-0 flex-1">
                          <LocalizedUserText
                            text={expenseDescriptionLabel(expense.description)}
                            className={`font-medium truncate block ${
                              expense.description.trim() ? typographyBodyClass : `${typographyMutedClass} italic`
                            }`}
                          />
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                            <span className="truncate">
                              <LocalizedUserText text={expense.category} />
                            </span>
                            <span className="text-neutral-600">•</span>
                            <span className="shrink-0">{formatDisplayDate(expense.date, lang)}</span>
                          </div>
                          {recentlyUpdatedExpenseId === expense.id && (
                            <p className="mt-0.5 text-xs font-medium text-emerald-300">{tr('expenseUpdated')}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center text-left">
                          <ExpenseAmountDisplay
                            amount={expense.amount}
                            originalAmount={expense.originalAmount}
                            originalCurrency={expense.originalCurrency}
                            variant="card"
                            showSecondaryLine={shouldShowExpenseEquivalentLine(expense, displayCurrency)}
                            manualBadgeLabel={
                              !expense.manualRateDisabled && expense.manualRateUsed
                                ? tr('expenseManualRateBadge')
                                : undefined
                            }
                            feeBadgeLabel={
                              !expense.feeDisabled && (expense.appliedFeePercent ?? 0) > 0
                                ? tr('expenseFeeBadge')
                                : undefined
                            }
                          />
                        </div>
                        <div className="shrink-0 flex items-center gap-1">
                          <button
                            onClick={() => handleEditExpenseStart(expense)}
                            className="text-neutral-500 hover:text-indigo-300 active:bg-indigo-500/10 p-2.5 rounded-lg transition-all"
                            title={tr('edit')}
                            aria-label={tr('editExpense')}
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="text-neutral-500 hover:text-rose-400 active:bg-rose-500/10 p-2.5 rounded-lg transition-all"
                            title={tr('delete')}
                            aria-label={tr('deleteExpense')}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop: aligned full-width grid (header + rows share identical columns) */}
              <div className="hidden md:block w-full" role="table" aria-label={tr('expenseHistoryTitle')}>
                <div
                  role="row"
                  className={`${EXPENSE_HISTORY_ROW_GRID} ${subCardTableHeadClass} border-b border-[var(--color-sub-cards-border)] px-6 py-4`}
                >
                  <div role="columnheader" className={`text-end text-sm font-semibold ${typographyLabelClass}`}>
                    {tr('description')}
                  </div>
                  <div role="columnheader" className={`text-end text-sm font-semibold ${typographyLabelClass}`}>
                    {tr('amountLabel')} ({currencySymbol(displayCurrency)})
                  </div>
                  <div role="columnheader" className={`text-end text-sm font-semibold ${typographyLabelClass}`}>
                    {tr('category')}
                  </div>
                  <div role="columnheader" className={`text-end text-sm font-semibold ${typographyLabelClass}`}>
                    {tr('date')}
                  </div>
                  <div role="columnheader" className={`text-center text-sm font-semibold ${typographyLabelClass}`}>
                    {tr('actions')}
                  </div>
                </div>
                <div className={`w-full ${subCardNestedListStackClass}`} data-nested-list-stack role="rowgroup">
                  {historyExpenses.map((expense) => {
                    const categoryInfo = getCategoryInfo(expense.category);
                    const IconComponent = categoryInfo.icon;

                    return (
                      <div
                        key={expense.id}
                        role="row"
                        className={`${EXPENSE_HISTORY_ROW_GRID} ${subCardRowClass} w-full px-6 py-4`}
                        data-nested-list-item
                      >
                        <div role="cell" className="min-w-0 text-end">
                          <LocalizedUserText
                            text={expenseDescriptionLabel(expense.description)}
                            className={`font-medium ${
                              expense.description.trim() ? typographyBodyClass : `${typographyMutedClass} italic`
                            }`}
                          />
                        </div>
                        <div role="cell" className="flex items-center justify-end text-end">
                          <ExpenseAmountDisplay
                            amount={expense.amount}
                            originalAmount={expense.originalAmount}
                            originalCurrency={expense.originalCurrency}
                            showSecondaryLine={shouldShowExpenseEquivalentLine(expense, displayCurrency)}
                            manualBadgeLabel={
                              !expense.manualRateDisabled && expense.manualRateUsed
                                ? tr('expenseManualRateBadge')
                                : undefined
                            }
                            feeBadgeLabel={
                              !expense.feeDisabled && (expense.appliedFeePercent ?? 0) > 0
                                ? tr('expenseFeeBadge')
                                : undefined
                            }
                          />
                        </div>
                        <div role="cell" className="flex justify-end">
                          <CategoryColorChip color={categoryInfo.color} icon={IconComponent}>
                            <LocalizedUserText text={expense.category} />
                          </CategoryColorChip>
                        </div>
                        <div role="cell" className={`text-end ${typographyMutedClass}`}>
                          {formatDisplayDate(expense.date, lang)}
                        </div>
                        <div role="cell" className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEditExpenseStart(expense)}
                            className="p-2 rounded-lg transition-all hover:bg-[var(--color-depth-inner)] active:opacity-90"
                            title={tr('edit')}
                            aria-label={tr('editExpense')}
                          >
                            <Pencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(expense.id)}
                            className="p-2 rounded-lg transition-all hover:bg-[var(--color-depth-inner)] active:opacity-90"
                            title={tr('delete')}
                            aria-label={tr('deleteExpense')}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          {recentlyUpdatedExpenseId === expense.id && (
                            <span className="text-xs font-medium text-emerald-300">{tr('expenseUpdated')}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

        </div>
        )}
          </>
        )}
      </main>
      </div>

      {editingExpenseId && editExpenseDraft && (
        <div
          dir={dir}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-expense-title"
        >
          <button
            type="button"
            onClick={handleEditExpenseCancel}
            aria-label={tr('close')}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className={`relative z-10 w-full max-w-2xl p-4 sm:p-6 ${surfaceModalClass}`}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="edit-expense-title" className={`text-base font-semibold sm:text-lg ${typographyTitleClass}`}>
                  {tr('editExpense')}
                </h3>
                <p className="mt-1 text-xs text-neutral-500 sm:text-sm">{tr('expenseHistoryTitle')}</p>
              </div>
              <button
                type="button"
                onClick={handleEditExpenseCancel}
                className={`rounded-lg p-2 transition-colors ${utilityIconButtonGhostClass}`}
                aria-label={tr('close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>{tr('description')}</label>
                <input
                  type="text"
                  value={editExpenseDraft.description}
                  onChange={(e) =>
                    setEditExpenseDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            description: e.target.value,
                          }
                        : prev,
                    )
                  }
                  placeholder={tr('descriptionOptional')}
                  className={surfaceInputLgClass}
                />
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <ExpenseAmountField
                  amount={editExpenseDraft.amount}
                  currency={editExpenseDraft.currency}
                  onAmountChange={(amount) =>
                    setEditExpenseDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            amount,
                          }
                        : prev,
                    )
                  }
                  onCurrencyChange={(currency) =>
                    setEditExpenseDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            currency,
                          }
                        : prev,
                    )
                  }
                  onRatesReadyChange={setEditExpenseRatesReady}
                  transactionDate={normalizeDate(editExpenseDraft.date)}
                />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>{tr('category')}</label>
                  <select
                    value={editExpenseDraft.category}
                    onChange={(e) =>
                      setEditExpenseDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              category: e.target.value,
                            }
                          : prev,
                      )
                    }
                    className={surfaceInputLgClass}
                  >
                    {allCategories.map((category) => (
                      <option key={`edit-expense-${category.value}`} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-0 sm:w-[11rem]">
                  <label className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>{tr('date')}</label>
                  <input
                    type="date"
                    value={editExpenseDraft.date}
                    onChange={(e) =>
                      setEditExpenseDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              date: e.target.value,
                            }
                          : prev,
                      )
                    }
                    className={`${surfaceInputLgClass} px-3`}
                  />
                </div>
                </div>
              </div>

              {(editModifierVisibility.showManualRate || editModifierVisibility.showFee) && (
                  <div className="space-y-3 rounded-xl border border-[var(--color-sub-cards-border)] p-3 sm:p-4">
                    {editModifierVisibility.showManualRate && (
                      <label
                        htmlFor="edit-expense-disable-manual"
                        className="flex cursor-pointer items-center justify-between gap-3"
                      >
                        <span className={`text-sm ${typographyBodyClass}`}>
                          {tr('expenseRemoveManualRate')}
                        </span>
                        <input
                          id="edit-expense-disable-manual"
                          type="checkbox"
                          checked={editExpenseDraft.manualRateDisabled}
                          onChange={(e) =>
                            setEditExpenseDraft((prev) =>
                              prev ? { ...prev, manualRateDisabled: e.target.checked } : prev,
                            )
                          }
                          className="h-5 w-5 shrink-0 rounded border-gray-600 bg-neutral-800 text-emerald-500 focus:ring-emerald-500/30"
                        />
                      </label>
                    )}
                    {editModifierVisibility.showFee && (
                      <label
                        htmlFor="edit-expense-disable-fee"
                        className="flex cursor-pointer items-center justify-between gap-3"
                      >
                        <span className={`text-sm ${typographyBodyClass}`}>
                          {tr('expenseRemoveFee')}
                        </span>
                        <input
                          id="edit-expense-disable-fee"
                          type="checkbox"
                          checked={editExpenseDraft.feeDisabled}
                          onChange={(e) =>
                            setEditExpenseDraft((prev) =>
                              prev ? { ...prev, feeDisabled: e.target.checked } : prev,
                            )
                          }
                          className="h-5 w-5 shrink-0 rounded border-gray-600 bg-neutral-800 text-emerald-500 focus:ring-emerald-500/30"
                        />
                      </label>
                    )}
                    {editPreviewAmount != null && (
                      <p className={`text-sm font-medium ${typographyBodyClass}`}>
                        <LtrNumeric>
                          {formatTranslation(lang, 'expenseCurrentChoicePreview', {
                            amount: formatAmountWithSymbol(editPreviewAmount, displayCurrency, {
                              forceTwoDecimals: displayCurrency !== 'ILS',
                            }),
                          })}
                        </LtrNumeric>
                      </p>
                    )}
                  </div>
                )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleEditExpenseCancel}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:opacity-90 ${surfaceInputClass} text-[var(--surface-input-text)]`}
                >
                  {tr('cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleEditExpenseSave}
                  disabled={
                    editExpenseSubmitBlocked ||
                    !editExpenseDraft.amount.trim() ||
                    !editExpenseDraft.category.trim() ||
                    !editExpenseDraft.date.trim()
                  }
                  className={`px-4 py-2.5 text-sm ${primaryActionButtonClass} ${primaryActionDisabled}`}
                >
                  {tr('saveChanges')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isInsideActiveBudget && (
        <MobileBottomNav
          activeTab={activeTab}
          onOpenProfile={() => openProfile()}
          onTabSelect={handleTabSelect}
        />
      )}

      {/* Footer (desktop only; mobile uses the bottom nav) */}
      <footer className={themeFooterClass}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-neutral-500">
            {tr('appName')} - {tr('appTagline')}
          </p>
        </div>
      </footer>

      {/* Budget change confirmation modal */}
      <BudgetChangeModal
        open={showBudgetModal && pendingBudget !== null}
        newBudget={pendingBudget ?? 0}
        currentBudget={budget}
        monthLabel={monthLabel}
        onSelect={(mode) => {
          if (pendingBudget !== null && pendingBudgetOriginal) {
            applyBudgetChange(pendingBudget, mode, pendingBudgetOriginal);
          }
        }}
        onClose={handleCloseBudgetModal}
      />
    </motion.div>
    </SettingsPersistenceProvider>
  );
}

export default App;
