/* Cue-based exporters (SRT + VTT). Dual cues are stacked, or joined with the delimiter in "delimited" layout. */
(() => {
  const root = window.YTP = window.YTP || {};
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  root.cueTime = (seconds, sep) => {
    const ms = Math.max(0, Math.round(seconds * 1000));
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms % 3600000 / 60000))}:${pad(Math.floor(ms % 60000 / 1000))}${sep}${pad(ms % 1000, 3)}`;
  };
  root.cueBody = (row, cols, s) => {
    const a = row[cols.first] || "", b = cols.second ? (row[cols.second] || "") : "";
    if (!cols.dual || !b) return a;
    return s.dualLayout === "delimited" || s.dualLayout === "side" ? `${a}${s.dualLayout === "side" ? "  " : s.delimiter}${b}` : `${a}\n${b}`;
  };
  root.cueEnd = (rows, i, s) => {
    const r = rows[i], next = rows[i + 1];
    let end = Math.max(r.end, r.start + (Number(s.srtMinDuration) || 1));
    if (next && next.start > r.start + 0.2 && end > next.start) end = next.start;
    return end;
  };
  const eol = (s) => (s.lineEnding === "crlf" ? "\r\n" : "\n");
  root.buildSrt = (rows, s, meta, o) => {
    const cols = root.columns(s, rows.some((r) => r.translation), o?.scope);
    const content = rows.map((r, i) => `${i + 1}\n${root.cueTime(r.start, ",")} --> ${root.cueTime(root.cueEnd(rows, i, s), ",")}\n${root.cueBody(r, cols, s)}`).join("\n\n") + "\n";
    return { content: content.replace(/\n/g, eol(s)), ext: "srt", mime: "application/x-subrip;charset=utf-8" };
  };
  root.buildVtt = (rows, s, meta, o) => {
    const cols = root.columns(s, rows.some((r) => r.translation), o?.scope);
    const content = "WEBVTT\n\n" + rows.map((r, i) => `${root.cueTime(r.start, ".")} --> ${root.cueTime(root.cueEnd(rows, i, s), ".")}\n${root.cueBody(r, cols, s)}`).join("\n\n") + "\n";
    return { content: content.replace(/\n/g, eol(s)), ext: "vtt", mime: "text/vtt;charset=utf-8" };
  };
})();
