/**
 * @deprecated Use themeMonochromeDepthProtocol.ts — monochrome depth is the active standard (v2.0.0).
 */
export {
  THEME_MONOCHROME_DEPTH_PROTOCOL_VERSION as THEME_BLUE_DEPTH_PROTOCOL_VERSION,
  MONO_DEPTH_PAGE_BG as BLUE_DEPTH_PAGE_BG,
  MONO_DEPTH_LEVEL_1 as BLUE_DEPTH_LEVEL_1,
  MONO_DEPTH_LEVEL_2 as BLUE_DEPTH_LEVEL_2,
  MONO_DEPTH_LEVEL_3 as BLUE_DEPTH_LEVEL_3,
  MONO_DEPTH_CAT4_INPUT_BG as BLUE_DEPTH_CAT4_INPUT_BG,
  MONO_DEPTH_CAT4_INPUT_BORDER as BLUE_DEPTH_CAT4_INPUT_BORDER,
  MONO_DEPTH_BORDER_DARK as BLUE_DEPTH_BORDER_DARK,
  MONO_DEPTH_CSS_VARS as BLUE_DEPTH_CSS_VARS,
  isMonochromeDepthSystemDefault as isBlueDepthSystemDefault,
  resolveMonochromeDepthBorder as resolveBlueDepthBorder,
  deriveMonochromeLevel3FromLevel2 as deriveBlueDepthLevel3FromLevel2,
  resolveDefaultMonochromeDepthHierarchy as resolveDefaultBlueDepthHierarchy,
  type MonochromeDepthHierarchy as BlueDepthHierarchy,
} from './themeMonochromeDepthProtocol';
