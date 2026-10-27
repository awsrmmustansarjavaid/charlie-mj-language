/* Theme engine shared by the YouTube panel and the settings-page live preview. */
(() => {
  const root = typeof window !== 'undefined' ? (window.YTP = window.YTP || {}) : {};

  root.PRESETS = {
    light: {
      colorBg: '#ffffff',
      colorText: '#0f0f0f',
      colorOriginal: '#0f0f0f',
      colorTranslation: '#5a5a5a',
      colorTime: '#cc0000',
      colorAccent: '#e62117',
      colorActive: '#fde8e6',
      colorBorder: '#e3e3e3',
      colorHeader: '#f7f7f7',
    },
    dark: {
      colorBg: '#181818',
      colorText: '#f1f1f1',
      colorOriginal: '#f1f1f1',
      colorTranslation: '#aaaaaa',
      colorTime: '#ff7a70',
      colorAccent: '#ff4e45',
      colorActive: '#3a2220',
      colorBorder: '#303030',
      colorHeader: '#212121',
    },
    midnight: {
      colorBg: '#0d1626',
      colorText: '#e6edf7',
      colorOriginal: '#e6edf7',
      colorTranslation: '#8fb3e6',
      colorTime: '#5cc8ff',
      colorAccent: '#3ea6ff',
      colorActive: '#173250',
      colorBorder: '#22314a',
      colorHeader: '#111d33',
    },
    sepia: {
      colorBg: '#f6efe0',
      colorText: '#3b2f1e',
      colorOriginal: '#3b2f1e',
      colorTranslation: '#7a6648',
      colorTime: '#a8531d',
      colorAccent: '#b5651d',
      colorActive: '#ecdcb8',
      colorBorder: '#dccfb0',
      colorHeader: '#efe5cc',
    },
    forest: {
      colorBg: '#10201a',
      colorText: '#e3f2ea',
      colorOriginal: '#e3f2ea',
      colorTranslation: '#8fc4a8',
      colorTime: '#6ee7a0',
      colorAccent: '#2fbf71',
      colorActive: '#1c3a2c',
      colorBorder: '#24402f',
      colorHeader: '#152a21',
    },
    contrast: {
      colorBg: '#000000',
      colorText: '#ffffff',
      colorOriginal: '#ffffff',
      colorTranslation: '#ffe066',
      colorTime: '#00e5ff',
      colorAccent: '#ffe066',
      colorActive: '#26260a',
      colorBorder: '#ffffff',
      colorHeader: '#000000',
    },
  };

  const FONTS = {
    system: 'Roboto, "Segoe UI", system-ui, -apple-system, Arial, sans-serif',
    serif: 'Georgia, "Noto Serif", "Times New Roman", serif',
    mono: 'ui-monospace, "Cascadia Mono", Consolas, "Courier New", monospace',
    rounded: '"Trebuchet MS", "Segoe UI Rounded", "Nunito", system-ui, sans-serif',
  };

  root.isDark = () => {
    const onYouTube = /(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname);
    if (onYouTube) return document.documentElement.hasAttribute('dark');
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
  };

  root.resolveColors = (s) => {
    if (s.theme === 'custom') {
      const out = {};
      Object.keys(root.PRESETS.light).forEach((k) => {
        out[k] = s[k] || root.PRESETS.light[k];
      });
      return out;
    }
    if (root.PRESETS[s.theme]) return root.PRESETS[s.theme];
    return root.isDark() ? root.PRESETS.dark : root.PRESETS.light;
  };

  /** Paint an element (the panel or the preview) from settings using CSS variables only. */
  root.applyTheme = (el, s) => {
    if (!el) return;
    const c = root.resolveColors(s);
    const set = (k, v) => el.style.setProperty(k, v);
    set('--ytp-bg', c.colorBg);
    set('--ytp-text', c.colorText);
    set('--ytp-original', c.colorOriginal);
    set('--ytp-translation', c.colorTranslation);
    set('--ytp-time', c.colorTime);
    set('--ytp-accent', c.colorAccent);
    set('--ytp-active', c.colorActive);
    set('--ytp-border', c.colorBorder);
    set('--ytp-header', c.colorHeader);
    set('--ytp-font', FONTS[s.fontFamily] || FONTS.system);
    set('--ytp-size', `${s.fontSize}px`);
    set('--ytp-size-tr', `${s.translationSize}px`);
    set('--ytp-lh', String(s.lineHeight));
    set('--ytp-radius', `${s.radius}px`);
    set('--ytp-opacity', `${Math.min(100, Math.max(40, Number(s.opacity) || 100))}%`);
    set('--ytp-width', `${s.panelWidth}px`);
    set('--ytp-height', `${s.panelHeight}px`);
    set('--ytp-list-h', `${s.listHeight}px`);
    el.dataset.density = s.density;
    el.dataset.highlight = s.highlightStyle;
    el.dataset.layout = s.dualLayout;
  };

  if (typeof module !== 'undefined') module.exports = root;
})();
