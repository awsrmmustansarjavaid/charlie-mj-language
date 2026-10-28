/* Converts YouTube caption payloads (json3, srv3 XML, legacy XML) into { start, end, text } segments. */
(() => {
  const root = typeof window !== 'undefined' ? (window.YTP = window.YTP || {}) : {};

  const ENTITY = /&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/i;
  root.decodeEntities = (value) => {
    let text = String(value ?? '');
    for (let i = 0; i < 2 && ENTITY.test(text); i += 1) {
      text = text.replace(/&(#\d+|#x[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) => {
        const l = e.toLowerCase();
        if (l === 'amp') return '&';
        if (l === 'lt') return '<';
        if (l === 'gt') return '>';
        if (l === 'quot') return '"';
        if (l === 'apos') return "'";
        if (l === 'nbsp') return ' ';
        const code = l[1] === 'x' ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10);
        try {
          return String.fromCodePoint(code);
        } catch {
          return m;
        }
      });
    }
    return text;
  };

  const tidy = (s) =>
    root
      .decodeEntities(s)
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  /** Give every segment a sensible end time and drop empties. */
  const finalize = (list) => {
    const rows = list
      .filter((r) => r.text && Number.isFinite(r.start))
      .sort((a, b) => a.start - b.start);
    rows.forEach((row, i) => {
      const next = rows[i + 1];
      if (!(row.end > row.start))
        row.end = next
          ? Math.max(row.start + 0.5, Math.min(next.start, row.start + 5))
          : row.start + 3;
    });
    return rows;
  };

  root.parseJson3 = (raw) => {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const events = Array.isArray(data?.events) ? data.events : [];
    return finalize(
      events
        .map((ev) => {
          if (!Array.isArray(ev.segs)) return null;
          const text = tidy(ev.segs.map((s) => s.utf8 || '').join(''));
          const start = (Number(ev.tStartMs) || 0) / 1000;
          return { start, end: start + (Number(ev.dDurationMs) || 0) / 1000, text };
        })
        .filter(Boolean)
    );
  };

  root.parseCaptionXml = (xmlText) => {
    const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    if (doc.querySelector('parsererror')) throw new Error('YouTube returned invalid caption data.');
    const nodes = [...doc.querySelectorAll('p[t], text[start]')];
    return finalize(
      nodes.map((node) => {
        const ms = node.hasAttribute('t');
        const start = Number(node.getAttribute(ms ? 't' : 'start') || 0) / (ms ? 1000 : 1);
        const dur = Number(node.getAttribute(ms ? 'd' : 'dur') || 0) / (ms ? 1000 : 1);
        return { start, end: start + dur, text: tidy(node.textContent || '') };
      })
    );
  };

  /** Auto-detect format from the payload. */
  root.parseCaptionPayload = (body) => {
    const t = String(body || '').trim();
    if (!t) throw new Error('YouTube returned an empty caption file.');
    return t[0] === '{' ? root.parseJson3(t) : root.parseCaptionXml(t);
  };

  if (typeof module !== 'undefined') module.exports = root;
})();
