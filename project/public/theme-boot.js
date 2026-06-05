/**
 * Synchronous theme bootstrap — runs before the React bundle to prevent flash.
 * Mirrors defaults from buttonThemeService.ts (keep in sync manually).
 */
(function () {
  var MONO_DEPTH = {
    page: '#000000',
    level1: '#0A0A0A',
    level2: '#171717',
    level3: '#27272A',
    cat4Input: '#18181B',
    text: '#FFFFFF',
    border: 'rgba(255, 255, 255, 0.10)',
  };

  var DARK = {
    bg: MONO_DEPTH.page,
    surface: MONO_DEPTH.level1,
    surfaceMuted: MONO_DEPTH.level2,
    border: MONO_DEPTH.border,
    text: MONO_DEPTH.text,
    textMuted: MONO_DEPTH.text,
    textSubtle: MONO_DEPTH.text,
    inputBg: MONO_DEPTH.cat4Input,
    inputBorder: MONO_DEPTH.border,
  };

  var BTN = {
    primary: { bg: '#6366f1', hover: '#818cf8', active: '#4f46e5' },
    currency: { bg: '#2563eb', hover: '#3b82f6', active: '#1d4ed8' },
    nav: {
      bg: 'rgb(30 27 75 / 0.6)',
      hover: 'rgb(49 46 129 / 0.7)',
      active: 'rgb(49 46 129 / 0.9)',
      text: 'rgb(199 210 254)',
      textHover: 'rgb(224 231 255)',
      border: 'rgb(49 46 129 / 0.5)',
    },
    filter: {
      bg: MONO_DEPTH.level3,
      hover: '#3F3F46',
      active: '#52525B',
      text: MONO_DEPTH.text,
      textHover: MONO_DEPTH.text,
      border: MONO_DEPTH.border,
    },
    typography: {
      primary: MONO_DEPTH.text,
      secondary: MONO_DEPTH.text,
      muted: MONO_DEPTH.text,
    },
  };

  function applyPage(p) {
    var r = document.documentElement.style;
    r.setProperty('--page-bg', p.bg);
    r.setProperty('--page-surface', p.surface);
    r.setProperty('--page-surface-muted', p.surfaceMuted);
    r.setProperty('--page-border', p.border);
    r.setProperty('--page-text', p.text);
    r.setProperty('--page-text-muted', p.textMuted);
    r.setProperty('--page-text-subtle', p.textSubtle);
    r.setProperty('--page-input-bg', p.inputBg);
    r.setProperty('--page-input-border', p.inputBorder);
    document.documentElement.dataset.pageTheme = p.text === '#0F172A' ? 'light' : 'dark';
    r.setProperty(
      '--theme-enclosure-border',
      hexLum(p.surface) > 0.45 ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.10)',
    );
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', p.bg);
  }

  function applyButtons() {
    var r = document.documentElement.style;
    r.setProperty('--btn-primary-bg', BTN.primary.bg);
    r.setProperty('--btn-primary-hover', BTN.primary.hover);
    r.setProperty('--btn-primary-active', BTN.primary.active);
    r.setProperty('--btn-currency-bg', BTN.currency.bg);
    r.setProperty('--btn-currency-hover', BTN.currency.hover);
    r.setProperty('--btn-currency-active', BTN.currency.active);
    r.setProperty('--btn-nav-bg', BTN.nav.bg);
    r.setProperty('--btn-nav-hover', BTN.nav.hover);
    r.setProperty('--btn-nav-active', BTN.nav.active);
    r.setProperty('--btn-nav-text', BTN.nav.text);
    r.setProperty('--btn-nav-text-hover', BTN.nav.textHover);
    r.setProperty('--btn-nav-border', BTN.nav.border);
    r.setProperty('--btn-filter-bg', BTN.filter.bg);
    r.setProperty('--btn-filter-hover', BTN.filter.hover);
    r.setProperty('--btn-filter-active', BTN.filter.active);
    r.setProperty('--btn-filter-text', BTN.filter.text);
    r.setProperty('--btn-filter-text-hover', BTN.filter.textHover);
    r.setProperty('--btn-filter-border', BTN.filter.border);
    r.setProperty('--surface-input-bg', MONO_DEPTH.cat4Input);
    r.setProperty('--surface-input-border', MONO_DEPTH.border);
    r.setProperty('--surface-input-text', MONO_DEPTH.text);
    r.setProperty('--surface-input-placeholder', MONO_DEPTH.text);
    r.setProperty('--surface-panel-bg', BTN.filter.bg);
    r.setProperty('--surface-panel-border', BTN.filter.border);
    r.setProperty('--surface-modal-bg', BTN.filter.bg);
    r.setProperty('--typography-primary', BTN.typography.primary);
    r.setProperty('--typography-secondary', BTN.typography.secondary);
    r.setProperty('--typography-muted', BTN.typography.muted);
    r.setProperty('--main-card-surface-bg', MONO_DEPTH.level1);
    r.setProperty('--main-card-surface-border', MONO_DEPTH.border);
    r.setProperty('--color-main-cards', MONO_DEPTH.level1);
    r.setProperty('--color-main-cards-border', MONO_DEPTH.border);
    r.setProperty('--color-sub-cards', MONO_DEPTH.level2);
    r.setProperty('--color-sub-cards-border', MONO_DEPTH.border);
    r.setProperty('--color-depth-inner', MONO_DEPTH.level3);
    r.setProperty('--color-depth-inner-border', MONO_DEPTH.border);
    r.setProperty('--theme-enclosure-border', MONO_DEPTH.border);
    r.setProperty('--color-sub-cards-divider', MONO_DEPTH.border);
    r.setProperty('--color-sub-cards-stripe', 'rgba(255, 255, 255, 0.04)');
    r.setProperty('--color-sub-cards-hover', 'rgba(255, 255, 255, 0.06)');
  }

  function thinEnclosureBorder(bg) {
    var hex = typeof bg === 'string' && bg.charAt(0) === '#' ? bg : '#262626';
    return hexLum(hex) > 0.45 ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.10)';
  }

  function applySubCardNestedOverlays(bg) {
    var hex = typeof bg === 'string' && bg.charAt(0) === '#' ? bg : '#262626';
    var light = hexLum(hex) > 0.45;
    var r = document.documentElement.style;
    r.setProperty('--color-sub-cards-divider', light ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.10)');
    r.setProperty('--color-sub-cards-stripe', light ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.04)');
    r.setProperty('--color-sub-cards-hover', light ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.06)');
    r.setProperty('--color-sub-cards-border', thinEnclosureBorder(bg));
  }

  function hexLum(hex) {
    var h = hex.replace('#', '');
    if (h.length !== 6) return 0;
    var ch = function (i) {
      var s = parseInt(h.slice(i, i + 2), 16) / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  }

  function customPage(hex) {
    var light = hexLum(hex) > 0.45;
    if (light) {
      return {
        bg: hex,
        surface: '#FFFFFF',
        surfaceMuted: '#F1F5F9',
        border: '#E2E8F0',
        text: '#0F172A',
        textMuted: '#334155',
        textSubtle: '#64748B',
        inputBg: '#FFFFFF',
        inputBorder: '#CBD5E1',
      };
    }
    return {
      bg: hex,
      surface: '#171717',
      surfaceMuted: '#262626',
      border: '#404040',
      text: '#F5F5F5',
      textMuted: '#D4D4D4',
      textSubtle: '#A3A3A3',
      inputBg: '#0A0A0A',
      inputBorder: '#525252',
    };
  }

  applyPage(DARK);
  applyButtons();
  document.documentElement.dataset.typographyMode = 'default';

  try {
    var raw =
      localStorage.getItem('guest_theme_preferences') ||
      localStorage.getItem('money_manager_button_theme_v1');
    if (!raw) return;
    var t = JSON.parse(raw);

    if (t.pageMode === 'light') {
      applyPage({
        bg: '#F8FAFC',
        surface: '#FFFFFF',
        surfaceMuted: '#F1F5F9',
        border: '#E2E8F0',
        text: '#0F172A',
        textMuted: '#475569',
        textSubtle: '#64748B',
        inputBg: '#FFFFFF',
        inputBorder: '#CBD5E1',
      });
    } else if (t.pageMode === 'custom' && t.pageCustomHex) {
      applyPage(customPage(t.pageCustomHex));
    }

    var buttons = t.buttons || t;
    if (buttons && buttons.primary && buttons.primary.charAt(0) === '#') {
      document.documentElement.style.setProperty('--btn-primary-bg', buttons.primary);
    }
    if (buttons && buttons.currency && buttons.currency.charAt(0) === '#') {
      document.documentElement.style.setProperty('--btn-currency-bg', buttons.currency);
    }

    var textColor = t.textColor;
    if (!textColor) {
      try {
        textColor = localStorage.getItem('guest_text_theme');
      } catch (ignore) {}
    }
    var mainCardColor = t.mainCardSurfaceColor;
    var mainCardPresets = {
      white: { bg: '#FFFFFF', border: '#E2E8F0' },
      zinc: { bg: '#18181B', border: '#27272A' },
      charcoal: { bg: '#171717', border: '#262626' },
      slate: { bg: '#1E293B', border: '#334155' },
      stone: { bg: '#1C1917', border: '#292524' },
      neutral: { bg: '#171717', border: '#262626' },
    };
    if (mainCardColor && mainCardColor !== 'default') {
      if (mainCardColor.charAt(0) === '#') {
        document.documentElement.dataset.mainCardMode = 'custom';
        document.documentElement.style.setProperty('--main-card-surface-bg', mainCardColor);
        document.documentElement.style.setProperty(
          '--main-card-surface-border',
          thinEnclosureBorder(mainCardColor),
        );
      } else if (mainCardPresets[mainCardColor]) {
        document.documentElement.dataset.mainCardMode = 'preset';
        document.documentElement.style.setProperty(
          '--main-card-surface-bg',
          mainCardPresets[mainCardColor].bg,
        );
        document.documentElement.style.setProperty(
          '--main-card-surface-border',
          thinEnclosureBorder(mainCardPresets[mainCardColor].bg),
        );
      }
    } else {
      document.documentElement.dataset.mainCardMode = 'default';
      document.documentElement.style.setProperty('--main-card-surface-bg', MONO_DEPTH.level1);
      document.documentElement.style.setProperty('--main-card-surface-border', MONO_DEPTH.border);
      document.documentElement.style.setProperty('--color-main-cards', MONO_DEPTH.level1);
      document.documentElement.style.setProperty('--color-main-cards-border', MONO_DEPTH.border);
    }

    var subCardColor = t.subCardColor;
    var subCardPresets = {
      slate: { bg: 'rgb(30 41 59 / 0.5)', border: 'rgb(51 65 85 / 0.6)' },
      zinc: { bg: '#27272A', border: '#3F3F46' },
      charcoal: { bg: '#262626', border: '#404040' },
      stone: { bg: '#292524', border: '#44403C' },
      neutral: { bg: '#262626', border: '#404040' },
      mist: { bg: '#F1F5F9', border: '#E2E8F0' },
    };
    if (subCardColor && subCardColor !== 'default') {
      if (subCardColor.charAt(0) === '#') {
        document.documentElement.dataset.subCardMode = 'custom';
        document.documentElement.style.setProperty('--color-sub-cards', subCardColor);
        applySubCardNestedOverlays(subCardColor);
      } else if (subCardPresets[subCardColor]) {
        document.documentElement.dataset.subCardMode = 'preset';
        document.documentElement.style.setProperty('--color-sub-cards', subCardPresets[subCardColor].bg);
        applySubCardNestedOverlays(
          subCardPresets[subCardColor].bg.charAt(0) === '#'
            ? subCardPresets[subCardColor].bg
            : '#262626',
        );
      }
    } else {
      document.documentElement.dataset.subCardMode = 'default';
      document.documentElement.style.setProperty('--color-sub-cards', MONO_DEPTH.level2);
      document.documentElement.style.setProperty('--color-sub-cards-border', MONO_DEPTH.border);
      applySubCardNestedOverlays(MONO_DEPTH.level2);
      document.documentElement.style.setProperty('--color-depth-inner', MONO_DEPTH.level3);
      document.documentElement.style.setProperty('--color-depth-inner-border', MONO_DEPTH.border);
      document.documentElement.dataset.monochromeDepthMode = 'default';
    }

    if (textColor && textColor.charAt(0) === '#') {
      document.documentElement.dataset.typographyMode = 'custom';
      var textVars = [
        '--dynamic-text-color',
        '--typography-primary',
        '--typography-secondary',
        '--typography-muted',
        '--page-text',
        '--page-text-muted',
        '--page-text-subtle',
        '--surface-input-text',
        '--surface-input-placeholder',
        '--btn-primary-fg',
        '--btn-currency-fg',
        '--btn-nav-text',
        '--btn-nav-text-hover',
        '--btn-filter-text',
        '--btn-filter-text-hover',
      ];
      for (var i = 0; i < textVars.length; i++) {
        document.documentElement.style.setProperty(textVars[i], textColor);
      }
    }
  } catch (e) {
    /* keep defaults */
  }
})();
