import { useState, useEffect, useMemo, useRef, useCallback, type MutableRefObject } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import {
  Wallet,
  TrendingDown,
  AlertTriangle,
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
  RotateCcw,
  Layers,
  ChevronUp,
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
import CategoryColorPicker from './components/CategoryColorPicker';
import CreateCategoryForm from './components/CreateCategoryForm';
import CategoryIconBadge from './components/CategoryIconBadge';
import CategoryBreakdownLegend from './components/CategoryBreakdownLegend';
import SubBudgetProgressBar from './components/SubBudgetProgressBar';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signOutUser } from './firebase';
import AuthPage from './components/AuthPage';
import UserProfileMenu from './components/UserProfileMenu';
import SettingsPage from './components/SettingsPage';
import ExpenseAmountField from './components/ExpenseAmountField';
import SelectedDaySummary from './components/SelectedDaySummary';
import ExpenseAmountDisplay from './components/ExpenseAmountDisplay';
import DisplayMoney from './components/DisplayMoney';
import CategoryColorChip from './components/CategoryColorChip';
import { LocalizedUserText, LtrNumeric, useLanguage } from './LanguageContext';
import { localizeCategoryLabel } from './translations';
import { symbolToCurrency } from './services/displayCurrencyUtils';
import {
  clearCloudCurrencyCommissions,
  replaceCloudCurrencyCommissions,
} from './services/currencyCommissionService';
import { convertExpenseAmountToIls } from './services/expenseConversionService';
import {
  clearCloudManualExchangeOverrides,
  replaceCloudManualExchangeOverrides,
} from './services/manualExchangeOverrideService';
import {
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
} from './services/authLanguagePreference';
import {
  ensureCloudDataMigrated,
  saveCategoriesToCloud,
  saveExpensesToCloud,
  saveSettingsToCloud,
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
} from 'recharts';

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

const findNearestPriorMonthWithData = (
  targetMonthKey: string,
  budgetsByMonth: Record<string, number>,
  subBudgetsByMonth: Record<string, Record<string, number>>
): string | null => {
  const targetOrder = monthOrder(targetMonthKey);
  const keys = new Set<string>([
    ...Object.keys(budgetsByMonth),
    ...Object.keys(subBudgetsByMonth),
  ]);

  const candidates = Array.from(keys).filter((key) => monthOrder(key) < targetOrder);
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => monthOrder(b) - monthOrder(a));
  return candidates[0] ?? null;
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
const spentFill = (hex: string) => hex;
const remainingFill = (hex: string) => mixHex(hex, '#ffffff', 0.42);

// Bright warning color for overspent envelopes.
const WARNING_COLOR = '#ef4444';

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
const ANALYTICS_CHART_HEIGHT = 320;
const ANALYTICS_DONUT_SIZE = 192;
const ANALYTICS_LINE_HEIGHT = 240;
const GENERAL_KEY = '__general__';

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

// Space-saving collapsible nav: FAB on mobile, compact toggle in header on desktop.
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

  const backdrop = (
    <button
      type="button"
      aria-label={tr('closeMenu')}
      onClick={() => onOpenChange(false)}
      className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-all duration-300 ease-in-out ${
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      } ${variant === 'desktop' ? 'hidden md:block' : 'md:hidden'}`}
    />
  );

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
            ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-emerald-400/40 shadow-lg shadow-emerald-500/25'
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
          <Icon className={`${variant === 'mobile' ? 'w-5 h-5' : 'w-4 h-4'} ${isActive ? 'text-white' : 'text-emerald-400'}`} />
        </span>
        <span className={`flex-1 truncate ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{tabLabel(tab.id)}</span>
      </button>
    );
  };

  if (variant === 'mobile') {
    return (
      <>
        {backdrop}
        {/* FAB-only footprint when closed — avoids a full-width invisible hit layer over the form */}
        <div
          className="md:hidden fixed bottom-0 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          {open && (
            <div
              className="mb-3 flex w-[min(100vw-2rem,20rem)] flex-col gap-2 px-4 transition-all duration-300 ease-in-out opacity-100 translate-y-0"
              role="menu"
            >
              {userEmail && (
                <p
                  className="text-center text-xs text-slate-500 truncate px-2 py-1 border-b border-slate-800/80 mb-1"
                  title={userEmail}
                >
                  {userEmail}
                </p>
              )}
              {[...TABS].reverse().map((tab, i) => tabButton(tab, TABS.length - 1 - i))}
              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    onLogout();
                    onOpenChange(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-3.5 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm font-medium hover:bg-rose-500/20 transition-all active:scale-[0.98]"
                >
                  <LogOut className="w-5 h-5 shrink-0" />
                  <span className={`flex-1 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{tr('logout')}</span>
                </button>
              )}
            </div>
          )}

          {/* Collapsed / active FAB pill */}
          <button
            type="button"
            onClick={toggleOpen}
            aria-expanded={open}
            aria-haspopup="menu"
            className={`flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-slate-900 border shadow-2xl shadow-black/50 transition-all duration-300 ease-in-out active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
              open
                ? 'border-emerald-500/50 shadow-emerald-500/20'
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
              <ActiveIcon className="w-5 h-5 text-white" />
            </span>
            <span className="text-sm font-semibold text-slate-100 max-w-[8rem] truncate">{tabLabel(active.id)}</span>
            <ChevronUp
              className={`w-5 h-5 text-slate-400 transition-transform duration-300 ease-in-out ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      </>
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
          className={`flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900 border text-sm font-medium transition-all duration-300 ease-in-out outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
            open
              ? 'border-emerald-500/50 shadow-lg shadow-emerald-500/15'
              : 'border-slate-700 hover:border-slate-600 hover:bg-slate-800/80'
          }`}
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
            <ActiveIcon className="w-4 h-4 text-white" />
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
          <span className="text-[11px] text-neutral-500 mt-1">{tr('totalShort')}</span>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {legend.length === 0 ? (
          <p className="text-sm text-neutral-500">{tr('noData')}</p>
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
              <span className="text-neutral-300 truncate flex-1">{item.label}</span>
              <span className="text-neutral-400 font-medium shrink-0 tabular-nums">
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
  for (let m = 0; m < 12; m++) {
    const iso = `${y}-${pad2(m + 1)}-01`;
    const monthKey = `${y}-${pad2(m + 1)}`;
    const amount = Object.entries(amountByDate).reduce((sum, [date, amt]) => {
      return date.startsWith(monthKey) ? sum + amt : sum;
    }, 0);
    points.push({
      iso,
      day: m + 1,
      dayLabel: new Date(y, m, 1).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'short' }),
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

// Dark-themed analytics: swipeable category / daily donuts + daily trend line.
function ExpenseSummary({ expenses, categories }: ExpenseSummaryProps) {
  const { tr, lang } = useLanguage();
  const [view, setView] = useState<SummaryView>('month');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [chartSlide, setChartSlide] = useState(0);
  const [selectedTrendIso, setSelectedTrendIso] = useState<string | null>(null);

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

  const { dailySeries, periodDayCount } = useMemo(() => {
    const amountByDate = periodExpenses.reduce<Record<string, number>>((acc, e) => {
      const iso = normalizeDate(e.date);
      acc[iso] = (acc[iso] || 0) + e.amount;
      return acc;
    }, {});
    return buildContinuousTrendSeries(view, anchor, amountByDate, lang);
  }, [periodExpenses, view, anchor, lang]);

  const average = periodDayCount > 0 ? total / periodDayCount : 0;
  const trendMax = Math.max(250, ...dailySeries.map((d) => d.amount), 1);

  useEffect(() => {
    setSelectedTrendIso(defaultTrendSelectionIso(dailySeries, view, anchor));
  }, [dailySeries, view, anchor, chartPeriodKey]);

  const selectedTrendPoint = useMemo(
    () => dailySeries.find((p) => p.iso === selectedTrendIso) ?? null,
    [dailySeries, selectedTrendIso],
  );

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
    if (offset < -50 || velocity < -400) {
      setChartSlide((s) => Math.min(ANALYTICS_SLIDE_COUNT - 1, s + 1));
    } else if (offset > 50 || velocity > 400) {
      setChartSlide((s) => Math.max(0, s - 1));
    }
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
    <div className="max-w-2xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-4 text-neutral-100">
          <PieChartIcon className="w-6 h-6 text-emerald-400" />
          <h2 className="text-lg sm:text-xl font-bold">{tr('analyticsTitle')}</h2>
        </div>

        <div className="flex p-1 bg-neutral-900 border border-neutral-800 rounded-2xl">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ease-in-out ${
                view === v.id
                  ? 'bg-white text-neutral-900 shadow'
                  : 'text-neutral-400 hover:text-neutral-200'
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
          <p className="text-base font-semibold capitalize">{periodLabel}</p>
          {periodSubtitle && <p className="text-xs text-neutral-500 mt-0.5">{periodSubtitle}</p>}
        </div>

        {/* Swipeable chart carousel — only mount active slide so Recharts gets real dimensions */}
        <div
          className={`relative mt-6 w-full touch-pan-y rounded-2xl bg-neutral-950 ${
            chartSlide === 2 ? 'overflow-visible' : 'overflow-hidden'
          }`}
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

          <AnimatePresence mode="wait" initial={false}>
            {chartSlide === 0 && (
              <motion.div
                key={`slide-0-${chartPeriodKey}`}
                className="absolute inset-0 w-full h-full px-1 flex items-center"
                style={{ height: ANALYTICS_CHART_HEIGHT }}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.28, ease: 'easeInOut' }}
              >
                <AnalyticsDonutPanel
                  chartKey={`category-donut-${chartPeriodKey}`}
                  total={total}
                  donutData={categoryDonutData}
                  legend={categoryLegend}
                  paddingSlices={breakdown.length > 1}
                />
              </motion.div>
            )}

            {chartSlide === 1 && (
              <motion.div
                key={`slide-1-${chartPeriodKey}`}
                className="absolute inset-0 w-full h-full px-1 flex items-center"
                style={{ height: ANALYTICS_CHART_HEIGHT }}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.28, ease: 'easeInOut' }}
              >
                {dailyBreakdown.length === 0 ? (
                  <div className="flex flex-col items-center justify-center w-full h-full text-center px-4">
                    <PieChartIcon className="w-10 h-10 text-neutral-600 mb-2" />
                    <p className="text-sm text-neutral-400">{tr('noDailyBreakdown')}</p>
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
              </motion.div>
            )}

            {chartSlide === 2 && (
              <motion.div
                key={`slide-2-${chartPeriodKey}`}
                className="absolute inset-0 w-full h-full flex flex-col px-2 pt-2 overflow-visible z-20"
                style={{ height: ANALYTICS_CHART_HEIGHT }}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.28, ease: 'easeInOut' }}
              >
                <div className="flex items-start justify-between gap-3 mb-2 shrink-0">
                  <div className="text-sm text-neutral-300 space-y-0.5">
                    <p>
                      <span className="text-neutral-500">{tr('totalShort')}: </span>
                      <DisplayMoney amount={total} className="font-semibold text-neutral-100 inline-block" />
                    </p>
                    <p>
                      <span className="text-neutral-500">{tr('average')}: </span>
                      <DisplayMoney amount={average} className="font-semibold text-neutral-100 inline-block" />
                    </p>
                  </div>
                </div>

                {dailySeries.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-neutral-500">{tr('noChartData')}</p>
                  </div>
                ) : (
                  <div
                    className="w-full flex-1 min-h-0 overflow-visible relative z-20"
                    style={{ height: ANALYTICS_LINE_HEIGHT, minHeight: ANALYTICS_LINE_HEIGHT }}
                  >
                    <ResponsiveContainer
                      width="100%"
                      height={ANALYTICS_LINE_HEIGHT}
                      key={`line-chart-${chartPeriodKey}`}
                      className="overflow-visible"
                    >
                      <LineChart
                        data={dailySeries}
                        margin={{ top: 28, right: 12, left: 4, bottom: 8 }}
                        style={{ overflow: 'visible' }}
                        onClick={(state) => {
                          if (!state) return;
                          const chartState = state as {
                            activeTooltipIndex?: number;
                            activeIndex?: number;
                            activePayload?: ReadonlyArray<{ payload?: TrendSeriesPoint }>;
                          };
                          const fromPayload = chartState.activePayload?.[0]?.payload;
                          if (fromPayload) {
                            setSelectedTrendIso(fromPayload.iso);
                            return;
                          }
                          const idx = chartState.activeTooltipIndex ?? chartState.activeIndex;
                          if (typeof idx === 'number' && dailySeries[idx]) {
                            setSelectedTrendIso(dailySeries[idx].iso);
                          }
                        }}
                      >
                        <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 6" vertical={false} />
                        <XAxis
                          dataKey="dayLabel"
                          tick={{ fill: '#525252', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          interval={view === 'month' ? 6 : view === 'year' ? 1 : 0}
                        />
                        <YAxis
                          domain={[0, trendMax]}
                          ticks={[0, Math.round(trendMax / 2), trendMax]}
                          tick={{ fill: '#525252', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                          tickFormatter={(v) => String(v)}
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
                                style={{ cursor: 'pointer' }}
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
          className={`flex justify-center items-center gap-2 ${chartSlide === 2 && selectedTrendPoint ? 'mt-4' : 'mt-5'}`}
          role="tablist"
          aria-label={tr('analyticsViews')}
        >
          {Array.from({ length: ANALYTICS_SLIDE_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={chartSlide === i}
              aria-label={`${tr('viewPrefix')} ${i + 1}`}
              onClick={() => setChartSlide(i)}
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

interface SpendingDonutProps {
  dayExpenses: Expense[];
  categories: Category[];
  dateLabel: string;
  onPreviousDay: () => void;
  onNextDay: () => void;
}

// Compact donut of how much was spent per category on the selected day.
function SpendingDonut({
  dayExpenses,
  categories,
  dateLabel,
  onPreviousDay,
  onNextDay,
}: SpendingDonutProps) {
  const { tr } = useLanguage();
  const total = dayExpenses.reduce((s, e) => s + e.amount, 0);
  const breakdown = aggregateByCategory(dayExpenses, categories);

  const donutData =
    breakdown.length > 0
      ? breakdown.map((b) => ({ id: b.value, value: b.amount, hex: b.hex }))
      : [{ id: 'empty', value: 1, hex: '#262626' }];

  return (
    <div className="bg-neutral-900 rounded-2xl shadow-lg shadow-black/20 border border-neutral-800 p-4 sm:p-6 mb-6 sm:mb-8">
      <h2 className="text-base sm:text-lg font-semibold text-neutral-100 flex items-center gap-2 mb-3">
        <PieChartIcon className="w-5 h-5 text-emerald-400" />
        {tr('expenseByCategory')}
      </h2>

      <div
        dir="ltr"
        className="flex items-center justify-center gap-2 sm:gap-3 mb-4"
      >
        <button
          type="button"
          onClick={onPreviousDay}
          aria-label={tr('prevDay')}
          title={tr('prevDay')}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 border border-transparent hover:border-neutral-700 active:scale-95 transition-all"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-neutral-400 min-w-[6.5rem] text-center tabular-nums">
          {dateLabel}
        </span>
        <button
          type="button"
          onClick={onNextDay}
          aria-label={tr('nextDay')}
          title={tr('nextDay')}
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 border border-transparent hover:border-neutral-700 active:scale-95 transition-all"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {breakdown.length === 0 ? (
        <div className="text-center py-8">
          <div className="bg-neutral-800 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
            <TrendingDown className="w-7 h-7 text-neutral-500" />
          </div>
          <p className="text-neutral-400">{tr('noExpensesOnDate')}</p>
          <p className="text-neutral-500 text-sm mt-1">{tr('addExpenseToSeeBreakdown')}</p>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-44 h-44 shrink-0">
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
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <DisplayMoney amount={total} className="text-xl font-bold leading-none" />
              <span className="text-[11px] text-neutral-500 mt-1">{tr('totalShort')}</span>
            </div>
          </div>

          <CategoryBreakdownLegend items={breakdown} layout="grid" />
        </div>
      )}
    </div>
  );
}

interface DashboardCategoryChartProps {
  expenses: Expense[];
  categories: Category[];
  chartDateSetterRef: MutableRefObject<((iso: string) => void) | null>;
}

// Mounts only on the Home tab; unmounting resets selectedChartDate to today.
function DashboardCategoryChart({ expenses, categories, chartDateSetterRef }: DashboardCategoryChartProps) {
  const [selectedChartDate, setSelectedChartDate] = useState(() => toISODate(new Date()));

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
      dateLabel={formatChartDateLabel(selectedChartDate)}
      onPreviousDay={goToPreviousChartDay}
      onNextDay={goToNextChartDay}
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
  const { tr, ensureUserContents, formatMoney } = useLanguage();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [newSubBudgetColor, setNewSubBudgetColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [hoveredDonutSliceId, setHoveredDonutSliceId] = useState<string | null>(null);

  const spentByCat = monthExpenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const budgetedValues = useMemo(
    () => Object.keys(subBudgets).filter((v) => subBudgets[v] > 0),
    [subBudgets],
  );

  useEffect(() => {
    void ensureUserContents(budgetedValues);
  }, [budgetedValues, ensureUserContents]);

  const allocatedTotal = budgetedValues.reduce((s, v) => s + subBudgets[v], 0);
  const generalAllocated = Math.max(0, budget - allocatedTotal);

  // Spending that falls outside any budgeted category draws from the General pool.
  const unbudgetedSpent = Object.entries(spentByCat)
    .filter(([v]) => !budgetedValues.includes(v))
    .reduce((s, [, amt]) => s + amt, 0);

  const totalSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);

  const envelopes: Envelope[] = budgetedValues
    .map((v) => {
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
    })
    .sort((a, b) => b.allocated - a.allocated);

  if (generalAllocated > 0 || unbudgetedSpent > 0) {
    envelopes.push({
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

  // Build the flat two-tone donut segments.
  const segments: {
    id: string;
    categoryKey: string;
    value: number;
    fill: string;
    label: string;
    status: string;
    amount: number;
    percentage: number;
    isGeneral: boolean;
  }[] = [];
  envelopes.forEach((env) => {
    if (env.allocated <= 0 && env.spent <= 0) return;
    const overspent = env.spent > env.allocated;
    if (overspent) {
      const amount = env.spent;
      segments.push({
        id: `${env.key}-over`,
        categoryKey: env.key,
        value: Math.max(env.spent, env.allocated, 1),
        fill: WARNING_COLOR,
        label: env.label,
        status: tr('spentLabel'),
        amount,
        percentage: budget > 0 ? (amount / budget) * 100 : 0,
        isGeneral: env.isGeneral,
      });
      return;
    }
    if (env.spent > 0) {
      const amount = env.spent;
      segments.push({
        id: `${env.key}-spent`,
        categoryKey: env.key,
        value: env.spent,
        fill: spentFill(env.hex),
        label: env.label,
        status: tr('spentLabel'),
        amount,
        percentage: budget > 0 ? (amount / budget) * 100 : 0,
        isGeneral: env.isGeneral,
      });
    }
    const remaining = env.allocated - env.spent;
    if (remaining > 0) {
      segments.push({
        id: `${env.key}-remaining`,
        categoryKey: env.key,
        value: remaining,
        fill: remainingFill(env.hex),
        label: env.label,
        status: tr('remainingLabel'),
        amount: remaining,
        percentage: budget > 0 ? (remaining / budget) * 100 : 0,
        isGeneral: env.isGeneral,
      });
    }
  });

  const donutData =
    segments.length > 0
      ? segments
      : [
          {
            id: 'empty',
            categoryKey: '',
            value: 1,
            fill: '#262626',
            label: tr('noData'),
            status: tr('spentLabel'),
            amount: 0,
            percentage: 0,
            isGeneral: false,
          },
        ];

  const activeDonutSlice = hoveredDonutSliceId
    ? donutData.find((slice) => slice.id === hoveredDonutSliceId) ?? null
    : null;

  const handleDonutSliceEnter = (slice: { payload?: { id?: string } }) => {
    const sliceId = slice.payload?.id;
    if (sliceId && sliceId !== 'empty') {
      setHoveredDonutSliceId(sliceId);
    }
  };

  const handleDonutSliceClick = (slice: { payload?: { id?: string } }) => {
    const sliceId = slice.payload?.id;
    if (!sliceId || sliceId === 'empty') return;
    setHoveredDonutSliceId((current) => (current === sliceId ? null : sliceId));
  };

  const handleAdd = () => {
    const amt = parseFloat(amount);
    if (name.trim() && !isNaN(amt) && amt > 0) {
      onAddSubBudget(name, amt, newSubBudgetColor);
      setName('');
      setAmount('');
      setNewSubBudgetColor(DEFAULT_CATEGORY_COLOR);
    }
  };

  return (
    <div className="bg-neutral-900 rounded-2xl shadow-lg shadow-black/20 border border-neutral-800 p-4 sm:p-6 mb-6 sm:mb-8">
      <div className="mb-4">
        <h2 className="text-base sm:text-lg font-semibold text-neutral-100 flex items-center gap-2">
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
          <p className="text-neutral-300">{tr('setMonthlyBudgetFirst')}</p>
          <p className="text-neutral-500 text-sm mt-1">{tr('thenSplitSubBudgets')}</p>
        </div>
      ) : (
        <>
          {/* Donut chart + fixed info panel */}
          <div className="flex flex-col md:flex-row-reverse items-center justify-center gap-8">
            <div className="relative w-48 h-48 sm:w-56 sm:h-56 shrink-0">
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
                    paddingAngle={0}
                    stroke="#0a0a0a"
                    strokeWidth={2}
                    isAnimationActive={false}
                    onMouseEnter={handleDonutSliceEnter}
                    onMouseLeave={() => setHoveredDonutSliceId(null)}
                    onClick={handleDonutSliceClick}
                  >
                    {donutData.map((s) => (
                      <Cell key={s.id} fill={s.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <DisplayMoney amount={totalSpent} className="text-2xl font-bold text-neutral-100 leading-none" />
                <span className="text-[11px] text-neutral-500 mt-1">
                  <LtrNumeric>
                    {tr('outOf')} {formatMoney(budget)}
                  </LtrNumeric>
                </span>
              </div>
            </div>

            <div
              className="w-64 h-40 shrink-0 flex flex-col justify-center rounded-xl border border-gray-600 bg-neutral-900/80 px-4 py-3 text-right text-white shadow-lg shadow-black/40"
              aria-live="polite"
            >
              {activeDonutSlice ? (
                <>
                  <p className="text-sm font-semibold text-white truncate">
                    {activeDonutSlice.isGeneral ? (
                      activeDonutSlice.label
                    ) : (
                      <LocalizedUserText text={activeDonutSlice.categoryKey} />
                    )}
                  </p>
                  <p className="text-xs mt-0.5 text-gray-300">{activeDonutSlice.status}</p>
                  <p className="text-base font-bold mt-2 text-white">
                    <DisplayMoney amount={activeDonutSlice.amount} className="inline-block" />
                  </p>
                  <p className="text-xs mt-0.5 text-gray-300">
                    <LtrNumeric>{activeDonutSlice.percentage.toFixed(0)}%</LtrNumeric>
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-white whitespace-nowrap">
                    {tr('totalBudgetLabel')}:{' '}
                    <DisplayMoney amount={budget} className="text-base font-bold inline-block" />
                  </p>
                  <p className="text-xs mt-0.5 text-gray-300">
                    {tr('spentLabel')}:{' '}
                    <LtrNumeric>
                      {formatMoney(totalSpent)}
                      {budget > 0 ? ` (${((totalSpent / budget) * 100).toFixed(0)}%)` : ''}
                    </LtrNumeric>
                  </p>
                  <p className="text-xs mt-0.5 text-gray-400 whitespace-nowrap">
                    {tr('cardHintHoverSlice')}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Tone legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: spentFill(hexForColor(DEFAULT_CATEGORY_COLOR)) }}
              />
              {tr('spentLabel')}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: remainingFill(hexForColor(DEFAULT_CATEGORY_COLOR)) }}
              />
              {tr('remainingLabel')}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: WARNING_COLOR }} />
              {tr('overspentLabel')}
            </span>
          </div>

          {/* Breakdown list with progress bars */}
          <div className="mt-6 space-y-4">
            {envelopes.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center">{tr('startByAddingSubBudget')}</p>
            ) : (
              envelopes.map((env) => {
                const Icon = env.icon;
                const overspent = env.spent > env.allocated;
                return (
                  <div key={env.key} className="flex items-center gap-3">
                    {overspent ? (
                      <div
                        className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: WARNING_COLOR }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                    ) : (
                      <CategoryIconBadge icon={Icon} hex={env.hex} colorClass={env.color} size="large" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-neutral-100 truncate">
                            {env.isGeneral ? (
                              env.label
                            ) : (
                              <LocalizedUserText text={env.key} />
                            )}
                          </span>
                          {overspent && (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3" />
                              {tr('overspentLabel')}
                            </span>
                          )}
                        </div>
                        <span className="text-sm shrink-0 text-neutral-300">
                          <LtrNumeric>
                            <span className={overspent ? 'text-rose-400 font-semibold' : 'text-neutral-100 font-semibold'}>
                              {formatMoney(env.spent)}
                            </span>
                            <span className="text-neutral-500"> / {formatMoney(env.allocated)}</span>
                          </LtrNumeric>
                        </span>
                      </div>
                      <SubBudgetProgressBar
                        allocated={env.allocated}
                        spent={env.spent}
                        usedColor={overspent ? WARNING_COLOR : spentFill(env.hex)}
                        remainingColor={remainingFill(env.hex)}
                        overspent={overspent}
                      />
                    </div>
                    {!env.isGeneral && (
                      <button
                        onClick={() => onRemoveSubBudget(env.key)}
                        className="shrink-0 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 p-2 rounded-lg transition-all"
                        title={tr('removeSubBudget')}
                        aria-label={tr('removeSubBudget')}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })
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
                className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 outline-none transition-all text-sm"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                  placeholder={tr('amountPlaceholder')}
                  min="0"
                  step="10"
                  className="w-28 sm:w-32 px-3 py-2.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 outline-none transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  className="shrink-0 bg-gradient-to-r from-violet-500 to-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:from-violet-600 hover:to-indigo-700 transition-all flex items-center justify-center gap-1 active:scale-[0.98]"
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
                      <span className="text-sm text-neutral-300 flex-1 truncate">
                        {v === GENERAL_KEY ? (
                          tr('generalUnallocated')
                        ) : (
                          <LocalizedUserText text={v} />
                        )}
                      </span>
                      <LtrNumeric className="text-neutral-500 text-sm">₪</LtrNumeric>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={subBudgets[v]}
                        onChange={(e) => onSetSubBudget(v, parseFloat(e.target.value) || 0)}
                        min="0"
                        step="10"
                        className="w-24 px-2 py-1.5 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-100 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30 outline-none transition-all text-sm text-left"
                      />
                    </div>
                  );
                })}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <LtrNumeric className="text-neutral-500">
                    {tr('allocated')}: {formatMoney(allocatedTotal)} / {formatMoney(budget)}
                  </LtrNumeric>
                  <LtrNumeric
                    className={
                      allocatedTotal > budget ? 'text-rose-400 font-medium' : 'text-neutral-500'
                    }
                  >
                    {allocatedTotal > budget
                      ? `${tr('overBudget')}: ${formatMoney(allocatedTotal - budget)}`
                      : `${tr('unallocated')}: ${formatMoney(generalAllocated)}`}
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
      accent: 'hover:border-emerald-500/60 hover:bg-emerald-500/5',
      ring: 'focus-visible:ring-emerald-500/40',
      iconBg: 'bg-emerald-500/15 text-emerald-400',
    },
    {
      mode: 'reset',
      icon: RotateCcw,
      title: tr('budgetOptionResetTitle'),
      desc: tr('budgetOptionResetDesc'),
      accent: 'hover:border-amber-500/60 hover:bg-amber-500/5',
      ring: 'focus-visible:ring-amber-500/40',
      iconBg: 'bg-amber-500/15 text-amber-400',
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
        className="relative w-full sm:max-w-lg bg-neutral-900 border border-neutral-800 shadow-2xl shadow-black/60 rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 max-h-[92vh] overflow-y-auto"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-700" />

        <div className="flex items-start gap-3 mb-1">
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20 shrink-0">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 id="budget-modal-title" className="text-base sm:text-lg font-bold text-neutral-100 leading-snug">
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
        <div className="flex items-center justify-between gap-3 bg-neutral-800/60 border border-neutral-700/60 rounded-2xl px-4 py-3 mb-5">
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
                className={`w-full text-right flex items-center gap-3.5 p-4 rounded-2xl bg-neutral-800/40 border border-neutral-700/70 transition-all active:scale-[0.99] outline-none focus-visible:ring-2 ${opt.accent} ${opt.ring}`}
              >
                <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${opt.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-neutral-100 text-sm leading-snug">{opt.title}</p>
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
          className="mt-4 w-full py-3 rounded-xl text-sm font-medium text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-all"
        >
          {tr('cancel')}
        </button>
      </div>
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
    setSettingsPersistence,
    applySettingsFromCloud,
  } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [settingsCloudReady, setSettingsCloudReady] = useState(false);
  const suppressCloudSaveRef = useRef(true);
  const skipNextSettingsSaveRef = useRef(false);
  const pendingAuthLangRef = useRef<'he' | 'en' | null>(null);
  const hadAuthenticatedUserRef = useRef(false);
  const settingsMergeRef = useRef({
    keepOriginalValues,
    displayCurrency,
    savedColors,
    customCurrencies,
  });

  settingsMergeRef.current = {
    keepOriginalValues,
    displayCurrency,
    savedColors,
    customCurrencies,
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Monthly budget is scoped per month ('YYYY-MM' -> amount) so changing one
  // month never affects another month's history.
  const [budgetsByMonth, setBudgetsByMonth] = useState<Record<string, number>>({});
  const [budgetInput, setBudgetInput] = useState<string>('');

  // Budget-change confirmation modal state.
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [pendingBudget, setPendingBudget] = useState<number | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    currency: 'ILS' as ExpenseCurrency,
    category: CATEGORIES[0]?.value ?? '',
    date: toISODate(new Date()),
  });
  const [expenseRatesReady, setExpenseRatesReady] = useState(true);
  const [showBudgetSaved, setShowBudgetSaved] = useState(false);

  // Active top-level navigation tab.
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsReturnTabRef = useRef<TabId>('dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const chartDateSetterRef = useRef<((iso: string) => void) | null>(null);
  const isHomeView = activeTab === 'dashboard' && !settingsOpen;
  const wasHomeViewRef = useRef(isHomeView);

  useEffect(() => {
    const wasHome = wasHomeViewRef.current;
    if (!wasHome && isHomeView) {
      setNewExpense((prev) => ({
        ...prev,
        currency: displayCurrency as ExpenseCurrency,
      }));
    }
    wasHomeViewRef.current = isHomeView;
  }, [isHomeView, displayCurrency]);

  const handleTabSelect = (id: TabId) => {
    setActiveTab(id);
    setNavOpen(false);
    setSettingsOpen(false);
  };

  const openSettings = () => {
    settingsReturnTabRef.current = activeTab;
    setNavOpen(false);
    setSettingsOpen(true);
  };

  const closeSettings = () => {
    setSettingsOpen(false);
    setActiveTab(settingsReturnTabRef.current);
  };

  const handleLogout = async () => {
    try {
      await signOutUser();
      setNavOpen(false);
      setActiveTab('dashboard');
    } catch {
      // sign-out errors are rare; user state will sync via onAuthStateChanged
    }
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
  const budget = budgetsByMonth[selectedMonthKey] ?? 0;
  const subBudgets = subBudgetsByMonth[selectedMonthKey] ?? {};

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
      Object.keys(monthMap).forEach((key) => texts.add(key));
    });
    void ensureUserContents(Array.from(texts));
  }, [customCategories, expenses, subBudgetsByMonth, ensureUserContents, lang, keepOriginalValues]);

  // Automatic month inheritance:
  // When user navigates to a month with no explicit values yet, copy budget +
  // sub-budgets from the nearest prior month that has data.
  useEffect(() => {
    const hasBudget = budgetsByMonth[selectedMonthKey] !== undefined;
    const hasSubBudgets = subBudgetsByMonth[selectedMonthKey] !== undefined;
    if (hasBudget && hasSubBudgets) return;

    const sourceMonthKey = findNearestPriorMonthWithData(
      selectedMonthKey,
      budgetsByMonth,
      subBudgetsByMonth
    );
    if (!sourceMonthKey) return;

    if (!hasBudget && budgetsByMonth[sourceMonthKey] !== undefined) {
      const inheritedBudget = budgetsByMonth[sourceMonthKey];
      setBudgetsByMonth((prev) => ({ ...prev, [selectedMonthKey]: inheritedBudget }));
    }

    if (!hasSubBudgets && subBudgetsByMonth[sourceMonthKey] !== undefined) {
      const inheritedSubBudgets = subBudgetsByMonth[sourceMonthKey] ?? {};
      setSubBudgetsByMonth((prev) => ({
        ...prev,
        [selectedMonthKey]: { ...inheritedSubBudgets },
      }));
    }
  }, [selectedMonthKey, budgetsByMonth, subBudgetsByMonth]);

  const applyAppData = (data: typeof EMPTY_USER_APP_DATA) => {
    setExpenses(data.expenses.map((e) => ({ ...e, date: normalizeDate(e.date) })));
    setCustomCategories(data.customCategories);
    setBudgetsByMonth(data.budgetsByMonth);
    setSubBudgetsByMonth(data.subBudgetsByMonth);
  };

  const resetAppData = () => {
    setExpenses([]);
    setCustomCategories([]);
    setBudgetsByMonth({});
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
        }
        hadAuthenticatedUserRef.current = false;

        setGuestLangActive(false);
        pendingAuthLangRef.current = null;
        setSettingsPersistence('local');
        clearCloudManualExchangeOverrides();
        clearCloudCurrencyCommissions();
        setDataReady(true);
        return;
      }

      hadAuthenticatedUserRef.current = !user.isAnonymous;
      setDataReady(false);
      setSettingsCloudReady(false);

      if (user.isAnonymous) {
        setGuestLangActive(true);
        setSettingsPersistence('local');
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
      const uid = user.uid;

      try {
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
            setSubBudgetsByMonth((prev) =>
              JSON.stringify(prev) === JSON.stringify(data.subBudgetsByMonth)
                ? prev
                : data.subBudgetsByMonth,
            );
            if (!initialCategories) {
              initialCategories = true;
              markReadyIfComplete();
            }
          },
          () => {
            if (!cancelled) {
              setCustomCategories([]);
              setBudgetsByMonth({});
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
              const mergeBase = settingsMergeRef.current;
              const merged = meta.exists
                ? { ...settings, lang: pendingLang }
                : {
                    lang: pendingLang,
                    keepOriginalValues: mergeBase.keepOriginalValues,
                    displayCurrency: mergeBase.displayCurrency,
                    saved_colors: mergeBase.savedColors,
                    custom_currencies: mergeBase.customCurrencies,
                  };
              applySettingsFromCloud(merged);
            } else if (meta.exists) {
              skipNextSettingsSaveRef.current = true;
              applySettingsFromCloud(settings);
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

  // Persist financial changes: localStorage for guests, debounced Firestore for accounts.
  useEffect(() => {
    if (!dataReady || !user) return;

    const payload = {
      expenses,
      customCategories,
      budgetsByMonth,
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
          subBudgetsByMonth,
        }),
      ]).catch(() => {
        // Non-blocking; next edit will retry.
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [expenses, customCategories, budgetsByMonth, subBudgetsByMonth, dataReady, user]);

  // Persist settings to Firestore for signed-in accounts.
  useEffect(() => {
    if (!dataReady || !user || user.isAnonymous || !settingsCloudReady) return;

    if (skipNextSettingsSaveRef.current) {
      skipNextSettingsSaveRef.current = false;
      return;
    }

    const uid = user.uid;
    const timer = window.setTimeout(() => {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== uid || currentUser.isAnonymous) return;
      void saveSettingsToCloud(uid, {
        lang,
        keepOriginalValues,
        displayCurrency,
        saved_colors: savedColors,
        custom_currencies: customCurrencies,
      }).catch(() => {
        // Non-blocking; next change will retry.
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [
    lang,
    keepOriginalValues,
    displayCurrency,
    savedColors,
    customCurrencies,
    dataReady,
    user,
    settingsCloudReady,
  ]);

  // Budget update entry point. If the active month already has sub-budget
  // allocations, we ask how to reconcile them via the confirmation modal;
  // otherwise the new budget is applied immediately.
  const handleSetBudget = () => {
    const amount = parseFloat(budgetInput);
    if (isNaN(amount) || amount < 0) return;

    const hasAllocations = Object.values(subBudgets).some((v) => v > 0);
    if (hasAllocations) {
      setPendingBudget(amount);
      setShowBudgetModal(true);
    } else {
      applyBudgetChange(amount, 'keep');
    }
  };

  // Applies the new budget to the active month and reconciles its sub-budgets
  // per the chosen option. All writes are scoped to `selectedMonthKey`, so
  // other months are never touched.
  const applyBudgetChange = (amount: number, mode: BudgetChangeMode) => {
    setBudgetsByMonth((prev) => ({ ...prev, [selectedMonthKey]: amount }));

    if (mode === 'reset') {
      // Wipe this month's allocations only.
      setSubBudgetsByMonth((prev) => ({ ...prev, [selectedMonthKey]: {} }));
    }

    setBudgetInput('');
    setPendingBudget(null);
    setShowBudgetModal(false);
    setShowBudgetSaved(true);
    setTimeout(() => setShowBudgetSaved(false), 2000);
  };

  const handleCloseBudgetModal = () => {
    setShowBudgetModal(false);
    setPendingBudget(null);
  };

  // Add new expense
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const foreignAmount = parseFloat(newExpense.amount);

    if (isNaN(foreignAmount) || !(foreignAmount > 0)) return;

    const resolveIlsAmount = async (): Promise<number | null> => {
      if (newExpense.currency === 'ILS') return foreignAmount;

      const rates = getCachedExchangeRates() ?? (await fetchExchangeRates().catch(() => null));
      if (!rates) return null;

      const converted = convertExpenseAmountToIls(foreignAmount, newExpense.currency, rates);
      if (converted == null) return null;

      return Math.round(converted * 100) / 100;
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
        ...(newExpense.currency !== 'ILS' && {
          originalAmount: foreignAmount,
          originalCurrency: currencySymbol(newExpense.currency),
        }),
      };

      setExpenses([expense, ...expenses]);
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
    newExpense.currency !== 'ILS' && !expenseRatesReady;

  // Delete expense
  const handleDeleteExpense = (id: string) => {
    setExpenses(expenses.filter(expense => expense.id !== id));
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
    setSubBudgetsByMonth((prev) => ({
      ...prev,
      [selectedMonthKey]: { ...(prev[selectedMonthKey] ?? {}), [key]: amount },
    }));
  };

  const handleSetSubBudget = (value: string, amount: number) => {
    setSubBudgetsByMonth((prev) => {
      const monthMap = { ...(prev[selectedMonthKey] ?? {}) };
      if (!(amount > 0)) delete monthMap[value];
      else monthMap[value] = amount;
      return { ...prev, [selectedMonthKey]: monthMap };
    });
  };

  const handleRemoveSubBudget = (value: string) => {
    setSubBudgetsByMonth((prev) => {
      const monthMap = { ...(prev[selectedMonthKey] ?? {}) };
      delete monthMap[value];
      return { ...prev, [selectedMonthKey]: monthMap };
    });
  };

  // Month navigation (selectedMonthKey is derived above with budget/subBudgets).
  const monthLabel = selectedDate.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'long', year: 'numeric' });
  const isCurrentMonth = selectedMonthKey === monthKeyOfDate(new Date());
  const goToMonth = (offset: number) =>
    setSelectedDate((d) => new Date(d.getFullYear(), d.getMonth() + offset, 1));
  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Expenses for the selected month only (filtered by ISO date).
  const monthExpenses = expenses.filter((e) => monthKeyOf(e.date) === selectedMonthKey);

  // Calculate total expenses (for the selected month)
  const totalExpenses = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const budgetPercentage = budget > 0 ? (totalExpenses / budget) * 100 : 0;
  const isOverBudget = totalExpenses > budget && budget > 0;
  const remaining = budget - totalExpenses;

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
    <div className="bg-neutral-900 rounded-2xl shadow-lg shadow-black/20 border border-neutral-800 p-3 sm:p-4 mb-6 sm:mb-8">
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
        className="min-h-screen bg-slate-950 flex items-center justify-center text-neutral-100"
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

  return (
    <motion.div
      dir={dir}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="min-h-screen bg-neutral-950 text-neutral-100"
    >
      {/* Header + desktop nav */}
      <header
        className="bg-neutral-900/80 backdrop-blur shadow-lg shadow-black/20 border-b border-neutral-800 sticky top-0 z-20"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-2.5 rounded-xl shadow-lg shadow-emerald-500/20 shrink-0">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-neutral-100 truncate">{tr('appName')}</h1>
                <p className="text-neutral-400 text-xs truncate hidden sm:block">{tr('appTagline')}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <UserProfileMenu
                user={user}
                userName={userName}
                onLogout={handleLogout}
                onOpenSettings={openSettings}
              />
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-10">
        {settingsOpen ? (
          <SettingsPage
            onBack={closeSettings}
            recentExpenseCurrencies={recentExpenseCurrencies}
          />
        ) : (
          <>
        {/* ============================ DASHBOARD ============================ */}
        {activeTab === 'dashboard' && (
          <>
            {monthSelector}

            {/* Budget Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Total Budget Card */}
          <div className="bg-neutral-900 rounded-2xl shadow-lg shadow-black/20 border border-neutral-800 p-4 sm:p-6 hover:border-neutral-700 transition-colors">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-sm font-medium text-neutral-400">{tr('monthlyBudget')}</span>
              <div className="bg-emerald-500/15 p-2 rounded-lg">
                <Wallet className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <DisplayMoney amount={budget} className="text-2xl sm:text-3xl font-bold text-neutral-100" />
            <p className="text-sm text-neutral-500 mt-2">{tr('budgetAllocatedHint')}</p>
          </div>

          {/* Total Expenses Card */}
          <div className="bg-neutral-900 rounded-2xl shadow-lg shadow-black/20 border border-neutral-800 p-4 sm:p-6 hover:border-neutral-700 transition-colors">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-sm font-medium text-neutral-400">{tr('totalExpenses')}</span>
              <div className="bg-rose-500/15 p-2 rounded-lg">
                <TrendingDown className="w-5 h-5 text-rose-400" />
              </div>
            </div>
            <DisplayMoney
              amount={totalExpenses}
              className={`text-2xl sm:text-3xl font-bold ${isOverBudget ? 'text-rose-400' : 'text-neutral-100'}`}
            />
            <p className="text-sm text-neutral-500 mt-2">
              {monthExpenses.length} • {monthLabel}
            </p>
          </div>

          {/* Budget Status Card */}
          <div className={`rounded-2xl shadow-lg shadow-black/20 border p-4 sm:p-6 transition-colors sm:col-span-2 md:col-span-1 ${
            isOverBudget
              ? 'bg-rose-500/10 border-rose-500/40'
              : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
          }`}>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-sm font-medium text-neutral-400">{tr('budgetStatus')}</span>
              <div className={`p-2 rounded-lg ${isOverBudget ? 'bg-rose-500/20' : 'bg-indigo-500/15'}`}>
                {isOverBudget ? (
                  <AlertTriangle className="w-5 h-5 text-rose-400" />
                ) : (
                  <Wallet className="w-5 h-5 text-indigo-400" />
                )}
              </div>
            </div>

            {isOverBudget && (
              <div className="bg-rose-500 text-white text-xs font-medium px-2 py-1 rounded-full inline-block mb-3">
                {tr('overBudgetBadge')}
              </div>
            )}

            <DisplayMoney
              amount={remaining}
              className={`text-2xl font-bold ${isOverBudget ? 'text-rose-400' : 'text-neutral-100'}`}
            />
            <p className="text-sm text-neutral-500 mt-2">
              {remaining >= 0 ? tr('remainingInBudget') : tr('overBudget')}
            </p>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-neutral-400 mb-1">
                <span>{tr('utilization')}</span>
                <span>{Math.min(100, budgetPercentage).toFixed(0)}%</span>
              </div>
              <div className="h-3 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOverBudget
                      ? 'bg-gradient-to-r from-rose-500 to-rose-600'
                      : budgetPercentage > 80
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                        : 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  }`}
                  style={{ width: `${Math.min(100, budgetPercentage)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Add Expense Form */}
        <div className="relative isolate z-10 bg-neutral-900 rounded-2xl shadow-lg shadow-black/20 border border-neutral-800 p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-neutral-100 mb-4 sm:mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-400" />
            {tr('addExpenseTitle')}
          </h2>

          <form onSubmit={handleAddExpense} className="flex flex-col gap-4">
            {/* Row 1: Description + Amount */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="block text-sm font-medium text-neutral-300 mb-2">
                  {tr('descriptionOptional')}
                </label>
                <input
                  type="text"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  placeholder={tr('exampleExpensePlaceholder')}
                  className="h-12 w-full min-w-0 px-4 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base"
                />
              </div>

              <ExpenseAmountField
                amount={newExpense.amount}
                currency={newExpense.currency}
                onAmountChange={(amount) => setNewExpense({ ...newExpense, amount })}
                onCurrencyChange={(currency) => setNewExpense({ ...newExpense, currency })}
                onRatesReadyChange={setExpenseRatesReady}
              />
            </div>

            {/* Row 2: Category + Date + Submit */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="block text-sm font-medium text-neutral-300 mb-2">{tr('category')}</label>
                <select
                  value={isAddingCategory ? ADD_CUSTOM_VALUE : newExpense.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="h-12 w-full min-w-0 px-4 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base"
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
                <label className="block text-sm font-medium text-neutral-300 mb-2">{tr('date')}</label>
                <input
                  type="date"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                  className="h-12 w-full min-w-0 px-4 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base [color-scheme:dark]"
                  required
                />
              </div>

              <div className="shrink-0 w-full sm:w-auto">
                <span
                  className="mb-2 block text-sm font-medium text-transparent select-none pointer-events-none"
                  aria-hidden="true"
                >
                  {tr('addExpense')}
                </span>
                <button
                  type="submit"
                  disabled={expenseSubmitBlocked}
                  className="h-12 w-full min-w-[10.5rem] shrink-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-emerald-500 disabled:hover:to-teal-600"
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

            {/* Global budget setter */}
            <div className="bg-neutral-900 rounded-2xl shadow-lg shadow-black/20 border border-neutral-800 p-4 sm:p-6 mb-6 sm:mb-8">
              <h2 className="text-base sm:text-lg font-semibold text-neutral-100 mb-4">{tr('setMonthlyBudget')}</h2>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
                <div className="flex-1 sm:max-w-xs">
                  <label className="block text-sm font-medium text-neutral-300 mb-2">{tr('budgetAmountLabel')}</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder={
                      budget > 0
                        ? `${tr('currentAmountPrefix')}: ${formatMoney(budget)}`
                        : tr('enterAmount')
                    }
                    className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base sm:text-lg"
                    min="0"
                    step="100"
                  />
                </div>
                <button
                  onClick={handleSetBudget}
                  className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-8 py-3 rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  {showBudgetSaved ? (
                    <>
                      <Check className="w-5 h-5" />
                      {tr('budgetSaved')}
                    </>
                  ) : (
                    tr('updateBudget')
                  )}
                </button>
              </div>
            </div>

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
        <div className="bg-neutral-900 rounded-2xl shadow-lg shadow-black/20 border border-neutral-800 overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-neutral-800">
            <h2 className="text-base sm:text-lg font-semibold text-neutral-100">{tr('expenseHistoryTitle')}</h2>
            <p className="text-sm text-neutral-500 mt-1">
              {historyExpenses.length} • {tr('totalShort')}{' '}
              <DisplayMoney amount={historyTotal} className="inline-block font-medium" />
            </p>

            <div
              className="flex p-1 rounded-2xl bg-neutral-950/80 border border-neutral-800 mt-4"
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
                    className={`relative flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                      isActive
                        ? 'text-neutral-950'
                        : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/60'
                    }`}
                  >
                    {isActive && (
                      <span
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/25"
                        aria-hidden
                      />
                    )}
                    <span className="relative z-10">{({
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
                className="w-full pr-11 pl-9 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base"
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
              <p className="text-neutral-300 text-base sm:text-lg">
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
              <ul className="md:hidden divide-y divide-neutral-800">
                {historyExpenses.map((expense) => {
                  const categoryInfo = getCategoryInfo(expense.category);
                  const IconComponent = categoryInfo.icon;

                  return (
                    <li key={expense.id} className="p-4 active:bg-neutral-800/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <CategoryIconBadge
                          icon={IconComponent}
                          colorClass={categoryInfo.color}
                        />
                        <div className="min-w-0 flex-1">
                          <LocalizedUserText
                            text={expenseDescriptionLabel(expense.description)}
                            className={`font-medium truncate block ${
                              expense.description.trim() ? 'text-neutral-100' : 'text-neutral-500 italic'
                            }`}
                          />
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                            <span className="truncate">
                              <LocalizedUserText text={expense.category} />
                            </span>
                            <span className="text-neutral-600">•</span>
                            <span className="shrink-0">{formatDisplayDate(expense.date, lang)}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-left">
                          <ExpenseAmountDisplay
                            amount={expense.amount}
                            originalAmount={expense.originalAmount}
                            originalCurrency={expense.originalCurrency}
                            variant="card"
                          />
                        </div>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="shrink-0 text-neutral-500 hover:text-rose-400 active:bg-rose-500/10 p-2.5 rounded-lg transition-all"
                          title={tr('delete')}
                          aria-label={tr('deleteExpense')}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-800/50">
                    <tr>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-neutral-400">{tr('description')}</th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-neutral-400">
                        {tr('amountLabel')} ({currencySymbol(displayCurrency)})
                      </th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-neutral-400">{tr('category')}</th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-neutral-400">{tr('date')}</th>
                      <th className="px-6 py-4 text-sm font-semibold text-neutral-400">{tr('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {historyExpenses.map((expense) => {
                      const categoryInfo = getCategoryInfo(expense.category);
                      const IconComponent = categoryInfo.icon;

                      return (
                        <tr key={expense.id} className="hover:bg-neutral-800/40 transition-colors">
                          <td className="px-6 py-4">
                            <LocalizedUserText
                              text={expenseDescriptionLabel(expense.description)}
                              className={`font-medium ${
                                expense.description.trim() ? 'text-neutral-100' : 'text-neutral-500 italic'
                              }`}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <ExpenseAmountDisplay
                              amount={expense.amount}
                              originalAmount={expense.originalAmount}
                              originalCurrency={expense.originalCurrency}
                            />
                          </td>
                          <td className="px-6 py-4">
                            <CategoryColorChip color={categoryInfo.color} icon={IconComponent}>
                              <LocalizedUserText text={expense.category} />
                            </CategoryColorChip>
                          </td>
                          <td className="px-6 py-4 text-neutral-400">
                            {formatDisplayDate(expense.date, lang)}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 p-2 rounded-lg transition-all"
                              title={tr('delete')}
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>
        )}
          </>
        )}
      </main>

      {/* Footer (desktop only; mobile uses the bottom nav) */}
      {!settingsOpen && (
      <footer className="hidden md:block border-t border-neutral-800 bg-neutral-900 mt-8 sm:mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-neutral-500">
            {tr('appName')} - {tr('appTagline')}
          </p>
        </div>
      </footer>
      )}

      {/* Mobile floating action menu (collapsed FAB by default) */}
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

      {/* Budget change confirmation modal */}
      <BudgetChangeModal
        open={showBudgetModal && pendingBudget !== null}
        newBudget={pendingBudget ?? 0}
        currentBudget={budget}
        monthLabel={monthLabel}
        onSelect={(mode) => {
          if (pendingBudget !== null) applyBudgetChange(pendingBudget, mode);
        }}
        onClose={handleCloseBudgetModal}
      />
    </motion.div>
  );
}

export default App;
