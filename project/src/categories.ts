import {
  Utensils,
  Heart,
  Film,
  Home,
  HelpCircle,
  Tag,
  ShoppingBag,
  Car,
  Gift,
  type LucideIcon,
} from 'lucide-react';

/** Category style used across history, donuts, and forms. */
export interface Category {
  value: string;
  label: string;
  icon: LucideIcon;
  color: string;
}

/** Built-in Hebrew categories — single source of truth for colors and icons. */
export const BUILTIN_CATEGORIES: Category[] = [
  { value: 'אוכל', label: 'אוכל', icon: Utensils, color: 'bg-orange-500' },
  { value: 'בילויים', label: 'בילויים', icon: Film, color: 'bg-purple-500' },
  { value: 'בריאות', label: 'בריאות', icon: Heart, color: 'bg-rose-500' },
  { value: 'שכר דירה', label: 'שכר דירה', icon: Home, color: 'bg-cyan-500' },
  { value: 'אחר', label: 'אחר', icon: HelpCircle, color: 'bg-gray-500' },
];

export const CATEGORIES = BUILTIN_CATEGORIES;

export const DEFAULT_CATEGORY_COLOR = 'bg-emerald-500';

export const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
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

export const resolveIcon = (name: string): LucideIcon => ICON_MAP[name] ?? Tag;

export const COLOR_OPTIONS: { name: string; class: string }[] = [
  { name: 'אמרלד', class: 'bg-emerald-500' },
  { name: 'אינדיגו', class: 'bg-indigo-500' },
  { name: 'סגול עמוק', class: 'bg-violet-500' },
  { name: 'סגול', class: 'bg-purple-500' },
  { name: 'כחול', class: 'bg-blue-500' },
  { name: 'ציאן', class: 'bg-cyan-500' },
  { name: 'שמיים', class: 'bg-sky-500' },
  { name: 'ענבר', class: 'bg-amber-500' },
  { name: 'ורוד', class: 'bg-rose-500' },
  { name: 'פוקסיה', class: 'bg-fuchsia-500' },
  { name: 'אדום', class: 'bg-red-500' },
  { name: 'כתום', class: 'bg-orange-500' },
  { name: 'טורקיז', class: 'bg-teal-500' },
  { name: 'ורוד בהיר', class: 'bg-pink-500' },
];

const TAILWIND_HEX: Record<string, string> = {
  'bg-amber-500': '#f59e0b',
  'bg-orange-500': '#f97316',
  'bg-rose-500': '#f43f5e',
  'bg-pink-500': '#ec4899',
  'bg-purple-500': '#a855f7',
  'bg-violet-500': '#8b5cf6',
  'bg-cyan-500': '#06b6d4',
  'bg-gray-500': '#6b7280',
  'bg-emerald-500': '#10b981',
  'bg-blue-500': '#3b82f6',
  'bg-teal-500': '#14b8a6',
  'bg-indigo-500': '#6366f1',
  'bg-fuchsia-500': '#d946ef',
  'bg-sky-500': '#0ea5e9',
  'bg-red-500': '#ef4444',
  'bg-lime-600': '#65a30d',
};

export const hexForColor = (colorClass: string): string => TAILWIND_HEX[colorClass] ?? '#64748b';

export interface CategoryBreakdownSlice {
  value: string;
  label: string;
  color: string;
  hex: string;
  icon: LucideIcon;
  amount: number;
  percentage: number;
}

export function lookupCategory(
  value: string,
  categories: Category[],
  fallback?: Category
): Category {
  const found = categories.find((c) => c.value === value);
  if (found) return found;
  if (fallback) return fallback;
  return categories[categories.length - 1] ?? BUILTIN_CATEGORIES[BUILTIN_CATEGORIES.length - 1];
}

/** Groups expenses by category with consistent color, hex, and icon from config. */
export function aggregateByCategory(
  items: { category: string; amount: number }[],
  categories: Category[]
): CategoryBreakdownSlice[] {
  const fallback = categories[categories.length - 1];
  const total = items.reduce((sum, e) => sum + e.amount, 0);

  return Object.values(
    items.reduce<Record<string, { value: string; amount: number }>>((acc, e) => {
      acc[e.category] = acc[e.category] || { value: e.category, amount: 0 };
      acc[e.category].amount += e.amount;
      return acc;
    }, {})
  )
    .map((g) => {
      const cat = lookupCategory(g.value, categories, fallback);
      return {
        value: g.value,
        label: cat.label,
        color: cat.color,
        hex: hexForColor(cat.color),
        icon: cat.icon,
        amount: g.amount,
        percentage: total > 0 ? (g.amount / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}
