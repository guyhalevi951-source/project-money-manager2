import {
  useState,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useCallback,
  type MutableRefObject,
  type ReactNode,
  type TouchEvent,
} from 'react';
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
  LogOut,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import {
  CATEGORIES,
  ICON_OPTIONS,
  resolveIcon,
  DEFAULT_CATEGORY_COLOR,
  hexForColor,
  isValidCategoryColor,
  aggregateByCategory,
  lookupCategory,
  type Category,
} from './categories';
import appLogo from './assets/app-logo.png';
import CategoryColorPicker from './components/CategoryColorPicker';
import CreateCategoryForm from './components/CreateCategoryForm';
import CategoryIconBadge from './components/CategoryIconBadge';
import CategoryBreakdownLegend from './components/CategoryBreakdownLegend';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { updateProfile } from 'firebase/auth';
import { auth, signOutUser } from './firebase';
import AuthPage from './components/AuthPage';
import UserProfileMenu from './components/UserProfileMenu';
import SettingsPage from './components/SettingsPage';
import ProfilePage from './components/ProfilePage';
import { SettingsPersistenceProvider } from './context/SettingsPersistenceContext';
import {
  applyIsolatedCloudSessionSeed,
  rehydrateIsolatedGuestSession,
} from './services/settingsPersistenceEngine';
import ExpenseAmountField from './components/ExpenseAmountField';
import SelectedDaySummary from './components/SelectedDaySummary';
import ExpenseAmountDisplay from './components/ExpenseAmountDisplay';
import DisplayMoney from './components/DisplayMoney';
import CategoryColorChip from './components/CategoryColorChip';
import { LocalizedUserText, LtrNumeric, useLanguage } from './LanguageContext';
import { formatTranslation, localizeCategoryLabel } from './translations';
import {
  formatAmountParts,
  formatAmountWithSymbol,
  formatMoneyPartsFromIls,
  symbolToCurrency,
  type AmountDisplayParts,
} from './services/displayCurrencyUtils';
import { DisplayCurrencyInlineMenu } from './components/DisplayCurrencySelector';
import { themeCategoryProps } from './services/buttonThemeService';
import {
  clearAllCurrencyCommissionsLocal,
  clearCloudCurrencyCommissions,
  listActiveCurrencyCommissions,
  replaceCloudCurrencyCommissions,
} from './services/currencyCommissionService';
import { convertExpenseAmountToIls } from './services/expenseConversionService';
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
  utilityNavShortcutClass,
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
  APP_THEME_SCOPE,
  themeAntiClipVisibleClass,
  themeScrollRoutePageClass,
  themeScrollRouteShellClass,
  themeScrollSafeContentClass,
  themeScrollViewportClass,
} from './styles/themeSurfaceStyles';
import {
  clearAllManualExchangeOverridesLocal,
  clearCloudManualExchangeOverrides,
  listActiveManualExchangeOverrides,
  replaceCloudManualExchangeOverrides,
} from './services/manualExchangeOverrideService';
import {
  convertForeignToIls,
  convertIlsToForeign,
  currencySymbol,
  fetchExchangeRates,
  getCachedExchangeRates,
  type ExpenseCurrency,
} from './services/exchangeRateService';
import {
  EMPTY_USER_APP_DATA,
  loadFromLocalStorage,
  saveToLocalStorage,
} from './userDataStorage';
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
  EMPTY_USER_SETTINGS,
  ensureCloudDataMigrated,
  pruneExpiredCloudExchangeFees,
  saveCategoriesToCloud,
  saveExpensesToCloud,
  subscribeCurrencyCommissions,
  subscribeManualExchangeOverrides,
  subscribeCategories,
  subscribeExpenses,
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
import { parseMoneyInput, roundMoney, sanitizeMoneyInputDraft, sumMoney } from './services/money';
import MoneyAmountInput from './components/MoneyAmountInput';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  // Canonical date stored as ISO 'YYYY-MM-DD' for reliable month filtering.
  date: string;
  originalAmount?: number;
  originalCurrency?: string;
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

// DD/MM/YYYY subtitle for the dashboard category donut.
const formatChartDateLabel = (iso: string): string => {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  return `${pad2(d)}/${pad2(m)}/${y}`;
};

const shiftISODate = (iso: string, dayOffset: number): string => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + dayOffset);
  return toISODate(d);
};

const isSameCalendarMonth = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/** Daily chart date for a viewed month: today if it is the real-world current month, else the 1st. */
const chartDateIsoForMonth = (monthDate: Date): string => {
  const now = new Date();
  if (isSameCalendarMonth(monthDate, now)) {
    return toISODate(now);
  }
  return toISODate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
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

const roundMoneyAmount = (value: number): number => roundMoney(value);

const compareSubBudgetCategoryKeys = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

const mergeRemoteSubBudgetsByMonth = (
  local: Record<string, Record<string, number>>,
  remote: Record<string, Record<string, number>>,
  editedMonths: Set<string>,
): Record<string, Record<string, number>> => {
  if (editedMonths.size === 0) {
    return remote;
  }
  const merged = { ...remote };
  for (const monthKey of editedMonths) {
    if (!monthHasSubBudgetRecord(local, monthKey)) continue;
    const localMonth = local[monthKey];
    const remoteMonth = remote[monthKey] ?? {};
    if (JSON.stringify(localMonth) !== JSON.stringify(remoteMonth)) {
      merged[monthKey] = localMonth;
    }
  }
  for (const monthKey of [...editedMonths]) {
    if (
      monthHasSubBudgetRecord(local, monthKey) &&
      JSON.stringify(local[monthKey]) === JSON.stringify(remote[monthKey] ?? {})
    ) {
      editedMonths.delete(monthKey);
    }
  }
  return merged;
};

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

type SummaryView = 'week' | 'month' | 'year';

// Top-level navigation tabs.
const TABS = [
  { id: 'dashboard', icon: LayoutDashboard },
  { id: 'analytics', icon: PieChartIcon },
  { id: 'subbudgets', icon: Wallet },
  { id: 'expenses', icon: Receipt },
] as const;
type TabId = (typeof TABS)[number]['id'];

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
  const expenseCurrency = symbolToCurrency(expense.originalCurrency!);
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
            : 'bg-slate-800/95 text-slate-200 border-slate-700/80 hover:border-slate-600 hover:bg-slate-700/90'
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
          } ${isActive ? 'bg-white/15' : 'bg-slate-900/80'}`}
        >
          <Icon className={`${variant === 'mobile' ? 'w-5 h-5' : 'w-4 h-4'} ${isActive ? 'text-white' : 'text-indigo-400'}`} />
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
          className={`h-10 w-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 active:scale-95 ${utilityNavMenuToggleClass} ${
            open ? 'text-white' : ''
          }`}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
        <div
          role="menu"
          aria-hidden={!open}
          className={`absolute top-full mt-2 end-0 z-[60] flex w-[min(100vw-2rem,22rem)] flex-col gap-1.5 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-md transition-all duration-200 ease-out origin-top ${
            open
              ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
          }`}
        >
          {userEmail && (
            <p className="truncate border-b border-slate-800/80 px-2 py-1 text-xs text-slate-500" title={userEmail}>
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
            <ActiveIcon className="w-4 h-4 text-indigo-200" />
          </span>
          <span className="text-slate-100">{tabLabel(active.id)}</span>
          <ChevronUp
            className={`w-4 h-4 text-slate-400 transition-transform duration-300 ease-in-out ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        <div
          role="menu"
          aria-hidden={!open}
          className={`absolute top-full mt-2 end-0 min-w-[12.5rem] p-2 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl shadow-black/40 backdrop-blur-md flex flex-col gap-1.5 transition-all duration-300 ease-in-out origin-top ${
            open
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
          }`}
        >
          {TABS.map((tab, i) => tabButton(tab, i))}
          {onLogout && (
            <>
              <div className="h-px bg-slate-700/80 my-1" />
              {userEmail && (
                <p className="px-2 py-1 text-[11px] text-slate-500 truncate" title={userEmail}>
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
  const { tr, formatMoney } = useLanguage();
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
          <DisplayMoney amount={total} className="text-xl sm:text-2xl font-bold leading-none" />
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
                  formatMoney(item.amount)
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
  lang: 'he' | 'en' = 'he'
): { dailySeries: TrendSeriesPoint[]; periodDayCount: number } => {
  const points: TrendSeriesPoint[] = [];

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
  const [view, setView] = useState<SummaryView>('month');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [chartSlide, setChartSlide] = useState(0);
  const [chartDirection, setChartDirection] = useState<'forward' | 'backward'>('forward');
  const [selectedTrendIso, setSelectedTrendIso] = useState<string | null>(null);
  const isCoarsePointer = useCoarsePointer();
  const touchStartXRef = useRef<number | null>(null);
  const goToChartSlide = useCallback((nextIndex: number) => {
    const clampedNextIndex = Math.max(0, Math.min(ANALYTICS_SLIDE_COUNT - 1, nextIndex));
    setChartSlide((current) => {
      if (clampedNextIndex === current) return current;
      setChartDirection(clampedNextIndex > current ? 'forward' : 'backward');
      return clampedNextIndex;
    });
  }, []);
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
      if (view === 'week') x.setDate(x.getDate() + dir * 7);
      else if (view === 'month') x.setMonth(x.getMonth() + dir);
      else x.setFullYear(x.getFullYear() + dir);
      return x;
    });
  };

  const anchorMonthKey = monthKeyOfDate(anchor);

  const inPeriod = (rawDate: string): boolean => {
    const iso = normalizeDate(rawDate);
    const d = parseISO(iso);
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

  const chartPeriodKey = `${view}-${anchorMonthKey}-${anchor.getFullYear()}-${anchor.getMonth()}-${weekNumber(anchor)}`;

  const total = periodExpenses.reduce((sum, e) => sum + e.amount, 0);

  const breakdown = useMemo(
    () => aggregateByCategory(periodExpenses, categories),
    [periodExpenses, categories]
  );

  const categoryDonutData =
    breakdown.length > 0
      ? breakdown.map((b) => ({ name: b.label, value: b.amount, hex: b.hex }))
      : [{ name: '', value: 1, hex: '#27272a' }];

  const dailyBreakdown = useMemo(() => {
    const grouped = periodExpenses.reduce<Record<string, number>>((acc, e) => {
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
  }, [periodExpenses, total, lang]);

  const dailyDonutData =
    dailyBreakdown.length > 0
      ? dailyBreakdown.map((d) => ({ name: d.label, value: d.amount, hex: d.hex }))
      : [{ name: '', value: 1, hex: '#27272a' }];

  const amountByDate = useMemo(
    () =>
      periodExpenses.reduce<Record<string, number>>((acc, e) => {
        const iso = normalizeDate(e.date);
        acc[iso] = (acc[iso] || 0) + e.amount;
        return acc;
      }, {}),
    [periodExpenses],
  );

  const { dailySeries, periodDayCount } = useMemo(
    () => buildContinuousTrendSeries(view, anchor, amountByDate, lang),
    [view, anchor, amountByDate, lang],
  );

  const average = periodDayCount > 0 ? total / periodDayCount : 0;
  const trendMax = Math.max(250, ...dailySeries.map((d) => d.amount), 1);

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
  if (view === 'year') {
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
    if (view === 'week') d.setDate(d.getDate() + offset * 7);
    else if (view === 'month') d.setMonth(d.getMonth() + offset);
    else d.setFullYear(d.getFullYear() + offset);

    let label: string;
    if (view === 'year') label = `${d.getFullYear()}`;
    else if (view === 'month') label = d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'short' });
    else label = `${tr('weekPrefix')} ${weekNumber(d)}`;

    return { offset, date: d, label };
  });

  const views: { id: SummaryView; label: string }[] = [
    { id: 'week', label: tr('viewWeek') },
    { id: 'month', label: tr('viewMonth') },
    { id: 'year', label: tr('viewYear') },
  ];

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
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 active:scale-95 transition-all"
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
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 active:scale-95 transition-all"
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
          {/* Swipe layer disabled on trend slide so hover/tap reaches the chart */}
          <motion.div
            className={`absolute inset-0 ${chartSlide === 2 ? 'pointer-events-none z-0' : 'z-10'}`}
            drag={chartSlide === 2 ? false : 'x'}
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
                <div className="flex min-h-0 flex-1 items-center">
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

            {chartSlide === 1 && (
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

            {chartSlide === 2 && (
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
                      <DisplayMoney amount={total} className={`font-semibold inline-block ${typographyBodyClass}`} />
                    </p>
                    <p>
                      <span className="text-neutral-500">{tr('average')}: </span>
                      <DisplayMoney amount={average} className={`font-semibold inline-block ${typographyBodyClass}`} />
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
                          interval={view === 'month' ? 6 : view === 'year' ? 1 : 0}
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

        {chartSlide === 2 && selectedTrendPoint && (
          <SelectedDaySummary point={selectedTrendPoint} formatDate={formatTooltipDate} />
        )}

        {/* Carousel pagination dots */}
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

        {/* Detailed category list — companion to View 1 only */}
        {chartSlide === 0 && (
        <div className="mt-8 space-y-5">
          {breakdown.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-neutral-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <PieChartIcon className="w-8 h-8 text-neutral-600" />
              </div>
              <p className="text-neutral-400">{tr('noExpensesInPeriod')}</p>
              <p className="text-neutral-600 text-sm mt-1">{tr('choosePeriodOrAdd')}</p>
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
                        <DisplayMoney amount={b.amount} className="inline-block" />
                      </LtrNumeric>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">
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

/** Currency settings shortcuts — unified purple branding. */
interface SpendingDonutProps {
  dayExpenses: Expense[];
  categories: Category[];
  selectedDateIso: string;
  dateLabel: string;
  onSelectDate: (isoDate: string) => void;
  onPreviousDay: () => void;
  onNextDay: () => void;
  isNotCurrentMonth: boolean;
  onNavigateToAnalytics: () => void;
  onNavigateToExpenses: () => void;
}

// Compact donut of how much was spent per category on the selected day.
function SpendingDonut({
  dayExpenses,
  categories,
  selectedDateIso,
  dateLabel,
  onSelectDate,
  onPreviousDay,
  onNextDay,
  isNotCurrentMonth,
  onNavigateToAnalytics,
  onNavigateToExpenses,
}: SpendingDonutProps) {
  const { tr } = useLanguage();
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const shortcutButtons = (
    <div className="ms-auto flex max-w-full flex-row flex-nowrap items-center justify-end gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] no-scrollbar md:gap-3">
      <button
        type="button"
        onClick={onNavigateToAnalytics}
        className={utilityNavShortcutClass}
      >
        {tr('tabAnalytics')}
      </button>
      <button
        type="button"
        onClick={onNavigateToExpenses}
        className={utilityNavShortcutClass}
      >
        {tr('tabExpenses')}
      </button>
    </div>
  );
  const total = sumMoney(dayExpenses.map((expense) => expense.amount));
  const breakdown = aggregateByCategory(dayExpenses, categories);

  const donutData =
    breakdown.length > 0
      ? breakdown.map((b) => ({ id: b.value, value: b.amount, hex: b.hex }))
      : [{ id: 'empty', value: 1, hex: '#262626' }];

  const handleOpenDatePicker = () => {
    const inputEl = dateInputRef.current;
    if (!inputEl) return;
    const pickerCapable = inputEl as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerCapable.showPicker === 'function') {
      pickerCapable.showPicker();
      return;
    }
    inputEl.click();
  };

  return (
    <div className={`${themeCardClass} p-4 sm:p-6 mb-6 sm:mb-8`}>
      <h2 className={`mb-3 flex items-center gap-2 text-base font-semibold sm:text-lg ${typographyTitleClass}`}>
        <PieChartIcon className="h-5 w-5 shrink-0 text-emerald-400" />
        {tr('expenseByCategory')}
      </h2>

      <div
        dir="ltr"
        className="mb-4 flex items-center justify-center gap-2 sm:gap-3"
      >
        <button
          type="button"
          onClick={onPreviousDay}
          aria-label={tr('prevDay')}
          title={tr('prevDay')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-transparent text-neutral-400 transition-all hover:border-neutral-700 hover:bg-neutral-800 hover:text-neutral-100 active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={handleOpenDatePicker}
          className="relative flex min-w-[7.5rem] items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-center text-sm font-medium tabular-nums text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
          aria-label={tr('date')}
          title={tr('date')}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
          <span>{dateLabel}</span>
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDateIso}
            onChange={(event) => onSelectDate(normalizeDate(event.target.value))}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
            tabIndex={-1}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={onNextDay}
          aria-label={tr('nextDay')}
          title={tr('nextDay')}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-transparent text-neutral-400 transition-all hover:border-neutral-700 hover:bg-neutral-800 hover:text-neutral-100 active:scale-95"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {breakdown.length === 0 ? (
        <>
          <div className="mb-4 mt-2 max-w-full">{shortcutButtons}</div>
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-800">
              <TrendingDown className="h-7 w-7 text-neutral-500" />
            </div>
            <p className="text-neutral-400">{tr('noExpensesOnDate')}</p>
            <p className="mt-1 text-sm text-neutral-500">{tr('addExpenseToSeeBreakdown')}</p>
          </div>
        </>
      ) : (
        <div className="flex max-w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="order-2 flex min-w-0 flex-col items-center gap-6 sm:order-1 sm:flex-1 sm:flex-row sm:items-center">
            <div className="relative h-44 w-44 shrink-0 pointer-events-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="id"
                    cx="50%"
                    cy="50%"
                    innerRadius="64%"
                    outerRadius="100%"
                    paddingAngle={breakdown.length > 1 ? 2 : 0}
                    stroke="#0a0a0a"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {donutData.map((s) => (
                      <Cell key={s.id} fill={s.hex} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <DisplayMoney amount={total} className="text-xl font-bold leading-none" />
                <span className="mt-1 text-[11px] text-neutral-500">{tr('totalShort')}</span>
              </div>
            </div>

            <CategoryBreakdownLegend items={breakdown} layout="grid" />
          </div>

          <div className="order-1 mb-4 mt-2 max-w-full shrink-0 sm:order-2 sm:mb-0 sm:mt-0 sm:self-start">
            {shortcutButtons}
          </div>
        </div>
      )}

      {isNotCurrentMonth && (
        <p className="mt-4 text-center text-xs leading-relaxed text-neutral-400">
          {tr('expenseByCategoryPastMonthFootnote')}
        </p>
      )}
    </div>
  );
}

interface DashboardCategoryChartProps {
  expenses: Expense[];
  categories: Category[];
  chartDateSetterRef: MutableRefObject<((iso: string) => void) | null>;
  initialChartDateIso: string;
  isCurrentCalendarMonth: boolean;
  onNavigateToAnalytics: () => void;
  onNavigateToExpenses: () => void;
}

// Mounts only on the Home tab; remounting picks today (current month) or the 1st (other months).
function DashboardCategoryChart({
  expenses,
  categories,
  chartDateSetterRef,
  initialChartDateIso,
  isCurrentCalendarMonth,
  onNavigateToAnalytics,
  onNavigateToExpenses,
}: DashboardCategoryChartProps) {
  const [selectedChartDate, setSelectedChartDate] = useState(() => initialChartDateIso);

  useEffect(() => {
    chartDateSetterRef.current = setSelectedChartDate;
    return () => {
      chartDateSetterRef.current = null;
    };
  }, [chartDateSetterRef]);

  const dayExpenses = useMemo(
    () => expenses.filter((e) => normalizeDate(e.date) === selectedChartDate),
    [expenses, selectedChartDate]
  );

  const goToPreviousChartDay = () => {
    setSelectedChartDate((prev) => shiftISODate(prev, -1));
  };

  const goToNextChartDay = () => {
    setSelectedChartDate((prev) => shiftISODate(prev, 1));
  };

  return (
    <SpendingDonut
      dayExpenses={dayExpenses}
      categories={categories}
      selectedDateIso={selectedChartDate}
      dateLabel={formatChartDateLabel(selectedChartDate)}
      onSelectDate={setSelectedChartDate}
      onPreviousDay={goToPreviousChartDay}
      onNextDay={goToNextChartDay}
      isNotCurrentMonth={!isCurrentCalendarMonth}
      onNavigateToAnalytics={onNavigateToAnalytics}
      onNavigateToExpenses={onNavigateToExpenses}
    />
  );
}

interface SubBudgetTrackerProps {
  budget: number;
  monthLabel: string;
  monthExpenses: Expense[];
  categories: Category[];
  subBudgets: Record<string, number>;
  onAddSubBudget: (name: string, amount: number, colorClass: string) => void;
  onSetSubBudget: (value: string, amount: number) => void;
  onRemoveSubBudget: (value: string) => void;
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
  subBudgets,
  onAddSubBudget,
  onSetSubBudget,
  onRemoveSubBudget,
}: SubBudgetTrackerProps) {
  const { tr, ensureUserContents, formatMoney, dir, lang, displayCurrency } = useLanguage();

  const subBudgetAmountPlaceholder = `${currencySymbol(displayCurrency)} ${tr('amountLabel')}`;
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [newSubBudgetColor, setNewSubBudgetColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [subChartSlide, setSubChartSlide] = useState(0);
  const [subChartDirection, setSubChartDirection] = useState<'forward' | 'backward'>('forward');

  const spentByCat = monthExpenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const budgetedValues = useMemo(
    () =>
      subBudgetCategoryKeys(subBudgets)
        .filter((v) => subBudgets[v] > 0)
        .sort(compareSubBudgetCategoryKeys),
    [subBudgets],
  );

  useEffect(() => {
    void ensureUserContents(budgetedValues);
  }, [budgetedValues, ensureUserContents]);

  const allocatedTotal = sumMoney(budgetedValues.map((value) => subBudgets[value]));
  const generalAllocated = roundMoneyAmount(Math.max(0, budget - allocatedTotal));

  // Spending that falls outside any budgeted category draws from the General pool.
  const unbudgetedSpent = Object.entries(spentByCat)
    .filter(([v]) => !budgetedValues.includes(v))
    .reduce((s, [, amt]) => roundMoneyAmount(s + amt), 0);

  const totalSpent = sumMoney(monthExpenses.map((expense) => expense.amount));

  const envelopes: Envelope[] = useMemo(() => {
    const list: Envelope[] = budgetedValues.map((v) => {
      const cat = lookupCategory(v, categories);
      return {
        key: v,
        label: cat.label,
        icon: cat.icon,
        color: cat.color,
        hex: hexForColor(cat.color),
        allocated: subBudgets[v],
        spent: spentByCat[v] || 0,
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
    budgetedValues,
    categories,
    subBudgets,
    spentByCat,
    generalAllocated,
    unbudgetedSpent,
    tr,
  ]);
  const usedOverviewAmount = Math.min(totalSpent, budget);
  const remainingOverviewAmount = Math.max(0, budget - totalSpent);
  const isBudgetStatusOver = budget > 0 && totalSpent > budget;
  const budgetStatusExceededAmount = roundMoneyAmount(Math.max(0, totalSpent - budget));
  const budgetStatusOverLabel = formatTranslation(lang, 'overBudgetExceededBy', {
    amount: formatMoney(budgetStatusExceededAmount),
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
        .filter((env) => !env.isGeneral && env.allocated > 0)
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
  const activeSubOverLabel =
    activeSubChart && activeSubChart.isOverBudget
      ? formatTranslation(lang, 'overBudgetExceededBy', { amount: formatMoney(activeSubChart.exceededAmount) })
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

  const handleAdd = () => {
    const parsed = parseMoneyInput(amount);
    if (!name.trim() || parsed === null || !(parsed > 0)) return;

    const resolveIlsAmount = async (): Promise<number | null> => {
      if (displayCurrency === 'ILS') return roundMoneyAmount(parsed);
      const rates = getCachedExchangeRates() ?? (await fetchExchangeRates().catch(() => null));
      if (!rates) return null;
      const converted = convertForeignToIls(parsed, displayCurrency, rates);
      return converted == null ? null : roundMoneyAmount(converted);
    };

    void resolveIlsAmount().then((ilsAmount) => {
      if (ilsAmount == null || !(ilsAmount > 0)) return;
      onAddSubBudget(name, ilsAmount, newSubBudgetColor);
      setName('');
      setAmount('');
      setNewSubBudgetColor(DEFAULT_CATEGORY_COLOR);
    });
  };

  return (
    <div className={`${themeCardClass} p-4 sm:p-6 mb-6 sm:mb-8`}>
      <div className="mb-4">
        <h2 className={`text-base sm:text-lg font-semibold flex items-center gap-2 ${typographyTitleClass}`}>
          <PieChartIcon className="w-5 h-5 text-violet-400" />
          {tr('subBudgetsTitle')}
        </h2>
        <p className="text-sm text-neutral-500 mt-1">{tr('subBudgetsSubtitle')} • {monthLabel}</p>
      </div>

      {budget <= 0 ? (
        <div className="text-center py-8">
          <div className="bg-neutral-800 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
            <Wallet className="w-7 h-7 text-neutral-500" />
          </div>
          <p className={typographyBodyClass}>{tr('setMonthlyBudgetFirst')}</p>
          <p className="text-neutral-500 text-sm mt-1">{tr('thenSplitSubBudgets')}</p>
        </div>
      ) : (
        <>
          {/* Main budget chart: used vs remaining */}
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
                    <DisplayMoney amount={usedOverviewAmount} className={`text-xl font-bold ${typographyTitleClass}`} />
                    <span className="mt-1 text-[11px] text-neutral-500">
                      <LtrNumeric>{tr('outOf')} {formatMoney(budget)}</LtrNumeric>
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
                      {tr('spentLabel')}: <DisplayMoney amount={totalSpent} className="inline-block" />
                    </p>
                    <p className="text-xs text-neutral-400">
                      {tr('remainingLabel')}: <DisplayMoney amount={remainingOverviewAmount} className="inline-block" />
                    </p>
                    <p className="text-xs text-neutral-500">
                      {tr('totalBudgetLabel')}: <DisplayMoney amount={budget} className="inline-block" />
                    </p>
                    <p className={`text-xs ${isBudgetStatusOver ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {tr('spentLabel')}{' '}
                      {budget > 0 ? `${((totalSpent / budget) * 100).toFixed(0)}%` : '0%'}
                    </p>
                    <p className="text-xs text-emerald-200">
                      {tr('remainingLabel')}{' '}
                      {budget > 0 ? `${((remainingOverviewAmount / budget) * 100).toFixed(0)}%` : '0%'}
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

          {/* Sub-category action buttons + animated per-category chart carousel */}
          <div className="mt-6 space-y-4">
            {subCategoryCharts.length === 0 ? (
              <p className="text-center text-sm text-neutral-500">{tr('startByAddingSubBudget')}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {subCategoryCharts.map((env, index) => {
                    const Icon = env.icon;
                    const isActive = index === subChartSlide;
                    return (
                      <button
                        key={`sub-btn-${env.key}`}
                        type="button"
                        onClick={() => goToSubChartSlide(index)}
                        className={`flex min-h-[3rem] w-full items-center justify-center gap-2 overflow-hidden rounded-xl border p-2 text-center transition-all ${
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

                <div className={`relative w-full overflow-hidden p-3 pb-14 sm:p-4 sm:pb-16 ${subCardClass}`}>
                  {subCategoryCharts[subChartSlide] && (
                    <button
                      type="button"
                      onClick={() => onRemoveSubBudget(subCategoryCharts[subChartSlide].key)}
                      className="absolute bottom-3 right-3 z-30 inline-flex max-w-[calc(100%-1.5rem)] items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-300 transition-colors hover:bg-rose-500/20 sm:bottom-4 sm:right-4"
                      title={tr('removeSubBudget')}
                      aria-label={tr('removeSubBudget')}
                    >
                      <span className="truncate">{tr('removeSubBudget')}</span>
                    </button>
                  )}
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
                          // left swipe (-x) = forward to next; right swipe (+x) = back to previous
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
                                  data={[
                                    {
                                      id: 'spent',
                                      value: Math.max(activeSubChart.spentAmount, 0),
                                      fill: activeSubChart.hex,
                                    },
                                    {
                                      id: 'remaining',
                                      value: Math.max(activeSubChart.remainingAmount, 0),
                                      fill: remainingFill(activeSubChart.hex),
                                    },
                                  ].filter((item) => item.value > 0)}
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
                                  <Cell fill={activeSubChart.hex} />
                                  <Cell fill={remainingFill(activeSubChart.hex)} />
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
                                {tr('spentLabel')}: <DisplayMoney amount={activeSubChart.spent} className="inline-block" />
                              </p>
                              <p className="text-xs text-neutral-400">
                                {tr('remainingLabel')}: <DisplayMoney amount={activeSubChart.remainingAmount} className="inline-block" />
                              </p>
                              <p className="text-xs text-neutral-500">
                                {tr('totalBudgetLabel')}: <DisplayMoney amount={activeSubChart.allocated} className="inline-block" />
                              </p>
                              <p className={`text-xs ${activeSubChart.isOverBudget ? 'text-rose-300' : 'text-emerald-300'}`}>
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
              </>
            )}
          </div>

          {/* Management: add / edit sub-budgets */}
          <div className="mt-6 pt-5 border-t border-neutral-800">
            <p className="text-xs font-medium text-neutral-400 mb-2">{tr('addOrUpdateSubBudget')}</p>
            <datalist id="subbudget-categories">
              {categories.map((c) => (
                <option key={c.value} value={c.label} />
              ))}
            </datalist>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                list="subbudget-categories"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr('addSubBudgetPlaceholder')}
                className={`flex-1 min-w-0 px-3 py-2.5 text-sm ${surfaceInputSmClass}`}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(sanitizeMoneyInputDraft(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  placeholder={subBudgetAmountPlaceholder}
                  className={`w-28 sm:w-32 px-3 py-2.5 text-sm ${surfaceInputSmClass}`}
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  className={`shrink-0 px-4 py-2.5 rounded-lg text-sm flex items-center justify-center gap-1 ${primaryActionButtonClass}`}
                >
                  <Plus className="w-4 h-4" />
                  {tr('add')}
                </button>
              </div>
            </div>

            <div className="mt-4">
              <CategoryColorPicker
                value={newSubBudgetColor}
                onChange={setNewSubBudgetColor}
                label={tr('newCategoryColor')}
              />
              <p className="text-[11px] text-neutral-500 mt-2">
                {tr('categoryColorHint')}
              </p>
            </div>

            {/* Quick-edit allocations for existing sub-budgets */}
            {budgetedValues.length > 0 && (
              <div className="mt-3 space-y-2">
                {budgetedValues.map((v) => {
                  const cat = categories.find((c) => c.value === v);
                  const catHex = hexForColor(cat?.color ?? 'bg-gray-500');
                  return (
                    <div key={v} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/20"
                        style={{ backgroundColor: catHex }}
                      />
                      <span className={`text-sm flex-1 truncate ${typographyLabelClass}`}>
                        {v === GENERAL_KEY ? (
                          tr('generalUnallocated')
                        ) : (
                          <LocalizedUserText text={v} />
                        )}
                      </span>
                      <LtrNumeric className="text-neutral-500 text-sm">
                        {currencySymbol(displayCurrency)}
                      </LtrNumeric>
                      <MoneyAmountInput
                        value={subBudgets[v] ?? 0}
                        displayCurrency={displayCurrency}
                        onCommit={(amount) => {
                          if (amount === null || amount <= 0) onRemoveSubBudget(v);
                          else onSetSubBudget(v, amount);
                        }}
                        className={`w-24 text-left ${surfaceInputSmClass}`}
                      />
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <LtrNumeric className="text-neutral-500">
                    {tr('allocated')}:{' '}
                    <DisplayMoney amount={allocatedTotal} className="inline-block" /> /{' '}
                    <DisplayMoney amount={budget} className="inline-block" />
                  </LtrNumeric>
                  <LtrNumeric
                    className={
                      allocatedTotal > budget ? 'text-rose-400 font-medium' : 'text-neutral-500'
                    }
                  >
                    {allocatedTotal > budget ? (
                      <>
                        {tr('overBudget')}:{' '}
                        <DisplayMoney
                          amount={allocatedTotal - budget}
                          className="inline-block font-medium"
                        />
                      </>
                    ) : (
                      <>
                        {tr('unallocated')}:{' '}
                        <DisplayMoney amount={generalAllocated} className="inline-block" />
                      </>
                    )}
                  </LtrNumeric>
                </div>
              </div>
            )}
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
            className="shrink-0 -mt-1 -ml-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 p-2 rounded-lg transition-all"
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

/** Mobile: anchor inward per column; md+: centered dropdown (desktop layout). */
function financialSummaryCurrencyMenuPositionClass(
  anchor: FinancialSummaryCurrencyAnchor,
): string {
  switch (anchor) {
    case 'budget':
      return 'start-0 end-auto origin-top-start translate-x-0 md:start-auto md:end-auto md:left-1/2 md:origin-top md:-translate-x-1/2';
    case 'status':
      return 'end-0 start-auto origin-top-end translate-x-0 md:start-auto md:end-auto md:left-1/2 md:origin-top md:-translate-x-1/2';
    default:
      return 'left-1/2 origin-top -translate-x-1/2';
  }
}

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

function useMobileFinancialCurrencyMenu(): boolean {
  const [mobile, setMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return mobile;
}

const financialSummaryCurrencyMenuScrollClass =
  'overflow-y-auto overscroll-contain touch-pan-y scroll-smooth [-webkit-overflow-scrolling:touch]';

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
  const isMobileMenu = useMobileFinancialCurrencyMenu();
  const symbolButtonRef = useRef<HTMLButtonElement>(null);
  const [mobileMenuLayout, setMobileMenuLayout] = useState<FinancialCurrencyMenuLayout | null>(null);

  useLayoutEffect(() => {
    if (!isOpen || !isMobileMenu) {
      setMobileMenuLayout(null);
      return;
    }

    const updateLayout = () => {
      const trigger = symbolButtonRef.current;
      if (!trigger) return;
      setMobileMenuLayout(computeFinancialCurrencyMenuLayout(trigger, menuAnchor, dir));
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
  }, [isOpen, isMobileMenu, menuAnchor, dir]);

  const menuPanel = (
    <DisplayCurrencyInlineMenu onSelected={onCurrencyPicked} className="py-2" />
  );

  return (
    <div
      ref={isOpen ? menuContainerRef : undefined}
      className="relative inline-flex max-w-full items-center justify-center overflow-visible"
    >
      <LtrNumeric className="inline-flex max-w-full items-baseline justify-center gap-0 truncate text-center text-sm font-bold leading-tight sm:text-base md:text-2xl">
        {parts.sign ? <span className={amountClassName}>{parts.sign}</span> : null}
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
        <span className={amountClassName}>{parts.amount}</span>
      </LtrNumeric>
      {isOpen && isMobileMenu && mobileMenuLayout
        ? createPortal(
            <div
              ref={menuPortalRef}
              className={`fixed z-[9999] px-1.5 ${financialSummaryCurrencyMenuScrollClass} ${filterDropdownWrapperClass}`}
              style={{
                top: mobileMenuLayout.top,
                left: mobileMenuLayout.left,
                width: mobileMenuLayout.width,
                maxHeight: mobileMenuLayout.maxHeight,
              }}
            >
              {menuPanel}
            </div>,
            document.body,
          )
        : null}
      {isOpen && !isMobileMenu ? (
        <div
          className={`absolute top-full z-50 mt-1.5 w-[min(calc(100vw-1rem),18rem)] max-h-80 px-1.5 ${financialSummaryCurrencyMenuScrollClass} ${financialSummaryCurrencyMenuPositionClass(menuAnchor)} ${filterDropdownWrapperClass}`}
        >
          {menuPanel}
        </div>
      ) : null}
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
  const [user, setUser] = useState<User | null>(null);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [settingsCloudReady, setSettingsCloudReady] = useState(false);
  const suppressCloudSaveRef = useRef(true);
  const locallyEditedSubBudgetMonthsRef = useRef<Set<string>>(new Set());
  const skipNextSettingsSaveRef = useRef(false);
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
  } | null>(null);
  const [editExpenseRatesReady, setEditExpenseRatesReady] = useState(true);
  const [recentlyUpdatedExpenseId, setRecentlyUpdatedExpenseId] = useState<string | null>(null);
  const [expenseRatesReady, setExpenseRatesReady] = useState(true);
  const [showBudgetSaved, setShowBudgetSaved] = useState(false);
  const [autoTransferByMonth, setAutoTransferByMonth] = useState<Record<string, boolean>>({});

  // Active top-level navigation tab.
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsInitialCurrencySections, setSettingsInitialCurrencySections] = useState<
    ('display' | 'exchange' | 'manual-rate' | 'commissions')[] | null
  >(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const settingsReturnTabRef = useRef<TabId>('dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const chartDateSetterRef = useRef<((iso: string) => void) | null>(null);
  const isScrollRoute = profileOpen || settingsOpen;

  // Keep new-expense currency aligned with global display currency (Financial Summary shortcuts, Settings, etc.).
  useEffect(() => {
    setNewExpense((prev) =>
      prev.currency === displayCurrency ? prev : { ...prev, currency: displayCurrency as ExpenseCurrency },
    );
  }, [displayCurrency]);

  const handleTabSelect = (id: TabId) => {
    setActiveTab(id);
    setNavOpen(false);
    setSettingsOpen(false);
    setSettingsInitialCurrencySections(null);
    setProfileOpen(false);
  };

  const openSettings = () => {
    settingsReturnTabRef.current = activeTab;
    setNavOpen(false);
    setProfileOpen(false);
    setSettingsInitialCurrencySections(null);
    setSettingsOpen(true);
  };

  const openSettingsExchangeRates = useCallback(() => {
    settingsReturnTabRef.current = activeTab;
    setNavOpen(false);
    setProfileOpen(false);
    setSettingsInitialCurrencySections(['exchange']);
    setSettingsOpen(true);
  }, [activeTab]);

  const openSettingsManualRate = useCallback(() => {
    settingsReturnTabRef.current = activeTab;
    setNavOpen(false);
    setProfileOpen(false);
    setSettingsInitialCurrencySections(['manual-rate']);
    setSettingsOpen(true);
  }, [activeTab]);

  const openSettingsCommissions = useCallback(() => {
    settingsReturnTabRef.current = activeTab;
    setNavOpen(false);
    setProfileOpen(false);
    setSettingsInitialCurrencySections(['commissions']);
    setSettingsOpen(true);
  }, [activeTab]);

  const openProfile = () => {
    setNavOpen(false);
    setSettingsOpen(false);
    setProfileOpen(true);
  };

  const handleQuickLanguageToggle = () => {
    const nextLang = lang === 'he' ? 'en' : 'he';
    // Keep parity with SettingsPage language switch flow.
    writePreferredLanguage(nextLang);
    setLang(nextLang);
  };

  const closeProfile = () => {
    setProfileOpen(false);
  };

  const closeSettings = () => {
    setSettingsOpen(false);
    setSettingsInitialCurrencySections(null);
    setActiveTab(settingsReturnTabRef.current);
  };

  const handleLogout = async () => {
    try {
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
      setActiveTab('dashboard');
      setProfileOpen(false);
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
  const [customCategories, setCustomCategories] = useState<
    { value: string; label: string; color: string; iconName: string }[]
  >([]);
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

  // The full list of selectable categories: built-ins + user-created.
  const allCategories: Category[] = [
    ...CATEGORIES.map((c) => ({ ...c, label: localizeCategoryLabel(c.value, lang) })),
    ...customCategories.map((c) => ({
      value: c.value,
      label: getUserContent(c.label),
      color: c.color,
      icon: resolveIcon(c.iconName),
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
  const budgetInputLength = useMemo(() => budgetInput.trim().length, [budgetInput]);
  const budgetInputFlexGrow = useMemo(() => {
    if (budgetInputLength <= 4) return 1;
    return Math.min(2.8, 1 + (budgetInputLength - 4) * 0.22);
  }, [budgetInputLength]);
  const budgetInputVisibleLength = useMemo(() => {
    const typedLen = budgetInput.trim().length;
    if (typedLen > 0) return typedLen;
    if (budget > 0) return `${tr('currentAmountPrefix')}: ${selectedBudgetDisplayLabel}`.length;
    return tr('enterAmount').length;
  }, [budgetInput, budget, tr, selectedBudgetDisplayLabel]);
  const budgetInputTextClass = useMemo(() => {
    if (budgetInputVisibleLength <= 8) return 'text-sm';
    if (budgetInputVisibleLength <= 12) return 'text-xs';
    return 'text-[11px]';
  }, [budgetInputVisibleLength]);
  const updateBudgetLabel = tr('updateBudget');
  const budgetSavedLabel = tr('budgetSaved');
  const subBudgetsButtonLabel = tr('tabSubbudgets');
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

  const patchSubBudgetsByMonth = useCallback(
    (
      monthKey: string,
      patch: (monthMap: Record<string, number>) => Record<string, number>,
    ) => {
      locallyEditedSubBudgetMonthsRef.current.add(monthKey);
      setSubBudgetsByMonth((prev) => {
        const currentMonth = prev[monthKey] ?? {};
        const patchedMonth = patch(currentMonth);
        const next = { ...prev, [monthKey]: patchedMonth };
        if (dataReady && user?.isAnonymous) {
          saveToLocalStorage({
            expenses,
            customCategories,
            budgetsByMonth,
            budgetOriginalByMonth,
            autoTransferByMonth,
            subBudgetsByMonth: next,
          });
        }
        return next;
      });
    },
    [budgetsByMonth, budgetOriginalByMonth, autoTransferByMonth, customCategories, dataReady, expenses, user],
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

  // Automatic month inheritance:
  // When user navigates to a month with no explicit values yet, copy budget +
  // sub-budgets from the nearest prior month that has data.
  useEffect(() => {
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
      }
    }
  }, [selectedMonthKey, subBudgetsByMonth]);

  const applyAppData = (data: typeof EMPTY_USER_APP_DATA) => {
    setExpenses(data.expenses.map((e) => ({ ...e, date: normalizeDate(e.date) })));
    setCustomCategories(data.customCategories);
    setBudgetsByMonth(data.budgetsByMonth);
    setBudgetOriginalByMonth(
      (data.budgetOriginalByMonth as Record<string, { amount: number; currency: ExpenseCurrency }> | undefined) ??
        {},
    );
    setAutoTransferByMonth(data.autoTransferByMonth ?? {});
    setSubBudgetsByMonth(data.subBudgetsByMonth);
  };

  const resetAppData = () => {
    locallyEditedSubBudgetMonthsRef.current.clear();
    setExpenses([]);
    setCustomCategories([]);
    setBudgetsByMonth({});
    setBudgetOriginalByMonth({});
    setAutoTransferByMonth({});
    setSubBudgetsByMonth({});
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
    let unsubExpenses: (() => void) | undefined;
    let unsubCategories: (() => void) | undefined;
    let unsubSettings: (() => void) | undefined;
    let unsubManualOverrides: (() => void) | undefined;
    let unsubCurrencyCommissions: (() => void) | undefined;
    let initialExpenses = false;
    let initialCategories = false;
    let initialSettings = false;

    const markReadyIfComplete = () => {
      if (cancelled) return;
      if (initialExpenses && initialCategories && initialSettings) {
        suppressCloudSaveRef.current = true;
        setDataReady(true);
      }
    };

    const initUserData = async () => {
      suppressCloudSaveRef.current = true;

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
        rehydrateIsolatedGuestSession(applySettingsFromCloud);
        setDataReady(true);
        return;
      }

      hadAuthenticatedUserRef.current = !user.isAnonymous;
      setDataReady(false);
      setSettingsCloudReady(false);

      if (user.isAnonymous) {
        setGuestLangActive(true);
        setSettingsPersistence('local');
        void listActiveCurrencyCommissions();
        void listActiveManualExchangeOverrides();
        clearCloudManualExchangeOverrides();
        clearCloudCurrencyCommissions();
        const guestLang = readGuestLang();
        if (guestLang) {
          setLang(guestLang, { persist: false });
        }
        applyAppData(loadFromLocalStorage());
        setDataReady(true);
        return;
      }

      setGuestLangActive(false);
      pendingAuthLangRef.current = consumePendingAuthLang();
      setSettingsPersistence('cloud');
      skipNextSettingsSaveRef.current = true;
      applyIsolatedCloudSessionSeed(applySettingsFromCloud);
      const uid = user.uid;

      try {
        await pruneExpiredCloudExchangeFees(uid);
        if (cancelled) return;
        await ensureCloudDataMigrated(uid);
        if (cancelled) return;

        unsubExpenses = subscribeExpenses(
          uid,
          (items, meta) => {
            if (cancelled || meta.hasPendingWrites) return;
            setExpenses((prev) => {
              const normalized = items.map((e) => ({ ...e, date: normalizeDate(e.date) }));
              if (JSON.stringify(prev) === JSON.stringify(normalized)) return prev;
              return normalized;
            });
            if (!initialExpenses) {
              initialExpenses = true;
              markReadyIfComplete();
            }
          },
          () => {
            if (!cancelled) {
              setExpenses([]);
              if (!initialExpenses) {
                initialExpenses = true;
                markReadyIfComplete();
              }
            }
          },
        );

        unsubCategories = subscribeCategories(
          uid,
          (data, meta) => {
            if (cancelled || meta.hasPendingWrites) return;
            setCustomCategories((prev) =>
              JSON.stringify(prev) === JSON.stringify(data.customCategories)
                ? prev
                : data.customCategories,
            );
            setBudgetsByMonth((prev) =>
              JSON.stringify(prev) === JSON.stringify(data.budgetsByMonth)
                ? prev
                : data.budgetsByMonth,
            );
            setBudgetOriginalByMonth((prev) =>
              JSON.stringify(prev) === JSON.stringify(data.budgetOriginalByMonth)
                ? prev
                : (data.budgetOriginalByMonth as Record<string, { amount: number; currency: ExpenseCurrency }>),
            );
            setAutoTransferByMonth((prev) =>
              JSON.stringify(prev) === JSON.stringify(data.autoTransferByMonth)
                ? prev
                : data.autoTransferByMonth,
            );
            setSubBudgetsByMonth((prev) => {
              const merged = mergeRemoteSubBudgetsByMonth(
                prev,
                data.subBudgetsByMonth,
                locallyEditedSubBudgetMonthsRef.current,
              );
              return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
            });
            if (!initialCategories) {
              initialCategories = true;
              markReadyIfComplete();
            }
          },
          () => {
            if (!cancelled) {
              setCustomCategories([]);
              setBudgetsByMonth({});
              setBudgetOriginalByMonth({});
              setAutoTransferByMonth({});
              setSubBudgetsByMonth({});
              if (!initialCategories) {
                initialCategories = true;
                markReadyIfComplete();
              }
            }
          },
        );

        unsubSettings = subscribeSettings(
          uid,
          (settings, meta) => {
            if (cancelled || meta.hasPendingWrites) return;
            const pendingLang = pendingAuthLangRef.current;
            if (pendingLang) {
              pendingAuthLangRef.current = null;
              skipNextSettingsSaveRef.current = true;
              if (meta.exists) {
                applySettingsFromCloud({ ...settings, lang: pendingLang });
              } else {
                applySettingsFromCloud({ ...EMPTY_USER_SETTINGS, lang: pendingLang });
              }
            } else if (meta.exists) {
              skipNextSettingsSaveRef.current = true;
              applySettingsFromCloud(settings);
            } else {
              skipNextSettingsSaveRef.current = true;
              applySettingsFromCloud({ ...EMPTY_USER_SETTINGS });
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
      unsubExpenses?.();
      unsubCategories?.();
      unsubSettings?.();
      unsubManualOverrides?.();
      unsubCurrencyCommissions?.();
    };
  }, [user, authReady, applySettingsFromCloud, setSettingsPersistence, setLang]);

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

  // Persist financial changes: localStorage for guests, debounced Firestore for accounts.
  useEffect(() => {
    if (!dataReady || !user) return;

    const payload = {
      expenses,
      customCategories,
      budgetsByMonth,
      budgetOriginalByMonth,
      autoTransferByMonth,
      subBudgetsByMonth,
    };

    if (user.isAnonymous) {
      saveToLocalStorage(payload);
      return;
    }

    if (suppressCloudSaveRef.current) {
      suppressCloudSaveRef.current = false;
      return;
    }

    const uid = user.uid;
    const timer = window.setTimeout(() => {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== uid || currentUser.isAnonymous) return;
      void Promise.all([
        saveExpensesToCloud(uid, expenses),
        saveCategoriesToCloud(uid, {
          customCategories,
          budgetsByMonth,
          budgetOriginalByMonth,
          autoTransferByMonth,
          subBudgetsByMonth,
        }),
      ]).catch(() => {
        // Non-blocking; next edit will retry.
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    expenses,
    customCategories,
    budgetsByMonth,
    budgetOriginalByMonth,
    autoTransferByMonth,
    subBudgetsByMonth,
    dataReady,
    user,
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
      const converted = convertForeignToIls(inputAmount, displayCurrency, rates);
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
    setBudgetsByMonth((prev) => ({ ...prev, [selectedMonthKey]: roundMoneyAmount(amount) }));
    setBudgetOriginalByMonth((prev) => ({
      ...prev,
      [selectedMonthKey]: { ...original, amount: roundMoneyAmount(original.amount) },
    }));

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

    const resolveIlsAmount = async (): Promise<number | null> => {
      if (inputCurrency === 'ILS') return roundMoneyAmount(enteredAmount);

      const rates = getCachedExchangeRates() ?? (await fetchExchangeRates().catch(() => null));
      if (!rates) return null;

      const converted = convertExpenseAmountToIls(enteredAmount, inputCurrency, rates, {
        displayCurrency,
      });
      if (converted == null) return null;

      return roundMoneyAmount(converted);
    };

    void resolveIlsAmount().then((ilsAmount) => {
      if (ilsAmount == null || !(ilsAmount > 0)) return;

      const isoDate = normalizeDate(newExpense.date);
      const expense: Expense = {
        id: Date.now().toString(),
        description: newExpense.description.trim(),
        amount: ilsAmount,
        category: newExpense.category,
        date: isoDate,
        originalAmount: roundMoneyAmount(enteredAmount),
        originalCurrency: currencySymbol(inputCurrency),
      };

      setExpenses((prev) => [expense, ...prev]);
      setNewExpense((prev) => ({
        description: '',
        amount: '',
        currency: prev.currency,
        category: prev.category,
        date: toISODate(new Date()),
      }));
      setExpenseRatesReady(true);

      chartDateSetterRef.current?.(isoDate);

      const [y, m] = isoDate.split('-').map((n) => parseInt(n, 10));
      setSelectedDate(new Date(y, m - 1, 1));
    });
  };

  const expenseSubmitBlocked =
    displayCurrency !== 'ILS' && !expenseRatesReady;
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
        return (symbolToCurrency(expense.originalCurrency) ?? displayCurrency) as ExpenseCurrency;
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
    setEditExpenseDraft({
      description: expense.description,
      amount: String(editAmount),
      currency: editCurrency,
      category: expense.category,
      date: normalizeDate(expense.date),
    });
  };

  const handleEditExpenseCancel = () => {
    setEditingExpenseId(null);
    setEditExpenseDraft(null);
    setEditExpenseRatesReady(true);
  };

  const handleEditExpenseSave = () => {
    if (!editingExpenseId || !editExpenseDraft) return;

    const typedAmount = parseFloat(editExpenseDraft.amount);
    if (isNaN(typedAmount) || !(typedAmount > 0)) return;

    const resolveIlsAmount = async (): Promise<number | null> => {
      if (editExpenseDraft.currency === 'ILS') return roundMoneyAmount(typedAmount);
      const rates = getCachedExchangeRates() ?? (await fetchExchangeRates().catch(() => null));
      if (!rates) return null;
      const converted = convertExpenseAmountToIls(typedAmount, editExpenseDraft.currency, rates, {
        displayCurrency,
      });
      if (converted == null) return null;
      return roundMoneyAmount(converted);
    };

    void resolveIlsAmount().then((ilsAmount) => {
      if (ilsAmount == null || !(ilsAmount > 0)) return;

      const normalizedDate = normalizeDate(editExpenseDraft.date);
      const normalizedDescription = editExpenseDraft.description.trim();
      const roundedTypedAmount = roundMoneyAmount(typedAmount);

      setExpenses((prev) =>
        prev.map((expense) =>
          expense.id === editingExpenseId
            ? {
                ...expense,
                description: normalizedDescription,
                amount: ilsAmount,
                category: editExpenseDraft.category,
                date: normalizedDate,
                originalAmount: roundedTypedAmount,
                originalCurrency: currencySymbol(editExpenseDraft.currency),
              }
            : expense,
        ),
      );

      setRecentlyUpdatedExpenseId(editingExpenseId);
      window.setTimeout(() => {
        setRecentlyUpdatedExpenseId((current) => (current === editingExpenseId ? null : current));
      }, 1800);

      setEditingExpenseId(null);
      setEditExpenseDraft(null);
      setEditExpenseRatesReady(true);
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

  // Sub-budget handlers ------------------------------------------------------
  // Adds/updates a sub-budget. If the category doesn't exist yet, it's created
  // on the fly (matching by value or label, case-insensitive).
  const handleAddSubBudget = (rawName: string, amount: number, colorClass: string) => {
    const trimmed = rawName.trim();
    if (!trimmed || trimmed === ADD_CUSTOM_VALUE || !(amount > 0)) return;

    const chosenColor = isValidCategoryColor(colorClass) ? colorClass : DEFAULT_CATEGORY_COLOR;

    const existing = allCategories.find(
      (c) =>
        c.value.toLowerCase() === trimmed.toLowerCase() ||
        c.label.toLowerCase() === trimmed.toLowerCase()
    );

    let value = existing?.value;
    if (!value) {
      setCustomCategories((prev) => [
        ...prev,
        { value: trimmed, label: trimmed, color: chosenColor, iconName: ICON_OPTIONS[0].name },
      ]);
      value = trimmed;
    }

    const key = value as string;
    patchSubBudgetsByMonth(selectedMonthKey, (monthMap) =>
      markSubBudgetMonthInitialized({
        ...monthMap,
        [key]: roundMoneyAmount(amount),
      }),
    );
  };

  const handleSetSubBudget = (value: string, amount: number) => {
    if (!isSubBudgetCategoryKey(value)) return;
    patchSubBudgetsByMonth(selectedMonthKey, (monthMap) => {
      const next =
        amount > 0
          ? { ...monthMap, [value]: roundMoneyAmount(amount) }
          : withoutSubBudgetKey(monthMap, value);
      return markSubBudgetMonthInitialized(next);
    });
  };

  const handleRemoveSubBudget = (value: string) => {
    if (!isSubBudgetCategoryKey(value)) return;
    patchSubBudgetsByMonth(selectedMonthKey, (monthMap) => {
      if (!(value in monthMap)) return monthMap;
      return markSubBudgetMonthInitialized(withoutSubBudgetKey(monthMap, value));
    });
  };

  // Month navigation (selectedMonthKey is derived above with budget/subBudgets).
  const monthLabel = selectedDate.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'long', year: 'numeric' });
  const isCurrentMonth = selectedMonthKey === monthKeyOfDate(new Date());
  const syncCategoryChartDateForMonth = (monthDate: Date) => {
    chartDateSetterRef.current?.(chartDateIsoForMonth(monthDate));
  };

  const goToMonth = (offset: number) => {
    setSelectedDate((d) => {
      const next = new Date(d.getFullYear(), d.getMonth() + offset, 1);
      syncCategoryChartDateForMonth(next);
      return next;
    });
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), 1);
    syncCategoryChartDateForMonth(now);
    setSelectedDate(next);
  };

  // Expenses for the selected month only (filtered by ISO date).
  const monthExpenses = expenses.filter((e) => monthKeyOf(e.date) === selectedMonthKey);

  // Calculate total expenses (for the selected month)
  const totalExpenses = sumMoney(monthExpenses.map((expense) => expense.amount));
  const isOverBudget = totalExpenses > budget && budget > 0;
  const remaining = roundMoneyAmount(budget - totalExpenses);
  const statusRates = getCachedExchangeRates();
  const totalExpensesDisplayAmount = useMemo(() => {
    if (displayCurrency === 'ILS') return roundMoneyAmount(totalExpenses);
    const hasOriginalsForDisplayCurrency = monthExpenses.every((expense) => {
      if (!(expense.originalAmount != null && expense.originalAmount > 0 && expense.originalCurrency)) {
        return false;
      }
      const originalCode = symbolToCurrency(expense.originalCurrency);
      return originalCode === displayCurrency;
    });
    if (hasOriginalsForDisplayCurrency) {
      return sumMoney(monthExpenses.map((expense) => expense.originalAmount ?? 0));
    }
    if (!statusRates) return null;
    const convertedTotal = monthExpenses.reduce((sum, expense) => {
      const converted = convertIlsToForeign(expense.amount, displayCurrency, statusRates);
      return roundMoneyAmount(sum + (converted ?? 0));
    }, 0);
    return roundMoneyAmount(convertedTotal);
  }, [displayCurrency, monthExpenses, statusRates, totalExpenses]);
  const budgetStatusDisplayAmount = useMemo(() => {
    if (selectedBudgetSourceMonthKey) {
      const original = budgetOriginalByMonth[selectedBudgetSourceMonthKey];
      if (original && original.currency === displayCurrency) {
        return roundMoneyAmount(original.amount);
      }
    }
    if (displayCurrency === 'ILS') return roundMoneyAmount(budget);
    if (!statusRates) return null;
    const converted = convertIlsToForeign(budget, displayCurrency, statusRates);
    if (converted == null) return null;
    return roundMoneyAmount(converted);
  }, [
    selectedBudgetSourceMonthKey,
    budgetOriginalByMonth,
    displayCurrency,
    budget,
    statusRates,
  ]);
  const remainingDisplayAmount = useMemo(() => {
    if (budgetStatusDisplayAmount == null || totalExpensesDisplayAmount == null) return null;
    return roundMoneyAmount(budgetStatusDisplayAmount - totalExpensesDisplayAmount);
  }, [budgetStatusDisplayAmount, totalExpensesDisplayAmount]);
  const selectedBudgetDisplayParts = useMemo(() => {
    if (selectedBudgetSourceMonthKey) {
      const original = budgetOriginalByMonth[selectedBudgetSourceMonthKey];
      if (original && original.currency === displayCurrency) {
        return formatAmountParts(original.amount, displayCurrency);
      }
    }
    return formatMoneyPartsFromIls(budget, displayCurrency, statusRates);
  }, [
    selectedBudgetSourceMonthKey,
    budgetOriginalByMonth,
    displayCurrency,
    budget,
    statusRates,
  ]);
  const totalExpensesDisplayParts = useMemo(() => {
    if (totalExpensesDisplayAmount != null) {
      return formatAmountParts(totalExpensesDisplayAmount, displayCurrency);
    }
    return formatMoneyPartsFromIls(totalExpenses, displayCurrency, statusRates);
  }, [totalExpensesDisplayAmount, displayCurrency, totalExpenses, statusRates]);
  const remainingDisplayParts = useMemo(() => {
    if (remainingDisplayAmount != null) {
      return formatAmountParts(remainingDisplayAmount, displayCurrency);
    }
    return formatMoneyPartsFromIls(remaining, displayCurrency, statusRates);
  }, [remainingDisplayAmount, displayCurrency, remaining, statusRates]);
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

  const historyTotal = historyExpenses.reduce((s, e) => s + e.amount, 0);
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

  // Reusable month selector (used on Dashboard & Sub-Budgets pages).
  const monthSelector = (
    <div className={`${themeCardClass} p-3 sm:p-4 mb-6 sm:mb-8`}>
      <div dir="ltr" className="flex items-center justify-between gap-2">
        <button
          onClick={() => goToMonth(-1)}
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 active:scale-95 transition-all"
          aria-label={tr('prevMonth')}
          title={tr('prevMonth')}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center min-w-0">
          <div className="flex items-center gap-2 text-neutral-100">
            <CalendarDays className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-base sm:text-lg font-semibold capitalize truncate">
              {monthLabel}
            </span>
          </div>
          {!isCurrentMonth && (
            <button
              onClick={goToCurrentMonth}
              className="mt-0.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 active:opacity-70 transition-colors"
            >
              {tr('backToCurrentMonth')}
            </button>
          )}
        </div>

        <button
          onClick={() => goToMonth(1)}
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 active:scale-95 transition-all"
          aria-label={tr('nextMonth')}
          title={tr('nextMonth')}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
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

  const userDisplayLabel = user.isAnonymous ? tr('guest') : (user.email ?? '');
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
              onClick={() => handleTabSelect('dashboard')}
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
              <button
                type="button"
                onClick={handleQuickLanguageToggle}
                title={tr('authSwitchLanguage')}
                aria-label={tr('authSwitchLanguage')}
                className={`inline-flex h-10 w-10 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${utilityNavMenuToggleClass}`}
              >
                <Globe className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <UserProfileMenu
                avatarUrl={currentAvatarUrl}
                onOpenProfile={openProfile}
                onOpenSettings={openSettings}
                onLogout={handleLogout}
              />
              {!settingsOpen && (
                <CollapsibleNavMenu
                  variant="mobile"
                  activeTab={activeTab}
                  open={navOpen}
                  onOpenChange={setNavOpen}
                  onTabSelect={handleTabSelect}
                  userEmail={userDisplayLabel}
                  onLogout={handleLogout}
                />
              )}
              <CollapsibleNavMenu
                variant="desktop"
                activeTab={activeTab}
                open={navOpen}
                onOpenChange={setNavOpen}
                onTabSelect={handleTabSelect}
              />
            </div>
          </div>
        </div>
      </header>

      {!settingsOpen && navOpen && (
        <button
          type="button"
          aria-label={tr('closeMenu')}
          onClick={() => setNavOpen(false)}
          className="fixed top-[64px] inset-x-0 bottom-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 md:hidden"
        />
      )}

      <div className={isScrollRoute ? themeScrollRouteShellClass : 'relative flex min-h-0 flex-1 flex-col'}>
      <main
        className={[
          'relative z-0 mx-auto w-full max-w-5xl min-h-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8',
          isScrollRoute
            ? `${themeScrollViewportClass} ${themeScrollSafeContentClass}`
            : `${themeAntiClipVisibleClass} pb-24 md:pb-10`,
        ].join(' ')}
      >
        {profileOpen ? (
          <ProfilePage
            user={user}
            userName={userName}
            currentAvatarUrl={currentAvatarUrl}
            googleAvatarUrl={googleAvatarUrl}
            onBack={closeProfile}
            onSaveAvatar={handleSaveAvatar}
          />
        ) : settingsOpen ? (
          <SettingsPage
            onBack={closeSettings}
            recentExpenseCurrencies={recentExpenseCurrencies}
            initialCurrencySections={settingsInitialCurrencySections}
          />
        ) : (
          <>
        {/* ============================ DASHBOARD ============================ */}
        {activeTab === 'dashboard' && (
          <>
            {monthSelector}

            {/* Financial summary — row 2 uses a fixed height so all three amount cells share one baseline */}
            <div className={`mb-6 ${themeCardClass} p-4 shadow-sm sm:mb-8 sm:p-6`}>
              <h2 className={`mb-4 text-lg font-bold md:text-xl ${typographyTitleClass}`}>{tr('financialSummaryTitle')}</h2>
              <div className={`overflow-visible p-3 sm:p-4 ${filterInsetPanelClass}`}>
              <table className="w-full table-fixed border-collapse overflow-visible">
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
                    <td className="h-[4.5rem] min-h-[4.5rem] max-h-[4.5rem] overflow-visible border-x border-[var(--surface-input-border)] px-2 text-center align-middle">
                      <div className="flex h-full min-h-0 items-center justify-center overflow-visible">
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
                    <td className="h-[4.5rem] min-h-[4.5rem] max-h-[4.5rem] overflow-visible border-x border-[var(--surface-input-border)] px-2 text-center align-middle">
                      <div className="flex h-full min-h-0 items-center justify-center overflow-visible">
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
                    <td className="h-[4.5rem] min-h-[4.5rem] max-h-[4.5rem] overflow-visible border-x border-[var(--surface-input-border)] px-2 text-center align-middle">
                      <div className="flex h-full min-h-0 items-center justify-center overflow-visible">
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
            </div>

            {/* Monthly budget setter */}
            <div className={`mb-4 w-full ${themeCardClass} p-4 sm:mb-6 sm:p-6`}>
              <h2 className={`mb-4 flex items-center gap-2 text-base font-semibold sm:text-lg ${typographyTitleClass}`}>
                <Wallet className="h-5 w-5 shrink-0 text-emerald-400" />
                {tr('addMonthlyBudget')}
              </h2>
              <div className="w-full">
                <div className="min-w-0 w-full">
                  <label className={`mb-2 block text-sm font-medium ${typographyLabelClass}`}>
                    {tr('budgetAmountLabel')} ({currencySymbol(displayCurrency)})
                  </label>
                  <div className="flex w-full items-center gap-1.5 overflow-hidden sm:gap-2">
                    <div
                      className="min-w-0 basis-0 transition-all duration-200 ease-in-out"
                      style={{ flexGrow: budgetInputFlexGrow }}
                    >
                      <input
                        type="text"
                        inputMode="decimal"
                        value={budgetInput}
                        onChange={(e) => setBudgetInput(sanitizeMoneyInputDraft(e.target.value))}
                        placeholder={
                          budget > 0
                            ? `${tr('currentAmountPrefix')}: ${selectedBudgetDisplayLabel}`
                            : tr('enterAmount')
                        }
                        className={`h-10 w-full min-w-0 px-2 py-1.5 sm:h-12 sm:px-4 sm:py-3 sm:text-lg ${budgetInputTextClass} ${surfaceInputClass}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSetBudget}
                      className={`flex h-10 min-w-[40px] basis-0 flex-1 shrink flex-col items-center justify-center gap-0.5 overflow-hidden p-2 text-center sm:h-12 sm:min-w-[88px] ${primaryActionButtonClass}`}
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
                    <button
                      type="button"
                      onClick={() => handleTabSelect('subbudgets')}
                      className={`flex h-10 min-w-[40px] basis-0 flex-1 shrink flex-col items-center justify-center gap-0.5 overflow-hidden p-2 text-center sm:h-12 sm:min-w-[88px] ${utilityNavButtonLgClass}`}
                    >
                      {renderBudgetButtonText(subBudgetsButtonLabel)}
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
                    <div
                      dir={dir}
                      className="flex w-full flex-row flex-nowrap gap-2 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch] no-scrollbar sm:pb-0"
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
            {/* Row 1: Description + Amount */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
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

              <ExpenseAmountField
                amount={newExpense.amount}
                currency={newExpense.currency}
                onAmountChange={(amount) => setNewExpense({ ...newExpense, amount })}
                onCurrencyChange={(currency) => setNewExpense({ ...newExpense, currency })}
                onRatesReadyChange={setExpenseRatesReady}
                onOpenExchangeRatesSettings={openSettingsExchangeRates}
              />
            </div>

            {/* Row 2: Category + Date + Submit */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
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

            {/* Spending by category (daily) */}
            <DashboardCategoryChart
              expenses={expenses}
              categories={allCategories}
              chartDateSetterRef={chartDateSetterRef}
              initialChartDateIso={chartDateIsoForMonth(selectedDate)}
              isCurrentCalendarMonth={isCurrentMonth}
              onNavigateToAnalytics={() => handleTabSelect('analytics')}
              onNavigateToExpenses={() => handleTabSelect('expenses')}
            />
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
              subBudgets={subBudgets}
              onAddSubBudget={handleAddSubBudget}
              onSetSubBudget={handleSetSubBudget}
              onRemoveSubBudget={handleRemoveSubBudget}
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
              <DisplayMoney amount={historyTotal} className="inline-block font-medium" />
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
              <div className="bg-neutral-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingDown className="w-8 h-8 text-neutral-500" />
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
                className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300"
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

              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
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
                />
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

      {/* Footer (desktop only; mobile uses the bottom nav) */}
      {!settingsOpen && (
      <footer className={themeFooterClass}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-neutral-500">
            {tr('appName')} - {tr('appTagline')}
          </p>
        </div>
      </footer>
      )}

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
