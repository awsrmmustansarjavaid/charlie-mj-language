/*
 * Charlie MJ Dual Transcript Engine
 *
 * This is the independent engine. Existing extensions can later consume it
 * without knowing how YouTube caption requests, JSON3 cues, translation, or
 * timeline synchronization are implemented.
 */
(() => {
  'use strict';

  const DEFAULTS = {
    enabled: true,
    targetLanguage: 'en',
    fontScale: 1,
    opacity: 0.72,
    panelWidth: 420,
    showPanel: false,
    showOverlay: true
  };

  const state = {
    settings: { ...DEFAULTS },
    videoId: '',
    player: null,
    playerInfo: null,
    tracks: [],
    captionUrl: '',
    sourceTrack: null,
    targetTrack: null,
    cues: [],
    sentences: [],
    currentIndex: -1,
    status: 'idle',
    abort: null,
    lastUrl: location.href,
    raf: 0,
    ui: {},
    requestUrls: new Set(),
    translationError: ''
  };

  const log = (...args) => console.debug('[Charlie MJ Dual Transcript]', ...args);
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function sendToPage(message) {
    window.postMessage({ source: 'CMJ_DUAL_TRANSCRIPT', ...message }, '*');
  }

  // The MAIN-world bridge is declared directly in manifest.json and runs at
  // document_start. This is deliberately earlier than YouTube caption requests.
  // We therefore do not dynamically inject a chrome-extension:// script.
  async function injectBridge() {
    // Kept as an async compatibility hook so the rest of the engine can remain
    // independent of how the YouTube bridge is installed.
    return true;
  }

  function currentVideoIdFromUrl() {
    try {
      const u = new URL(location.href);
      return u.searchParams.get('v') || (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : '');
    } catch { return ''; }
  }

  function parseTracks(renderer) {
    const tracks = renderer?.captionTracks || [];
    return tracks.map((t, i) => ({
      index: i,
      baseUrl: t.baseUrl || '',
      languageCode: t.languageCode || '',
      name: t.name?.simpleText || t.name?.runs?.map(r => r.text).join('') || t.languageCode || '',
      kind: t.kind || '',
      vssId: t.vssId || ''
    })).filter(t => t.baseUrl);
  }

  function parseTranslationLanguages(renderer) {
    return (renderer?.translationLanguages || []).map(x => ({
      languageCode: x.languageCode,
      name: x.languageName?.simpleText || x.languageName?.runs?.map(r => r.text).join('') || x.languageCode
    }));
  }

  function selectSourceTrack() {
    if (!state.tracks.length) return null;
    const preferred = state.playerInfo?.captions?.audioTrack || '';
    return state.tracks.find(t => t.languageCode === preferred) || state.tracks[0];
  }

  function normalizeUrl(url) {
    try {
      const u = new URL(url, location.href);
      u.searchParams.set('fmt', 'json3');
      return u.toString();
    } catch { return url; }
  }

  function translatedUrl(base, lang) {
    const u = new URL(normalizeUrl(base));
    u.searchParams.set('tlang', lang);
    u.searchParams.set('fmt', 'json3');
    return u.toString();
  }

  async function fetchText(url, signal) {
    const response = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      signal,
      headers: { 'Accept': 'application/json,text/plain,*/*' }
    });
    if (!response.ok) throw new Error(`Caption request failed: ${response.status}`);
    const text = await response.text();
    if (!text || /^\s*</.test(text)) throw new Error('YouTube returned an empty/HTML caption response');
    return text;
  }

  function parseJson3(text) {
    const data = typeof text === 'string' ? JSON.parse(text) : text;
    const events = Array.isArray(data?.events) ? data.events : [];
    const cues = [];
    for (const e of events) {
      if (!Array.isArray(e.segs) || e.tStartMs == null) continue;
      const textValue = e.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim();
      if (!textValue) continue;
      const start = Number(e.tStartMs) / 1000;
      const duration = Number(e.dDurationMs || 0) / 1000;
      cues.push({ start, end: Math.max(start + 0.05, start + duration), text: cleanCaption(textValue) });
    }
    // Some YouTube JSON3 responses omit duration. Infer each end from next cue.
    for (let i = 0; i < cues.length; i++) {
      if (cues[i].end <= cues[i].start + 0.051 && cues[i + 1]) cues[i].end = Math.max(cues[i].start + 0.05, cues[i + 1].start);
    }
    return cues;
  }

  function cleanCaption(text) {
    return text
      .replace(/&gt;&gt;+/g, '')
      .replace(/^\s*(?:>>+|\[Laughter\]|\[Music\]|\[Applause\])\s*/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sentenceBoundary(text) {
    return /[.!?。！？]+(?:['”’"»)]*)?$/.test(text.trim());
  }

  function mergeCues(cues) {
    const out = [];
    let bucket = null;
    for (const cue of cues) {
      if (!bucket) bucket = { start: cue.start, end: cue.end, original: cue.text, translated: cue.translated || '', cueIds: [cue.id] };
      else {
        const join = /[-—]$/.test(bucket.original) || /^[,.;:!?，。！？、]/.test(cue.text) ? '' : ' ';
        bucket.original += join + cue.text;
        const tJoin = /[-—]$/.test(bucket.translated) || /^[,.;:!?，。！？、]/.test(cue.translated || '') ? '' : ' ';
        if (cue.translated) bucket.translated += (bucket.translated ? tJoin : '') + cue.translated;
        bucket.end = cue.end;
        bucket.cueIds.push(cue.id);
      }
      if (sentenceBoundary(bucket.original) || bucket.original.length > 180) {
        out.push(bucket);
        bucket = null;
      }
    }
    if (bucket) out.push(bucket);
    return out;
  }

  function alignTranslations(original, translated) {
    // YouTube's translated JSON3 track normally preserves cue timing. Never
    // invent translated text when the target track could not be fetched.
    if (!translated.length) return original.map(o => ({ ...o, translated: '' }));
    return original.map((o, i) => {
      let t = translated[i];
      if (!t) {
        let best = null, bestScore = Infinity;
        for (const candidate of translated) {
          const score = Math.abs(candidate.start - o.start) + Math.abs(candidate.end - o.end);
          if (score < bestScore) { bestScore = score; best = candidate; }
        }
        t = best;
      }
      return { ...o, translated: t?.text || '' };
    });
  }

  function findCueIndex(time) {
    let lo = 0, hi = state.cues.length - 1, answer = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const c = state.cues[mid];
      if (time < c.start) hi = mid - 1;
      else { answer = mid; lo = mid + 1; }
    }
    if (answer >= 0 && time <= state.cues[answer].end + 0.08) return answer;
    return -1;
  }

  function cacheKey() {
    const source = state.sourceTrack?.languageCode || 'auto';
    return `${state.videoId}|${source}|${state.settings.targetLanguage}`;
  }

  function cacheGet(key) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CACHE_GET', key }, r => resolve(r?.value || null));
    });
  }

  function cacheSet(key, value) {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CACHE_SET', key, value }, () => resolve());
    });
  }

  async function triggerYouTubeCaptionRequest() {
    // YouTube's own caption request contains the current proof/signature
    // parameters. Triggering native CC lets our MAIN-world bridge observe that
    // exact working URL instead of trying to reconstruct it ourselves.
    if (state.captionUrl || !state.tracks.length) return;
    const cc = document.querySelector('.ytp-subtitles-button');
    if (!cc) return;
    const wasOn = cc.getAttribute('aria-pressed') === 'true' || cc.classList.contains('ytp-button-active');
    if (!wasOn) {
      try { cc.click(); } catch {}
      for (let i = 0; i < 40; i++) {
        if (state.captionUrl) break;
        await sleep(75);
      }
      if (!wasOn && cc.isConnected && (cc.getAttribute('aria-pressed') === 'true' || cc.classList.contains('ytp-button-active'))) {
        try { cc.click(); } catch {}
      }
    }
  }

  async function getWorkingCaptionUrl() {
    if (state.captionUrl) return state.captionUrl;
    await triggerYouTubeCaptionRequest();
    if (state.captionUrl) return state.captionUrl;
    // Ask the MAIN-world bridge for fresh player metadata.
    sendToPage({ type: 'REQUEST_PLAYER_STATE' });
    for (let i = 0; i < 30; i++) {
      if (state.captionUrl) return state.captionUrl;
      await sleep(100);
    }
    return '';
  }

  function requestTranscriptFromMain() {
    sendToPage({ type: 'REQUEST_TRANSCRIPT', targetLanguage: state.settings.targetLanguage || 'en' });
  }

  function applyTranscriptData(d) {
    if (!d || d.videoId !== state.videoId) return;
    const original = Array.isArray(d.original) ? d.original : [];
    const translated = Array.isArray(d.translated) ? d.translated : [];
    if (!original.length) throw new Error('YouTube returned no original caption cues');

    state.sourceTrack = state.sourceTrack || { languageCode: d.sourceLanguage || '' };
    state.cues = alignTranslations(
      original.map((c, i) => ({ ...c, id: i })),
      translated
    );
    state.sentences = mergeCues(state.cues).map((x, i) => ({ ...x, id: i }));
    state.translationError = d.translationAvailable ? '' : (d.translationError || 'YouTube did not provide a translated track');
    state.status = d.translationAvailable ? 'ready' : 'ready-original';
    renderAll();

    cacheSet(cacheKey(), {
      videoId: state.videoId,
      sourceLanguage: d.sourceLanguage || '',
      targetLanguage: d.targetLanguage || state.settings.targetLanguage,
      cues: state.cues,
      sentences: state.sentences,
      translationError: state.translationError,
      translationAvailable: !!d.translationAvailable
    });
  }

  async function fetchDualTranscript() {
    if (!state.videoId || !state.settings.enabled) return;
    state.abort?.abort();
    state.abort = new AbortController();
    state.status = 'loading';
    state.translationError = '';
    renderStatus('Fetching complete dual transcript…');

    const cached = await cacheGet(cacheKey());
    if (cached?.cues?.length) {
      state.cues = cached.cues;
      state.sentences = cached.sentences || mergeCues(state.cues).map((x, i) => ({ ...x, id: i }));
      state.translationError = cached.translationError || '';
      state.status = cached.translationAvailable === false || !state.cues.some(c => c.translated) ? 'ready-original' : 'ready';
      renderAll();
      // A cache hit should still allow the user to force a fresh translation
      // through the Refresh button; normal startup remains instant.
      return;
    }
    requestTranscriptFromMain();
  }

  function createUI() {
    if (state.ui.root) return;
    const root = document.createElement('div');
    root.id = 'cmj-dual-transcript-root';
    root.innerHTML = `
      <div class="cmj-dual-overlay" aria-live="polite">
        <div class="cmj-original"></div>
        <div class="cmj-translation"></div>
      </div>
      <button class="cmj-panel-toggle" title="Open complete dual transcript">DT</button>
      <section class="cmj-panel" hidden>
        <header><strong>Dual Transcript</strong><span class="cmj-status">Idle</span><button class="cmj-refresh" title="Refresh transcript">↻</button><button class="cmj-close" title="Close">×</button></header>
        <input class="cmj-search" placeholder="Search transcript…" />
        <div class="cmj-transcript-list"></div>
      </section>`;
    document.documentElement.appendChild(root);
    state.ui = {
      root,
      overlay: root.querySelector('.cmj-dual-overlay'),
      original: root.querySelector('.cmj-original'),
      translation: root.querySelector('.cmj-translation'),
      panel: root.querySelector('.cmj-panel'),
      list: root.querySelector('.cmj-transcript-list'),
      status: root.querySelector('.cmj-status'),
      search: root.querySelector('.cmj-search'),
      refresh: root.querySelector('.cmj-refresh')
    };
    root.querySelector('.cmj-panel-toggle').onclick = () => {
      state.settings.showPanel = true;
      state.ui.panel.hidden = false;
      renderTranscriptList();
    };
    root.querySelector('.cmj-close').onclick = () => { state.settings.showPanel = false; state.ui.panel.hidden = true; };
    state.ui.refresh.onclick = () => { state.captionUrl = ''; state.status = 'loading'; renderStatus('Refreshing complete dual transcript…'); requestTranscriptFromMain(); };
    state.ui.search.oninput = renderTranscriptList;
    renderAll();
  }

  function renderStatus(text) {
    if (state.ui.status) state.ui.status.textContent = text;
  }

  function renderTranscriptList() {
    if (!state.ui.list) return;
    const q = (state.ui.search?.value || '').toLowerCase();
    const fragment = document.createDocumentFragment();
    for (const s of state.sentences) {
      const text = `${s.original} ${s.translated || ''}`;
      if (q && !text.toLowerCase().includes(q)) continue;
      const row = document.createElement('button');
      row.className = 'cmj-row';
      row.innerHTML = `<time>${formatTime(s.start)}</time><span><b></b><small></small></span>`;
      row.querySelector('b').textContent = s.original;
      row.querySelector('small').textContent = s.translated || (state.translationError ? `Translation unavailable: ${state.translationError}` : 'Translation unavailable');
      row.onclick = () => { if (state.player) { state.player.currentTime = s.start; state.player.play().catch(() => {}); } };
      fragment.appendChild(row);
    }
    state.ui.list.replaceChildren(fragment);
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const x = s % 60;
    return h ? `${h}:${String(m).padStart(2,'0')}:${String(x).padStart(2,'0')}` : `${m}:${String(x).padStart(2,'0')}`;
  }

  function renderCurrentCue() {
    if (!state.player || !state.cues.length) return;
    const idx = findCueIndex(state.player.currentTime);
    if (idx === state.currentIndex) return;
    state.currentIndex = idx;
    const cue = state.cues[idx];
    state.ui.original.textContent = cue?.text || '';
    state.ui.translation.textContent = cue?.translated || '';
  }

  function renderAll() {
    createUI();
    state.ui.overlay.style.display = state.settings.showOverlay && state.settings.enabled ? '' : 'none';
    state.ui.overlay.style.setProperty('--cmj-scale', state.settings.fontScale);
    state.ui.overlay.style.setProperty('--cmj-opacity', state.settings.opacity);
    const readyText = state.status === 'ready-original' ? `Original ready · ${state.cues.length} cues · translation unavailable` : (state.status === 'ready' ? `Dual ready · ${state.cues.length} cues` : state.status);
    renderStatus(readyText);
    renderTranscriptList();
    renderCurrentCue();
  }

  function syncLoop() {
    renderCurrentCue();
    state.raf = requestAnimationFrame(syncLoop);
  }

  function locateVideo() {
    const v = document.querySelector('video.html5-main-video, video');
    if (v && v !== state.player) {
      state.player = v;
      state.currentIndex = -1;
      v.addEventListener('loadedmetadata', () => handleNavigation(true), { once: true });
    }
    return state.player;
  }

  function handleNavigation(force = false) {
    const id = currentVideoIdFromUrl();
    if (!id) return;
    if (!force && id === state.videoId) return;
    state.videoId = id;
    state.captionUrl = '';
    state.cues = [];
    state.sentences = [];
    state.currentIndex = -1;
    state.status = 'waiting';
    state.playerInfo = null;
    state.tracks = [];
    state.translationError = '';
    renderStatus('Waiting for YouTube caption track…');
    sendToPage({ type: 'REQUEST_PLAYER_STATE' });
    // YouTube can populate captionTracks after navigation; give it a short
    // window to expose the track, while request interception handles the
    // actual pot-bearing URL.
    setTimeout(() => fetchDualTranscript().catch(e => {
      state.status = 'error';
      renderStatus(`Transcript unavailable: ${e.message}`);
      log(e);
    }), 350);
  }

  function addYouTubeControl() {
    const controls = document.querySelector('.ytp-right-controls');
    if (!controls || controls.querySelector('.cmj-youtube-button')) return;
    const b = document.createElement('button');
    b.className = 'ytp-button cmj-youtube-button';
    b.title = 'Charlie MJ Dual Transcript';
    b.textContent = 'DT';
    b.onclick = () => {
      state.settings.showPanel = !state.settings.showPanel;
      state.ui.panel.hidden = !state.settings.showPanel;
      if (state.settings.showPanel) renderTranscriptList();
    };
    controls.insertBefore(b, controls.firstChild);
  }

  async function loadSettings() {
    const data = await chrome.storage.local.get('cmjDualSettings');
    state.settings = { ...DEFAULTS, ...(data.cmjDualSettings || {}) };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'CMJ_GET_STATUS') {
      sendResponse({ status: state.status, videoId: state.videoId, cueCount: state.cues.length, settings: state.settings });
      return true;
    }
    if (message?.type === 'CMJ_REFRESH') {
      state.captionUrl = '';
      fetchDualTranscript().then(() => sendResponse({ ok: true })).catch(e => sendResponse({ ok: false, error: e.message }));
      return true;
    }
    if (message?.type === 'CMJ_OPEN_PANEL') {
      createUI();
      state.settings.showPanel = true;
      state.ui.panel.hidden = false;
      renderTranscriptList();
      sendToPage({ type: 'REQUEST_TRANSCRIPT', targetLanguage: state.settings.targetLanguage || 'en' });
      sendResponse({ ok: true });
      return true;
    }
    if (message?.type === 'CMJ_SETTINGS') {
      state.settings = { ...state.settings, ...message.settings };
      chrome.storage.local.set({ cmjDualSettings: state.settings });
      renderAll();
      if (message.settings.showPanel) { createUI(); state.settings.showPanel = true; state.ui.panel.hidden = false; renderTranscriptList(); }
      if (message.settings.targetLanguage) { state.captionUrl = ''; requestTranscriptFromMain(); }
      sendResponse({ ok: true });
    }
  });

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== 'CMJ_DUAL_TRANSCRIPT') return;
    const d = event.data;
    if (d.type === 'FETCH_STATUS') {
      const labels = {
        'fetching-original': 'Fetching complete original transcript…',
        'original-ready': `Original transcript ready · ${d.count || 0} cues`,
        'fetching-translation': `Fetching YouTube auto-translation · ${d.language || ''}`
      };
      renderStatus(labels[d.status] || d.status);
    }
    if (d.type === 'TRANSCRIPT_ERROR') {
      state.status = 'error';
      renderStatus(`Transcript unavailable: ${d.error || 'Unknown YouTube error'}`);
    }
    if (d.type === 'TRANSCRIPT_DATA') {
      try { applyTranscriptData(d); } catch (error) { state.status = 'error'; renderStatus(error.message); }
    }
    if (d.type === 'PLAYER_STATE') {
      state.playerInfo = d;
      state.tracks = parseTracks(d.captions);
      state.sourceTrack = selectSourceTrack();
      if (state.videoId === d.videoId && state.status !== 'ready' && state.status !== 'loading') {
        fetchDualTranscript().catch(e => { state.status = 'error'; renderStatus(`Transcript unavailable: ${e.message}`); });
      }
    }
  });

  async function init() {
    await loadSettings();
    createUI();
    await injectBridge();
    locateVideo();
    handleNavigation(true);
    setInterval(() => {
      locateVideo();
      addYouTubeControl();
      if (location.href !== state.lastUrl) {
        state.lastUrl = location.href;
        handleNavigation();
      }
    }, 1000);
    syncLoop();
  }

  init().catch(console.error);
})();
