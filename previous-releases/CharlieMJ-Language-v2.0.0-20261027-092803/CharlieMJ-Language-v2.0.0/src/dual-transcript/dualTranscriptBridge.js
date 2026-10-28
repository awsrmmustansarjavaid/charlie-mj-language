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
  let resetGeneration = 0;
  let activeController = null;
  let lightweightSleep = false;
  let bridgeInterval = null;
  const post = (type, payload = {}) =>
    window.postMessage({ source: SOURCE, type, ...payload }, '*');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function getPlayerResponse() {
    try {
      const player = document.querySelector('#movie_player');
      const response = player?.getPlayerResponse?.();
      if (response?.videoDetails?.videoId) return response;
    } catch {}
    try {
      if (window.ytInitialPlayerResponse?.videoDetails?.videoId)
        return window.ytInitialPlayerResponse;
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
      return (
        u.searchParams.get('v') ||
        (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : '')
      );
    } catch {
      return '';
    }
  }
  function getTrackRenderer(response) {
    return response?.captions?.playerCaptionsTracklistRenderer || null;
  }
  function getTracks(response) {
    return getTrackRenderer(response)?.captionTracks || [];
  }
  function getTranslationLanguages(response) {
    const rows = getTrackRenderer(response)?.translationLanguages || [];
    return rows
      .map((item) => ({
        languageCode: item?.languageCode || '',
        name:
          item?.languageName?.simpleText ||
          item?.languageName?.runs?.map((x) => x?.text || '').join('') ||
          item?.languageCode ||
          '',
      }))
      .filter((x) => x.languageCode);
  }
  function cleanUrl(url) {
    try {
      return new URL(url, location.href);
    } catch {
      return null;
    }
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
        window.fetch = function (input, init) {
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
        XMLHttpRequest.prototype.open = function (method, url) {
          try {
            if (isTimedText(url)) window.__CMJ_LANGUAGE_LAST_TIMEDTEXT__ = String(url);
          } catch {}
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
  async function fetchJsonText(url, generation = resetGeneration) {
    if (lightweightSleep) throw new Error('Charlie MJ is in Lightweight Sleep mode.');
    if (generation !== resetGeneration)
      throw new Error('YouTube caption request cancelled by network reset.');
    const controller = new AbortController();
    activeController = controller;
    const response = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`YouTube caption request failed: HTTP ${response.status}`);
    const text = await response.text();
    if (!text || /^\s*</.test(text))
      throw new Error('YouTube returned an empty/HTML caption response');
    return text;
  }
  function parseJson3(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('YouTube returned invalid JSON3 caption data');
    }
    const cues = [];
    for (const event of data?.events || []) {
      if (!Array.isArray(event?.segs) || event.tStartMs == null) continue;
      const value = event.segs
        .map((s) => s?.utf8 || '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
      if (!value) continue;
      const start = Number(event.tStartMs) / 1000;
      const duration = Number(event.dDurationMs || 0) / 1000;
      cues.push({ start, end: Math.max(start + 0.05, start + duration), text: value });
    }
    for (let i = 0; i < cues.length; i++) {
      if (cues[i].end <= cues[i].start + 0.051 && cues[i + 1])
        cues[i].end = Math.max(cues[i].start + 0.05, cues[i + 1].start);
    }
    return cues;
  }
  async function requestNativeCaptions() {
    const player = document.querySelector('#movie_player');
    // Reloading the captions track is preferable to toggling the user's CC
    // state because it asks YouTube for the timedtext resource directly.
    try {
      player?.setOption?.('captions', 'reload', true);
    } catch {}
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
  async function fetchTrackWithFallback(
    captured,
    track,
    videoId,
    targetLanguage = '',
    generation = resetGeneration
  ) {
    const secure = mergeTrackIntoCaptured(captured, track, videoId, targetLanguage);
    const plain = plainTrackUrl(track, videoId, targetLanguage);
    const urls = [...new Set([secure, plain].filter(Boolean))];
    let lastError = null;
    for (const url of urls) {
      if (generation !== resetGeneration || lightweightSleep)
        throw new Error('YouTube caption request cancelled.');
      try {
        const text = await fetchJsonText(url, generation);
        const cues = parseJson3(text);
        if (cues.length) return { cues, url };
        lastError = new Error('YouTube returned no caption cues');
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('Unable to fetch YouTube caption track');
  }
  async function handleTranscriptRequest(targetLanguage, requestedSourceLanguage = 'auto') {
    if (busy || lightweightSleep) return;
    const generation = resetGeneration;
    busy = true;
    try {
      const response = getPlayerResponse();
      const videoId = getVideoId();
      if (!response || !videoId) throw new Error('YouTube player metadata is not ready');
      const renderer = response?.captions?.playerCaptionsTracklistRenderer || null;
      const tracks = getTracks(response);
      if (!tracks.length) throw new Error('This video has no YouTube caption track');
      const autoSource =
        renderer?.audioTrack?.captionTrack?.languageCode || tracks[0]?.languageCode || '';
      const requested = String(requestedSourceLanguage || 'auto');
      const normaliseLang = (value) =>
        String(value || '')
          .split('-')[0]
          .toLowerCase();
      const requestedBase = normaliseLang(requested);
      const translationLanguages = getTranslationLanguages(response);
      const directSourceTrack =
        requested !== 'auto'
          ? tracks.find((t) => t.languageCode === requested) ||
            tracks.find((t) => normaliseLang(t.languageCode) === requestedBase)
          : null;
      const baseTrack = tracks.find((t) => t.languageCode === autoSource) || tracks[0];
      // YouTube often exposes the video's real caption track (for example
      // English auto-generated) plus a separate translationLanguages catalog
      // (for example Turkish). If the user selects one of those translated
      // languages as ORIGINAL, fetch that language with tlang instead of
      // silently falling back to the base English track.
      const translatedSource =
        !directSourceTrack && requested !== 'auto'
          ? translationLanguages.find((t) => normaliseLang(t.languageCode) === requestedBase)
          : null;
      const sourceTrack = directSourceTrack || baseTrack;
      const originalLanguage =
        requested !== 'auto' && translatedSource
          ? translatedSource.languageCode
          : sourceTrack.languageCode || '';
      const originalName =
        requested !== 'auto' && translatedSource
          ? translatedSource.name
          : sourceTrack.name?.simpleText || sourceTrack.languageCode || '';
      post('TRACK_INFO', {
        videoId,
        sourceLanguage: originalLanguage,
        sourceName: originalName,
        requestedSourceLanguage: requested,
        tracks: tracks.map((t) => ({
          languageCode: t.languageCode || '',
          name: t.name?.simpleText || t.languageCode || '',
          kind: t.kind || '',
        })),
        translationLanguages,
      });
      // IMPORTANT: use the same proof-bearing timedtext request already made
      // by YouTube. Do not create a separate anonymous caption-request path.
      // This keeps the original Dual Transcript behavior and avoids the extra
      // request pattern that can trigger YouTube HTTP 429 rate limiting.
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
      const original = translatedSource
        ? await fetchTrackWithFallback(
            captured,
            sourceTrack,
            videoId,
            translatedSource.languageCode,
            generation
          )
        : await fetchTrackWithFallback(captured, sourceTrack, videoId, '', generation);
      post('FETCH_STATUS', { status: 'original-ready', count: original.cues.length });
      let translated = { cues: [], available: false, error: '' };
      const effectiveOriginalLanguage = normaliseLang(originalLanguage);
      if (targetLanguage && normaliseLang(targetLanguage) !== effectiveOriginalLanguage) {
        post('FETCH_STATUS', { status: 'fetching-translation', language: targetLanguage });
        try {
          // Fetch the requested target from the SAME base YouTube track.
          // This supports both native tracks and YouTube's translationLanguages.
          const result = await fetchTrackWithFallback(
            captured,
            sourceTrack,
            videoId,
            targetLanguage,
            generation
          );
          translated = { cues: result.cues, available: true, error: '' };
        } catch (error) {
          translated = { cues: [], available: false, error: error?.message || String(error) };
        }
      } else if (targetLanguage && normaliseLang(targetLanguage) === effectiveOriginalLanguage) {
        translated = { cues: original.cues.map((c) => ({ ...c })), available: true, error: '' };
      }
      post('TRANSCRIPT_DATA', {
        videoId,
        sourceLanguage: originalLanguage,
        sourceName: originalName,
        targetLanguage,
        original: original.cues,
        translated: translated.cues,
        translationAvailable: translated.available,
        translationError: translated.error,
      });
    } catch (error) {
      post('TRANSCRIPT_ERROR', { error: error?.message || String(error) });
    } finally {
      busy = false;
    }
  }
  function resetYouTubeNetwork() {
    resetGeneration += 1;
    try {
      activeController?.abort();
    } catch (_) {}
    activeController = null;
    busy = false;
    lastRequestKey = '';
    try {
      window.__CMJ_LANGUAGE_LAST_TIMEDTEXT__ = '';
    } catch (_) {}
    post('NETWORK_RESET_STATUS', { status: 'resetting' });
    setTimeout(() => {
      if (lightweightSleep) return;
      try {
        requestNativeCaptions();
      } catch (_) {}
      post('NETWORK_RESET_STATUS', { status: 'ready' });
    }, 500);
  }
  function setLightweightSleep(enabled) {
    lightweightSleep = Boolean(enabled);
    if (lightweightSleep) {
      resetGeneration += 1;
      try {
        activeController?.abort();
      } catch (_) {}
      activeController = null;
      busy = false;
      lastRequestKey = '';
      if (bridgeInterval) {
        clearInterval(bridgeInterval);
        bridgeInterval = null;
      }
      post('NETWORK_RESET_STATUS', { status: 'sleep' });
      return;
    }
    if (!bridgeInterval)
      bridgeInterval = setInterval(() => {
        hookFetchAndXHR();
        const id = getVideoId();
        if (id && id !== lastVideoId) {
          lastVideoId = id;
          lastRequestKey = '';
          exposePlayerState();
        }
      }, 3000);
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
      captions: renderer,
    });
  }
  hookFetchAndXHR();
  exposePlayerState();
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== SOURCE) return;
    if (event.data.type === 'REQUEST_PLAYER_STATE') exposePlayerState();
    if (event.data.type === 'REQUEST_TRANSCRIPT')
      handleTranscriptRequest(
        event.data.targetLanguage || 'en',
        event.data.sourceLanguage || 'auto'
      );
    if (event.data.type === 'RESET_NETWORK') resetYouTubeNetwork();
    if (event.data.type === 'SET_LIGHTWEIGHT_SLEEP')
      setLightweightSleep(event.data.enabled === true);
  });
  // YouTube is an SPA. Keep the bridge aware of a newly selected video and
  // re-check resource timing rather than rebuilding hooks on every navigation.
  bridgeInterval = setInterval(() => {
    if (lightweightSleep) return;
    hookFetchAndXHR();
    const id = getVideoId();
    if (id && id !== lastVideoId) {
      lastVideoId = id;
      lastRequestKey = '';
      exposePlayerState();
    }
  }, 1000);
})();
