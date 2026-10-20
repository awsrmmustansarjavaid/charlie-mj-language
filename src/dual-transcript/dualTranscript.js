/*
 * Charlie MJ Language — Dual Transcript add-on v1.0.0 beta.
 *
 * ADDITIVE MODULE ONLY:
 * - Does not replace the existing Charlie MJ transcript engine.
 * - Does not modify the existing transcript data pipeline.
 * - Adds one toolbar button and one tab to the existing transcript window.
 * - Uses a separate storage namespace: cmjDualTranscriptSettings/cache.
 *
 * The YouTube-specific request/fetch work lives in dualTranscriptBridge.js,
 * which runs in MAIN world. This file is the isolated-world UI/controller.
 */
(() => {
  'use strict';
  if (window.__CMJ_LANGUAGE_DUAL_TRANSCRIPT_UI_V1__) return;
  window.__CMJ_LANGUAGE_DUAL_TRANSCRIPT_UI_V1__ = true;
  const SOURCE = 'CMJ_LANGUAGE_DUAL_TRANSCRIPT';
  const SETTINGS_KEY = 'cmjDualTranscriptSettings';
  const CACHE_KEY = 'cmjDualTranscriptCache';
  const CATALOG_KEY = 'cmjDualTranscriptLanguageCatalog';
  const SERVICE_KEY = 'cmjDualYouTubeServiceSettings';
  const DEFAULTS = {
    enabled: true,
    showToolbarButton: true,
    autoFetchOnPlay: true,
    targetLanguage: 'en',
    sourceLanguage: 'auto',
    sentenceMerging: true,
    cacheEnabled: true,
    cacheLimit: 20
  };
  const state = {
    settings: { ...DEFAULTS },
    videoId: '',
    sourceLanguage: '',
    sourceName: '',
    targetLanguage: 'en',
    sourceLanguage: 'auto',
    sourceCatalog: [],
    targetCatalog: [],
    translationCatalog: [],
    cues: [],
    sentences: [],
    translationAvailable: false,
    translationError: '',
    status: 'idle',
    panelOpen: false,
    observer: null,
    syncTimer: null,
    requestTimer: null,
    lastRequestedVideo: '',
    lastRenderedTab: false,
    dualActive: false,
    bodyObserver: null,
    lightweightSleep: false,
    resettingNetwork: false,
    dualLastActiveIndex: -1,
    dualManualScrollUntil: 0,
    dualProgrammaticScroll: false,
    dualLastAutoScrollAt: 0,
    dualManualResumeDelayMs: 1800
  };
  const $ = (s, root = document) => root.querySelector(s);
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const post = (type, payload = {}) => window.postMessage({ source: SOURCE, type, ...payload }, '*');
  async function loadSettings() {
    try {
      const stored = await chrome.storage.local.get([SETTINGS_KEY, SERVICE_KEY]);
      state.settings = { ...DEFAULTS, ...(stored[SETTINGS_KEY] || {}) };
      state.serviceSettings = { enabled: true, ...(stored[SERVICE_KEY] || {}) };
    } catch (_) {
    }
    state.targetLanguage = state.settings.targetLanguage || 'en';
    state.sourceLanguage = state.settings.sourceLanguage || 'auto';
  }
  async function saveCache(value) {
    if (!state.settings.cacheEnabled) return;
    try {
      const stored = await chrome.storage.local.get(CACHE_KEY);
      const cache = stored[CACHE_KEY] && typeof stored[CACHE_KEY] === 'object' ? stored[CACHE_KEY] : {};
      const key = `${value.videoId}|${value.sourceLanguage}|${value.targetLanguage}`;
      cache[key] = { ...value, cachedAt: Date.now() };
      const entries = Object.entries(cache).sort((a, b) => Number(b[1]?.cachedAt || 0) - Number(a[1]?.cachedAt || 0));
      const limit = Math.max(1, Math.min(100, Number(state.settings.cacheLimit) || 20));
      await chrome.storage.local.set({ [CACHE_KEY]: Object.fromEntries(entries.slice(0, limit)) });
    } catch (_) {
    }
  }
  async function getCache(videoId, sourceLanguage, targetLanguage) {
    if (!state.settings.cacheEnabled) return null;
    try {
      const stored = await chrome.storage.local.get(CACHE_KEY);
      const cache = stored[CACHE_KEY] || {};
      return cache[`${videoId}|${sourceLanguage}|${targetLanguage}`] || null;
    } catch (_) {
      return null;
    }
  }
  function videoId() {
    try {
      const player = document.querySelector('#movie_player');
      const id = player?.getVideoData?.()?.video_id;
      if (id) return id;
    } catch (_) {
    }
    try {
      const u = new URL(location.href);
      return u.searchParams.get('v') || (u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : '');
    } catch (_) {
      return '';
    }
  }
  function ensureUI() {
    if (!state.settings.enabled || !location.hostname.includes('youtube.com')) return;
    const toolbar = $('.cmj-toolbar');
    if (toolbar && state.settings.showToolbarButton !== false && !toolbar.querySelector('[data-cmj-dual-toolbar]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.cmjDualToolbar = '1';
      button.title = 'Open Dual Transcript';
      button.innerHTML = '🌐 <span>Dual Transcript</span>';
      button.className = 'cmj-dual-toolbar-button';
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openDualTab();
      });
      toolbar.insertBefore(button, toolbar.querySelector('.cmj-more-button') || null);
    }
    installMinimizedRestoreAffordance();
    installToolbarActionFallbacks();
    const panel = $('.cmj-panel');
    if (panel && !panel.__cmjDualBodyObserverReady) {
      panel.__cmjDualBodyObserverReady = true;
      const body = $('.cmj-panel-body', panel);
      if (body) {
        state.bodyObserver = new MutationObserver(() => {
          if (panel.hidden) {
            state.dualActive = false;
            state.panelOpen = false;
            panel.classList.remove('cmj-panel-dual-active');
            return;
          }
          if (state.dualActive && !body.querySelector('[data-cmj-dual-root]')) {
            queueMicrotask(() => {
              if (state.dualActive && !panel.hidden) renderPanel();
            });
          }
        });
        state.bodyObserver.observe(body, { childList: true });
      }
    }
    const tabs = $('.cmj-tabs');
    if (tabs && !tabs.querySelector('[data-cmj-dual-tab]')) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.dataset.cmjDualTab = '1';
      tab.textContent = 'Dual Transcript';
      tab.title = 'Original + YouTube auto-translated transcript';
      tab.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openDualTab();
      });
      tabs.appendChild(tab);
    }
  }
  function openDualTab() {
    if (!state.settings.enabled) return;
    const panel = $('.cmj-panel');
    if (panel) panel.hidden = false;
    state.panelOpen = true;
    state.dualActive = true;
    panel?.classList.add('cmj-panel-dual-active');
    document.querySelectorAll('[data-cmj-tab]').forEach(x => x.classList.remove('active'));
    const tab = $('[data-cmj-dual-tab]');
    tab?.classList.add('active');
    renderPanel();
    requestTranscript(true);
  }
  function requestTranscript(force = false) {
    const id = videoId();
    if (!id || state.lightweightSleep || !state.settings.enabled || state.serviceSettings?.enabled === false) return;
    state.videoId = id;
    state.targetLanguage = state.settings.targetLanguage || 'en';
    if (!force && state.lastRequestedVideo === id) return;
    state.lastRequestedVideo = id;
    state.status = 'loading';
    renderPanel();
    post('REQUEST_TRANSCRIPT', { targetLanguage: state.targetLanguage, sourceLanguage: state.sourceLanguage || 'auto' });
  }
  async function resetNetworkAndRetry() {
    state.status = 'loading';
    state.resettingNetwork = true;
    state.translationError = '';
    state.translationAvailable = false;
    state.cues = [];
    state.sentences = [];
    state.lastRequestedVideo = '';
    renderPanel();
    try {
      await chrome.storage.local.remove(CACHE_KEY);
    } catch (_) {
    }
    post('RESET_NETWORK');
    setTimeout(() => {
      if (!state.lightweightSleep) requestTranscript(true);
    }, 1200);
  }
  function setLightweightSleep(enabled) {
    state.lightweightSleep = Boolean(enabled);
    clearTimeout(state.requestTimer);
    state.requestTimer = null;
    if (state.lightweightSleep) {
      post('SET_LIGHTWEIGHT_SLEEP', { enabled: true });
      chrome.storage.local.set({ cmjLightweightSleepMode: true }).catch(() => {
      });
      if (state.syncTimer) {
        clearInterval(state.syncTimer);
        state.syncTimer = null;
      }
      state.status = 'idle';
      state.translationError = '';
      if (state.panelOpen) renderPanel();
    } else {
      post('SET_LIGHTWEIGHT_SLEEP', { enabled: false });
      chrome.storage.local.set({ cmjLightweightSleepMode: false }).catch(() => {
      });
      startSync();
    }
  }
  function normaliseLanguageCode(value) {
    return String(value || '').trim().toLowerCase().split('-')[0];
  }
  function uniqueLanguages(rows = []) {
    const seen = new Set();
    const out = [];
    for (const row of rows) {
      const code = String(row?.languageCode || '').trim();
      if (!code) continue;
      const key = normaliseLanguageCode(code);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ languageCode: code, name: String(row?.name || code).trim() || code, kind: row?.kind || '' });
    }
    return out;
  }
  function languageLabel(row) {
    const code = String(row?.languageCode || '').trim();
    const name = String(row?.name || '').trim();
    return name && normaliseLanguageCode(name) !== normaliseLanguageCode(code) ? `${name} (${code})` : (name || code);
  }
  function renderLanguageSelect(kind, value, rows, allowAuto = false) {
    const options = [];
    if (allowAuto) options.push(`<option value="auto">Auto (YouTube)</option>`);
    for (const row of uniqueLanguages(rows)) {
      const code = String(row.languageCode);
      options.push(`<option value="${esc(code)}"${normaliseLanguageCode(value) === normaliseLanguageCode(code) ? ' selected' : ''}>${esc(languageLabel(row))}</option>`);
    }
    if (!options.length) {
      options.push(`<option value="${esc(value || 'en')}" selected>${esc(value || 'en')}</option>`);
    }
    return `<label class="cmj-dual-language-field"><span>${kind === 'source' ? 'Original' : 'Target'}</span><select data-dual-language="${kind}">${options.join('')}</select></label>`;
  }
  function renderLanguageControls() {
    const sources = uniqueLanguages([
      ...(state.sourceCatalog || []),
      ...(state.translationCatalog || [])
    ]);
    const targets = uniqueLanguages([
      ...(state.targetCatalog || []),
      ...(state.translationCatalog || []),
      ...(state.sourceCatalog || [])
    ]);
    return `<div class="cmj-dual-language-controls">${renderLanguageSelect('source', state.sourceLanguage || 'auto', sources, true)}${renderLanguageSelect('target', state.targetLanguage || 'en', targets, false)}</div>`;
  }
  async function changeLanguage(kind, value) {
    const code = String(value || '').trim() || (kind === 'source' ? 'auto' : 'en');
    if (kind === 'source') state.sourceLanguage = code;
    else state.targetLanguage = code;
    state.settings.sourceLanguage = state.sourceLanguage;
    state.settings.targetLanguage = state.targetLanguage;
    try {
      await chrome.storage.local.set({ [SETTINGS_KEY]: state.settings });
    } catch (_) {
    }
    state.lastRequestedVideo = '';
    state.cues = [];
    state.sentences = [];
    state.translationAvailable = false;
    state.translationError = '';
    renderPanel();
    requestTranscript(true);
  }
  function renderStatus(extra = '') {
    const status = state.status === 'ready' ? 'Ready' : state.status === 'loading' ? 'Fetching YouTube transcript…' : state.status === 'error' ? 'Error' : 'Waiting';
    const detail = state.translationAvailable ? ` · ${state.sourceLanguage || 'source'} → ${state.targetLanguage}` : state.translationError ? ` · ${state.translationError}` : '';
    return `<div class="cmj-dual-status"><strong>${esc(status)}</strong><span>${esc(extra || detail)}</span><button type="button" data-dual-refresh>↻ Refresh</button></div>`;
  }
  function renderPanel() {
    if (!state.panelOpen) return;
    const body = $('.cmj-panel-body');
    if (!body) return;
    body.style.setProperty('--cmj-dual-speaker-color', colorValue(state.settings.speakerIconColor, '#ffd54a'));
    body.style.setProperty('--cmj-dual-speaker-size', `${Math.max(12, Math.min(32, Number(state.settings.speakerIconSize) || 18))}px`);
    body.innerHTML = `<div data-cmj-dual-root="1" class="cmj-dual-root">${renderStatus()}
      ${renderLanguageControls()}
      <div class="cmj-dual-toolbar-row"><span>Original: <strong>${esc(state.sourceName || state.sourceLanguage || '—')}</strong></span><span>Target: <strong>${esc(state.targetLanguage)}</strong></span><span>${state.cues.length ? `${state.cues.length} cues` : ''}</span></div>
      <div class="cmj-dual-list" role="list">${state.sentences.length ? state.sentences.map((row, i) => renderRow(row, i)).join('') : `<div class="cmj-dual-empty">Select the YouTube caption languages above, then the transcript will be fetched from YouTube.</div>`}</div></div>`;
    body.querySelector('[data-dual-refresh]')?.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      requestTranscript(true);
    });
    body.querySelector('[data-dual-language="source"]')?.addEventListener('change', e => changeLanguage('source', e.target.value));
    body.querySelector('[data-dual-language="target"]')?.addEventListener('change', e => changeLanguage('target', e.target.value));
    body.querySelectorAll('[data-dual-seek]').forEach(el => el.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      seek(Number(el.dataset.dualSeek || 0));
    }));
    body.querySelectorAll('[data-dual-save-sentence]').forEach(el => el.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      saveSentence(Number(el.dataset.dualSaveSentence));
    }));
    body.querySelectorAll('[data-dual-save-word]').forEach(el => el.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      saveWord(String(el.dataset.dualSaveWord || ''), Number(el.dataset.dualSaveTime || 0), String(el.dataset.dualSaveSentenceText || ''), String(el.dataset.dualSaveTranslation || ''));
    }));
    body.querySelectorAll('[data-dual-speak]').forEach(el => el.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      playSentence(Number(el.dataset.dualSpeak || 0));
    }));
    const dualList = $('.cmj-dual-list', body);
    if (dualList) bindDualTranscriptScroll(dualList);

    syncHighlight();
  }
  function colorValue(value, fallback) {
    const v = String(value || '').trim();
    return /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
  }
  function renderRow(row, index) {
    const words = String(row.original || '').split(/\s+/).filter(Boolean).map(word => `<button type="button" class="cmj-dual-word" data-dual-save-word="${esc(word.replace(/[.,!?;:]+$/g, ''))}" data-dual-save-time="${Number(row.start) || 0}" data-dual-save-sentence-text="${esc(row.original)}" data-dual-save-translation="${esc(row.translated || '')}" title="Save word to Library">${esc(word)}</button>`).join(' ');
    const speaker = state.settings.speakerIconEnabled !== false
      ? `<button type="button" class="cmj-dual-speaker" data-dual-speak="${Number(row.start) || 0}" aria-label="Play current sentence" title="Play current sentence"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg></button>` : '';
    const originalColor = colorValue(state.settings.originalColor, '#ffffff');
    const translatedColor = colorValue(state.settings.translatedColor, '#8fd3ff');
    return `<article class="cmj-dual-row" data-dual-row="${index}" data-dual-start="${Number(row.start) || 0}" data-dual-end="${Number(row.end) || 0}">
      <div class="cmj-dual-row-head"><div class="cmj-dual-row-tools"><button type="button" class="cmj-dual-time" data-dual-seek="${Number(row.start) || 0}">${formatTime(row.start)}</button>${speaker}</div><button type="button" data-dual-save-sentence="${index}">＋ Save sentence</button></div>
      <div class="cmj-dual-original" style="color:${originalColor}">${words}</div>
      <div class="cmj-dual-translation" style="color:${translatedColor}">${esc(row.translated || '—')}</div>
    </article>`;
  }
  function formatTime(seconds) {
    const s = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
  }
  function seek(time) {
    const video = document.querySelector('video');
    if (video) video.currentTime = Math.max(0, Number(time) || 0);
  }
  function playSentence(time) {
    const video = document.querySelector('video');
    if (!video) return;
    video.currentTime = Math.max(0, Number(time) || 0);
    const play = video.play?.();
    if (play?.catch) play.catch(() => {
    });
  }

  function bindDualTranscriptScroll(list) {
    if (!list || list.dataset.cmjDualScrollBound === 'true') return;

    list.dataset.cmjDualScrollBound = 'true';

    const markManualScroll = () => {
      if (state.dualProgrammaticScroll) return;

      state.dualManualScrollUntil =
        Date.now() + Math.max(
          800,
          Number(state.settings.dualManualResumeDelayMs || state.dualManualResumeDelayMs || 1800)
        );
    };

    list.addEventListener('wheel', markManualScroll, { passive: true });
    list.addEventListener('touchmove', markManualScroll, { passive: true });
    list.addEventListener('pointerdown', markManualScroll, { passive: true });

    list.addEventListener('scroll', () => {
      if (state.dualProgrammaticScroll) return;

      state.dualManualScrollUntil =
        Date.now() + Math.max(
          800,
          Number(state.settings.dualManualResumeDelayMs || state.dualManualResumeDelayMs || 1800)
        );
    }, { passive: true });
  }

  function autoFollowDualTranscript(list, activeIndex, video) {
    if (!list) return;
    if (!video || video.paused) return;
    if (!Number.isInteger(activeIndex) || activeIndex < 0) return;

    const settings = state.settings || {};

    const active = list.querySelector(
      `[data-dual-row="${activeIndex}"]`
    );

    if (!active) return;

    const manualUntil = Number(state.dualManualScrollUntil || 0);

    if (
      manualUntil > 0 &&
      Date.now() < manualUntil
    ) {
      return;
    }

    if (Date.now() - state.dualLastAutoScrollAt < 250) {
      return;
    }

    state.dualLastAutoScrollAt = Date.now();
    state.dualProgrammaticScroll = true;

    const position = settings.dualTranscriptScrollPosition || 'center';

    try {
      if (position === 'top') {
        list.scrollTo({
          top: Math.max(0, active.offsetTop - 8),
          behavior: 'smooth'
        });
      } else if (position === 'bottom') {
        list.scrollTo({
          top: Math.max(
            0,
            active.offsetTop -
              list.clientHeight +
              active.offsetHeight +
              8
          ),
          behavior: 'smooth'
        });
      } else {
        active.scrollIntoView({
          block: 'center',
          behavior: 'smooth'
        });
      }
    } catch (_) {
      active.scrollIntoView(false);
    }

    setTimeout(() => {
      state.dualProgrammaticScroll = false;
    }, 500);
  }

  function syncHighlight() {
    if (!state.panelOpen) return;
    const video = document.querySelector('video');
    const list = $('.cmj-dual-list');
    if (!video || !list) return;
    const t = Number(video.currentTime || 0);
    let active = -1, lo = 0, hi = state.sentences.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const row = state.sentences[mid];
      if (t < row.start) hi = mid - 1;
      else {
        active = mid;
        lo = mid + 1;
      }
    }
    list.querySelectorAll('.cmj-dual-row').forEach((row, i) => {
      const live = i === active;
      row.classList.toggle('cmj-dual-live', live);
      const speaker = row.querySelector('.cmj-dual-speaker');
      if (speaker) {
        speaker.classList.toggle('cmj-dual-speaker-live', live);
        speaker.setAttribute('aria-hidden', live ? 'false' : 'true');
      }
    });
    const manualScrollExpired =
      state.dualManualScrollUntil > 0 &&
      Date.now() >= state.dualManualScrollUntil;

    if (manualScrollExpired) {
      state.dualManualScrollUntil = 0;
    }

    if (active !== state.dualLastActiveIndex || manualScrollExpired) {
      state.dualLastActiveIndex = active;

      if (active >= 0) {
        autoFollowDualTranscript(list, active, video);
      }
    }
  }
  
  function startSync() {
    if (state.syncTimer) return;
    state.syncTimer = setInterval(syncHighlight, 80);
  }
  function applyTranscriptData(data) {
    if (!data || data.videoId !== videoId()) return;
    state.videoId = data.videoId;
    state.sourceLanguage = data.sourceLanguage || '';
    state.sourceName = data.sourceName || state.sourceLanguage;
    state.targetLanguage = data.targetLanguage || state.targetLanguage;
    state.translationAvailable = !!data.translationAvailable;
    state.translationError = data.translationError || '';
    state.cues = Array.isArray(data.original) ? data.original.map((c, i) => ({ ...c, id: i, translated: Array.isArray(data.translated) ? (data.translated[i]?.text || '') : '' })) : [];
    state.sentences = mergeSentences(state.cues);
    state.status = state.cues.length ? 'ready' : 'error';
    saveCache({ videoId: state.videoId, sourceLanguage: state.sourceLanguage, targetLanguage: state.targetLanguage, cues: state.cues, sentences: state.sentences, translationAvailable: state.translationAvailable, translationError: state.translationError });
    renderPanel();
  }
  function mergeSentences(cues) {
    if (state.settings.sentenceMerging === false) return cues.map((c, i) => ({ ...c, id: i, original: c.text, translated: c.translated || '' }));
    const out = [];
    let bucket = null;
    for (const cue of cues) {
      if (!bucket) bucket = { id: out.length, start: cue.start, end: cue.end, original: cue.text, translated: cue.translated || '' };
      else {
        bucket.original += /[-—]$/.test(bucket.original) || /^[,.;:!?，。！？、]/.test(cue.text) ? cue.text : ` ${cue.text}`;
        if (cue.translated) bucket.translated += (bucket.translated ? ' ' : '') + cue.translated;
        bucket.end = cue.end;
      }
      if (/[.!?。！？]+(?:['”’"»)]*)?$/.test(bucket.original.trim()) || bucket.original.length > 180) {
        out.push(bucket);
        bucket = null;
      }
    }
    if (bucket) out.push(bucket);
    return out.map((x, i) => ({ ...x, id: i }));
  }
  async function saveSentence(index) {
    const row = state.sentences[index];
    if (!row) return;
    try {
      const stored = await chrome.storage.local.get(['vocabulary', 'sentenceLearning']);
      const item = { id: crypto.randomUUID(), type: 'sentence', word: '', sentence: row.original, translation: row.translated || '', sentenceTranslation: row.translated || '', words: String(row.original).split(/\s+/).filter(Boolean).map(word => ({ word })), level: 'A1', levelLabel: 'Learner', stage: 'New', language: state.sourceLanguage || 'auto', videoId: state.videoId, videoTitle: document.title.replace(/\s*-\s*YouTube\s*$/i, ''), url: location.href, timestamp: Number(row.start) || 0, source: 'Dual Transcript', tags: ['YouTube', 'Dual Transcript'], createdAt: new Date().toISOString() };
      const duplicate = (stored.vocabulary || []).some(x => x?.type === 'sentence' && x.videoId === item.videoId && String(x.sentence || '') === item.sentence && Math.abs(Number(x.timestamp || 0) - item.timestamp) < 1.5);
      if (!duplicate) await chrome.storage.local.set({ vocabulary: [item, ...(stored.vocabulary || [])].slice(0, 5000), sentenceLearning: [item, ...(stored.sentenceLearning || [])].slice(0, 5000) });
      toast(duplicate ? 'Sentence is already in your Library.' : 'Sentence saved to your Library.');
    } catch (_) {
      toast('Could not save sentence.');
    }
  }
  function deriveWordTranslationFromSentence(word, sentence, sentenceTranslation) {
    const wanted = String(word || '').trim(), source = String(sentence || '').trim(), target = String(sentenceTranslation || '').trim();
    if (!wanted || !source || !target) return null;
    const clean = v => String(v || '').replace(/[“”\"'`]/g, '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'’_-]+$/gu, '').trim();
    const norm = v => clean(v).toLocaleLowerCase();
    const src = source.split(/\s+/).filter(Boolean), dst = target.split(/\s+/).filter(Boolean), wn = norm(wanted);
    const exact = dst.find(t => norm(t) === wn);
    if (exact) return { translation: clean(exact), provider: 'sentence-derived' };
    const si = src.findIndex(t => norm(t) === wn);
    if (si < 0) return null;
    if (src.length === 1) return { translation: target, provider: 'sentence-derived' };
    if (src.length === dst.length && dst[si]) return { translation: clean(dst[si]), provider: 'sentence-derived' };
    const anchors = [];
    src.forEach((t, i) => {
      const n = norm(t), ti = dst.findIndex(x => norm(x) === n);
      if (n && ti >= 0) anchors.push({ si: i, ti });
    });
    let before = null, after = null;
    for (const a of anchors) {
      if (a.si < si && (!before || a.si > before.si)) before = a;
      if (a.si > si && (!after || a.si < after.si)) after = a;
    }
    if (before && after) {
      const lo = Math.min(before.ti, after.ti), hi = Math.max(before.ti, after.ti), span = dst.slice(lo + 1, hi);
      if (span.length === 1) return { translation: clean(span[0]), provider: 'sentence-derived' };
    }
    return null;
  }
  async function saveWord(word, time, sentence, translation) {
    const clean = String(word || '').trim();
    if (!clean) return;
    try {
      const stored = await chrome.storage.local.get(['vocabulary', 'wordLearning']);
      let resolved = String(translation || '').trim();
      let provider = 'dual-youtube';
      if (!resolved || /^unavailable$/i.test(resolved)) {
        const d = deriveWordTranslationFromSentence(clean, sentence, translation);
        if (d?.translation) {
          resolved = d.translation;
          provider = d.provider;
        }
      }
      const item = { id: crypto.randomUUID(), type: 'word', word: clean, translation: resolved, sentence, sentenceTranslation: translation, translationProvider: provider, level: 'A1', levelLabel: 'Learner', stage: 'New', language: state.sourceLanguage || 'auto', videoId: state.videoId, videoTitle: document.title.replace(/\s*-\s*YouTube\s*$/i, ''), url: location.href, timestamp: Number(time) || 0, source: 'Dual Transcript', tags: ['YouTube', 'Dual Transcript'], createdAt: new Date().toISOString() };
      const duplicate = (stored.vocabulary || []).some(x => x?.type === 'word' && x.videoId === item.videoId && String(x.word || '').toLocaleLowerCase() === clean.toLocaleLowerCase() && Math.abs(Number(x.timestamp || 0) - item.timestamp) < 1.5);
      if (!duplicate) await chrome.storage.local.set({ vocabulary: [item, ...(stored.vocabulary || [])].slice(0, 5000), wordLearning: [item, ...(stored.wordLearning || [])].slice(0, 5000) });
      toast(duplicate ? `“${clean}” is already in your Library.` : `“${clean}” saved to your Library.`);
    } catch (_) {
      toast('Could not save word.');
    }
  }
  function toast(message) {
    let el = $('.cmj-dual-toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'cmj-dual-toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.hidden = false;
    clearTimeout(el.__t);
    el.__t = setTimeout(() => {
      el.hidden = true;
    }, 1800);
  }
  window.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.source !== SOURCE) return;
    if (data.type === 'TRACK_INFO') {
      state.videoId = data.videoId || state.videoId;
      state.sourceCatalog = uniqueLanguages(Array.isArray(data.tracks) ? data.tracks : []);
      state.translationCatalog = uniqueLanguages(Array.isArray(data.translationLanguages) ? data.translationLanguages : []);
      state.targetCatalog = uniqueLanguages([...(Array.isArray(data.translationLanguages) ? data.translationLanguages : []), ...(Array.isArray(data.tracks) ? data.tracks : [])]);
      if (state.sourceLanguage === 'auto' && data.sourceLanguage) state.sourceName = data.sourceName || data.sourceLanguage;
      chrome.storage.local.set({ [CATALOG_KEY]: { videoId: data.videoId || '', updatedAt: Date.now(), originals: Array.isArray(data.tracks) ? data.tracks : [], translations: Array.isArray(data.translationLanguages) ? data.translationLanguages : [] } }).catch(() => {
      });
      if (state.panelOpen) renderPanel();
    }
    if (data.type === 'FETCH_STATUS') {
      state.status = 'loading';
      if (state.panelOpen) renderPanel();
    }
    if (data.type === 'NETWORK_RESET_STATUS' && state.panelOpen) {
      state.status = data.status === 'sleep' ? 'idle' : 'loading';
      renderPanel();
    }
    if (data.type === 'TRANSCRIPT_ERROR') {
      state.status = 'error';
      state.translationError = data.error || 'YouTube transcript request failed';
      if (state.panelOpen) renderPanel();
      if (state.resettingNetwork) {
        state.resettingNetwork = false;
        setTimeout(() => setLightweightSleep(true), 500);
      }
    }
    if (data.type === 'TRANSCRIPT_DATA') {
      applyTranscriptData(data);
      if (state.resettingNetwork) {
        state.resettingNetwork = false;
        setTimeout(() => setLightweightSleep(true), 500);
      }
    }
  });
  function handleVideoChange() {
    const id = videoId();
    if (!id || id === state.videoId) return;
    state.videoId = id;
    state.cues = [];
    state.sentences = [];
    state.translationAvailable = false;
    state.translationError = '';
    state.lastRequestedVideo = '';
    if (state.settings.autoFetchOnPlay !== false) {
      clearTimeout(state.requestTimer);
      state.requestTimer = setTimeout(() => requestTranscript(false), 900);
    }
  }
  // Additive compatibility helper: the existing transcript window already owns
  // the real maximize action. We only provide a small hover-reveal restore
  // affordance while that window is minimized; clicking it delegates to the
  // existing maximize button instead of changing the original window logic.
  function installMinimizedRestoreAffordance() {
    const panel = $('.cmj-panel');
    if (!panel || panel.__cmjDualRestoreReady) return;
    panel.__cmjDualRestoreReady = true;
    let restore = document.createElement('button');
    restore.type = 'button';
    restore.className = 'cmj-dual-minimized-restore';
    restore.textContent = '□';
    restore.title = 'Restore transcript window';
    restore.setAttribute('aria-label', 'Restore transcript window');
    restore.hidden = true;
    restore.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      panel.querySelector('[data-cmj-action="maximize"]')?.click();
      restore.hidden = true;
    });
    document.body.appendChild(restore);
    panel.__cmjDualRestoreButton = restore;
    const update = event => {
      const minimized = panel.classList.contains('cmj-panel-minimized') && !panel.hidden;
      if (!minimized) {
        restore.hidden = true;
        return;
      }
      const r = panel.getBoundingClientRect();
      const zone = 90;
      const x = event?.clientX ?? -9999, y = event?.clientY ?? -9999;
      const near = x >= r.left - zone && x <= r.right + zone && y >= r.top - zone && y <= r.bottom + zone;
      if (near) {
        restore.hidden = false;
        restore.style.left = `${Math.max(4, Math.min(window.innerWidth - 42, r.right - 38))}px`;
        restore.style.top = `${Math.max(4, Math.min(window.innerHeight - 42, r.top + 6))}px`;
      } else if (!restore.matches(':hover')) restore.hidden = true;
    };
    document.addEventListener('pointermove', update, true);
    window.addEventListener('resize', () => {
      if (!restore.hidden) update();
    }, { passive: true });
    const observer = new MutationObserver(() => {
      if (!panel.classList.contains('cmj-panel-minimized')) restore.hidden = true;
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  }
  // Additive fallback for the two existing toolbar actions. The original
  // Charlie MJ handler always gets the first chance. If it did not persist
  // the action (for example after a transient extension-context reconnect),
  // this fallback writes the same existing storage records without changing
  // the original toolbar implementation.
  function installToolbarActionFallbacks() {
    const toolbar = $('.cmj-toolbar');
    if (!toolbar || toolbar.__cmjDualFallbackReady) return;
    toolbar.__cmjDualFallbackReady = true;
    toolbar.addEventListener('click', event => {
      const button = event.target.closest?.('[data-cmj-toolbar]');
      if (!button) return;
      const action = button.dataset.cmjToolbar;
      if (action !== 'bookmark' && action !== 'watch') return;
      const id = videoId();
      if (!id) return;
      setTimeout(async () => {
        try {
          if (action === 'watch') {
            const stored = await chrome.storage.local.get('watchLater');
            const list = Array.isArray(stored.watchLater) ? stored.watchLater : [];
            if (list.some(x => x?.videoId === id)) return;
            const title = document.title.replace(/\s*[-|]\s*YouTube\s*$/i, '').trim() || 'YouTube video';
            await chrome.storage.local.set({ watchLater: [{ id: crypto.randomUUID(), videoId: id, title, url: `https://www.youtube.com/watch?v=${id}`, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, source: 'Watch Later', level: 'Not assessed', tags: ['Watch Later'], progress: 0, addedAt: new Date().toISOString() }, ...list].slice(0, 5000) });
            toast('Added to Charlie MJ Watch Later.');
          } else {
            const video = document.querySelector('video');
            const timestamp = Number(video?.currentTime || 0);
            const stored = await chrome.storage.local.get('bookmarks');
            const list = Array.isArray(stored.bookmarks) ? stored.bookmarks : [];
            if (list.some(x => x?.videoId === id && Math.abs(Number(x.timestamp || 0) - timestamp) < 1.25)) return;
            const title = document.title.replace(/\s*[-|]\s*YouTube\s*$/i, '').trim() || 'YouTube video';
            await chrome.storage.local.set({ bookmarks: [{ id: crypto.randomUUID(), type: 'bookmark', title, videoTitle: title, url: location.href, videoId: id, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, source: 'Bookmarks', timestamp, subtitle: '', translation: '', label: 'Learning moment', tags: ['YouTube'], createdAt: new Date().toISOString() }, ...list].slice(0, 5000) });
            toast('Timeline bookmark saved to Bookmarks Library.');
          }
        } catch (_) {
        }
      }, 900);
    }, true);
  }
  function install() {
    ensureUI();
    installMinimizedRestoreAffordance();
    installToolbarActionFallbacks();
    startSync();
    let uiQueued = false;
    state.observer = new MutationObserver(() => {
      if (uiQueued) return;
      uiQueued = true;
      setTimeout(() => {
        uiQueued = false;
        ensureUI();
      }, 150);
    });
    state.observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('yt-navigate-finish', () => {
      state.lastRequestedVideo = '';
      setTimeout(handleVideoChange, 700);
    }, true);
    document.addEventListener('click', event => {
      const tab = event.target.closest?.('[data-cmj-tab]');
      const toolbarAction = event.target.closest?.('[data-cmj-toolbar]')?.dataset?.cmjToolbar;
      const windowAction = event.target.closest?.('[data-cmj-action]')?.dataset?.cmjAction;
      if ((tab && !tab.hasAttribute('data-cmj-dual-tab')) || toolbarAction === 'transcript' || windowAction === 'close') {
        state.panelOpen = false;
        state.dualActive = false;
        $('.cmj-panel')?.classList.remove('cmj-panel-dual-active');
      }
    }, true);
    document.addEventListener('play', () => {
      ensureUI();
      if (!state.lightweightSleep && state.settings.autoFetchOnPlay !== false) requestTranscript(false);
    }, true);
    setInterval(handleVideoChange, 3000);
  }
  (async () => {
    await loadSettings();
    try {
      const stored = await chrome.storage.local.get('cmjLightweightSleepMode');
      state.lightweightSleep = stored.cmjLightweightSleepMode === true;
    } catch (_) {
    }
    install();
    if (state.lightweightSleep) setLightweightSleep(true);
  })();
})();
