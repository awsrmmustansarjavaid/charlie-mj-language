/**
 * Charlie MJ Language — additive transcript alignment engine.
 * No mutation of the existing transcript engine.
 */
export function normalizeSegments(segments) {
  return (Array.isArray(segments) ? segments : [])
    .map((s, i) => ({
      index: i,
      start: Number(s?.start) || 0,
      duration: Number(s?.duration) || 0,
      end: (Number(s?.start) || 0) + (Number(s?.duration) || 0),
      text: String(s?.text || '').trim(),
    }))
    .filter((s) => s.text);
}
function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s'-]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}
function sim(a, b) {
  const A = new Set(tokens(a)),
    B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return hit / Math.max(A.size, B.size);
}
export function alignWords(sourceText, targetText) {
  const A = tokens(sourceText),
    B = tokens(targetText);
  const out = [];
  for (let i = 0; i < A.length; i++) {
    const word = A[i];
    let best = -1,
      score = 0;
    for (let j = 0; j < B.length; j++) {
      const b = B[j];
      let sc = word === b ? 1 : word[0] === b[0] ? 0.25 : 0;
      if (sc > score) {
        score = sc;
        best = j;
      }
    }
    out.push({ source: word, target: best >= 0 ? B[best] : '', confidence: score });
  }
  return out;
}
export function alignTranscripts(original, translation) {
  const a = normalizeSegments(original),
    b = normalizeSegments(translation),
    out = [];
  if (!a.length || !b.length) return out;
  for (const s of a) {
    const candidates = b
      .map((t) => {
        const overlap = Math.max(0, Math.min(s.end, t.end) - Math.max(s.start, t.start));
        const time = Math.exp(-Math.abs((s.start + s.end) / 2 - (t.start + t.end) / 2) / 2);
        return {
          t,
          score:
            overlap > 0
              ? 0.65 +
                0.35 *
                  Math.min(1, overlap / Math.max(0.1, Math.min(s.duration || 1, t.duration || 1)))
              : 0.25 * time,
        };
      })
      .sort((x, y) => y.score - x.score)
      .slice(0, 3);
    const best = candidates[0];
    out.push({
      originalIndex: s.index,
      translationIndices: candidates
        .filter((x) => x.score >= Math.max(0.28, (best?.score || 0) - 0.18))
        .map((x) => x.t.index),
      confidence: Number(Math.min(1, best?.score || 0).toFixed(3)),
      original: s.text,
      translations: candidates
        .filter((x) => x.score >= Math.max(0.28, (best?.score || 0) - 0.18))
        .map((x) => x.t.text),
      wordAlignment: alignWords(s.text, candidates[0]?.t?.text || ''),
    });
  }
  return out;
}
