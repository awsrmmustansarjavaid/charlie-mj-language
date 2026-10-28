/* Shared, dependency-free helpers. DOM is always built with createElement (YouTube enforces Trusted Types, so no innerHTML). */
(() => {
  const root = typeof window !== 'undefined' ? (window.YTP = window.YTP || {}) : {};

  root.escapeHtml = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );

  root.formatTime = (seconds, alwaysHours = false) => {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(total / 3600),
      m = Math.floor((total % 3600) / 60),
      s = total % 60;
    const mm = String(m).padStart(2, '0'),
      ss = String(s).padStart(2, '0');
    return h > 0 || alwaysHours ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  root.safeFilename = (name) =>
    String(name || 'youtube-transcript')
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^\.+/, '')
      .slice(0, 120) || 'youtube-transcript';

  /** Build DOM nodes without innerHTML. h("div", {class:"x", onClick:fn, data:{a:1}}, "text", childNode) */
  root.h = (tag, props = {}, ...children) => {
    const node = document.createElement(tag);
    applyProps(node, props);
    appendChildren(node, children);
    return node;
  };
  root.svg = (tag, props = {}, ...children) => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(props).forEach(([k, v]) => {
      if (v != null) node.setAttribute(k, String(v));
    });
    appendChildren(node, children);
    return node;
  };
  function applyProps(node, props) {
    Object.entries(props || {}).forEach(([key, value]) => {
      if (value == null || value === false) return;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'data')
        Object.entries(value).forEach(([k, v]) => {
          node.dataset[k] = String(v);
        });
      else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
      else if (key.startsWith('on') && typeof value === 'function')
        node.addEventListener(key.slice(2).toLowerCase(), value);
      else if (key === 'value') node.value = value;
      else if (key === 'checked') node.checked = Boolean(value);
      else node.setAttribute(key, value === true ? '' : String(value));
    });
  }
  function appendChildren(node, children) {
    children.flat(Infinity).forEach((child) => {
      if (child == null || child === false) return;
      node.append(child.nodeType ? child : document.createTextNode(String(child)));
    });
  }

  root.debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };
  root.clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  /** Shared brand/player icon so every surface uses the same glyph. */
  root.captionIcon = (size = '100%') =>
    root.svg(
      'svg',
      {
        viewBox: '0 0 36 36',
        width: size,
        height: size,
        'aria-hidden': 'true',
        focusable: 'false',
      },
      root.svg('rect', {
        x: 7,
        y: 9,
        width: 22,
        height: 18,
        rx: 3.2,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
      }),
      root.svg('rect', { x: 11, y: 14, width: 14, height: 2.4, rx: 1.2, fill: 'currentColor' }),
      root.svg('rect', {
        x: 11,
        y: 19.2,
        width: 9.5,
        height: 2.4,
        rx: 1.2,
        fill: 'currentColor',
        opacity: '.6',
      })
    );

  if (typeof module !== 'undefined') module.exports = root;
})();
