/**
 * NESTED LIST SEPARATION PROTOCOL (v1.0.0)
 * =============================================================================
 * Universal visual separation for stacked sub-categories inside any Cat 6/7
 * accordion, settings group, or dynamic parameter list.
 *
 * ARCHITECTURE NOTE (train Cursor for future changes):
 * CRITICAL LAYOUT RULE: Each sub-category section (header + expanded body) must
 * render inside one fully rounded enclosing card (`subCardNestedSectionCapsuleClass`,
 * `rounded-xl`) with symmetric `p-4 sm:p-5` and 1px `--color-sub-cards-border`.
 * Sibling capsules use `gap-4` (`subCardNestedCapsuleStackClass`).
 *
 * ── Master category (מטבעות, הגדרות כלליות) ─────────────────────────────────
 * 1. `subCardMasterCategoryStackClass` — `gap-5` between top-level panels
 * 2. `MasterCategoryPanel` — collapsed `rounded-2xl`; expanded `rounded-2xl` + `p-5/p-6`
 * 3. `MasterCategoryPanelBody` — header + sub-capsules inside one master frame
 *
 * ── Accordion gap canvas (orange zone — Cat 6) ───────────────────────────────
 * 1. `MasterCategoryPanelBody` + `data-main-card-canvas` → `--color-main-cards`
 * 2. `SubCardNestedStack` variant="capsuleOnMain" → gaps expose Cat 6 backing
 *
 * ── Sub-category capsules (charcoal zone — Cat 7) ───────────────────────────
 * 1. `SubCategorySectionCard` → `--color-sub-cards` + 1px perimeter border
 * 2. Inside a sub-card body only: `SubCardNestedStack` variant="capsule"
 *
 * ── List mode (history rows) ────────────────────────────────────────────────
 * 1. `border-b` via `--color-sub-cards-divider` between consecutive flat rows
 * 2. Zebra `--color-sub-cards-stripe`; hover `--color-sub-cards-hover`
 * =============================================================================
 */

import { normalizeCustomHex } from '../categories';
import { isLightColor, rgbToHex } from '../utils/colorUtils';

export const THEME_NESTED_LIST_PROTOCOL_VERSION = '1.0.0';

/** Stack container — direct children are separated rows. */
export const NESTED_LIST_STACK_ATTR = 'data-nested-list-stack';

/** Single row inside a nested stack. */
export const NESTED_LIST_ITEM_ATTR = 'data-nested-list-item';

export interface SubCardNestedListOverlays {
  divider: string;
  stripe: string;
  hover: string;
}

/** Sample an opaque hex from any Cat 7 background string for luminance checks. */
export function sampleSurfaceBgToHex(bg: string): string {
  if (bg.startsWith('#')) return normalizeCustomHex(bg);
  const rgbMatch = bg.match(/rgb\(\s*(\d+)\s+(\d+)\s+(\d+)/);
  if (rgbMatch) {
    return rgbToHex({
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    });
  }
  return '#262626';
}

/**
 * Alpha-channel overlays that contrast on any Category 7 background.
 * Applied as CSS variables by applySubCardCSS().
 */
export function resolveSubCardNestedListOverlays(bg: string): SubCardNestedListOverlays {
  const hex = sampleSurfaceBgToHex(bg);
  const light = isLightColor(hex);
  return {
    divider: light ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)',
    stripe: light ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)',
    hover: light ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)',
  };
}
