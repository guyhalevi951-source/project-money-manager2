/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * THEME CATEGORY MAPPING STANDARD (v1.2.0) — Future-Proof Component Mapping
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Authoritative, rule-based registry for classifying ANY current or future UI
 * element into the correct theme preference group and style-token binding.
 *
 * Consumed by: buttonThemeService, actionButtonStyles, themeSurfaceStyles,
 * LanguageContext (theme provider), SettingsPage, ProfilePage, and Cursor rules.
 *
 * Monochrome depth ladder: theme/themeMonochromeDepthProtocol.ts (v2.0.0)
 *   L1 Black (Cat 6) → L2 Charcoal (Cat 7) → L3 Light Gray → Cat 4 inputs → Cat 5 text
 *
 * Implementation contract for new features:
 *   1. Classify the element: `classifyThemeCategory(hint)`
 *   2. Apply approved tokens: `getThemeStyleTokens(category)` or `MONOCHROME_DEPTH_COMPONENT_MAP`
 *   3. Tag the DOM node: `themeCategoryProps(category)` → data-theme-category
 *   4. Settings/Profile: scope with SETTINGS_PROFILE_SCOPE_ATTR + approved tokens only
 *   5. Never hardcode bg/text utility colors on outer structural wrappers.
 */

import type { ButtonGroupKey, PageThemeMode, ThemePreferences } from '../services/buttonThemeService';
import type { TranslationKey } from '../translations';
import {
  SETTINGS_PROFILE_CURSOR_ENFORCEMENT,
  SETTINGS_PROFILE_SCOPE_ATTR,
} from './themeMonochromeDepthProtocol';

/** Canonical category ids — align 1:1 with ThemePreferences + page canvas. */
export type ThemeCategoryId = ButtonGroupKey | 'page';

export type ThemeElementRole =
  | 'page-canvas'
  | 'primary-action'
  | 'utility-tool'
  | 'navigation'
  | 'input-surface'
  | 'typography'
  | 'main-card'
  | 'sub-card';

export const THEME_MAPPING_STANDARD_VERSION = '1.2.0' as const;

export { SETTINGS_PROFILE_CURSOR_ENFORCEMENT, SETTINGS_PROFILE_SCOPE_ATTR };

/**
 * Future-Proof Component Mapping — depth level → category → approved style tokens.
 * Use inside Settings/Profile (and any nested configuration UI) before adding markup.
 */
export const MONOCHROME_DEPTH_COMPONENT_MAP = {
  level1: {
    depth: 1,
    category: 'mainCard' as const,
    tailwindRef: 'bg-neutral-950',
    cssVar: '--main-card-surface-bg',
    radius: 'rounded-2xl',
    tokens: [
      'themeCardLgClass',
      'MasterCategoryPanel',
      'subCardMasterCategoryExpandedClass',
      'subCardMasterCategoryCollapsedClass',
      'filterBarActiveTabClass',
    ],
  },
  level2: {
    depth: 2,
    category: 'subCard' as const,
    tailwindRef: 'bg-neutral-900',
    cssVar: '--color-sub-cards',
    radius: 'rounded-xl',
    tokens: ['SubCategorySectionCard', 'subCardNestedSectionCapsuleClass', 'subCardClass'],
  },
  level3: {
    depth: 3,
    category: 'filter' as const,
    tailwindRef: 'bg-zinc-800',
    cssVar: '--color-depth-inner',
    radius: 'rounded-xl',
    tokens: ['surfacePanelClass', 'subCardSmClass', 'subCardGridCellClass'],
  },
  cat4: {
    depth: 4,
    category: 'filter' as const,
    tailwindRef: 'bg-neutral-950',
    cssVar: '--surface-input-bg',
    radius: 'rounded-xl',
    tokens: ['surfaceInputClass', 'surfaceSelectPillClass', 'filterFormControlClass', 'filterInsetPanelClass'],
  },
  cat5: {
    depth: 5,
    category: 'text' as const,
    tailwindRef: 'text-white',
    cssVar: '--typography-primary',
    radius: null,
    tokens: ['typographyTitleClass', 'typographyBodyClass', 'themeTextClass', 'themeTextMutedClass'],
  },
} as const;

export const THEME_CATEGORY_DATA_ATTR = 'data-theme-category' as const;

export const THEME_SCOPE_DATA_ATTR = 'data-theme-scope' as const;

/** DOM tags that always bind to Category 5 (typography) when not in default multi-color zones. */
export const TYPOGRAPHY_HTML_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'label', 'li', 'td', 'th', 'a',
] as const;

/** DOM tags / roles that always bind to Category 4 (input surfaces). */
export const INPUT_SURFACE_HTML_TAGS = ['input', 'textarea', 'select'] as const;

export interface ThemeCategoryRule {
  /** 0 = page canvas; 1–7 = profile accordion groups */
  number: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  id: ThemeCategoryId;
  labelHe: string;
  labelEn: string;
  /** Functional criterion — what this category governs. */
  criterionHe: string;
  criterionEn: string;
  /** How automatic binding is triggered in the codebase. */
  automaticBindHe: string;
  automaticBindEn: string;
  /** ThemePreferences key (page uses pageMode + pageCustomHex). */
  preferenceKey: keyof ThemePreferences | 'pageMode' | 'pageCustomHex';
  /** CSS custom properties written by applyThemeCSS / theme-boot.js */
  cssVariables: readonly string[];
  /** Approved style-token exports — import only from these modules. */
  styleTokenModule: 'actionButtonStyles' | 'themeSurfaceStyles';
  styleTokens: readonly string[];
  /** Optional translation keys that imply this category for action controls. */
  actionTranslationKeys?: readonly TranslationKey[];
  /** Lowercase Hebrew / English action fragments for label-based classification. */
  actionKeywords?: readonly string[];
}

// ─── Category 1: Primary actions ─────────────────────────────────────────────

const PRIMARY_ACTION_TRANSLATION_KEYS = [
  'profileSave',
  'profileColorThemeSave',
  'addExpense',
  'updateBudget',
  'colorSave',
  'currencyConfirmSave',
  'exchangeRateSaveManualRate',
  'exchangeRateSave24h',
  'exchangeRateSaveForever',
  'authLoginCta',
  'authCreateAccount',
  'authGuest',
  'removeSubBudget',
  'deleteExpense',
] as const satisfies readonly TranslationKey[];

const PRIMARY_ACTION_KEYWORDS = [
  'שמור', 'הוסף', 'עדכן', 'מחק', 'התחבר', 'אישור', 'אשר', 'שמירה',
  'save', 'add', 'update', 'delete', 'remove', 'confirm', 'submit', 'sign in', 'sign up',
] as const;

// ─── Category 2: Management & utility tools ────────────────────────────────

const UTILITY_TRANSLATION_KEYS = [
  'displayCurrency',
  'settingsCurrencySubManualRate',
  'settingsCurrencySubCommissions',
  'settingsCurrencySubExchange',
  'exchangeRateTitle',
  'exchangeRateSetManualRate',
  'exchangeRateManageManual',
  'exchangeRateSwapCurrencies',
  'exchangeRateAddCurrency',
  'currencyEditMode',
  'currencyFinishEditMode',
  'currencyLibraryTitle',
  'savedColorsTitle',
] as const satisfies readonly TranslationKey[];

const UTILITY_KEYWORDS = [
  'ייצוא', 'ניהול', 'קבע שער', 'שער חליפין', 'מטבע תצוגה', 'עמלות', 'רענן',
  'export', 'manage', 'exchange rate', 'display currency', 'commission', 'refresh',
] as const;

// ─── Category 3: Navigation & routing ───────────────────────────────────────

const NAVIGATION_TRANSLATION_KEYS = [
  'tabDashboard',
  'tabAnalytics',
  'tabExpenses',
  'subBudgetsTitle',
  'backToApp',
  'close',
  'authSwitchLanguage',
  'prevMonth',
  'nextMonth',
  'backToCurrentMonth',
  'prev',
  'next',
  'settings',
  'profile',
  'logout',
] as const satisfies readonly TranslationKey[];

const NAVIGATION_KEYWORDS = [
  'בית', 'ניווט', 'חזרה', 'הגדרות', 'פרופיל', 'שפה',
  'home', 'nav', 'back', 'settings', 'profile', 'language',
] as const;

// ─── Rule registry ───────────────────────────────────────────────────────────

export const THEME_CATEGORY_RULES: Record<ThemeCategoryId, ThemeCategoryRule> = {
  page: {
    number: 0,
    id: 'page',
    labelHe: 'רקע עמוד (מצב מערכת)',
    labelEn: 'Page Canvas (Global Mode)',
    criterionHe: 'רקע הבסיס המוחלט של כל המסמך — לא כרטיסים ולא כפתורים.',
    criterionEn: 'The absolute base canvas backdrop of the entire layout document.',
    automaticBindHe: 'נשלט על ידי מתג מצב כהה/בהיר/מותאם בפרופיל.',
    automaticBindEn: 'Governed entirely by the Light/Dark/Custom page mode switcher.',
    preferenceKey: 'pageMode',
    cssVariables: [
      '--page-bg', '--page-surface', '--page-surface-muted', '--page-border',
      '--page-text', '--page-text-muted', '--page-text-subtle',
      '--page-input-bg', '--page-input-border',
    ],
    styleTokenModule: 'themeSurfaceStyles',
    styleTokens: [
      'themePageRootClass',
      'themePageLoadingClass',
      'themeHeaderClass',
      'themeFooterClass',
    ],
  },
  primary: {
    number: 1,
    id: 'primary',
    labelHe: 'כפתורי פעולות ראשיות',
    labelEn: 'Primary Action Elements',
    criterionHe:
      'כפתור, קישור או פקד לחיץ שמבצע כתיבה, שליחה, יצירה או מחיקה (שינוי נתונים).',
    criterionEn:
      'Any button or clickable that performs write, submit, create, or destructive mutation.',
    automaticBindHe:
      'מופעל לפי מפתחות תרגום ומילות פעולה: שמור, הוסף, עדכן, מחק, התחבר, אישור.',
    automaticBindEn:
      'Triggered by action keys/labels: save, add, update, delete, sign-in, confirm.',
    preferenceKey: 'buttons',
    cssVariables: ['--btn-primary-bg', '--btn-primary-hover', '--btn-primary-active', '--btn-primary-fg'],
    styleTokenModule: 'actionButtonStyles',
    styleTokens: [
      'primaryActionButtonClass',
      'primaryActionButtonBorderedClass',
      'primaryActionActivePillClass',
      'primaryActionCompactButtonClass',
      'primaryActionSelectedChipClass',
      'primaryActionAccentIconClass',
    ],
    actionTranslationKeys: PRIMARY_ACTION_TRANSLATION_KEYS,
    actionKeywords: PRIMARY_ACTION_KEYWORDS,
  },
  currency: {
    number: 2,
    id: 'currency',
    labelHe: 'כלי ניהול והגדרות',
    labelEn: 'Management & Utility Tools',
    criterionHe:
      'פקדי תפעול משניים, מתגים, כלי ייצוא, הגדרות מקומיות וקיצורי מטבע.',
    criterionEn:
      'Secondary operational controls, toggles, export, local settings, currency utility pills.',
    automaticBindHe:
      'מטבע תצוגה, שער חליפין, עמלות, ניהול קטגוריות, ייצוא ורענון מקומי.',
    automaticBindEn:
      'Display currency, exchange rate, commissions, category tools, export, local refresh.',
    preferenceKey: 'buttons',
    cssVariables: ['--btn-currency-bg', '--btn-currency-hover', '--btn-currency-active', '--btn-currency-fg'],
    styleTokenModule: 'actionButtonStyles',
    styleTokens: [
      'currencyUtilityButtonClass',
      'currencyUtilityButtonLgClass',
      'currencySymbolTriggerClass',
    ],
    actionTranslationKeys: UTILITY_TRANSLATION_KEYS,
    actionKeywords: UTILITY_KEYWORDS,
  },
  nav: {
    number: 3,
    id: 'nav',
    labelHe: 'ניווט ומעבר דפים',
    labelEn: 'App Navigation & Routing',
    criterionHe: 'אלמנט שמטרתו היחידה היא ניתוב, מעבר טאבים או החלפת דף.',
    criterionEn: 'Structural control whose sole purpose is routing, tabs, or page changes.',
    automaticBindHe:
      'סרגל עליון, כפתור בית, גלובוס שפה, תפריט ניווט, קיצורי דפים וטאבים מבניים.',
    automaticBindEn:
      'Navbar, home button, language globe, nav menu, page shortcuts, structural tab toggles.',
    preferenceKey: 'buttons',
    cssVariables: [
      '--btn-nav-bg', '--btn-nav-hover', '--btn-nav-active',
      '--btn-nav-text', '--btn-nav-text-hover', '--btn-nav-border',
    ],
    styleTokenModule: 'actionButtonStyles',
    styleTokens: [
      'utilityNavButtonClass',
      'utilityNavButtonLgClass',
      'utilityNavShortcutClass',
      'utilityNavActiveTabClass',
      'utilityNavIconBadgeClass',
      'utilityNavMenuToggleClass',
      'utilityNavIconButtonClass',
      'utilityNavCompactButtonClass',
      'utilityNavDropdownSelectedClass',
    ],
    actionTranslationKeys: NAVIGATION_TRANSLATION_KEYS,
    actionKeywords: NAVIGATION_KEYWORDS,
  },
  filter: {
    number: 4,
    id: 'filter',
    labelHe: 'שדות קלט, סינון וכרטיסים כהים',
    labelEn: 'Input Surfaces & Secondary Cards',
    criterionHe:
      'שדות טופס, תיבות קלט, textarea, select, עטיפות dropdown ופאנלים משניים.',
    criterionEn:
      'Form fields, inputs, textareas, select wrappers, dropdown shells, secondary panels.',
    automaticBindHe: 'כל input/textarea/select מבני ועטיפות בחירה מותאמות.',
    automaticBindEn: 'All structural input/textarea/select and custom selection wrappers.',
    preferenceKey: 'filterGroupColor',
    cssVariables: [
      '--btn-filter-bg', '--btn-filter-hover', '--btn-filter-active',
      '--btn-filter-text', '--btn-filter-text-hover', '--btn-filter-border',
      '--surface-input-bg', '--surface-input-border', '--surface-input-text',
      '--surface-input-placeholder', '--surface-panel-bg', '--surface-panel-border',
      '--surface-modal-bg',
      '--color-depth-inner', '--color-depth-inner-border',
    ],
    styleTokenModule: 'actionButtonStyles',
    styleTokens: [
      'filterBarContainerClass',
      'filterBarInactiveTabClass',
      'filterDropdownWrapperClass',
      'filterPanelSurfaceClass',
      'filterFormControlClass',
      'filterInsetPanelClass',
      'surfaceInputClass',
      'surfaceInputLgClass',
      'surfaceSearchInputClass',
      'surfaceInputSmClass',
      'surfaceSelectPillClass',
      'surfacePanelClass',
      'subCardGridCellClass',
      'subCardGridCellIdleClass',
      'subCardSmClass',
      'monochromeToggleTrackOnClass',
      'monochromeToggleTrackOffClass',
      'monochromeToggleThumbClass',
      'monochromeDepthIconBadgeClass',
      'depthInnerSurfaceStyle',
      'depthInnerSurfaceBorderStyle',
    ],
  },
  text: {
    number: 5,
    id: 'text',
    labelHe: 'צבעי כיתוב וכותרות',
    labelEn: 'Global Typography & Icons',
    criterionHe:
      'כיסוי מוחלט של טקסט ואייקוני וקטור inline — עם fallback לגוונים סמנטיים במצב ברירת מחדל.',
    criterionEn:
      'Blanket foreground text and inline SVG icons; semantic multi-colors when default palette active.',
    automaticBindHe:
      'h1–h6, p, span, label, td, th ותוויות — נשלט ע"י --dynamic-text-color במצב מותאם.',
    automaticBindEn:
      'h1–h6, p, span, labels, table cells — --dynamic-text-color in custom override mode.',
    preferenceKey: 'textColor',
    cssVariables: [
      '--color-category-5', '--color-category-5-secondary', '--color-category-5-muted',
      '--dynamic-text-color', '--typography-primary', '--typography-secondary', '--typography-muted',
      '--page-text', '--page-text-muted', '--page-text-subtle',
    ],
    styleTokenModule: 'themeSurfaceStyles',
    styleTokens: [
      'typographyTitleClass',
      'typographyLabelClass',
      'typographyBodyClass',
      'typographyMutedClass',
      'themeTextClass',
      'themeTextMutedClass',
      'themeTextSubtleClass',
      'monochromeInlineIconClass',
      'monochromeStatusSavedClass',
    ],
  },
  mainCard: {
    number: 6,
    id: 'mainCard',
    labelHe: 'כרטיסים ומשטחים מרכזיים',
    labelEn: 'Main Master Cards',
    criterionHe:
      'מלבנים חיצוניים אבות, רקעי כרטיסים מבניים ופאנלים שמקבצים תת-אלמנטים.',
    criterionEn:
      'Outermost parent wrappers, structural card sheets, timeline boxes, modular segment panels.',
    automaticBindHe:
      'כרטיסי דשבורד, בורר חודש, היסטוריה, מודלים ראשיים, פרופיל והגדרות.',
    automaticBindEn:
      'Dashboard cards, month picker, history wrapper, modal backings, profile/settings shells.',
    preferenceKey: 'mainCardSurfaceColor',
    cssVariables: [
      '--main-card-surface-bg', '--main-card-surface-border',
      '--color-main-cards', '--color-main-cards-border',
    ],
    styleTokenModule: 'themeSurfaceStyles',
    styleTokens: [
      'themeCardClass',
      'themeCardLgClass',
      'surfaceModalClass',
      'surfaceModalLgClass',
      'mainCardSurfaceStyle',
      'subCardMasterCategoryStackClass',
      'subCardMasterCategoryCollapsedClass',
      'subCardMasterCategoryExpandedClass',
      'subCardMasterCategoryBodyClass',
      'subCardNestedCapsuleOnMainStackClass',
    ],
  },
  subCard: {
    number: 7,
    id: 'subCard',
    labelHe: 'כרטיסי משנה ותתי-קטגוריות',
    labelEn: 'Sub-Cards & Inner Sections',
    criterionHe:
      'כל מכלול פנימי, כרטיס משנה, או פאנל אקורדיון (חיצוני/פנימי) בתוך משטח ראשי (קטגוריה 6).',
    criterionEn:
      'Any inner container, sub-card, or structural outer/inner accordion panel inside a Category 6 master.',
    automaticBindHe:
      'מסגרות אקורדיון פרופיל/הגדרות, פאנלים מורחבים, רשימות קטגוריות מקוננות ושורות תנועה.',
    automaticBindEn:
      'Profile/settings accordion frames, expanded sub-panels, nested category lists, transaction line items.',
    preferenceKey: 'subCardColor',
    cssVariables: [
      '--color-sub-cards',
      '--color-sub-cards-border',
      '--color-sub-cards-divider',
      '--color-sub-cards-stripe',
      '--color-sub-cards-hover',
      '--theme-enclosure-border',
    ],
    styleTokenModule: 'themeSurfaceStyles',
    styleTokens: [
      'subCardAccordionShellClass',
      'subCardAccordionHeaderClass',
      'subCardAccordionTriggerClass',
      'subCardAccordionShellTriggerClass',
      'subCardAccordionBodyClass',
      'subCardNestedListStackClass',
      'subCardNestedCapsuleStackClass',
      'subCardNestedCapsuleClass',
      'subCardNestedSectionCapsuleClass',
      'subCardAccordionContentClass',
      'subCardAccordionBodyInsetClass',
      'subCardNestedItemClass',
      'subCardNestedAccordionTriggerClass',
      'subCardNestedExpandedClass',
      'themeEnclosureBorderClass',
      'subCardClass',
      'subCardSmClass',
      'subCardSectionClass',
      'subCardRowClass',
      'subCardTableHeadClass',
      'themeCardMutedClass',
      'subCardSurfaceStyle',
    ],
  },
};

/** Ordered evaluation — first match wins (most specific → most general). */
export const THEME_CLASSIFICATION_PRIORITY: readonly ThemeCategoryId[] = [
  'page',
  'mainCard',
  'subCard',
  'filter',
  'text',
  'nav',
  'primary',
  'currency',
] as const;

export interface ThemeClassificationHint {
  role?: ThemeElementRole;
  /** i18n key when the control label comes from tr() */
  translationKey?: TranslationKey | string;
  /** Resolved or hardcoded visible label (Hebrew/English) */
  label?: string;
  tagName?: string;
  htmlRole?: string;
  inputType?: string;
  /** type="submit" | form submission */
  isSubmitControl?: boolean;
  /** Outermost segment framing wrapper */
  isOuterLayoutContainer?: boolean;
  /** Modal / bottom-sheet backing card */
  isModalBacking?: boolean;
  /** Native or styled form control */
  isFormControl?: boolean;
  /** Custom select / dropdown shell */
  isDropdownWrapper?: boolean;
  /** Period / history filter tab bar (still Cat 4 — filter surfaces) */
  isFilterTabBar?: boolean;
  /** Sole purpose is route/tab/page change */
  isNavigationOnly?: boolean;
  /** Deletes or irreversibly mutates persisted data */
  isDestructiveMutation?: boolean;
  /** Creates or updates persisted records */
  isPrimaryMutation?: boolean;
  /** Text node or typographic heading */
  isTypographyNode?: boolean;
  /** Document root / page shell */
  isPageRoot?: boolean;
  /** Excluded from dynamic theming (auth sign-up static indigo) */
  excludedFromTheming?: boolean;
  /** Nested inside a Category 6 master card (accordion body, inset panel, list row) */
  isNestedInsideMasterCard?: boolean;
  /** Expanded accordion content panel */
  isAccordionBody?: boolean;
  /** Outer accordion shell wrapping header + body (profile/settings) */
  isAccordionShell?: boolean;
  /** Clickable accordion section header / trigger */
  isAccordionTrigger?: boolean;
  /** Transactional row inside history / sub-budget list */
  isListRowInsideMaster?: boolean;
}

function normalizeLabel(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function labelMatchesKeywords(label: string, keywords: readonly string[]): boolean {
  const normalized = normalizeLabel(label);
  if (!normalized) return false;
  return keywords.some((kw) => normalized.includes(kw.toLowerCase()));
}

function translationKeyInList(
  key: string | undefined,
  list: readonly TranslationKey[],
): boolean {
  if (!key) return false;
  return (list as readonly string[]).includes(key);
}

function isInputSurfaceTag(tagName: string | undefined): boolean {
  if (!tagName) return false;
  return (INPUT_SURFACE_HTML_TAGS as readonly string[]).includes(tagName.toLowerCase());
}

function isTypographyTag(tagName: string | undefined): boolean {
  if (!tagName) return false;
  return (TYPOGRAPHY_HTML_TAGS as readonly string[]).includes(tagName.toLowerCase());
}

/**
 * Rule-based classifier — deterministic priority chain.
 * Use when adding ANY new component to select the correct theme category.
 */
export function classifyThemeCategory(hint: ThemeClassificationHint): ThemeCategoryId {
  if (hint.excludedFromTheming) {
    return 'primary';
  }

  if (hint.isPageRoot || hint.role === 'page-canvas') {
    return 'page';
  }

  if (hint.isOuterLayoutContainer || hint.isModalBacking || hint.role === 'main-card') {
    return 'mainCard';
  }

  if (
    hint.isNestedInsideMasterCard ||
    hint.isAccordionShell ||
    hint.isAccordionTrigger ||
    hint.isAccordionBody ||
    hint.isListRowInsideMaster ||
    hint.role === 'sub-card'
  ) {
    return 'subCard';
  }

  if (
    hint.isFormControl ||
    hint.isDropdownWrapper ||
    hint.isFilterTabBar ||
    hint.role === 'input-surface' ||
    isInputSurfaceTag(hint.tagName)
  ) {
    return 'filter';
  }

  if (hint.isTypographyNode || hint.role === 'typography' || isTypographyTag(hint.tagName)) {
    return 'text';
  }

  const label = hint.label ?? '';
  const tKey = hint.translationKey;

  if (
    hint.isNavigationOnly ||
    hint.role === 'navigation' ||
    translationKeyInList(tKey, NAVIGATION_TRANSLATION_KEYS) ||
    labelMatchesKeywords(label, NAVIGATION_KEYWORDS)
  ) {
    return 'nav';
  }

  if (
    hint.isPrimaryMutation ||
    hint.isDestructiveMutation ||
    hint.isSubmitControl ||
    hint.role === 'primary-action' ||
    translationKeyInList(tKey, PRIMARY_ACTION_TRANSLATION_KEYS) ||
    labelMatchesKeywords(label, PRIMARY_ACTION_KEYWORDS) ||
    hint.inputType === 'submit'
  ) {
    return 'primary';
  }

  if (
    hint.role === 'utility-tool' ||
    translationKeyInList(tKey, UTILITY_TRANSLATION_KEYS) ||
    labelMatchesKeywords(label, UTILITY_KEYWORDS)
  ) {
    return 'currency';
  }

  if (hint.htmlRole === 'tab' || hint.htmlRole === 'option') {
    return 'nav';
  }

  if (hint.tagName === 'button' || hint.htmlRole === 'button') {
    return 'nav';
  }

  return 'text';
}

export function getThemeCategoryRule(category: ThemeCategoryId): ThemeCategoryRule {
  return THEME_CATEGORY_RULES[category];
}

export function getThemeStyleTokens(category: ThemeCategoryId): readonly string[] {
  return THEME_CATEGORY_RULES[category].styleTokens;
}

export function getThemeCssVariables(category: ThemeCategoryId): readonly string[] {
  return THEME_CATEGORY_RULES[category].cssVariables;
}

/** DOM props for permanent category tagging (enables audits & future auto-theming). */
export function themeCategoryProps(category: ThemeCategoryId): Record<string, string> {
  return { [THEME_CATEGORY_DATA_ATTR]: category };
}

/** Inline background bind for Category 6 outer cards. */
export function mainCardSurfaceInlineStyle(): { backgroundColor: string; borderColor: string } {
  return {
    backgroundColor: 'var(--main-card-surface-bg)',
    borderColor: 'var(--main-card-surface-border)',
  };
}

/** Inline background bind for Category 7 nested sub-cards. */
export function subCardSurfaceInlineStyle(): { backgroundColor: string; borderColor: string } {
  return {
    backgroundColor: 'var(--color-sub-cards)',
    borderColor: 'var(--color-sub-cards-border)',
  };
}

/** Maps ThemePreferences field used by a category (for save/reset bundling). */
export function getThemePreferenceField(category: ThemeCategoryId): keyof ThemePreferences | 'pageMode' | 'pageCustomHex' {
  return THEME_CATEGORY_RULES[category].preferenceKey;
}

export function isPageThemeMode(value: string): value is PageThemeMode {
  return value === 'dark' || value === 'light' || value === 'custom';
}

/**
 * Validates that a chosen style token belongs to the classified category.
 * Call in development when wiring new UI.
 */
export function assertStyleTokenMatchesCategory(
  category: ThemeCategoryId,
  tokenExportName: string,
): boolean {
  const allowed = getThemeStyleTokens(category);
  return allowed.includes(tokenExportName);
}
