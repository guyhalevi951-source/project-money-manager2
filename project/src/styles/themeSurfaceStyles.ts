/**
 * Semantic surface classes driven by --page-* and --surface-* CSS variables.
 * Group 4 (filterGroupColor) controls --surface-* tokens.
 */

export const themePageRootClass =
  'flex min-h-screen flex-col bg-[var(--page-bg)] text-[var(--page-text)]';

export const themePageLoadingClass =
  'min-h-screen bg-[var(--page-bg)] flex items-center justify-center text-[var(--page-text)]';

export const themeHeaderClass =
  'sticky top-0 z-50 shrink-0 bg-[var(--page-surface)]/80 backdrop-blur shadow-lg shadow-black/20 border-b border-[var(--page-border)]';

export const themeFooterClass =
  'hidden md:block border-t border-[var(--page-border)] bg-[var(--page-surface)] mt-8 sm:mt-12';

export const themeCardClass =
  'rounded-2xl border border-[var(--page-border)] bg-[var(--page-surface)] shadow-lg shadow-black/20';

export const themeCardLgClass =
  'rounded-3xl border border-[var(--page-border)] bg-[var(--page-surface)] shadow-2xl shadow-black/30';

export const themeCardMutedClass =
  'rounded-2xl border border-[var(--page-border)] bg-[var(--page-surface-muted)]';

export const themeTextClass = 'text-[var(--page-text)]';

export const themeTextMutedClass = 'text-[var(--page-text-muted)]';

export const themeTextSubtleClass = 'text-[var(--page-text-subtle)]';

const surfaceInputColors = [
  'bg-[var(--surface-input-bg)]',
  'border-[var(--surface-input-border)]',
  'text-[var(--surface-input-text)]',
  'placeholder-[var(--surface-input-placeholder)]',
].join(' ');

const surfaceInputFocus =
  'outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30';

/** Base class for all themed text inputs, textareas, and search bars. */
export const surfaceInputClass = [
  'rounded-xl border',
  surfaceInputColors,
  surfaceInputFocus,
].join(' ');

/** Standard full-width form input (expense description, category name, etc.). */
export const surfaceInputLgClass = `h-12 w-full min-w-0 px-4 text-base ${surfaceInputClass}`;

/** Search bar with icon padding. */
export const surfaceSearchInputClass = `w-full pr-11 pl-9 py-3 text-base ${surfaceInputClass}`;

/** Compact inline input (sub-budget amount, budget row). */
export const surfaceInputSmClass = `px-2 py-1.5 text-sm ${surfaceInputClass}`;

/** Currency / select custom pill wrapper. */
export const surfaceSelectPillClass = [
  'rounded-xl border',
  'bg-[var(--surface-input-bg)] border-[var(--surface-input-border)]',
  'text-[var(--surface-input-text)]',
  'transition-all outline-none',
].join(' ');

/** Secondary panels — legend boxes, stats containers, nested cards. */
export const surfacePanelClass = [
  'rounded-xl border',
  'bg-[var(--surface-panel-bg)] border-[var(--surface-panel-border)]',
].join(' ');

/** Modal dialog card surfaces (edit expense, budget confirm, etc.). */
export const surfaceModalClass = [
  'rounded-2xl border shadow-2xl shadow-black/60',
  'bg-[var(--surface-modal-bg)] border-[var(--surface-panel-border)]',
].join(' ');

/** Large modal (bottom sheet on mobile). */
export const surfaceModalLgClass = [
  'rounded-t-3xl sm:rounded-3xl border shadow-2xl shadow-black/60',
  'bg-[var(--surface-modal-bg)] border-[var(--surface-panel-border)]',
].join(' ');
