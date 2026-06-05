/**
 * Unified theme system — page canvas + seven functional categories.
 *
 * Classification & binding rules: see theme/themeCategoryMapping.ts (v1.1.0).
 * Layout / anti-clipping protocol: see theme/themeLayoutProtocol.ts (v1.0.0).
 * Nested list separation: see theme/themeNestedListProtocol.ts (v1.0.0).
 * Thin border enclosure: see theme/themeThinBorderProtocol.ts (v1.0.0).
 * Monochrome depth hierarchy: see theme/themeMonochromeDepthProtocol.ts (v2.0.0).
 * Cursor rules: .cursor/rules/theme-category-mapping.mdc,
 *               .cursor/rules/theme-layout-protocol.mdc
 *
 * CSS variables are written to document.documentElement so the entire UI
 * (buttons via actionButtonStyles, surfaces via themeSurfaceStyles) updates
 * without per-component re-renders.
 *
 * Whenever creating accordions or color pickers: master frames MUST use
 * overflow-visible and themeScrollSafeContentClass (see themeLayoutProtocol).
 * Configuration sub-rows MUST use SubCardNestedStack variant="capsule" on
 * subCardAccordionContentClass (transparent — no outer square shell box).
 */

export {
  THEME_LAYOUT_PROTOCOL_VERSION,
  THEME_Z_INDEX,
  themeZIndexClass,
  themeAntiClipVisibleClass,
  themeFloatingHostClass,
  themeFloatingOverlayClass,
  themeAccordionHeaderLayerClass,
  themeScrollViewportClass,
  themeScrollSafeContentClass,
  themeScrollSafeContentStyle,
  computeFloatingAnchorPosition,
} from '../theme/themeLayoutProtocol';

export {
  THEME_NESTED_LIST_PROTOCOL_VERSION,
  NESTED_LIST_STACK_ATTR,
  NESTED_LIST_ITEM_ATTR,
  resolveSubCardNestedListOverlays,
  type SubCardNestedListOverlays,
} from '../theme/themeNestedListProtocol';

export {
  THEME_THIN_BORDER_PROTOCOL_VERSION,
  THEME_ENCLOSURE_BORDER_VAR,
  THEME_ENCLOSURE_BORDER_WIDTH,
  resolveThinEnclosureBorder,
} from '../theme/themeThinBorderProtocol';

export {
  THEME_CATEGORY_RULES,
  THEME_CLASSIFICATION_PRIORITY,
  THEME_MAPPING_STANDARD_VERSION,
  THEME_CATEGORY_DATA_ATTR,
  classifyThemeCategory,
  getThemeCategoryRule,
  getThemeStyleTokens,
  getThemeCssVariables,
  getThemePreferenceField,
  themeCategoryProps,
  mainCardSurfaceInlineStyle,
  subCardSurfaceInlineStyle,
  assertStyleTokenMatchesCategory,
  type ThemeCategoryId,
  type ThemeCategoryRule,
  type ThemeClassificationHint,
  type ThemeElementRole,
} from '../theme/themeCategoryMapping';

import { isCustomHexColor, normalizeCustomHex } from '../categories';
import {
  MONO_DEPTH_BORDER_DARK,
  MONO_DEPTH_CAT4_INPUT_BG,
  MONO_DEPTH_CAT4_INPUT_BORDER,
  MONO_DEPTH_CAT5_TEXT,
  MONO_DEPTH_LEVEL_1,
  MONO_DEPTH_LEVEL_2,
  MONO_DEPTH_LEVEL_3,
  MONO_DEPTH_PAGE_BG,
  deriveMonochromeLevel3FromLevel2,
  isMonochromeDepthSystemDefault,
  resolveMonochromeDepthBorder,
} from '../theme/themeMonochromeDepthProtocol';
import { resolveSubCardNestedListOverlays } from '../theme/themeNestedListProtocol';
import { resolveThinEnclosureBorder } from '../theme/themeThinBorderProtocol';

export {
  THEME_MONOCHROME_DEPTH_PROTOCOL_VERSION,
  MONO_DEPTH_PAGE_BG,
  MONO_DEPTH_LEVEL_1,
  MONO_DEPTH_LEVEL_2,
  MONO_DEPTH_LEVEL_3,
  MONO_DEPTH_CAT4_INPUT_BG,
  MONO_DEPTH_CAT4_INPUT_BORDER,
  MONO_DEPTH_CAT5_TEXT,
  MONO_DEPTH_BORDER_DARK,
  isMonochromeDepthSystemDefault,
  resolveDefaultMonochromeDepthHierarchy,
} from '../theme/themeMonochromeDepthProtocol';
import {
  darkenHex,
  hexToRgba,
  isLightColor,
  lightenHex,
  relativeLuminance,
} from '../utils/colorUtils';

export type ButtonGroupKey =
  | 'primary'
  | 'currency'
  | 'nav'
  | 'filter'
  | 'text'
  | 'mainCard'
  | 'subCard';
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
  /** 5th group — typography & foreground text colors. */
  textColor: string;
  /** 6th group — large dashboard cards & main surface panels. */
  mainCardSurfaceColor: string;
  /** 7th group — nested sub-cards, accordion bodies & inner sections. */
  subCardColor: string;
}

export interface TextTypographyPalette {
  primary: string;
  secondary: string;
  muted: string;
}

export interface TextThemePreset {
  id: string;
  labelHe: string;
  labelEn: string;
  swatch: string;
  primary: string;
  secondary: string;
  muted: string;
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
    id: 'charcoal', labelHe: 'פחם כהה', labelEn: 'Dark Charcoal', swatch: '#27272A',
    bg: '#27272A',
    bgHover: '#3F3F46',
    bgActive: '#52525B',
    textColor: '#FFFFFF',
    textColorHover: '#FFFFFF',
    borderColor: 'rgba(255, 255, 255, 0.10)',
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

// ─── TEXT / TYPOGRAPHY presets (group 5) ───────────────────────────────────────

export const TEXT_PRESETS: Record<string, TextThemePreset> = {
  white: {
    id: 'white', labelHe: 'לבן', labelEn: 'White', swatch: '#FFFFFF',
    primary: '#FFFFFF', secondary: '#FFFFFF', muted: '#FFFFFF',
  },
  silver: {
    id: 'silver', labelHe: 'כסף', labelEn: 'Silver', swatch: '#E5E5E5',
    primary: '#F5F5F5', secondary: '#D4D4D4', muted: '#A3A3A3',
  },
  zinc: {
    id: 'zinc', labelHe: 'אבץ בהיר', labelEn: 'Light Zinc', swatch: '#E4E4E7',
    primary: '#F4F4F5', secondary: '#D4D4D8', muted: '#A1A1AA',
  },
  slate: {
    id: 'slate', labelHe: 'צפחה בהיר', labelEn: 'Light Slate', swatch: '#CBD5E1',
    primary: '#F1F5F9', secondary: '#CBD5E1', muted: '#94A3B8',
  },
  stone: {
    id: 'stone', labelHe: 'אבן בהיר', labelEn: 'Light Stone', swatch: '#D6D3D1',
    primary: '#FAFAF9', secondary: '#D6D3D1', muted: '#A8A29E',
  },
  neutral: {
    id: 'neutral', labelHe: 'נייטרל בהיר', labelEn: 'Light Neutral', swatch: '#D4D4D4',
    primary: '#FAFAFA', secondary: '#D4D4D4', muted: '#A3A3A3',
  },
};

function textPresetAsButtonPreset(preset: TextThemePreset): ButtonThemePreset {
  return {
    id: preset.id,
    labelHe: preset.labelHe,
    labelEn: preset.labelEn,
    swatch: preset.swatch,
    bg: preset.swatch,
    bgHover: preset.swatch,
    bgActive: preset.swatch,
  };
}

const TEXT_BUTTON_PRESETS = Object.fromEntries(
  Object.entries(TEXT_PRESETS).map(([key, preset]) => [key, textPresetAsButtonPreset(preset)]),
);

// ─── MAIN CARD / SURFACE presets (group 6) ───────────────────────────────────

export const MAIN_CARD_PRESETS: Record<string, ButtonThemePreset> = {
  default: {
    id: 'default', labelHe: 'שחור עמוק', labelEn: 'Deep Black', swatch: '#0A0A0A',
    bg: '#0A0A0A', bgHover: '#0A0A0A', bgActive: '#0A0A0A',
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  white: {
    id: 'white', labelHe: 'לבן', labelEn: 'White', swatch: '#FFFFFF',
    bg: '#FFFFFF', bgHover: '#FFFFFF', bgActive: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  zinc: {
    id: 'zinc', labelHe: 'אבץ', labelEn: 'Zinc', swatch: '#18181B',
    bg: '#18181B', bgHover: '#18181B', bgActive: '#18181B',
    borderColor: '#27272A',
  },
  charcoal: {
    id: 'charcoal', labelHe: 'פחם', labelEn: 'Charcoal', swatch: '#171717',
    bg: '#171717', bgHover: '#171717', bgActive: '#171717',
    borderColor: '#262626',
  },
  slate: {
    id: 'slate', labelHe: 'צפחה', labelEn: 'Slate', swatch: '#1E293B',
    bg: '#1E293B', bgHover: '#1E293B', bgActive: '#1E293B',
    borderColor: '#334155',
  },
  stone: {
    id: 'stone', labelHe: 'אבן', labelEn: 'Stone', swatch: '#1C1917',
    bg: '#1C1917', bgHover: '#1C1917', bgActive: '#1C1917',
    borderColor: '#292524',
  },
  neutral: {
    id: 'neutral', labelHe: 'נייטרל', labelEn: 'Neutral', swatch: '#171717',
    bg: '#171717', bgHover: '#171717', bgActive: '#171717',
    borderColor: '#262626',
  },
};

// ─── SUB-CARD / INNER SECTION presets (group 7) ───────────────────────────────

export const SUB_CARD_PRESETS: Record<string, ButtonThemePreset> = {
  default: {
    id: 'default', labelHe: 'פחם', labelEn: 'Charcoal', swatch: '#171717',
    bg: '#171717', bgHover: '#171717', bgActive: '#171717',
    borderColor: 'rgba(255, 255, 255, 0.10)',
  },
  slate: {
    id: 'slate', labelHe: 'צפחה שקופה', labelEn: 'Slate Tint', swatch: '#1E293B',
    bg: 'rgb(30 41 59 / 0.5)', bgHover: 'rgb(30 41 59 / 0.5)', bgActive: 'rgb(30 41 59 / 0.5)',
    borderColor: 'rgb(51 65 85 / 0.6)',
  },
  zinc: {
    id: 'zinc', labelHe: 'אבץ', labelEn: 'Zinc', swatch: '#27272A',
    bg: '#27272A', bgHover: '#27272A', bgActive: '#27272A',
    borderColor: '#3F3F46',
  },
  charcoal: {
    id: 'charcoal', labelHe: 'פחם', labelEn: 'Charcoal', swatch: '#262626',
    bg: '#262626', bgHover: '#262626', bgActive: '#262626',
    borderColor: '#404040',
  },
  stone: {
    id: 'stone', labelHe: 'אבן', labelEn: 'Stone', swatch: '#292524',
    bg: '#292524', bgHover: '#292524', bgActive: '#292524',
    borderColor: '#44403C',
  },
  neutral: {
    id: 'neutral', labelHe: 'נייטרל', labelEn: 'Neutral', swatch: '#262626',
    bg: '#262626', bgHover: '#262626', bgActive: '#262626',
    borderColor: '#404040',
  },
  mist: {
    id: 'mist', labelHe: 'ערפל בהיר', labelEn: 'Light Mist', swatch: '#F1F5F9',
    bg: '#F1F5F9', bgHover: '#F1F5F9', bgActive: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
};

export const ALL_PRESETS: Record<ButtonGroupKey, Record<string, ButtonThemePreset>> = {
  primary: PRIMARY_PRESETS,
  currency: CURRENCY_PRESETS,
  nav: NAV_PRESETS,
  filter: FILTER_PRESETS,
  text: TEXT_BUTTON_PRESETS,
  mainCard: MAIN_CARD_PRESETS,
  subCard: SUB_CARD_PRESETS,
};

export const DEFAULT_FILTER_GROUP_COLOR = 'charcoal';
export const DEFAULT_TEXT_COLOR = 'white';
export const DEFAULT_MAIN_CARD_SURFACE_COLOR = 'default';
export const DEFAULT_SUB_CARD_COLOR = 'default';
export const GUEST_TEXT_THEME_LS_KEY = 'guest_text_theme';

export type TypographyMode = 'default' | 'preset' | 'custom';

const TEXT_COLOR_CSS_VARS = [
  '--dynamic-text-color',
  '--typography-primary',
  '--typography-secondary',
  '--typography-muted',
  '--page-text',
  '--page-text-muted',
  '--page-text-subtle',
  '--surface-input-text',
  '--surface-input-placeholder',
  '--btn-primary-fg',
  '--btn-currency-fg',
  '--btn-nav-text',
  '--btn-nav-text-hover',
  '--btn-filter-text',
  '--btn-filter-text-hover',
] as const;

export function isTypographyCustomOverride(textColor: string): boolean {
  return isCustomColorChoice(textColor);
}

export function isTypographySystemDefault(textColor: string): boolean {
  return !isCustomColorChoice(textColor) && textColor === DEFAULT_TEXT_COLOR;
}

export function resolveTypographyMode(textColor: string): TypographyMode {
  if (isTypographyCustomOverride(textColor)) return 'custom';
  if (isTypographySystemDefault(textColor)) return 'default';
  return 'preset';
}

function setTextColorCssVars(root: HTMLElement, color: string): void {
  for (const cssVar of TEXT_COLOR_CSS_VARS) {
    root.style.setProperty(cssVar, color);
  }
}

function clearTextColorCssVars(root: HTMLElement): void {
  for (const cssVar of TEXT_COLOR_CSS_VARS) {
    root.style.removeProperty(cssVar);
  }
}

export const DEFAULT_BUTTON_THEME: ButtonGroupTheme = {
  primary: 'indigo',
  currency: 'blue',
  nav: 'indigo',
};

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
  pageMode: 'dark',
  pageCustomHex: MONO_DEPTH_PAGE_BG,
  buttons: { ...DEFAULT_BUTTON_THEME },
  filterGroupColor: DEFAULT_FILTER_GROUP_COLOR,
  textColor: DEFAULT_TEXT_COLOR,
  mainCardSurfaceColor: DEFAULT_MAIN_CARD_SURFACE_COLOR,
  subCardColor: DEFAULT_SUB_CARD_COLOR,
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
  text: {
    labelHe: 'צבעי כיתוב וכותרות',
    labelEn: 'Typography & Text Colors',
    descHe: 'כותרות, כפתורים, שדות קלט, תוויות, מקרא וגרפים — צבע מותאם מאחד הכל',
    descEn: 'Titles, buttons, inputs, labels, legends, and charts — custom color unifies all text',
  },
  mainCard: {
    labelHe: 'כרטיסים ומשטחים מרכזיים',
    labelEn: 'Main Cards & Surfaces',
    descHe: 'צבע לכלל הריבועים והכרטיסים החיצוניים המרכזיים באתר',
    descEn: 'Color for all major outer cards and layout wrappers across the app',
  },
  subCard: {
    labelHe: 'כרטיסי משנה ותתי-קטגוריות',
    labelEn: 'Sub-Cards & Inner Sections',
    descHe: 'מסגרות אקורדיון חיצוניות/פנימיות, פאנלים מורחבים, שורות משנה וכרטיסים מקוננים בתוך כרטיס ראשי',
    descEn: 'Outer/inner accordion frames, expanded panels, nested rows, and child cards inside masters',
  },
};

export function getGroupColorChoice(prefs: ThemePreferences, group: ButtonGroupKey): string {
  if (group === 'filter') return prefs.filterGroupColor;
  if (group === 'text') return prefs.textColor;
  if (group === 'mainCard') return prefs.mainCardSurfaceColor;
  if (group === 'subCard') return prefs.subCardColor;
  return prefs.buttons[group];
}

export const PAGE_THEME_META: Record<
  PageThemeMode,
  { labelHe: string; labelEn: string; swatch: string }
> = {
  dark: { labelHe: 'מצב כהה', labelEn: 'Dark Mode', swatch: MONO_DEPTH_PAGE_BG },
  light: { labelHe: 'מצב בהיר', labelEn: 'Light Mode', swatch: '#F8FAFC' },
  custom: { labelHe: 'צבע מותאם', labelEn: 'Custom Color', swatch: '#6366F1' },
};

// ─── Page palettes ────────────────────────────────────────────────────────────

const DARK_PAGE_PALETTE: PagePalette = {
  bg: MONO_DEPTH_PAGE_BG,
  surface: MONO_DEPTH_LEVEL_1,
  surfaceMuted: MONO_DEPTH_LEVEL_2,
  border: MONO_DEPTH_BORDER_DARK,
  text: MONO_DEPTH_CAT5_TEXT,
  textMuted: MONO_DEPTH_CAT5_TEXT,
  textSubtle: MONO_DEPTH_CAT5_TEXT,
  inputBg: MONO_DEPTH_CAT4_INPUT_BG,
  inputBorder: MONO_DEPTH_CAT4_INPUT_BORDER,
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

function deriveTypographyFromHex(hex: string): TextTypographyPalette {
  const normalized = normalizeCustomHex(hex);
  const light = isLightColor(normalized);
  return {
    primary: normalized,
    secondary: light ? darkenHex(normalized, 0.22) : lightenHex(normalized, 0.14),
    muted: light ? darkenHex(normalized, 0.42) : lightenHex(normalized, 0.32),
  };
}

export function resolveTypographyColors(choice: string): TextTypographyPalette {
  if (isCustomColorChoice(choice)) {
    return deriveTypographyFromHex(choice);
  }
  const preset = TEXT_PRESETS[choice] ?? TEXT_PRESETS[DEFAULT_TEXT_COLOR];
  return {
    primary: preset.primary,
    secondary: preset.secondary,
    muted: preset.muted,
  };
}

function deriveMainCardBorderColor(bg: string): string {
  const normalized = normalizeCustomHex(bg);
  return isLightColor(normalized) ? darkenHex(normalized, 0.1) : lightenHex(normalized, 0.12);
}

function deriveSubCardBorderColor(bg: string): string {
  if (bg.includes('/')) return bg;
  const normalized = normalizeCustomHex(bg.startsWith('#') ? bg : '#262626');
  return isLightColor(normalized) ? darkenHex(normalized, 0.08) : lightenHex(normalized, 0.1);
}

export function resolveSubCardColors(prefs: ThemePreferences): { bg: string; border: string } {
  const choice = prefs.subCardColor;
  const pagePalette = resolvePagePalette(prefs);

  if (!isCustomColorChoice(choice) && choice === DEFAULT_SUB_CARD_COLOR) {
    if (prefs.pageMode === 'dark') {
      return { bg: MONO_DEPTH_LEVEL_2, border: MONO_DEPTH_BORDER_DARK };
    }
    return { bg: pagePalette.surfaceMuted, border: pagePalette.border };
  }

  const resolved = resolveButtonColors('subCard', choice);
  const bg = resolved.bg;
  return {
    bg,
    border: resolved.borderColor ?? deriveSubCardBorderColor(bg),
  };
}

export function resolveMainCardSurfaceColors(
  prefs: ThemePreferences,
): { bg: string; border: string } {
  const choice = prefs.mainCardSurfaceColor;
  const pagePalette = resolvePagePalette(prefs);

  if (!isCustomColorChoice(choice) && choice === DEFAULT_MAIN_CARD_SURFACE_COLOR) {
    if (prefs.pageMode === 'dark') {
      return { bg: MONO_DEPTH_LEVEL_1, border: MONO_DEPTH_BORDER_DARK };
    }
    return { bg: pagePalette.surface, border: pagePalette.border };
  }

  const resolved = resolveButtonColors('mainCard', choice);
  const bg = resolved.bg;
  return {
    bg,
    border: resolved.borderColor ?? deriveMainCardBorderColor(bg),
  };
}

export function resolveButtonColors(
  group: ButtonGroupKey,
  choice: string,
): ButtonThemePreset {
  if (group === 'mainCard') {
    if (isCustomColorChoice(choice)) {
      const hex = normalizeCustomHex(choice);
      return {
        id: 'custom',
        labelHe: 'צבע מותאם',
        labelEn: 'Custom',
        swatch: hex,
        bg: hex,
        bgHover: hex,
        bgActive: hex,
        borderColor: deriveMainCardBorderColor(hex),
      };
    }
    return MAIN_CARD_PRESETS[choice] ?? MAIN_CARD_PRESETS[DEFAULT_MAIN_CARD_SURFACE_COLOR];
  }
  if (group === 'subCard') {
    if (isCustomColorChoice(choice)) {
      const hex = normalizeCustomHex(choice);
      return {
        id: 'custom',
        labelHe: 'צבע מותאם',
        labelEn: 'Custom',
        swatch: hex,
        bg: hex,
        bgHover: hex,
        bgActive: hex,
        borderColor: deriveSubCardBorderColor(hex),
      };
    }
    return SUB_CARD_PRESETS[choice] ?? SUB_CARD_PRESETS[DEFAULT_SUB_CARD_COLOR];
  }
  if (group === 'text') {
    if (isCustomColorChoice(choice)) {
      const hex = normalizeCustomHex(choice);
      return {
        id: 'custom',
        labelHe: 'צבע מותאם',
        labelEn: 'Custom',
        swatch: hex,
        bg: hex,
        bgHover: hex,
        bgActive: hex,
      };
    }
    return textPresetAsButtonPreset(TEXT_PRESETS[choice] ?? TEXT_PRESETS[DEFAULT_TEXT_COLOR]);
  }
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
  root.style.setProperty('--theme-enclosure-border', resolveThinEnclosureBorder(palette.surface));

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
  const filterEnclosure = resolveThinEnclosureBorder(filter.bg);
  root.style.setProperty('--btn-filter-border', filterEnclosure);

  const inputSurface = resolveCategory4InputSurface(prefs, filter);
  root.style.setProperty('--surface-input-bg', inputSurface.bg);
  root.style.setProperty('--surface-input-border', inputSurface.border);
  root.style.setProperty('--surface-input-text', filter.textColorHover ?? 'rgb(250 250 250)');
  root.style.setProperty('--surface-input-placeholder', filter.textColor ?? 'rgb(161 161 170)');
  root.style.setProperty('--surface-panel-bg', filter.bg);
  root.style.setProperty('--surface-panel-border', filter.borderColor ?? filterEnclosure);
  root.style.setProperty('--surface-modal-bg', filter.bg);
}

/** Cat 4 inputs — solid dark gray on default; decoupled from Level 3 panel blue. */
function resolveCategory4InputSurface(
  prefs: ThemePreferences,
  filter: ButtonThemePreset,
): { bg: string; border: string } {
  const isDefaultFilter =
    !isCustomColorChoice(prefs.filterGroupColor) &&
    prefs.filterGroupColor === DEFAULT_FILTER_GROUP_COLOR;

  if (isDefaultFilter && prefs.pageMode === 'dark') {
    return { bg: MONO_DEPTH_CAT4_INPUT_BG, border: MONO_DEPTH_CAT4_INPUT_BORDER };
  }

  const bg = filter.bgHover;
  return { bg, border: resolveThinEnclosureBorder(bg) };
}

function applyMainCardSurfaceCSS(prefs: ThemePreferences): void {
  const root = document.documentElement;
  const { bg } = resolveMainCardSurfaceColors(prefs);
  const border = resolveThinEnclosureBorder(bg);
  root.style.setProperty('--main-card-surface-bg', bg);
  root.style.setProperty('--main-card-surface-border', border);
  root.style.setProperty('--color-main-cards', bg);
  root.style.setProperty('--color-main-cards-border', border);
  root.dataset.mainCardMode =
    !isCustomColorChoice(prefs.mainCardSurfaceColor) &&
    prefs.mainCardSurfaceColor === DEFAULT_MAIN_CARD_SURFACE_COLOR
      ? 'default'
      : isCustomColorChoice(prefs.mainCardSurfaceColor)
        ? 'custom'
        : 'preset';
}

function applySubCardCSS(prefs: ThemePreferences): void {
  const root = document.documentElement;
  const { bg } = resolveSubCardColors(prefs);
  const border = resolveThinEnclosureBorder(bg);
  const overlays = resolveSubCardNestedListOverlays(bg);
  root.style.setProperty('--color-sub-cards', bg);
  root.style.setProperty('--color-sub-cards-border', border);
  root.style.setProperty('--color-sub-cards-divider', overlays.divider);
  root.style.setProperty('--color-sub-cards-stripe', overlays.stripe);
  root.style.setProperty('--color-sub-cards-hover', overlays.hover);
  root.dataset.subCardMode =
    !isCustomColorChoice(prefs.subCardColor) && prefs.subCardColor === DEFAULT_SUB_CARD_COLOR
      ? 'default'
      : isCustomColorChoice(prefs.subCardColor)
        ? 'custom'
        : 'preset';
}

/** Level 3 inner panels — derives from Level 2 when users customize Cat 7. */
function applyMonochromeDepthCSS(prefs: ThemePreferences): void {
  const root = document.documentElement;
  const { bg: level2Bg } = resolveSubCardColors(prefs);
  const level3Bg = isMonochromeDepthSystemDefault(prefs)
    ? MONO_DEPTH_LEVEL_3
    : deriveMonochromeLevel3FromLevel2(level2Bg);
  const level3Border = resolveMonochromeDepthBorder(level3Bg);
  root.style.setProperty('--color-depth-inner', level3Bg);
  root.style.setProperty('--color-depth-inner-border', level3Border);
  root.dataset.monochromeDepthMode = isMonochromeDepthSystemDefault(prefs) ? 'default' : 'derived';
}

function applyTypographyCSS(prefs: ThemePreferences): void {
  const root = document.documentElement;
  const mode = resolveTypographyMode(prefs.textColor);
  root.dataset.typographyMode = mode;

  if (mode === 'custom') {
    const hex = normalizeCustomHex(prefs.textColor);
    setTextColorCssVars(root, hex);
    return;
  }

  clearTextColorCssVars(root);

  const typography = resolveTypographyColors(
    mode === 'default' ? DEFAULT_TEXT_COLOR : prefs.textColor,
  );
  root.style.setProperty('--typography-primary', typography.primary);
  root.style.setProperty('--typography-secondary', typography.secondary);
  root.style.setProperty('--typography-muted', typography.muted);

  if (mode === 'preset') {
    root.style.setProperty('--surface-input-text', typography.primary);
    root.style.setProperty('--surface-input-placeholder', typography.muted);
    root.style.setProperty('--btn-nav-text', typography.secondary);
    root.style.setProperty('--btn-nav-text-hover', typography.primary);
    root.style.setProperty('--btn-filter-text', typography.muted);
    root.style.setProperty('--btn-filter-text-hover', typography.secondary);
  }
}

export function applyThemeCSS(prefs: ThemePreferences): void {
  applyPagePaletteCSS(resolvePagePalette(prefs));
  applyButtonGroupCSS(prefs);
  applyMainCardSurfaceCSS(prefs);
  applySubCardCSS(prefs);
  applyMonochromeDepthCSS(prefs);
  applyTypographyCSS(prefs);
}

/** @deprecated Use applyThemeCSS */
export function applyButtonThemeCSS(theme: ButtonGroupTheme): void {
  applyThemeCSS({
    ...DEFAULT_THEME_PREFERENCES,
    buttons: theme,
    filterGroupColor: DEFAULT_FILTER_GROUP_COLOR,
    textColor: DEFAULT_TEXT_COLOR,
    mainCardSurfaceColor: DEFAULT_MAIN_CARD_SURFACE_COLOR,
    subCardColor: DEFAULT_SUB_CARD_COLOR,
  });
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export const GUEST_THEME_LS_KEY = 'guest_theme_preferences';
const LEGACY_BUTTON_LS_KEY = 'money_manager_button_theme_v1';

function normalizeButtonChoice(group: ButtonGroupKey, value: string): string {
  if (isCustomColorChoice(value)) return normalizeCustomHex(value);
  const presets = ALL_PRESETS[group];
  const fallback =
    group === 'filter'
      ? DEFAULT_FILTER_GROUP_COLOR
      : group === 'text'
        ? DEFAULT_TEXT_COLOR
        : group === 'mainCard'
          ? DEFAULT_MAIN_CARD_SURFACE_COLOR
          : group === 'subCard'
            ? DEFAULT_SUB_CARD_COLOR
            : DEFAULT_BUTTON_THEME[group as keyof ButtonGroupTheme];
  return value in presets ? value : fallback;
}

function normalizeTextColorChoice(value: string | undefined): string {
  return normalizeButtonChoice('text', value ?? DEFAULT_TEXT_COLOR);
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

  let legacyText: string | undefined =
    typeof rawRecord?.textColor === 'string' ? rawRecord.textColor : undefined;
  if (!legacyText) {
    try {
      legacyText = window.localStorage.getItem(GUEST_TEXT_THEME_LS_KEY) ?? undefined;
    } catch {
      legacyText = undefined;
    }
  }

  return {
    pageMode,
    pageCustomHex,
    buttons: {
      primary: normalizeButtonChoice('primary', buttonsRaw?.primary ?? DEFAULT_BUTTON_THEME.primary),
      currency: normalizeButtonChoice('currency', buttonsRaw?.currency ?? DEFAULT_BUTTON_THEME.currency),
      nav: normalizeButtonChoice('nav', buttonsRaw?.nav ?? DEFAULT_BUTTON_THEME.nav),
    },
    filterGroupColor: normalizeButtonChoice('filter', legacyFilter),
    textColor: normalizeTextColorChoice(legacyText),
    mainCardSurfaceColor: normalizeButtonChoice(
      'mainCard',
      typeof rawRecord?.mainCardSurfaceColor === 'string'
        ? rawRecord.mainCardSurfaceColor
        : DEFAULT_MAIN_CARD_SURFACE_COLOR,
    ),
    subCardColor: normalizeButtonChoice(
      'subCard',
      typeof rawRecord?.subCardColor === 'string'
        ? rawRecord.subCardColor
        : DEFAULT_SUB_CARD_COLOR,
    ),
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
    window.localStorage.setItem(GUEST_TEXT_THEME_LS_KEY, prefs.textColor);
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
    a.filterGroupColor === b.filterGroupColor &&
    a.textColor === b.textColor &&
    a.mainCardSurfaceColor === b.mainCardSurfaceColor &&
    a.subCardColor === b.subCardColor
  );
}
