/* TXT export: identical text to the Copy buttons. */
(() => {
  const root = (window.YTP = window.YTP || {});
  root.buildTxt = (segments, s, meta, o) => ({
    content: root.formatPlain(segments, s, meta, o),
    ext: 'txt',
    mime: 'text/plain;charset=utf-8',
  });
})();
