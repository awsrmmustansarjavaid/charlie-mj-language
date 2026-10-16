/*
 * Charlie MJ Dual Transcript Engine - YouTube MAIN-world data bridge.
 *
 * This module deliberately owns the YouTube-specific fetching pipeline.
 * It runs in YouTube's MAIN world so requests are made with the page's own
 * origin/session. The important modern YouTube detail is that caption
 * baseUrl values can lack the proof-of-origin (pot) parameters. We therefore
 * wait for a real timedtext request made by the player, capture that URL from
 * Resource Timing, and merge the selected track parameters onto it.
 *
 * No third-party transcript server is used here.
 */
(() => {
  'use strict';
  if (window.__CMJ_LANGUAGE_DUAL_TRANSCRIPT_BRIDGE_V1__) return;
  window.__CMJ_LANGUAGE_DUAL_TRANSCRIPT_BRIDGE_V1__ = true;

  const SOURCE = 'CMJ_LANGUAGE_DUAL_TRANSCRIPT';
  let lastVideoId = '';
  let busy = false;
  let lastRequestKey = '';

  const post = (type, payload = {}) =>
    window.postMessage({ source: SOURCE, type, ...payload }, '*');

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function getPlayerResponse() {
    try {
      const player = document.querySelector('#movie_player');
      const response = player?.getPlayerResponse?.();
      if (response?.videoDetails?.videoId) return response;
    } catch {}
    try {
      if (window.ytInitialPlayerResponse?.videoDetails?.videoId) return window.ytInitialPlayerResponse;
    } catch {}
    return null;
  }

  function getVideoId() {
    try {
      const player = document.querySelector('#movie_player');
      const id = player?.getVideoData?.()?.video_id;
      if (id) return id;
    } catch {}
    try {
      const u = new URL(location.href);
      return u.searchParams.get('v') || (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : '');
    } catch { return ''; }
  }

  function getTracks(response) {
    const renderer = response?.captions?.playerCaptionsTracklistRenderer;
    return renderer?.captionTracks || [];
  }

  function cleanUrl(url) {
    try { return new URL(url, location.href); } catch { return null; }
  }

  function isTimedText(url) {
    const u = cleanUrl(url);
    return !!u && u.pathname.includes('/api/timedtext');
  }

  // The player can use fetch/XHR references captured before our wrappers exist.
  // Resource Timing therefore remains the primary observation mechanism.
  function findPotRequest(videoId) {
    const entries = performance.getEntriesByType('resource');
    const candidates = [];
    for (const entry of entries) {
      const u = cleanUrl(entry.name);
      if (!u || !isTimedText(u)) continue;
      const pot = u.searchParams.get('pot');
      if (!pot) continue;
      const v = u.searchParams.get('v');
      if (v && videoId && v !== videoId) continue;
      candidates.push(u);
    }
    return candidates.length ? candidates[candidates.length - 1] : null;
  }

  function hookFetchAndXHR() {
    // These hooks help on player variants that use the page's current fetch/XHR
    // objects. They are supplementary; Resource Timing is still checked often.
    try {
      if (!window.__CMJ_LANGUAGE_DUAL_FETCH_HOOK__) {
        const originalFetch = window.fetch;
        window.fetch = function(input, init) {
          try {
            const url = typeof input === 'string' ? input : input?.url;
            if (isTimedText(url)) window.__CMJ_LANGUAGE_LAST_TIMEDTEXT__ = String(url);
          } catch {}
          return originalFetch.apply(this, arguments);
        };
        window.__CMJ_LANGUAGE_DUAL_FETCH_HOOK__ = true;
      }
    } catch {}
    try {
      if (!window.__CMJ_LANGUAGE_DUAL_XHR_HOOK__) {
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
          try { if (isTimedText(url)) window.__CMJ_LANGUAGE_LAST_TIMEDTEXT__ = String(url); } catch {}
          return originalOpen.apply(this, arguments);
        };
        window.__CMJ_LANGUAGE_DUAL_XHR_HOOK__ = true;
      }
    } catch {}
  }

  function findCapturedRequest(videoId) {
    const timed = findPotRequest(videoId);
    if (timed) return timed;
    const hook = cleanUrl(window.__CMJ_LANGUAGE_LAST_TIMEDTEXT__ || '');
    if (hook && hook.searchParams.get('pot')) return hook;
    return null;
  }

  function mergeTrackIntoCaptured(captured, track, videoId, translatedLanguage = '') {
    const source = cleanUrl(track?.baseUrl || '');
    if (!captured) return null;
    const u = new URL(captured.toString());

    // Keep the player's proof/session parameters but use the actual selected
    // caption track's language/kind/name/variant parameters.
    for (const key of ['lang', 'kind', 'name', 'variant', 'fmt', 'tlang']) {
      const value = source?.searchParams.get(key);
      if (value == null) u.searchParams.delete(key);
      else u.searchParams.set(key, value);
    }
    if (videoId) u.searchParams.set('v', videoId);
    u.searchParams.set('fmt', 'json3');
    if (translatedLanguage) u.searchParams.set('tlang', translatedLanguage);
    else u.searchParams.delete('tlang');
    return u.toString();
  }

  function plainTrackUrl(track, videoId, translatedLanguage = '') {
    const u = cleanUrl(track?.baseUrl || '');
    if (!u) return '';
    u.searchParams.set('fmt', 'json3');
    if (videoId) u.searchParams.set('v', videoId);
    if (translatedLanguage) u.searchParams.set('tlang', translatedLanguage);
    else u.searchParams.delete('tlang');
    return u.toString();
  }

  async function fetchJsonText(url) {
    const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
    if (!response.ok) throw new Error(`YouTube caption request failed: HTTP ${response.status}`);
    const text = await response.text();
    if (!text || /^\s*</.test(text)) throw new Error('YouTube returned an empty/HTML caption response');
    return text;
  }

  function parseJson3(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('YouTube returned invalid JSON3 caption data'); }
    const cues = [];
    for (const event of (data?.events || [])) {
      if (!Array.isArray(event?.segs) || event.tStartMs == null) continue;
      const value = event.segs.map(s => s?.utf8 || '').join('').replace(/\s+/g, ' ').trim();
      if (!value) continue;
      const start = Number(event.tStartMs) / 1000;
      const duration = Number(event.dDurationMs || 0) / 1000;
      cues.push({ start, end: Math.max(start + 0.05, start + duration), text: value });
    }
    for (let i = 0; i < cues.length; i++) {
      if (cues[i].end <= cues[i].start + 0.051 && cues[i + 1]) cues[i].end = Math.max(cues[i].start + 0.05, cues[i + 1].start);
    }
    return cues;
  }

  async function requestNativeCaptions() {
    const player = document.querySelector('#movie_player');
    // Reloading the captions track is preferable to toggling the user's CC
    // state because it asks YouTube for the timedtext resource directly.
    try { player?.setOption?.('captions', 'reload', true); } catch {}
    try {
      const cc = document.querySelector('.ytp-subtitles-button');
      if (cc && cc.getAttribute('aria-pressed') !== 'true') cc.click();
    } catch {}
  }

  async function waitForCapturedRequest(videoId, timeout = 7000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const found = findCapturedRequest(videoId);
      if (found) return found;
      await sleep(150);
    }
    return null;
  }

  async function fetchTrackWithFallback(captured, track, videoId, targetLanguage = '') {
    const secure = mergeTrackIntoCaptured(captured, track, videoId, targetLanguage);
    const plain = plainTrackUrl(track, videoId, targetLanguage);
    const urls = [...new Set([secure, plain].filter(Boolean))];
    let lastError = null;
    for (const url of urls) {
      try {
        const text = await fetchJsonText(url);
        const cues = parseJson3(text);
        if (cues.length) return { cues, url };
        lastError = new Error('YouTube returned no caption cues');
      } catch (e) { lastError = e; }
    }
    throw lastError || new Error('Unable to fetch YouTube caption track');
  }

  async function handleTranscriptRequest(targetLanguage) {
    if (busy) return;
    busy = true;
    try {
      const response = getPlayerResponse();
      const videoId = getVideoId();
      if (!response || !videoId) throw new Error('YouTube player metadata is not ready');
      const tracks = getTracks(response);
      if (!tracks.length) throw new Error('This video has no YouTube caption track');

      const sourceTrack = tracks.find(t => t.languageCode === response?.captions?.playerCaptionsTracklistRenderer?.audioTrack?.captionTrack?.languageCode) || tracks[0];
      post('TRACK_INFO', {
        videoId,
        sourceLanguage: sourceTrack.languageCode || '',
        sourceName: sourceTrack.name?.simpleText || sourceTrack.languageCode || '',
        tracks: tracks.map(t => ({ languageCode: t.languageCode || '', name: t.name?.simpleText || t.languageCode || '', kind: t.kind || '' }))
      });

      let captured = findCapturedRequest(videoId);
      if (!captured) {
        await requestNativeCaptions();
        captured = await waitForCapturedRequest(videoId, 8000);
      }
      if (!captured) throw new Error('YouTube did not expose a proof-bearing caption request yet');

      const requestKey = `${videoId}|${sourceTrack.languageCode}|${targetLanguage}|${captured}`;
      if (requestKey === lastRequestKey) return;
      lastRequestKey = requestKey;

      post('FETCH_STATUS', { status: 'fetching-original' });
      const original = await fetchTrackWithFallback(captured, sourceTrack, videoId, '');
      post('FETCH_STATUS', { status: 'original-ready', count: original.cues.length });

      let translated = { cues: [], available: false, error: '' };
      if (targetLanguage && targetLanguage !== sourceTrack.languageCode) {
        post('FETCH_STATUS', { status: 'fetching-translation', language: targetLanguage });
        try {
          // YouTube's native whole-track translation. This is the requested
          // target-language transcript, not a third-party sentence translator.
          const result = await fetchTrackWithFallback(captured, sourceTrack, videoId, targetLanguage);
          translated = { cues: result.cues, available: true, error: '' };
        } catch (error) {
          translated = { cues: [], available: false, error: error?.message || String(error) };
        }
      } else if (targetLanguage === sourceTrack.languageCode) {
        translated = { cues: original.cues.map(c => ({ ...c })), available: true, error: '' };
      }

      post('TRANSCRIPT_DATA', {
        videoId,
        sourceLanguage: sourceTrack.languageCode || '',
        sourceName: sourceTrack.name?.simpleText || sourceTrack.languageCode || '',
        targetLanguage,
        original: original.cues,
        translated: translated.cues,
        translationAvailable: translated.available,
        translationError: translated.error
      });
    } catch (error) {
      post('TRANSCRIPT_ERROR', { error: error?.message || String(error) });
    } finally {
      busy = false;
    }
  }

  function exposePlayerState() {
    const response = getPlayerResponse();
    const videoId = getVideoId();
    if (!response || !videoId) return;
    lastVideoId = videoId;
    const renderer = response.captions?.playerCaptionsTracklistRenderer || null;
    post('PLAYER_STATE', {
      videoId,
      title: response.videoDetails?.title || '',
      duration: Number(response.videoDetails?.lengthSeconds || 0),
      captions: renderer
    });
  }

  hookFetchAndXHR();
  exposePlayerState();

  window.addEventListener('message', event => {
    if (event.source !== window || event.data?.source !== SOURCE) return;
    if (event.data.type === 'REQUEST_PLAYER_STATE') exposePlayerState();
    if (event.data.type === 'REQUEST_TRANSCRIPT') handleTranscriptRequest(event.data.targetLanguage || 'en');
  });

  // YouTube is an SPA. Keep the bridge aware of a newly selected video and
  // re-check resource timing rather than rebuilding hooks on every navigation.
  setInterval(() => {
    hookFetchAndXHR();
    const id = getVideoId();
    if (id && id !== lastVideoId) {
      lastVideoId = id;
      lastRequestKey = '';
      exposePlayerState();
    }
  }, 1000);
})();
