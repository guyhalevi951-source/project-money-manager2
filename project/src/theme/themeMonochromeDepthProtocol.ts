/**
 * GLOBAL LAYERED DEPTH SYSTEM — Monochrome Hierarchy (v2.0.0)
 * =============================================================================
 * FUTURE-PROOF COMPONENT MAPPING RULE (authoritative for Settings & Profile):
 * Whenever creating, editing, or rendering code inside Settings or Profile, do not
 * use arbitrary colors or sharp edges. Auto-classify every element into the
 * black-to-gray monochromatic depth stack (L1 Black → L2 Charcoal → L3 Light Gray,
 * Cat 4 Dark Gray inputs, Cat 5 White text) and enforce uniform rounded corners
 * (`rounded-xl` / `rounded-2xl`) plus `border border-white/10` on container frames.
 *
 * Orange Zone: expanded Level 1 backing canvas stays Cat 6; Level 2/3 capsules float on top.
 *
 * Level 0 — Page canvas:              #000000
 * Level 1 — Cat 6 master + gap canvas: #0A0A0A  (neutral-950)
 * Level 2 — Cat 7 sub-category capsules: #171717  (neutral-900)
 * Level 3 — Inner form/tool wrappers:    #27272A  (zinc-800)
 * Cat 4   — Inputs / dropdowns:        #0A0A0A  (neutral-950)
 * Cat 5   — Typography default:        #FFFFFF  (pure white)
 * All levels — 1px perimeter:          rgba(255, 255, 255, 0.10)
 * =============================================================================
 */

/** Permanent Cursor enforcement prompt — mirrored in SettingsPage & ProfilePage file headers. */
export const SETTINGS_PROFILE_CURSOR_ENFORCEMENT =
  'Whenever creating, editing, or rendering any code inside the Settings or Profile files, do not use arbitrary colors or sharp edges. Automatically classify elements into the established Black-to-Gray monochromatic depth stack (Level 1 Black, Level 2 Charcoal, Level 3 Light Gray, Category 4 Dark Gray Inputs, Category 5 White Text) and enforce uniform rounded corners on all container frames.';

/** DOM scope attribute for Settings/Profile auto-classification (index.css + components). */
export const SETTINGS_PROFILE_SCOPE_ATTR = 'data-settings-profile-scope' as const;

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
export const MONO_DEPTH_CAT4_INPUT_BG = '#0A0A0A';

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

/** True when the built-in premium monochrome ladder should apply (independent of page mode). */
export function isMonochromeDepthSystemDefault(prefs: ThemePreferences): boolean {
  return (
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
