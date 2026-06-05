/**
 * Theme style tokens — Categories 1–4 (see theme/themeCategoryMapping.ts).
 *
 * Cat 1 primary: primaryAction* — Cat 2 utility: currencyUtility*
 * Cat 3 navigation: utilityNav* — Cat 4 input/filter: filterBar*, filterForm*
 *
 * Classify new controls via classifyThemeCategory() before picking a token.
 * Import from here; do not duplicate color classes in components.
 */

const transition = 'transition-all active:scale-[0.98]';

// ─── PRIMARY ACTION GROUP ─────────────────────────────────────────────────────
// Data-changing CTAs: submit, save, confirm, add expense, update budget.
// Colors are driven by --btn-primary-* CSS variables.

const primaryColors =
  'bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] active:bg-[var(--btn-primary-active)] text-[var(--btn-primary-fg,#ffffff)] font-semibold';

const primaryShadow = 'shadow-md shadow-black/15';

export const primaryActionButtonClass = [
  'rounded-xl',
  primaryColors,
  primaryShadow,
  transition,
].join(' ');

export const primaryActionButtonBorderedClass = [
  primaryActionButtonClass,
  'border border-white/20',
].join(' ');

/** @deprecated Use primaryActionButtonClass — kept for existing imports. */
export const primaryActionButtonSemiboldClass = primaryActionButtonClass;

export const primaryActionActivePillClass = [
  'rounded-xl',
  primaryColors,
  primaryShadow,
].join(' ');

export const primaryActionDisabled =
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[var(--btn-primary-bg)]';

export const primaryActionAccentIconClass = 'text-[var(--btn-primary-bg)]';

/** Selected chip / toggle state (currency picker, active filter). */
export const primaryActionSelectedChipClass =
  'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg,#ffffff)] shadow-md shadow-black/20 ring-1 ring-white/20';

// ─── CURRENCY UTILITY GROUP ───────────────────────────────────────────────────
// Vibrant solid-color buttons for currency configuration shortcuts only.
// Colors driven by --btn-currency-* CSS variables.

const currencyUtilityColors =
  'bg-[var(--btn-currency-bg)] hover:bg-[var(--btn-currency-hover)] active:bg-[var(--btn-currency-active)] text-[var(--btn-currency-fg,#ffffff)] font-medium';

/** Budget-row currency shortcuts (display currency, manual rate, commissions). */
export const currencyUtilityButtonClass = [
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-center text-xs sm:text-sm',
  currencyUtilityColors,
  transition,
].join(' ');

/** Taller currency shortcut (expense form exchange-rate button). */
export const currencyUtilityButtonLgClass = [
  'inline-flex shrink-0 items-center justify-center rounded-xl px-3 text-center text-sm sm:px-4',
  currencyUtilityColors,
  transition,
].join(' ');

// ─── UTILITY & NAVIGATION GROUP ───────────────────────────────────────────────
// Settings shortcuts, page navigation, sub-budgets, menu toggles.
// Colors driven by --btn-nav-* CSS variables.

const utilityColors = [
  'bg-[var(--btn-nav-bg)]',
  'hover:bg-[var(--btn-nav-hover)]',
  'active:bg-[var(--btn-nav-active)]',
  'text-[var(--btn-nav-text)]',
  'hover:text-[var(--btn-nav-text-hover)]',
  'border border-[var(--btn-nav-border)]',
].join(' ');

/** Compact chip (currency settings row). */
export const utilityNavButtonClass = [
  'inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-3 py-2 text-center text-xs font-medium sm:text-sm',
  utilityColors,
  transition,
].join(' ');

/** Large flex button (sub-budgets navigation). */
export const utilityNavButtonLgClass = [
  'rounded-xl font-medium text-center',
  utilityColors,
  transition,
].join(' ');

/** Dashboard shortcut row (expense history, charts). */
export const utilityNavShortcutClass = [
  'shrink-0 rounded-xl px-2.5 py-2 text-xs font-medium leading-snug md:px-3 md:text-sm',
  utilityColors,
  transition,
].join(' ');

/** Active / selected navigation tab. */
export const utilityNavActiveTabClass = [
  'rounded-2xl text-[var(--btn-primary-fg,#ffffff)] font-medium',
  'bg-[var(--btn-primary-bg)] border border-white/20 shadow-md shadow-black/30',
  transition,
].join(' ');

/** Icon badge inside nav toggle (grid / home). */
export const utilityNavIconBadgeClass = [
  'flex items-center justify-center rounded-xl',
  'bg-[var(--btn-nav-bg)] border border-[var(--btn-nav-border)] text-[var(--btn-nav-text)]',
].join(' ');

/** Mobile menu / grid toggle button. */
export const utilityNavMenuToggleClass = [
  'inline-flex items-center justify-center rounded-full border',
  'bg-[var(--btn-nav-bg)] text-[var(--btn-nav-text)] border-[var(--btn-nav-border)]',
  'hover:bg-[var(--btn-nav-hover)] hover:text-[var(--btn-nav-text-hover)]',
  transition,
].join(' ');

/** Square icon-only utility button (back, swap, toolbar). */
export const utilityNavIconButtonClass = [
  'flex items-center justify-center rounded-xl',
  utilityColors,
  transition,
  'disabled:cursor-not-allowed disabled:opacity-50',
].join(' ');

const compactResponsive =
  'min-h-[2.5rem] w-full text-[11px] leading-tight tracking-tight whitespace-normal sm:min-h-[2.25rem] sm:w-auto sm:shrink-0 sm:px-2.5 sm:py-1.5 sm:text-xs sm:leading-snug sm:tracking-normal md:text-sm';

/** Compact panel utility action (exchange rate subcategory row). */
export const utilityNavCompactButtonClass = [
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center font-medium',
  utilityColors,
  transition,
  compactResponsive,
].join(' ');

/** Compact panel primary save action (exchange rate save rows). */
export const primaryActionCompactButtonClass = [
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center',
  primaryColors,
  primaryShadow,
  transition,
  compactResponsive,
  primaryActionDisabled,
].join(' ');

/** Selected option inside a dropdown listbox. */
export const utilityNavDropdownSelectedClass =
  'bg-[var(--btn-nav-hover)] text-[var(--btn-nav-text-hover)]';

// ─── INPUT, FILTER & DARK SURFACES GROUP ────────────────────────────────────────
// Text inputs, search bars, filter tabs, dropdown wrappers, modal cards, panels.
// Colors driven by --btn-filter-* CSS variables.

const filterBarColors = [
  'bg-[var(--btn-filter-bg)]',
  'border-[var(--btn-filter-border)]',
].join(' ');

const filterInactiveTabColors = [
  'text-[var(--btn-filter-text)]',
  'hover:text-[var(--btn-filter-text-hover)]',
  'hover:bg-[var(--btn-filter-hover)]',
].join(' ');

/** Tab bar container (שבוע/חודש/שנה, יומי/שבועי/חודשי/שנתי). */
export const filterBarContainerClass = [
  'flex p-1 rounded-2xl border',
  filterBarColors,
].join(' ');

/** Inactive tab inside a filter bar. */
export const filterBarInactiveTabClass = [
  'rounded-xl font-semibold transition-all duration-200 outline-none',
  filterInactiveTabColors,
].join(' ');

/** Dropdown / popover wrapper (currency menu, filter panels). */
export const filterDropdownWrapperClass = [
  'rounded-xl border shadow-xl shadow-black/50',
  filterBarColors,
].join(' ');

/** Nested panel surface inside settings / forms. */
export const filterPanelSurfaceClass = [
  'rounded-2xl border p-1',
  filterBarColors,
].join(' ');

/** Form control using surface palette (amount field, search in filter context). */
export const filterFormControlClass = [
  'rounded-xl border bg-[var(--surface-input-bg)] border-[var(--surface-input-border)]',
  'text-[var(--surface-input-text)] placeholder-[var(--surface-input-placeholder)]',
  'transition-all outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30',
].join(' ');

// ─── AUTH SIGN-UP STATIC BUTTONS (NEVER THEMED) ───────────────────────────────
// Hardcoded indigo — excluded from all dynamic theme groups per product requirement.

export const authSignupStaticButtonClass = [
  'auth-signup-static',
  'rounded-xl',
  'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700',
  'text-white font-semibold',
  'shadow-md shadow-indigo-500/10',
  'transition-all active:scale-[0.98]',
].join(' ');

export const authSignupStaticPillClass = [
  'auth-signup-static',
  'rounded-xl',
  'bg-indigo-600 text-white font-semibold',
  'shadow-md shadow-black/15',
].join(' ');

/** Level 3 inset panel nested inside a master card (calculators, charts). */
export const filterInsetPanelClass = [
  'rounded-xl border',
  'bg-[var(--color-depth-inner)] border-[var(--color-depth-inner-border)]',
].join(' ');
