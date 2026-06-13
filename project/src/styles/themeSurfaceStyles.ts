/**
 * Theme style tokens — Categories 0, 4–7 (see theme/themeCategoryMapping.ts v1.2.0).
 *
 * Future-Proof Component Mapping: MONOCHROME_DEPTH_COMPONENT_MAP in themeCategoryMapping.ts
 * Settings/Profile scope: SETTINGS_PROFILE_SCOPE_ATTR — auto Cat 4/5 rules in index.css
 *
 * Cat 0 page: themePage* — Cat 4 inputs: surfaceInput* / surfacePanel*
 * Cat 5 typography: typography* (locked white on dark) — Cat 6 masters: themeCard*
 * Cat 7 sub-cards: subCard* — Monochrome L3: depthInner* / subCardSmClass
 */

export {
  THEME_THIN_BORDER_PROTOCOL_VERSION,
  THEME_ENCLOSURE_BORDER_VAR,
  THEME_ENCLOSURE_BORDER_WIDTH,
  resolveThinEnclosureBorder,
} from '../theme/themeThinBorderProtocol';

export {
  THEME_MONOCHROME_DEPTH_PROTOCOL_VERSION,
  MONO_DEPTH_PAGE_BG,
  MONO_DEPTH_LEVEL_1,
  MONO_DEPTH_LEVEL_2,
  MONO_DEPTH_LEVEL_3,
  MONO_DEPTH_BORDER_DARK,
  SETTINGS_PROFILE_CURSOR_ENFORCEMENT,
  SETTINGS_PROFILE_SCOPE_ATTR,
} from '../theme/themeMonochromeDepthProtocol';

export {
  THEME_NESTED_LIST_PROTOCOL_VERSION,
  NESTED_LIST_STACK_ATTR,
  NESTED_LIST_ITEM_ATTR,
  resolveSubCardNestedListOverlays,
  type SubCardNestedListOverlays,
} from '../theme/themeNestedListProtocol';

export {
  THEME_LAYOUT_PROTOCOL_VERSION,
  THEME_Z_INDEX,
  themeZIndexClass,
  themeAntiClipVisibleClass,
  themeFloatingHostClass,
  themeFloatingOverlayClass,
  themeAccordionHeaderLayerClass,
  themeScrollViewportClass,
  themeScrollRouteShellClass,
  themeScrollRoutePageClass,
  themeScrollSafeContentClass,
  themeScrollSafeContentStyle,
  computeFloatingAnchorPosition,
  THEME_FLOATING_POPOVER_MAX_WIDTH_PX,
  type FloatingAnchorPosition,
} from '../theme/themeLayoutProtocol';

export const APP_THEME_SCOPE = 'app' as const;

export const themePageRootClass =
  'flex min-h-screen flex-col bg-[var(--page-bg)] text-[var(--page-text)]';

export const themePageLoadingClass =
  'min-h-screen bg-[var(--page-bg)] flex items-center justify-center text-[var(--page-text)]';

export const themeHeaderClass =
  'sticky top-0 z-50 shrink-0 bg-[var(--page-surface)]/80 backdrop-blur shadow-lg shadow-black/20 border-b border-[var(--page-border)]';

export const themeFooterClass =
  'hidden md:block border-t border-[var(--page-border)] bg-[var(--page-surface)] mt-8 sm:mt-12';

const mainCardSurfaceColors = [
  'border border-[var(--main-card-surface-border)]',
  'bg-[var(--main-card-surface-bg)]',
].join(' ');

const subCardSurfaceColors = [
  'border border-[var(--color-sub-cards-border)]',
  'bg-[var(--color-sub-cards)]',
].join(' ');

/** Level 3 — innermost panels, grids, calculators, forms (lightest gray tier). */
const depthInnerSurfaceColors = [
  'border border-[var(--color-depth-inner-border)]',
  'bg-[var(--color-depth-inner)]',
].join(' ');

/** Universal 1px enclosure ring for nested structural panels. */
export const themeEnclosureBorderClass = 'border border-[var(--theme-enclosure-border)]';

/** Group 6 — standard outer layout card (dashboard, analytics, sub-budgets, history). */
export const themeCardClass = [
  'rounded-2xl border overflow-visible',
  mainCardSurfaceColors,
  'shadow-lg shadow-black/20',
].join(' ');

/** Group 6 — large outer shell (profile, settings, auth) — Level 1 depth. */
export const themeCardLgClass = [
  'rounded-2xl border overflow-visible',
  mainCardSurfaceColors,
  'shadow-lg shadow-black/25',
].join(' ');

/** Group 7 — full outer accordion shell (header + body) nested inside a master surface. */
export const subCardAccordionShellClass = [
  'rounded-3xl border overflow-visible',
  subCardSurfaceColors,
  'shadow-lg shadow-black/20',
].join(' ');

/** Group 7 — master accordion title strip (top header row inside a shell). */
export const subCardAccordionHeaderClass = [
  'flex items-center gap-2 border-b border-[var(--color-sub-cards-border)]',
  'bg-[var(--color-sub-cards)] p-5 sm:p-6',
].join(' ');

/** Group 7 — clickable accordion trigger (collapsed header / section opener). */
export const subCardAccordionTriggerClass = [
  'w-full cursor-pointer rounded-lg border p-4 text-start transition-opacity',
  subCardSurfaceColors,
  'hover:opacity-90 active:opacity-95',
].join(' ');

/** Group 7 — trigger flush inside an accordion shell (no outer radius clash). */
export const subCardAccordionShellTriggerClass = [
  'w-full cursor-pointer border-0 border-b border-[var(--color-sub-cards-border)] p-4 text-start transition-opacity',
  'bg-[var(--color-sub-cards)]',
  'hover:opacity-90 active:opacity-95',
].join(' ');

/** Group 7 — expanded accordion body panel inside a shell. */
export const subCardAccordionBodyClass = [
  'overflow-visible bg-[var(--color-sub-cards)]',
  'border-t border-[var(--color-sub-cards-border)]',
].join(' ');

/**
 * @deprecated Removed — bulky square body shell. Use subCardAccordionContentClass instead.
 */
export const subCardAccordionBodyInsetClass = subCardAccordionBodyClass;

/**
 * Transparent expanded region — NO background, border, or padding shell.
 * @deprecated Use MasterCategoryPanelBody inside MasterCategoryPanel instead.
 */
export const subCardAccordionContentClass = 'overflow-visible flex flex-col gap-3 sm:gap-4';

/** Attribute: outermost settings/profile category accordion (מטבעות, הגדרות כלליות). */
export const MASTER_CATEGORY_PANEL_ATTR = 'data-master-category-panel';

/** Attribute: Cat 6 backing sheet — gaps between floating Cat 7 capsules (orange zone). */
export const MAIN_CARD_CANVAS_ATTR = 'data-main-card-canvas';

/** Attribute: capsule stack riding on a Cat 6 canvas inside an expanded master accordion. */
export const NESTED_LIST_CAPSULES_ON_MAIN_ATTR = 'data-nested-list-capsules-on-main';

/** Vertical spacing between top-level master category panels on the page canvas. */
export const subCardMasterCategoryStackClass = 'flex flex-col gap-5 overflow-visible';

/**
 * Outermost category — collapsed trigger shell (rounded-2xl, compact padding).
 * Expands into subCardMasterCategoryExpandedClass when open.
 */
export const subCardMasterCategoryCollapsedClass = [
  'rounded-2xl',
  mainCardSurfaceColors,
  'overflow-visible',
  'p-4 sm:p-5',
  'shadow-sm shadow-black/15',
  'transition-[box-shadow,padding] duration-200 ease-out',
].join(' ');

/**
 * Outermost category — expanded master enclosure (Level 1 / Cat 6).
 * ריבוע מעטפת חיצוני עגול — wraps header + entire sub-capsule layout.
 */
export const subCardMasterCategoryExpandedClass = [
  'rounded-2xl',
  mainCardSurfaceColors,
  'overflow-visible',
  'p-5 sm:p-6',
  'shadow-lg shadow-black/20',
  'transition-[box-shadow,padding] duration-200 ease-out',
].join(' ');

/**
 * Expanded body inside a master category — Cat 6 parent backing sheet (orange zone).
 * Gaps between child capsules expose this surface, not page canvas or Cat 7.
 */
export const subCardMasterCategoryBodyClass = [
  'overflow-visible',
  'bg-[var(--main-card-surface-bg)]',
  'border-t border-[var(--main-card-surface-border)]',
  'mt-5 pt-5',
  'flex flex-col gap-4',
].join(' ');

/**
 * Capsule stack on Cat 6 canvas — spacing/gutters governed by main-card, cards by sub-cards.
 */
export const subCardNestedCapsuleOnMainStackClass = [
  'flex flex-col gap-4 overflow-visible',
  'bg-[var(--main-card-surface-bg)]',
].join(' ');

/** Group 7 — accordion / expanded section body inside a master card. */
export const subCardSectionClass = [
  'rounded-xl border overflow-visible',
  subCardSurfaceColors,
  'shadow-sm shadow-black/20',
].join(' ');

/** Group 7 — nested large panels (charts, sub-budget blocks, analytics insets). */
export const subCardClass = [
  'rounded-2xl border',
  subCardSurfaceColors,
].join(' ');

/** Level 3 — compact nested panel inside section cards (uniform rounded-xl + border). */
export const subCardSmClass = [
  'rounded-xl border',
  depthInnerSurfaceColors,
].join(' ');

/** Level 3 — monochrome icon badge inside Settings/Profile section headers. */
export const monochromeDepthIconBadgeClass = [
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
  depthInnerSurfaceColors,
  'text-[var(--color-category-5)]',
].join(' ');

/** Cat 5 — inline vector icon beside section titles. */
export const monochromeInlineIconClass = 'h-4 w-4 shrink-0 text-[var(--color-category-5)]';

/** Cat 4 — toggle track (off) — sinks into Level 2/3 containers. */
export const monochromeToggleTrackOffClass = [
  'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all',
  'border-[var(--surface-input-border)] bg-[var(--surface-input-bg)]',
].join(' ');

/** Cat 1 — toggle track (on) — primary accent for active persisted state. */
export const monochromeToggleTrackOnClass = [
  'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all',
  'border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)]',
].join(' ');

/** Toggle thumb — neutral white knob (control chrome, not typography). */
export const monochromeToggleThumbClass =
  'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform';

/** Profile avatar ring — Level 2 perimeter on Level 1 card. */
export const monochromeAvatarRingClass = [
  'rounded-full border-4 object-cover shadow-lg shadow-black/35',
  'border-[var(--color-sub-cards-border)]',
].join(' ');

/** Modal scrim behind Settings/Profile pickers. */
export const monochromeModalScrimClass = 'fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4';

/** Avatar picker tile — idle. */
export const monochromeAvatarPickerIdleClass = [
  'relative rounded-xl border p-1 transition-all',
  'border-[var(--page-border)] bg-[var(--page-surface-muted)]',
  'hover:border-[var(--theme-enclosure-border)]',
].join(' ');

/** Avatar picker tile — selected. */
export const monochromeAvatarPickerSelectedClass = [
  'relative rounded-xl border p-1 transition-all',
  'border-[var(--btn-primary-bg)] bg-[var(--color-depth-inner)]',
  'ring-1 ring-[var(--btn-primary-bg)]/40',
].join(' ');

/** Persisted-state confirmation copy (Cat 5). */
export const monochromeStatusSavedClass = [
  'flex items-center gap-1.5 text-sm',
  'text-[var(--color-category-5)]',
].join(' ');

/** Toast panel after theme reset — Level 3 capsule. */
export const monochromeToastPanelClass = [
  'pointer-events-none fixed bottom-6 left-1/2 z-50 w-[min(calc(100%-2rem),24rem)]',
  '-translate-x-1/2 rounded-xl border px-4 py-3 text-center text-sm font-medium',
  'shadow-xl shadow-black/40 backdrop-blur-sm',
  depthInnerSurfaceColors,
  'text-[var(--color-category-5)]',
].join(' ');

/** Level 3 — grid / pill cell (currency cards, action tiles) inside a sub-panel. */
export const subCardGridCellClass = [
  'rounded-xl',
  depthInnerSurfaceColors,
  'transition-colors duration-150',
  'hover:brightness-110',
].join(' ');

/** Group 7 — unselected grid cell resting state. */
export const subCardGridCellIdleClass = [
  subCardGridCellClass,
  'text-[var(--page-text-muted)] hover:text-[var(--page-text)]',
].join(' ');

/** Attribute: configuration stack uses isolated floating capsules (settings/profile). */
export const NESTED_LIST_CAPSULE_ATTR = 'data-nested-list-capsules';

/** @deprecated Use NESTED_LIST_CAPSULE_ATTR for configuration accordions. */
export const NESTED_LIST_ENCLOSED_ATTR = NESTED_LIST_CAPSULE_ATTR;

/** Group 7 — flat list stack (history rows — divider/zebra via index.css). */
export const subCardNestedListStackClass = 'flex flex-col overflow-visible';

/** Group 7 — capsule stack for settings/profile sub-categories (Level 2, 16px gap). */
export const subCardNestedCapsuleStackClass = 'flex flex-col gap-4 overflow-visible';

/** Group 7 — flat list row (history / table lines). */
export const subCardNestedItemClass = [
  'px-4 sm:px-5 py-4 sm:py-5',
  'bg-[var(--color-sub-cards)]',
  'transition-colors duration-150',
].join(' ');

/**
 * Level 2 — sub-category section card (header + expanded body).
 * rounded-xl + 1px border + symmetric p-4/p-5 inset.
 */
export const subCardNestedSectionCapsuleClass = [
  'rounded-xl',
  subCardSurfaceColors,
  'overflow-visible',
  'p-4 sm:p-5',
  'shadow-sm shadow-black/15',
].join(' ');

/** @deprecated Alias — use subCardNestedSectionCapsuleClass */
export const subCardNestedCapsuleClass = subCardNestedSectionCapsuleClass;

/** Flush accordion trigger inside a section capsule (no extra radius/border). */
export const subCardNestedAccordionTriggerClass = [
  'w-full cursor-pointer border-0 bg-transparent p-0 text-start',
  'transition-colors duration-150',
].join(' ');

/** Expanded body inside a section capsule — separated from header, same outer frame. */
export const subCardNestedExpandedClass = [
  'overflow-visible',
  'border-t border-[var(--color-sub-cards-border)]',
  'mt-4 pt-4 sm:mt-5 sm:pt-5',
].join(' ');

/** Group 7 — list row / table line-item inside a master history card. */
export const subCardRowClass = [
  'bg-[var(--color-sub-cards)]',
  'transition-colors duration-150 active:opacity-90',
].join(' ');

/** Group 7 — table header band inside a master card. */
export const subCardTableHeadClass = 'bg-[var(--color-sub-cards)]';

/** Inline style binding for Category 7 sub-card surfaces. */
export const subCardSurfaceStyle = {
  backgroundColor: 'var(--color-sub-cards)',
} as const;

export const subCardSurfaceBorderStyle = {
  borderColor: 'var(--color-sub-cards-border)',
} as const;

/** @deprecated Use subCardSectionClass — Category 7 */
export const mainCardSectionClass = subCardSectionClass;

/** @deprecated Use subCardClass — Category 7 */
export const mainCardInsetClass = subCardClass;

/** @deprecated Use subCardSmClass — Category 7 */
export const mainCardInsetSmClass = subCardSmClass;

/** Inline style binding for main card surfaces (mirrors --main-card-surface-bg). */
export const mainCardSurfaceStyle = {
  backgroundColor: 'var(--main-card-surface-bg)',
} as const;

export const mainCardSurfaceBorderStyle = {
  borderColor: 'var(--main-card-surface-border)',
} as const;

/** Group 7 — nested picker rows inside profile theme accordion. */
export const themeCardMutedClass = [
  'rounded-2xl border',
  subCardSurfaceColors,
].join(' ');

/** Category 5 — canonical dynamic typography variables (buttonThemeService.applyTypographyCSS). */
export const CATEGORY_5_COLOR_VAR = '--color-category-5' as const;
export const CATEGORY_5_SECONDARY_VAR = '--color-category-5-secondary' as const;
export const CATEGORY_5_MUTED_VAR = '--color-category-5-muted' as const;

/** Group 5 — primary foreground copy. */
export const themeTextClass = 'text-[var(--color-category-5)]';

export const themeTextMutedClass = 'text-[var(--color-category-5-secondary)]';

export const themeTextSubtleClass = 'text-[var(--color-category-5-muted)]';

/** Group 5 — primary titles & section headings. */
export const typographyTitleClass = 'text-[var(--color-category-5)]';

/** Group 5 — form labels, table cells, and body copy. */
export const typographyLabelClass = 'text-[var(--color-category-5-secondary)]';

export const typographyBodyClass = 'text-[var(--color-category-5-secondary)]';

/** Group 5 — legends, hints, and de-emphasized copy. */
export const typographyMutedClass = 'text-[var(--color-category-5-muted)]';

const surfaceInputColors = [
  'bg-[var(--surface-input-bg)]',
  'border border-[var(--surface-input-border)]',
  'text-[var(--surface-input-text,var(--color-category-5))]',
  'placeholder-[var(--surface-input-placeholder,var(--color-category-5-muted))]',
].join(' ');

const surfaceInputFocus =
  'outline-none transition-all focus:border-white/20 focus:ring-1 focus:ring-white/10';

/** Category 4 — all text inputs, textareas, search bars, select shells. */
export const surfaceInputClass = [
  'rounded-xl',
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
  'rounded-xl border border-[var(--surface-input-border)]',
  'bg-[var(--surface-input-bg)]',
  'text-[var(--surface-input-text,var(--color-category-5))]',
  'transition-all outline-none',
].join(' ');

/** Level 3 — secondary panels, calculators, exchange tools (group 4 / inner depth). */
export const surfacePanelClass = [
  'rounded-xl border',
  depthInnerSurfaceColors,
].join(' ');

/** Inline style binding for Level 3 inner-depth surfaces. */
export const depthInnerSurfaceStyle = {
  backgroundColor: 'var(--color-depth-inner)',
} as const;

export const depthInnerSurfaceBorderStyle = {
  borderColor: 'var(--color-depth-inner-border)',
} as const;

/** Modal dialog backing card (group 6). */
export const surfaceModalClass = [
  'rounded-2xl border shadow-2xl shadow-black/60',
  mainCardSurfaceColors,
].join(' ');

/** Large modal backing card / bottom sheet (group 6). */
export const surfaceModalLgClass = [
  'rounded-t-3xl sm:rounded-3xl border shadow-2xl shadow-black/60',
  mainCardSurfaceColors,
].join(' ');

/** Progress bar track — Category 4 input/filter surface. */
export const progressTrackClass = [
  'rounded-full overflow-hidden',
  'bg-[var(--surface-input-bg)] border border-[var(--surface-input-border)]',
].join(' ');

/** Empty-state icon well — Category 7 sub-card depth. */
export const emptyStateIconWellClass = [
  'flex items-center justify-center rounded-full',
  'bg-[var(--color-sub-cards)] border border-[var(--color-sub-cards-border)]',
].join(' ');

/** Dashed empty placeholder shell — Category 7 sub-card. */
export const dashedEmptyStateClass = [
  'rounded-xl border border-dashed',
  'border-[var(--color-sub-cards-border)] bg-[var(--color-sub-cards)]',
].join(' ');

/** Selectable list row on sub-card surfaces — Category 7. */
export const subCardListRowClass = [
  'rounded-xl border p-4 text-start transition-all',
  'border-[var(--color-sub-cards-border)] bg-[var(--color-sub-cards)]',
  'hover:border-[var(--btn-primary-bg)]/40 hover:bg-[var(--btn-filter-hover)]',
].join(' ');

/** Interactive fieldset option inside forms — Category 7. */
export const subCardOptionRowClass = [
  'rounded-lg border p-3 transition-colors',
  'border-[var(--color-sub-cards-border)]',
  'hover:bg-[var(--btn-filter-hover)]',
].join(' ');
