/**
 * THIN BORDER ENCLOSURE PROTOCOL (v1.0.0)
 * =============================================================================
 * Global nested-border standard for layered structural containers.
 *
 * ARCHITECTURE NOTE (train Cursor for future changes):
 * Whenever two structural layout containers share a visual boundary or are
 * nested inside one another using identical or custom theme colors, a mandatory,
 * uniform thin border (1px) must wrap the inner element globally to enforce
 * proper depth and element separation.
 *
 * ── חוק מסגרת היקפית אוטומטית (Global Nested Border Rule) ───────────────────
 * Cat 7 (--color-sub-cards) nested inside Cat 6 (--main-card-surface-*) MUST
 * render a continuous `border` around the full perimeter (not only border-b).
 *
 * Border color uses alpha-channel overlays derived from surface luminance:
 * • Dark surfaces → rgba(255, 255, 255, 0.10)  (border-white/10)
 * • Light surfaces → rgba(0, 0, 0, 0.10)        (~ border-black/10)
 * =============================================================================
 */

import { sampleSurfaceBgToHex } from './themeNestedListProtocol';
import { isLightColor } from '../utils/colorUtils';

export const THEME_THIN_BORDER_PROTOCOL_VERSION = '1.0.0';

export const THEME_ENCLOSURE_BORDER_WIDTH = '1px';

/** CSS variable name for the global page-level enclosure tint. */
export const THEME_ENCLOSURE_BORDER_VAR = '--theme-enclosure-border';

/**
 * Resolves a crisp 1px enclosure border for any structural surface background.
 * Adapts automatically when users pick custom Cat 6/7 colors.
 */
export function resolveThinEnclosureBorder(surfaceBg: string): string {
  const hex = sampleSurfaceBgToHex(surfaceBg);
  const light = isLightColor(hex);
  return light ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.10)';
}
