/**
 * Unified theme system — page canvas + three button groups.
 *
 * CSS variables are written to document.documentElement so the entire UI
 * (buttons via actionButtonStyles, surfaces via themeSurfaceStyles) updates
 * without per-component re-renders.
 */

import { isCustomHexColor, normalizeCustomHex } from '../categories';
import {
  darkenHex,
  hexToRgba,
  isLightColor,
  lightenHex,
  relativeLuminance,
} from '../utils/colorUtils';

export type ButtonGroupKey = 'primary' | 'currency' | 'nav' | 'filter';
export type PageThemeMode = 'dark' | 'light' | 'custom';

export interface ButtonGroupTheme {
  primary: string;
  currency: string;
  nav: string;
}

export interface ThemePreferences {
  pageMode: PageThemeMode;
  pageCustomHex: string;
  buttons: ButtonGroupTheme;
  /** 4th group — inputs, filters, dark panels & modals. */
  filterGroupColor: string;
}

export interface ButtonThemePreset {
  id: string;
  labelHe: string;
  labelEn: string;
  swatch: string;
  bg: string;
  bgHover: string;
  bgActive: string;
  textColor?: string;
  borderColor?: string;
  textColorHover?: string;
}

export interface PagePalette {
  bg: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  inputBg: string;
  inputBorder: string;
}

// ─── PRIMARY presets ──────────────────────────────────────────────────────────

export const PRIMARY_PRESETS: Record<string, ButtonThemePreset> = {
  indigo: {
    id: 'indigo', labelHe: 'אינדיגו', labelEn: 'Indigo', swatch: '#6366f1',
    bg: '#6366f1', bgHover: '#818cf8', bgActive: '#4f46e5',
  },
  violet: {
    id: 'violet', labelHe: 'סגול', labelEn: 'Violet', swatch: '#7c3aed',
    bg: '#7c3aed', bgHover: '#8b5cf6', bgActive: '#6d28d9',
  },
  blue: {
    id: 'blue', labelHe: 'כחול', labelEn: 'Blue', swatch: '#2563eb',
    bg: '#2563eb', bgHover: '#3b82f6', bgActive: '#1d4ed8',
  },
  sky: {
    id: 'sky', labelHe: 'תכלת', labelEn: 'Sky', swatch: '#0284c7',
    bg: '#0284c7', bgHover: '#0ea5e9', bgActive: '#0369a1',
  },
  teal: {
    id: 'teal', labelHe: 'טורקיז', labelEn: 'Teal', swatch: '#0d9488',
    bg: '#0d9488', bgHover: '#14b8a6', bgActive: '#0f766e',
  },
  rose: {
    id: 'rose', labelHe: 'ורוד', labelEn: 'Rose', swatch: '#e11d48',
    bg: '#e11d48', bgHover: '#f43f5e', bgActive: '#be123c',
  },
};

export const CURRENCY_PRESETS: Record<string, ButtonThemePreset> = {
  blue: {
    id: 'blue', labelHe: 'כחול', labelEn: 'Blue', swatch: '#2563eb',
    bg: '#2563eb', bgHover: '#3b82f6', bgActive: '#1d4ed8',
  },
  violet: {
    id: 'violet', labelHe: 'סגול', labelEn: 'Violet', swatch: '#7c3aed',
    bg: '#7c3aed', bgHover: '#8b5cf6', bgActive: '#6d28d9',
  },
  purple: {
    id: 'purple', labelHe: 'סגול כהה', labelEn: 'Purple', swatch: '#9333ea',
    bg: '#9333ea', bgHover: '#a855f7', bgActive: '#7e22ce',
  },
  indigo: {
    id: 'indigo', labelHe: 'אינדיגו', labelEn: 'Indigo', swatch: '#4f46e5',
    bg: '#4f46e5', bgHover: '#6366f1', bgActive: '#3730a3',
  },
  teal: {
    id: 'teal', labelHe: 'טורקיז', labelEn: 'Teal', swatch: '#0d9488',
    bg: '#0d9488', bgHover: '#14b8a6', bgActive: '#0f766e',
  },
  sky: {
    id: 'sky', labelHe: 'תכלת', labelEn: 'Sky', swatch: '#0284c7',
    bg: '#0284c7', bgHover: '#0ea5e9', bgActive: '#0369a1',
  },
};

export const NAV_PRESETS: Record<string, ButtonThemePreset> = {
  indigo: {
    id: 'indigo', labelHe: 'אינדיגו כהה', labelEn: 'Dark Indigo', swatch: '#1e1b4b',
    bg: 'rgb(30 27 75 / 0.6)',
    bgHover: 'rgb(49 46 129 / 0.7)',
    bgActive: 'rgb(49 46 129 / 0.9)',
    textColor: 'rgb(199 210 254)',
    textColorHover: 'rgb(224 231 255)',
    borderColor: 'rgb(49 46 129 / 0.5)',
  },
  blue: {
    id: 'blue', labelHe: 'כחול כהה', labelEn: 'Dark Blue', swatch: '#172554',
    bg: 'rgb(23 37 84 / 0.6)',
    bgHover: 'rgb(30 58 138 / 0.7)',
    bgActive: 'rgb(30 58 138 / 0.9)',
    textColor: 'rgb(191 219 254)',
    textColorHover: 'rgb(219 234 254)',
    borderColor: 'rgb(30 58 138 / 0.5)',
  },
  violet: {
    id: 'violet', labelHe: 'סגול כהה', labelEn: 'Dark Violet', swatch: '#2e1065',
    bg: 'rgb(46 16 101 / 0.6)',
    bgHover: 'rgb(76 29 149 / 0.7)',
    bgActive: 'rgb(76 29 149 / 0.9)',
    textColor: 'rgb(221 214 254)',
    textColorHover: 'rgb(237 233 254)',
    borderColor: 'rgb(76 29 149 / 0.5)',
  },
  slate: {
    id: 'slate', labelHe: 'אפור', labelEn: 'Slate', swatch: '#334155',
    bg: 'rgb(51 65 85 / 0.8)',
    bgHover: 'rgb(71 85 105 / 0.9)',
    bgActive: 'rgb(71 85 105 / 1)',
    textColor: 'rgb(203 213 225)',
    textColorHover: 'rgb(226 232 240)',
    borderColor: 'rgb(71 85 105 / 0.5)',
  },
  teal: {
    id: 'teal', labelHe: 'טורקיז כהה', labelEn: 'Dark Teal', swatch: '#042f2e',
    bg: 'rgb(4 47 46 / 0.6)',
    bgHover: 'rgb(15 118 110 / 0.7)',
    bgActive: 'rgb(15 118 110 / 0.9)',
    textColor: 'rgb(153 246 228)',
    textColorHover: 'rgb(204 251 241)',
    borderColor: 'rgb(15 118 110 / 0.5)',
  },
  neutral: {
    id: 'neutral', labelHe: 'נייטרל', labelEn: 'Neutral', swatch: '#262626',
    bg: 'rgb(38 38 38 / 0.85)',
    bgHover: 'rgb(64 64 64 / 0.9)',
    bgActive: 'rgb(64 64 64 / 1)',
    textColor: 'rgb(212 212 212)',
    textColorHover: 'rgb(229 229 229)',
    borderColor: 'rgb(82 82 82 / 0.5)',
  },
};

// ─── FILTER presets (timeline / period tabs, dropdown wrappers) ───────────────

export const FILTER_PRESETS: Record<string, ButtonThemePreset> = {
  charcoal: {
    id: 'charcoal', labelHe: 'פחם', labelEn: 'Charcoal', swatch: '#0A0A0A',
    bg: 'rgb(10 10 10 / 0.85)',
    bgHover: 'rgb(38 38 38 / 0.75)',
    bgActive: 'rgb(64 64 64 / 0.9)',
    textColor: 'rgb(163 163 163)',
    textColorHover: 'rgb(229 229 229)',
    borderColor: 'rgb(38 38 38 / 0.8)',
  },
  slate: {
    id: 'slate', labelHe: 'צפחה', labelEn: 'Slate', swatch: '#1E293B',
    bg: 'rgb(30 41 59 / 0.85)',
    bgHover: 'rgb(51 65 85 / 0.8)',
    bgActive: 'rgb(71 85 105 / 0.95)',
    textColor: 'rgb(148 163 184)',
    textColorHover: 'rgb(226 232 240)',
    borderColor: 'rgb(51 65 85 / 0.7)',
  },
  zinc: {
    id: 'zinc', labelHe: 'אבץ', labelEn: 'Zinc', swatch: '#18181B',
    bg: 'rgb(24 24 27 / 0.88)',
    bgHover: 'rgb(39 39 42 / 0.82)',
    bgActive: 'rgb(63 63 70 / 0.95)',
    textColor: 'rgb(161 161 170)',
    textColorHover: 'rgb(228 228 231)',
    borderColor: 'rgb(39 39 42 / 0.75)',
  },
  gray: {
    id: 'gray', labelHe: 'אפור', labelEn: 'Gray', swatch: '#262626',
    bg: 'rgb(38 38 38 / 0.88)',
    bgHover: 'rgb(64 64 64 / 0.8)',
    bgActive: 'rgb(82 82 82 / 0.95)',
    textColor: 'rgb(163 163 163)',
    textColorHover: 'rgb(229 229 229)',
    borderColor: 'rgb(64 64 64 / 0.7)',
  },
  neutral: {
    id: 'neutral', labelHe: 'נייטרל', labelEn: 'Neutral', swatch: '#171717',
    bg: 'rgb(23 23 23 / 0.9)',
    bgHover: 'rgb(38 38 38 / 0.82)',
    bgActive: 'rgb(64 64 64 / 0.95)',
    textColor: 'rgb(163 163 163)',
    textColorHover: 'rgb(245 245 245)',
    borderColor: 'rgb(38 38 38 / 0.75)',
  },
  stone: {
    id: 'stone', labelHe: 'אבן', labelEn: 'Stone', swatch: '#1C1917',
    bg: 'rgb(28 25 23 / 0.88)',
    bgHover: 'rgb(41 37 36 / 0.82)',
    bgActive: 'rgb(68 64 60 / 0.95)',
    textColor: 'rgb(168 162 158)',
    textColorHover: 'rgb(231 229 228)',
    borderColor: 'rgb(41 37 36 / 0.75)',
  },
};

export const ALL_PRESETS: Record<ButtonGroupKey, Record<string, ButtonThemePreset>> = {
  primary: PRIMARY_PRESETS,
  currency: CURRENCY_PRESETS,
  nav: NAV_PRESETS,
  filter: FILTER_PRESETS,
};

export const DEFAULT_FILTER_GROUP_COLOR = 'charcoal';

export const DEFAULT_BUTTON_THEME: ButtonGroupTheme = {
  primary: 'indigo',
  currency: 'blue',
  nav: 'indigo',
};

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  pageMode: 'dark',
  pageCustomHex: '#0A0A0A',
  buttons: { ...DEFAULT_BUTTON_THEME },
  filterGroupColor: DEFAULT_FILTER_GROUP_COLOR,
};

/** @deprecated Use DEFAULT_THEME_PREFERENCES */
export const DEFAULT_BUTTON_THEME_FULL = DEFAULT_THEME_PREFERENCES;

export const BUTTON_GROUP_META: Record<
  ButtonGroupKey,
  { labelHe: string; labelEn: string; descHe: string; descEn: string }
> = {
  primary: {
    labelHe: 'פעולות ראשיות',
    labelEn: 'Primary Actions',
    descHe: 'כפתורי פעולה ראשיים כמו "עדכן תקציב" ו"הוסף הוצאה"',
    descEn: 'Main action buttons like "Update Budget" and "Add Expense"',
  },
  currency: {
    labelHe: 'כלי ניהול והגדרות',
    labelEn: 'Management & Tools',
    descHe: 'כפתורי קיצור להגדרות מטבע: מטבע תצוגה, שער חליפין, עמלות',
    descEn: 'Currency shortcut buttons: Display currency, Exchange rate, Commissions',
  },
  nav: {
    labelHe: 'ניווט ומעבר דפים',
    labelEn: 'App Navigation',
    descHe: 'כפתור בית, תפריט ניווט, כפתור שפה (גלובוס) וקיצורי דפים',
    descEn: 'Home button, nav menu, language globe button, and page shortcuts',
  },
  filter: {
    labelHe: 'שדות קלט, סינון וכרטיסים כהים',
    labelEn: 'Input Fields, Filtering & Dark Surfaces',
    descHe: 'שדות טקסט, חיפוש, תפריטי מטבע, לשוניות סינון, כרטיסי מודל ופאנלים כהים',
    descEn: 'Text inputs, search bars, currency selectors, filter tabs, modal cards, and dark panels',
  },
};

export function getGroupColorChoice(prefs: ThemePreferences, group: ButtonGroupKey): string {
  if (group === 'filter') return prefs.filterGroupColor;
  return prefs.buttons[group];
}

export const PAGE_THEME_META: Record<
  PageThemeMode,
  { labelHe: string; labelEn: string; swatch: string }
> = {
  dark: { labelHe: 'מצב כהה', labelEn: 'Dark Mode', swatch: '#0A0A0A' },
  light: { labelHe: 'מצב בהיר', labelEn: 'Light Mode', swatch: '#F8FAFC' },
  custom: { labelHe: 'צבע מותאם', labelEn: 'Custom Color', swatch: '#6366F1' },
};

// ─── Page palettes ────────────────────────────────────────────────────────────

const DARK_PAGE_PALETTE: PagePalette = {
  bg: '#0A0A0A',
  surface: '#171717',
  surfaceMuted: '#262626',
  border: '#262626',
  text: '#F5F5F5',
  textMuted: '#A3A3A3',
  textSubtle: '#737373',
  inputBg: '#0A0A0A',
  inputBorder: '#404040',
};

const LIGHT_PAGE_PALETTE: PagePalette = {
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#475569',
  textSubtle: '#64748B',
  inputBg: '#FFFFFF',
  inputBorder: '#CBD5E1',
};

function deriveCustomPagePalette(hex: string): PagePalette {
  const normalized = normalizeCustomHex(hex);
  const light = isLightColor(normalized);

  if (light) {
    return {
      bg: normalized,
      surface: lightenHex(normalized, 0.06),
      surfaceMuted: darkenHex(normalized, 0.04),
      border: darkenHex(normalized, 0.14),
      text: '#0F172A',
      textMuted: '#334155',
      textSubtle: '#64748B',
      inputBg: lightenHex(normalized, 0.08),
      inputBorder: darkenHex(normalized, 0.12),
    };
  }

  return {
    bg: normalized,
    surface: lightenHex(normalized, 0.1),
    surfaceMuted: lightenHex(normalized, 0.16),
    border: lightenHex(normalized, 0.22),
    text: '#F5F5F5',
    textMuted: '#D4D4D4',
    textSubtle: '#A3A3A3',
    inputBg: darkenHex(normalized, 0.08),
    inputBorder: lightenHex(normalized, 0.18),
  };
}

export function resolvePagePalette(prefs: ThemePreferences): PagePalette {
  if (prefs.pageMode === 'light') return LIGHT_PAGE_PALETTE;
  if (prefs.pageMode === 'custom') {
    return deriveCustomPagePalette(prefs.pageCustomHex || DARK_PAGE_PALETTE.bg);
  }
  return DARK_PAGE_PALETTE;
}

// ─── Button color resolution ──────────────────────────────────────────────────

function deriveSolidButtonColors(hex: string): Pick<ButtonThemePreset, 'bg' | 'bgHover' | 'bgActive' | 'swatch'> {
  const normalized = normalizeCustomHex(hex);
  return {
    swatch: normalized,
    bg: normalized,
    bgHover: lightenHex(normalized, 0.12),
    bgActive: darkenHex(normalized, 0.14),
  };
}

function deriveNavButtonColors(hex: string): ButtonThemePreset {
  const normalized = normalizeCustomHex(hex);
  const light = isLightColor(normalized);
  const textColor = light ? 'rgb(15 23 42)' : 'rgb(226 232 240)';
  const textColorHover = light ? 'rgb(30 41 59)' : 'rgb(248 250 252)';
  const borderBase = light ? darkenHex(normalized, 0.2) : lightenHex(normalized, 0.15);

  return {
    id: 'custom',
    labelHe: 'צבע מותאם',
    labelEn: 'Custom',
    swatch: normalized,
    bg: hexToRgba(normalized, 0.65),
    bgHover: hexToRgba(normalized, 0.78),
    bgActive: hexToRgba(normalized, 0.92),
    textColor,
    textColorHover,
    borderColor: hexToRgba(borderBase, 0.55),
  };
}

export function isCustomColorChoice(value: string): boolean {
  return isCustomHexColor(value);
}

export function resolveButtonColors(
  group: ButtonGroupKey,
  choice: string,
): ButtonThemePreset {
  if (isCustomColorChoice(choice)) {
    const hex = normalizeCustomHex(choice);
    if (group === 'nav' || group === 'filter') return deriveNavButtonColors(hex);
    const solid = deriveSolidButtonColors(hex);
    return {
      id: 'custom',
      labelHe: 'צבע מותאם',
      labelEn: 'Custom',
      ...solid,
    };
  }

  const presets = ALL_PRESETS[group];
  const fallback =
    group === 'primary' ? 'indigo'
    : group === 'currency' ? 'blue'
    : group === 'filter' ? DEFAULT_FILTER_GROUP_COLOR
    : 'indigo';
  return presets[choice] ?? presets[fallback];
}

export function getButtonChoiceLabel(
  group: ButtonGroupKey,
  choice: string,
  lang: 'he' | 'en',
): string {
  if (isCustomColorChoice(choice)) {
    return lang === 'he' ? 'צבע מותאם' : 'Custom color';
  }
  const preset = ALL_PRESETS[group][choice];
  if (!preset) return choice;
  return lang === 'he' ? preset.labelHe : preset.labelEn;
}

// ─── CSS variable application ─────────────────────────────────────────────────

function applyPagePaletteCSS(palette: PagePalette): void {
  const root = document.documentElement;
  root.style.setProperty('--page-bg', palette.bg);
  root.style.setProperty('--page-surface', palette.surface);
  root.style.setProperty('--page-surface-muted', palette.surfaceMuted);
  root.style.setProperty('--page-border', palette.border);
  root.style.setProperty('--page-text', palette.text);
  root.style.setProperty('--page-text-muted', palette.textMuted);
  root.style.setProperty('--page-text-subtle', palette.textSubtle);
  root.style.setProperty('--page-input-bg', palette.inputBg);
  root.style.setProperty('--page-input-border', palette.inputBorder);
  root.dataset.pageTheme = relativeLuminance(palette.bg) > 0.45 ? 'light' : 'dark';

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', palette.bg);
}

function applyButtonGroupCSS(prefs: ThemePreferences): void {
  const root = document.documentElement;

  const primary = resolveButtonColors('primary', prefs.buttons.primary);
  root.style.setProperty('--btn-primary-bg', primary.bg);
  root.style.setProperty('--btn-primary-hover', primary.bgHover);
  root.style.setProperty('--btn-primary-active', primary.bgActive);

  const currency = resolveButtonColors('currency', prefs.buttons.currency);
  root.style.setProperty('--btn-currency-bg', currency.bg);
  root.style.setProperty('--btn-currency-hover', currency.bgHover);
  root.style.setProperty('--btn-currency-active', currency.bgActive);

  const nav = resolveButtonColors('nav', prefs.buttons.nav);
  root.style.setProperty('--btn-nav-bg', nav.bg);
  root.style.setProperty('--btn-nav-hover', nav.bgHover);
  root.style.setProperty('--btn-nav-active', nav.bgActive);
  root.style.setProperty('--btn-nav-text', nav.textColor ?? 'rgb(199 210 254)');
  root.style.setProperty('--btn-nav-text-hover', nav.textColorHover ?? 'rgb(224 231 255)');
  root.style.setProperty('--btn-nav-border', nav.borderColor ?? 'rgb(49 46 129 / 0.5)');

  const filter = resolveButtonColors('filter', prefs.filterGroupColor);
  root.style.setProperty('--btn-filter-bg', filter.bg);
  root.style.setProperty('--btn-filter-hover', filter.bgHover);
  root.style.setProperty('--btn-filter-active', filter.bgActive);
  root.style.setProperty('--btn-filter-text', filter.textColor ?? 'rgb(163 163 163)');
  root.style.setProperty('--btn-filter-text-hover', filter.textColorHover ?? 'rgb(229 229 229)');
  root.style.setProperty('--btn-filter-border', filter.borderColor ?? 'rgb(38 38 38 / 0.8)');

  root.style.setProperty('--surface-input-bg', filter.bgHover);
  root.style.setProperty('--surface-input-border', filter.borderColor ?? 'rgb(38 38 38 / 0.8)');
  root.style.setProperty('--surface-input-text', filter.textColorHover ?? 'rgb(229 229 229)');
  root.style.setProperty('--surface-input-placeholder', filter.textColor ?? 'rgb(163 163 163)');
  root.style.setProperty('--surface-panel-bg', filter.bg);
  root.style.setProperty('--surface-panel-border', filter.borderColor ?? 'rgb(38 38 38 / 0.8)');
  root.style.setProperty('--surface-modal-bg', filter.bg);
}

export function applyThemeCSS(prefs: ThemePreferences): void {
  applyPagePaletteCSS(resolvePagePalette(prefs));
  applyButtonGroupCSS(prefs);
}

/** @deprecated Use applyThemeCSS */
export function applyButtonThemeCSS(theme: ButtonGroupTheme): void {
  applyThemeCSS({
    ...DEFAULT_THEME_PREFERENCES,
    buttons: theme,
    filterGroupColor: DEFAULT_FILTER_GROUP_COLOR,
  });
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export const GUEST_THEME_LS_KEY = 'guest_theme_preferences';
const LEGACY_BUTTON_LS_KEY = 'money_manager_button_theme_v1';

function normalizeButtonChoice(group: ButtonGroupKey, value: string): string {
  if (isCustomColorChoice(value)) return normalizeCustomHex(value);
  const presets = ALL_PRESETS[group];
  const fallback =
    group === 'filter' ? DEFAULT_FILTER_GROUP_COLOR : DEFAULT_BUTTON_THEME[group as keyof ButtonGroupTheme];
  return value in presets ? value : fallback;
}

function normalizeThemePreferences(raw: Partial<ThemePreferences> | null | undefined): ThemePreferences {
  const pageMode: PageThemeMode =
    raw?.pageMode === 'light' || raw?.pageMode === 'custom' || raw?.pageMode === 'dark'
      ? raw.pageMode
      : DEFAULT_THEME_PREFERENCES.pageMode;

  const pageCustomHex =
    raw?.pageCustomHex && isCustomHexColor(raw.pageCustomHex)
      ? normalizeCustomHex(raw.pageCustomHex)
      : DEFAULT_THEME_PREFERENCES.pageCustomHex;

  const buttonsRaw = raw?.buttons;
  const rawRecord = raw as Record<string, unknown> | undefined;
  const buttonsExtra = buttonsRaw as Record<string, unknown> | undefined;
  const legacyFilter =
    typeof rawRecord?.filterGroupColor === 'string'
      ? rawRecord.filterGroupColor
      : typeof buttonsExtra?.filter === 'string'
        ? buttonsExtra.filter
        : DEFAULT_FILTER_GROUP_COLOR;

  return {
    pageMode,
    pageCustomHex,
    buttons: {
      primary: normalizeButtonChoice('primary', buttonsRaw?.primary ?? DEFAULT_BUTTON_THEME.primary),
      currency: normalizeButtonChoice('currency', buttonsRaw?.currency ?? DEFAULT_BUTTON_THEME.currency),
      nav: normalizeButtonChoice('nav', buttonsRaw?.nav ?? DEFAULT_BUTTON_THEME.nav),
    },
    filterGroupColor: normalizeButtonChoice('filter', legacyFilter),
  };
}

function isLegacyButtonTheme(raw: unknown): raw is ButtonGroupTheme {
  if (!raw || typeof raw !== 'object') return false;
  const t = raw as Record<string, unknown>;
  return (
    typeof t.primary === 'string' &&
    typeof t.currency === 'string' &&
    typeof t.nav === 'string' &&
    !('pageMode' in t) &&
    !('buttons' in t)
  );
}

function isThemePreferences(raw: unknown): raw is ThemePreferences {
  if (!raw || typeof raw !== 'object') return false;
  const t = raw as Record<string, unknown>;
  return (
    (t.pageMode === 'dark' || t.pageMode === 'light' || t.pageMode === 'custom') &&
    typeof t.pageCustomHex === 'string' &&
    t.buttons !== null &&
    typeof t.buttons === 'object'
  );
}

export function parseThemePreferences(raw: unknown): ThemePreferences {
  if (isThemePreferences(raw)) return normalizeThemePreferences(raw);
  if (isLegacyButtonTheme(raw)) {
    return normalizeThemePreferences({
      pageMode: 'dark',
      pageCustomHex: DEFAULT_THEME_PREFERENCES.pageCustomHex,
      buttons: raw,
    });
  }
  return { ...DEFAULT_THEME_PREFERENCES };
}

export function loadThemePreferences(): ThemePreferences {
  try {
    for (const key of [GUEST_THEME_LS_KEY, LEGACY_BUTTON_LS_KEY]) {
      const stored = window.localStorage.getItem(key);
      if (!stored) continue;
      const parsed: unknown = JSON.parse(stored);
      return parseThemePreferences(parsed);
    }
  } catch {
    // fall through
  }
  return { ...DEFAULT_THEME_PREFERENCES };
}

/** @deprecated Use loadThemePreferences */
export function loadButtonTheme(): ButtonGroupTheme {
  return loadThemePreferences().buttons;
}

export function saveThemePreferencesToStorage(prefs: ThemePreferences): void {
  try {
    window.localStorage.setItem(GUEST_THEME_LS_KEY, JSON.stringify(prefs));
    window.localStorage.removeItem(LEGACY_BUTTON_LS_KEY);
  } catch {
    // storage unavailable — non-fatal
  }
}

/** @deprecated Use saveThemePreferencesToStorage */
export function saveButtonThemeToStorage(theme: ButtonGroupTheme): void {
  saveThemePreferencesToStorage({ ...DEFAULT_THEME_PREFERENCES, buttons: theme });
}

export function themePreferencesEqual(a: ThemePreferences, b: ThemePreferences): boolean {
  return (
    a.pageMode === b.pageMode &&
    a.pageCustomHex === b.pageCustomHex &&
    a.buttons.primary === b.buttons.primary &&
    a.buttons.currency === b.buttons.currency &&
    a.buttons.nav === b.buttons.nav &&
    a.filterGroupColor === b.filterGroupColor
  );
}
