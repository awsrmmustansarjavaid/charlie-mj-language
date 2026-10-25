/* Turns raw aligned segments into display/export text using the user's settings. */
(() => {
  const root = (typeof window !== "undefined" ? (window.YTP = window.YTP || {}) : {});

  const stripTags = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const stripCues = (s) => s.replace(/\[[^\]]*\]/g, "").replace(/♪[^♪]*♪?/g, "").replace(/^\s*\([^)]*\)\s*$/, "").replace(/\s+/g, " ").trim();

  /** Clean, de-duplicate and optionally merge into paragraphs. Never mutates the input. */
  root.prepareSegments = (segments, s, { merge = s.mergeParagraphs } = {}) => {
    let rows = segments.map((r) => ({ ...r, translation: r.translation || "" }));
    if (s.cleanTags) rows.forEach((r) => { r.text = stripTags(r.text); r.translation = stripTags(r.translation); });
    if (s.removeSoundCues) rows.forEach((r) => { r.text = stripCues(r.text); r.translation = stripCues(r.translation); });
    rows = rows.filter((r) => r.text || r.translation);

    if (s.removeDuplicates) {
      rows = rows.filter((r, i) => i === 0 || r.text !== rows[i - 1].text || r.translation !== rows[i - 1].translation);
    }
    if (merge) {
      const gap = Number(s.paragraphGap) || 2.5;
      const out = [];
      rows.forEach((r) => {
        const last = out[out.length - 1];
        const sentenceEnd = last && /[.!?…。？！؟۔]["')\]]?$/.test(last.text);
        if (last && r.start - last.end < gap && !(sentenceEnd && last.text.length > 380)) {
          last.text = `${last.text} ${r.text}`.trim();
          last.translation = `${last.translation} ${r.translation}`.trim();
          last.end = r.end;
        } else out.push({ ...r });
      });
      rows = out;
    }
    return rows;
  };

  root.formatStamp = (seconds, s, longVideo = false) => {
    const total = Math.max(0, Number(seconds) || 0);
    let body;
    switch (s.timestampFormat) {
      case "hhmmss": body = root.formatTime(total, true); break;
      case "mmss": { const m = Math.floor(total / 60), sec = Math.floor(total % 60); body = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`; break; }
      case "seconds": body = String(Math.floor(total)); break;
      case "ms": body = `${root.formatTime(total, true)}.${String(Math.round((total % 1) * 1000)).padStart(3, "0")}`; break;
      default: body = root.formatTime(total, longVideo);
    }
    if (s.timestampWrap === "brackets") return `[${body}]`;
    if (s.timestampWrap === "parens") return `(${body})`;
    return body;
  };

  /** Which text columns are active for this action. */
  root.columns = (s, hasTranslation, scopeOverride) => {
    const scope = scopeOverride || s.copyScope;
    const dual = Boolean(s.dualMode && hasTranslation);
    if (!dual) return { dual: false, first: "text", second: null };
    if (scope === "original") return { dual: false, first: "text", second: null };
    if (scope === "translation") return { dual: false, first: "translation", second: null };
    return s.swapOrder ? { dual: true, first: "translation", second: "text" } : { dual: true, first: "text", second: "translation" };
  };

  /** Plain-text transcript used for Copy and TXT. */
  root.formatPlain = (segments, s, meta = {}, o = {}) => {
    const timestamps = o.timestamps ?? s.timestamps;
    const hasTr = segments.some((r) => r.translation);
    const cols = root.columns(s, hasTr, o.scope);
    const long = segments.length ? segments[segments.length - 1].start >= 3600 : false;
    const sep = s.timestampSeparator === "\\t" ? "\t" : s.timestampSeparator;

    const lines = segments.map((r) => {
      const a = r[cols.first] || "";
      const b = cols.second ? (r[cols.second] || "") : "";
      const stamp = timestamps ? root.formatStamp(r.start, s, long) + sep : "";
      if (!cols.dual || !b) return `${stamp}${a}`;
      if (s.dualLayout === "side") return `${stamp}${a}\t${b}`;
      if (s.dualLayout === "delimited") return `${stamp}${a}${s.delimiter}${b}`;
      return `${stamp}${a}\n${b}`;
    });

    let text = lines.join(s.mergeParagraphs ? "\n\n" : "\n");
    if (s.removeBlankLines) text = s.mergeParagraphs ? text.replace(/\n{3,}/g, "\n\n") : text.replace(/\n{2,}/g, "\n");
    if (s.includeHeader && meta.title) {
      const langs = [meta.sourceLabel, cols.dual && meta.targetLabel ? meta.targetLabel : ""].filter(Boolean).join(" → ");
      const head = [meta.title, meta.url, langs && `Language: ${langs}`, `Exported: ${new Date().toISOString().slice(0, 10)}`].filter(Boolean).join("\n");
      text = `${head}\n\n${text}`;
    }
    return s.lineEnding === "crlf" ? text.replace(/\r?\n/g, "\r\n") : text;
  };

  /** Template for filenames: {title} {videoId} {channel} {lang} {date} {time} {format}. */
  root.buildFilename = (template, meta, ext) => {
    const now = new Date();
    const map = {
      title: meta.title || "youtube-transcript", videoId: meta.videoId || "", channel: meta.channel || "",
      lang: meta.lang || "", date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 8).replace(/:/g, "-"), format: ext
    };
    const name = String(template || "{title}").replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m));
    return `${root.safeFilename(name)}.${ext}`;
  };

  if (typeof module !== "undefined") module.exports = root;
})();
