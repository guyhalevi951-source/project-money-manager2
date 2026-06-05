/**
 * Button theme system — preset-based dynamic theming via CSS custom properties.
 *
 * Three functional groups are themed independently:
 *   primary   — data-changing CTAs (עדכן תקציב, הוסף הוצאה)
 *   currency  — currency shortcut buttons (מטבע תצוגה, שער חליפין …)
 *   nav       — page navigation / utility row buttons
 *
 * CSS variables are written to document.documentElement so every button that
 * uses the var(--btn-*) arbitrary Tailwind classes picks up the change without
 * a re-render.
 */

export type ButtonGroupKey = 'primary' | 'currency' | 'nav';

export interface ButtonGroupTheme {
  primary: string;   // preset id
  currency: string;
  nav: string;
}

export interface ButtonThemePreset {
  id: string;
  labelHe: string;
  labelEn: string;
  swatch: string;        // hex shown in the color-picker grid
  bg: string;            // CSS value for --btn-X bg
  bgHover: string;       // CSS value for --btn-X hover
  bgActive: string;      // CSS value for --btn-X active
  textColor?: string;    // only needed for nav (transparent-bg buttons)
  borderColor?: string;  // only needed for nav
  textColorHover?: string;
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

// ─── CURRENCY presets ─────────────────────────────────────────────────────────

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

// ─── NAV presets ──────────────────────────────────────────────────────────────
// Nav buttons are semi-transparent dark pills — the preset sets bg, text, border.

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

// ─── All presets map ──────────────────────────────────────────────────────────

export const ALL_PRESETS: Record<ButtonGroupKey, Record<string, ButtonThemePreset>> = {
  primary: PRIMARY_PRESETS,
  currency: CURRENCY_PRESETS,
  nav: NAV_PRESETS,
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_BUTTON_THEME: ButtonGroupTheme = {
  primary: 'indigo',
  currency: 'blue',
  nav: 'indigo',
};

// ─── CSS variable application ─────────────────────────────────────────────────

export function applyButtonThemeCSS(theme: ButtonGroupTheme): void {
  const root = document.documentElement;

  const primary = PRIMARY_PRESETS[theme.primary] ?? PRIMARY_PRESETS.indigo;
  root.style.setProperty('--btn-primary-bg', primary.bg);
  root.style.setProperty('--btn-primary-hover', primary.bgHover);
  root.style.setProperty('--btn-primary-active', primary.bgActive);

  const currency = CURRENCY_PRESETS[theme.currency] ?? CURRENCY_PRESETS.blue;
  root.style.setProperty('--btn-currency-bg', currency.bg);
  root.style.setProperty('--btn-currency-hover', currency.bgHover);
  root.style.setProperty('--btn-currency-active', currency.bgActive);

  const nav = NAV_PRESETS[theme.nav] ?? NAV_PRESETS.indigo;
  root.style.setProperty('--btn-nav-bg', nav.bg);
  root.style.setProperty('--btn-nav-hover', nav.bgHover);
  root.style.setProperty('--btn-nav-active', nav.bgActive);
  root.style.setProperty('--btn-nav-text', nav.textColor ?? 'rgb(199 210 254)');
  root.style.setProperty('--btn-nav-text-hover', nav.textColorHover ?? 'rgb(224 231 255)');
  root.style.setProperty('--btn-nav-border', nav.borderColor ?? 'rgb(49 46 129 / 0.5)');
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const LS_KEY = 'money_manager_button_theme_v1';

function isValidTheme(raw: unknown): raw is ButtonGroupTheme {
  if (!raw || typeof raw !== 'object') return false;
  const t = raw as Record<string, unknown>;
  return (
    typeof t.primary === 'string' &&
    typeof t.currency === 'string' &&
    typeof t.nav === 'string'
  );
}

export function loadButtonTheme(): ButtonGroupTheme {
  try {
    const stored = window.localStorage.getItem(LS_KEY);
    if (!stored) return { ...DEFAULT_BUTTON_THEME };
    const parsed: unknown = JSON.parse(stored);
    if (!isValidTheme(parsed)) return { ...DEFAULT_BUTTON_THEME };
    // Validate each preset ID exists; fall back to default for unknown ids
    return {
      primary: primary_presetExists(parsed.primary) ? parsed.primary : DEFAULT_BUTTON_THEME.primary,
      currency: currency_presetExists(parsed.currency) ? parsed.currency : DEFAULT_BUTTON_THEME.currency,
      nav: nav_presetExists(parsed.nav) ? parsed.nav : DEFAULT_BUTTON_THEME.nav,
    };
  } catch {
    return { ...DEFAULT_BUTTON_THEME };
  }
}

export function saveButtonThemeToStorage(theme: ButtonGroupTheme): void {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(theme));
  } catch {
    // storage unavailable — non-fatal
  }
}

const primary_presetExists = (id: string) => id in PRIMARY_PRESETS;
const currency_presetExists = (id: string) => id in CURRENCY_PRESETS;
const nav_presetExists = (id: string) => id in NAV_PRESETS;

// Group metadata used in ProfilePage UI
export const BUTTON_GROUP_META: Record<ButtonGroupKey, { labelHe: string; labelEn: string; descHe: string; descEn: string }> = {
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
    descHe: 'כפתורי ניווט כמו תתי-תקציבים, היסטוריית הוצאות וגרפים',
    descEn: 'Navigation buttons like sub-budgets, expense history, and charts',
  },
};
