/**
 * GLOBAL LAYERED DEPTH SYSTEM — Monochrome Hierarchy (v2.0.0)
 * =============================================================================
 * CRITICAL COLOR PROTOCOL: Default states use an optimized monochromatic scale.
 * The outermost layer begins pure black; nested child containers step up
 * sequentially into lighter grays. Text (Category 5) remains white; Inputs
 * (Category 4) stay dark gray for readable UI depth by default.
 *
 * Level 0 — Page canvas:              #000000
 * Level 1 — Cat 6 master + gap canvas: #0A0A0A  (neutral-950)
 * Level 2 — Cat 7 sub-category capsules: #171717  (neutral-900)
 * Level 3 — Inner form/tool wrappers:    #27272A  (zinc-800)
 * Cat 4   — Inputs / dropdowns:        #18181B  (zinc-900)
 * Cat 5   — Typography default:        #FFFFFF  (pure white)
 * All levels — 1px perimeter:          rgba(255, 255, 255, 0.10)
 * =============================================================================
 */

import { normalizeCustomHex } from '../categories';
import type { ThemePreferences } from '../services/buttonThemeService';
import { isLightColor, lightenHex } from '../utils/colorUtils';
import { sampleSurfaceBgToHex } from './themeNestedListProtocol';

export const THEME_MONOCHROME_DEPTH_PROTOCOL_VERSION = '2.0.0';

/** Deepest app canvas. */
export const MONO_DEPTH_PAGE_BG = '#000000';

/** Level 1 — Outermost master accordion / Category 6 frame. */
export const MONO_DEPTH_LEVEL_1 = '#0A0A0A';

/** Level 2 — Expanded sub-category wrapper / Category 7 frame. */
export const MONO_DEPTH_LEVEL_2 = '#171717';

/** Level 3 — Innermost operational panels, calculators, form wrappers. */
export const MONO_DEPTH_LEVEL_3 = '#27272A';

/** Category 4 — input/dropdown surface (sinks inside Level 3). */
export const MONO_DEPTH_CAT4_INPUT_BG = '#18181B';

/** Category 4 — input perimeter border. */
export const MONO_DEPTH_CAT4_INPUT_BORDER = 'rgba(255, 255, 255, 0.10)';

/** Category 5 — locked default typography on dark monochrome. */
export const MONO_DEPTH_CAT5_TEXT = '#FFFFFF';

/** Standard 1px dark-mode perimeter (border-white/10). */
export const MONO_DEPTH_BORDER_DARK = 'rgba(255, 255, 255, 0.10)';

/** Standard 1px light-mode perimeter (border-black/10). */
export const MONO_DEPTH_BORDER_LIGHT = 'rgba(0, 0, 0, 0.10)';

export const MONO_DEPTH_CSS_VARS = {
  level1: '--main-card-surface-bg',
  level1Border: '--main-card-surface-border',
  level2: '--color-sub-cards',
  level2Border: '--color-sub-cards-border',
  level3: '--color-depth-inner',
  level3Border: '--color-depth-inner-border',
  pageBg: '--page-bg',
} as const;

export interface MonochromeDepthHierarchy {
  pageBg: string;
  level1: string;
  level2: string;
  level3: string;
  border: string;
  text: string;
  inputBg: string;
}

/** True when the built-in premium monochrome ladder should apply. */
export function isMonochromeDepthSystemDefault(prefs: ThemePreferences): boolean {
  return (
    prefs.pageMode === 'dark' &&
    prefs.mainCardSurfaceColor === 'default' &&
    prefs.subCardColor === 'default' &&
    prefs.filterGroupColor === 'charcoal'
  );
}

/** Resolve perimeter border from surface luminance. */
export function resolveMonochromeDepthBorder(surfaceBg: string): string {
  const hex = sampleSurfaceBgToHex(surfaceBg);
  return isLightColor(hex) ? MONO_DEPTH_BORDER_LIGHT : MONO_DEPTH_BORDER_DARK;
}

/** Derive Level 3 from a custom Level 2 hex (one lighten step). */
export function deriveMonochromeLevel3FromLevel2(level2Bg: string): string {
  if (level2Bg.startsWith('#')) {
    return lightenHex(normalizeCustomHex(level2Bg), 0.12);
  }
  return MONO_DEPTH_LEVEL_3;
}

/** Canonical default dark monochrome ladder. */
export function resolveDefaultMonochromeDepthHierarchy(): MonochromeDepthHierarchy {
  return {
    pageBg: MONO_DEPTH_PAGE_BG,
    level1: MONO_DEPTH_LEVEL_1,
    level2: MONO_DEPTH_LEVEL_2,
    level3: MONO_DEPTH_LEVEL_3,
    border: MONO_DEPTH_BORDER_DARK,
    text: MONO_DEPTH_CAT5_TEXT,
    inputBg: MONO_DEPTH_CAT4_INPUT_BG,
  };
}
