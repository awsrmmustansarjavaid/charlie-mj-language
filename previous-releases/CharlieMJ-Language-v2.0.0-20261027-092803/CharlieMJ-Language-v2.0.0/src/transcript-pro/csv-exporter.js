/* CSV export with safe quoting. Excel-friendly when the UTF-8 BOM setting is on. */
(() => {
  const root = (window.YTP = window.YTP || {});
  root.buildCsv = (rows, s, meta) => {
    const d = s.csvDelimiter === '\\t' ? '\t' : s.csvDelimiter || ',';
    const q = (v) => {
      const t = String(v ?? '');
      return /["\r\n]/.test(t) || t.includes(d) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const head = ['start_seconds', 'end_seconds', 'timestamp', 'original', 'translation'];
    const body = rows.map((r) => [
      r.start.toFixed(3),
      r.end.toFixed(3),
      root.formatTime(r.start, true),
      r.text,
      r.translation || '',
    ]);
    return {
      content: [head, ...body].map((r) => r.map(q).join(d)).join('\r\n') + '\r\n',
      ext: 'csv',
      mime: 'text/csv;charset=utf-8',
    };
  };
})();
