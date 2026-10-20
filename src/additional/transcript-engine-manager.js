/**
 * Additive transcript engine registry.
 * The legacy engine remains the authoritative default.
 */
const ENGINES = [
  { id: 'legacy-youtube', label: 'Current Charlie MJ engine', default: true, enabled: true, priority: 100 },
  { id: 'native-transcript', label: 'Native YouTube target-language track', default: false, enabled: true, priority: 90 },
  { id: 'auto-generated', label: 'YouTube auto-generated track', default: false, enabled: true, priority: 80 },
  { id: 'youtube-auto-translation', label: 'YouTube auto-translation track', default: false, enabled: true, priority: 70 }
];
export function listTranscriptEngines() {
  return ENGINES.map(x => ({ ...x }))
}
export function selectTranscriptTracks(bundle, settings = {}) {
  const tracks = Array.isArray(bundle?.tracks) ? bundle.tracks : [];
  const target = String(settings.targetLanguage || 'en').split('-')[0].toLowerCase();
  const source = String(settings.sourceLanguage || 'auto').split('-')[0].toLowerCase();
  const lang = t => String(t?.languageCode || '').split('-')[0].toLowerCase();
  return {
    nativeTarget: tracks.find(t => lang(t) === target && t.kind !== 'asr') || tracks.find(t => lang(t) === target),
    sourceManual: tracks.find(t => lang(t) === source && t.kind !== 'asr'),
    sourceAuto: tracks.find(t => lang(t) === source && t.kind === 'asr') || tracks.find(t => t.kind === 'asr'),
    all: tracks
  };
}
