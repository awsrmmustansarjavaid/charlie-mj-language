/**
 * Charlie MJ Language - YouTube learning engine v4.0.0.
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
    translationSourceCache: {},
    youtubeTargetCaptionCache: {},
    youtubeOriginalCaptions: [],
    youtubeTranslationTracks: {},
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
    sentenceReplayCount: 1,
    abRange: null,
    studyMode: false,
    lastProgressWrite: 0,
    resumeAppliedFor: '',
    sessionStartedAt: Date.now(),
    sessionSeconds: 0
  };

  const DEFAULTS = {
    sourceLanguage: 'tr',
    targetLanguage: 'en',
    translationProvider: 'youtube-first',
    translationProviderPriority: ['youtube-captions','google','microsoft','mymemory','libretranslate'],
    enabledTranslationProviders: {google:false,microsoft:false,deepl:false,mymemory:false,libretranslate:false,argos:false},
    translationApiKeys: {google:'',microsoft:'',deepl:''},
    microsoftRegion: '',
    libreTranslateUrl: '',
    argosUrl: '',
    argosModels: [],
    onlineOnly: false,
    offlineOnly: false,
    onlineOfflineFallback: true,
    privacyMode: false,
    translationCache: true,
    verificationMode: false,
    translationTimeoutMs: 5000,
    translationRetries: 1,
    maxTranslationLength: 2000,
    dictionaryEnabled: true,
    dictionaryEndpoint: 'https://api.dictionaryapi.dev/api/v2/entries',
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
    toolbarRevealMode: 'hover',
    toolbarDefaultX: 50, toolbarDefaultY: 2, toolbarHeight: 45, toolbarHorizontalAnchor: 'center', toolbarVerticalAnchor: 'bottom', toolbarOffsetX: 0, toolbarOffsetY: 2, toolbarPositionMode: 'default', toolbarOverflowMode: 'auto',
    toolbarPosition: { leftPx: null, topPx: null, left: null, top: null, bottom: 2 },
    toolbarHoverZonePx: 140,
    toolbarDragAnywhere: true,
    toolbarSnap: 'free',
    toolbarAutoHideDelayMs: 15000,
    toolbarScale: 1,
    toolbarWidth: 905,
    subtitleDefaultX: 50, subtitleDefaultY: 11, subtitleWidth: 760, subtitleWidthPercent: 60, subtitleHorizontalAnchor: 'center', subtitleVerticalAnchor: 'bottom', subtitleOffsetX: 0, subtitleOffsetY: 11, subtitleMoveHideDelayMs: 1800, subtitlePositionMode: 'bottom', subtitleUIFontSize: 28, subtitleMaxWidth: 1100, subtitleTextColor: '#ffffff', subtitleBackgroundColor: '#000000', subtitleOpacity: 65,
    subtitleDragEnabled: true,
    subtitlePosition: { leftPx: null, topPx: null, left: null, top: null, bottom: 11 },
    successPopupPosition: 'subtitle-center', transcriptServiceEngine: 'legacy-youtube', captionTrackPreference: 'original-first', enableCaptionLanguageDiscovery: true,
    transcriptDefaultX: 98, transcriptDefaultY: 12, transcriptUIWidth: 300, transcriptUIHeight: 545, transcriptHorizontalAnchor: 'right', transcriptPositionMode: 'default', transcriptVerticalAnchor: 'top', transcriptOffsetX: 2, transcriptOffsetY: 12, transcriptControlHideDelayMs: 15000, transcriptAutoHideDelayMs: 15000, transcriptHoverZonePx: 120,
    transcriptWindowWidth: 300,
    transcriptWindowHeight: 545,
    transcriptWindowMinWidth: 220,
    transcriptWindowMaxWidth: 1000,
    transcriptWindowMinHeight: 220,
    transcriptWindowMaxHeight: 900,
    transcriptWindowPosition: { leftPx: null, topPx: null, right: 2, bottom: null, left: null, top: 12 },
    transcriptPinned: false,
    theme: 'dark',
    subtitlePreloadTranslations: 2,
    subtitleDisplayMode: 'both',
    originalFontSize: 28,
    translationFontSize: 22,
    originalBold: true,
    translationBold: false,
    originalUnderline: false,
    translationUnderline: false,
    originalItalic: false,
    translationItalic: false,
    originalColor: '#ffffff',
    translationColor: '#e2e8f0',
    sentenceShowLevel: true,
    sentenceDifficulty: 'auto',
    autoPauseAfterSubtitle: false,
    replayCount: 1,
    playbackSpeed: 1,
    subtitleGrammarColorsEnabled: true, transcriptGrammarColorsEnabled: true,
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
  let contextInvalidToastShown = false;
  function extensionContextAlive() {
    try { return Boolean(chrome && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local); }
    catch (_) { return false; }
  }
  function isContextInvalidError(error) { return /extension context invalidated|context invalidated|message port closed/i.test(String(error?.message || error || '')); }
  function reportContextError(error) {
    if (!isContextInvalidError(error)) { console.warn('Charlie MJ action failed:', error); return; }
    if (!contextInvalidToastShown) {
      contextInvalidToastShown = true;
      showToast('Extension was updated or reloaded. Refresh this YouTube page to reconnect Charlie MJ Language.');
      console.warn('Charlie MJ: extension context invalidated; refresh the YouTube page after updating the extension.');
    }
  }
  async function storageGet(keys) {
    if (!extensionContextAlive()) { reportContextError(new Error('Extension context invalidated.')); return {}; }
    try { return await chrome.storage.local.get(keys); } catch (error) { reportContextError(error); return {}; }
  }
  async function storageSet(values) {
    if (!extensionContextAlive()) { reportContextError(new Error('Extension context invalidated.')); return false; }
    try { await chrome.storage.local.set(values); return true; } catch (error) { reportContextError(error); return false; }
  }

  init().catch(error => { reportContextError(error); if (!isContextInvalidError(error)) console.warn('Charlie MJ Language initialisation failed:', error); });

  async function init() {
    const stored = await storageGet('settings');
    state.settings = { ...DEFAULTS, ...(stored.settings || {}) };
    state.focusMode = Boolean(state.settings.focusMode);
    state.studyMode = Boolean(state.settings.studyModeDefault);
    const saved=stored.settings||{};
    // One-time migration: older releases defaulted to 'always', which prevented the promised auto-hide.
    if (!saved.toolbarRevealModeMigrationV432) {
      if (!saved.toolbarRevealMode || saved.toolbarRevealMode === 'always') state.settings.toolbarRevealMode = 'hover';
      state.settings.toolbarRevealModeMigrationV432 = true;
      await storageSet({ settings: state.settings });
    }
    const oldToolbar=saved.toolbarPosition||{};
    const oldSubtitle=saved.subtitlePosition||{};
    const oldTranscript=saved.transcriptWindowPosition||{};
    const toolbarHasPixelDrag=(saved.toolbarPositionMode==='custom') && (Number.isFinite(Number(oldToolbar.leftPx)) || Number.isFinite(Number(oldToolbar.topPx)));
    const subtitleHasPixelDrag=(saved.subtitlePositionMode==='custom') && (Number.isFinite(Number(oldSubtitle.leftPx)) || Number.isFinite(Number(oldSubtitle.topPx)));
    const transcriptHasPixelDrag=(saved.transcriptPositionMode==='custom') && (Number.isFinite(Number(oldTranscript.leftPx)) || Number.isFinite(Number(oldTranscript.topPx)));
    state.settings.toolbarPositionMode = toolbarHasPixelDrag ? 'custom' : 'default';
    state.settings.subtitlePositionMode = subtitleHasPixelDrag ? 'custom' : (saved.subtitlePositionMode || 'bottom');
    state.settings.transcriptPositionMode = transcriptHasPixelDrag ? 'custom' : 'default';
    state.settings.toolbarPosition = toolbarHasPixelDrag ? { ...DEFAULTS.toolbarPosition, ...oldToolbar } : { ...DEFAULTS.toolbarPosition };
    state.settings.subtitlePosition = subtitleHasPixelDrag ? { ...DEFAULTS.subtitlePosition, ...oldSubtitle } : { ...DEFAULTS.subtitlePosition };
    state.settings.transcriptWindowPosition = transcriptHasPixelDrag ? { ...DEFAULTS.transcriptWindowPosition, ...oldTranscript } : { ...DEFAULTS.transcriptWindowPosition };
    state.settings.transcriptWindowWidth = Number(saved.transcriptWindowWidth||0)===520 ? 300 : Number(saved.transcriptWindowWidth||300);
    state.settings.transcriptWindowHeight = Number(saved.transcriptWindowHeight||0)===680 ? 545 : Number(saved.transcriptWindowHeight||545);
    state.settings.transcriptWindowMinWidth = Math.max(220,Number(saved.transcriptWindowMinWidth||220));
    state.settings.transcriptWindowMinHeight = Math.max(220,Number(saved.transcriptWindowMinHeight||220));

    document.addEventListener(EVENT_NAME, onPlayerResponse);
    document.addEventListener(EVENT_NAME + '-data', onCaptionData);
    document.addEventListener(DATA_EVENT, onCaptionData);
    chrome.runtime.onMessage.addListener(onMessage);
    window.addEventListener('keydown', onShortcut, true);
    chrome.storage.onChanged.addListener(onSettingsChanged);
    window.addEventListener('pagehide', () => { saveLearningProgress(true).catch(() => {}); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) saveLearningProgress(true).catch(() => {}); });

    installObservers();
    routeChanged();
    setInterval(routeChanged, 1000);
    startSubtitleSyncLoop();
    setInterval(injectYouTubeWatchLaterItem, 1500);
  }

  function startSubtitleSyncLoop() {
    if (state.syncFrame) return;
    const tick = () => {
      if (isWatchPage()) {
        const now = performance.now();
        const interval = Math.max(40, Number(state.settings.captionSyncIntervalMs || 80));
        if (now - (state.lastSyncAt || 0) >= interval) {
          state.lastSyncAt = now;
          updatePlayback();
        }
      }
      state.syncFrame = setTimeout(tick, Math.max(40, Number(state.settings.captionSyncIntervalMs || 80)));
    };
    state.syncFrame = setTimeout(tick, 80);
  }

  /** React immediately when the learner changes display/download preferences. */
  async function onSettingsChanged(changes, area) {
    if (area !== 'local' || !changes.settings?.newValue) return;
    const previous = state.settings;
    state.settings = { ...DEFAULTS, ...changes.settings.newValue, toolbarPosition: { ...DEFAULTS.toolbarPosition, ...(changes.settings.newValue.toolbarPosition || {}) },
      subtitlePosition: { ...DEFAULTS.subtitlePosition, ...(changes.settings.newValue.subtitlePosition || {}) },
      transcriptWindowPosition: { ...DEFAULTS.transcriptWindowPosition, ...(changes.settings.newValue.transcriptWindowPosition || {}) } };
    if (previous.sourceLanguage !== state.settings.sourceLanguage || previous.targetLanguage !== state.settings.targetLanguage) {
      state.youtubeTranslationTracks = {};
      state.translationCache = {};
      await fetchYouTubeCaptionBundle();
      prefetchTranslations(0, Number(state.settings.subtitlePreloadTranslations || 2)).catch(()=>{});
    }
    state.focusMode = Boolean(state.settings.focusMode);
    ensureUI();
    applySubtitlePosition($('.cmj-subtitle-layer'));
    applyTranscriptWindow($('.cmj-panel'));
    const existingHost = document.getElementById(PLAYER_HOST_ID);
    if (existingHost) { applyToolbarPosition(existingHost); applyToolbarRevealMode(document.querySelector('#movie_player'), existingHost); updateToolbarOverflow(existingHost); }
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
      saveTranscriptRecord().catch(() => {});
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
    state.translationSourceCache = {};
    state.youtubeTargetCaptionCache = {};
    state.youtubeOriginalCaptions = [];
    state.youtubeTranslationTracks = {};
    state.nativeCaptionText = '';
    state.lastProgressWrite = 0;
    state.resumeAppliedFor = '';
    state.sessionStartedAt = Date.now();
    state.sessionSeconds = 0;

    applyFocusMode();
    showToast('Charlie MJ Language is fetching subtitles…');
    if (state.settings.captionAutoFetch !== false) {
      await bootstrapCaptionDiscovery();
    }
    readNativeCaptions();
    await registerVideoHistory();
    await resumeSavedLearningState();
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

  function requestBridgeCaptionBundle(){
    return new Promise(resolve=>{
      const requestId=crypto.randomUUID();
      const timeout=setTimeout(()=>{document.removeEventListener('cmj-youtube-caption-bundle-data',onData,true);resolve({ok:false,error:'Bridge timeout'});},6500);
      const onData=event=>{
        try{
          const payload=JSON.parse(event.detail||'{}');
          if(payload.requestId!==requestId)return;
          clearTimeout(timeout);document.removeEventListener('cmj-youtube-caption-bundle-data',onData,true);resolve(payload);
        }catch(_){ }
      };
      document.addEventListener('cmj-youtube-caption-bundle-data',onData,true);
      document.dispatchEvent(new CustomEvent('cmj-youtube-request-caption-bundle',{detail:{requestId,source:state.settings.sourceLanguage||'auto',target:state.settings.targetLanguage||'en'}}));
    });
  }

  async function applyYouTubeBundleResult(result){
    if(!result?.ok)return false;
    if(Array.isArray(result.tracks)&&result.tracks.length)state.tracks=normaliseTracks(result.tracks);
    if(Array.isArray(result.original)&&result.original.length){
      state.youtubeOriginalCaptions=mergeCaptionSegments(result.original.map(x=>({...x,text:cleanText(x.text)})));
      state.captions=state.youtubeOriginalCaptions.slice();
    }
    if(Array.isArray(result.translation)&&result.translation.length){
      const key=String(state.settings.targetLanguage||'en').split('-')[0].toLowerCase();
      state.youtubeTranslationTracks[key]=mergeCaptionSegments(result.translation.map(x=>({...x,text:cleanText(x.text)})));
      state.translationSourceCache.__youtube=result.translationSource||'YouTube Auto-Translation';
    }
    if(state.captions.length){
      state.activeIndex=-1;state.lastCaptionKey='';renderCurrentSubtitle();renderPanelIfOpen();saveTranscriptRecord().catch(()=>{});
    }
    return Boolean(state.captions.length);
  }

  async function fetchYouTubeCaptionBundle(){
    const videoId=getVideoId();if(!videoId)return false;
    try{
      // Primary: execute inside the real YouTube page. This preserves the
      // user's YouTube session/cookies and lets us reuse YouTube's own
      // player/session context instead of making an anonymous extension fetch.
      const bridge=await requestBridgeCaptionBundle();
      if(await applyYouTubeBundleResult(bridge))return true;
      // Secondary: service-worker InnerTube cascade. Kept as an independent
      // fallback in case the MAIN-world page hooks are blocked by a player build.
      const result=await chrome.runtime.sendMessage({type:'CMJ_YOUTUBE_CAPTIONS',videoId,source:state.settings.sourceLanguage||'auto',target:state.settings.targetLanguage||'en',mode:'bundle'});
      if(await applyYouTubeBundleResult(result))return true;
    }catch(error){}
    return Boolean(state.captions.length);
  }

  async function bootstrapCaptionDiscovery() {
    const started = performance.now();
    // Always acquire the learner's ORIGINAL/source-language track separately
    // from translation tracks. This prevents English target captions from
    // replacing the original Turkish line.
    const bundleOk = await fetchYouTubeCaptionBundle();
    requestBridgeOriginalCaptions(state.settings.sourceLanguage || 'tr').catch(()=>{});
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
      installSubtitleInteractions(root);
    installTranscriptPanelInteractions(root);
    applySubtitlePosition($('.cmj-subtitle-layer', root));
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

    // Keep the user's configured learning/source language stable. A caption
    // track is data, not a reason to silently change the setting.

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
          saveTranscriptRecord().catch(() => {});
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
    const result=[];const raw=String(text||'').trim();if(!raw)return result;
    if(raw.startsWith('{')){
      try{const json=JSON.parse(raw);for(const event of json.events||[]){const value=(event.segs||[]).map(segment=>segment.utf8||'').join('');if(value.trim())result.push({start:(event.tStartMs||0)/1000,duration:(event.dDurationMs||0)/1000,text:cleanText(value)});}return result;}catch(error){console.warn('Charlie MJ JSON caption parsing failed:',error);}
    }
    const decode=value=>String(value||'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
    const re=/<text\b([^>]*)>([\s\S]*?)<\/text>/gi;let match;
    while((match=re.exec(raw))){const attrs=match[1]||'';const body=decode(match[2].replace(/<[^>]+>/g,''));const value=cleanText(body);if(!value)continue;const attr=name=>{const pattern=`\\b${name}=(?:"([^"]*)"|'([^']*)')`;const m=attrs.match(new RegExp(pattern));return m?(m[1]??m[2]??''):''};result.push({start:Number(attr('start')||0),duration:Number(attr('dur')||0),text:value});}
    return result;
  }


  function requestBridgeYouTubeTranslation(targetLanguage){
    return new Promise(resolve=>{
      const requestId=crypto.randomUUID();
      const timeout=setTimeout(()=>{document.removeEventListener('cmj-youtube-translated-caption-data',onData,true);resolve({captions:[],source:''})},3200);
      const onData=event=>{
        try{
          const payload=JSON.parse(event.detail||'{}');
          if(payload.requestId && payload.requestId!==requestId) return;
          if(String(payload.targetLanguage||'')!==String(targetLanguage).split('-')[0]) return;
          clearTimeout(timeout);document.removeEventListener('cmj-youtube-translated-caption-data',onData,true);resolve({captions:Array.isArray(payload.captions)?payload.captions:[],source:payload.source||'YouTube Auto-Translation'});
        }catch(_){ }
      };
      document.addEventListener('cmj-youtube-translated-caption-data',onData,true);
      document.dispatchEvent(new CustomEvent('cmj-youtube-request-translation',{detail:{requestId,targetLanguage,sourceLanguage:state.settings.sourceLanguage||'',mode:'translation'}}));
    });
  }

  function requestBridgeOriginalCaptions(sourceLanguage){
    return new Promise(resolve=>{
      const timeout=setTimeout(()=>{document.removeEventListener(DATA_EVENT,onData,true);resolve(false)},3200);
      const onData=event=>{
        try{
          const payload=JSON.parse(event.detail||'{}');
          if(payload.mode!=='original') return;
          if(sourceLanguage && payload.languageCode && String(payload.languageCode).split('-')[0]!==String(sourceLanguage).split('-')[0]) return;
          clearTimeout(timeout);document.removeEventListener(DATA_EVENT,onData,true);
          if(Array.isArray(payload.captions)&&payload.captions.length){
            state.captions=mergeCaptionSegments(payload.captions.map(item=>({...item,text:cleanText(item.text)})));
            state.activeIndex=-1; state.lastCaptionKey=''; renderCurrentSubtitle(); renderPanelIfOpen();
            if(state.settings.autoTranslate) prefetchTranslations(0,Number(state.settings.subtitlePreloadTranslations||2));
            resolve(true);
          } else resolve(false);
        }catch(_){ }
      };
      document.addEventListener(DATA_EVENT,onData,true);
      document.dispatchEvent(new CustomEvent('cmj-youtube-request-translation',{detail:{requestId:'original-'+crypto.randomUUID(),targetLanguage:'',sourceLanguage,mode:'original'}}));
    });
  }

  async function getYouTubeTargetSubtitle(caption){
    const target=String(state.settings.targetLanguage||'en').toLowerCase();
    const source=String(state.settings.sourceLanguage||'auto').toLowerCase();
    if(!target || target==='auto' || (source!=='auto' && target===source)) return '';
    const baseLang=target.split('-')[0];
    const time=Number(caption?.start||0);
    const matchAtTime=rows=>rows.find(x=>time>=x.start-0.6 && time<=x.start+Math.max(0.7,Number(x.duration||2)+0.6));
    let rows=state.youtubeTranslationTracks[baseLang] || [];
    if(!rows.length){
      const ok=await fetchYouTubeCaptionBundle();
      rows=state.youtubeTranslationTracks[baseLang] || [];
      if(!ok && !rows.length) {
        const bridge=await requestBridgeYouTubeTranslation(baseLang).catch(()=>null);
        rows=bridge?.captions||[];
      }
    }
    const match=matchAtTime(rows);
    if(match?.text){ state.translationSourceCache[state.activeIndex]=state.translationSourceCache.__youtube||'YouTube Auto-Translation'; return match.text; }
    return '';
  }

  function mergeCaptionSegments(segments) {
    const sorted = (Array.isArray(segments) ? segments : [])
      .map(segment => ({
        start: Math.max(0, Number(segment?.start || 0)),
        duration: Math.max(0, Number(segment?.duration || 0)),
        text: cleanText(segment?.text || '')
      }))
      .filter(segment => segment.text)
      .sort((a, b) => a.start - b.start);

    const deduped = [];
    for (const segment of sorted) {
      const previous = deduped[deduped.length - 1];
      if (previous && Math.abs(previous.start - segment.start) < 0.12 && previous.text === segment.text) {
        previous.duration = Math.max(previous.duration, segment.duration);
        continue;
      }
      deduped.push(segment);
    }
    if (deduped.length < 2) return deduped;

    // Some YouTube player builds expose the timed-text track as dense
    // word/phrase cues instead of sentence-sized cues. The transcript is
    // correct in that case, but rendering one cue at a time makes the
    // learning subtitle appear to contain only half a sentence (or one word).
    // Detect that shape conservatively and combine adjacent fragments until a
    // natural pause/punctuation boundary. Normal sentence captions are left
    // untouched.
    const wordCounts = deduped.map(item => item.text.split(/\s+/).filter(Boolean).length);
    const shortRatio = wordCounts.filter(count => count <= 3).length / wordCounts.length;
    const medianDuration = [...deduped.map(item => item.duration).sort((a, b) => a - b)]
      [Math.floor(deduped.length / 2)] || 0;
    const dense = deduped.length >= 8 && shortRatio >= 0.62 && medianDuration <= 1.8;
    if (!dense) return deduped;

    const grouped = [];
    let current = null;
    const terminal = /[.!?。！？…]$/u;
    const maxGap = 0.9;
    const maxChars = 220;

    for (const item of deduped) {
      if (!current) {
        current = { ...item };
        continue;
      }
      const currentEnd = current.start + Math.max(current.duration, 0);
      const gap = item.start - currentEnd;
      const joined = `${current.text} ${item.text}`.replace(/\s+/g, ' ').trim();
      const canJoin = gap <= maxGap && !terminal.test(current.text) && joined.length <= maxChars;
      if (canJoin) {
        current.text = joined;
        current.duration = Math.max(current.duration, (item.start + item.duration) - current.start);
      } else {
        grouped.push(current);
        current = { ...item };
      }
    }
    if (current) grouped.push(current);
    return grouped;
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
          <header class="cmj-panel-head">
            <strong>🌍 Charlie MJ Language <small class="cmj-window-hint">Drag header · resize corner</small></strong>
            <div class="cmj-panel-head-actions">
              <button data-cmj-action="dock-left" title="Dock left">◀</button>
              <button data-cmj-action="dock-right" title="Dock right">▶</button>
              <button data-cmj-action="minimize" title="Minimize">—</button>
              <button data-cmj-action="maximize" title="Maximize">□</button>
              <button data-cmj-action="pin" title="Pin on top">📌</button>
              <button data-cmj-action="reset-window" title="Reset transcript window">↺</button>
              <button data-cmj-action="close" title="Close">×</button>
            </div>
          </header>
          <nav class="cmj-tabs">
            <button data-cmj-tab="transcript">Transcript</button>
            <button data-cmj-tab="vocabulary">Vocabulary</button>
            <button data-cmj-tab="bookmarks">Bookmarks</button>
            <button data-cmj-tab="watchLater">Watch Later</button>
            <button data-cmj-tab="notes">Notes</button>
          </nav>
          <div class="cmj-panel-body"></div>
          <span class="cmj-resize cmj-resize-n"></span><span class="cmj-resize cmj-resize-ne"></span><span class="cmj-resize cmj-resize-e"></span><span class="cmj-resize cmj-resize-se"></span><span class="cmj-resize cmj-resize-s"></span><span class="cmj-resize cmj-resize-sw"></span><span class="cmj-resize cmj-resize-w"></span><span class="cmj-resize cmj-resize-nw"></span>
        </aside>
        <div class="cmj-toast" hidden></div>`;
      document.body.appendChild(root);
      root.addEventListener('click', event => { Promise.resolve(onRootClick(event)).catch(error => { reportContextError(error); if (!isContextInvalidError(error)) showToast('That action failed. Please try again.'); }); });
      root.addEventListener('input', onRootInput);
      installSubtitleHoverPause(root);
      installSubtitleInteractions(root);
      installTranscriptPanelInteractions(root);
    }

    const player = document.querySelector('#movie_player');
    let playerHost = document.getElementById(PLAYER_HOST_ID);
    if (player) {
      if (state.settings.showToolbarUnderVideo !== false) {
        if (!playerHost) {
          playerHost = document.createElement('div');
          playerHost.id = PLAYER_HOST_ID;
          playerHost.innerHTML = buildToolbarHTML();
          playerHost.addEventListener('click', onToolbarClick);
          installToolbarInteractions(player, playerHost);
          document.body.appendChild(playerHost);
          updateToolbarOverflow(playerHost);
        }
      } else if (playerHost) {
        playerHost.remove();
        playerHost = null;
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
    applySubtitlePosition($('.cmj-subtitle-layer'));
    applyTranscriptWindow($('.cmj-panel'));
    if (playerHost) { applyToolbarPosition(playerHost); applyToolbarRevealMode(player, playerHost); updateToolbarOverflow(playerHost); }
    readNativeCaptions();
  }

  function installSubtitleInteractions(root) {
    const layer = $('.cmj-subtitle-layer', root);
    if (!layer || layer.dataset.cmjDragReady) return;
    layer.dataset.cmjDragReady = '1';
    let dragging = false, startX = 0, startY = 0, startLeft = 0, startTop = 0;
    const begin = event => {
      if (state.settings.subtitleDragEnabled === false) return;
      if (event.button !== undefined && event.button !== 0) return;
      if (event.target.closest('.cmj-word,button,a,input')) return;
      const rect = layer.getBoundingClientRect();
      dragging = true; startX = event.clientX; startY = event.clientY;
      startLeft = rect.left; startTop = rect.top;
      layer.classList.add('cmj-subtitle-dragging');
      try { layer.setPointerCapture?.(event.pointerId); } catch (_) {}
      event.preventDefault(); event.stopPropagation();
    };
    const move = event => {
      if (!dragging) return;
      const maxX = Math.max(0, window.innerWidth - layer.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - layer.offsetHeight);
      const left = Math.max(0, Math.min(maxX, startLeft + event.clientX - startX));
      const top = Math.max(0, Math.min(maxY, startTop + event.clientY - startY));
      state.settings.subtitlePositionMode = 'custom';
      state.settings.subtitlePosition = { leftPx: Math.round(left), topPx: Math.round(top), left: null, top: null, bottom: null };
      applySubtitlePosition(layer);
    };
    const end = async () => {
      if (!dragging) return;
      dragging = false; layer.classList.remove('cmj-subtitle-dragging');
      try { await storageSet({ settings: state.settings }); } catch (_) {}
    };
    layer.addEventListener('pointerdown', begin, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', end, true);
  }

  function applySubtitlePosition(layer) {
    if (!layer) return;
    const s = state.settings;
    const pos = { leftPx: null, topPx: null, left: Number(s.subtitleDefaultX ?? 50), top: Number(s.subtitleDefaultY ?? 11), bottom: null, ...(s.subtitlePosition || {}) };
    const custom = s.subtitlePositionMode === 'custom' && (Number.isFinite(Number(pos.leftPx)) || Number.isFinite(Number(pos.topPx)));
    const mode = s.subtitlePositionMode || 'bottom';
    layer.style.width = `min(${Math.max(20, Math.min(100, Number(s.subtitleWidthPercent ?? 60)))}vw, 96vw)`;
    layer.style.maxWidth = `min(${Math.max(300, Number(s.subtitleMaxWidth || 1100))}px, 96vw)`;
    layer.style.right = 'auto';
    if (custom || mode === 'custom') {
      layer.style.left = `${Number.isFinite(Number(pos.leftPx)) ? Number(pos.leftPx) : Number(pos.left ?? 50)}${Number.isFinite(Number(pos.leftPx)) ? 'px' : '%'}`;
      layer.style.top = `${Number.isFinite(Number(pos.topPx)) ? Number(pos.topPx) : Number(pos.top ?? 11)}${Number.isFinite(Number(pos.topPx)) ? 'px' : '%'}`;
      layer.style.bottom = 'auto'; layer.style.transform = 'none';
    } else {
      const h = s.subtitleHorizontalAnchor || 'center'; const v = s.subtitleVerticalAnchor || mode || 'bottom';
      layer.style.right = 'auto';
      if (h === 'left') { layer.style.left = `${Math.max(0, Number(s.subtitleOffsetX ?? 0))}%`; layer.style.transform = 'none'; }
      else if (h === 'right') { layer.style.left = 'auto'; layer.style.right = `${Math.max(0, Number(s.subtitleOffsetX ?? 0))}%`; layer.style.transform = 'none'; }
      else { layer.style.left = '50%'; layer.style.transform = 'translateX(-50%)'; }
      if (v === 'top') { layer.style.top = `${Math.max(0, Number(s.subtitleOffsetY ?? 11))}%`; layer.style.bottom = 'auto'; }
      else if (v === 'center') { layer.style.top = '50%'; layer.style.bottom = 'auto'; layer.style.transform = `${layer.style.transform ? layer.style.transform + ' ' : ''}translateY(-50%)`; }
      else { layer.style.top = 'auto'; layer.style.bottom = `${Math.max(0, Number(s.subtitleOffsetY ?? 11))}%`; }
    }
    layer.style.setProperty('--cmj-subtitle-ui-font-size', `${Math.max(10, Math.min(72, Number(s.subtitleUIFontSize || 28)))}px`);
    layer.style.setProperty('--cmj-subtitle-text-color', s.subtitleTextColor || '#ffffff');
    layer.style.setProperty('--cmj-subtitle-bg', s.subtitleBackgroundColor || '#000000');
    layer.style.setProperty('--cmj-subtitle-opacity', String(Math.max(0, Math.min(100, Number(s.subtitleOpacity ?? 65))) / 100));
  }

  function installTranscriptPanelInteractions(root) {
    const panel = $('.cmj-panel', root); const head = $('.cmj-panel-head', panel);
    if (!panel || !head || panel.dataset.cmjWindowReady) return; panel.dataset.cmjWindowReady='1'; applyTranscriptWindow(panel); installTranscriptControlAutoHide(panel);
    let dragging=false, resizing=false, resizeDir='', startX=0,startY=0,startLeft=0,startTop=0,startW=0,startH=0;
    const beginDrag=e=>{ if(e.button!==undefined&&e.button!==0)return; if(e.target.closest('button'))return; const r=panel.getBoundingClientRect(); dragging=true; startX=e.clientX;startY=e.clientY;startLeft=r.left;startTop=r.top;panel.classList.add('cmj-panel-dragging');e.preventDefault();e.stopPropagation(); };
    const beginResize=e=>{ const h=e.target.closest('.cmj-resize'); if(!h)return; if(e.button!==undefined&&e.button!==0)return; const r=panel.getBoundingClientRect(); resizing=true;resizeDir=h.dataset.dir||h.className.split('cmj-resize-')[1]||'se';startX=e.clientX;startY=e.clientY;startLeft=r.left;startTop=r.top;startW=r.width;startH=r.height;panel.classList.add('cmj-panel-resizing');e.preventDefault();e.stopPropagation(); };
    const move=e=>{
      if(dragging){ state.settings.transcriptPositionMode='custom'; const maxX=Math.max(0,innerWidth-panel.offsetWidth),maxY=Math.max(0,innerHeight-panel.offsetHeight); const left=Math.max(0,Math.min(maxX,startLeft+e.clientX-startX)); const top=Math.max(0,Math.min(maxY,startTop+e.clientY-startY)); state.settings.transcriptWindowPosition={leftPx:Math.round(left),topPx:Math.round(top),left:null,top:null}; applyTranscriptWindow(panel); return; }
      if(!resizing)return;
      const minW=Math.max(220,Number(state.settings.transcriptWindowMinWidth||220)),maxW=Math.max(minW,Number(state.settings.transcriptWindowMaxWidth||1000)); const minH=Math.max(220,Number(state.settings.transcriptWindowMinHeight||220)),maxH=Math.max(minH,Number(state.settings.transcriptWindowMaxHeight||900));
      let left=startLeft,top=startTop,w=startW,h=startH,dx=e.clientX-startX,dy=e.clientY-startY;
      if(resizeDir.includes('e'))w=startW+dx; if(resizeDir.includes('w')){w=startW-dx;left=startLeft+dx;} if(resizeDir.includes('s'))h=startH+dy; if(resizeDir.includes('n')){h=startH-dy;top=startTop+dy;}
      w=Math.max(minW,Math.min(maxW,w));h=Math.max(minH,Math.min(maxH,h)); if(resizeDir.includes('w'))left=startLeft+(startW-w); if(resizeDir.includes('n'))top=startTop+(startH-h);
      left=Math.max(0,Math.min(Math.max(0,innerWidth-w),left)); top=Math.max(0,Math.min(Math.max(0,innerHeight-h),top));
      state.settings.transcriptPositionMode='custom';state.settings.transcriptWindowWidth=Math.round(w);state.settings.transcriptWindowHeight=Math.round(h);state.settings.transcriptWindowPosition={leftPx:Math.round(left),topPx:Math.round(top),left:null,top:null}; applyTranscriptWindow(panel);
    };
    const end=async()=>{ if(!dragging&&!resizing)return; dragging=false;resizing=false;panel.classList.remove('cmj-panel-dragging','cmj-panel-resizing');try{await storageSet({settings:state.settings})}catch(_){} };
    head.addEventListener('pointerdown',beginDrag,true); panel.addEventListener('pointerdown',beginResize,true); document.addEventListener('pointermove',move,true); document.addEventListener('pointerup',end,true);
    panel.querySelectorAll('.cmj-resize').forEach(h=>{h.dataset.dir=h.className.split('cmj-resize-')[1]||'se';});
  }

  function installTranscriptControlAutoHide(panel) {
    if (!panel || panel.dataset.cmjAutoHideReady) return;
    panel.dataset.cmjAutoHideReady='1';
    const actions=$('.cmj-panel-head-actions',panel);
    let controlsTimer=null, windowTimer=null;
    const delay=()=>Math.max(500,Math.min(30000,Number(state.settings.transcriptAutoHideDelayMs ?? state.settings.transcriptControlHideDelayMs ?? 15000)));
    const reveal=()=>{
      panel.classList.remove('cmj-panel-window-auto-hidden');
      actions?.classList.remove('cmj-controls-auto-hidden');
      clearTimeout(controlsTimer); clearTimeout(windowTimer);
      controlsTimer=setTimeout(()=>{ if(!panel.matches(':hover')) actions?.classList.add('cmj-controls-auto-hidden'); },delay());
      windowTimer=setTimeout(()=>{ if(!panel.matches(':hover')) panel.classList.add('cmj-panel-window-auto-hidden'); },delay());
    };
    panel.addEventListener('pointerenter',reveal,{passive:true});
    panel.addEventListener('pointermove',reveal,{passive:true});
    document.addEventListener('pointermove',event=>{
      if(panel.hidden)return;
      const r=panel.getBoundingClientRect(); const zone=Math.max(0,Number(state.settings.transcriptHoverZonePx ?? 120));
      const near=event.clientX>=r.left-zone&&event.clientX<=r.right+zone&&event.clientY>=r.top-zone&&event.clientY<=r.bottom+zone;
      if(near) reveal();
      else if(!panel.matches(':hover')) {
        clearTimeout(windowTimer); clearTimeout(controlsTimer);
        windowTimer=setTimeout(()=>{ if(!panel.matches(':hover')) panel.classList.add('cmj-panel-window-auto-hidden'); },delay());
        controlsTimer=setTimeout(()=>{ if(!panel.matches(':hover')) actions?.classList.add('cmj-controls-auto-hidden'); },delay());
      }
    },true);
    reveal();
  }


  function applyTranscriptWindow(panel) {
    if (!panel) return;
    const s = state.settings;
    const minW = Math.max(220, Number(s.transcriptWindowMinWidth || 220)); const maxW = Math.max(minW, Number(s.transcriptWindowMaxWidth || 1000));
    const minH = Math.max(220, Number(s.transcriptWindowMinHeight || 220)); const maxH = Math.max(minH, Number(s.transcriptWindowMaxHeight || 900));
    const width = Math.max(minW, Math.min(maxW, Number(s.transcriptWindowWidth || s.transcriptUIWidth || 300)));
    const height = Math.max(minH, Math.min(maxH, Number(s.transcriptWindowHeight || s.transcriptUIHeight || 545)));
    panel.style.minWidth = `${minW}px`; panel.style.maxWidth = `${maxW}px`; panel.style.minHeight = `${minH}px`; panel.style.maxHeight = `${maxH}px`; panel.style.width = `${width}px`; panel.style.height = `${height}px`;
    panel.style.bottom = 'auto'; panel.style.right = 'auto';
    const pos = { leftPx: null, topPx: null, right: null, left: null, top: null, ...(s.transcriptWindowPosition || {}) };
    const custom = s.transcriptPositionMode === 'custom' && (Number.isFinite(Number(pos.leftPx)) || Number.isFinite(Number(pos.topPx)));
    panel.style.transform = 'none';
    if (custom) {
      panel.style.left = `${Number(pos.leftPx ?? 0)}px`; panel.style.top = `${Number(pos.topPx ?? 0)}px`;
    } else {
      const h = s.transcriptHorizontalAnchor || 'right'; const v = s.transcriptVerticalAnchor || 'top';
      if (h === 'left') { panel.style.left = `${Math.max(0, Number(s.transcriptOffsetX ?? 2))}%`; panel.style.right = 'auto'; }
      else if (h === 'center') { panel.style.left = '50%'; panel.style.right = 'auto'; panel.style.transform = 'translateX(-50%)'; }
      else { panel.style.left = 'auto'; panel.style.right = `${Math.max(0, Number(s.transcriptOffsetX ?? 2))}%`; }
      if (v === 'top') { panel.style.top = `${Math.max(0, Number(s.transcriptOffsetY ?? 12))}%`; panel.style.bottom = 'auto'; }
      else if (v === 'center') { panel.style.top = '50%'; panel.style.bottom = 'auto'; panel.style.transform = `${panel.style.transform !== 'none' ? panel.style.transform + ' ' : ''}translateY(-50%)`; }
      else { panel.style.top = 'auto'; panel.style.bottom = `${Math.max(0, Number(s.transcriptOffsetY ?? 12))}%`; }
    }
    panel.classList.toggle('cmj-panel-pinned', s.transcriptPinned === true);
    panel.classList.toggle('cmj-panel-maximized', s.transcriptWindowMaximized === true);
    panel.classList.toggle('cmj-panel-minimized', s.transcriptWindowMinimized === true);
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
      state.settings.toolbarPositionMode = 'custom';
      state.settings.toolbarPosition = { leftPx: Math.round(left), topPx: Math.round(top), left: null, top: null, bottom: null };
      applyToolbarPosition(host);
      updateToolbarRevealHotspot(host);
    };
    const end = async () => {
      if (!dragging) return;
      dragging = false; document.body.classList.remove('cmj-toolbar-dragging');
      try { await storageSet({ settings: state.settings }); } catch (_) {}
    };
    toolbar.addEventListener('pointerdown', begin, true);
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', end, true);
    updateToolbarButtonStates();
    toolbar.addEventListener('dblclick', async event => {
      if (event.target.closest('button')) return;
      state.settings.toolbarPositionMode = 'default'; state.settings.toolbarPosition = { leftPx: null, topPx: null, left: null, top: null, bottom: 2 };
      applyToolbarPosition(host);
      await storageSet({ settings: state.settings });
    });
  }

  function applyToolbarPosition(host) {
    if (!host) return;
    const s = state.settings;
    const pos = { leftPx: null, topPx: null, left: null, top: null, bottom: null, ...(s.toolbarPosition || {}) };
    const custom = s.toolbarPositionMode === 'custom' && (Number.isFinite(Number(pos.leftPx)) || Number.isFinite(Number(pos.topPx)));
    host.style.position = 'fixed'; host.style.transform = 'none';
    const toolbarWidth = Math.max(300, Math.min(1600, Number(s.toolbarWidth || 905)));
    host.style.width = `min(96vw, ${toolbarWidth}px)`;
    host.style.height = `${Math.max(30, Math.min(120, Number(s.toolbarHeight || 45)))}px`;
    host.style.setProperty('--cmj-toolbar-scale', String(Math.max(0.7, Math.min(1.4, Number(s.toolbarScale || 1)))));
    host.style.right = 'auto';
    if (custom) {
      host.style.left = `${Number(pos.leftPx ?? 0)}px`; host.style.top = `${Number(pos.topPx ?? 0)}px`; host.style.bottom = 'auto';
      return;
    }
    const h = s.toolbarHorizontalAnchor || 'center'; const v = s.toolbarVerticalAnchor || 'bottom';
    if (h === 'left') { host.style.left = `${Math.max(0, Number(s.toolbarOffsetX ?? 0))}%`; host.style.transform = 'none'; }
    else if (h === 'right') { host.style.left = 'auto'; host.style.right = `${Math.max(0, Number(s.toolbarOffsetX ?? 0))}%`; }
    else { host.style.left = '50%'; host.style.transform = 'translateX(-50%)'; }
    if (v === 'top') { host.style.top = `${Math.max(0, Number(s.toolbarOffsetY ?? 2))}%`; host.style.bottom = 'auto'; }
    else if (v === 'center') { host.style.top = '50%'; host.style.bottom = 'auto'; host.style.transform = `${host.style.transform ? host.style.transform + ' ' : ''}translateY(-50%)`; }
    else { host.style.top = 'auto'; host.style.bottom = `${Math.max(0, Number(s.toolbarOffsetY ?? 2))}%`; }
  }

  function updateToolbarRevealHotspot(host) {
    const rect = host.getBoundingClientRect();
    host.style.setProperty('--cmj-hotspot-x', `${rect.left + rect.width / 2}px`);
    host.style.setProperty('--cmj-hotspot-y', `${rect.top + rect.height / 2}px`);
  }

  function applyToolbarRevealMode(player, host) {
    const toolbar = $('.cmj-toolbar', host);
    if (!toolbar) return;
    const mode = state.settings.toolbarRevealMode || 'hover';
    const hoverMode = ['hover','nearby','reveal-on-hover','reveal-on-hover-nearby'].includes(mode);
    toolbar.classList.toggle('cmj-toolbar-hover-mode', hoverMode);
    if (!['hover','nearby','reveal-on-hover','reveal-on-hover-nearby'].includes(mode)) {
      host.dataset.cmjRevealMode = mode;
      toolbar.classList.add('cmj-toolbar-revealed');
      clearTimeout(host.__cmjHideTimer);
      return;
    }
    updateToolbarRevealHotspot(host);
    if (host.dataset.cmjRevealReady) {
      if (host.dataset.cmjRevealMode !== mode) {
        host.dataset.cmjRevealMode = mode;
        toolbar.classList.add('cmj-toolbar-revealed');
        clearTimeout(host.__cmjHideTimer);
        host.__cmjHideTimer = setTimeout(() => { if (!toolbar.matches(':hover')) toolbar.classList.remove('cmj-toolbar-revealed'); }, Math.max(500, Math.min(30000, Number(state.settings.toolbarAutoHideDelayMs ?? 15000))));
      }
      return;
    }
    host.dataset.cmjRevealReady = '1';
    host.dataset.cmjRevealMode = mode;
    const delay = () => Math.max(500, Math.min(30000, Number(state.settings.toolbarAutoHideDelayMs ?? 15000)));
    const hideIfAway = () => {
      clearTimeout(host.__cmjHideTimer);
      host.__cmjHideTimer = setTimeout(() => {
        // Nearby pointer movement reveals the toolbar, but proximity alone must not keep it visible forever.
        if (!toolbar.matches(':hover')) toolbar.classList.remove('cmj-toolbar-revealed');
        else hideIfAway();
      }, delay());
    };
    const reveal = event => {
      if (event) { window.__cmjPointerX = event.clientX; window.__cmjPointerY = event.clientY; }
      toolbar.classList.add('cmj-toolbar-revealed');
      hideIfAway();
    };
    host.addEventListener('pointerenter', reveal, {passive:true});
    host.addEventListener('pointermove', reveal, {passive:true});
    document.addEventListener('pointermove', event => {
      window.__cmjPointerX = event.clientX; window.__cmjPointerY = event.clientY;
      const r = host.getBoundingClientRect();
      const zone = Math.max(0, Number(state.settings.toolbarHoverZonePx ?? 140));
      const near = event.clientX >= r.left-zone && event.clientX <= r.right+zone && event.clientY >= r.top-zone && event.clientY <= r.bottom+zone;
      if (near) reveal(event);
      else if (toolbar.classList.contains('cmj-toolbar-revealed')) hideIfAway();
    }, true);
    // Reveal once on startup, then hide after the configured idle period.
    reveal();
  }

  function buildToolbarHTML() {
    const frontDefault=['toggle','transcript','word','sentence','save','bookmark','capture','watch','focus','theme'];
    const moreDefault=['translate','replay','loop','speed','ab','study','save-sentence','download-transcript','download-vocabulary','settings'];
    const front=Array.isArray(state.settings.toolbarActionOrder)?state.settings.toolbarActionOrder:frontDefault;
    const more=Array.isArray(state.settings.toolbarMoreActions)?state.settings.toolbarMoreActions:moreDefault;
    const labels={
      toggle:['🌍','CMJ','Enable or disable Charlie MJ subtitles'],
      transcript:['📜','Transcript','Complete transcript'],
      word:['🔤','Word','Word Learning'],
      sentence:['📝','Sentence','Sentence Learning'],
      save:['⭐','Save','Save current subtitle'],
      bookmark:['🔖','Bookmark','Bookmark this timeline position'],
      capture:['📸','Capture','Capture this timeline position'],
      watch:['⏰','Watch Later','Add this video to Charlie MJ Watch Later'],
      focus:['🎯','Focus','Reduce YouTube distractions'],
      theme:['☼/☾','Theme','Switch appearance']
    };
    const moreLabels={
      translate:['🌐','Translate current subtitle'],replay:['🔁','Replay current sentence'],loop:['🔁','Loop current sentence'],
      speed:['⏱','Speed 1×'],ab:['','A/B Replay'],study:['🧠','Study Mode'],'save-sentence':['📝','Save Sentence'],
      'download-transcript':['⬇','Complete transcript + translation'],'download-vocabulary':['📚','Custom vocabulary + translation'],
      settings:['⚙','Extension settings']
    };
    const frontHTML=front.filter(a=>labels[a]).map(a=>`<button data-cmj-toolbar="${a}" aria-pressed="false" title="${labels[a][2]}">${labels[a][0]} <span>${labels[a][1]}</span></button>`).join('');
    const moreHTML=more.filter(a=>moreLabels[a]).map(a=>`<button data-cmj-toolbar="${a}" aria-pressed="false">${moreLabels[a][0]} ${moreLabels[a][1]}</button>`).join('');
    return `<div class="cmj-toolbar" role="toolbar" aria-label="Charlie MJ Language">
      ${frontHTML}
      <button class="cmj-more-button" data-cmj-toolbar="more" title="More tools">⋮</button>
      <div class="cmj-more-menu" hidden>${moreHTML}</div>
    </div>`;
  }

  function updateToolbarOverflow(host) {
    const toolbar=$('.cmj-toolbar',host); if(!toolbar)return; const moreMenu=$('.cmj-more-menu',toolbar); const moreBtn=$('.cmj-more-button',toolbar); if(!moreMenu||!moreBtn)return;
    toolbar.querySelectorAll('.cmj-overflow-clone').forEach(x=>x.remove());
    toolbar.querySelectorAll('.cmj-toolbar-overflow').forEach(x=>x.classList.remove('cmj-toolbar-overflow'));
    if((state.settings.toolbarOverflowMode||'auto')!=='auto'){moreBtn.hidden=false;return;}
    const available=toolbar.clientWidth-56; let used=0; const front=[...toolbar.querySelectorAll('[data-cmj-toolbar]:not(.cmj-more-button)')].filter(b=>b.parentElement===toolbar);
    const overflow=[]; for(const b of front){ b.hidden=false; used+=Math.max(72,b.getBoundingClientRect().width||90); if(used>available){ b.hidden=true; b.classList.add('cmj-toolbar-overflow'); const clone=b.cloneNode(true); clone.classList.add('cmj-overflow-clone'); clone.hidden=false; moreMenu.appendChild(clone); overflow.push(b); } }
    moreBtn.hidden=overflow.length===0 && moreMenu.children.length===0;
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

  async function toggleTheme() {
    const current = state.settings.theme || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    state.settings.theme = next;
    await storageSet({settings: state.settings});
    applyTheme();
    showToast(`Appearance: ${next}`);
  }

  function updateToolbarButtonStates() {
    const toolbar = $('.cmj-toolbar');
    if (!toolbar) return;
    const active = new Set();
    const subtitleLayer = $('.cmj-subtitle-layer');
    if (subtitleLayer && !subtitleLayer.classList.contains('cmj-hidden')) active.add('toggle');
    if (state.panelTab === 'transcript' && !$('.cmj-panel')?.hidden) active.add('transcript');
    if (state.settings.subtitleDisplayMode === 'both' && state.panelTab === 'vocabulary') active.add('word');
    if (state.settings.subtitleDisplayMode === 'sentence') active.add('sentence');
    if (state.focusMode) active.add('focus');
    if (state.studyMode) active.add('study');
    if (state.abRange) active.add('ab');
    if (state.settings.theme === 'dark') active.add('theme');
    toolbar.querySelectorAll('[data-cmj-toolbar]').forEach(button => {
      const action = button.dataset.cmjToolbar;
      if (action === 'more') return;
      const isActive = active.has(action);
      button.classList.toggle('cmj-toolbar-active', isActive);
      if (['toggle','transcript','word','sentence','focus','study','ab','theme'].includes(action)) button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function markToolbarAction(action) {
    const button = $(`.cmj-toolbar [data-cmj-toolbar="${action}"]`);
    if (!button || ['toggle','transcript','word','sentence','focus','study','ab','theme'].includes(action)) return;
    button.classList.add('cmj-toolbar-action-complete');
    clearTimeout(button.__cmjActionTimer);
    button.__cmjActionTimer = setTimeout(() => button.classList.remove('cmj-toolbar-action-complete'), 900);
  }

  async function openExtensionSettings() {
    try {
      const result = await chrome.runtime.sendMessage({ type: 'CMJ_OPEN_OPTIONS' });
      if (!result?.ok) showToast('Unable to open Extension Settings.');
    } catch (_) {
      showToast('Unable to open Extension Settings.');
    }
  }

  function onToolbarClick(event) {
    const button = event.target.closest('[data-cmj-toolbar]');
    if (!button) return;
    const action = button.dataset.cmjToolbar;
    if (action === 'toggle') { toggleSubtitleVisibility(); markToolbarAction('toggle'); updateToolbarButtonStates(); }
    if (action === 'transcript') { openPanel('transcript'); updateToolbarButtonStates(); }
    if (action === 'word') { state.settings.subtitleDisplayMode='both'; storageSet({settings:state.settings}); openPanel('vocabulary'); renderCurrentSubtitle(); updateToolbarButtonStates(); }
    if (action === 'sentence') { state.settings.subtitleDisplayMode='sentence'; storageSet({settings:state.settings}); openPanel('transcript'); renderCurrentSubtitle(); updateToolbarButtonStates(); }
    if (action === 'theme') { toggleTheme(); updateToolbarButtonStates(); }
    if (action === 'save') { saveCurrentSubtitle(); markToolbarAction('save'); }
    if (action === 'bookmark') { saveBookmark(); markToolbarAction('bookmark'); }
    if (action === 'capture') { captureFrame(); markToolbarAction('capture'); }
    if (action === 'watch') { addWatchLater(); markToolbarAction('watch'); }
    if (action === 'focus') { toggleFocusMode(); updateToolbarButtonStates(); }
    if (action === 'more') $('.cmj-more-menu', button.parentElement)?.toggleAttribute('hidden');
    if (action === 'translate') { translateCurrent(false); markToolbarAction('translate'); }
    if (action === 'replay') { replayCurrentSentence(); markToolbarAction('replay'); }
    if (action === 'loop') { toggleABReplay(); updateToolbarButtonStates(); }
    if (action === 'speed') { cyclePlaybackSpeed(button); markToolbarAction('speed'); }
    if (action === 'ab') { toggleABReplay(); updateToolbarButtonStates(); }
    if (action === 'study') { toggleStudyMode(); updateToolbarButtonStates(); }
    if (action === 'save-sentence') { saveCurrentSentence(); markToolbarAction('save-sentence'); }
    if (action === 'download-transcript') { downloadTranscript('both'); markToolbarAction('download-transcript'); }
    if (action === 'download-vocabulary') { downloadVocabulary(); markToolbarAction('download-vocabulary'); }
    if (action === 'settings') { openExtensionSettings(); markToolbarAction('settings'); }
  }

  async function onRootClick(event) {
    if (event.target.closest('[data-cmj-sentence-translation]') && state.studyMode) { revealStudyTranslation(); return; }
    const saveSentenceButton = event.target.closest('[data-cmj-save-current-sentence]');
    if (saveSentenceButton) { await saveCurrentSentence(getCurrentCaption()?.text || '', getCurrentCaption()?.start ?? null); return; }
    const line = event.target.closest('[data-cmj-line]');
    if (line) { seek(Number(line.dataset.cmjLine)); return; }
    const sentence = event.target.closest('[data-cmj-sentence]');
    if (sentence) { await saveCurrentSentence(sentence.textContent || '', getCurrentCaption()?.start ?? null); return; }
    const word = event.target.closest('.cmj-word');
    if (word) {
      showWordCard(word.dataset.word || '');
      return;
    }
    if (event.target.closest('[data-cmj-word-speak]')) { const word = $('.cmj-word-card strong')?.textContent || ''; if (word && 'speechSynthesis' in window) { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(word)); } return; }
    if (event.target.closest('[data-cmj-word-close]')) { closeWordCard(); return; }
    const wordCard = event.target.closest('.cmj-word-card');
    if (!wordCard) closeWordCard();

    const vocabFilter = event.target.closest('[data-cmj-vocab-filter]')?.dataset.cmjVocabFilter;
    if (vocabFilter) { state.settings.libraryVocabularyFilter = vocabFilter; renderPanel('vocabulary'); return; }

    const openUrl = event.target.closest('[data-cmj-open-url]')?.dataset.cmjOpenUrl;
    if (openUrl) { window.open(openUrl, '_blank', 'noopener,noreferrer'); return; }

    const action = event.target.closest('[data-cmj-action]')?.dataset.cmjAction;
    if (action === 'minimize') { state.settings.transcriptWindowMinimized=true; state.settings.transcriptWindowMaximized=false; applyTranscriptWindow($('.cmj-panel')); storageSet({settings:state.settings}); return; }
    if (action === 'maximize') { state.settings.transcriptWindowMaximized=!Boolean(state.settings.transcriptWindowMaximized); state.settings.transcriptWindowMinimized=false; applyTranscriptWindow($('.cmj-panel')); storageSet({settings:state.settings}); return; }
    if (action === 'dock-left') { state.settings.transcriptWindowMinimized=false; state.settings.transcriptWindowMaximized=false; state.settings.transcriptWindowPosition={leftPx:12,topPx:70,left:null,top:null}; applyTranscriptWindow($('.cmj-panel')); storageSet({settings:state.settings}); return; }
    if (action === 'dock-right') { state.settings.transcriptWindowMinimized=false; state.settings.transcriptWindowMaximized=false; state.settings.transcriptWindowPosition={leftPx:null,topPx:70,left:null,top:null,right:12}; applyTranscriptWindow($('.cmj-panel')); storageSet({settings:state.settings}); return; }
    if (action === 'close') { closePanel(); return; }
    if (action === 'pin') {
      state.settings.transcriptPinned = !Boolean(state.settings.transcriptPinned);
      applyTranscriptWindow($('.cmj-panel'));
      await storageSet({ settings: state.settings });
      showToast(state.settings.transcriptPinned ? 'Transcript window pinned on top.' : 'Transcript window unpinned.');
      return;
    }
    if (action === 'reset-window') {
      state.settings.transcriptPositionMode='default'; state.settings.transcriptDefaultX=98; state.settings.transcriptDefaultY=12; state.settings.transcriptUIWidth=300; state.settings.transcriptUIHeight=545; state.settings.transcriptHorizontalAnchor='right'; state.settings.transcriptVerticalAnchor='top'; state.settings.transcriptOffsetX=2; state.settings.transcriptOffsetY=12;
      state.settings.transcriptWindowWidth = 300;
      state.settings.transcriptWindowHeight = 545;
      state.settings.transcriptWindowPosition = { leftPx: null, topPx: null, right: 2, left: null, top: 12 };
      state.settings.transcriptWindowMaximized = false; state.settings.transcriptWindowMinimized = false;
      state.settings.transcriptPinned = false;
      applyTranscriptWindow($('.cmj-panel'));
      await storageSet({ settings: state.settings });
      showToast('Transcript window reset.');
      return;
    }

    const tab = event.target.closest('[data-cmj-tab]')?.dataset.cmjTab;
    if (tab) openPanel(tab);

    const exportButton = event.target.closest('[data-cmj-export]');
    if (exportButton) {
      if (exportButton.dataset.cmjExport === 'both') copyCompleteTranscript().catch(() => showToast('Clipboard access was blocked.'));
      else downloadTranscript(exportButton.dataset.cmjExport);
    }

    const noteAction = event.target.closest('[data-cmj-note-action]')?.dataset.cmjNoteAction;
    if (noteAction) { await handleNoteAction(noteAction, event.target.closest('[data-cmj-note-action]')); return; }

    const saveWord = event.target.closest('[data-cmj-save-word]');
    if (saveWord) { await saveVocabulary(saveWord.dataset.cmjSaveWord, analyzeWord(saveWord.dataset.cmjSaveWord), $('.cmj-word-translation')?.textContent || '', $('.cmj-word-translation-source')?.textContent?.replace(/^Translated by:\s*/i, '') || ''); return; }
  }

  function getVideo() { return document.querySelector('video'); }

  function updatePlayback() {
    if (!isWatchPage()) return;
    const video = getVideo();
    if (!video) return;
    saveLearningProgress(false).catch(() => {});
    const current = getCurrentCaption();
    if (!current) {
      readNativeCaptions();
      return;
    }
    const key = `${state.activeIndex}:${current.start}:${current.text}`;
    if (key !== state.lastCaptionKey) {
      state.lastCaptionKey = key;
      renderCurrentSubtitle();
      if (state.settings.autoPauseAfterSubtitle) { const video = getVideo(); if (video && !video.paused) video.pause(); }
      if (state.settings.autoTranslate) {
        translateCurrent(true).catch(() => {});
        prefetchTranslations(state.activeIndex + 1, Number(state.settings.subtitlePreloadTranslations || 2));
      }
    }
  }


  async function saveTranscriptRecord() {
    if (!state.videoId || !state.captions.length) return;
    const stored = await storageGet('transcripts');
    const record = {
      id: state.videoId, videoId: state.videoId, videoTitle: state.title, url: state.url,
      thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(state.videoId)}/hqdefault.jpg`,
      segments: state.captions.map((c,i)=>({id:`${state.videoId}:${i}`,start:c.start,duration:c.duration,text:c.text,translation:state.translationCache[i]||''})),
      segmentCount: state.captions.length, updatedAt:new Date().toISOString(), source:'YouTube Transcript'
    };
    const list=[record,...(stored.transcripts||[]).filter(x=>x.videoId!==state.videoId)].slice(0,200);
    await storageSet({transcripts:list});
  }

  async function registerVideoHistory() {
    if (!state.videoId) return;
    const stored = await storageGet(['history','videoProgress']);
    const history = Array.isArray(stored.history) ? stored.history : [];
    const existing = history.find(x => x.videoId === state.videoId);
    const record = {
      id: existing?.id || crypto.randomUUID(),
      videoId: state.videoId, videoTitle: state.title, url: state.url,
      thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(state.videoId)}/hqdefault.jpg`,
      lastPosition: Number(existing?.lastPosition || 0),
      watchPercentage: Number(existing?.watchPercentage || 0),
      sessions: Number(existing?.sessions || 0) + 1,
      lastWatchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: existing?.status || 'in-progress',
      type: 'video', source: 'YouTube History'
    };
    const nextHistory = [record, ...history.filter(x => x.videoId !== state.videoId)].slice(0, 500);
    await storageSet({ history: nextHistory });
  }

  async function resumeSavedLearningState() {
    if (!state.videoId || state.resumeAppliedFor === state.videoId) return;
    const stored = await storageGet(['videoProgress']);
    const record = (stored.videoProgress || []).find(x => x.videoId === state.videoId);
    if (!record || Number(record.lastPosition) < 2) return;
    const apply = () => {
      const video = getVideo();
      if (!video || state.resumeAppliedFor === state.videoId) return Boolean(video);
      const target = Math.max(0, Number(record.lastPosition) || 0);
      if (target > 0 && Math.abs(video.currentTime - target) > 2) video.currentTime = target;
      if (record.playbackRate) video.playbackRate = Number(record.playbackRate);
      state.resumeAppliedFor = state.videoId;
      showToast(`Resumed at ${formatTime(target)} · ${Math.round(Number(record.watchPercentage || 0))}%`);
      return true;
    };
    for (let i = 0; i < 20 && !apply(); i++) await wait(250);
  }

  async function saveLearningProgress(force = false) {
    if (!state.videoId) return;
    const now = Date.now();
    if (!force && now - state.lastProgressWrite < 3000) return;
    const video = getVideo();
    if (!video || !Number.isFinite(video.currentTime)) return;
    state.lastProgressWrite = now;
    const duration = Number(video.duration) || 0;
    const position = Number(video.currentTime) || 0;
    const percentage = duration > 0 ? Math.min(100, position / duration * 100) : 0;
    const stored = await storageGet(['videoProgress','history']);
    const old = (stored.videoProgress || []).find(x => x.videoId === state.videoId);
    const status = percentage >= 98 ? 'completed' : position > 1 ? 'in-progress' : 'not-started';
    const progress = {
      id: old?.id || crypto.randomUUID(), type:'video',
      videoId: state.videoId, videoTitle: state.title, url: state.url,
      thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(state.videoId)}/hqdefault.jpg`,
      lastPosition: position, watchPercentage: percentage, duration,
      lastSentence: state.activeIndex >= 0 ? state.activeIndex + 1 : null,
      lastSentenceText: state.activeIndex >= 0 ? state.captions[state.activeIndex]?.text || '' : '',
      learningMode: state.settings.subtitleDisplayMode || 'both',
      studyMode: Boolean(state.studyMode),
      playbackRate: Number(video.playbackRate || 1),
      subtitleMode: state.settings.subtitleDisplayMode || 'both',
      translationMode: state.settings.autoTranslate ? 'automatic' : 'on-demand',
      sessionStartedAt: new Date(state.sessionStartedAt || now).toISOString(),
      totalStudyTime: Number(old?.totalStudyTime || 0) + Math.max(0, (now - Number(state.sessionStartedAt || now)) / 1000 - Number(state.sessionSeconds || 0)),
      updatedAt: new Date().toISOString(), lastSessionAt: new Date().toISOString(), status
    };
    state.sessionSeconds = Math.max(0, (now - Number(state.sessionStartedAt || now)) / 1000);
    const progressList = [progress, ...(stored.videoProgress || []).filter(x => x.videoId !== state.videoId)].slice(0,500);
    const historyOld = (stored.history || []).find(x => x.videoId === state.videoId) || {};
    const historyRecord = {...historyOld, id: historyOld.id || crypto.randomUUID(), videoId: state.videoId, videoTitle: state.title, url: state.url, thumbnail: progress.thumbnail, lastPosition: position, watchPercentage: percentage, lastWatchedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status, type:'video'};
    const history = [historyRecord, ...(stored.history || []).filter(x => x.videoId !== state.videoId)].slice(0,500);
    await storageSet({videoProgress:progressList, history});
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
    const translated = stripYouTubeCaptionArtifacts(state.translationCache[state.activeIndex] || '');
    const mode = state.settings.subtitleDisplayMode || 'both';
    const original = renderWords(cleanOriginal, false);
    const translationHTML = translated ? renderWords(translated, true, cleanOriginal) : '<span class="cmj-translation-placeholder">Translation</span>';
    const level = state.settings.sentenceShowLevel !== false ? getSentenceLevel(cleanOriginal) : '';
    const difficulty = getDifficultyLabel(level);
    const originalStyle = subtitleInlineStyle('original');
    const translationStyle = subtitleInlineStyle('translation');
    const sentenceClass = state.studyMode ? ' cmj-study-active' : '';
    const originalBlock = `<div class="cmj-original-line cmj-level-${level}${sentenceClass}" style="${originalStyle}">${mode === 'sentence' ? `<span class="cmj-sentence-text" data-cmj-sentence="1">${escapeHTML(cleanOriginal)}</span><button type="button" class="cmj-save-sentence-inline" data-cmj-save-current-sentence="1" title="Save this sentence to your Library">⭐ Save sentence</button>` : original}</div>`;
    const sentenceTranslation = translated ? escapeHTML(translated) : '<span class="cmj-translation-placeholder">Translation</span>';
    const translationBlock = `<div class="cmj-translation-line${sentenceClass}" style="${translationStyle}">${mode === 'sentence' ? `<span class="cmj-sentence-translation" data-cmj-sentence-translation="1">${sentenceTranslation}</span>` : translationHTML}</div>`;
    const providerLabel = translated ? formatTranslationProvider(state.translationSourceCache[state.activeIndex] || '') : 'Waiting for translation';
    layer.innerHTML = `${mode === 'translation' ? '' : originalBlock}${mode === 'original' ? '' : translationBlock}<div class="cmj-subtitle-meta">${formatTime(current.start)} · ${escapeHTML(level)} · ${escapeHTML(difficulty)} · ${escapeHTML(translated ? `Translated by: ${providerLabel}` : providerLabel)}</div>`;
    if (state.studyMode) applyStudyReveal(layer);
  }

  function subtitleInlineStyle(kind) {
    const prefix = kind === 'original' ? 'original' : 'translation';
    const size = Number(state.settings[`${prefix}FontSize`] || (kind === 'original' ? 28 : 22));
    const weight = state.settings[`${prefix}Bold`] ? 800 : 400;
    const decoration = state.settings[`${prefix}Underline`] ? 'underline' : 'none';
    const italic = state.settings[`${prefix}Italic`] ? 'italic' : 'normal';
    return `font-size:${Math.max(10, Math.min(72, size))}px;font-weight:${weight};text-decoration:${decoration};font-style:${italic};color:${escapeHTML(kind === 'original' ? (state.settings.originalColor || '#ffffff') : (state.settings.translationColor || '#e2e8f0'))}`;
  }

  function getDifficultyLabel(level) {
    return ({A1:'Beginner',A2:'Elementary',B1:'Intermediate',B2:'Upper-Intermediate',C1:'Advanced',C2:'Proficient'})[level] || 'Learner';
  }

  function applyStudyReveal(layer) {
    const translation = $('.cmj-translation-line', layer);
    if (translation && state.settings.studyRevealTranslation !== true) translation.classList.add('cmj-study-hidden');
  }

  function renderWords(text, translated = false, sourceText = '', context = 'subtitle') {
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
      const useColors = context === 'transcript' ? (state.settings.posColors !== false && state.settings.transcriptGrammarColorsEnabled !== false) : (state.settings.posColors !== false && state.settings.subtitleGrammarColorsEnabled !== false);
      const style = useColors ? `style="--cmj-pos:${escapeHTML(info.color)}"` : '';
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

  function replayCurrentSentence() {
    const video = getVideo();
    const current = getCurrentCaption();
    if (!video || !current) return showToast('No active sentence is available.');
    const count = Math.max(1, Math.min(5, Number(state.settings.replayCount || 1)));
    video.currentTime = Math.max(0, Number(current.start || 0));
    video.playbackRate = Number(state.settings.playbackSpeed || 1);
    let remaining = count;
    const handler = () => {
      const active = getCurrentCaption();
      if (!active || active !== current) return;
      remaining -= 1;
      if (remaining > 0) video.currentTime = Math.max(0, Number(current.start || 0));
      else video.removeEventListener('timeupdate', handler);
    };
    video.addEventListener('timeupdate', handler);
    video.play().catch(() => {});
    showToast(`Replaying sentence ${count}×.`);
  }

  function cyclePlaybackSpeed(button) {
    const video = getVideo();
    if (!video) return;
    const speeds = [0.5, 0.75, 1, 1.25, 1.5];
    const current = Number(video.playbackRate || 1);
    const next = speeds[(speeds.indexOf(current) + 1) % speeds.length];
    video.playbackRate = next;
    state.settings.playbackSpeed = next;
    storageSet({settings: state.settings});
    if (button) button.textContent = `⏱ Speed ${next}×`;
    showToast(`Playback speed: ${next}×`);
  }

  function toggleABReplay() {
    const video = getVideo();
    const current = getCurrentCaption();
    if (!video || !current) return showToast('No active sentence is available.');
    if (!state.abRange) {
      const next = state.captions[state.activeIndex + 1];
      state.abRange = { a: current.start, b: next ? next.start : current.start + Math.max(1, current.duration || 2) };
      showToast(`A/B replay set: ${formatTime(state.abRange.a)} → ${formatTime(state.abRange.b)}. Click again to clear.`);
      const loop = () => {
        if (!state.abRange || !getVideo()) return;
        if (video.currentTime >= state.abRange.b) video.currentTime = state.abRange.a;
        if (state.abRange) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
      updateToolbarButtonStates();
    } else {
      state.abRange = null;
      showToast('A/B replay cleared.');
      updateToolbarButtonStates();
    }
  }

  function toggleStudyMode() {
    state.studyMode = !state.studyMode;
    renderCurrentSubtitle();
    showToast(state.studyMode ? 'Study Mode enabled. Translation is hidden until revealed.' : 'Study Mode disabled.');
    updateToolbarButtonStates();
  }

  function revealStudyTranslation() {
    state.settings.studyRevealTranslation = true;
    const line = $('.cmj-translation-line');
    if (line) line.classList.remove('cmj-study-hidden');
    showToast('Translation revealed.');
  }

  async function saveCurrentSentence(sentenceOverride = '', startOverride = null) {
    const current = getCurrentCaption();
    const sentenceText = String(sentenceOverride || current?.text || '').replace(/\s+/g, ' ').trim();
    if (!sentenceText) { showToast('No active sentence is available. Play a subtitle or select a transcript line first.'); return false; }
    const hasStartOverride = startOverride !== null && startOverride !== undefined && startOverride !== '';
    const timestamp = hasStartOverride && Number.isFinite(Number(startOverride)) ? Math.max(0, Number(startOverride)) : Math.max(0, Number(current?.start ?? getVideo()?.currentTime ?? 0) || 0);
    const videoId = state.videoId || getVideoId();
    const level = getSentenceLevel(sentenceText);
    const item = {
      id: crypto.randomUUID(), type:'sentence', word:'', sentence:sentenceText, translation:'', sentenceTranslation:'',
      words: sentenceText.split(/\s+/).filter(Boolean).map(word => ({ word, ...analyzeWord(word) })),
      lemma:'', pos:'sentence', level, levelLabel:CEFR[level] || 'Learner', stage:'New',
      difficulty: {A1:'Beginner',A2:'Beginner',B1:'Intermediate',B2:'Intermediate',C1:'Advanced',C2:'Advanced'}[level] || 'Beginner',
      language: state.settings.sourceLanguage || 'tr', videoId, videoTitle:state.title || getTitle(), url:location.href, timestamp, source:'Sentence Mining',
      translationProvider: current && Math.abs(Number(current.start || 0)-timestamp)<1.5 ? (state.translationSourceCache[state.activeIndex] || '') : '',
      tags:['YouTube','Sentence',level], createdAt:new Date().toISOString()
    };
    try {
      const stored = await storageGet(['vocabulary','sentenceLearning']);
      const vocabulary = Array.isArray(stored.vocabulary) ? stored.vocabulary : [];
      const sentenceLearning = Array.isArray(stored.sentenceLearning) ? stored.sentenceLearning : [];
      const same = x => x && x.type === 'sentence' && x.videoId === item.videoId && String(x.sentence || x.word || '').trim() === item.sentence && Math.abs(Number(x.timestamp||0)-timestamp)<1.5;
      const existingVocab = vocabulary.find(same);
      const existingLearning = sentenceLearning.find(same);
      const translated = current && Math.abs(Number(current.start || 0)-timestamp)<1.5 ? (state.translationCache[state.activeIndex] || '') : '';
      if (translated) { item.translation = translated; item.sentenceTranslation = translated; }
      if (existingVocab || existingLearning) {
        // Repair an older partial save so the item appears in both Library views.
        const existing = existingVocab || existingLearning;
        const merged = { ...item, ...existing, translation: existing.translation || translated, sentenceTranslation: existing.sentenceTranslation || translated };
        if (!existingVocab) vocabulary.unshift({ ...merged });
        if (!existingLearning) sentenceLearning.unshift({ ...merged, source:'Sentence Learning' });
        if (!(await storageSet({ vocabulary:vocabulary.slice(0,5000), sentenceLearning:sentenceLearning.slice(0,5000) }))) throw new Error('Extension context invalidated; save did not persist.');
        showToast('Sentence is saved in your Library.');
        return true;
      }
      vocabulary.unshift({ ...item });
      sentenceLearning.unshift({ ...item, source:'Sentence Learning' });
      if (!(await storageSet({ vocabulary:vocabulary.slice(0,5000), sentenceLearning:sentenceLearning.slice(0,5000) }))) throw new Error('Extension context invalidated; save did not persist.');
      showToast('Sentence saved to your Library.');
      return true;
    } catch (error) {
      reportContextError(error);
      console.error('Charlie MJ sentence save failed:', error);
      showToast(isContextInvalidError(error) ? 'Refresh this YouTube page to reconnect the extension, then save again.' : 'Could not save sentence. Check extension storage permissions and try again.');
      return false;
    }
  }



  async function translateCaptionByPriority(caption) {
    let priority = Array.isArray(state.settings.translationProviderPriority) && state.settings.translationProviderPriority.length
      ? state.settings.translationProviderPriority.slice()
      : ['youtube-captions','google','microsoft','mymemory','libretranslate'];
    if(priority.includes('youtube-native') || priority.includes('youtube-auto')) priority=['youtube-captions',...priority.filter(x=>x!=='youtube-native'&&x!=='youtube-auto')];
    if(!priority.includes('youtube-captions')) priority=['youtube-captions',...priority];
    const enabled = state.settings.enabledTranslationProviders || {};
    const errors=[];
    for (const provider of priority) {
      if (provider === 'youtube-captions') {
        const value = await getYouTubeTargetSubtitle(caption);
        if (value) return { translation:value, provider:state.translationSourceCache[state.activeIndex] || 'YouTube Auto-Translation' };
        errors.push('YouTube captions unavailable');
        continue;
      }
      if (enabled[provider] !== true) continue;
      try {
        const response = await safeRuntimeMessage({
          type:'CMJ_TRANSLATE', text:caption.text,
          source:state.settings.sourceLanguage||'auto',
          target:state.settings.targetLanguage||'en',
          provider, libreUrl:state.settings.libreTranslateUrl||'', settings:state.settings
        });
        if(response?.ok && response.translation) return {translation:response.translation,provider:response.provider||provider};
        errors.push(`${provider}: ${response?.error||'unavailable'}`);
      } catch(e){ errors.push(`${provider}: ${e.message||'unavailable'}`); }
    }
    return {translation:'',provider:'',error:errors.join(' • ')||'No translation provider is enabled.'};
  }

  async function translateCurrent(silent = false) {
    const current = getCurrentCaption();
    if (!current || state.translating) return '';
    if (state.translationCache[state.activeIndex]) return state.translationCache[state.activeIndex];

    state.translating = true;
    try {
      const result = await translateCaptionByPriority(current);
      if(result.translation){
        state.translationCache[state.activeIndex] = result.translation;
        state.translationSourceCache[state.activeIndex] = formatTranslationProvider(result.provider || result.source || '');
        saveTranscriptRecord().catch(() => {});
        renderCurrentSubtitle();
        if(!silent) showToast(`Translation ready — ${result.provider}.`);
        return result.translation;
      }
      if (!silent) showToast(result.error || 'Translation unavailable.');
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
          const result = await translateCaptionByPriority(caption);
          if(result.translation){ state.translationCache[i] = result.translation; state.translationSourceCache[i] = formatTranslationProvider(result.provider || result.source || ''); }
          if (i === state.activeIndex) renderCurrentSubtitle();
        } catch (_) {}
      })());
    }
    if (jobs.length) await Promise.allSettled(jobs);
  }

  function formatTranslationProvider(provider) {
    const value = String(provider || '').trim();
    const known = {
      'youtube-native':'YouTube native captions', 'youtube native':'YouTube Native captions', 'youtube-captions':'YouTube captions',
      'youtube-auto':'YouTube Auto-Translation', 'youtube auto-translation':'YouTube Auto-Translation', 'google':'Google Translate',
      'microsoft':'Microsoft Translator', 'mymemory':'MyMemory',
      'libretranslate':'LibreTranslate', 'deepl':'DeepL', 'argos':'Argos Translate',
      'cache':'Cached translation (original provider unavailable)',
      'translation-router':'Provider not reported', 'youtube-first':'Provider not reported'
    };
    return known[value.toLowerCase()] || (value ? value.replaceAll('-', ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Provider not reported');
  }

  function showWordCard(word) {
    const card = $('.cmj-word-card');
    if (!card) return;
    const clean = word.replace(/[^\p{L}\p{M}\p{N}'’-]/gu, '');
    if (!clean) return;
    const info = analyzeWord(clean);
    clearTimeout(state.wordCardTimer);
    card.hidden = false;
    card.innerHTML = `<button class="cmj-word-speak" data-cmj-word-speak aria-label="Pronounce">🔊</button><button class="cmj-word-card-close" data-cmj-word-close aria-label="Close">×</button><strong>${escapeHTML(clean)}</strong><span>${info.posLabel} · ${info.cefr} · ${CEFR[info.cefr]}</span><span class="cmj-word-translation">Translation: loading…</span><small class="cmj-word-translation-source">Translated by: checking…</small><span class="cmj-word-dictionary">Dictionary: looking up…</span><small class="cmj-word-dictionary-source">Dictionary source: checking…</small><button data-cmj-save-word="${escapeHTML(clean)}">⭐ Save vocabulary</button>`;
    state.wordCardTimer = setTimeout(() => { card.hidden = true; }, Number(state.settings.wordCardAutoCloseMs || 6000));
    safeRuntimeMessage({
      type: 'CMJ_TRANSLATE', text: clean,
      source: state.settings.sourceLanguage || 'auto', target: state.settings.targetLanguage || 'en',
      provider: 'youtube-first', libreUrl: state.settings.libreTranslateUrl || '',
      settings: state.settings
    }).then(response => {
      const target = $('.cmj-word-translation');
      const source = $('.cmj-word-translation-source');
      if (target) target.textContent = response?.ok ? `Translation: ${response.translation}` : 'Translation: unavailable';
      if (source) source.textContent = `Translated by: ${response?.ok ? formatTranslationProvider(response.provider || response.source || '') : (response?.provider || 'no translation returned')}`;
    });
    safeRuntimeMessage({
      type:'CMJ_DICTIONARY', text:clean,
      source:state.settings.sourceLanguage || 'en', target:state.settings.targetLanguage || 'en',
      settings:state.settings
    }).then(response=>{
      const target=$('.cmj-word-dictionary');
      const entry=response?.entries?.[0];
      const meaning=entry?.meanings?.[0]?.definitions?.[0]?.definition||'No dictionary definition available.';
      const pronunciation=entry?.phonetic||entry?.phonetics?.find(x=>x.text)?.text||'';
      if(target)target.textContent=`Dictionary: ${meaning}${pronunciation?` · Pronunciation: ${pronunciation}`:''}`;
      const source=$('.cmj-word-dictionary-source'); if(source) source.textContent=`Dictionary source: ${response?.source || entry?.source || response?.provider || 'Dictionary API'}`;
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

  function inferLemma(word) {
    const lower = String(word || '').toLocaleLowerCase(state.settings.sourceLanguage === 'tr' ? 'tr' : undefined);
    if (state.settings.sourceLanguage === 'tr') {
      const rules = [/(iyor|ıyor|uyor|üyor)(um|ım|um|üm|sun|sın|sunuz|sünüz|uz|ız|uz|üz)?$/i, /(acak|ecek)(ım|im|um|üm)?$/i, /(miş|mış|muş|müş)(ti|tı|tu|tü|im|ım|um|üm)?$/i, /(di|dı|du|dü)(m|n|k)?$/i];
      let base = lower;
      for (const r of rules) { if (r.test(base)) { base = base.replace(r,''); break; } }
      if (base.length > 2 && /[a-zçğıöşü]$/.test(base)) return base;
      if (/(mak|mek)$/.test(lower)) return lower;
    }
    return lower;
  }

  function getSentenceLevel(text) {
    const words = text.split(/\s+/).filter(Boolean).map(word => analyzeWord(word).cefr);
    const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return words.sort((a, b) => order.indexOf(b) - order.indexOf(a))[0] || 'A1';
  }

  async function saveCurrentSubtitle() {
    const current = getCurrentCaption();
    if (!current) { showToast('No active YouTube subtitle is available yet.'); return false; }
    return saveCurrentSentence(current.text, current.start);
  }

  async function saveVocabulary(word, info, translation, translationProviderOverride = '') {
    const cleanWord = String(word || '').trim();
    if (!cleanWord) { showToast('Nothing to save. Select a word first.'); return false; }
    try {
      const stored = await storageGet(['vocabulary','wordLearning']);
      const vocabulary = Array.isArray(stored.vocabulary) ? stored.vocabulary : [];
      const timestamp = Number(getCurrentCaption()?.start ?? getVideo()?.currentTime ?? 0) || 0;
      const existing = vocabulary.find(item => item && (item.word || '').toLocaleLowerCase() === cleanWord.toLocaleLowerCase() && item.videoId === state.videoId && Math.abs(Number(item.timestamp || 0)-timestamp)<1.5);
      if (existing) { showToast(`“${cleanWord}” is already saved in your Library.`); return true; }
      const record = {
        id: crypto.randomUUID(), type:'word', word:cleanWord, translation:String(translation || '').replace(/^Translation:\s*/i,''),
        translationProvider: translationProviderOverride || state.translationSourceCache[state.activeIndex] || '',
        lemma: info.lemma || inferLemma(cleanWord), pos: info.pos || 'sentence', level: info.cefr || getSentenceLevel(cleanWord),
        levelLabel: CEFR[info.cefr] || 'Learner', stage:'New', sentence:getCurrentCaption()?.text || cleanWord,
        sentenceTranslation: state.translationCache[state.activeIndex] || '', words:Array.isArray(info.words) ? info.words : [],
        difficulty: {A1:'Beginner',A2:'Beginner',B1:'Intermediate',B2:'Intermediate',C1:'Advanced',C2:'Advanced'}[info.cefr || 'A1'] || 'Beginner',
        language: state.settings.sourceLanguage || 'tr', videoId:state.videoId, videoTitle:state.title, url:state.url, timestamp,
        source:'Vocabulary', tags:['YouTube',state.settings.sourceLanguage || 'language'], encounterKey:`${state.videoId}:${cleanWord.toLocaleLowerCase()}`, createdAt:new Date().toISOString()
      };
      vocabulary.unshift(record);
      // Write the main Library record first so an optional secondary list can never block saving.
      if (!(await storageSet({ vocabulary:vocabulary.slice(0,5000) }))) throw new Error('Extension context invalidated; save did not persist.');
      const wordLearning = Array.isArray(stored.wordLearning) ? stored.wordLearning : [];
      if (!wordLearning.some(item => item && item.videoId === state.videoId && (item.word || '').toLocaleLowerCase() === cleanWord.toLocaleLowerCase() && Math.abs(Number(item.timestamp || 0)-timestamp)<1.5)) {
        wordLearning.unshift({ ...record, source:'Word Learning' });
        await storageSet({ wordLearning:wordLearning.slice(0,5000) });
      }
      showToast(`“${cleanWord}” saved to your Library.`);
      enrichVocabularyDictionary(record).catch(error => reportContextError(error));
      return true;
    } catch (error) {
      reportContextError(error);
      console.error('Charlie MJ vocabulary save failed:', error);
      showToast(isContextInvalidError(error) ? 'Refresh this YouTube page to reconnect the extension, then save again.' : 'Could not save vocabulary. Please try again.');
      return false;
    }
  }


  async function enrichVocabularyDictionary(record){
    if(!record?.word || record.type!=='word' || state.settings.dictionaryEnabled===false) return;
    try{
      const response=await safeRuntimeMessage({type:'CMJ_DICTIONARY',text:record.word,source:state.settings.sourceLanguage||'en',target:state.settings.targetLanguage||'en',settings:state.settings});
      if(!response?.ok) return;
      const next=await storageGet('vocabulary');
      const list=next.vocabulary||[];
      const idx=list.findIndex(x=>x.id===record.id);
      if(idx<0)return;
      list[idx].dictionary=response.dictionary||null;
      list[idx].dictionarySource=response.source||'Wiktionary';
      list[idx].dictionarySourceUrl=response.sourceUrl||'';
      list[idx].referenceLinks=response.referenceLinks||[];
      await storageSet({vocabulary:list});
    }catch(_){ }
  }

  async function saveBookmark() {
    const stored = await storageGet('bookmarks');
    const bookmarks = stored.bookmarks || [];
    const timestamp = getVideo()?.currentTime || 0;
    bookmarks.unshift({
      id: crypto.randomUUID(), title: state.title, videoTitle: state.title, url: state.url, videoId: state.videoId,
      thumbnail: `https://i.ytimg.com/vi/${encodeURIComponent(state.videoId)}/hqdefault.jpg`, source: 'Bookmarks',
      timestamp, subtitle: getCurrentCaption()?.text || '', translation: state.translationCache[state.activeIndex] || '',
      label: 'Learning moment', tags: ['YouTube', getSentenceLevel(getCurrentCaption()?.text || '')],
      createdAt: new Date().toISOString()
    });
    await storageSet({ bookmarks });
    showToast('Timeline bookmark saved.');
  }

  async function addWatchLater(explicitUrl = '', explicitTitle = '') {
    const url = explicitUrl || state.url || location.href;
    const videoId = extractVideoId(url) || state.videoId;
    if (!videoId) return showToast('Open a YouTube video first.');
    const stored = await storageGet('watchLater');
    const list = stored.watchLater || [];
    if (!list.some(item => item.videoId === videoId)) {
      list.unshift({
        id: crypto.randomUUID(), videoId, title: explicitTitle || state.title || getTitle(),
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, source: 'Watch Later',
        level: 'Not assessed', tags: ['Watch Later'], progress: 0, addedAt: new Date().toISOString()
      });
      await storageSet({ watchLater: list });
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
    const storedCaptures = await storageGet('captures');
    const captures = storedCaptures.captures || [];
    captures.unshift({id:crypto.randomUUID(), videoId:state.videoId, videoTitle:state.title, url:state.url, timestamp, label:'Timeline capture', createdAt:new Date().toISOString(), source:'Screen Capture'});
    await storageSet({captures:captures.slice(0,1000)});
    showToast(`Timeline capture saved at ${formatTime(timestamp)}.`);
  }

  function toggleSubtitleVisibility() {
    const layer = $('.cmj-subtitle-layer');
    if (layer) layer.classList.toggle('cmj-hidden');
    updateToolbarButtonStates();
  }

  function toggleFocusMode() {
    state.focusMode = !state.focusMode;
    state.settings.focusMode = state.focusMode;
    storageSet({ settings: state.settings });
    applyFocusMode();
    showToast(state.focusMode ? 'Focus Mode enabled.' : 'Focus Mode disabled.');
    updateToolbarButtonStates();
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
    panel.classList.remove('cmj-panel-window-auto-hidden');
    state.panelTab = tab;
    renderPanel(tab).catch(error => { reportContextError(error); if (!isContextInvalidError(error)) console.warn('Charlie MJ panel error:', error); });
  }

  function closePanel() {
    const panel = $('.cmj-panel');
    if (panel) panel.hidden = true;
    updateToolbarButtonStates();
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
      <div class="cmj-transcript-list">${state.captions.map((caption, index) => {
        const sourceHtml = state.settings.transcriptGrammarColorsEnabled !== false ? renderWords(caption.text, false, '', 'transcript') : escapeHTML(caption.text);
        const translated = state.translationCache[index] || '';
        const translationHtml = translated ? (state.settings.transcriptGrammarColorsEnabled !== false ? renderWords(translated, true, caption.text, 'transcript') : escapeHTML(translated)) : '';
        return `<button class="cmj-line" data-cmj-line="${index}"><time>${formatTime(caption.start)}</time><span class="cmj-transcript-original">${sourceHtml}</span><small class="cmj-transcript-translation">${translationHtml}</small></button>`;
      }).join('')}</div>`;
      return;
    }

    if (tab === 'notes') {
      const notes = await getVideoNotes();
      body.innerHTML = `<div class="cmj-notes-toolbar"><button data-cmj-note-action="add">＋ Text box</button><button data-cmj-note-action="bold"><b>B</b></button><button data-cmj-note-action="size-up">A＋</button><button data-cmj-note-action="size-down">A−</button><button data-cmj-note-action="bullet">• List</button><button data-cmj-note-action="save">💾 Save</button></div><p class="cmj-panel-note">Notes are saved locally and linked to <strong>${escapeHTML(state.title)}</strong>.</p><div class="cmj-notes-list">${notes.map((note,index)=>`<article class="cmj-note-box" data-note-id="${escapeHTML(note.id)}"><div class="cmj-note-head"><span>Note ${index+1}</span><button data-cmj-note-action="delete" data-note-id="${escapeHTML(note.id)}">🗑</button></div><div class="cmj-note-editor" contenteditable="true" data-note-editor="${escapeHTML(note.id)}">${note.html || ''}</div></article>`).join('')}</div>`;
      if (!notes.length) body.querySelector('.cmj-notes-list').innerHTML = '<p class="cmj-empty">No notes yet. Add a text box to start.</p>';
      return;
    }

    const dataKey = tab === 'vocabulary' ? 'vocabulary' : tab;
    const stored = await storageGet(dataKey);
    let data = stored[dataKey] || [];
    if (tab === 'vocabulary') {
      data = data.filter(item => (state.settings.libraryVocabularyFilter || 'all') === 'all' || (state.settings.libraryVocabularyFilter === 'word' ? (item.type || 'word') === 'word' : (item.type || 'word') === 'sentence'));
      const cards = data.slice(0, 300).map(item => {
        const title = item.videoTitle || item.title || 'Untitled video';
        const type = (item.type || 'word') === 'sentence' ? 'Sentence' : 'Word';
        return `<article class="cmj-card cmj-vocab-card"><span class="cmj-card-label">${type}</span><strong>${escapeHTML(item.word || item.sentence || '')}</strong><span>${escapeHTML(item.translation || item.sentenceTranslation || '')}</span>${item.translationProvider ? `<small class="cmj-saved-translation-provider">Translated by: ${escapeHTML(formatTranslationProvider(item.translationProvider))}</small>` : ''}<small>${escapeHTML(item.lemma ? 'Lemma: ' + item.lemma + ' · ' : '')}${escapeHTML(title)} · ${escapeHTML(item.level || '')}</small><div>${(item.tags || []).map(t => `<span class="cmj-tag">#${escapeHTML(t)}</span>`).join('')}</div></article>`;
      }).join('');
      body.innerHTML = `<div class="cmj-vocab-filter"><button data-cmj-vocab-filter="all">All</button><button data-cmj-vocab-filter="word">Word-to-Word</button><button data-cmj-vocab-filter="sentence">Sentence-to-Sentence</button></div>${data.length ? `<div class="cmj-vocab-grid">${cards}</div>` : '<p class="cmj-empty">Nothing saved here yet.</p>'}`;
      return;
    }
    body.innerHTML = data.length
      ? data.slice(0, 200).map(item => {
          const title = item.videoTitle || item.title || 'Untitled video';
          const action = tab === 'watchLater' && item.url ? `<button class="cmj-card-open" data-cmj-open-url="${escapeHTML(item.url)}">▶ Open in new tab</button>` : '';
          return `<article class="cmj-card"><strong>${escapeHTML(item.word || item.title || '')}</strong><span>${escapeHTML(item.translation || item.subtitle || item.label || '')}</span><small>${escapeHTML(title)} · ${escapeHTML(item.level || '')} · ${escapeHTML((item.tags || []).join(' #'))}</small>${action}</article>`;
        }).join('')
      : '<p class="cmj-empty">Nothing saved here yet.</p>';
  }

  async function getVideoNotes() {
    const stored = await storageGet('notesByVideo');
    return stored.notesByVideo?.[state.videoId] || [];
  }

  async function saveVideoNotes(notes) {
    const stored = await storageGet('notesByVideo');
    const all = stored.notesByVideo || {};
    all[state.videoId] = notes;
    await storageSet({ notesByVideo: all });
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
    renderPanel(state.panelTab).catch(error => reportContextError(error));
  }

  async function downloadTranscript(mode = 'both') {
    if (!state.captions.length) return showToast('No YouTube subtitle/transcript data is available yet. Try refreshing the video page.');
    showToast('Preparing complete transcript with translations…');

    for (let index = 0; index < state.captions.length; index += 1) {
      if (state.translationCache[index]) continue;
      try {
        const result = await safeRuntimeMessage({
          type: 'CMJ_TRANSLATE', text: state.captions[index].text,
          source: state.settings.sourceLanguage || 'auto', target: state.settings.targetLanguage || 'en',
          provider: 'youtube-first', libreUrl: state.settings.libreTranslateUrl || '', settings: state.settings
        });
        if (result?.ok) { state.translationCache[index] = result.translation; state.translationSourceCache[index] = formatTranslationProvider(result.provider || result.source || ''); }
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
    const stored = await storageGet('vocabulary');
    const items = (stored.vocabulary || []).filter(item => item.videoId === state.videoId);
    const rows = ['word,translation,level,levelLabel,pos,sentence,video,timestamp,tags'];
    for (const item of items) rows.push([item.word, item.translation, item.level, item.levelLabel, item.pos, item.sentence, item.videoTitle, item.timestamp, (item.tags || []).join('|')].map(csv).join(','));
    const filename = `${state.settings.downloadRoot || 'Charlie MJ Language'}/Vocabulary/${sanitize(state.title)}/custom-vocabulary-with-translation.csv`;
    const result = await safeRuntimeMessage({ type: 'CMJ_DOWNLOAD_DATA', text: rows.join('\n'), filename, mime: 'text/csv' });
    showToast(result?.ok ? 'Custom vocabulary export started.' : 'Vocabulary download failed.');
  }

  async function getCurrentVideoLearningData() {
    const stored = await storageGet(['vocabulary','bookmarks','notesByVideo']);
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
      const video = getVideo();
      const now = Number(video?.currentTime || 0);
      if (!state.captions.length) {
        state.captions = [{ start: Math.max(0, now - 0.05), duration: 2, text }];
      } else {
        const last = state.captions[state.captions.length - 1];
        if (!last || last.text !== text || Math.abs(Number(last.start || 0) - now) > 1.2) {
          state.captions = mergeCaptionSegments([...state.captions, { start: Math.max(0, now - 0.05), duration: 2, text }]);
        }
      }
      state.activeIndex = state.captions.length - 1;
      renderCurrentSubtitle();
      if (state.settings.autoTranslate) translateCurrent(true).catch(() => {});
    }
  }

  async function seek(index) {
    const caption = state.captions[index];
    const video = getVideo();
    if (!caption || !video) return showToast('Video is not ready for transcript seeking yet.');
    const target = Math.max(0, Number(caption.start || 0));
    try {
      if (video.readyState < 1) await new Promise(resolve => { const done=()=>{video.removeEventListener('loadedmetadata',done);resolve();}; video.addEventListener('loadedmetadata',done,{once:true}); setTimeout(resolve,1200); });
      video.pause();
      video.currentTime = target;
      state.activeIndex = index;
      state.lastCaptionKey = '';
      renderCurrentSubtitle();
      const playResult = video.play();
      if (playResult?.catch) await playResult.catch(() => {});
      showToast(`Playing transcript at ${formatTime(target)}.`);
    } catch (_) { showToast('Could not seek to this transcript line.'); }
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
      if (!extensionContextAlive()) throw new Error('Extension context invalidated. Refresh this YouTube page.');
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      reportContextError(error);
      if (!isContextInvalidError(error)) console.warn('Charlie MJ runtime message failed:', error);
      return { ok: false, error: error.message || 'Extension background unavailable.' };
    }
  }

  function showToast(message) {
    const toast = $('.cmj-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('cmj-toast-subtitle-center','cmj-toast-bottom-right','cmj-toast-bottom-left');
    const position = ['subtitle-center','bottom-right','bottom-left'].includes(state.settings.successPopupPosition) ? state.settings.successPopupPosition : 'subtitle-center';
    toast.classList.add(`cmj-toast-${position}`);
    toast.style.top = ''; toast.style.bottom = '';
    if (position === 'subtitle-center') {
      const subtitle = $('.cmj-subtitle-layer');
      const rect = subtitle?.getBoundingClientRect?.();
      if (rect && rect.width > 0 && rect.height > 0) { toast.style.top = `${Math.min(window.innerHeight - 60, Math.max(8, rect.bottom + 12))}px`; toast.style.bottom = 'auto'; }
    }
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
