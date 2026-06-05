/**
 * Unified button design tokens — two functional groups only.
 * Import from here; do not duplicate color classes in components.
 */

const transition = 'transition-all active:scale-[0.98]';

// ─── PRIMARY ACTION GROUP ─────────────────────────────────────────────────────
// Data-changing CTAs: submit, save, confirm, add expense, update budget.

const primaryColors =
  'bg-indigo-500 hover:bg-indigo-400 active:bg-indigo-600 text-white font-semibold';

const primaryShadow = 'shadow-md shadow-indigo-500/10';

export const primaryActionButtonClass = [
  'rounded-xl',
  primaryColors,
  primaryShadow,
  transition,
].join(' ');

export const primaryActionButtonBorderedClass = [
  primaryActionButtonClass,
  'border border-indigo-400/30',
].join(' ');

/** @deprecated Use primaryActionButtonClass — kept for existing imports. */
export const primaryActionButtonSemiboldClass = primaryActionButtonClass;

export const primaryActionActivePillClass = [
  'rounded-xl',
  primaryColors,
  primaryShadow,
].join(' ');

export const primaryActionDisabled =
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-indigo-500';

export const primaryActionAccentIconClass = 'text-indigo-400';

/** Selected chip / toggle state (currency picker, active filter). */
export const primaryActionSelectedChipClass =
  'bg-indigo-500 text-white shadow-md shadow-indigo-500/30 ring-1 ring-indigo-400/40';

// ─── CURRENCY UTILITY GROUP ───────────────────────────────────────────────────
// Vibrant royal blue for currency configuration shortcuts only.

const currencyUtilityColors =
  'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium';

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
// Settings shortcuts, page navigation, sub-budgets, currency panels, menu toggles.

const utilityColors =
  'bg-indigo-950/60 text-indigo-200 border border-indigo-900/50 hover:bg-indigo-900/70 hover:text-indigo-100';

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
  'rounded-2xl text-white font-medium',
  'bg-indigo-900/90 border border-indigo-700/60 shadow-md shadow-indigo-950/40',
  transition,
].join(' ');

/** Icon badge inside nav toggle (grid / home). */
export const utilityNavIconBadgeClass = [
  'flex items-center justify-center rounded-xl bg-indigo-950/60 border border-indigo-900/50 text-indigo-200',
].join(' ');

/** Mobile menu / grid toggle button. */
export const utilityNavMenuToggleClass = [
  'inline-flex items-center justify-center rounded-full border bg-indigo-950/60 text-indigo-200 border-indigo-900/50',
  'hover:bg-indigo-900/70 hover:text-indigo-100',
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
  'bg-indigo-900/50 text-indigo-200';
