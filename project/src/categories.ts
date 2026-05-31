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

/** Lighten (+) or darken (-) a hex color by mixing toward white/black. */
export function adjustColorBrightness(hex: string, percent: number): string {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) return hex;

  const parseChannel = (start: number) => parseInt(normalized.slice(start, start + 2), 16);
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  const mix = (channel: number) => {
    if (percent >= 0) {
      return clamp(Math.round(channel + (255 - channel) * (percent / 100)));
    }
    return clamp(Math.round(channel * (1 + percent / 100)));
  };

  const r = mix(parseChannel(0));
  const g = mix(parseChannel(2));
  const b = mix(parseChannel(4));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** Bold contrast steps for colliding categories on dark donut charts. */
const COLLISION_MAGNITUDE_START = 40;
const COLLISION_MAGNITUDE_STEP = 20;
const COLLISION_MAGNITUDE_MAX = 80;

/**
 * Alternating dark/light offsets from base (index 0 = base color).
 * 1st: base | 2nd: -40% | 3rd: +40% | 4th: -60% | 5th: +60% | …
 */
function collisionBrightnessPercent(index: number): number {
  if (index === 0) return 0;
  const pair = Math.floor((index - 1) / 2);
  const magnitude = Math.min(
    COLLISION_MAGNITUDE_MAX,
    COLLISION_MAGNITUDE_START + pair * COLLISION_MAGNITUDE_STEP
  );
  return index % 2 === 1 ? -magnitude : magnitude;
}

/**
 * When multiple categories share the same base Tailwind color, assign stable distinct
 * hex shades (sorted by label) so donut slices and legend badges do not blend together.
 */
export function applyDistinctCategoryHexes(
  slices: CategoryBreakdownSlice[]
): CategoryBreakdownSlice[] {
  const groups = new Map<string, CategoryBreakdownSlice[]>();

  for (const slice of slices) {
    const list = groups.get(slice.color) ?? [];
    list.push(slice);
    groups.set(slice.color, list);
  }

  const hexByValue = new Map<string, string>();

  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.label.localeCompare(b.label, 'he'));
    const baseHex = hexForColor(sorted[0].color);

    sorted.forEach((slice, index) => {
      const percent = collisionBrightnessPercent(index);
      const hex = percent === 0 ? baseHex : adjustColorBrightness(baseHex, percent);
      hexByValue.set(slice.value, hex);
    });
  }

  return slices.map((slice) => ({
    ...slice,
    hex: hexByValue.get(slice.value) ?? slice.hex,
  }));
}

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

  const slices = Object.values(
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

  return applyDistinctCategoryHexes(slices);
}
