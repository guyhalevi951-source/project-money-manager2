/**
 * Synchronous theme bootstrap — runs before the React bundle to prevent flash.
 * Mirrors defaults from buttonThemeService.ts (keep in sync manually).
 */
(function () {
  var DARK = {
    bg: '#0A0A0A',
    surface: '#171717',
    surfaceMuted: '#262626',
    border: '#262626',
    text: '#F5F5F5',
    textMuted: '#A3A3A3',
    textSubtle: '#737373',
    inputBg: '#0A0A0A',
    inputBorder: '#404040',
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
      bg: 'rgb(10 10 10 / 0.85)',
      hover: 'rgb(38 38 38 / 0.75)',
      active: 'rgb(64 64 64 / 0.9)',
      text: 'rgb(163 163 163)',
      textHover: 'rgb(229 229 229)',
      border: 'rgb(38 38 38 / 0.8)',
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
    r.setProperty('--surface-input-bg', BTN.filter.hover);
    r.setProperty('--surface-input-border', BTN.filter.border);
    r.setProperty('--surface-input-text', BTN.filter.textHover);
    r.setProperty('--surface-input-placeholder', BTN.filter.text);
    r.setProperty('--surface-panel-bg', BTN.filter.bg);
    r.setProperty('--surface-panel-border', BTN.filter.border);
    r.setProperty('--surface-modal-bg', BTN.filter.bg);
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
  } catch (e) {
    /* keep defaults */
  }
})();
