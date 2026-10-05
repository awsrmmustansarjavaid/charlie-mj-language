/**
 * Charlie MJ Language - YouTube learning engine.
 *
 * This is the main YouTube integration for the extension. It deliberately uses
 * a DOM/player-oriented design instead of a popup-only design because the
 * learner needs the tools while the video is playing.
 *
 * Implemented here:
 * - real YouTube caption-track discovery through the MAIN-world bridge;
 * - native-caption fallback so the tool still reacts when YouTube changes its
 *   player response timing;
 * - dual subtitles and word-level interaction;
 * - CEFR-style learner levels and part-of-speech visualisation;
 * - complete transcript browser and translation export;
 * - vocabulary, sentence mining, bookmarks and Watch Later;
 * - timeline screenshot capture;
 * - distraction-reduced Focus Mode;
 * - YouTube overflow-menu integration for Watch Later;
 * - a persistent learning toolbar below the video.
 *
 * The extension stores learner data locally. External translation is optional
 * and is requested only when the learner asks for it or enables auto-translate.
 */
(() => {
  'use strict';

  const EVENT_NAME = 'cmj-youtube-player-response';
  const DATA_EVENT = 'cmj-youtube-player-response-data';
  const ROOT_ID = 'cmj-language-root';
  const PLAYER_HOST_ID = 'cmj-player-tools';
  const BELOW_HOST_ID = 'cmj-below-player-tools';

  const state = {
    videoId: '',
    title: '',
    url: '',
    captions: [],
    tracks: [],
    activeIndex: -1,
    lastCaptionKey: '',
    translationCache: {},
    translating: false,
    settings: {},
    panelTab: 'transcript',
    focusMode: false,
    watchMenuInjected: false,
    nativeCaptionText: '',
    wordCardTimer: null,
    notesSaveTimer: null,
    syncFrame: null,
    lastSyncAt: 0,
    captionDiagnostics: ''
  };

  const DEFAULTS = {
    sourceLanguage: 'tr',
    targetLanguage: 'en',
    translationProvider: 'mymemory',
    libreTranslateUrl: '',
    focusMode: true,
    posColors: true,
    boldPOS: true,
    showLevels: true,
    autoTranslate: true,
    hideRecommendations: true,
    hideShorts: true,
    hideComments: true,
    downloadRoot: 'Charlie MJ Language',
    downloadSaveAs: false,
    showToolbarUnderVideo: true,
    wordCardAutoCloseMs: 6000,
    captionAutoFetch: true,
    captionFetchIntervalMs: 180,
    captionSyncIntervalMs: 40,
    captionSyncToleranceMs: 350,
    toolbarRevealMode: 'always',
    toolbarPosition: { leftPx: null, topPx: null, left: 50, top: null, bottom: 58 },
    toolbarHoverZonePx: 140,
    toolbarDragAnywhere: true,
    toolbarSnap: 'free',
    toolbarAutoHideDelayMs: 1800,
    theme: 'dark',
    subtitlePreloadTranslations: 2,
    grammarColors: {
      noun: '#38bdf8', verb: '#fb7185', adjective: '#a78bfa', adverb: '#4ade80', pronoun: '#facc15',
      preposition: '#f472b6', conjunction: '#fb923c', determiner: '#818cf8', numeral: '#a3e635', particle: '#22d3ee',
      other: '#e2e8f0', turkishSuffix: '#c084fc', turkishCase: '#f59e0b', turkishPlural: '#34d399',
      turkishPossessive: '#60a5fa', turkishTense: '#f87171', turkishPerson: '#fb7185'
    }
  };

  const POS = {
    noun: { label: 'Noun', color: '#38bdf8' },
    verb: { label: 'Verb', color: '#fb7185' },
    adjective: { label: 'Adjective', color: '#a78bfa' },
    adverb: { label: 'Adverb', color: '#4ade80' },
    pronoun: { label: 'Pronoun', color: '#facc15' },
    preposition: { label: 'Preposition', color: '#f472b6' },
    conjunction: { label: 'Conjunction', color: '#fb923c' },
    determiner: { label: 'Determiner', color: '#818cf8' },
    numeral: { label: 'Numeral', color: '#a3e635' },
    particle: { label: 'Particle', color: '#22d3ee' },
    other: { label: 'Other', color: '#e2e8f0' }
  };

  const CEFR = {
    A1: 'Beginner',
    A2: 'Elementary',
    B1: 'Intermediate',
    B2: 'Upper-Intermediate',
    C1: 'Advanced',
    C2: 'Proficient'
  };

  const COMMON = {
    tr: new Set('ben sen o biz siz onlar bu şu bir ve veya ama çünkü için ile de da çok daha en değil var yok bugün şimdi sonra önce güzel iyi kötü büyük küçük yapmak olmak gelmek gitmek görmek bilmek istemek söylemek konuşmak çalışmak ev insan gün gece zaman su yemek para'.split(' ')),
    en: new Set('i you he she we they the a an this that and or but because for with from to of in on is are was were be have has do did not very more good bad big small make get go see know want say speak work house people day night time water food money'.split(' '))
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  init().catch(error => console.warn('Charlie MJ Language initialisation failed:', error));

  async function init() {
    const stored = await chrome.storage.local.get('settings');
    state.settings = { ...DEFAULTS, ...(stored.settings || {}) };
    state.focusMode = Boolean(state.settings.focusMode);
    state.settings.toolbarPosition = { left: 50, top: null, bottom: 58, ...(state.settings.toolbarPosition || {}) };

    document.addEventListener(EVENT_NAME, onPlayerResponse);
    document.addEventListener(EVENT_NAME + '-data', onCaptionData);
    document.addEventListener(DATA_EVENT, onCaptionData);
    document.addEventListener('cmj-youtube-caption-diagnostics', event => { state.captionDiagnostics = event.detail || ''; }, true);
    chrome.runtime.onMessage.addListener(onMessage);
    window.addEventListener('keydown', onShortcut, true);
    chrome.storage.onChanged.addListener(onSettingsChanged);

    installObservers();
    routeChanged();
    setInterval(routeChanged, 1000);
    startSubtitleSyncLoop();
    setInterval(injectYouTubeWatchLaterItem, 400);
  }

  function startSubtitleSyncLoop() {
    if (state.syncFrame) return;
    const tick = () => {
      state.syncFrame = requestAnimationFrame(tick);
      if (!isWatchPage()) return;
      const now = performance.now();
      const interval = Math.max(16, Number(state.settings.captionSyncIntervalMs || 40));
      if (now - (state.lastSyncAt || 0) < interval) return;
      state.lastSyncAt = now;
      updatePlayback();
    };
    state.syncFrame = requestAnimationFrame(tick);
  }

  /** React immediately when the learner changes display/download preferences. */
  async function onSettingsChanged(changes, area) {
    if (area !== 'local' || !changes.settings?.newValue) return;
    state.settings = { ...DEFAULTS, ...changes.settings.newValue, toolbarPosition: { ...DEFAULTS.toolbarPosition, ...(changes.settings.newValue.toolbarPosition || {}) } };
    state.focusMode = Boolean(state.settings.focusMode);
    ensureUI();
    const existingHost = document.getElementById(PLAYER_HOST_ID);
    if (existingHost) { applyToolbarPosition(existingHost); applyToolbarRevealMode(document.querySelector('#movie_player'), existingHost); }
    applyFocusMode();
    renderCurrentSubtitle();
    applyTheme();
  }

  /** Observe YouTube's SPA DOM and player changes. */
  function installObservers() {
    const observer = new MutationObserver(() => {
      if (isWatchPage()) {
        ensureUI();
        readNativeCaptions();
        injectYouTubeWatchLaterItem();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    document.addEventListener('yt-navigate-finish', routeChanged, true);
    document.addEventListener('yt-page-data-updated', routeChanged, true);
  }

  function onCaptionData(event) {
    try {
      const payload = JSON.parse(event.detail || '{}');
      if (!Array.isArray(payload.captions) || !payload.captions.length) return;
      state.captions = mergeCaptionSegments(payload.captions.map(item => ({ ...item, text: cleanText(item.text) })));
      if (payload.track) state.tracks = [payload.track, ...state.tracks.filter(t => t.baseUrl !== payload.track.baseUrl)];
      state.activeIndex = -1;
      state.lastCaptionKey = '';
      renderCurrentSubtitle();
      renderPanelIfOpen();
      if (state.settings.autoTranslate) prefetchTranslations(0, Number(state.settings.subtitlePreloadTranslations || 2));
    } catch (_) {}
  }

  function onPlayerResponse(event) {
    try {
      const payload = JSON.parse(event.detail || '[]');
      const tracks = Array.isArray(payload) ? payload : payload.tracks;
      if (Array.isArray(tracks) && tracks.length) {
        state.tracks = tracks;
        loadCaptionTrack().catch(error => console.warn('Caption track load failed:', error));
      }
    } catch (error) {
      console.warn('Charlie MJ received invalid player response:', error);
    }
  }

  async function routeChanged() {
    if (!isWatchPage()) return;
    const id = getVideoId();
    if (!id) return;

    ensureUI();
    applyTheme();
    injectYouTubeWatchLaterItem();

    if (id === state.videoId) {
      readNativeCaptions();
      return;
    }

    state.videoId = id;
    state.url = location.href;
    state.title = getTitle();
    state.captions = [];
    state.tracks = [];
    state.activeIndex = -1;
    state.lastCaptionKey = '';
    state.translationCache = {};
    state.nativeCaptionText = '';

    applyFocusMode();
    showToast('Charlie MJ Language is fetching subtitles…');
    if (state.settings.captionAutoFetch !== false) {
      await bootstrapCaptionDiscovery();
    }
    readNativeCaptions();
  }

  function applyTheme() {
    const root = document.getElementById(ROOT_ID);
    const toolbar = document.getElementById(PLAYER_HOST_ID);
    const theme = state.settings.theme || 'dark';
    for (const node of [root, toolbar]) if (node) node.dataset.cmjTheme = theme;
  }

  function isWatchPage() {
    return location.hostname.endsWith('youtube.com') && location.pathname === '/watch';
  }

  function getVideoId() {
    try { return new URL(location.href).searchParams.get('v') || ''; } catch { return ''; }
  }

  function getTitle() {
    return document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim()
      || document.querySelector('h1.title')?.textContent?.trim()
      || document.title.replace(/\s*-\s*YouTube\s*$/i, '').trim()
      || 'YouTube Video';
  }

  /**
   * Aggressively discover captions without requiring YouTube CC to be enabled.
   * YouTube exposes caption metadata before/around playback; we race the MAIN
   * world bridge, player API, initial response objects and page scripts.
   */
  async function bootstrapCaptionDiscovery() {
    const started = performance.now();
    const fastInterval = Math.max(80, Number(state.settings.captionFetchIntervalMs || 180));
    for (let attempt = 0; attempt < 16; attempt += 1) {
      if (state.tracks.length) break;
      discoverCaptionTracksFromPlayer();
      if (!state.tracks.length) await discoverCaptionTracksFromPage();
      if (state.tracks.length) break;
      await wait(Math.min(fastInterval, 140));
    }
    if (state.tracks.length) {
      await loadCaptionTrack();
      showToast(`Subtitles synced: ${state.captions.length} segments`);
      return true;
    }
    // A slower retry covers YouTube's delayed SPA player response.
    for (let attempt = 0; attempt < 12 && !state.tracks.length; attempt += 1) {
      discoverCaptionTracksFromPlayer();
      if (!state.tracks.length) await discoverCaptionTracksFromPage();
      if (!state.tracks.length) await wait(500);
    }
    if (state.tracks.length) {
      await loadCaptionTrack();
      showToast(`Subtitles synced after ${Math.round(performance.now() - started)}ms`);
      return true;
    }
    showToast('YouTube has not exposed transcript data yet. Charlie MJ is still listening for the player transcript request.');
    return false;
  }

  function discoverCaptionTracksFromPlayer() {
    try {
      const player = document.querySelector('#movie_player');
      const response = player?.getPlayerResponse?.()
        || window.ytInitialPlayerResponse
        || window.ytplayer?.config?.args?.player_response
        || window.ytplayer?.config?.playerResponse;
      const parsed = typeof response === 'string' ? JSON.parse(response) : response;
      const tracks = parsed?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(tracks) && tracks.length) {
        state.tracks = normaliseTracks(tracks);
        return true;
      }
    } catch (_) { /* YouTube can expose an incomplete response during navigation. */ }
    return false;
  }

  function normaliseTracks(tracks) {
    return tracks.map(track => ({
      baseUrl: String(track.baseUrl || '').replace(/\\u0026/g, '&'),
      languageCode: track.languageCode || '',
      name: track.name?.simpleText || track.name?.runs?.map(run => run.text).join('') || '',
      vssId: track.vssId || '',
      kind: track.kind || ''
    })).filter(track => track.baseUrl);
  }

  /**
   * Parse the player-response script when the MAIN-world bridge has not fired yet.
   * This is intentionally a fallback; the bridge is the preferred source.
   */
  async function discoverCaptionTracksFromPage() {
    for (const script of $$('script')) {
      const text = script.textContent || '';
      if (!text.includes('captionTracks') || !text.includes('ytInitialPlayerResponse')) continue;
      const response = extractAssignedObject(text, 'ytInitialPlayerResponse');
      const tracks = response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(tracks) && tracks.length) {
        state.tracks = normaliseTracks(tracks);
        return true;
      }
    }
    return false;
  }

  function extractAssignedObject(text, variableName) {
    const start = text.indexOf(variableName);
    if (start < 0) return null;
    const braceStart = text.indexOf('{', start + variableName.length);
    if (braceStart < 0) return null;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let i = braceStart; i < text.length; i += 1) {
      const char = text[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') { quoted = true; continue; }
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          try { return JSON.parse(text.slice(braceStart, i + 1)); } catch { return null; }
        }
      }
    }
    return null;
  }

  async function loadCaptionTrack() {
    if (!state.tracks.length) return false;

    // Do not make an unsigned timedtext request first. Since YouTube now
    // commonly requires a player-minted proof token, that request can stall for
    // seconds and return HTTP 200 with an empty body. The MAIN-world bridge is
    // the primary source because it can observe the player's real request or
    // call get_transcript with YouTube's own endpoint parameters.
    if (state.captions.length) return true;

    const preferred = state.tracks.find(track => track.languageCode === state.settings.sourceLanguage)
      || state.tracks.find(track => track.languageCode?.split('-')[0] === state.settings.sourceLanguage?.split('-')[0])
      || state.tracks[0];
    if (!preferred?.baseUrl) return false;

    state.settings.sourceLanguage = preferred.languageCode || state.settings.sourceLanguage;
    chrome.storage.local.set({ settings: state.settings }).catch(() => {});

    // Legacy direct fetch remains only as a short, abortable fallback. This
    // prevents the old 8-10 second empty timedtext stall from blocking the UI.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1400);
    try {
      const response = await fetch(preferred.baseUrl.replace(/\\u0026/g, '&'), { credentials: 'include', cache: 'no-store', signal: controller.signal });
      if (response.ok) {
        const text = await response.text();
        const parsed = parseCaptionResponse(text);
        if (parsed.length) {
          state.captions = mergeCaptionSegments(parsed);
          renderCurrentSubtitle(); renderPanelIfOpen();
          showToast(`${state.captions.length} subtitle segments loaded.`);
          return true;
        }
      }
    } catch (_) {
      // Expected on current YouTube builds; the bridge continues harvesting the
      // player request / get_transcript response in parallel.
    } finally { clearTimeout(timeout); }
    return Boolean(state.captions.length);
  }

  function parseCaptionResponse(text) {
    const result = [];
    if (text.trim().startsWith('{')) {
      try {
        const json = JSON.parse(text);
        for (const event of json.events || []) {
          const value = (event.segs || []).map(segment => segment.utf8 || '').join('');
          if (value.trim()) result.push({
            start: (event.tStartMs || 0) / 1000,
            duration: (event.dDurationMs || 0) / 1000,
            text: cleanText(value)
          });
        }
        return result;
      } catch (error) {
        console.warn('Charlie MJ JSON caption parsing failed:', error);
      }
    }

    const xml = new DOMParser().parseFromString(text, 'text/xml');
    for (const node of [...xml.querySelectorAll('text')]) {
      const value = cleanText(node.textContent || '');
      if (value) result.push({
        start: Number(node.getAttribute('start') || 0),
        duration: Number(node.getAttribute('dur') || 0),
        text: value
      });
    }
    return result;
  }

  function mergeCaptionSegments(segments) {
    const result = [];
    for (const segment of segments.sort((a, b) => a.start - b.start)) {
      const previous = result[result.length - 1];
      if (previous && Math.abs(previous.start - segment.start) < 0.12 && previous.text === segment.text) continue;
      result.push(segment);
    }
    return result;
  }

  function cleanText(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return stripYouTubeCaptionArtifacts(textarea.value).replace(/\s+/g, ' ').trim();
  }

  /**
   * YouTube sometimes leaks the CC settings UI label into caption payloads.
   * Examples include strings such as "A1TurkishB1(auto-generated)C1ClickA2forA1settingsB1".
   * These are UI metadata, not learner content, so remove them before rendering
   * and before any transcript/export operation.
   */
  function stripYouTubeCaptionArtifacts(text) {
    let value = String(text || '');
    const level = '(?:A1|A2|B1|B2|C1|C2)';
    const language = '(?:Turkish|English|German|French|Spanish|Italian|Arabic|Persian|Urdu|Japanese|Korean|Chinese|Hindi)';
    const leakedLabel = new RegExp(`${level}*${language}${level}*\\s*\\(auto-generated\\)${level}*\\s*Click${level}*\\s*for${level}*\\s*settings${level}*`, 'gi');
    value = value.replace(leakedLabel, ' ');
    // Also catch the same settings phrase when YouTube changes the ordering of CEFR tokens.
    value = value.replace(new RegExp(`${level}*${language}${level}*\\s*Click${level}*\\s*for${level}*\\s*settings${level}*`, 'gi'), ' ');
    // Caption payloads can also contain standalone or embedded CEFR labels such
    // as `PeynirimizB2var,A1tereyağımızB2var`. They are UI metadata, so turn
    // each leaked level marker into whitespace before normalising the sentence.
    value = value.replace(/(?:A1|A2|B1|B2|C1|C2)/gi, ' ');
    return value;
  }

  /** Build all extension UI layers. */
  function ensureUI() {
    if (!document.body || !isWatchPage()) return;

    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('section');
      root.id = ROOT_ID;
      root.innerHTML = `
        <div class="cmj-subtitle-layer" aria-live="polite"></div>
        <div class="cmj-word-card" hidden></div>
        <aside class="cmj-panel" hidden>
          <header class="cmj-panel-head"><strong>🌍 Charlie MJ Language</strong><button data-cmj-action="close">×</button></header>
          <nav class="cmj-tabs">
            <button data-cmj-tab="transcript">Transcript</button>
            <button data-cmj-tab="vocabulary">Vocabulary</button>
            <button data-cmj-tab="bookmarks">Bookmarks</button>
            <button data-cmj-tab="watchLater">Watch Later</button>
            <button data-cmj-tab="notes">Notes</button>
          </nav>
          <div class="cmj-panel-body"></div>
        </aside>
        <div class="cmj-toast" hidden></div>`;
      document.body.appendChild(root);
      root.addEventListener('click', onRootClick);
      root.addEventListener('input', onRootInput);
      installSubtitleHoverPause(root);
    }

    const player = document.querySelector('#movie_player');
    if (player) {
      let playerHost = document.getElementById(PLAYER_HOST_ID);
      if (state.settings.showToolbarUnderVideo !== false) {
        if (!playerHost) {
          playerHost = document.createElement('div');
          playerHost.id = PLAYER_HOST_ID;
          playerHost.innerHTML = buildToolbarHTML();
          playerHost.addEventListener('click', onToolbarClick);
          installToolbarInteractions(player, playerHost);
          document.body.appendChild(playerHost);
        }
      } else if (playerHost) {
        playerHost.remove();
      }
      const video = getVideo();
      if (video && !video.dataset.cmjEndedHook) {
        video.dataset.cmjEndedHook = '1';
        video.addEventListener('play', () => {
          if (!state.captions.length && state.settings.captionAutoFetch !== false) bootstrapCaptionDiscovery().catch(() => {});
        });
        video.addEventListener('loadedmetadata', () => {
          if (!state.captions.length && state.settings.captionAutoFetch !== false) bootstrapCaptionDiscovery().catch(() => {});
        });
        video.addEventListener('seeking', () => { state.lastCaptionKey = ''; updatePlayback(); });
        video.addEventListener('ended', () => showToast('Video complete. Open Transcript to copy/download the complete transcript with translation.'));
      }
    }

    const below = document.querySelector('#below, #below-the-fold');
    if (below && !document.getElementById(BELOW_HOST_ID)) {
      const host = document.createElement('div');
      host.id = BELOW_HOST_ID;
      host.innerHTML = `<div class="cmj-video-title-bar"><span>🌍 Charlie MJ Language</span><span class="cmj-video-state">Learning Mode</span></div>`;
      below.prepend(host);
    }

    applyFocusMode();
    readNativeCaptions();
  }

  function installToolbarInteractions(player, host) {
    applyToolbarPosition(host);
    applyToolbarRevealMode(player, host);
    const toolbar = $('.cmj-toolbar', host);
    if (!toolbar || toolbar.dataset.cmjDragReady) return;
    toolbar.dataset.cmjDragReady = '1';
    let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    const begin = event => {
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest('button')) return;
      const rect = host.getBoundingClientRect();
      dragging = true; startX = event.clientX; startY = event.clientY; startLeft = rect.left; startTop = rect.top;
      document.body.classList.add('cmj-toolbar-dragging');
      try { toolbar.setPointerCapture?.(event.pointerId); } catch (_) {}
      event.preventDefault(); event.stopPropagation();
    };
    const move = event => {
      if (!dragging) return;
      const maxX = Math.max(0, window.innerWidth - host.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - host.offsetHeight);
      const left = Math.max(0, Math.min(maxX, startLeft + event.clientX - startX));
      const top = Math.max(0, Math.min(maxY, startTop + event.clientY - startY));
      state.settings.toolbarPosition = { leftPx: Math.round(left), topPx: Math.round(top), left: null, top: null, bottom: null };
      applyToolbarPosition(host);
      updateToolbarRevealHotspot(host);
    };
    const end = async () => {
      if (!dragging) return;
      dragging = false; document.body.classList.remove('cmj-toolbar-dragging');
      try { await chrome.storage.local.set({ settings: state.settings }); } catch (_) {}
    };
    toolbar.addEventListener('pointerdown', begin, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', end, true);
    toolbar.addEventListener('dblclick', async event => {
      if (event.target.closest('button')) return;
      state.settings.toolbarPosition = { leftPx: Math.max(10, window.innerWidth / 2 - 300), topPx: Math.max(10, window.innerHeight - 100), left: null, top: null, bottom: null };
      applyToolbarPosition(host);
      await chrome.storage.local.set({ settings: state.settings });
    });
  }

  function applyToolbarPosition(host) {
    const pos = { leftPx: null, topPx: null, left: 50, top: null, bottom: 58, ...(state.settings.toolbarPosition || {}) };
    host.style.position = 'fixed';
    host.style.transform = 'none';
    if (Number.isFinite(Number(pos.leftPx)) && Number.isFinite(Number(pos.topPx))) {
      host.style.left = `${Number(pos.leftPx)}px`; host.style.top = `${Number(pos.topPx)}px`; host.style.bottom = 'auto';
    } else {
      host.style.left = `${Number(pos.left)}%`; host.style.top = pos.top != null ? `${Number(pos.top)}%` : 'auto'; host.style.bottom = pos.top != null ? 'auto' : `${Number(pos.bottom || 58)}px`;
      if (pos.top == null) host.style.transform = 'translateX(-50%)';
    }
  }

  function updateToolbarRevealHotspot(host) {
    const rect = host.getBoundingClientRect();
    host.style.setProperty('--cmj-hotspot-x', `${rect.left + rect.width / 2}px`);
    host.style.setProperty('--cmj-hotspot-y', `${rect.top + rect.height / 2}px`);
  }

  function applyToolbarRevealMode(player, host) {
    const mode = state.settings.toolbarRevealMode || 'always';
    const toolbar = $('.cmj-toolbar', host);
    if (!toolbar) return;
    toolbar.classList.toggle('cmj-toolbar-hover-mode', mode === 'hover');
    updateToolbarRevealHotspot(host);
    if (host.dataset.cmjRevealReady) return;
    host.dataset.cmjRevealReady = '1';
    document.addEventListener('mousemove', event => {
      if ((state.settings.toolbarRevealMode || 'always') !== 'hover') return;
      const rect = host.getBoundingClientRect();
      const zone = Number(state.settings.toolbarHoverZonePx || 140);
      const near = event.clientX >= rect.left - zone && event.clientX <= rect.right + zone && event.clientY >= rect.top - zone && event.clientY <= rect.bottom + zone;
      toolbar.classList.toggle('cmj-toolbar-revealed', near);
    }, true);
  }

  function buildToolbarHTML() {
    return `<div class="cmj-toolbar" role="toolbar" aria-label="Charlie MJ Language">
      <button data-cmj-toolbar="toggle" title="Enable or disable Charlie MJ subtitles">🌍 <span>CMJ</span></button>
      <button data-cmj-toolbar="transcript" title="Complete transcript">📜 <span>Transcript</span></button>
      <button data-cmj-toolbar="save" title="Save current subtitle">⭐ <span>Save</span></button>
      <button data-cmj-toolbar="bookmark" title="Bookmark this timeline position">🔖 <span>Bookmark</span></button>
      <button data-cmj-toolbar="capture" title="Capture this timeline position">📸 <span>Capture</span></button>
      <button data-cmj-toolbar="watch" title="Add this video to Charlie MJ Watch Later">⏰ <span>Watch Later</span></button>
      <button data-cmj-toolbar="focus" title="Reduce YouTube distractions">🎯 <span>Focus</span></button>
      <button class="cmj-more-button" data-cmj-toolbar="more" title="More tools">⋮</button>
      <div class="cmj-more-menu" hidden>
        <button data-cmj-toolbar="translate">🌐 Translate current subtitle</button>
        <button data-cmj-toolbar="download-transcript">⬇ Complete transcript + translation</button>
        <button data-cmj-toolbar="download-vocabulary">📚 Custom vocabulary + translation</button>
        <button data-cmj-toolbar="report">📊 Video learning report</button>
        <button data-cmj-toolbar="settings">⚙ Extension settings</button>
      </div>
    </div>`;
  }

  function installSubtitleHoverPause(root) {
    const layer = $('.cmj-subtitle-layer', root);
    let resume = false;
    layer.addEventListener('mouseenter', () => {
      const video = getVideo();
      if (video && !video.paused) { resume = true; video.pause(); }
    });
    layer.addEventListener('mouseleave', () => {
      const video = getVideo();
      if (video && resume) video.play().catch(() => {});
      resume = false;
    });
  }

  function onToolbarClick(event) {
    const button = event.target.closest('[data-cmj-toolbar]');
    if (!button) return;
    const action = button.dataset.cmjToolbar;
    if (action === 'toggle') toggleSubtitleVisibility();
    if (action === 'transcript') openPanel('transcript');
    if (action === 'save') saveCurrentSubtitle();
    if (action === 'bookmark') saveBookmark();
    if (action === 'capture') captureFrame();
    if (action === 'watch') addWatchLater();
    if (action === 'focus') toggleFocusMode();
    if (action === 'more') $('.cmj-more-menu', button.parentElement)?.toggleAttribute('hidden');
    if (action === 'translate') translateCurrent(false);
    if (action === 'download-transcript') downloadTranscript('both');
    if (action === 'download-vocabulary') downloadVocabulary();
    if (action === 'report') showLearningReport();
    if (action === 'settings') chrome.runtime.openOptionsPage();
  }

  async function onRootClick(event) {
    const word = event.target.closest('.cmj-word');
    if (word) {
      showWordCard(word.dataset.word || '');
      return;
    }
    if (event.target.closest('[data-cmj-word-close]')) { closeWordCard(); return; }
    const wordCard = event.target.closest('.cmj-word-card');
    if (!wordCard) closeWordCard();

    const openUrl = event.target.closest('[data-cmj-open-url]')?.dataset.cmjOpenUrl;
    if (openUrl) { window.open(openUrl, '_blank', 'noopener,noreferrer'); return; }

    const action = event.target.closest('[data-cmj-action]')?.dataset.cmjAction;
    if (action === 'close') closePanel();

    const tab = event.target.closest('[data-cmj-tab]')?.dataset.cmjTab;
    if (tab) openPanel(tab);

    const line = event.target.closest('[data-cmj-line]');
    if (line) seek(Number(line.dataset.cmjLine));

    const exportButton = event.target.closest('[data-cmj-export]');
    if (exportButton) {
      if (exportButton.dataset.cmjExport === 'both') copyCompleteTranscript().catch(() => showToast('Clipboard access was blocked.'));
      else downloadTranscript(exportButton.dataset.cmjExport);
    }

    const noteAction = event.target.closest('[data-cmj-note-action]')?.dataset.cmjNoteAction;
    if (noteAction) { await handleNoteAction(noteAction, event.target.closest('[data-cmj-note-action]')); return; }

    const saveWord = event.target.closest('[data-cmj-save-word]');
    if (saveWord) saveVocabulary(saveWord.dataset.cmjSaveWord, analyzeWord(saveWord.dataset.cmjSaveWord), $('.cmj-word-translation')?.textContent || '');
  }

  function getVideo() { return document.querySelector('video'); }

  function updatePlayback() {
    if (!isWatchPage()) return;
    const video = getVideo();
    if (!video) return;
    const current = getCurrentCaption();
    if (!current) {
      readNativeCaptions();
      return;
    }
    const key = `${state.activeIndex}:${current.start}:${current.text}`;
    if (key !== state.lastCaptionKey) {
      state.lastCaptionKey = key;
      renderCurrentSubtitle();
      if (state.settings.autoTranslate) {
        translateCurrent(true).catch(() => {});
        prefetchTranslations(state.activeIndex + 1, Number(state.settings.subtitlePreloadTranslations || 2));
      }
    }
  }

  function getCurrentCaption() {
    const video = getVideo();
    if (!video || !state.captions.length) return null;
    const time = Number(video.currentTime || 0);
    let lo = 0, hi = state.captions.length - 1, candidate = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (state.captions[mid].start <= time) { candidate = mid; lo = mid + 1; }
      else hi = mid - 1;
    }
    if (candidate >= 0) {
      const item = state.captions[candidate];
      const next = state.captions[candidate + 1];
      const end = item.start + Math.max(item.duration || 0, next ? next.start - item.start : 0.001);
      const tolerance = Math.max(0, Number(state.settings.captionSyncToleranceMs || 350)) / 1000;
      if (time <= end + tolerance || candidate === state.captions.length - 1) state.activeIndex = candidate;
    }
    return state.activeIndex >= 0 ? state.captions[state.activeIndex] : null;
  }

  function renderCurrentSubtitle() {
    const layer = $('.cmj-subtitle-layer');
    if (!layer) return;
    const current = getCurrentCaption();
    if (!current) {
      layer.innerHTML = state.nativeCaptionText ? '' : '<div class="cmj-no-caption">Fetching YouTube subtitles…</div>';
      return;
    }

    const cleanOriginal = stripYouTubeCaptionArtifacts(current.text);
    const original = renderWords(cleanOriginal, false);
    const translated = stripYouTubeCaptionArtifacts(state.translationCache[state.activeIndex] || '');
    const translationHTML = translated ? renderWords(translated, true, cleanOriginal) : '<span class="cmj-translation-placeholder">Translation</span>';
    layer.innerHTML = `<div class="cmj-original-line">${original}</div><div class="cmj-translation-line">${translationHTML}</div><div class="cmj-subtitle-meta">${formatTime(current.start)} · ${state.settings.showLevels ? getSentenceLevel(cleanOriginal) : ''}</div>`;
  }

  function renderWords(text, translated = false, sourceText = '') {
    const sourceTokens = sourceText ? tokenizeWords(sourceText) : [];
    let tokenIndex = 0;
    return stripYouTubeCaptionArtifacts(text).split(/(\s+)/).map(token => {
      if (/^\s+$/.test(token)) return token;
      const word = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’_-]+$/gu, '');
      if (!word) return escapeHTML(token);
      const info = translated && sourceTokens.length
        ? (sourceTokens[Math.min(tokenIndex, sourceTokens.length - 1)] || {}).info || analyzeWord(word)
        : analyzeWord(word);
      tokenIndex += 1;
      const style = state.settings.posColors ? `style="--cmj-pos:${escapeHTML(info.color)}"` : '';
      const bold = state.settings.boldPOS ? ' cmj-pos-bold' : '';
      const morphology = translated ? '' : renderMorphology(word, info);
      const level = state.settings.showLevels ? `<small>${info.cefr}</small>` : '';
      return `<span class="cmj-word cmj-${info.pos}${bold}" ${style} data-word="${escapeHTML(word)}" title="${escapeHTML(info.posLabel)} · ${escapeHTML(info.cefr)}">${morphology || escapeHTML(token)}${level}</span>`;
    }).join('');
  }

  function tokenizeWords(text) {
    return stripYouTubeCaptionArtifacts(text).split(/\s+/).filter(Boolean).map(word => ({ word, info: analyzeWord(word) }));
  }

  function renderMorphology(word, info) {
    if (!info.morphology?.length) return escapeHTML(word);
    let output = escapeHTML(word);
    // Highlight the strongest detected Turkish suffix/case while preserving the
    // base word in its normal part-of-speech color.
    const match = info.morphology[0];
    if (!match?.suffix) return output;
    const safeWord = String(word);
    const index = safeWord.toLocaleLowerCase('tr').lastIndexOf(match.suffix.toLocaleLowerCase('tr'));
    if (index <= 0) return output;
    const base = safeWord.slice(0, index);
    const suffix = safeWord.slice(index);
    const suffixColor = match.color;
    return `${escapeHTML(base)}<span class="cmj-morphology" style="--cmj-morph:${escapeHTML(suffixColor)}" title="${escapeHTML(match.label)}">${escapeHTML(suffix)}</span>`;
  }

  async function translateCurrent(silent = false) {
    const current = getCurrentCaption();
    if (!current || state.translating) return '';
    if (state.translationCache[state.activeIndex]) return state.translationCache[state.activeIndex];

    state.translating = true;
    try {
      const response = await safeRuntimeMessage({
        type: 'CMJ_TRANSLATE',
        text: current.text,
        source: state.settings.sourceLanguage || 'auto',
        target: state.settings.targetLanguage || 'en',
        provider: state.settings.translationProvider || 'mymemory',
        libreUrl: state.settings.libreTranslateUrl || ''
      });
      if (response?.ok && response.translation) {
        state.translationCache[state.activeIndex] = response.translation;
        renderCurrentSubtitle();
        if (!silent) showToast('Translation ready.');
        return response.translation;
      }
      if (!silent) showToast(response?.error || 'Translation unavailable.');
    } finally {
      state.translating = false;
    }
    return '';
  }

  async function prefetchTranslations(startIndex, count) {
    const total = Math.max(0, Math.min(5, Number(count) || 0));
    const jobs = [];
    for (let i = startIndex; i < Math.min(state.captions.length, startIndex + total); i += 1) {
      if (state.translationCache[i]) continue;
      const caption = state.captions[i];
      jobs.push((async () => {
        try {
          const response = await safeRuntimeMessage({ type: 'CMJ_TRANSLATE', text: caption.text, source: state.settings.sourceLanguage || 'auto', target: state.settings.targetLanguage || 'en', provider: state.settings.translationProvider || 'mymemory', libreUrl: state.settings.libreTranslateUrl || '' });
          if (response?.ok && response.translation) state.translationCache[i] = response.translation;
          if (i === state.activeIndex) renderCurrentSubtitle();
        } catch (_) {}
      })());
    }
    if (jobs.length) await Promise.allSettled(jobs);
  }

  function showWordCard(word) {
    const card = $('.cmj-word-card');
    if (!card) return;
    const clean = word.replace(/[^\p{L}\p{M}\p{N}'’-]/gu, '');
    if (!clean) return;
    const info = analyzeWord(clean);
    clearTimeout(state.wordCardTimer);
    card.hidden = false;
    card.innerHTML = `<button class="cmj-word-card-close" data-cmj-word-close aria-label="Close">×</button><strong>${escapeHTML(clean)}</strong><span>${info.posLabel} · ${info.cefr} · ${CEFR[info.cefr]}</span><span class="cmj-word-translation">Translating…</span><button data-cmj-save-word="${escapeHTML(clean)}">⭐ Save vocabulary</button>`;
    state.wordCardTimer = setTimeout(() => { card.hidden = true; }, Number(state.settings.wordCardAutoCloseMs || 6000));
    safeRuntimeMessage({
      type: 'CMJ_TRANSLATE', text: clean,
      source: state.settings.sourceLanguage || 'auto', target: state.settings.targetLanguage || 'en',
      provider: state.settings.translationProvider || 'mymemory', libreUrl: state.settings.libreTranslateUrl || ''
    }).then(response => {
      const target = $('.cmj-word-translation');
      if (target) target.textContent = response?.ok ? response.translation : 'Translation unavailable';
    });
  }

  function closeWordCard() {
    const card = $('.cmj-word-card');
    if (card) card.hidden = true;
    clearTimeout(state.wordCardTimer);
  }

  function analyzeWord(word) {
    const source = state.settings.sourceLanguage || 'tr';
    const lower = word.toLocaleLowerCase(source.startsWith('tr') ? 'tr' : undefined);
    let pos = 'other';

    if (/^(i|you|he|she|we|they|me|him|her|us|them|ben|sen|o|biz|siz|onlar)$/i.test(lower)) pos = 'pronoun';
    else if (/^(the|a|an|bir|bu|şu|o)$/i.test(lower)) pos = 'determiner';
    else if (/^(and|or|but|because|ve|veya|ama|çünkü|fakat|ile)$/i.test(lower)) pos = 'conjunction';
    else if (/^(in|on|at|from|to|for|of|ile|için|den|dan|de|da)$/i.test(lower)) pos = source.startsWith('tr') ? 'particle' : 'preposition';
    else if (/^(very|really|quickly|slowly|çok|daha|en|hemen|şimdi|burada|orada|nasıl)$/i.test(lower)) pos = 'adverb';
    else if (/(mak|mek|yor|di|dı|du|dü|miş|mış|acak|ecek|abilir|ebilir|iyorum|ıyorum|uyorum|üyorum)$/i.test(lower)) pos = 'verb';
    else if (/(li|lı|lu|lü|siz|sız|suz|süz|sel|sal|ful|less|ous|ive|al)$/i.test(lower)) pos = 'adjective';
    else if (/^\d+(?:[.,]\d+)?$/.test(lower)) pos = 'numeral';
    else pos = lower.length <= 6 ? 'noun' : 'other';

    const common = COMMON[source?.split('-')[0]] || new Set();
    let cefr = common.has(lower) ? 'A1' : 'B1';
    if (lower.length >= 13) cefr = 'C1';
    else if (lower.length >= 10) cefr = 'B2';
    else if (lower.length >= 7 && !common.has(lower)) cefr = 'B1';
    else if (lower.length <= 4) cefr = 'A1';
    else if (lower.length <= 6) cefr = 'A2';

    const morphology = source.startsWith('tr') ? detectTurkishMorphology(word) : [];
    const grammarColors = { ...DEFAULTS.grammarColors, ...(state.settings.grammarColors || {}) };
    const posColor = grammarColors[pos] || POS[pos]?.color || grammarColors.other;
    return { pos, posLabel: POS[pos].label, color: posColor, posColor, cefr, morphology };
  }

  function detectTurkishMorphology(word) {
    const lower = String(word || '').toLocaleLowerCase('tr');
    const colors = { ...DEFAULTS.grammarColors, ...(state.settings.grammarColors || {}) };
    const rules = [
      { key: 'turkishCase', label: 'Turkish Case — Ablative', color: colors.turkishCase, re: /(den|dan|ten|tan)$/ },
      { key: 'turkishCase', label: 'Turkish Case — Locative', color: colors.turkishCase, re: /(de|da|te|ta)$/ },
      { key: 'turkishCase', label: 'Turkish Case — Dative', color: colors.turkishCase, re: /(ye|ya|e|a)$/ },
      { key: 'turkishCase', label: 'Turkish Case — Accusative', color: colors.turkishCase, re: /(yi|yı|yu|yü|i|ı|u|ü)$/ },
      { key: 'turkishCase', label: 'Turkish Case — Genitive', color: colors.turkishCase, re: /(nin|nın|nun|nün|ın|in|un|ün)$/ },
      { key: 'turkishPossessive', label: 'Turkish Possessive Suffix', color: colors.turkishPossessive, re: /(ımız|imiz|umuz|ümüz|ınız|iniz|unuz|ünüz|ım|im|um|üm|ın|in|un|ün)$/ },
      { key: 'turkishPlural', label: 'Turkish Plural Suffix', color: colors.turkishPlural, re: /(lar|ler)$/ },
      { key: 'turkishTense', label: 'Turkish Tense / Aspect Suffix', color: colors.turkishTense, re: /(iyor|ıyor|uyor|üyor|miş|mış|muş|müş|di|dı|du|dü|acak|ecek|ar|er)$/ },
      { key: 'turkishPerson', label: 'Turkish Person Suffix', color: colors.turkishPerson, re: /(im|ım|um|üm|sin|sın|sun|sün|iz|ız|uz|üz|siniz|sınız|sunuz|sünüz|lar|ler)$/ },
      { key: 'turkishSuffix', label: 'Turkish Suffix', color: colors.turkishSuffix, re: /(lik|lık|luk|lük|ci|cı|cu|cü|daş|taş|sel|sal|siz|sız|suz|süz|li|lı|lu|lü)$/ }
    ];
    return rules.filter(rule => rule.re.test(lower)).map(rule => ({ ...rule, suffix: lower.match(rule.re)?.[0] || '' }));
  }

  function getSentenceLevel(text) {
    const words = text.split(/\s+/).filter(Boolean).map(word => analyzeWord(word).cefr);
    const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return words.sort((a, b) => order.indexOf(b) - order.indexOf(a))[0] || 'A1';
  }

  async function saveCurrentSubtitle() {
    const current = getCurrentCaption();
    if (!current) return showToast('No active subtitle is available. Turn on CC.');
    const translation = state.translationCache[state.activeIndex] || await translateCurrent(true);
    const words = current.text.split(/\s+/).filter(Boolean).map(word => ({ word, ...analyzeWord(word) }));
    await saveVocabulary(current.text, { sentence: true, words }, translation || '');
    showToast('Sentence saved to your vocabulary library.');
  }

  async function saveVocabulary(word, info, translation) {
    const stored = await chrome.storage.local.get('vocabulary');
    const vocabulary = stored.vocabulary || [];
    const exists = vocabulary.some(item => item.word?.toLowerCase() === word.toLowerCase() && item.videoId === state.videoId && Math.abs((item.timestamp || 0) - (getVideo()?.currentTime || 0)) < 1.5);
    if (exists) return;

    vocabulary.push({
      id: crypto.randomUUID(),
      word,
      translation,
      lemma: word.toLocaleLowerCase(),
      pos: info.pos || 'sentence',
      level: info.cefr || getSentenceLevel(word),
      levelLabel: CEFR[info.cefr] || 'Learner',
      stage: 'New',
      sentence: getCurrentCaption()?.text || word,
      sentenceTranslation: state.translationCache[state.activeIndex] || '',
      videoId: state.videoId,
      videoTitle: state.title,
      url: state.url,
      timestamp: getVideo()?.currentTime || 0,
      source: 'Vocabulary',
      tags: ['YouTube', state.settings.sourceLanguage || 'language'],
      encounterKey: `${state.videoId}:${word.toLocaleLowerCase()}`,
      createdAt: new Date().toISOString()
    });
    await chrome.storage.local.set({ vocabulary });
  }

  async function saveBookmark() {
    const stored = await chrome.storage.local.get('bookmarks');
    const bookmarks = stored.bookmarks || [];
    const timestamp = getVideo()?.currentTime || 0;
    bookmarks.unshift({
      id: crypto.randomUUID(), title: state.title, videoTitle: state.title, url: state.url, videoId: state.videoId,
      thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(state.videoId)}/hqdefault.jpg`, source: 'Bookmarks',
      timestamp, subtitle: getCurrentCaption()?.text || '', translation: state.translationCache[state.activeIndex] || '',
      label: 'Learning moment', tags: ['YouTube', getSentenceLevel(getCurrentCaption()?.text || '')],
      createdAt: new Date().toISOString()
    });
    await chrome.storage.local.set({ bookmarks });
    showToast('Timeline bookmark saved.');
  }

  async function addWatchLater(explicitUrl = '', explicitTitle = '') {
    const url = explicitUrl || state.url || location.href;
    const videoId = extractVideoId(url) || state.videoId;
    if (!videoId) return showToast('Open a YouTube video first.');
    const stored = await chrome.storage.local.get('watchLater');
    const list = stored.watchLater || [];
    if (!list.some(item => item.videoId === videoId)) {
      list.unshift({
        id: crypto.randomUUID(), videoId, title: explicitTitle || state.title || getTitle(),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, source: 'Watch Later',
        level: 'Not assessed', tags: ['Watch Later'], progress: 0, addedAt: new Date().toISOString()
      });
      await chrome.storage.local.set({ watchLater: list });
      showToast('Added to Charlie MJ Watch Later.');
    } else showToast('This video is already in Watch Later.');
  }

  function extractVideoId(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1);
      return parsed.searchParams.get('v') || '';
    } catch { return ''; }
  }

  async function captureFrame() {
    const video = getVideo();
    if (!video) return showToast('YouTube video element not found.');
    const timestamp = Math.floor(video.currentTime);
    const folder = `${state.settings.downloadRoot || 'Charlie MJ Language'}/Screenshots/${sanitize(state.title)}`;
    const filename = `${folder}/${formatTime(timestamp).replaceAll(':', '-')}.png`;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      const result = await safeRuntimeMessage({ type: 'CMJ_DOWNLOAD_DATA', dataUrl, filename, mime: 'image/png' });
      if (!result?.ok) throw new Error(result?.error || 'download failed');
    } catch (error) {
      const result = await safeRuntimeMessage({ type: 'CMJ_CAPTURE_TAB', filename });
      if (!result?.ok) return showToast('Screenshot could not be captured.');
    }
    await saveBookmark();
    showToast(`Timeline capture saved at ${formatTime(timestamp)}.`);
  }

  function toggleSubtitleVisibility() {
    const layer = $('.cmj-subtitle-layer');
    if (layer) layer.classList.toggle('cmj-hidden');
  }

  function toggleFocusMode() {
    state.focusMode = !state.focusMode;
    state.settings.focusMode = state.focusMode;
    chrome.storage.local.set({ settings: state.settings });
    applyFocusMode();
    showToast(state.focusMode ? 'Focus Mode enabled.' : 'Focus Mode disabled.');
  }

  function applyFocusMode() {
    document.documentElement.classList.toggle('cmj-focus-mode', state.focusMode);
    const classMap = {
      'cmj-hide-recommendations': state.settings.hideRecommendations,
      'cmj-hide-shorts': state.settings.hideShorts,
      'cmj-hide-comments': state.settings.hideComments
    };
    for (const [name, enabled] of Object.entries(classMap)) document.documentElement.classList.toggle(name, Boolean(enabled && state.focusMode));
  }

  function openPanel(tab = 'transcript') {
    const panel = $('.cmj-panel');
    if (!panel) return;
    panel.hidden = false;
    state.panelTab = tab;
    renderPanel(tab).catch(error => console.warn('Charlie MJ panel error:', error));
  }

  function closePanel() {
    const panel = $('.cmj-panel');
    if (panel) panel.hidden = true;
  }

  async function renderPanel(tab) {
    const body = $('.cmj-panel-body');
    if (!body) return;
    state.panelTab = tab;

    if (tab === 'transcript') {
      body.innerHTML = `<div class="cmj-export-row">
        <button data-cmj-export="both">📋 Copy complete</button>
        <button data-cmj-export="txt">⬇ TXT</button>
        <button data-cmj-export="json">JSON</button>
        <button data-cmj-export="srt">SRT</button>
        <button data-cmj-export="vtt">VTT</button>
      </div>
      <div class="cmj-panel-note">${state.captions.length ? `${state.captions.length} subtitle segments · ${escapeHTML(state.title)}` : 'Waiting for YouTube captions…'}</div>
      <div class="cmj-transcript-list">${state.captions.map((caption, index) => `<button class="cmj-line" data-cmj-line="${index}"><time>${formatTime(caption.start)}</time><span>${escapeHTML(caption.text)}</span><small>${escapeHTML(state.translationCache[index] || '')}</small></button>`).join('')}</div>`;
      return;
    }

    if (tab === 'notes') {
      const notes = await getVideoNotes();
      body.innerHTML = `<div class="cmj-notes-toolbar"><button data-cmj-note-action="add">＋ Text box</button><button data-cmj-note-action="bold"><b>B</b></button><button data-cmj-note-action="size-up">A＋</button><button data-cmj-note-action="size-down">A−</button><button data-cmj-note-action="bullet">• List</button><button data-cmj-note-action="save">💾 Save</button></div><p class="cmj-panel-note">Notes are saved locally and linked to <strong>${escapeHTML(state.title)}</strong>.</p><div class="cmj-notes-list">${notes.map((note,index)=>`<article class="cmj-note-box" data-note-id="${escapeHTML(note.id)}"><div class="cmj-note-head"><span>Note ${index+1}</span><button data-cmj-note-action="delete" data-note-id="${escapeHTML(note.id)}">🗑</button></div><div class="cmj-note-editor" contenteditable="true" data-note-editor="${escapeHTML(note.id)}">${note.html || ''}</div></article>`).join('')}</div>`;
      if (!notes.length) body.querySelector('.cmj-notes-list').innerHTML = '<p class="cmj-empty">No notes yet. Add a text box to start.</p>';
      return;
    }

    const dataKey = tab === 'vocabulary' ? 'vocabulary' : tab;
    const stored = await chrome.storage.local.get(dataKey);
    const data = stored[dataKey] || [];
    body.innerHTML = data.length
      ? data.slice(0, 200).map(item => {
          const title = item.videoTitle || item.title || 'Untitled video';
          const action = tab === 'watchLater' && item.url ? `<button class="cmj-card-open" data-cmj-open-url="${escapeHTML(item.url)}">▶ Open in new tab</button>` : '';
          return `<article class="cmj-card"><strong>${escapeHTML(item.word || item.title || '')}</strong><span>${escapeHTML(item.translation || item.subtitle || item.label || '')}</span><small>${escapeHTML(title)} · ${escapeHTML(item.level || '')} · ${escapeHTML((item.tags || []).join(' #'))}</small>${action}</article>`;
        }).join('')
      : '<p class="cmj-empty">Nothing saved here yet.</p>';
  }

  async function getVideoNotes() {
    const stored = await chrome.storage.local.get('notesByVideo');
    return stored.notesByVideo?.[state.videoId] || [];
  }

  async function saveVideoNotes(notes) {
    const stored = await chrome.storage.local.get('notesByVideo');
    const all = stored.notesByVideo || {};
    all[state.videoId] = notes;
    await chrome.storage.local.set({ notesByVideo: all });
  }

  function onRootInput(event) {
    const editor = event.target.closest('.cmj-note-editor');
    if (!editor) return;
    clearTimeout(state.notesSaveTimer);
    state.notesSaveTimer = setTimeout(async () => {
      const notes = await getVideoNotes();
      const note = notes.find(item => item.id === editor.dataset.noteEditor);
      if (!note) return;
      note.html = editor.innerHTML;
      note.updatedAt = new Date().toISOString();
      await saveVideoNotes(notes);
    }, 650);
  }

  async function handleNoteAction(action, button) {
    let notes = await getVideoNotes();
    if (action === 'add') {
      notes.push({ id: crypto.randomUUID(), html: '<p>Write your note here…</p>', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      await saveVideoNotes(notes); renderPanel('notes'); return;
    }
    if (action === 'delete') {
      const id = button?.dataset.noteId;
      notes = notes.filter(note => note.id !== id); await saveVideoNotes(notes); renderPanel('notes'); return;
    }
    if (action === 'save') {
      $$('.cmj-note-editor').forEach(editor => { const note = notes.find(item => item.id === editor.dataset.noteEditor); if (note) { note.html = editor.innerHTML; note.updatedAt = new Date().toISOString(); } });
      await saveVideoNotes(notes); showToast('Notes saved for this video.'); return;
    }
    if (['bold','size-up','size-down','bullet'].includes(action)) {
      document.execCommand(action === 'bold' ? 'bold' : action === 'bullet' ? 'insertUnorderedList' : 'fontSize', false, action === 'size-up' ? '5' : action === 'size-down' ? '2' : undefined);
    }
  }

  function renderPanelIfOpen() {
    if (!$('.cmj-panel') || $('.cmj-panel').hidden) return;
    renderPanel(state.panelTab).catch(() => {});
  }

  async function downloadTranscript(mode = 'both') {
    if (!state.captions.length) return showToast('No transcript is loaded. Turn on CC and reload the video.');
    showToast('Preparing complete transcript with translations…');

    for (let index = 0; index < state.captions.length; index += 1) {
      if (state.translationCache[index]) continue;
      try {
        const result = await safeRuntimeMessage({
          type: 'CMJ_TRANSLATE', text: state.captions[index].text,
          source: state.settings.sourceLanguage || 'auto', target: state.settings.targetLanguage || 'en',
          provider: state.settings.translationProvider || 'mymemory', libreUrl: state.settings.libreTranslateUrl || ''
        });
        if (result?.ok) state.translationCache[index] = result.translation;
      } catch (error) {
        console.warn('Transcript translation failed:', error);
      }
      if (index % 5 === 0) await wait(25);
    }

    const translations = state.captions.map((_, index) => state.translationCache[index] || '');
    let payload;
    let extension;
    let mime;

    const learningData = await getCurrentVideoLearningData();
    if (mode === 'json') {
      payload = JSON.stringify({
        program: 'Charlie MJ Language', type: 'Complete video learning package', title: state.title, url: state.url, videoId: state.videoId,
        sourceLanguage: state.settings.sourceLanguage, targetLanguage: state.settings.targetLanguage,
        captions: state.captions.map((caption, index) => ({ ...caption, translation: translations[index] })),
        vocabulary: learningData.vocabulary, bookmarks: learningData.bookmarks, notes: learningData.notes
      }, null, 2);
      extension = 'json'; mime = 'application/json';
    } else if (mode === 'srt' || mode === 'vtt') {
      const lines = state.captions.map((caption, index) => {
        const end = caption.start + Math.max(caption.duration, 2);
        const time = mode === 'srt' ? `${srtTime(caption.start)} --> ${srtTime(end)}` : `${vttTime(caption.start)} --> ${vttTime(end)}`;
        return `${index + 1}\n${time}\n${caption.text}\n${translations[index] || ''}`;
      });
      payload = (mode === 'vtt' ? 'WEBVTT\n\n' : '') + lines.join('\n\n');
      extension = mode; mime = mode === 'srt' ? 'application/x-subrip' : 'text/vtt';
    } else {
      payload = buildVideoLearningText(translations, learningData);
      extension = 'txt'; mime = 'text/plain';
    }

    const filename = `${state.settings.downloadRoot || 'Charlie MJ Language'}/Transcripts/${sanitize(state.title)}/complete-transcript-with-translation.${extension}`;
    const result = await safeRuntimeMessage({ type: 'CMJ_DOWNLOAD_DATA', text: payload, filename, mime });
    showToast(result?.ok ? 'Complete transcript export started.' : 'Transcript download failed.');
  }

  async function downloadVocabulary() {
    const stored = await chrome.storage.local.get('vocabulary');
    const items = (stored.vocabulary || []).filter(item => item.videoId === state.videoId);
    const rows = ['word,translation,level,levelLabel,pos,sentence,video,timestamp,tags'];
    for (const item of items) rows.push([item.word, item.translation, item.level, item.levelLabel, item.pos, item.sentence, item.videoTitle, item.timestamp, (item.tags || []).join('|')].map(csv).join(','));
    const filename = `${state.settings.downloadRoot || 'Charlie MJ Language'}/Vocabulary/${sanitize(state.title)}/custom-vocabulary-with-translation.csv`;
    const result = await safeRuntimeMessage({ type: 'CMJ_DOWNLOAD_DATA', text: rows.join('\n'), filename, mime: 'text/csv' });
    showToast(result?.ok ? 'Custom vocabulary export started.' : 'Vocabulary download failed.');
  }

  async function getCurrentVideoLearningData() {
    const stored = await chrome.storage.local.get(['vocabulary','bookmarks','notesByVideo']);
    return {
      vocabulary: (stored.vocabulary || []).filter(item => item.videoId === state.videoId),
      bookmarks: (stored.bookmarks || []).filter(item => item.videoId === state.videoId),
      notes: stored.notesByVideo?.[state.videoId] || []
    };
  }

  function buildVideoLearningText(translations, learningData) {
    const lines = [`Charlie MJ Language — Complete Video Learning Package`, `Title: ${state.title}`, `URL: ${state.url}`, `Video ID: ${state.videoId}`, `Source language: ${state.settings.sourceLanguage}`, `Target language: ${state.settings.targetLanguage}`, '', 'COMPLETE TRANSCRIPT WITH TRANSLATION', ''];
    state.captions.forEach((caption,index) => lines.push(`[${formatTime(caption.start)}]`, stripYouTubeCaptionArtifacts(caption.text), `Translation: ${stripYouTubeCaptionArtifacts(translations[index] || '(translation unavailable)')}`, ''));
    lines.push('', `VOCABULARY FROM: ${state.title}`, '');
    if (learningData.vocabulary.length) learningData.vocabulary.forEach(item => lines.push(`• ${item.word} — ${item.translation || ''}`, `  Level: ${item.level || ''} ${item.levelLabel || ''}`, `  POS: ${item.pos || ''}`, `  Sentence: ${item.sentence || ''}`, `  Timestamp: ${formatTime(item.timestamp || 0)}`, `  Tags: ${(item.tags || []).join(', ')}`, '')); else lines.push('No vocabulary saved for this video.', '');
    lines.push(`BOOKMARKS FROM: ${state.title}`, '');
    if (learningData.bookmarks.length) learningData.bookmarks.forEach(item => lines.push(`• ${item.label || 'Learning moment'} — ${formatTime(item.timestamp || 0)}`, `  Subtitle: ${item.subtitle || ''}`, `  Translation: ${item.translation || ''}`, `  Tags: ${(item.tags || []).join(', ')}`, '')); else lines.push('No bookmarks saved for this video.', '');
    lines.push(`NOTES FROM: ${state.title}`, '');
    if (learningData.notes.length) learningData.notes.forEach((note,index) => lines.push(`Note ${index+1}:`, stripHTML(note.html || ''), '')); else lines.push('No notes saved for this video.');
    return lines.join('\n');
  }

  async function buildCompleteTranscriptText() {
    const learningData = await getCurrentVideoLearningData();
    return buildVideoLearningText(state.captions.map((_,index)=>stripYouTubeCaptionArtifacts(state.translationCache[index] || '')), learningData);
  }

  async function copyCompleteTranscript() {
    await navigator.clipboard.writeText(await buildCompleteTranscriptText());
    showToast('Complete transcript copied.');
  }

  async function showLearningReport() {
    const stored = await chrome.storage.local.get('vocabulary');
    const videoWords = (stored.vocabulary || []).filter(item => item.videoId === state.videoId);
    showToast(`Learning report: ${state.captions.length} subtitle segments · ${videoWords.length} saved vocabulary items.`);
  }

  function injectYouTubeWatchLaterItem() {
    if (!isWatchPage()) return;
    const menus = $$('ytd-menu-popup-renderer tp-yt-paper-listbox, ytd-menu-popup-renderer [role="menu"], ytd-menu-popup-renderer');
    for (const menu of menus) {
      if (menu.querySelector('.cmj-youtube-menu-item')) continue;
      const rect = menu.getBoundingClientRect?.();
      if (rect && (rect.width === 0 || rect.height === 0)) continue;

      const item = document.createElement('tp-yt-paper-item');
      item.className = 'cmj-youtube-menu-item';
      item.setAttribute('role', 'menuitem');
      item.tabIndex = 0;
      item.innerHTML = '<span class="cmj-youtube-menu-icon">🌍</span><span>Charlie MJ — Add to Watch Later</span>';
      const activate = event => {
        event.preventDefault();
        event.stopPropagation();
        addWatchLater();
        item.remove();
      };
      item.addEventListener('click', activate);
      item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') activate(event);
      });
      menu.prepend(item);
    }
  }

  function readNativeCaptions() {
    const segments = $$('.ytp-caption-segment');
    if (!segments.length) return;
    const text = segments.map(segment => segment.textContent?.trim()).filter(Boolean).join(' ');
    if (text && text !== state.nativeCaptionText) {
      state.nativeCaptionText = text;
      // The native player is a reliable last-resort live subtitle signal. If a
      // caption track was not available yet, create a single live segment so
      // word translation still works instead of leaving the extension blank.
      if (!state.captions.length) {
        const video = getVideo();
        state.captions = [{ start: video?.currentTime || 0, duration: 2, text }];
        state.activeIndex = 0;
        renderCurrentSubtitle();
      }
    }
  }

  function seek(index) {
    const caption = state.captions[index];
    const video = getVideo();
    if (caption && video) {
      video.currentTime = caption.start;
      video.play().catch(() => {});
      closePanel();
    }
  }

  function onShortcut(event) {
    if (!event.altKey || !event.shiftKey) return;
    if (event.code === 'KeyF') { event.preventDefault(); toggleFocusMode(); }
    if (event.code === 'KeyS') { event.preventDefault(); saveCurrentSubtitle(); }
  }

  async function onMessage(message) {
    if (!message?.type) return;
    if (message.type === 'CMJ_TOGGLE_FOCUS') toggleFocusMode();
    if (message.type === 'CMJ_SAVE_CURRENT') await saveCurrentSubtitle();
    if (message.type === 'CMJ_BOOKMARK') await saveBookmark();
    if (message.type === 'CMJ_ADD_WATCH_LATER') await addWatchLater(message.url || '', message.title || '');
    if (message.type === 'CMJ_OPEN_PANEL') openPanel('transcript');
    if (message.type === 'CMJ_SAVE_TEXT' && message.text) {
      await saveVocabulary(message.text, analyzeWord(message.text), '');
      showToast('Selected text saved to vocabulary.');
    }
    if (message.type === 'CMJ_COPY_TRANSCRIPT') await copyCompleteTranscript();
  }

  async function safeRuntimeMessage(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.warn('Charlie MJ runtime message failed:', error);
      return { ok: false, error: error.message || 'Extension background unavailable.' };
    }
  }

  function showToast(message) {
    const toast = $('.cmj-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function formatTime(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    const s = value % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function srtTime(seconds) {
    const total = Math.floor(seconds);
    const ms = Math.floor((seconds - total) * 1000);
    return `${formatTime(total)},${String(ms).padStart(3, '0')}`;
  }

  function vttTime(seconds) { return srtTime(seconds).replace(',', '.'); }
  function sanitize(value) { return String(value || 'video').replace(/[\\/:*?"<>|]/g, '_').slice(0, 100); }
  function csv(value) { return `"${String(value ?? '').replaceAll('"', '""')}"`; }
  function stripHTML(value) { const box = document.createElement('div'); box.innerHTML = String(value || ''); return box.textContent || ''; }
  function escapeHTML(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
})();
