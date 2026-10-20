export function pickNativeTrack(tracks, target) {
  const l = String(target || 'en').split('-')[0].toLowerCase();
  return (tracks || []).find(t => String(t.languageCode || '').split('-')[0].toLowerCase() === l && t.kind !== 'asr') || (tracks || []).find(t => String(t.languageCode || '').split('-')[0].toLowerCase() === l) || null;
}
