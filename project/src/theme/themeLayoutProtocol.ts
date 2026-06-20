/**
 * THEME LAYOUT PROTOCOL — Anti-Clipping & Scroll Safety (v1.0.0)
 * =============================================================================
 * Source of truth for overflow, z-index, and scroll-margin rules across the app.
 * Wired through buttonThemeService + themeSurfaceStyles; enforced by
 * .cursor/rules/theme-layout-protocol.mdc
 *
 * ── חוקי מניעת חיתוך גלובליים (Anti-Clipping Layout Rules) ──────────────────
 * Any parent container card (Category 6, Category 7, or accordion shell) that
 * hosts interactive floating children (color pickers, dropdowns, popovers) MUST
 * NOT use `overflow: hidden` or `overflow-y-hidden`. Use `overflow-visible` so
 * overlays can extend past card borders until they portal to the document root.
 *
 * ── Global Z-Index Hierarchy ─────────────────────────────────────────────────
 * • Floating overlays (pickers, portaled menus): z-[9999] — always topmost
 * • App chrome (header, modals): z-40 – z-50
 * • Accordion headers & inline controls: z-10 – z-20
 *
 * ── מרחב גלילה בטוח (Guaranteed Scroll Safety Margins) ─────────────────────
 * Layouts with customization options or forms MUST include bottom padding
 * (`pb-24` → `pb-36`) so the lowest accordion row can scroll fully into view
 * when a picker opens at the bottom of the viewport.
 *
 * ARCHITECTURE NOTE (train Cursor for future changes):
 * Whenever creating or modifying a feature with expandable accordions or custom
 * color pickers, ensure the master frame allows visible overflow and sufficient
 * bottom-padding to maintain flawless scrollability.
 * =============================================================================
 */

export const THEME_LAYOUT_PROTOCOL_VERSION = '1.0.0';

/** Numeric z-index scale — prefer themeZIndexClass in Tailwind markup. */
export const THEME_Z_INDEX = {
  base: 0,
  accordionHeader: 10,
  inlineControls: 20,
  stickyToolbar: 20,
  navOverlay: 40,
  appHeader: 50,
  modalBackdrop: 50,
  floatingOverlay: 9999,
} as const;

/** Tailwind z-index utility classes aligned to THEME_Z_INDEX. */
export const themeZIndexClass = {
  accordionHeader: 'z-10',
  inlineControls: 'z-20',
  stickyToolbar: 'z-20',
  navOverlay: 'z-40',
  appHeader: 'z-50',
  floatingOverlay: 'z-[9999]',
} as const;

/**
 * Cat 6/7 cards & accordion shells hosting pickers — never clip floating UI.
 * Forbidden on these nodes: overflow-hidden, overflow-y-hidden, overflow-clip.
 */
export const themeAntiClipVisibleClass = 'overflow-visible';

/** Relative wrapper around color-picker triggers and inline dropdown anchors. */
export const themeFloatingHostClass = 'relative overflow-visible';

/** Popover / portaled menu surface — fixed positioning at document root. */
export const themeFloatingOverlayClass = [
  'fixed',
  themeZIndexClass.floatingOverlay,
].join(' ');

/** Sticky accordion or section header strip inside a scroll viewport. */
export const themeAccordionHeaderLayerClass = [
  'sticky top-0',
  themeZIndexClass.accordionHeader,
].join(' ');

/**
 * Primary vertical scroll viewport for profile/settings/customization flows.
 * Pair with themeScrollSafeContentClass on the inner content wrapper.
 */
/**
 * Primary vertical scroll viewport for profile/settings/customization flows.
 * Popovers portal to document.body — overflow-y-auto on this node is safe.
 * Never pair with themeAntiClipVisibleClass on the same element (they conflict).
 */
export const themeScrollViewportClass = [
  'min-h-0 flex-1 overflow-y-auto overflow-x-visible',
  'scroll-auto touch-pan-y',
  '[-webkit-overflow-scrolling:touch]',
].join(' ');

/**
 * Flex shell between app header and scroll viewport — caps height so flex-1 main scrolls.
 * Apply to the wrapper div when Profile or Settings is open.
 */
export const themeScrollRouteShellClass = 'relative flex min-h-0 flex-1 flex-col overflow-hidden';

/**
 * Page root modifier — locks viewport height so the inner main region receives wheel/touch scroll.
 */
export const themeScrollRoutePageClass = 'h-dvh max-h-dvh min-h-0 overflow-hidden';

/**
 * Mandatory bottom padding — keeps lowest accordion rows & action buttons fully reachable.
 */
export const themeScrollSafeContentClass = 'pb-32 sm:pb-36 md:pb-40';

/** Safe-area aware bottom padding for scroll-route content wrappers. */
export const themeScrollSafeContentStyle = {
  paddingBottom: 'max(8rem, calc(8rem + env(safe-area-inset-bottom, 0px)))',
} as const;

export const THEME_FLOATING_POPOVER_MAX_WIDTH_PX = 312;

export interface FloatingAnchorPosition {
  top: number;
  left: number;
  width: number;
}

/**
 * Computes fixed viewport coordinates for a portaled popover below (or above) an anchor.
 * Clamps to viewport edges; respects RTL by aligning to the anchor's end edge.
 */
export function computeFloatingAnchorPosition(
  anchor: HTMLElement,
  options?: {
    dir?: 'ltr' | 'rtl';
    gapPx?: number;
    estimatedHeightPx?: number;
    maxWidthPx?: number;
  },
): FloatingAnchorPosition {
  const gap = options?.gapPx ?? 8;
  const estimatedHeight = options?.estimatedHeightPx ?? 420;
  const maxWidth = options?.maxWidthPx ?? THEME_FLOATING_POPOVER_MAX_WIDTH_PX;
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(maxWidth, window.innerWidth - 16);

  let top = rect.bottom + gap;
  if (top + estimatedHeight > window.innerHeight - 8) {
    const above = rect.top - gap - estimatedHeight;
    top = above >= 8 ? above : Math.max(8, window.innerHeight - estimatedHeight - 8);
  }

  let left: number;
  if (options?.dir === 'rtl') {
    left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
  } else {
    left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  }

  return { top, left, width };
}
