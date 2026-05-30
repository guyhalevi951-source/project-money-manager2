import { useState, useEffect } from 'react';
import {
  Wallet,
  TrendingDown,
  AlertTriangle,
  Plus,
  Trash2,
  Check,
  Utensils,
  Heart,
  Film,
  Home,
  HelpCircle,
  Tag,
  X,
  ShoppingBag,
  Car,
  Gift,
  ChevronRight,
  ChevronLeft,
  CalendarDays,
  PieChart as PieChartIcon,
  LayoutDashboard,
  Receipt,
  Search,
  RotateCcw,
  Layers,
  type LucideIcon
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  // Canonical date stored as ISO 'YYYY-MM-DD' for reliable month filtering.
  date: string;
}

interface Category {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

const CATEGORIES: Category[] = [
  { value: 'אוכל', label: 'אוכל', icon: Utensils, color: 'bg-amber-500' },
  { value: 'בריאות', label: 'בריאות', icon: Heart, color: 'bg-rose-500' },
  { value: 'בילויים', label: 'בילויים', icon: Film, color: 'bg-purple-500' },
  { value: 'שכר דירה', label: 'שכר דירה', icon: Home, color: 'bg-cyan-500' },
  { value: 'אחר', label: 'אחר', icon: HelpCircle, color: 'bg-gray-500' },
];

// Sentinel value used by the category <select> to trigger the "add custom" flow
const ADD_CUSTOM_VALUE = '__add_custom__';

// Icons can't be serialized to localStorage, so custom categories store an icon
// *name* and we resolve it back to a component through this registry.
const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'Tag', icon: Tag },
  { name: 'Heart', icon: Heart },
  { name: 'Utensils', icon: Utensils },
  { name: 'ShoppingBag', icon: ShoppingBag },
  { name: 'Car', icon: Car },
  { name: 'Home', icon: Home },
  { name: 'Gift', icon: Gift },
  { name: 'Film', icon: Film },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.name, o.icon])
);

const resolveIcon = (name: string): LucideIcon => ICON_MAP[name] ?? Tag;

// Pre-defined badge colors the user can pick from when creating a category.
const COLOR_OPTIONS: { name: string; class: string }[] = [
  { name: 'אמרלד', class: 'bg-emerald-500' },
  { name: 'סגול', class: 'bg-purple-500' },
  { name: 'כחול', class: 'bg-blue-500' },
  { name: 'ענבר', class: 'bg-amber-500' },
  { name: 'ורוד', class: 'bg-rose-500' },
  { name: 'טורקיז', class: 'bg-teal-500' },
  { name: 'אינדיגו', class: 'bg-indigo-500' },
  { name: 'כתום', class: 'bg-orange-500' },
];

// --- Date helpers -----------------------------------------------------------
const pad2 = (n: number) => String(n).padStart(2, '0');

// ISO date string ('YYYY-MM-DD') in local time.
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Month bucket key ('YYYY-MM') used to group/filter expenses.
const monthKeyOf = (iso: string) => iso.slice(0, 7);
const monthKeyOfDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

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

// Maps Tailwind background color classes to hex values for recharts / inline styles.
const TAILWIND_HEX: Record<string, string> = {
  'bg-amber-500': '#f59e0b',
  'bg-rose-500': '#f43f5e',
  'bg-purple-500': '#a855f7',
  'bg-cyan-500': '#06b6d4',
  'bg-gray-500': '#6b7280',
  'bg-emerald-500': '#10b981',
  'bg-blue-500': '#3b82f6',
  'bg-teal-500': '#14b8a6',
  'bg-indigo-500': '#6366f1',
  'bg-orange-500': '#f97316',
  'bg-pink-500': '#ec4899',
  'bg-lime-600': '#65a30d',
  'bg-fuchsia-500': '#d946ef',
  'bg-sky-500': '#0ea5e9',
  'bg-red-500': '#ef4444',
};
const hexForColor = (colorClass: string): string => TAILWIND_HEX[colorClass] ?? '#64748b';

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
// Darker, vivid tone = amount already SPENT.
const spentShade = (hex: string) => mixHex(hex, '#000000', 0.12);
// Soft, dimmed tone (toward the dark bg) = REMAINING budget.
const remainingShade = (hex: string) => mixHex(hex, '#0a0a0a', 0.62);
// Bright warning color for overspent envelopes.
const WARNING_COLOR = '#ef4444';
const GENERAL_KEY = '__general__';

type SummaryView = 'week' | 'month' | 'year';

// Top-level navigation tabs.
const TABS = [
  { id: 'dashboard', label: 'בית', icon: LayoutDashboard },
  { id: 'analytics', label: 'אנליטיקה', icon: PieChartIcon },
  { id: 'subbudgets', label: 'תקציבים', icon: Wallet },
  { id: 'expenses', label: 'הוצאות', icon: Receipt },
] as const;
type TabId = (typeof TABS)[number]['id'];

interface ExpenseSummaryProps {
  expenses: Expense[];
  categories: Category[];
}

// Dark-themed visual breakdown of expenses by category, per week / month / year.
function ExpenseSummary({ expenses, categories }: ExpenseSummaryProps) {
  const [view, setView] = useState<SummaryView>('month');
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const shift = (dir: number) => {
    setAnchor((a) => {
      const x = new Date(a);
      if (view === 'week') x.setDate(x.getDate() + dir * 7);
      else if (view === 'month') x.setMonth(x.getMonth() + dir);
      else x.setFullYear(x.getFullYear() + dir);
      return x;
    });
  };

  // Does the given ISO expense date fall inside the currently selected period?
  const inPeriod = (iso: string): boolean => {
    const d = parseISO(iso);
    if (view === 'year') return d.getFullYear() === anchor.getFullYear();
    if (view === 'month')
      return d.getFullYear() === anchor.getFullYear() && d.getMonth() === anchor.getMonth();
    const s = startOfWeek(anchor);
    const e = endOfWeek(anchor);
    return d >= s && d <= new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59);
  };

  const periodExpenses = expenses.filter((e) => inPeriod(e.date));
  const total = periodExpenses.reduce((sum, e) => sum + e.amount, 0);

  const fallbackCat = categories[categories.length - 1];
  const getCat = (value: string): Category =>
    categories.find((c) => c.value === value) || fallbackCat;

  // Aggregate by category, sorted by amount desc.
  const breakdown = Object.values(
    periodExpenses.reduce<Record<string, { value: string; amount: number }>>((acc, e) => {
      acc[e.category] = acc[e.category] || { value: e.category, amount: 0 };
      acc[e.category].amount += e.amount;
      return acc;
    }, {})
  )
    .map((g) => {
      const cat = getCat(g.value);
      return {
        value: g.value,
        label: cat?.label ?? g.value,
        color: cat?.color ?? 'bg-gray-500',
        hex: hexForColor(cat?.color ?? 'bg-gray-500'),
        icon: cat?.icon ?? HelpCircle,
        amount: g.amount,
        percentage: total > 0 ? (g.amount / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const donutData =
    breakdown.length > 0
      ? breakdown.map((b) => ({ name: b.label, value: b.amount, hex: b.hex }))
      : [{ name: '', value: 1, hex: '#27272a' }];

  // Period label + optional subtitle (week date range).
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

  // Build the horizontally scrollable period chips around the anchor.
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

  return (
    <div className="max-w-2xl mx-auto">
      <div>
        {/* Page title */}
        <div className="flex items-center gap-2 mb-4 text-neutral-100">
          <PieChartIcon className="w-6 h-6 text-emerald-400" />
          <h2 className="text-lg sm:text-xl font-bold">אנליטיקה</h2>
        </div>

        {/* Week / Month / Year segmented control */}
        <div className="flex p-1 bg-neutral-900 border border-neutral-800 rounded-2xl">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                view === v.id
                  ? 'bg-white text-neutral-900 shadow'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Period selector: prev/next + scrollable chips */}
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

        {/* Selected period label */}
        <div className="mt-3 text-center">
          <p className="text-base font-semibold capitalize">{periodLabel}</p>
          {periodSubtitle && <p className="text-xs text-neutral-500 mt-0.5">{periodSubtitle}</p>}
        </div>

        {/* Donut + legend */}
        <div className="mt-6 flex items-center gap-4">
          <div className="relative w-40 h-40 sm:w-48 sm:h-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="62%"
                  outerRadius="100%"
                  paddingAngle={breakdown.length > 1 ? 2 : 0}
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
              <span className="text-xl sm:text-2xl font-bold leading-none">
                ₪{total.toLocaleString()}
              </span>
              <span className="text-[11px] text-neutral-500 mt-1">סה"כ</span>
            </div>
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            {breakdown.length === 0 ? (
              <p className="text-sm text-neutral-500">אין נתונים</p>
            ) : (
              breakdown.slice(0, 5).map((b) => (
                <div key={b.value} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border-[3px]"
                    style={{ borderColor: b.hex }}
                  />
                  <span className="text-neutral-300 truncate flex-1">{b.label}</span>
                  <span className="text-neutral-400 font-medium shrink-0">
                    {b.percentage.toFixed(2)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detailed breakdown list */}
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
            breakdown.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.value} className="flex items-center gap-3">
                  <div
                    className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: b.hex }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
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
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

interface Envelope {
  key: string;
  label: string;
  icon: LucideIcon;
  hex: string;
  allocated: number;
  spent: number;
  isGeneral: boolean;
}

interface SpendingDonutProps {
  monthExpenses: Expense[];
  categories: Category[];
  monthLabel: string;
}

// Compact donut of how much was spent per category in the selected month.
function SpendingDonut({ monthExpenses, categories, monthLabel }: SpendingDonutProps) {
  const total = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const getCat = (value: string) =>
    categories.find((c) => c.value === value) || categories[categories.length - 1];

  const breakdown = Object.values(
    monthExpenses.reduce<Record<string, { value: string; amount: number }>>((acc, e) => {
      acc[e.category] = acc[e.category] || { value: e.category, amount: 0 };
      acc[e.category].amount += e.amount;
      return acc;
    }, {})
  )
    .map((g) => {
      const cat = getCat(g.value);
      return {
        value: g.value,
        label: cat?.label ?? g.value,
        hex: hexForColor(cat?.color ?? 'bg-gray-500'),
        amount: g.amount,
        percentage: total > 0 ? (g.amount / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const donutData =
    breakdown.length > 0
      ? breakdown.map((b) => ({ id: b.value, value: b.amount, hex: b.hex }))
      : [{ id: 'empty', value: 1, hex: '#262626' }];

  return (
    <div className="bg-neutral-900 rounded-2xl shadow-lg shadow-black/20 border border-neutral-800 p-4 sm:p-6 mb-6 sm:mb-8">
      <h2 className="text-base sm:text-lg font-semibold text-neutral-100 flex items-center gap-2 mb-1">
        <PieChartIcon className="w-5 h-5 text-emerald-400" />
        הוצאות לפי קטגוריה
      </h2>
      <p className="text-sm text-neutral-500 mb-4">{monthLabel}</p>

      {breakdown.length === 0 ? (
        <div className="text-center py-8">
          <div className="bg-neutral-800 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3">
            <TrendingDown className="w-7 h-7 text-neutral-500" />
          </div>
          <p className="text-neutral-400">אין הוצאות החודש</p>
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

          <div className="flex-1 w-full min-w-0 space-y-2.5">
            {breakdown.slice(0, 6).map((b) => (
              <div key={b.value} className="flex items-center gap-2 text-sm">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: b.hex }} />
                <span className="text-neutral-300 truncate flex-1">{b.label}</span>
                <span className="text-neutral-500 shrink-0">{b.percentage.toFixed(0)}%</span>
                <span className="text-neutral-100 font-medium shrink-0 w-20 text-left">
                  ₪{b.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface SubBudgetTrackerProps {
  budget: number;
  monthLabel: string;
  monthExpenses: Expense[];
  categories: Category[];
  subBudgets: Record<string, number>;
  onAddSubBudget: (name: string, amount: number) => void;
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
      const cat = categories.find((c) => c.value === v);
      return {
        key: v,
        label: cat?.label ?? v,
        icon: cat?.icon ?? HelpCircle,
        hex: hexForColor(cat?.color ?? 'bg-gray-500'),
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
      segments.push({ id: `${env.key}-spent`, value: env.spent, fill: spentShade(env.hex) });
    }
    const remaining = env.allocated - env.spent;
    if (remaining > 0) {
      segments.push({ id: `${env.key}-remaining`, value: remaining, fill: remainingShade(env.hex) });
    }
  });

  const donutData =
    segments.length > 0 ? segments : [{ id: 'empty', value: 1, fill: '#262626' }];

  const handleAdd = () => {
    const amt = parseFloat(amount);
    if (name.trim() && !isNaN(amt) && amt > 0) {
      onAddSubBudget(name, amt);
      setName('');
      setAmount('');
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
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: spentShade('#10b981') }} />
              הוצא
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: remainingShade('#10b981') }} />
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
                    <div
                      className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white"
                      style={{ backgroundColor: overspent ? WARNING_COLOR : env.hex }}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
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

            {/* Quick-edit allocations for existing sub-budgets */}
            {budgetedValues.length > 0 && (
              <div className="mt-3 space-y-2">
                {budgetedValues.map((v) => {
                  const cat = categories.find((c) => c.value === v);
                  return (
                    <div key={v} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: hexForColor(cat?.color ?? 'bg-gray-500') }}
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

type BudgetChangeMode = 'keep' | 'reset' | 'clear';

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
      title: 'השאר את תתי-התקציבים והקטגוריות בדיוק כמו שהם',
      desc: 'כל הקטגוריות והסכומים שהוקצו להן יישארו ללא שינוי.',
      accent: 'hover:border-emerald-500/60 hover:bg-emerald-500/5',
      ring: 'focus-visible:ring-emerald-500/40',
      iconBg: 'bg-emerald-500/15 text-emerald-400',
    },
    {
      mode: 'reset',
      icon: RotateCcw,
      title: 'שמור על הקטגוריות, אך אפס את סכומי התקציב שלהן',
      desc: 'הקטגוריות יישמרו, אך הסכומים יתאפסו כדי שתוכל להקצות מחדש.',
      accent: 'hover:border-amber-500/60 hover:bg-amber-500/5',
      ring: 'focus-visible:ring-amber-500/40',
      iconBg: 'bg-amber-500/15 text-amber-400',
    },
    {
      mode: 'clear',
      icon: Trash2,
      title: 'אפס הכל לחלוטין לחודש זה',
      desc: 'הסרת כל תתי-התקציבים של חודש זה והתחלה מאפס.',
      accent: 'hover:border-rose-500/60 hover:bg-rose-500/5',
      ring: 'focus-visible:ring-rose-500/40',
      iconBg: 'bg-rose-500/15 text-rose-400',
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

  // Search query for the Expenses history page.
  const [search, setSearch] = useState('');

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
  const [newCategoryColor, setNewCategoryColor] = useState(COLOR_OPTIONS[0].class);
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

  // Load data from localStorage on mount
  useEffect(() => {
    const savedExpenses = localStorage.getItem('expenses');
    const savedCategories = localStorage.getItem('customCategories');
    const thisMonth = monthKeyOfDate(new Date());

    if (savedExpenses) {
      const parsed: Expense[] = JSON.parse(savedExpenses);
      // Migrate any legacy (he-IL) dates to the canonical ISO format.
      setExpenses(parsed.map((e) => ({ ...e, date: normalizeDate(e.date) })));
    }
    if (savedCategories) {
      setCustomCategories(JSON.parse(savedCategories));
    }

    // Per-month budget (migrate legacy single global budget into this month).
    const savedBudgets = localStorage.getItem('budgetsByMonth');
    const legacyBudget = localStorage.getItem('monthlyBudget');
    if (savedBudgets) {
      setBudgetsByMonth(JSON.parse(savedBudgets));
    } else if (legacyBudget) {
      setBudgetsByMonth({ [thisMonth]: parseFloat(legacyBudget) });
    }

    // Per-month sub-budgets (migrate legacy flat map into this month).
    const savedSubByMonth = localStorage.getItem('subBudgetsByMonth');
    const legacySub = localStorage.getItem('subBudgets');
    if (savedSubByMonth) {
      setSubBudgetsByMonth(JSON.parse(savedSubByMonth));
    } else if (legacySub) {
      setSubBudgetsByMonth({ [thisMonth]: JSON.parse(legacySub) });
    }
  }, []);

  // Save custom categories to localStorage
  useEffect(() => {
    localStorage.setItem('customCategories', JSON.stringify(customCategories));
  }, [customCategories]);

  // Save per-month sub-budgets to localStorage
  useEffect(() => {
    localStorage.setItem('subBudgetsByMonth', JSON.stringify(subBudgetsByMonth));
  }, [subBudgetsByMonth]);

  // Save per-month budgets to localStorage
  useEffect(() => {
    localStorage.setItem('budgetsByMonth', JSON.stringify(budgetsByMonth));
  }, [budgetsByMonth]);

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

    if (mode === 'reset' || mode === 'clear') {
      // Wipe this month's allocations only.
      setSubBudgetsByMonth((prev) => ({ ...prev, [selectedMonthKey]: {} }));
    }

    if (mode === 'clear') {
      // "Start fresh": remove custom categories that aren't referenced anywhere
      // else (no expenses in any month, no allocations in other months) so
      // historical data stays intact.
      setCustomCategories((prev) =>
        prev.filter((c) => {
          const usedByExpense = expenses.some((e) => e.category === c.value);
          const usedOtherMonth = Object.entries(subBudgetsByMonth).some(
            ([mk, map]) => mk !== selectedMonthKey && (map?.[c.value] ?? 0) > 0
          );
          return usedByExpense || usedOtherMonth;
        })
      );
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

  // Save expenses to localStorage
  useEffect(() => {
    localStorage.setItem('expenses', JSON.stringify(expenses));
  }, [expenses]);

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
    setNewCategoryColor(COLOR_OPTIONS[0].class);
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
  const handleAddSubBudget = (rawName: string, amount: number) => {
    const trimmed = rawName.trim();
    if (!trimmed || trimmed === ADD_CUSTOM_VALUE || !(amount > 0)) return;

    const existing = allCategories.find(
      (c) =>
        c.value.toLowerCase() === trimmed.toLowerCase() ||
        c.label.toLowerCase() === trimmed.toLowerCase()
    );

    let value = existing?.value;
    if (!value) {
      const color = COLOR_OPTIONS[customCategories.length % COLOR_OPTIONS.length].class;
      setCustomCategories((prev) => [
        ...prev,
        { value: trimmed, label: trimmed, color, iconName: ICON_OPTIONS[0].name },
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
  const getCategoryInfo = (categoryValue: string): Category => {
    return allCategories.find(c => c.value === categoryValue) || CATEGORIES[4];
  };

  // Full history (all months) for the Expenses page, filtered by search and
  // sorted newest-first by date.
  const historyExpenses = expenses
    .filter((e) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q)
      );
    })
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
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

  return (
    <div dir="rtl" className="min-h-screen bg-neutral-950 text-neutral-100">
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

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1 bg-neutral-800/60 p-1 rounded-2xl">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow shadow-emerald-500/20'
                        : 'text-neutral-300 hover:text-white hover:bg-neutral-700/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-28 md:pb-10">
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

                  {/* Color picker */}
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1.5">צבע</label>
                    <div className="flex flex-wrap gap-2.5">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.class}
                          type="button"
                          onClick={() => setNewCategoryColor(c.class)}
                          title={c.name}
                          aria-label={c.name}
                          className={`w-9 h-9 rounded-full ${c.class} transition-all ${
                            newCategoryColor === c.class
                              ? 'ring-2 ring-offset-2 ring-offset-neutral-800 ring-white scale-110'
                              : 'hover:scale-110 active:scale-95'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

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

            {/* Spending by category */}
            <SpendingDonut
              monthExpenses={monthExpenses}
              categories={allCategories}
              monthLabel={monthLabel}
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
                {search ? 'לא נמצאו תוצאות' : 'אין הוצאות עדיין'}
              </p>
              <p className="text-neutral-500 text-sm mt-1">
                {search ? 'נסה מונח חיפוש אחר' : 'הוסף את ההוצאה הראשונה שלך בעמוד הבית'}
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
                        <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${categoryInfo.color} text-white`}>
                          <IconComponent className="w-5 h-5" />
                        </div>
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
                            <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${categoryInfo.color} text-white`}>
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

      {/* Mobile sticky bottom navigation (thumb-friendly) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-neutral-900/95 backdrop-blur border-t border-neutral-800"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch justify-around">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-1 pt-2.5 pb-1.5 transition-colors active:scale-95 ${
                  active ? 'text-emerald-400' : 'text-neutral-500'
                }`}
                aria-label={tab.label}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[11px] font-medium">{tab.label}</span>
                <span
                  className={`h-0.5 w-8 rounded-full transition-colors ${
                    active ? 'bg-emerald-400' : 'bg-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>
      </nav>

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
    </div>
  );
}

export default App;
