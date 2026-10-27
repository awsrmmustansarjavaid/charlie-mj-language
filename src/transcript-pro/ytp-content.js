/*
 * YT Transcript Pro - YouTube page controller.
 *
 *  - Puts a button inside the player control bar (position is a setting).
 *  - Builds the transcript panel (docked beside the video, or a draggable/resizable floating window).
 *  - Loads captions through the page bridge, aligns two languages, copies and downloads.
 *
 * DOM is built with createElement only (YouTube enforces Trusted Types, so innerHTML is avoided),
 * and the player button is placed with prepend()/before()/append() - never insertBefore() on a
 * reference node YouTube may have replaced.
 */
(() => {
  'use strict';
  const root = (window.YTP = window.YTP || {});
  if (root.__contentLoaded) return;
  root.__contentLoaded = true;

  // Cross-isolated-world integration bridge. Chrome can execute content-script
  // files in different isolated execution contexts, so the main Charlie MJ
  // controller must NOT depend on window.CMJTranscriptPro being directly
  // readable from its own context. The DOM event/attribute bridge below is
  // intentionally primitive-only and works across isolated worlds.
  const PRO_READY_EVENT = 'cmj-ytp-pro-ready';
  const PRO_COMMAND_EVENT = 'cmj-ytp-command';
  const pendingCommands = [];
  let proApiReady = false;
  const runProCommand = (command, value) => {
    if (!proApiReady || !root.CMJTranscriptPro) {
      pendingCommands.push({ command, value });
      return;
    }
    try {
      if (command === 'mount') {
        const hostId = value || document.documentElement?.dataset?.cmjYtpHostId || '';
        const host = hostId ? document.getElementById(String(hostId)) : null;
        if (host) root.CMJTranscriptPro.mount(host);
      } else if (command === 'unmount') {
        root.CMJTranscriptPro.unmount();
      } else if (command === 'refresh') {
        root.CMJTranscriptPro.refresh();
      }
    } catch (error) {
      console.error('[YT Transcript Pro] integration command failed:', error);
    }
  };
  document.addEventListener(PRO_COMMAND_EVENT, (event) => {
    const command =
      event?.detail?.command || document.documentElement?.dataset?.cmjYtpCommand || '';
    const value =
      event?.detail?.value || document.documentElement?.dataset?.cmjYtpCommandValue || '';
    runProCommand(command, value);
  });

  const { h, svg, clamp } = root;
  // Integrated mode: Charlie MJ owns the visible toolbar and transcript workspace.
  root.embeddedMode = true;

  const state = {
    settings: { ...root.DEFAULTS },
    videoId: '',
    info: null,
    tracks: [],
    translationLanguages: [],
    sourceTrack: null,
    targetCode: '',
    primary: [],
    secondary: [],
    raw: [],
    view: [],
    selected: new Set(),
    lastClicked: -1,
    rendered: [],
    activeIdx: -1,
    token: 0,
    loadPromise: null,
    lastManualScroll: 0,
    panel: null,
    button: null,
    els: {},
    status: { text: 'Ready', kind: '' },
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const alive = () => Boolean(chrome.runtime?.id);
  const S = () => state.settings;
  const log = (...a) => {
    if (S().debug) console.log('[YT Transcript Pro]', ...a);
  };

  /* ------------------------------------------------------------------ */
  /* Toast + status                                                      */
  /* ------------------------------------------------------------------ */
  let toastTimer;
  function toast(message, error = false) {
    if (!error && !S().notifyOnCopy) return;
    document.querySelectorAll('.ytp-toast').forEach((n) => n.remove());
    const host = document.fullscreenElement || document.body;
    const node = h(
      'div',
      { class: `ytp-toast${error ? ' ytp-toast-error' : ''}`, role: 'status' },
      message
    );
    host.append(node);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.remove(), error ? 5000 : 2200);
  }

  function setStatus(text, kind = '') {
    state.status = { text, kind };
    const el = state.els.status;
    if (el) {
      el.textContent = text;
      el.dataset.kind = kind;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Player button                                                       */
  /* ------------------------------------------------------------------ */
  function buildButton() {
    if (root.embeddedMode) {
      state.button?.remove();
      return;
    }
    if (!root.isWatchPage() || root.isShorts()) return;
    const controls = document.querySelector('.ytp-right-controls');
    if (!controls) return;

    if (!state.button) {
      state.button = h(
        'button',
        {
          id: 'ytp-player-button',
          class: 'ytp-button',
          type: 'button',
          title: 'YT Transcript Pro',
          'aria-label': 'Open transcript panel',
          'aria-pressed': 'false',
          onClick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            togglePanel();
          },
        },
        root.captionIcon()
      );
    }
    const button = state.button;
    const pos = S().buttonPosition;
    const settingsBtn = controls.querySelector('.ytp-settings-button');

    if (pos === 'end') {
      if (button.parentElement !== controls || controls.lastElementChild !== button)
        controls.append(button);
    } else if (pos === 'beforeSettings' && settingsBtn) {
      if (settingsBtn.previousElementSibling !== button) settingsBtn.before(button);
    } else if (button.parentElement !== controls || controls.firstElementChild !== button) {
      controls.prepend(button);
    }
    button.setAttribute('aria-pressed', String(isOpen()));
    button.classList.toggle('ytp-on', isOpen());
  }

  /* ------------------------------------------------------------------ */
  /* Panel                                                               */
  /* ------------------------------------------------------------------ */
  const isOpen = () => Boolean(state.panel?.classList.contains('ytp-open'));
  const dockHost = () =>
    document.querySelector('ytd-watch-flexy #secondary-inner') ||
    document.querySelector('#secondary-inner') ||
    document.querySelector('#secondary');
  const effectiveMode = () =>
    S().panelMode === 'floating' || root.isShorts() || !dockHost() ? 'floating' : 'docked';

  function iconButton(label, children, onClick) {
    return h(
      'button',
      { class: 'ytp-icon-btn', type: 'button', title: label, 'aria-label': label, onClick },
      children
    );
  }
  const line = (x1, y1, x2, y2) => svg('line', { x1, y1, x2, y2 });
  const iconSvg = (...kids) =>
    svg(
      'svg',
      {
        viewBox: '0 0 24 24',
        width: 18,
        height: 18,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        'aria-hidden': 'true',
      },
      ...kids
    );

  function buildPanel() {
    if (state.panel) return state.panel;
    const els = state.els;

    els.source = h(
      'select',
      {
        id: 'ytp-source',
        'aria-label': 'Original language',
        onChange: (e) => loadPrimary(e.target.value),
      },
      h('option', { value: '' }, 'Loading…')
    );
    els.target = h(
      'select',
      {
        id: 'ytp-target',
        'aria-label': 'Translation language',
        onChange: (e) => setTarget(e.target.value),
      },
      h('option', { value: '' }, 'Off')
    );
    els.search = h('input', {
      id: 'ytp-search',
      type: 'search',
      placeholder: 'Search transcript…',
      'aria-label': 'Search transcript',
      onInput: root.debounce(() => render(), 120),
    });
    els.count = h('span', { class: 'ytp-count' });
    els.lines = h('div', { class: 'ytp-lines', role: 'list' });
    els.status = h('span', { class: 'ytp-status', role: 'status' }, 'Ready');
    els.selBtn = h(
      'button',
      { class: 'ytp-btn ytp-hidden', type: 'button', onClick: copySelected },
      'Copy selected'
    );
    els.saveSelBtn = h(
      'button',
      {
        class: 'ytp-btn ytp-hidden',
        type: 'button',
        onClick: saveSelected,
        title: 'Save the selected subtitles to My Library › Subtitle Learning',
      },
      'Save selected'
    );
    els.formats = h('div', { class: 'ytp-formats' });

    const toggle = (key, label, after) => {
      const input = h('input', {
        type: 'checkbox',
        onChange: (e) => {
          Settings_set({ [key]: e.target.checked });
          after?.();
        },
      });
      els['t_' + key] = input;
      return h('label', { class: 'ytp-toggle' }, input, label);
    };

    const headerActions = [
      iconButton(
        'Swap language order',
        iconSvg(
          svg('path', { d: 'M7 4 3 8l4 4' }),
          line(3, 8, 21, 8),
          svg('path', { d: 'm17 20 4-4-4-4' }),
          line(21, 16, 3, 16)
        ),
        () => Settings_set({ swapOrder: !S().swapOrder })
      ),
      iconButton(
        'Refresh transcript',
        iconSvg(
          svg('path', { d: 'M20 11a8 8 0 0 0-14.9-4' }),
          svg('path', { d: 'M4 4v5h5' }),
          svg('path', { d: 'M4 13a8 8 0 0 0 14.9 4' }),
          svg('path', { d: 'M20 20v-5h-5' })
        ),
        () => loadVideo()
      ),
      iconButton(
        'Dock or float the window',
        iconSvg(
          svg('rect', { x: 3, y: 4, width: 18, height: 14, rx: 2 }),
          svg('rect', { x: 12, y: 11, width: 7, height: 5, rx: 1 })
        ),
        () => {
          Settings_set({ panelMode: S().panelMode === 'floating' ? 'docked' : 'floating' });
          applySettings(state.settings);
        }
      ),
      iconButton(
        'Open settings',
        iconSvg(
          line(4, 6, 20, 6),
          line(4, 12, 20, 12),
          line(4, 18, 20, 18),
          svg('circle', { cx: 9, cy: 6, r: 2, fill: 'var(--ytp-bg)' }),
          svg('circle', { cx: 15, cy: 12, r: 2, fill: 'var(--ytp-bg)' }),
          svg('circle', { cx: 8, cy: 18, r: 2, fill: 'var(--ytp-bg)' })
        ),
        () =>
          chrome.runtime
            .sendMessage({ type: 'ytp:openOptions', category: 'YT Transcript Pro' })
            .catch(() => {})
      ),
      iconButton('Close', iconSvg(line(6, 6, 18, 18), line(18, 6, 6, 18)), closePanel),
    ];

    els.header = h(
      'header',
      { class: 'ytp-header' },
      h(
        'div',
        { class: 'ytp-brand' },
        h('span', { class: 'ytp-logo' }, root.captionIcon(20)),
        h(
          'div',
          { class: 'ytp-brand-text' },
          h('strong', {}, 'YT Transcript Pro'),
          (els.videoLine = h('small', {}, 'Transcript & dual subtitles'))
        )
      ),
      h('div', { class: 'ytp-header-actions' }, ...headerActions)
    );

    const panelChildren = [
      h(
        'div',
        { class: 'ytp-langs' },
        h('label', {}, h('span', {}, 'Original'), els.source),
        h('label', {}, h('span', {}, 'Translation'), els.target)
      ),
      h(
        'div',
        { class: 'ytp-actions ytp-actions-copy' },
        h(
          'button',
          {
            class: 'ytp-btn ytp-primary',
            type: 'button',
            onClick: () => doCopy({ timestamps: true }),
          },
          'Copy with timestamps'
        ),
        h(
          'button',
          {
            class: 'ytp-btn ytp-primary',
            type: 'button',
            onClick: () => doCopy({ timestamps: false }),
          },
          'Copy without timestamps'
        )
      ),
      h('div', { class: 'ytp-actions ytp-actions-secondary' }, els.selBtn, els.saveSelBtn),
      h(
        'div',
        { class: 'ytp-toggles' },
        toggle('timestamps', 'Timestamps', () => render()),
        toggle('dualMode', 'Dual language', () => render()),
        toggle('autoScroll', 'Auto-scroll')
      ),
      h('div', { class: 'ytp-search-row' }, els.search, els.count),
      els.lines,
    ];

    const panel = h(
      'section',
      { id: 'ytp-panel', 'aria-label': 'YT Transcript Pro', data: { mode: 'docked' } },
      els.header,
      h('div', { class: 'ytp-body' }, ...panelChildren),
      h(
        'footer',
        { class: 'ytp-footer' },
        els.status,
        h('span', { class: 'ytp-hint' }, 'Ctrl+click selects lines')
      )
    );

    // Typing in the panel must never trigger YouTube's one-key shortcuts (k, f, m ...).
    ['keydown', 'keyup', 'keypress'].forEach((t) =>
      panel.addEventListener(t, (e) => {
        if (!e.altKey && !e.ctrlKey && !e.metaKey) e.stopPropagation();
      })
    );

    proFollower().bind(els.lines); // manual scroll detection + video seek/play handling (shared CMJScroll)

    setupDrag(panel);
    setupResizeSave(panel);
    state.panel = panel;
    buildFormatButtons();
    syncToggles();
    root.applyTheme(panel, S());
    attachPanel();
    return panel;
  }

  function buildFormatButtons() {
    const wrap = state.els.formats;
    if (!wrap) return;
    wrap.replaceChildren(
      ...String(S().showFormats)
        .split(',')
        .filter(Boolean)
        .map((f) =>
          h(
            'button',
            { class: 'ytp-btn ytp-small', type: 'button', onClick: () => doDownload(f) },
            f.toUpperCase()
          )
        )
    );
  }

  function syncToggles() {
    const e = state.els;
    if (!e.t_timestamps) return;
    e.t_timestamps.checked = S().timestamps;
    e.t_dualMode.checked = S().dualMode;
    e.t_autoScroll.checked = S().autoScroll;
  }

  function attachPanel() {
    const p = state.panel;
    if (!p) return;
    if (root.embeddedMode) {
      const host = root.embeddedHost && root.embeddedHost.isConnected ? root.embeddedHost : null;
      if (S().panelMode === 'floating') {
        // FLOAT: detach from the Transcript window tab into a draggable / resizable window.
        p.dataset.mode = 'floating';
        const fsHost = document.fullscreenElement || document.body;
        if (p.parentElement !== fsHost) fsHost.append(p);
        positionFloating();
        if (host) showFloatingPlaceholder(host);
        return;
      }
      // DOCK: put the panel back inside the Transcript window tab.
      p.dataset.mode = 'embedded';
      p.style.left = p.style.top = p.style.width = p.style.height = '';
      if (host) {
        hideFloatingPlaceholder();
        if (p.parentElement !== host) host.append(p);
      } else if (p.parentElement) {
        p.remove(); // docked but its tab is not showing
      }
      return;
    }
    const mode = effectiveMode();
    p.dataset.mode = mode;
    if (mode === 'floating') {
      const host = document.fullscreenElement || document.body;
      if (p.parentElement !== host) host.append(p);
      positionFloating();
    } else {
      p.style.left = p.style.top = p.style.width = p.style.height = '';
      const host = dockHost();
      if (host && (p.parentElement !== host || host.firstElementChild !== p)) host.prepend(p);
    }
  }

  function showFloatingPlaceholder(host) {
    if (!state.placeholder) {
      state.placeholder = h(
        'div',
        {
          class: 'ytp-float-placeholder',
          style: 'padding:18px;text-align:center;font:14px/1.5 system-ui,sans-serif;opacity:.85',
        },
        h('p', { style: 'margin:0 0 10px' }, 'YT Transcript Pro is floating in its own window.'),
        h(
          'button',
          {
            class: 'cmj-ytp-dock-back',
            type: 'button',
            style:
              'cursor:pointer;padding:6px 14px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit',
            onClick: () =>
              Settings_set({ panelMode: 'docked' }).then(() => applySettings(state.settings)),
          },
          'Dock it back here'
        )
      );
    }
    if (state.placeholder.parentElement !== host) host.replaceChildren(state.placeholder);
  }
  function hideFloatingPlaceholder() {
    state.placeholder?.remove();
  }

  function positionFloating() {
    const p = state.panel;
    if (!p || p.dataset.mode !== 'floating') return;
    const w = Math.min(S().panelWidth, window.innerWidth - 16),
      hgt = Math.min(S().panelHeight, window.innerHeight - 16);
    p.style.width = `${w}px`;
    p.style.height = `${hgt}px`;
    const x = S().floatX >= 0 ? S().floatX : window.innerWidth - w - 24;
    const y = S().floatY >= 0 ? S().floatY : 72;
    p.style.left = `${clamp(x, 8, Math.max(8, window.innerWidth - w - 8))}px`;
    p.style.top = `${clamp(y, 8, Math.max(8, window.innerHeight - 80))}px`;
  }

  function setupDrag(panel) {
    let drag = null;
    state.els.header.addEventListener('pointerdown', (e) => {
      if (panel.dataset.mode !== 'floating' || e.target.closest('button')) return;
      const r = panel.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      state.els.header.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    state.els.header.addEventListener('pointermove', (e) => {
      if (!drag) return;
      panel.style.left = `${clamp(e.clientX - drag.dx, 0, window.innerWidth - 80)}px`;
      panel.style.top = `${clamp(e.clientY - drag.dy, 0, window.innerHeight - 40)}px`;
    });
    const end = (e) => {
      if (!drag) return;
      drag = null;
      try {
        state.els.header.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      Settings_set({
        floatX: Math.round(parseFloat(panel.style.left)),
        floatY: Math.round(parseFloat(panel.style.top)),
      });
    };
    state.els.header.addEventListener('pointerup', end);
    state.els.header.addEventListener('pointercancel', end);
  }

  function setupResizeSave(panel) {
    if (typeof ResizeObserver === 'undefined') return;
    const save = root.debounce(() => {
      if (panel.dataset.mode !== 'floating' || !isOpen()) return;
      const w = Math.round(panel.offsetWidth),
        hgt = Math.round(panel.offsetHeight);
      if (w > 200 && hgt > 200 && (w !== S().panelWidth || hgt !== S().panelHeight))
        Settings_set({ panelWidth: w, panelHeight: hgt });
    }, 500);
    new ResizeObserver(save).observe(panel);
  }

  function openPanel() {
    const panel = buildPanel();
    attachPanel();
    panel.classList.add('ytp-open');
    buildButton();
    if (state.videoId !== root.getVideoId() || (!state.tracks.length && !state.loadPromise))
      loadVideo();
  }
  function closePanel() {
    state.panel?.classList.remove('ytp-open');
    if (!root.embeddedHost && state.panel?.dataset.mode === 'floating') {
      root.embeddedMode = false;
      state.panel.remove();
    } // floating window closed after its tab was left
    buildButton();
  }
  function togglePanel() {
    isOpen() ? closePanel() : openPanel();
  }

  /* ------------------------------------------------------------------ */
  /* Loading captions                                                    */
  /* ------------------------------------------------------------------ */
  function resetData() {
    Object.assign(state, {
      info: null,
      tracks: [],
      translationLanguages: [],
      sourceTrack: null,
      targetCode: '',
      primary: [],
      secondary: [],
      raw: [],
      view: [],
      rendered: [],
      activeIdx: -1,
    });
    state.selected.clear();
    state.lastClicked = -1;
  }

  function loadVideo() {
    state.loadPromise = (async () => {
      const videoId = root.getVideoId();
      if (!videoId) return;
      const token = ++state.token;
      buildPanel();
      resetData();
      state.videoId = videoId;
      updateVideoLine();
      setStatus('Detecting captions…', 'busy');
      renderEmpty('Loading transcript…');
      try {
        let info = await root.loadVideoInfo(videoId);
        if (!info.tracks.length && !info.playabilityReason) {
          await wait(1200);
          info = await root.loadVideoInfo(videoId);
        }
        if (token !== state.token) return;
        state.info = info;
        state.tracks = info.tracks;
        state.translationLanguages = info.translationLanguages;
        updateVideoLine();
        fillLanguageSelects();
        if (!info.tracks.length) {
          const why =
            info.playabilityReason ||
            'This video has no captions, or captions are turned off by the uploader.';
          setStatus('No captions found', 'error');
          renderEmpty(why);
          return;
        }
        const source = root.pickSourceTrack(info.tracks, S());
        state.els.source.value = source.id;
        await loadPrimary(source.id, { keepTarget: false, token });
        if (token !== state.token) return;
        const want = S().rememberLanguages ? S().targetLanguage : '';
        if (want && S().dualMode && want !== source.languageCode) {
          state.els.target.value = want;
          await setTarget(state.els.target.value, { silent: true });
        }
      } catch (error) {
        if (token !== state.token) return;
        setStatus(error.message, 'error');
        renderEmpty(error.message);
      }
    })().finally(() => {
      state.loadPromise = null;
    });
    return state.loadPromise;
  }

  function updateVideoLine() {
    const el = state.els.videoLine;
    if (el)
      el.textContent = state.info?.title || root.getVideoTitle() || 'Transcript & dual subtitles';
  }

  function fillLanguageSelects() {
    const { source, target } = state.els;
    source.replaceChildren(
      ...(state.tracks.length
        ? state.tracks.map((t) => h('option', { value: t.id }, root.getTrackLabel(t)))
        : [h('option', { value: '' }, 'No captions')])
    );
    const nativeCodes = new Set();
    const nativeOptions = [];
    state.tracks.forEach((t) => {
      if (!nativeCodes.has(t.languageCode)) {
        nativeCodes.add(t.languageCode);
        nativeOptions.push(
          h(
            'option',
            { value: t.languageCode },
            `${root.languageLabel(t.languageCode)} (${t.languageCode})`
          )
        );
      }
    });
    const translatable = state.translationLanguages
      .filter((l) => !nativeCodes.has(l.languageCode))
      .map((l) =>
        h(
          'option',
          { value: l.languageCode },
          `${l.name || root.languageLabel(l.languageCode)} (${l.languageCode})`
        )
      );
    target.replaceChildren(
      h('option', { value: '' }, 'Off'),
      nativeOptions.length
        ? h('optgroup', { label: 'Caption tracks on this video' }, nativeOptions)
        : null,
      translatable.length ? h('optgroup', { label: 'Translate with YouTube' }, translatable) : null
    );
  }

  async function loadPrimary(id, { keepTarget = true, token = state.token } = {}) {
    const track = state.tracks.find((t) => t.id === id);
    if (!track) return;
    state.sourceTrack = track;
    state.els.source.value = track.id;
    if (S().rememberLanguages) Settings_set({ sourceLanguage: track.languageCode });
    setStatus('Loading transcript…', 'busy');
    try {
      const rows = await root.fetchCaptionTrack(track);
      if (token !== state.token) return;
      state.primary = rows;
      state.secondary = [];
      recompute();
      render();
      setStatus(`${rows.length} lines · ${root.getTrackLabel(track)}`, 'ok');
      if (keepTarget && state.targetCode) await setTarget(state.targetCode, { silent: true });
    } catch (error) {
      if (token !== state.token) return;
      state.primary = [];
      state.raw = [];
      state.view = [];
      renderEmpty(error.message);
      setStatus(error.message, 'error');
    }
  }

  async function setTarget(code, { silent = false } = {}) {
    const token = state.token;
    state.targetCode = code || '';
    if (!silent && S().rememberLanguages)
      Settings_set({ targetLanguage: state.targetCode, ...(code ? { dualMode: true } : {}) });
    else if (code && !S().dualMode && !silent) Settings_set({ dualMode: true });
    if (!code || !state.sourceTrack || code === state.sourceTrack.languageCode) {
      state.targetCode = '';
      state.secondary = [];
      recompute();
      render();
      return;
    }
    setStatus(`Loading ${root.languageLabel(code)}…`, 'busy');
    try {
      const native = state.tracks
        .filter((t) => t.languageCode === code)
        .sort((a, b) => (a.kind === 'asr') - (b.kind === 'asr'))[0];
      if (!native && !state.sourceTrack.isTranslatable)
        throw new Error("YouTube does not allow translating this video's captions.");
      const rows = await root.fetchCaptionTrack(native || state.sourceTrack, native ? '' : code);
      if (token !== state.token) return;
      state.secondary = rows;
      recompute();
      render();
      setStatus(
        `Dual transcript ready · ${root.languageLabel(state.sourceTrack.languageCode)} + ${root.languageLabel(code)}`,
        'ok'
      );
    } catch (error) {
      if (token !== state.token) return;
      state.secondary = [];
      recompute();
      render();
      setStatus(`Translation unavailable: ${error.message}`, 'error');
      toast(error.message, true);
    }
  }

  function recompute() {
    state.raw = root.alignTracks(state.primary, state.secondary);
    state.view = root.prepareSegments(state.raw, S());
    state.selected.clear();
    state.lastClicked = -1;
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */
  function renderEmpty(message) {
    const { lines, count } = state.els;
    if (!lines) return;
    lines.replaceChildren(h('div', { class: 'ytp-empty' }, message));
    count.textContent = '';
    state.rendered = [];
  }

  function highlight(text, query) {
    if (!query) return text;
    const out = [];
    const lower = text.toLocaleLowerCase();
    const q = query.toLocaleLowerCase();
    let i = 0,
      at;
    while ((at = lower.indexOf(q, i)) !== -1) {
      if (at > i) out.push(text.slice(i, at));
      out.push(h('mark', {}, text.slice(at, at + q.length)));
      i = at + q.length;
    }
    out.push(text.slice(i));
    return out;
  }

  function render() {
    const { lines, count, search } = state.els;
    if (!lines) return;
    const s = S();
    const hasTr = state.view.some((r) => r.translation);
    const cols = root.columns(s, hasTr);
    const query = (search.value || '').trim();
    const long = state.view.length ? state.view[state.view.length - 1].start >= 3600 : false;
    const stampSettings = { ...s, timestampWrap: 'none' };
    const frag = document.createDocumentFragment();
    const hadRows = state.rendered.length > 0;
    const keepTop = lines.scrollTop;
    const queryChanged = query !== (state.lastQuery || '');
    state.lastQuery = query;
    state.rendered = [];

    state.view.forEach((r, i) => {
      if (
        query &&
        !`${r.text} ${r.translation}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
      )
        return;
      const parts = [{ key: cols.first, cls: 'ytp-orig' }];
      if (cols.second) parts.push({ key: cols.second, cls: 'ytp-trans' });
      const visible = parts
        .filter((p) => {
          if (!cols.dual) return true;
          return p.key === 'text' ? s.showOriginal : s.showTranslation;
        })
        .filter((p) => r[p.key]);
      const text = h(
        'div',
        { class: 'ytp-text', dir: 'auto' },
        visible.map((p, n) => [
          n > 0 && s.dualLayout === 'delimited'
            ? h('span', { class: 'ytp-delim' }, s.delimiter.trim() || '|')
            : null,
          h(
            'div',
            { class: p.key === 'text' ? 'ytp-orig' : 'ytp-trans', dir: 'auto' },
            highlight(r[p.key], query)
          ),
        ])
      );
      const row = h(
        'article',
        { class: 'ytp-line', role: 'listitem', data: { i, start: r.start } },
        s.timestamps
          ? h(
              'button',
              {
                class: 'ytp-time',
                type: 'button',
                title: 'Jump to this moment',
                onClick: (e) => {
                  e.stopPropagation();
                  seek(r.start);
                },
              },
              root.formatStamp(r.start, stampSettings, long)
            )
          : null,
        text,
        s.showLineCopy
          ? h(
              'button',
              {
                class: 'ytp-copy-line',
                type: 'button',
                title: 'Copy this line with its translation',
                'aria-label': 'Copy this line',
                onClick: (e) => {
                  e.stopPropagation();
                  copyLine(i, row);
                },
              },
              iconSvg(
                svg('rect', { x: 9, y: 9, width: 11, height: 11, rx: 2 }),
                svg('path', { d: 'M5 15V6a2 2 0 0 1 2-2h8' })
              )
            )
          : null,
        s.showLineSave !== false
          ? h(
              'button',
              {
                class: 'ytp-copy-line ytp-save-line',
                type: 'button',
                title: 'Save this subtitle and its translation to My Library › Subtitle Learning',
                'aria-label': 'Save this subtitle to My Library',
                onClick: (e) => {
                  e.stopPropagation();
                  saveLines([i], row);
                },
              },
              iconSvg(
                svg('path', { d: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z' }),
                line(12, 7, 12, 12),
                line(9.5, 9.5, 14.5, 9.5)
              )
            )
          : null
      );
      row.addEventListener('click', (e) => onLineClick(e, i, r));
      if (state.selected.has(i)) row.classList.add('ytp-selected');
      state.rendered.push({ start: r.start, el: row, i });
      frag.append(row);
    });

    lines.replaceChildren(frag);
    count.textContent = query
      ? `${state.rendered.length} of ${state.view.length}`
      : `${state.view.length} lines`;
    if (!state.rendered.length)
      renderEmpty(
        state.view.length ? 'No lines match your search.' : 'The transcript will appear here.'
      );
    state.activeIdx = -1;
    updateSelButton();
    if (queryChanged) lines.scrollTop = 0;
    else if (hadRows) lines.scrollTop = keepTop; // re-render (settings, translation): keep the learner's position
    syncHighlight(true);
    if (!hadRows && !query) followNow(); // first rows for this video: show the line playing now
  }

  function onLineClick(event, i, row) {
    if (window.getSelection()?.toString()) return; // user is selecting text, not seeking
    if (event.ctrlKey || event.metaKey) {
      toggleSelected(i);
      return;
    }
    if (event.shiftKey && state.lastClicked >= 0) {
      const [a, b] = [Math.min(i, state.lastClicked), Math.max(i, state.lastClicked)];
      for (let n = a; n <= b; n += 1) state.selected.add(n);
      refreshSelection();
      return;
    }
    if (S().clickToSeek) seek(row.start);
  }
  function toggleSelected(i) {
    state.selected.has(i) ? state.selected.delete(i) : state.selected.add(i);
    state.lastClicked = i;
    refreshSelection();
  }
  function refreshSelection() {
    state.rendered.forEach(({ el, i }) =>
      el.classList.toggle('ytp-selected', state.selected.has(i))
    );
    updateSelButton();
  }
  function updateSelButton() {
    const b = state.els.selBtn;
    if (!b) return;
    b.classList.toggle('ytp-hidden', state.selected.size === 0);
    b.textContent = `Copy selected (${state.selected.size})`;
    const sb = state.els.saveSelBtn;
    if (sb) {
      sb.classList.toggle('ytp-hidden', state.selected.size === 0);
      sb.textContent = `Save selected (${state.selected.size})`;
    }
  }

  function seek(start) {
    const v = root.getVideo();
    if (v) v.currentTime = Math.max(0, (Number(start) || 0) + (Number(S().seekOffset) || 0));
  }

  /* ------------------------------------------------------------------ */
  /* Playback sync                                                       */
  /* ------------------------------------------------------------------ */
  // Scrolling is handled by the shared CMJScroll controller (src/lib/transcript-scroll.js):
  // follows the video while playing, stays still while paused, re-syncs on seek, respects manual scrolling.
  let followerInstance = null;
  function proFollower() {
    if (!followerInstance) {
      followerInstance = window.CMJScroll.create({
        key: 'pro',
        getVideo: () => root.getVideo(),
        extraAllowed: () => S().autoScroll !== false, // the tab's own Auto-scroll switch
        getActiveRow: () => syncHighlight(true),
      });
    }
    return followerInstance;
  }
  /** Jump to the line that is active now (opening the tab, first rows, seeks). Ignores pause and manual hold. */
  function followNow() {
    requestAnimationFrame(() => {
      const row = syncHighlight(true);
      if (row) proFollower().follow(row, { hard: true, instant: true });
    });
  }

  /* Highlights the line that matches video.currentTime (playing, paused or after a seek) and, when the
   * active line changes, lets the follower move the list (time-driven: never while paused). Returns the row. */
  function syncHighlight(force = false) {
    if (!isOpen() || !state.rendered.length) return null;
    const v = root.getVideo();
    if (!v) return null;
    const t = v.currentTime + 0.15;
    let lo = 0,
      hi = state.rendered.length - 1,
      idx = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (state.rendered[mid].start <= t) {
        idx = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    const changed = idx !== state.activeIdx;
    if (changed || force) {
      state.rendered[state.activeIdx]?.el.classList.remove('ytp-active');
      state.activeIdx = idx;
      if (idx >= 0 && S().highlightCurrent) state.rendered[idx].el.classList.add('ytp-active');
    }
    const row = idx >= 0 ? state.rendered[idx].el : null;
    if (changed && row) proFollower().follow(row, { hard: false });
    return row;
  }

  /* ------------------------------------------------------------------ */
  /* Copy / download                                                     */
  /* ------------------------------------------------------------------ */
  function meta() {
    const src = state.sourceTrack,
      tc = state.targetCode;
    return {
      title: state.info?.title || root.getVideoTitle(),
      videoId: state.videoId,
      channel: state.info?.author || '',
      url: `https://www.youtube.com/watch?v=${state.videoId}`,
      lang: [src?.languageCode, tc].filter(Boolean).join('-'),
      sourceLabel: src ? root.getTrackLabel(src) : '',
      targetLabel: tc ? root.languageLabel(tc) : '',
    };
  }

  async function ensureLoaded() {
    if (!state.view.length || state.videoId !== root.getVideoId()) {
      buildPanel();
      await (state.loadPromise || loadVideo());
    }
    if (!state.view.length)
      throw new Error(
        state.status.kind === 'error'
          ? state.status.text
          : 'No transcript is available for this video.'
      );
  }

  async function doCopy({ timestamps, scope } = {}) {
    try {
      await ensureLoaded();
      const text = root.formatPlain(state.view, S(), meta(), { timestamps, scope });
      await root.copyText(text);
      const bits = [
        timestamps === false ? 'without timestamps' : timestamps === true ? 'with timestamps' : '',
        scope === 'original' ? 'original only' : scope === 'translation' ? 'translation only' : '',
      ]
        .filter(Boolean)
        .join(', ');
      toast(`Transcript copied${bits ? ` (${bits})` : ''} · ${state.view.length} lines`);
      setStatus('Copied to clipboard', 'ok');
      return { ok: true };
    } catch (error) {
      toast(error.message, true);
      setStatus(error.message, 'error');
      return { ok: false, error: error.message };
    }
  }

  async function copyLine(i, rowEl) {
    const r = state.view[i];
    if (!r) return;
    const s = {
      ...S(),
      dualMode: true,
      includeHeader: false,
      mergeParagraphs: false,
      copyScope: S().lineCopyScope,
    };
    try {
      await root.copyText(
        root.formatPlain([r], s, meta(), {
          timestamps: S().lineCopyTimestamp,
          scope: S().lineCopyScope,
        })
      );
      rowEl?.classList.add('ytp-copied');
      setTimeout(() => rowEl?.classList.remove('ytp-copied'), 700);
      toast(
        r.translation && S().lineCopyScope !== 'original'
          ? 'Line copied with translation'
          : 'Line copied'
      );
    } catch (error) {
      toast(error.message, true);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Save subtitle + translation to My Library > Subtitle Learning        */
  /* ------------------------------------------------------------------ */
  function subtitleLevel(text) {
    const words = String(text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return words <= 4
      ? 'A1'
      : words <= 8
        ? 'A2'
        : words <= 13
          ? 'B1'
          : words <= 20
            ? 'B2'
            : words <= 30
              ? 'C1'
              : 'C2';
  }
  const LEVEL_DIFFICULTY = {
    A1: 'Beginner',
    A2: 'Beginner',
    B1: 'Intermediate',
    B2: 'Intermediate',
    C1: 'Advanced',
    C2: 'Advanced',
  };
  const LEVEL_LABEL = {
    A1: 'Beginner',
    A2: 'Elementary',
    B1: 'Intermediate',
    B2: 'Upper intermediate',
    C1: 'Advanced',
    C2: 'Proficient',
  };

  async function saveLines(indices, rowEl) {
    const rows = indices.map((i) => state.view[i]).filter((r) => r && String(r.text || '').trim());
    if (!rows.length) return;
    try {
      if (!alive())
        throw new Error('The extension was updated. Refresh this YouTube tab and try again.');
      const m = meta();
      const stored = await chrome.storage.local.get('subtitleLearning');
      const list = Array.isArray(stored.subtitleLearning) ? stored.subtitleLearning : [];
      let added = 0,
        updated = 0;
      for (const r of rows) {
        const sentence = String(r.text || '')
          .replace(/\s+/g, ' ')
          .trim();
        const translation = String(r.translation || '')
          .replace(/\s+/g, ' ')
          .trim();
        const start = Math.max(0, Number(r.start) || 0);
        const existing = list.find(
          (x) =>
            x &&
            x.videoId === m.videoId &&
            String(x.sentence || '').trim() === sentence &&
            Math.abs(Number(x.timestamp || 0) - start) < 1.5
        );
        if (existing) {
          if (translation && !existing.translation) {
            existing.translation = translation;
            existing.sentenceTranslation = translation;
            updated++;
          }
          continue;
        }
        const level = subtitleLevel(sentence);
        list.unshift({
          id: crypto.randomUUID(),
          type: 'subtitle',
          word: '',
          sentence,
          translation,
          sentenceTranslation: translation,
          words: sentence
            .split(/\s+/)
            .filter(Boolean)
            .map((word) => ({ word })),
          lemma: '',
          pos: 'subtitle',
          level,
          levelLabel: LEVEL_LABEL[level] || 'Learner',
          stage: 'New',
          difficulty: LEVEL_DIFFICULTY[level] || 'Beginner',
          language: state.sourceTrack?.languageCode || S().sourceLanguage || '',
          targetLanguage: state.targetCode || '',
          videoId: m.videoId,
          videoTitle: m.title || '',
          channel: m.channel || '',
          url: m.url,
          timestamp: start,
          endTimestamp: Number.isFinite(Number(r.end)) ? Number(r.end) : null,
          source: 'Subtitle Learning',
          translationProvider: translation ? 'yt-transcript-pro' : '',
          tags: ['YouTube', 'Subtitle', level],
          createdAt: new Date().toISOString(),
        });
        added++;
      }
      await chrome.storage.local.set({ subtitleLearning: list.slice(0, 5000) });
      rowEl?.classList.add('ytp-copied');
      setTimeout(() => rowEl?.classList.remove('ytp-copied'), 700);
      toast(
        added
          ? `${added} subtitle${added > 1 ? 's' : ''} saved to My Library › Subtitle Learning`
          : updated
            ? 'Subtitle updated in your Library'
            : 'Already in My Library › Subtitle Learning'
      );
      if (indices.length > 1 && (added || updated)) {
        state.selected.clear();
        refreshSelection();
      }
    } catch (error) {
      toast(error.message || 'Could not save subtitle.', true);
    }
  }

  function saveSelected() {
    const idx = [...state.selected].sort((a, b) => a - b);
    if (idx.length) saveLines(idx);
  }

  async function copySelected() {
    const rows = [...state.selected]
      .sort((a, b) => a - b)
      .map((i) => state.view[i])
      .filter(Boolean);
    if (!rows.length) return;
    try {
      await root.copyText(root.formatPlain(rows, S(), meta()));
      toast(`Copied ${rows.length} selected lines`);
    } catch (error) {
      toast(error.message, true);
    }
  }

  async function doDownload(format, { scope } = {}) {
    try {
      await ensureLoaded();
      const s = S(),
        m = meta();
      const cueRows = root.prepareSegments(state.raw, s, { merge: false });
      const builders = {
        txt: () => root.buildTxt(state.view, s, m, { scope }),
        srt: () => root.buildSrt(cueRows, s, m, { scope }),
        vtt: () => root.buildVtt(cueRows, s, m, { scope }),
        csv: () => root.buildCsv(cueRows, s, m),
      };
      if (!builders[format]) throw new Error(`Unknown format: ${format}`);
      const file = builders[format]();
      const filename = root.buildFilename(s.filenameTemplate, m, file.ext);
      await saveFile(file, filename);
      toast(`${file.ext.toUpperCase()} download started`);
      return { ok: true };
    } catch (error) {
      toast(error.message, true);
      setStatus(error.message, 'error');
      return { ok: false, error: error.message };
    }
  }

  async function saveFile(file, filename) {
    if (!alive())
      throw new Error('The extension was updated. Refresh this YouTube tab and try again.');
    let reply;
    try {
      reply = await chrome.runtime.sendMessage({
        type: 'ytp:download',
        content: file.content,
        mime: file.mime,
        filename,
        bom: S().includeBom && file.ext !== 'vtt',
      });
    } catch {
      reply = null;
    }
    if (reply?.ok) return;
    if (reply && /cancel/i.test(reply.error || '')) throw new Error('Download cancelled.');
    // Fallback: normal browser download (ignores folder settings).
    const blob = new Blob([S().includeBom ? '\ufeff' : '', file.content], { type: file.mime });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ------------------------------------------------------------------ */
  /* Shortcuts + messages from popup/background                          */
  /* ------------------------------------------------------------------ */
  const comboOf = (e) => {
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return '';
    const parts = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Meta');
    const key = e.code.startsWith('Key')
      ? e.code.slice(3)
      : e.code.startsWith('Digit')
        ? e.code.slice(5)
        : e.key.length === 1
          ? e.key.toUpperCase()
          : e.key;
    return [...parts, key].join('+');
  };

  window.addEventListener(
    'keydown',
    (e) => {
      if (!root.isWatchPage()) return;
      const combo = comboOf(e);
      if (!combo || !/^(Ctrl|Alt|Meta)/.test(combo)) return;
      const s = S();
      const map = {
        [s.keyTogglePanel]: () => togglePanel(),
        [s.keyCopyTime]: () => doCopy({ timestamps: true }),
        [s.keyCopyClean]: () => doCopy({ timestamps: false }),
        [s.keyDownloadTxt]: () => doDownload('txt'),
        [s.keyFocusSearch]: () => {
          openPanel();
          setTimeout(() => state.els.search?.focus(), 50);
        },
      };
      if (map[combo]) {
        e.preventDefault();
        e.stopPropagation();
        map[combo]();
      }
    },
    true
  );

  async function runAction(action) {
    switch (action) {
      case 'toggle':
        togglePanel();
        return { ok: true };
      case 'open':
        openPanel();
        return { ok: true };
      case 'copy-time':
        return doCopy({ timestamps: true });
      case 'copy-clean':
        return doCopy({ timestamps: false });
      case 'copy-original':
        return doCopy({ scope: 'original' });
      case 'copy-translation':
        return doCopy({ scope: 'translation' });
      default:
        if (action?.startsWith('download-')) return doDownload(action.slice(9));
        return { ok: false, error: `Unknown action: ${action}` };
    }
  }

  function status() {
    return {
      supported: root.isWatchPage(),
      videoId: root.getVideoId(),
      title: state.info?.title || root.getVideoTitle(),
      ready: state.view.length > 0 && state.videoId === root.getVideoId(),
      lines: state.view.length,
      source: state.sourceTrack ? root.getTrackLabel(state.sourceTrack) : '',
      target: state.targetCode ? root.languageLabel(state.targetCode) : '',
      open: isOpen(),
      status: state.status,
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, send) => {
    if (msg?.type === 'ytp:status') {
      send(status());
      return false;
    }
    if (msg?.type === 'ytp:reset') {
      (async () => {
        state.token += 1;
        await root.resetNetwork();
        resetData();
        if (state.els.lines)
          renderEmpty('Connection reset. Reload the transcript by opening this window again.');
        setStatus('Connection reset', 'ok');
        if (isOpen()) loadVideo();
        send({ ok: true });
      })();
      return true;
    }
    if (msg?.type === 'ytp:action') {
      runAction(msg.action).then(send, (e) => send({ ok: false, error: e.message }));
      return true;
    }
    return false;
  });

  /* ------------------------------------------------------------------ */
  /* Charlie MJ integration API                                          */
  /* ------------------------------------------------------------------ */
  root.CMJTranscriptPro = {
    mount(host) {
      if (!host) return false;
      root.embeddedMode = true;
      root.embeddedHost = host;
      const panel = buildPanel();
      attachPanel();
      panel.classList.add('ytp-open');
      buildButton();
      if (state.videoId !== root.getVideoId() || (!state.tracks.length && !state.loadPromise))
        loadVideo();
      else followNow();
      return true;
    },
    unmount() {
      root.embeddedHost = null;
      hideFloatingPlaceholder();
      // A floating window stays open when the user switches Transcript-window tabs.
      if (
        state.panel &&
        state.panel.dataset.mode === 'floating' &&
        S().panelMode === 'floating' &&
        state.panel.classList.contains('ytp-open')
      )
        return;
      root.embeddedMode = false;
      state.panel?.classList.remove('ytp-open');
      state.panel?.remove();
    },
    open() {
      openPanel();
    },
    close() {
      closePanel();
    },
    toggle() {
      togglePanel();
    },
    refresh() {
      return loadVideo();
    },
    status,
  };

  // Publish the API through the DOM bridge as well as the local window.
  // The attribute is the readiness flag; the event wakes any waiting host.
  proApiReady = true;
  document.documentElement.dataset.cmjYtpProReady = '1';
  window.dispatchEvent(new CustomEvent(PRO_READY_EVENT));
  document.dispatchEvent(new CustomEvent(PRO_READY_EVENT));
  while (pendingCommands.length) {
    const item = pendingCommands.shift();
    runProCommand(item.command, item.value);
  }

  /* ------------------------------------------------------------------ */
  /* Settings, navigation, lifecycle                                     */
  /* ------------------------------------------------------------------ */
  function Settings_set(patch) {
    state.settings = { ...state.settings, ...patch }; // optimistic: UI reacts immediately
    return root.Settings.set(patch).catch(() => {});
  }

  function applySettings(prev) {
    root.applyTheme(state.panel, S());
    buildButton();
    if (!state.panel) return;
    buildFormatButtons();
    syncToggles();
    attachPanel();
    const reflow = [
      'removeDuplicates',
      'cleanTags',
      'removeSoundCues',
      'mergeParagraphs',
      'paragraphGap',
    ].some((k) => !prev || prev[k] !== S()[k]);
    if (reflow && state.primary.length) recompute();
    render();
  }

  function onNavigate() {
    state.token += 1;
    if (state.videoId && state.videoId !== root.getVideoId()) {
      resetData();
      state.videoId = '';
      state.els.lines && renderEmpty('Loading transcript…');
    }
    buildButton();
    if (!root.isWatchPage()) {
      closePanel();
      return;
    }
    if (isOpen()) loadVideo();
    else if (S().autoOpen) setTimeout(openPanel, 600);
  }

  let buildScheduled = false;
  const scheduleBuild = () => {
    if (buildScheduled) return;
    buildScheduled = true;
    setTimeout(() => {
      buildScheduled = false;
      if (root.isWatchPage()) {
        buildButton();
        if (isOpen()) attachPanel();
      }
    }, 200);
  };

  (async () => {
    state.settings = await root.Settings.get();
    root.Settings.onChange((next) => {
      const prev = state.settings;
      state.settings = next;
      applySettings(prev);
    });
    new MutationObserver(scheduleBuild).observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    window.addEventListener('yt-navigate-finish', onNavigate);
    window.addEventListener('yt-navigate-start', () => {
      state.token += 1;
    });
    window.addEventListener(
      'resize',
      root.debounce(() => {
        if (isOpen()) {
          attachPanel();
        }
      }, 200)
    );
    document.addEventListener('fullscreenchange', () => {
      if (state.panel) attachPanel();
    });
    document.addEventListener('timeupdate', () => syncHighlight(), true);
    document.addEventListener('seeked', () => syncHighlight(), true);
    document.addEventListener('seeking', () => syncHighlight(), true);
    document.addEventListener('play', () => syncHighlight(), true);
    // Safety net: timeupdate only fires ~4x/s and not at all while YouTube is buffering ads.
    setInterval(() => {
      const v = root.getVideo?.();
      if (v && !v.paused && isOpen()) syncHighlight();
    }, 400);
    setInterval(() => {
      if (root.isWatchPage()) {
        buildButton();
        if (isOpen() && !state.panel.isConnected) attachPanel();
      }
    }, 2000);
    new MutationObserver(() => root.applyTheme(state.panel, S())).observe(
      document.documentElement,
      { attributes: true, attributeFilter: ['dark'] }
    );
    buildButton();
    if (S().autoOpen && root.isWatchPage()) setTimeout(openPanel, 800);
  })();
})();
