import { useState, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
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
  COLOR_OPTIONS,
  DEFAULT_CATEGORY_COLOR,
  hexForColor,
  aggregateByCategory,
  lookupCategory,
  type Category,
} from './categories';
import CategoryIconBadge from './components/CategoryIconBadge';
import CategoryBreakdownLegend from './components/CategoryBreakdownLegend';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signOutUser } from './firebase';
import AuthPage from './components/AuthPage';
import UserProfileMenu from './components/UserProfileMenu';
import {
  EMPTY_USER_APP_DATA,
  loadFromFirestore,
  loadFromLocalStorage,
  saveToFirestore,
  saveToLocalStorage,
} from './userDataStorage';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  // Canonical date stored as ISO 'YYYY-MM-DD' for reliable month filtering.
  date: string;
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
const formatDisplayDate = (iso: string): string => {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('he-IL');
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

interface CategoryColorPickerProps {
  value: string;
  onChange: (colorClass: string) => void;
  label?: string;
}

// Touch-friendly premium color grid for dark mode forms.
function CategoryColorPicker({
  value,
  onChange,
  label = 'צבע',
}: CategoryColorPickerProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-neutral-300 mb-2">{label}</label>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
        {COLOR_OPTIONS.map((c) => {
          const selected = value === c.class;
          const hex = hexForColor(c.class);
          return (
            <button
              key={c.class}
              type="button"
              onClick={() => onChange(c.class)}
              title={c.name}
              aria-label={c.name}
              aria-pressed={selected}
              className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-full ${c.class} transition-all duration-200 active:scale-95 ${
                selected
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-neutral-900 scale-110'
                  : 'hover:scale-105 opacity-90 hover:opacity-100'
              }`}
              style={
                selected
                  ? { boxShadow: `0 0 16px ${hex}88, 0 0 0 1px ${hex}40` }
                  : undefined
              }
            >
              {selected && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <Check className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-md" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  { id: 'dashboard', label: 'בית', icon: LayoutDashboard },
  { id: 'analytics', label: 'תובנות', icon: PieChartIcon },
  { id: 'subbudgets', label: 'תקציבים', icon: Wallet },
  { id: 'expenses', label: 'הוצאות', icon: Receipt },
] as const;
type TabId = (typeof TABS)[number]['id'];

type HistoryTimeFilter = 'daily' | 'weekly' | 'monthly' | 'yearly';

const HISTORY_TIME_FILTERS: { id: HistoryTimeFilter; label: string }[] = [
  { id: 'daily', label: 'יומי' },
  { id: 'weekly', label: 'שבועי' },
  { id: 'monthly', label: 'חודשי' },
  { id: 'yearly', label: 'שנתי' },
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
  const active = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const ActiveIcon = active.icon;

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
      aria-label="סגור תפריט"
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
        <span className="flex-1 text-right truncate">{tab.label}</span>
      </button>
    );
  };

  if (variant === 'mobile') {
    return (
      <>
        {backdrop}
        <div
          className="md:hidden fixed inset-x-0 bottom-0 z-50 flex flex-col items-center pointer-events-none"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          {/* Expanded tab stack (grows upward from FAB) */}
          <div
            className={`pointer-events-auto w-[min(100%,20rem)] px-4 mb-3 flex flex-col gap-2 transition-all duration-300 ease-in-out ${
              open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
            role="menu"
            aria-hidden={!open}
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
                <span className="flex-1 text-right">התנתק</span>
              </button>
            )}
          </div>

          {/* Collapsed / active FAB pill */}
          <button
            type="button"
            onClick={toggleOpen}
            aria-expanded={open}
            aria-haspopup="menu"
            className={`pointer-events-auto flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-slate-900 border shadow-2xl shadow-black/50 transition-all duration-300 ease-in-out active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
              open
                ? 'border-emerald-500/50 shadow-emerald-500/20'
                : 'border-slate-700 hover:border-slate-600'
            }`}
          >
            <span className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30">
              <ActiveIcon className="w-5 h-5 text-white" />
            </span>
            <span className="text-sm font-semibold text-slate-100 max-w-[8rem] truncate">{active.label}</span>
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
          <span className="text-slate-100">{active.label}</span>
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
                התנתק
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
          <span className="text-xl sm:text-2xl font-bold leading-none">₪{total.toLocaleString()}</span>
          <span className="text-[11px] text-neutral-500 mt-1">סה"כ</span>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        {legend.length === 0 ? (
          <p className="text-sm text-neutral-500">אין נתונים</p>
        ) : (
          legend.slice(0, 6).map((item) => (
            <div key={item.key} className="flex items-center gap-2.5 text-sm min-w-0">
              {item.icon && item.colorClass ? (
                <CategoryIconBadge icon={item.icon} colorClass={item.colorClass} size="compact" />
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
                {item.percentage > 0 ? `${item.percentage.toFixed(2)}%` : `₪${item.amount.toLocaleString()}`}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const formatDayLabel = (iso: string): string => {
  const d = parseISO(iso);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
};

// Tooltip / hover label for trend chart (e.g. "31 במאי" or "31/05/2026").
const formatTrendDateLabel = (iso: string): string => {
  const d = parseISO(iso);
  const short = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
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
  amountByDate: Record<string, number>
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
        dateLabel: formatTrendDateLabel(iso),
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
        dayLabel: d.toLocaleDateString('he-IL', { weekday: 'narrow' }),
        dateLabel: formatTrendDateLabel(iso),
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
      dayLabel: new Date(y, m, 1).toLocaleDateString('he-IL', { month: 'short' }),
      dateLabel: new Date(y, m, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' }),
      amount,
      hex: DAILY_SLICE_COLORS[m % DAILY_SLICE_COLORS.length],
    });
  }
  return { dailySeries: points, periodDayCount: 12 };
};

// Hebrew date string for trend tooltip (e.g. "31 במאי").
const formatTooltipHebrewDate = (iso: string): string => {
  const d = parseISO(iso);
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
};

interface TrendLineTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: TrendSeriesPoint }>;
}

function TrendLineTooltip({ active, payload }: TrendLineTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div
      className="!bg-slate-900 !p-4 !rounded-lg !border !border-slate-800 shadow-2xl shadow-black/70"
      style={{
        backgroundColor: '#0f172a',
        padding: '1rem',
        borderRadius: '0.5rem',
        border: '1px solid #1e293b',
        minWidth: '9.5rem',
      }}
    >
      <p className="!text-slate-400 text-sm leading-relaxed">
        תאריך:{' '}
        <span className="!text-slate-100 font-medium">{formatTooltipHebrewDate(point.iso)}</span>
      </p>
      <p className="!text-slate-400 text-sm leading-relaxed mt-1.5">
        סכום:{' '}
        <span className="!text-slate-100 font-bold tabular-nums">
          ₪{point.amount.toLocaleString()}
        </span>
      </p>
    </div>
  );
}

// Dark-themed analytics: swipeable category / daily donuts + daily trend line.
function ExpenseSummary({ expenses, categories }: ExpenseSummaryProps) {
  const [view, setView] = useState<SummaryView>('month');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [chartSlide, setChartSlide] = useState(0);
  const [touchUi, setTouchUi] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setTouchUi(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

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
        label: formatDayLabel(date),
        amount,
        hex: DAILY_SLICE_COLORS[i % DAILY_SLICE_COLORS.length],
        percentage: total > 0 ? (amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodExpenses, total]);

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
    return buildContinuousTrendSeries(view, anchor, amountByDate);
  }, [periodExpenses, view, anchor]);

  const average = periodDayCount > 0 ? total / periodDayCount : 0;
  const trendMax = Math.max(250, ...dailySeries.map((d) => d.amount), 1);

  let periodLabel = '';
  let periodSubtitle = '';
  if (view === 'year') {
    periodLabel = `${anchor.getFullYear()}`;
  } else if (view === 'month') {
    periodLabel = anchor.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  } else {
    periodLabel = `שבוע ${weekNumber(anchor)}`;
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
    else if (view === 'month') label = d.toLocaleDateString('he-IL', { month: 'short' });
    else label = `שבוע ${weekNumber(d)}`;

    return { offset, date: d, label };
  });

  const views: { id: SummaryView; label: string }[] = [
    { id: 'week', label: 'שבוע' },
    { id: 'month', label: 'חודש' },
    { id: 'year', label: 'שנה' },
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
          <h2 className="text-lg sm:text-xl font-bold">תובנות</h2>
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

        <div className="flex items-center gap-1 mt-4">
          <button
            onClick={() => shift(-1)}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 active:scale-95 transition-all"
            aria-label="קודם"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <div className="flex-1 overflow-x-auto no-scrollbar">
            <div className="flex items-center justify-between gap-1 min-w-max px-1">
              {chips.map((chip) => {
                const active = chip.offset === 0;
                return (
                  <button
                    key={chip.offset}
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
            onClick={() => shift(1)}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 active:scale-95 transition-all"
            aria-label="הבא"
          >
            <ChevronLeft className="w-5 h-5" />
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
                    <p className="text-sm text-neutral-400">אין הוצאות לפי תאריך בתקופה זו</p>
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
                      <span className="text-neutral-500">סה"כ: </span>
                      <span className="font-semibold text-neutral-100">₪{total.toLocaleString()}</span>
                    </p>
                    <p>
                      <span className="text-neutral-500">ממוצע: </span>
                      <span className="font-semibold text-neutral-100">₪{average.toFixed(2)}</span>
                    </p>
                  </div>
                </div>

                {dailySeries.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center">
                    <p className="text-sm text-neutral-500">אין נתונים לגרף</p>
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
                      >
                        <CartesianGrid stroke="#262626" strokeDasharray="4 4" vertical={false} />
                        <XAxis
                          dataKey="dayLabel"
                          tick={{ fill: '#737373', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          interval={view === 'month' ? 6 : view === 'year' ? 1 : 0}
                        />
                        <YAxis
                          domain={[0, trendMax]}
                          ticks={[0, Math.round(trendMax / 2), trendMax]}
                          tick={{ fill: '#737373', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          width={40}
                          tickFormatter={(v) => String(v)}
                        />
                        <Tooltip
                          trigger={touchUi ? 'click' : 'hover'}
                          content={(props) => <TrendLineTooltip {...props} />}
                          cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                          isAnimationActive={false}
                          allowEscapeViewBox={{ x: true, y: true }}
                          wrapperStyle={{
                            zIndex: 80,
                            outline: 'none',
                            pointerEvents: 'none',
                          }}
                          contentStyle={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            boxShadow: 'none',
                            padding: 0,
                            margin: 0,
                          }}
                          labelStyle={{ display: 'none' }}
                          itemStyle={{ display: 'none' }}
                          offset={16}
                        />
                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke="#64748b"
                          strokeWidth={2}
                          connectNulls
                          activeDot={(props) => {
                            const { cx, cy, payload } = props;
                            if (cx == null || cy == null || !payload) return null;
                            const p = payload as TrendSeriesPoint;
                            const fill = p.amount > 0 ? p.hex : '#94a3b8';
                            return (
                              <g>
                                <circle cx={cx} cy={cy} r={14} fill={fill} opacity={0.22} />
                                <circle
                                  cx={cx}
                                  cy={cy}
                                  r={9}
                                  fill={fill}
                                  stroke="#f8fafc"
                                  strokeWidth={2.5}
                                />
                              </g>
                            );
                          }}
                          dot={({ cx, cy, payload }) => {
                            if (cx == null || cy == null || !payload) return null;
                            const p = payload as TrendSeriesPoint;
                            const isZero = p.amount <= 0;
                            return (
                              <circle
                                cx={cx}
                                cy={cy}
                                r={isZero ? 4.5 : 6}
                                fill={isZero ? '#64748b' : p.hex}
                                stroke="#0a0a0a"
                                strokeWidth={2}
                                opacity={isZero ? 0.75 : 1}
                                style={{ cursor: 'pointer' }}
                              />
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

        {/* Carousel pagination dots */}
        <div
          className="flex justify-center items-center gap-2 mt-5"
          role="tablist"
          aria-label="תצוגות תובנות"
        >
          {Array.from({ length: ANALYTICS_SLIDE_COUNT }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={chartSlide === i}
              aria-label={`תצוגה ${i + 1}`}
              onClick={() => setChartSlide(i)}
              className={`rounded-full transition-all duration-300 ease-in-out ${
                chartSlide === i
                  ? 'w-6 h-2 bg-white shadow shadow-white/30'
                  : 'w-2 h-2 bg-neutral-600 hover:bg-neutral-500'
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
              <p className="text-neutral-400">אין הוצאות בתקופה זו</p>
              <p className="text-neutral-600 text-sm mt-1">בחר תקופה אחרת או הוסף הוצאות</p>
            </div>
          ) : (
            breakdown.map((b) => (
                <div key={b.value} className="flex items-center gap-3">
                  <CategoryIconBadge icon={b.icon} colorClass={b.color} size="large" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="font-semibold truncate">{b.label}</span>
                        <span className="text-xs text-neutral-500 shrink-0">
                          {b.percentage.toFixed(2)}%
                        </span>
                      </div>
                      <span className="font-semibold shrink-0">₪{b.amount.toLocaleString()}</span>
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
        הוצאות לפי קטגוריה
      </h2>

      <div
        dir="ltr"
        className="flex items-center justify-center gap-2 sm:gap-3 mb-4"
      >
        <button
          type="button"
          onClick={onPreviousDay}
          aria-label="יום קודם"
          title="יום קודם"
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
          aria-label="יום הבא"
          title="יום הבא"
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
          <p className="text-neutral-400">אין הוצאות בתאריך זה</p>
          <p className="text-neutral-500 text-sm mt-1">הוסף הוצאה כדי לראות את הפילוח</p>
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
              <span className="text-xl font-bold text-neutral-100 leading-none">
                ₪{total.toLocaleString()}
              </span>
              <span className="text-[11px] text-neutral-500 mt-1">סה"כ</span>
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
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [newSubBudgetColor, setNewSubBudgetColor] = useState(DEFAULT_CATEGORY_COLOR);

  const spentByCat = monthExpenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {});

  const budgetedValues = Object.keys(subBudgets).filter((v) => subBudgets[v] > 0);
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
      label: 'כללי / לא מוקצה',
      icon: Wallet,
      color: 'bg-gray-500',
      hex: '#737373',
      allocated: generalAllocated,
      spent: unbudgetedSpent,
      isGeneral: true,
    });
  }

  // Build the flat two-tone donut segments.
  const segments: { id: string; value: number; fill: string }[] = [];
  envelopes.forEach((env) => {
    if (env.allocated <= 0 && env.spent <= 0) return;
    const overspent = env.spent > env.allocated;
    if (overspent) {
      // The whole envelope (sized by spending) is shown in the warning color.
      segments.push({ id: `${env.key}-over`, value: Math.max(env.spent, env.allocated, 1), fill: WARNING_COLOR });
      return;
    }
    if (env.spent > 0) {
      segments.push({ id: `${env.key}-spent`, value: env.spent, fill: spentFill(env.hex) });
    }
    const remaining = env.allocated - env.spent;
    if (remaining > 0) {
      segments.push({ id: `${env.key}-remaining`, value: remaining, fill: remainingFill(env.hex) });
    }
  });

  const donutData =
    segments.length > 0 ? segments : [{ id: 'empty', value: 1, fill: '#262626' }];

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
          תקציבי משנה
        </h2>
        <p className="text-sm text-neutral-500 mt-1">חלוקת התקציב לקטגוריות • {monthLabel}</p>
      </div>

      {budget <= 0 ? (
        <div className="text-center py-8">
          <div className="bg-neutral-800 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
            <Wallet className="w-7 h-7 text-neutral-500" />
          </div>
          <p className="text-neutral-300">הגדר תחילה תקציב חודשי</p>
          <p className="text-neutral-500 text-sm mt-1">לאחר מכן תוכל לחלק אותו לתקציבי משנה</p>
        </div>
      ) : (
        <>
          {/* Two-tone donut */}
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 mx-auto">
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
                >
                  {donutData.map((s) => (
                    <Cell key={s.id} fill={s.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-neutral-100 leading-none">
                ₪{totalSpent.toLocaleString()}
              </span>
              <span className="text-[11px] text-neutral-500 mt-1">
                מתוך ₪{budget.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Tone legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: spentFill(hexForColor(DEFAULT_CATEGORY_COLOR)) }}
              />
              הוצא
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: remainingFill(hexForColor(DEFAULT_CATEGORY_COLOR)) }}
              />
              נותר
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: WARNING_COLOR }} />
              חריגה
            </span>
          </div>

          {/* Breakdown list with progress bars */}
          <div className="mt-6 space-y-4">
            {envelopes.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center">הוסף תקציב משנה כדי להתחיל</p>
            ) : (
              envelopes.map((env) => {
                const Icon = env.icon;
                const overspent = env.spent > env.allocated;
                const pct = env.allocated > 0 ? (env.spent / env.allocated) * 100 : env.spent > 0 ? 100 : 0;
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
                      <CategoryIconBadge icon={Icon} colorClass={env.color} size="large" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-neutral-100 truncate">{env.label}</span>
                          {overspent && (
                            <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3" />
                              חריגה
                            </span>
                          )}
                        </div>
                        <span className="text-sm shrink-0 text-neutral-300">
                          <span className={overspent ? 'text-rose-400 font-semibold' : 'text-neutral-100 font-semibold'}>
                            ₪{env.spent.toLocaleString()}
                          </span>
                          <span className="text-neutral-500"> / ₪{env.allocated.toLocaleString()}</span>
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-neutral-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(pct > 0 ? 3 : 0, pct))}%`,
                            backgroundColor: overspent ? WARNING_COLOR : env.hex,
                          }}
                        />
                      </div>
                    </div>
                    {!env.isGeneral && (
                      <button
                        onClick={() => onRemoveSubBudget(env.key)}
                        className="shrink-0 text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 p-2 rounded-lg transition-all"
                        title="הסר תקציב משנה"
                        aria-label="הסר תקציב משנה"
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
            <p className="text-xs font-medium text-neutral-400 mb-2">הוסף או עדכן תקציב משנה</p>
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
                placeholder="שם קטגוריה (תיווצר אוטומטית אם חדשה)"
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
                  placeholder="₪ סכום"
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
                  הוסף
                </button>
              </div>
            </div>

            <div className="mt-4">
              <CategoryColorPicker
                value={newSubBudgetColor}
                onChange={setNewSubBudgetColor}
                label="צבע לקטגוריה חדשה"
              />
              <p className="text-[11px] text-neutral-500 mt-2">
                צבע נשמר בקטגוריה ומשמש בגרפים ובפסי התקדמות. לקטגוריה קיימת נשמר הצבע המקורי.
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
                      <span className="text-sm text-neutral-300 flex-1 truncate">{cat?.label ?? v}</span>
                      <span className="text-neutral-500 text-sm">₪</span>
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
                  <span className="text-neutral-500">
                    מוקצה: ₪{allocatedTotal.toLocaleString()} מתוך ₪{budget.toLocaleString()}
                  </span>
                  <span className={allocatedTotal > budget ? 'text-rose-400 font-medium' : 'text-neutral-500'}>
                    {allocatedTotal > budget
                      ? `חריגה מהתקציב ב-₪${(allocatedTotal - budget).toLocaleString()}`
                      : `לא מוקצה: ₪${generalAllocated.toLocaleString()}`}
                  </span>
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
  // Close on Escape for keyboard users.
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
      title: 'השאר את תתי-התקציבים כפי שהם',
      desc: 'תתי-התקציבים שהגיעו מהחודש הקודם יישארו ללא שינוי.',
      accent: 'hover:border-emerald-500/60 hover:bg-emerald-500/5',
      ring: 'focus-visible:ring-emerald-500/40',
      iconBg: 'bg-emerald-500/15 text-emerald-400',
    },
    {
      mode: 'reset',
      icon: RotateCcw,
      title: 'אפס את תתי-התקציבים לחודש זה',
      desc: 'סכומי ההקצאה לחודש זה יתאפסו, ותוכל להגדיר אותם מחדש.',
      accent: 'hover:border-amber-500/60 hover:bg-amber-500/5',
      ring: 'focus-visible:ring-amber-500/40',
      iconBg: 'bg-amber-500/15 text-amber-400',
    },
  ];

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="budget-modal-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        onClick={onClose}
        aria-label="סגור"
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
              שינית את התקציב החודשי, מה לגבי תתי-התקציבים?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 -mt-1 -ml-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 p-2 rounded-lg transition-all"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-neutral-400 leading-relaxed mb-4">
          זיהינו עדכון בתקציב הכללי. כיצד תרצה לנהל את תתי-התקציבים והקטגוריות שלך לחודש זה?
        </p>

        {/* Old -> new budget summary */}
        <div className="flex items-center justify-between gap-3 bg-neutral-800/60 border border-neutral-700/60 rounded-2xl px-4 py-3 mb-5">
          <span className="text-xs text-neutral-500 capitalize truncate">{monthLabel}</span>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm text-neutral-500 line-through">₪{currentBudget.toLocaleString()}</span>
            <ChevronLeft className="w-4 h-4 text-neutral-600" />
            <span className="text-base font-bold text-emerald-400">₪{newBudget.toLocaleString()}</span>
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
          ביטול
        </button>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dataReady, setDataReady] = useState(false);

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
    category: 'אוכל',
    date: toISODate(new Date()),
  });
  const [showBudgetSaved, setShowBudgetSaved] = useState(false);

  // Active top-level navigation tab.
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [navOpen, setNavOpen] = useState(false);
  const chartDateSetterRef = useRef<((iso: string) => void) | null>(null);

  const handleTabSelect = (id: TabId) => {
    setActiveTab(id);
    setNavOpen(false);
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
    ...CATEGORIES,
    ...customCategories.map((c) => ({
      value: c.value,
      label: c.label,
      color: c.color,
      icon: resolveIcon(c.iconName),
    })),
  ];

  // The month currently in focus ('YYYY-MM') and its budget + sub-budgets.
  // Deriving these keeps the rest of the component working with simple values.
  const selectedMonthKey = monthKeyOfDate(selectedDate);
  const budget = budgetsByMonth[selectedMonthKey] ?? 0;
  const subBudgets = subBudgetsByMonth[selectedMonthKey] ?? {};

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
      category: 'אוכל',
      date: toISODate(new Date()),
    });
  };

  // Load persisted data when auth state changes (Firestore for signed-in users, localStorage for guests).
  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;

    const loadUserData = async () => {
      setDataReady(false);

      if (!user) {
        resetAppData();
        if (!cancelled) setDataReady(true);
        return;
      }

      if (user.isAnonymous) {
        if (!cancelled) applyAppData(loadFromLocalStorage());
        if (!cancelled) setDataReady(true);
        return;
      }

      try {
        const remoteData = await loadFromFirestore(user.uid);
        if (cancelled) return;
        applyAppData(remoteData ?? EMPTY_USER_APP_DATA);
      } catch {
        if (!cancelled) applyAppData(EMPTY_USER_APP_DATA);
      }

      if (!cancelled) setDataReady(true);
    };

    void loadUserData();

    return () => {
      cancelled = true;
    };
  }, [user, authReady]);

  // Persist changes: Firestore for authenticated users, localStorage for guests.
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

    const uid = user.uid;
    const timer = window.setTimeout(() => {
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== uid || currentUser.isAnonymous) return;
      void saveToFirestore(uid, payload).catch(() => {
        // Sync failures are non-blocking; data remains in local state until the next save.
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [expenses, customCategories, budgetsByMonth, subBudgetsByMonth, dataReady, user]);

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
    const amount = parseFloat(newExpense.amount);

    if (newExpense.description.trim() && !isNaN(amount) && amount > 0) {
      const isoDate = normalizeDate(newExpense.date);
      const expense: Expense = {
        id: Date.now().toString(),
        description: newExpense.description.trim(),
        amount: amount,
        category: newExpense.category,
        date: isoDate,
      };

      setExpenses([expense, ...expenses]);
      setNewExpense({ description: '', amount: '', category: 'אוכל', date: toISODate(new Date()) });

      chartDateSetterRef.current?.(isoDate);

      // Jump the view to the month of the new expense so it's immediately visible.
      const [y, m] = isoDate.split('-').map((n) => parseInt(n, 10));
      setSelectedDate(new Date(y, m - 1, 1));
    }
  };

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
      setCategoryError('יש להזין שם קטגוריה');
      return;
    }
    if (name === ADD_CUSTOM_VALUE) {
      setCategoryError('שם לא חוקי');
      return;
    }

    const exists = allCategories.some((c) => c.value === name);
    if (exists) {
      setCategoryError('קטגוריה בשם זה כבר קיימת');
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

    const chosenColor = COLOR_OPTIONS.some((c) => c.class === colorClass)
      ? colorClass
      : DEFAULT_CATEGORY_COLOR;

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
  const monthLabel = selectedDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
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

  // Reusable month selector (used on Dashboard & Sub-Budgets pages).
  const monthSelector = (
    <div className="bg-neutral-900 rounded-2xl shadow-lg shadow-black/20 border border-neutral-800 p-3 sm:p-4 mb-6 sm:mb-8">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => goToMonth(-1)}
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 active:scale-95 transition-all"
          aria-label="חודש קודם"
          title="חודש קודם"
        >
          <ChevronRight className="w-6 h-6" />
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
              חזרה לחודש הנוכחי
            </button>
          )}
        </div>

        <button
          onClick={() => goToMonth(1)}
          className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl text-neutral-400 hover:bg-neutral-800 active:scale-95 transition-all"
          aria-label="חודש הבא"
          title="חודש הבא"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      </div>
    </div>
  );

  if (!authReady || (user && !dataReady)) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-slate-950 flex items-center justify-center text-neutral-100"
      >
        <Loader2 className="w-9 h-9 text-emerald-500 animate-spin" aria-label="טוען" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  const userDisplayLabel = user.isAnonymous ? 'אורח' : (user.email ?? '');
  const userName = user.isAnonymous
    ? 'אורח'
    : (user.displayName || user.email?.split('@')[0] || 'משתמש');

  return (
    <motion.div
      dir="rtl"
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
                <h1 className="text-lg sm:text-2xl font-bold text-neutral-100 truncate">מנהל התקציב שלי</h1>
                <p className="text-neutral-400 text-xs truncate hidden sm:block">נהל את ההוצאות שלך בצורה חכמה</p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <UserProfileMenu user={user} userName={userName} onLogout={handleLogout} />
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
        {/* ============================ DASHBOARD ============================ */}
        {activeTab === 'dashboard' && (
          <>
            {monthSelector}

            {/* Budget Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Total Budget Card */}
          <div className="bg-neutral-900 rounded-2xl shadow-lg shadow-black/20 border border-neutral-800 p-4 sm:p-6 hover:border-neutral-700 transition-colors">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-sm font-medium text-neutral-400">תקציב חודשי</span>
              <div className="bg-emerald-500/15 p-2 rounded-lg">
                <Wallet className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-neutral-100">₪{budget.toLocaleString()}</p>
            <p className="text-sm text-neutral-500 mt-2">הסכום שהוקצב להוצאות</p>
          </div>

          {/* Total Expenses Card */}
          <div className="bg-neutral-900 rounded-2xl shadow-lg shadow-black/20 border border-neutral-800 p-4 sm:p-6 hover:border-neutral-700 transition-colors">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-sm font-medium text-neutral-400">סה"כ הוצאות</span>
              <div className="bg-rose-500/15 p-2 rounded-lg">
                <TrendingDown className="w-5 h-5 text-rose-400" />
              </div>
            </div>
            <p className={`text-2xl sm:text-3xl font-bold ${isOverBudget ? 'text-rose-400' : 'text-neutral-100'}`}>
              ₪{totalExpenses.toLocaleString()}
            </p>
            <p className="text-sm text-neutral-500 mt-2">
              {monthExpenses.length} הוצאות ב{monthLabel}
            </p>
          </div>

          {/* Budget Status Card */}
          <div className={`rounded-2xl shadow-lg shadow-black/20 border p-4 sm:p-6 transition-colors sm:col-span-2 md:col-span-1 ${
            isOverBudget
              ? 'bg-rose-500/10 border-rose-500/40'
              : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
          }`}>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-sm font-medium text-neutral-400">מצב התקציב</span>
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
                חרגת מהתקציב!
              </div>
            )}

            <p className={`text-2xl font-bold ${isOverBudget ? 'text-rose-400' : 'text-neutral-100'}`}>
              {remaining >= 0 ? `₪${remaining.toLocaleString()}` : `-₪${Math.abs(remaining).toLocaleString()}`}
            </p>
            <p className="text-sm text-neutral-500 mt-2">
              {remaining >= 0 ? 'נותר בתקציב' : 'חריגה מהתקציב'}
            </p>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-neutral-400 mb-1">
                <span>ניצולת</span>
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
        <div className="bg-neutral-900 rounded-2xl shadow-lg shadow-black/20 border border-neutral-800 p-4 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg font-semibold text-neutral-100 mb-4 sm:mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-400" />
            הוסף הוצאה חדשה
          </h2>

          <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">תיאור</label>
              <input
                type="text"
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                placeholder="לדוגמה: סופר, דלק"
                className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">סכום (₪)</label>
              <input
                type="number"
                inputMode="decimal"
                value={newExpense.amount}
                onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">תאריך</label>
              <input
                type="date"
                value={newExpense.date}
                onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base [color-scheme:dark]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">קטגוריה</label>
              <select
                value={newExpense.category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base"
              >
                {allCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
                <option value={ADD_CUSTOM_VALUE}>+ הוסף קטגוריה חדשה</option>
              </select>

              {isAddingCategory && (
                <div className="mt-3 p-4 bg-neutral-800/60 border border-emerald-500/30 rounded-xl space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                      שם הקטגוריה
                    </label>
                    <input
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => {
                        setNewCategoryName(e.target.value);
                        if (categoryError) setCategoryError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategory();
                        }
                      }}
                      placeholder="לדוגמה: תחבורה, מתנות"
                      autoFocus
                      className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base"
                    />
                  </div>

                  <CategoryColorPicker value={newCategoryColor} onChange={setNewCategoryColor} />

                  {/* Icon picker */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">אייקון</label>
                    <div className="flex flex-wrap gap-2.5">
                      {ICON_OPTIONS.map((o) => {
                        const IconComp = o.icon;
                        const selected = newCategoryIcon === o.name;
                        return (
                          <button
                            key={o.name}
                            type="button"
                            onClick={() => setNewCategoryIcon(o.name)}
                            aria-label={o.name}
                            className={`w-11 h-11 rounded-lg flex items-center justify-center transition-all ${
                              selected
                                ? 'bg-emerald-500 text-white ring-2 ring-offset-2 ring-offset-neutral-800 ring-emerald-400'
                                : 'bg-neutral-900 text-neutral-400 border border-neutral-700 hover:border-emerald-500 hover:text-emerald-400 active:scale-95'
                            }`}
                          >
                            <IconComp className="w-5 h-5" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Live preview */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400">תצוגה מקדימה:</span>
                    {(() => {
                      const PreviewIcon = resolveIcon(newCategoryIcon);
                      return (
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${newCategoryColor} text-white`}
                        >
                          <PreviewIcon className="w-4 h-4" />
                          {newCategoryName.trim() || 'קטגוריה חדשה'}
                        </span>
                      );
                    })()}
                  </div>

                  {categoryError && (
                    <p className="text-rose-400 text-xs">{categoryError}</p>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAddCategory}
                      className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:from-emerald-600 hover:to-teal-700 transition-all flex items-center justify-center gap-1 active:scale-[0.98]"
                    >
                      <Plus className="w-4 h-4" />
                      הוסף קטגוריה
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelAddCategory}
                      className="shrink-0 text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 p-2.5 rounded-lg transition-all"
                      title="ביטול"
                      aria-label="ביטול"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-xl font-medium hover:from-emerald-600 hover:to-teal-700 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                <Plus className="w-5 h-5" />
                הוסף הוצאה
              </button>
            </div>
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
              <h2 className="text-base sm:text-lg font-semibold text-neutral-100 mb-4">הגדר תקציב חודשי</h2>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
                <div className="flex-1 sm:max-w-xs">
                  <label className="block text-sm font-medium text-neutral-300 mb-2">סכום התקציב (₪)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    placeholder={budget > 0 ? `נוכחי: ₪${budget.toLocaleString()}` : 'הזן סכום'}
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
                      נשמר!
                    </>
                  ) : (
                    'עדכן תקציב'
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
            <h2 className="text-base sm:text-lg font-semibold text-neutral-100">היסטוריית הוצאות</h2>
            <p className="text-sm text-neutral-500 mt-1">
              {historyExpenses.length} הוצאות • סה"כ ₪{historyTotal.toLocaleString()}
            </p>

            <div
              className="flex p-1 rounded-2xl bg-neutral-950/80 border border-neutral-800 mt-4"
              role="tablist"
              aria-label="סינון לפי תקופה"
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
                    <span className="relative z-10">{filter.label}</span>
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
                placeholder="חיפוש לפי תיאור או קטגוריה"
                className="w-full pr-11 pl-9 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 outline-none transition-all text-base"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 p-1.5 rounded-lg"
                  aria-label="נקה חיפוש"
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
                {search ? 'לא נמצאו תוצאות' : expenses.length === 0 ? 'אין הוצאות עדיין' : 'אין הוצאות בתקופה הנבחרת'}
              </p>
              <p className="text-neutral-500 text-sm mt-1">
                {search
                  ? 'נסה מונח חיפוש אחר'
                  : expenses.length === 0
                    ? 'הוסף את ההוצאה הראשונה שלך בעמוד הבית'
                    : 'נסה תקופת זמן אחרת או הוסף הוצאה חדשה'}
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
                          <p className="font-medium text-neutral-100 truncate">{expense.description}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                            <span className="truncate">{expense.category}</span>
                            <span className="text-neutral-600">•</span>
                            <span className="shrink-0">{formatDisplayDate(expense.date)}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-left">
                          <p className="text-base font-semibold text-neutral-100 whitespace-nowrap">
                            ₪{expense.amount.toLocaleString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="shrink-0 text-neutral-500 hover:text-rose-400 active:bg-rose-500/10 p-2.5 rounded-lg transition-all"
                          title="מחק"
                          aria-label="מחק הוצאה"
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
                      <th className="text-right px-6 py-4 text-sm font-semibold text-neutral-400">תיאור</th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-neutral-400">סכום</th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-neutral-400">קטגוריה</th>
                      <th className="text-right px-6 py-4 text-sm font-semibold text-neutral-400">תאריך</th>
                      <th className="px-6 py-4 text-sm font-semibold text-neutral-400">פעולות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {historyExpenses.map((expense) => {
                      const categoryInfo = getCategoryInfo(expense.category);
                      const IconComponent = categoryInfo.icon;

                      return (
                        <tr key={expense.id} className="hover:bg-neutral-800/40 transition-colors">
                          <td className="px-6 py-4">
                            <span className="font-medium text-neutral-100">{expense.description}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-lg font-semibold text-neutral-100">
                              ₪{expense.amount.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-white ${categoryInfo.color}`}>
                              <IconComponent className="w-4 h-4" />
                              {expense.category}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-neutral-400">
                            {formatDisplayDate(expense.date)}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 p-2 rounded-lg transition-all"
                              title="מחק"
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
      </main>

      {/* Footer (desktop only; mobile uses the bottom nav) */}
      <footer className="hidden md:block border-t border-neutral-800 bg-neutral-900 mt-8 sm:mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-neutral-500">
            מנהל התקציב שלי - נהל את הכסף שלך בצורה חכמה
          </p>
        </div>
      </footer>

      {/* Mobile floating action menu (collapsed FAB by default) */}
      <CollapsibleNavMenu
        variant="mobile"
        activeTab={activeTab}
        open={navOpen}
        onOpenChange={setNavOpen}
        onTabSelect={handleTabSelect}
        userEmail={userDisplayLabel}
        onLogout={handleLogout}
      />

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
