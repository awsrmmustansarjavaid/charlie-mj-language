/*
 * Aligns a second-language track to the primary track by time.
 * Every secondary cue is assigned to exactly ONE primary line (the one whose time window contains
 * the cue's midpoint, or the nearest), so text is never duplicated across lines.
 */
(() => {
  const root = typeof window !== 'undefined' ? (window.YTP = window.YTP || {}) : {};

  root.alignTracks = (primary, secondary) => {
    const out = primary.map((line) => ({ ...line, translation: '' }));
    if (!secondary?.length || !out.length) return out;

    // Fast path: translated tracks usually mirror the original cue-for-cue.
    if (
      secondary.length === out.length &&
      secondary.every((s, i) => Math.abs(s.start - out[i].start) < 0.75)
    ) {
      secondary.forEach((s, i) => {
        out[i].translation = s.text;
      });
      return out;
    }

    const buckets = out.map(() => []);
    const starts = out.map((l) => l.start);
    const findIndex = (t) => {
      // last primary line starting at or before t
      let lo = 0,
        hi = starts.length - 1,
        ans = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (starts[mid] <= t) {
          ans = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      return ans;
    };
    secondary.forEach((cue) => {
      const mid = (cue.start + Math.max(cue.end, cue.start + 0.2)) / 2;
      let i = findIndex(mid);
      // If the midpoint falls after this line ends and the next line starts closer, prefer the next one.
      const next = out[i + 1];
      if (next && mid >= out[i].end && Math.abs(next.start - mid) < Math.abs(mid - out[i].end))
        i += 1;
      buckets[i].push(cue.text);
    });
    buckets.forEach((texts, i) => {
      out[i].translation = texts.join(' ').replace(/\s+/g, ' ').trim();
    });
    return out;
  };

  if (typeof module !== 'undefined') module.exports = root;
})();
