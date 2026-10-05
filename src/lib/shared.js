/**
 * Charlie MJ Language - Shared data helpers.
 * This file contains small, dependency-free utilities reused by extension pages.
 */

export const DEFAULT_SETTINGS = {
  sourceLanguage: 'tr',
  targetLanguage: 'en',
  translationProvider: 'mymemory',
  libreTranslateUrl: '',
  focusMode: true,
  posColors: true,
  boldPOS: true,
  showLevels: true,
  autoTranslate: true,
  hideComments: false,
  hideRecommendations: false,
  hideShorts: false,
  downloadRoot: 'Charlie MJ Language',
  downloadSaveAs: false,
  showToolbarUnderVideo: true,
  wordCardAutoCloseMs: 6000,
  theme: 'dark',
  subtitleDisplayMode: 'both', originalFontSize: 28, translationFontSize: 22, originalBold: true, translationBold: false,
  originalUnderline: false, translationUnderline: false, originalItalic: false, translationItalic: false, sentenceShowLevel: true,
  replayCount: 1, playbackSpeed: 1, autoPauseAfterSubtitle: false, studyModeDefault: false, showWordPronunciation: true,
  showWordTransliteration: false, markKnownStopsHighlight: true
};

export const POS_COLORS = {
  noun: '#7dd3fc', verb: '#fca5a5', adjective: '#c4b5fd', adverb: '#86efac', pronoun: '#fde68a',
  preposition: '#f9a8d4', conjunction: '#fdba74', determiner: '#a5b4fc', particle: '#67e8f9',
  interjection: '#f0abfc', numeral: '#bef264', other: '#e5e7eb'
};

export function getVideoId(url = location.href) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1);
    return u.searchParams.get('v') || '';
  } catch { return ''; }
}

export function getVideoUrl(id) { return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`; }

export function nowISO() { return new Date().toISOString(); }

export async function getSettings() {
  const stored = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
}

export async function updateSettings(patch) {
  const settings = await getSettings();
  const next = { ...settings, ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: true });
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

export function sanitizeFilename(value) {
  return String(value || 'untitled').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150) || 'untitled';
}
