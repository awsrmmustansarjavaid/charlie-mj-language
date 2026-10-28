/*
 * Charlie MJ Language — Dual YouTube Translation Service
 *
 * ADDITIVE SERVICE ONLY
 * ---------------------
 * This file does not replace the existing translation providers.
 * It is an adapter between the already-working Dual Transcript system and
 * the existing Word / Sentence learning workflow.
 *
 * Responsibilities:
 *   1. Ask the existing Dual Transcript system for YouTube-native
 *      original + translated timed-text data.
 *   2. Keep a small independent in-memory/session cache for fast lookups.
 *   3. Resolve sentence translations by timestamp first, then text.
 *   4. Resolve word translations only when the parallel transcript gives a
 *      sufficiently safe word-level alignment. Otherwise it reports that
 *      Dual YouTube cannot safely translate that individual word and the
 *      existing provider priority chain can continue to the next provider.
 *
 * Important architectural rule:
 *   Dual YouTube is a PROVIDER, not a replacement for YouTube Captions,
 *   Google, Microsoft, DeepL, MyMemory, LibreTranslate, or Argos.
 *
 * Public API:
 *   window.CMJ_DUAL_YOUTUBE_TRANSLATION.getSentenceTranslation(...)
 *   window.CMJ_DUAL_YOUTUBE_TRANSLATION.getWordTranslation(...)
 */
(() => {
  'use strict';
  if (window.CMJ_DUAL_YOUTUBE_TRANSLATION) return;
  const SOURCE = 'CMJ_LANGUAGE_DUAL_TRANSCRIPT';
  const CACHE_KEY = 'cmjDualTranscriptCache';
  const SERVICE_KEY = 'cmjDualYouTubeServiceSettings';
  const memoryCache = new Map();
  const pendingRequests = new Map();
  let listenerInstalled = false;
  let serviceSettings = {
    enabled: true,
    sourceBehavior: 'selected-or-auto',
    cacheEnabled: true,
    timeoutMs: 6500,
    fallbackEnabled: true,
    sentenceEnabled: true,
    wordAlignment: 'safe-only',
  };
  async function loadServiceSettings() {
    try {
      const stored = await chrome.storage.local.get(SERVICE_KEY);
      serviceSettings = { ...serviceSettings, ...(stored[SERVICE_KEY] || {}) };
    } catch (_) {}
    return serviceSettings;
  }
  const normalise = (value) =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim();
  const languageBase = (value) =>
    String(value || 'auto')
      .split('-')[0]
      .toLowerCase();
  const normaliseWord = (value) =>
    String(value || '')
      .toLocaleLowerCase()
      .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’_-]+$/gu, '')
      .trim();
  const cacheKey = (videoId, sourceLanguage, targetLanguage) =>
    `${String(videoId || '')}|${String(sourceLanguage || 'auto')
      .trim()
      .toLowerCase()}|${String(targetLanguage || 'en')
      .trim()
      .toLowerCase()}`;
  function currentVideoId() {
    try {
      const player = document.querySelector('#movie_player');
      const id = player?.getVideoData?.()?.video_id;
      if (id) return id;
    } catch (_) {}
    try {
      const url = new URL(location.href);
      return (
        url.searchParams.get('v') ||
        (url.pathname.startsWith('/shorts/') ? url.pathname.split('/')[2] : '')
      );
    } catch (_) {
      return '';
    }
  }
  function installListener() {
    if (listenerInstalled) return;
    listenerInstalled = true;
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || data.source !== SOURCE) return;
      if (data.type === 'RESET_NETWORK') {
        memoryCache.clear();
        for (const [key, pending] of pendingRequests.entries()) {
          clearTimeout(pending.timer);
          pending.reject(new Error('Dual YouTube request cancelled by network reset.'));
          pendingRequests.delete(key);
        }
        return;
      }
      if (data.type === 'SET_LIGHTWEIGHT_SLEEP') {
        if (data.enabled === true) {
          memoryCache.clear();
          for (const [key, pending] of pendingRequests.entries()) {
            clearTimeout(pending.timer);
            pending.reject(new Error('Dual YouTube is in Lightweight Sleep mode.'));
            pendingRequests.delete(key);
          }
        }
        return;
      }
      if (data.type !== 'TRANSCRIPT_DATA') return;
      const id = String(data.videoId || '');
      if (!id) return;
      const key = cacheKey(id, data.sourceLanguage, data.targetLanguage);
      const value = {
        videoId: id,
        sourceLanguage: data.sourceLanguage || '',
        targetLanguage: data.targetLanguage || '',
        sourceName: data.sourceName || '',
        original: Array.isArray(data.original) ? data.original : [],
        translated: Array.isArray(data.translated) ? data.translated : [],
        translationAvailable: Boolean(data.translationAvailable),
        translationError: data.translationError || '',
        receivedAt: Date.now(),
      };
      memoryCache.set(key, value);
      const pending = pendingRequests.get(key);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(key);
        pending.resolve(value);
      }
    });
  }
  async function readStoredCache(videoId, sourceLanguage, targetLanguage) {
    await loadServiceSettings();
    if (serviceSettings.cacheEnabled === false) return null;
    const key = cacheKey(videoId, sourceLanguage, targetLanguage);
    if (memoryCache.has(key)) return memoryCache.get(key);
    try {
      const stored = await chrome.storage.local.get(CACHE_KEY);
      const cache = stored?.[CACHE_KEY] || {};
      const entry = cache[key];
      if (!entry) return null;
      const ttlHours = Number(serviceSettings.cacheTtlHours) || 24;
      if (
        Number(entry.cachedAt || entry.receivedAt || 0) &&
        Date.now() - Number(entry.cachedAt || entry.receivedAt) > ttlHours * 3600000
      )
        return null;
      // The standalone Dual Transcript cache stores merged sentences as well
      // as cues. Convert them into the same shape used by live TRANSCRIPT_DATA.
      const value = {
        videoId: String(entry.videoId || videoId),
        sourceLanguage: entry.sourceLanguage || sourceLanguage || '',
        targetLanguage: entry.targetLanguage || targetLanguage || '',
        sourceName: entry.sourceName || '',
        original: Array.isArray(entry.original)
          ? entry.original
          : Array.isArray(entry.cues)
            ? entry.cues.map((x) => ({
                start: x.start,
                duration: x.duration,
                end: x.end,
                text: x.text || x.original || '',
              }))
            : [],
        translated: Array.isArray(entry.translated)
          ? entry.translated
          : Array.isArray(entry.cues)
            ? entry.cues.map((x) => ({
                start: x.start,
                duration: x.duration,
                end: x.end,
                text: x.translated || '',
              }))
            : [],
        sentences: Array.isArray(entry.sentences) ? entry.sentences : [],
        translationAvailable: Boolean(entry.translationAvailable),
        translationError: entry.translationError || '',
        receivedAt: Number(entry.cachedAt || Date.now()),
      };
      if (value.original.length || value.sentences.length) memoryCache.set(key, value);
      return value.original.length || value.sentences.length ? value : null;
    } catch (_) {
      return null;
    }
  }
  function postRequest(targetLanguage, sourceLanguage) {
    window.postMessage(
      {
        source: SOURCE,
        type: 'REQUEST_TRANSCRIPT',
        targetLanguage: targetLanguage || 'en',
        sourceLanguage: sourceLanguage || 'auto',
      },
      '*'
    );
  }
  async function requestData({ videoId, sourceLanguage, targetLanguage, force = false }) {
    installListener();
    await loadServiceSettings();
    if (serviceSettings.enabled === false) throw new Error('Dual YouTube service is disabled.');
    const id = String(videoId || currentVideoId() || '');
    const target = String(targetLanguage || 'en').trim();
    const source = String(sourceLanguage || 'auto').trim();
    if (!id) throw new Error('Dual YouTube requires an active YouTube video.');
    const key = cacheKey(id, source, target);
    if (!force) {
      const cached = await readStoredCache(id, source, target);
      if (cached) return cached;
    }
    if (pendingRequests.has(key)) return pendingRequests.get(key).promise;
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => {
          pendingRequests.delete(key);
          reject(new Error('Dual YouTube transcript is unavailable for this video/language.'));
        },
        Math.max(1000, Number(serviceSettings.timeoutMs) || 6500)
      );
      pendingRequests.set(key, { resolve, reject, timer });
    });
    postRequest(target, source);
    return promise;
  }
  function rowsFromData(data) {
    if (Array.isArray(data?.sentences) && data.sentences.length) {
      return data.sentences.map((row, index) => ({
        index,
        start: Number(row.start || 0),
        end: Number(row.end || row.start || 0),
        original: normalise(row.original || row.text || ''),
        translated: normalise(row.translated || ''),
      }));
    }
    const original = Array.isArray(data?.original) ? data.original : [];
    const translated = Array.isArray(data?.translated) ? data.translated : [];
    return original.map((row, index) => ({
      index,
      start: Number(row?.start || 0),
      end: Number(row?.end || Number(row?.start || 0) + Number(row?.duration || 0)),
      original: normalise(row?.text || ''),
      translated: normalise(translated[index]?.text || ''),
    }));
  }
  function findBestSentence(data, start, text) {
    const rows = rowsFromData(data);
    if (!rows.length) return null;
    const wantedText = normalise(text).toLocaleLowerCase();
    const wantedStart = Number(start);
    // Timestamp is authoritative when available because the two languages
    // can have different word counts and punctuation.
    if (Number.isFinite(wantedStart)) {
      let best = null;
      let bestDistance = Infinity;
      for (const row of rows) {
        const distance = Math.abs(row.start - wantedStart);
        const duration = Math.max(1.2, row.end > row.start ? row.end - row.start : 2.5);
        const allowed = Math.max(0.8, duration + 0.8);
        if (distance <= allowed && distance < bestDistance) {
          best = row;
          bestDistance = distance;
        }
      }
      if (best) return best;
    }
    if (wantedText) {
      const exact = rows.find(
        (row) => row.original.toLocaleLowerCase() === wantedText && row.translated
      );
      if (exact) return exact;
      const partial = rows.find(
        (row) => row.original.toLocaleLowerCase().includes(wantedText) && row.translated
      );
      if (partial) return partial;
    }
    return null;
  }
  async function getSentenceTranslation(options = {}) {
    await loadServiceSettings();
    if (serviceSettings.sentenceEnabled === false)
      throw new Error('Dual YouTube sentence translation is disabled.');
    const data = await requestData(options);
    const row = findBestSentence(data, options.start, options.text);
    if (!row?.translated) {
      throw new Error(
        data.translationError || 'Dual YouTube has no translated sentence for this cue.'
      );
    }
    return {
      translation: row.translated,
      provider: 'dual-youtube',
      source: 'dual-youtube',
      videoId: data.videoId,
      sourceLanguage: data.sourceLanguage,
      targetLanguage: data.targetLanguage,
      start: row.start,
      sentence: row.original,
      confidence: 1,
    };
  }
  function alignWord(sourceSentence, targetSentence, word) {
    const sourceWords = normalise(sourceSentence).split(/\s+/).filter(Boolean);
    const targetWords = normalise(targetSentence).split(/\s+/).filter(Boolean);
    const wanted = normaliseWord(word);
    if (!wanted || !sourceWords.length || !targetWords.length) return null;
    const matches = [];
    sourceWords.forEach((candidate, index) => {
      if (normaliseWord(candidate) === wanted) matches.push(index);
    });
    if (matches.length !== 1) return null;
    const sourceIndex = matches[0];
    // A one-to-one aligned parallel sentence is the only case where the
    // individual target token can be considered high-confidence without an
    // external semantic aligner.
    if (sourceWords.length === targetWords.length) {
      const candidate = normaliseWord(targetWords[sourceIndex]);
      if (candidate) return { translation: targetWords[sourceIndex], confidence: 0.92 };
    }
    // Single-word sentences are unambiguous.
    if (sourceWords.length === 1 && targetWords.length >= 1) {
      return { translation: targetWords.join(' '), confidence: 0.95 };
    }
    return null;
  }
  function deriveWordFromSentence(sourceSentence, targetSentence, word) {
    const wanted = normaliseWord(word);
    if (!wanted) return null;
    const sourceTokens = normalise(sourceSentence).split(/\s+/).filter(Boolean);
    const targetTokens = normalise(targetSentence).split(/\s+/).filter(Boolean);
    const sourceIndex = sourceTokens.findIndex((x) => normaliseWord(x) === wanted);
    if (sourceIndex < 0 || !targetTokens.length) return null;
    // Exact lexical carry-over is safe for names, numbers and shared terms.
    const exact = targetTokens.find((x) => normaliseWord(x) === wanted);
    if (exact) return { translation: exact, confidence: 0.9 };
    // Single-word sentence remains unambiguous.
    if (sourceTokens.length === 1) return { translation: targetTokens.join(' '), confidence: 0.95 };
    // Safe same-position alignment is an optional service mode.
    if (
      serviceSettings.wordAlignment === 'same-position' &&
      sourceTokens.length === targetTokens.length
    ) {
      return { translation: targetTokens[sourceIndex], confidence: 0.86 };
    }
    return null;
  }
  async function getWordTranslation(options = {}) {
    await loadServiceSettings();
    const data = await requestData(options);
    const row = findBestSentence(data, options.start, options.sentence || options.text);
    if (!row?.translated) {
      throw new Error(
        data.translationError || 'Dual YouTube has no translated sentence for this word.'
      );
    }
    const aligned = alignWord(row.original, row.translated, options.word || options.text);
    if (!aligned) {
      const fallback = deriveWordFromSentence(
        row.original,
        row.translated,
        options.word || options.text
      );
      if (fallback)
        return {
          translation: fallback.translation,
          provider: 'dual-youtube',
          source: 'dual-youtube',
          videoId: data.videoId,
          sourceLanguage: data.sourceLanguage,
          targetLanguage: data.targetLanguage,
          start: row.start,
          sentence: row.original,
          sentenceTranslation: row.translated,
          confidence: fallback.confidence,
        };
    }
    if (!aligned || aligned.confidence < 0.85) {
      throw new Error(
        'Dual YouTube sentence is available, but safe word-level alignment is unavailable.'
      );
    }
    return {
      translation: aligned.translation,
      provider: 'dual-youtube',
      source: 'dual-youtube',
      videoId: data.videoId,
      sourceLanguage: data.sourceLanguage,
      targetLanguage: data.targetLanguage,
      start: row.start,
      sentence: row.original,
      sentenceTranslation: row.translated,
      confidence: aligned.confidence,
    };
  }
  chrome?.storage?.onChanged?.addListener?.((changes) => {
    if (changes[SERVICE_KEY])
      serviceSettings = { ...serviceSettings, ...(changes[SERVICE_KEY].newValue || {}) };
  });
  window.CMJ_DUAL_YOUTUBE_TRANSLATION = Object.freeze({
    getSentenceTranslation,
    getWordTranslation,
    getCachedData: (options) =>
      readStoredCache(
        options?.videoId || currentVideoId(),
        options?.sourceLanguage,
        options?.targetLanguage
      ),
    clearMemoryCache: () => memoryCache.clear(),
  });
  installListener();
})();
