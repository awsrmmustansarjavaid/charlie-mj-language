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
  "use strict";
  const root = (window.YTP = window.YTP || {});
  if (root.__contentLoaded) return;
  root.__contentLoaded = true;

  // Cross-isolated-world integration bridge. Chrome can execute content-script
  // files in different isolated execution contexts, so the main Charlie MJ
  // controller must NOT depend on window.CMJTranscriptPro being directly
  // readable from its own context. The DOM event/attribute bridge below is
  // intentionally primitive-only and works across isolated worlds.
  const PRO_READY_EVENT = "cmj-ytp-pro-ready";
  const PRO_COMMAND_EVENT = "cmj-ytp-command";
  const pendingCommands = [];
  let proApiReady = false;
  const runProCommand = (command, value) => {
    if (!proApiReady || !root.CMJTranscriptPro) {
      pendingCommands.push({ command, value });
      return;
    }
    try {
      if (command === "mount") {
        const hostId = value || document.documentElement?.dataset?.cmjYtpHostId || "";
        const host = hostId ? document.getElementById(String(hostId)) : null;
        if (host) root.CMJTranscriptPro.mount(host);
      } else if (command === "unmount") {
        root.CMJTranscriptPro.unmount();
      } else if (command === "refresh") {
        root.CMJTranscriptPro.refresh();
      }
    } catch (error) {
      console.error("[YT Transcript Pro] integration command failed:", error);
    }
  };
  document.addEventListener(PRO_COMMAND_EVENT, (event) => {
    const command = event?.detail?.command || document.documentElement?.dataset?.cmjYtpCommand || "";
    const value = event?.detail?.value || document.documentElement?.dataset?.cmjYtpCommandValue || "";
    runProCommand(command, value);
  });

  const { h, svg, clamp } = root;
  // Integrated mode: Charlie MJ owns the visible toolbar and transcript workspace.
  root.embeddedMode = true;

  const state = {
    settings: { ...root.DEFAULTS },
    videoId: "", info: null, tracks: [], translationLanguages: [],
    sourceTrack: null, targetCode: "",
    primary: [], secondary: [], raw: [], view: [],
    selected: new Set(), lastClicked: -1,
    rendered: [], activeIdx: -1, token: 0, loadPromise: null,
    lastManualScroll: 0, panel: null, button: null, els: {}, status: { text: "Ready", kind: "" }
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const alive = () => Boolean(chrome.runtime?.id);
  const S = () => state.settings;
  const log = (...a) => { if (S().debug) console.log("[YT Transcript Pro]", ...a); };

  /* ------------------------------------------------------------------ */
  /* Toast + status                                                      */
  /* ------------------------------------------------------------------ */
  let toastTimer;
  function toast(message, error = false) {
    if (!error && !S().notifyOnCopy) return;
    document.querySelectorAll(".ytp-toast").forEach((n) => n.remove());
    const host = document.fullscreenElement || document.body;
    const node = h("div", { class: `ytp-toast${error ? " ytp-toast-error" : ""}`, role: "status" }, message);
    host.append(node);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.remove(), error ? 5000 : 2200);
  }

  function setStatus(text, kind = "") {
    state.status = { text, kind };
    const el = state.els.status;
    if (el) { el.textContent = text; el.dataset.kind = kind; }
  }

  /* ------------------------------------------------------------------ */
  /* Player button                                                       */
  /* ------------------------------------------------------------------ */
  function buildButton() {
    if (root.embeddedMode) { state.button?.remove(); return; }
    if (!root.isWatchPage() || root.isShorts()) return;
    const controls = document.querySelector(".ytp-right-controls");
    if (!controls) return;

    if (!state.button) {
      state.button = h("button", {
        id: "ytp-player-button", class: "ytp-button", type: "button",
        title: "YT Transcript Pro", "aria-label": "Open transcript panel", "aria-pressed": "false",
        onClick: (e) => { e.preventDefault(); e.stopPropagation(); togglePanel(); }
      }, root.captionIcon());
    }
    const button = state.button;
    const pos = S().buttonPosition;
    const settingsBtn = controls.querySelector(".ytp-settings-button");

    if (pos === "end") {
      if (button.parentElement !== controls || controls.lastElementChild !== button) controls.append(button);
    } else if (pos === "beforeSettings" && settingsBtn) {
      if (settingsBtn.previousElementSibling !== button) settingsBtn.before(button);
    } else if (button.parentElement !== controls || controls.firstElementChild !== button) {
      controls.prepend(button);
    }
    button.setAttribute("aria-pressed", String(isOpen()));
    button.classList.toggle("ytp-on", isOpen());
  }

  /* ------------------------------------------------------------------ */
  /* Panel                                                               */
  /* ------------------------------------------------------------------ */
  const isOpen = () => Boolean(state.panel?.classList.contains("ytp-open"));
  const dockHost = () => document.querySelector("ytd-watch-flexy #secondary-inner") || document.querySelector("#secondary-inner") || document.querySelector("#secondary");
  const effectiveMode = () => (S().panelMode === "floating" || root.isShorts() || !dockHost() ? "floating" : "docked");

  function iconButton(label, children, onClick) {
    return h("button", { class: "ytp-icon-btn", type: "button", title: label, "aria-label": label, onClick }, children);
  }
  const line = (x1, y1, x2, y2) => svg("line", { x1, y1, x2, y2 });
  const iconSvg = (...kids) => svg("svg", { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, ...kids);

  function buildPanel() {
    if (state.panel) return state.panel;
    const els = state.els;

    els.source = h("select", { id: "ytp-source", "aria-label": "Original language", onChange: (e) => loadPrimary(e.target.value) }, h("option", { value: "" }, "Loading…"));
    els.target = h("select", { id: "ytp-target", "aria-label": "Translation language", onChange: (e) => setTarget(e.target.value) }, h("option", { value: "" }, "Off"));
    els.search = h("input", { id: "ytp-search", type: "search", placeholder: "Search transcript…", "aria-label": "Search transcript", onInput: root.debounce(() => render(), 120) });
    els.count = h("span", { class: "ytp-count" });
    els.lines = h("div", { class: "ytp-lines", role: "list" });
    els.status = h("span", { class: "ytp-status", role: "status" }, "Ready");
    els.selBtn = h("button", { class: "ytp-btn ytp-hidden", type: "button", onClick: copySelected }, "Copy selected");
    els.formats = h("div", { class: "ytp-formats" });

    const toggle = (key, label, after) => {
      const input = h("input", { type: "checkbox", onChange: (e) => { Settings_set({ [key]: e.target.checked }); after?.(); } });
      els["t_" + key] = input;
      return h("label", { class: "ytp-toggle" }, input, label);
    };

    const headerActions = [
      iconButton("Swap language order", iconSvg(svg("path", { d: "M7 4 3 8l4 4" }), line(3, 8, 21, 8), svg("path", { d: "m17 20 4-4-4-4" }), line(21, 16, 3, 16)), () => Settings_set({ swapOrder: !S().swapOrder })),
      iconButton("Refresh transcript", iconSvg(svg("path", { d: "M20 11a8 8 0 0 0-14.9-4" }), svg("path", { d: "M4 4v5h5" }), svg("path", { d: "M4 13a8 8 0 0 0 14.9 4" }), svg("path", { d: "M20 20v-5h-5" })), () => loadVideo()),
      iconButton("Dock or float the window", iconSvg(svg("rect", { x: 3, y: 4, width: 18, height: 14, rx: 2 }), svg("rect", { x: 12, y: 11, width: 7, height: 5, rx: 1 })), () => Settings_set({ panelMode: S().panelMode === "floating" ? "docked" : "floating" })),
      iconButton("Open settings", iconSvg(line(4, 6, 20, 6), line(4, 12, 20, 12), line(4, 18, 20, 18), svg("circle", { cx: 9, cy: 6, r: 2, fill: "var(--ytp-bg)" }), svg("circle", { cx: 15, cy: 12, r: 2, fill: "var(--ytp-bg)" }), svg("circle", { cx: 8, cy: 18, r: 2, fill: "var(--ytp-bg)" })), () => chrome.runtime.sendMessage({ type: "ytp:openOptions" }).catch(() => {})),
      iconButton("Close", iconSvg(line(6, 6, 18, 18), line(18, 6, 6, 18)), closePanel)
    ];

    els.header = h("header", { class: "ytp-header" },
      h("div", { class: "ytp-brand" },
        h("span", { class: "ytp-logo" }, root.captionIcon(20)),
        h("div", { class: "ytp-brand-text" }, h("strong", {}, "YT Transcript Pro"), els.videoLine = h("small", {}, "Transcript & dual subtitles"))),
      h("div", { class: "ytp-header-actions" }, ...headerActions));

    const panelChildren = [
      h("div", { class: "ytp-langs" },
        h("label", {}, h("span", {}, "Original"), els.source),
        h("label", {}, h("span", {}, "Translation"), els.target)),
      h("div", { class: "ytp-actions ytp-actions-copy" },
        h("button", { class: "ytp-btn ytp-primary", type: "button", onClick: () => doCopy({ timestamps: true }) }, "Copy with timestamps"),
        h("button", { class: "ytp-btn ytp-primary", type: "button", onClick: () => doCopy({ timestamps: false }) }, "Copy without timestamps")),
      h("div", { class: "ytp-actions ytp-actions-secondary" }, els.selBtn),
      h("div", { class: "ytp-toggles" },
          toggle("timestamps", "Timestamps", () => render()),
          toggle("dualMode", "Dual language", () => render()),
          toggle("autoScroll", "Auto-scroll")),
        h("div", { class: "ytp-search-row" }, els.search, els.count),
        els.lines
    ];

    const panel = h("section", { id: "ytp-panel", "aria-label": "YT Transcript Pro", data: { mode: "docked" } },
      els.header,
      h("div", { class: "ytp-body" }, ...panelChildren),
      h("footer", { class: "ytp-footer" }, els.status, h("span", { class: "ytp-hint" }, "Ctrl+click selects lines")));

    // Typing in the panel must never trigger YouTube's one-key shortcuts (k, f, m ...).
    ["keydown", "keyup", "keypress"].forEach((t) => panel.addEventListener(t, (e) => { if (!e.altKey && !e.ctrlKey && !e.metaKey) e.stopPropagation(); }));

    ["wheel", "touchmove", "pointerdown"].forEach((t) => els.lines.addEventListener(t, () => { state.lastManualScroll = Date.now(); }, { passive: true }));
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
    wrap.replaceChildren(...String(S().showFormats).split(",").filter(Boolean).map((f) =>
      h("button", { class: "ytp-btn ytp-small", type: "button", onClick: () => doDownload(f) }, f.toUpperCase())));
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
    if (root.embeddedHost) {
      p.dataset.mode = "embedded";
      p.style.left = p.style.top = p.style.width = p.style.height = "";
      if (p.parentElement !== root.embeddedHost) root.embeddedHost.append(p);
      return;
    }
    const mode = effectiveMode();
    p.dataset.mode = mode;
    if (mode === "floating") {
      const host = document.fullscreenElement || document.body;
      if (p.parentElement !== host) host.append(p);
      positionFloating();
    } else {
      p.style.left = p.style.top = p.style.width = p.style.height = "";
      const host = dockHost();
      if (host && (p.parentElement !== host || host.firstElementChild !== p)) host.prepend(p);
    }
  }

  function positionFloating() {
    const p = state.panel;
    if (!p || p.dataset.mode !== "floating") return;
    const w = Math.min(S().panelWidth, window.innerWidth - 16), hgt = Math.min(S().panelHeight, window.innerHeight - 16);
    p.style.width = `${w}px`; p.style.height = `${hgt}px`;
    const x = S().floatX >= 0 ? S().floatX : window.innerWidth - w - 24;
    const y = S().floatY >= 0 ? S().floatY : 72;
    p.style.left = `${clamp(x, 8, Math.max(8, window.innerWidth - w - 8))}px`;
    p.style.top = `${clamp(y, 8, Math.max(8, window.innerHeight - 80))}px`;
  }

  function setupDrag(panel) {
    let drag = null;
    state.els.header.addEventListener("pointerdown", (e) => {
      if (panel.dataset.mode !== "floating" || e.target.closest("button")) return;
      const r = panel.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
      state.els.header.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    state.els.header.addEventListener("pointermove", (e) => {
      if (!drag) return;
      panel.style.left = `${clamp(e.clientX - drag.dx, 0, window.innerWidth - 80)}px`;
      panel.style.top = `${clamp(e.clientY - drag.dy, 0, window.innerHeight - 40)}px`;
    });
    const end = (e) => {
      if (!drag) return;
      drag = null;
      try { state.els.header.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      Settings_set({ floatX: Math.round(parseFloat(panel.style.left)), floatY: Math.round(parseFloat(panel.style.top)) });
    };
    state.els.header.addEventListener("pointerup", end);
    state.els.header.addEventListener("pointercancel", end);
  }

  function setupResizeSave(panel) {
    if (typeof ResizeObserver === "undefined") return;
    const save = root.debounce(() => {
      if (panel.dataset.mode !== "floating" || !isOpen()) return;
      const w = Math.round(panel.offsetWidth), hgt = Math.round(panel.offsetHeight);
      if (w > 200 && hgt > 200 && (w !== S().panelWidth || hgt !== S().panelHeight)) Settings_set({ panelWidth: w, panelHeight: hgt });
    }, 500);
    new ResizeObserver(save).observe(panel);
  }

  function openPanel() {
    const panel = buildPanel();
    attachPanel();
    panel.classList.add("ytp-open");
    buildButton();
    if (state.videoId !== root.getVideoId() || (!state.tracks.length && !state.loadPromise)) loadVideo();
  }
  function closePanel() { state.panel?.classList.remove("ytp-open"); buildButton(); }
  function togglePanel() { isOpen() ? closePanel() : openPanel(); }

  /* ------------------------------------------------------------------ */
  /* Loading captions                                                    */
  /* ------------------------------------------------------------------ */
  function resetData() {
    Object.assign(state, { info: null, tracks: [], translationLanguages: [], sourceTrack: null, targetCode: "", primary: [], secondary: [], raw: [], view: [], rendered: [], activeIdx: -1 });
    state.selected.clear(); state.lastClicked = -1;
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
      setStatus("Detecting captions…", "busy");
      renderEmpty("Loading transcript…");
      try {
        let info = await root.loadVideoInfo(videoId);
        if (!info.tracks.length && !info.playabilityReason) { await wait(1200); info = await root.loadVideoInfo(videoId); }
        if (token !== state.token) return;
        state.info = info; state.tracks = info.tracks; state.translationLanguages = info.translationLanguages;
        updateVideoLine();
        fillLanguageSelects();
        if (!info.tracks.length) {
          const why = info.playabilityReason || "This video has no captions, or captions are turned off by the uploader.";
          setStatus("No captions found", "error"); renderEmpty(why);
          return;
        }
        const source = root.pickSourceTrack(info.tracks, S());
        state.els.source.value = source.id;
        await loadPrimary(source.id, { keepTarget: false, token });
        if (token !== state.token) return;
        const want = S().rememberLanguages ? S().targetLanguage : "";
        if (want && S().dualMode && want !== source.languageCode) { state.els.target.value = want; await setTarget(state.els.target.value, { silent: true }); }
      } catch (error) {
        if (token !== state.token) return;
        setStatus(error.message, "error"); renderEmpty(error.message);
      }
    })().finally(() => { state.loadPromise = null; });
    return state.loadPromise;
  }

  function updateVideoLine() {
    const el = state.els.videoLine;
    if (el) el.textContent = state.info?.title || root.getVideoTitle() || "Transcript & dual subtitles";
  }

  function fillLanguageSelects() {
    const { source, target } = state.els;
    source.replaceChildren(...(state.tracks.length ? state.tracks.map((t) => h("option", { value: t.id }, root.getTrackLabel(t))) : [h("option", { value: "" }, "No captions")]));
    const nativeCodes = new Set();
    const nativeOptions = [];
    state.tracks.forEach((t) => { if (!nativeCodes.has(t.languageCode)) { nativeCodes.add(t.languageCode); nativeOptions.push(h("option", { value: t.languageCode }, `${root.languageLabel(t.languageCode)} (${t.languageCode})`)); } });
    const translatable = state.translationLanguages.filter((l) => !nativeCodes.has(l.languageCode)).map((l) => h("option", { value: l.languageCode }, `${l.name || root.languageLabel(l.languageCode)} (${l.languageCode})`));
    target.replaceChildren(h("option", { value: "" }, "Off"),
      nativeOptions.length ? h("optgroup", { label: "Caption tracks on this video" }, nativeOptions) : null,
      translatable.length ? h("optgroup", { label: "Translate with YouTube" }, translatable) : null);
  }

  async function loadPrimary(id, { keepTarget = true, token = state.token } = {}) {
    const track = state.tracks.find((t) => t.id === id);
    if (!track) return;
    state.sourceTrack = track;
    state.els.source.value = track.id;
    if (S().rememberLanguages) Settings_set({ sourceLanguage: track.languageCode });
    setStatus("Loading transcript…", "busy");
    try {
      const rows = await root.fetchCaptionTrack(track);
      if (token !== state.token) return;
      state.primary = rows; state.secondary = [];
      recompute(); render();
      setStatus(`${rows.length} lines · ${root.getTrackLabel(track)}`, "ok");
      if (keepTarget && state.targetCode) await setTarget(state.targetCode, { silent: true });
    } catch (error) {
      if (token !== state.token) return;
      state.primary = []; state.raw = []; state.view = [];
      renderEmpty(error.message); setStatus(error.message, "error");
    }
  }

  async function setTarget(code, { silent = false } = {}) {
    const token = state.token;
    state.targetCode = code || "";
    if (!silent && S().rememberLanguages) Settings_set({ targetLanguage: state.targetCode, ...(code ? { dualMode: true } : {}) });
    else if (code && !S().dualMode && !silent) Settings_set({ dualMode: true });
    if (!code || !state.sourceTrack || code === state.sourceTrack.languageCode) {
      state.targetCode = ""; state.secondary = []; recompute(); render(); return;
    }
    setStatus(`Loading ${root.languageLabel(code)}…`, "busy");
    try {
      const native = state.tracks.filter((t) => t.languageCode === code).sort((a, b) => (a.kind === "asr") - (b.kind === "asr"))[0];
      if (!native && !state.sourceTrack.isTranslatable) throw new Error("YouTube does not allow translating this video's captions.");
      const rows = await root.fetchCaptionTrack(native || state.sourceTrack, native ? "" : code);
      if (token !== state.token) return;
      state.secondary = rows;
      recompute(); render();
      setStatus(`Dual transcript ready · ${root.languageLabel(state.sourceTrack.languageCode)} + ${root.languageLabel(code)}`, "ok");
    } catch (error) {
      if (token !== state.token) return;
      state.secondary = []; recompute(); render();
      setStatus(`Translation unavailable: ${error.message}`, "error"); toast(error.message, true);
    }
  }

  function recompute() {
    state.raw = root.alignTracks(state.primary, state.secondary);
    state.view = root.prepareSegments(state.raw, S());
    state.selected.clear(); state.lastClicked = -1;
  }

  /* ------------------------------------------------------------------ */
  /* Rendering                                                           */
  /* ------------------------------------------------------------------ */
  function renderEmpty(message) {
    const { lines, count } = state.els;
    if (!lines) return;
    lines.replaceChildren(h("div", { class: "ytp-empty" }, message));
    count.textContent = ""; state.rendered = [];
  }

  function highlight(text, query) {
    if (!query) return text;
    const out = []; const lower = text.toLocaleLowerCase(); const q = query.toLocaleLowerCase();
    let i = 0, at;
    while ((at = lower.indexOf(q, i)) !== -1) { if (at > i) out.push(text.slice(i, at)); out.push(h("mark", {}, text.slice(at, at + q.length))); i = at + q.length; }
    out.push(text.slice(i));
    return out;
  }

  function render() {
    const { lines, count, search } = state.els;
    if (!lines) return;
    const s = S();
    const hasTr = state.view.some((r) => r.translation);
    const cols = root.columns(s, hasTr);
    const query = (search.value || "").trim();
    const long = state.view.length ? state.view[state.view.length - 1].start >= 3600 : false;
    const stampSettings = { ...s, timestampWrap: "none" };
    const frag = document.createDocumentFragment();
    state.rendered = [];

    state.view.forEach((r, i) => {
      if (query && !`${r.text} ${r.translation}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return;
      const parts = [{ key: cols.first, cls: "ytp-orig" }];
      if (cols.second) parts.push({ key: cols.second, cls: "ytp-trans" });
      const visible = parts.filter((p) => {
        if (!cols.dual) return true;
        return p.key === "text" ? s.showOriginal : s.showTranslation;
      }).filter((p) => r[p.key]);
      const text = h("div", { class: "ytp-text", dir: "auto" },
        visible.map((p, n) => [
          n > 0 && s.dualLayout === "delimited" ? h("span", { class: "ytp-delim" }, s.delimiter.trim() || "|") : null,
          h("div", { class: p.key === "text" ? "ytp-orig" : "ytp-trans", dir: "auto" }, highlight(r[p.key], query))
        ]));
      const row = h("article", { class: "ytp-line", role: "listitem", data: { i, start: r.start } },
        s.timestamps ? h("button", { class: "ytp-time", type: "button", title: "Jump to this moment", onClick: (e) => { e.stopPropagation(); seek(r.start); } }, root.formatStamp(r.start, stampSettings, long)) : null,
        text,
        s.showLineCopy ? h("button", { class: "ytp-copy-line", type: "button", title: "Copy this line with its translation", "aria-label": "Copy this line",
          onClick: (e) => { e.stopPropagation(); copyLine(i, row); } }, iconSvg(svg("rect", { x: 9, y: 9, width: 11, height: 11, rx: 2 }), svg("path", { d: "M5 15V6a2 2 0 0 1 2-2h8" }))) : null);
      row.addEventListener("click", (e) => onLineClick(e, i, r));
      if (state.selected.has(i)) row.classList.add("ytp-selected");
      state.rendered.push({ start: r.start, el: row, i });
      frag.append(row);
    });

    lines.replaceChildren(frag);
    count.textContent = query ? `${state.rendered.length} of ${state.view.length}` : `${state.view.length} lines`;
    if (!state.rendered.length) renderEmpty(state.view.length ? "No lines match your search." : "The transcript will appear here.");
    state.activeIdx = -1;
    updateSelButton();
    syncHighlight(true);
  }

  function onLineClick(event, i, row) {
    if (window.getSelection()?.toString()) return;          // user is selecting text, not seeking
    if (event.ctrlKey || event.metaKey) { toggleSelected(i); return; }
    if (event.shiftKey && state.lastClicked >= 0) {
      const [a, b] = [Math.min(i, state.lastClicked), Math.max(i, state.lastClicked)];
      for (let n = a; n <= b; n += 1) state.selected.add(n);
      refreshSelection(); return;
    }
    if (S().clickToSeek) seek(row.start);
  }
  function toggleSelected(i) { state.selected.has(i) ? state.selected.delete(i) : state.selected.add(i); state.lastClicked = i; refreshSelection(); }
  function refreshSelection() { state.rendered.forEach(({ el, i }) => el.classList.toggle("ytp-selected", state.selected.has(i))); updateSelButton(); }
  function updateSelButton() {
    const b = state.els.selBtn; if (!b) return;
    b.classList.toggle("ytp-hidden", state.selected.size === 0);
    b.textContent = `Copy selected (${state.selected.size})`;
  }

  function seek(start) {
    const v = root.getVideo();
    if (v) v.currentTime = Math.max(0, (Number(start) || 0) + (Number(S().seekOffset) || 0));
  }

  /* ------------------------------------------------------------------ */
  /* Playback sync                                                       */
  /* ------------------------------------------------------------------ */
  function syncHighlight(force = false) {
    if (!isOpen() || !state.rendered.length) return;
    const v = root.getVideo();
    if (!v) return;
    const t = v.currentTime + 0.15;
    let lo = 0, hi = state.rendered.length - 1, idx = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (state.rendered[mid].start <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
    if (idx === state.activeIdx && !force) return;
    state.rendered[state.activeIdx]?.el.classList.remove("ytp-active");
    state.activeIdx = idx;
    if (idx < 0 || !S().highlightCurrent) return;
    const row = state.rendered[idx].el;
    row.classList.add("ytp-active");
    const idle = Date.now() - state.lastManualScroll > (Number(S().resumeScrollDelay) || 0) * 1000;
    if (S().autoScroll && idle) {
      const list = state.els.lines;
      list.scrollTo({ top: Math.max(0, row.offsetTop - list.clientHeight * 0.35), behavior: S().scrollBehavior === "auto" ? "auto" : "smooth" });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Copy / download                                                     */
  /* ------------------------------------------------------------------ */
  function meta() {
    const src = state.sourceTrack, tc = state.targetCode;
    return {
      title: state.info?.title || root.getVideoTitle(), videoId: state.videoId, channel: state.info?.author || "",
      url: `https://www.youtube.com/watch?v=${state.videoId}`,
      lang: [src?.languageCode, tc].filter(Boolean).join("-"),
      sourceLabel: src ? root.getTrackLabel(src) : "", targetLabel: tc ? root.languageLabel(tc) : ""
    };
  }

  async function ensureLoaded() {
    if (!state.view.length || state.videoId !== root.getVideoId()) { buildPanel(); await (state.loadPromise || loadVideo()); }
    if (!state.view.length) throw new Error(state.status.kind === "error" ? state.status.text : "No transcript is available for this video.");
  }

  async function doCopy({ timestamps, scope } = {}) {
    try {
      await ensureLoaded();
      const text = root.formatPlain(state.view, S(), meta(), { timestamps, scope });
      await root.copyText(text);
      const bits = [timestamps === false ? "without timestamps" : timestamps === true ? "with timestamps" : "", scope === "original" ? "original only" : scope === "translation" ? "translation only" : ""].filter(Boolean).join(", ");
      toast(`Transcript copied${bits ? ` (${bits})` : ""} · ${state.view.length} lines`);
      setStatus("Copied to clipboard", "ok");
      return { ok: true };
    } catch (error) { toast(error.message, true); setStatus(error.message, "error"); return { ok: false, error: error.message }; }
  }

  async function copyLine(i, rowEl) {
    const r = state.view[i];
    if (!r) return;
    const s = { ...S(), dualMode: true, includeHeader: false, mergeParagraphs: false, copyScope: S().lineCopyScope };
    try {
      await root.copyText(root.formatPlain([r], s, meta(), { timestamps: S().lineCopyTimestamp, scope: S().lineCopyScope }));
      rowEl?.classList.add("ytp-copied"); setTimeout(() => rowEl?.classList.remove("ytp-copied"), 700);
      toast(r.translation && S().lineCopyScope !== "original" ? "Line copied with translation" : "Line copied");
    } catch (error) { toast(error.message, true); }
  }

  async function copySelected() {
    const rows = [...state.selected].sort((a, b) => a - b).map((i) => state.view[i]).filter(Boolean);
    if (!rows.length) return;
    try { await root.copyText(root.formatPlain(rows, S(), meta())); toast(`Copied ${rows.length} selected lines`); }
    catch (error) { toast(error.message, true); }
  }

  async function doDownload(format, { scope } = {}) {
    try {
      await ensureLoaded();
      const s = S(), m = meta();
      const cueRows = root.prepareSegments(state.raw, s, { merge: false });
      const builders = { txt: () => root.buildTxt(state.view, s, m, { scope }), srt: () => root.buildSrt(cueRows, s, m, { scope }), vtt: () => root.buildVtt(cueRows, s, m, { scope }), csv: () => root.buildCsv(cueRows, s, m) };
      if (!builders[format]) throw new Error(`Unknown format: ${format}`);
      const file = builders[format]();
      const filename = root.buildFilename(s.filenameTemplate, m, file.ext);
      await saveFile(file, filename);
      toast(`${file.ext.toUpperCase()} download started`);
      return { ok: true };
    } catch (error) { toast(error.message, true); setStatus(error.message, "error"); return { ok: false, error: error.message }; }
  }

  async function saveFile(file, filename) {
    if (!alive()) throw new Error("The extension was updated. Refresh this YouTube tab and try again.");
    let reply;
    try { reply = await chrome.runtime.sendMessage({ type: "ytp:download", content: file.content, mime: file.mime, filename, bom: S().includeBom && file.ext !== "vtt" }); }
    catch { reply = null; }
    if (reply?.ok) return;
    if (reply && /cancel/i.test(reply.error || "")) throw new Error("Download cancelled.");
    // Fallback: normal browser download (ignores folder settings).
    const blob = new Blob([S().includeBom ? "\ufeff" : "", file.content], { type: file.mime });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /* ------------------------------------------------------------------ */
  /* Shortcuts + messages from popup/background                          */
  /* ------------------------------------------------------------------ */
  const comboOf = (e) => {
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return "";
    const parts = [];
    if (e.ctrlKey) parts.push("Ctrl"); if (e.altKey) parts.push("Alt"); if (e.shiftKey) parts.push("Shift"); if (e.metaKey) parts.push("Meta");
    const key = e.code.startsWith("Key") ? e.code.slice(3) : e.code.startsWith("Digit") ? e.code.slice(5) : (e.key.length === 1 ? e.key.toUpperCase() : e.key);
    return [...parts, key].join("+");
  };

  window.addEventListener("keydown", (e) => {
    if (!root.isWatchPage()) return;
    const combo = comboOf(e);
    if (!combo || !/^(Ctrl|Alt|Meta)/.test(combo)) return;
    const s = S();
    const map = { [s.keyTogglePanel]: () => togglePanel(), [s.keyCopyTime]: () => doCopy({ timestamps: true }), [s.keyCopyClean]: () => doCopy({ timestamps: false }), [s.keyDownloadTxt]: () => doDownload("txt"), [s.keyFocusSearch]: () => { openPanel(); setTimeout(() => state.els.search?.focus(), 50); } };
    if (map[combo]) { e.preventDefault(); e.stopPropagation(); map[combo](); }
  }, true);

  async function runAction(action) {
    switch (action) {
      case "toggle": togglePanel(); return { ok: true };
      case "open": openPanel(); return { ok: true };
      case "copy-time": return doCopy({ timestamps: true });
      case "copy-clean": return doCopy({ timestamps: false });
      case "copy-original": return doCopy({ scope: "original" });
      case "copy-translation": return doCopy({ scope: "translation" });
      default:
        if (action?.startsWith("download-")) return doDownload(action.slice(9));
        return { ok: false, error: `Unknown action: ${action}` };
    }
  }

  function status() {
    return {
      supported: root.isWatchPage(), videoId: root.getVideoId(), title: state.info?.title || root.getVideoTitle(),
      ready: state.view.length > 0 && state.videoId === root.getVideoId(), lines: state.view.length,
      source: state.sourceTrack ? root.getTrackLabel(state.sourceTrack) : "", target: state.targetCode ? root.languageLabel(state.targetCode) : "",
      open: isOpen(), status: state.status
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, send) => {
    if (msg?.type === "ytp:status") { send(status()); return false; }
    if (msg?.type === "ytp:reset") {
      (async () => {
        state.token += 1; await root.resetNetwork(); resetData();
        if (state.els.lines) renderEmpty("Connection reset. Reload the transcript by opening this window again.");
        setStatus("Connection reset", "ok");
        if (isOpen()) loadVideo();
        send({ ok: true });
      })();
      return true;
    }
    if (msg?.type === "ytp:action") { runAction(msg.action).then(send, (e) => send({ ok: false, error: e.message })); return true; }
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
      panel.classList.add("ytp-open");
      buildButton();
      if (state.videoId !== root.getVideoId() || (!state.tracks.length && !state.loadPromise)) loadVideo();
      return true;
    },
    unmount() {
      root.embeddedHost = null;
      root.embeddedMode = false;
      state.panel?.classList.remove("ytp-open");
      state.panel?.remove();
    },
    open() { openPanel(); },
    close() { closePanel(); },
    toggle() { togglePanel(); },
    refresh() { return loadVideo(); },
    status
  };

  // Publish the API through the DOM bridge as well as the local window.
  // The attribute is the readiness flag; the event wakes any waiting host.
  proApiReady = true;
  document.documentElement.dataset.cmjYtpProReady = "1";
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
    state.settings = { ...state.settings, ...patch };   // optimistic: UI reacts immediately
    return root.Settings.set(patch).catch(() => {});
  }

  function applySettings(prev) {
    root.applyTheme(state.panel, S());
    buildButton();
    if (!state.panel) return;
    buildFormatButtons(); syncToggles(); attachPanel();
    const reflow = ["removeDuplicates", "cleanTags", "removeSoundCues", "mergeParagraphs", "paragraphGap"].some((k) => !prev || prev[k] !== S()[k]);
    if (reflow && state.primary.length) recompute();
    render();
  }

  function onNavigate() {
    state.token += 1;
    if (state.videoId && state.videoId !== root.getVideoId()) {
      resetData(); state.videoId = "";
      state.els.lines && renderEmpty("Loading transcript…");
    }
    buildButton();
    if (!root.isWatchPage()) { closePanel(); return; }
    if (isOpen()) loadVideo();
    else if (S().autoOpen) setTimeout(openPanel, 600);
  }

  let buildScheduled = false;
  const scheduleBuild = () => {
    if (buildScheduled) return;
    buildScheduled = true;
    setTimeout(() => { buildScheduled = false; if (root.isWatchPage()) { buildButton(); if (isOpen()) attachPanel(); } }, 200);
  };

  (async () => {
    state.settings = await root.Settings.get();
    root.Settings.onChange((next) => { const prev = state.settings; state.settings = next; applySettings(prev); });
    new MutationObserver(scheduleBuild).observe(document.documentElement, { childList: true, subtree: true });
    window.addEventListener("yt-navigate-finish", onNavigate);
    window.addEventListener("yt-navigate-start", () => { state.token += 1; });
    window.addEventListener("resize", root.debounce(() => { if (isOpen()) { attachPanel(); } }, 200));
    document.addEventListener("fullscreenchange", () => { if (state.panel) attachPanel(); });
    document.addEventListener("timeupdate", () => syncHighlight(), true);
    setInterval(() => { if (root.isWatchPage()) { buildButton(); if (isOpen() && !state.panel.isConnected) attachPanel(); } }, 2000);
    new MutationObserver(() => root.applyTheme(state.panel, S())).observe(document.documentElement, { attributes: true, attributeFilter: ["dark"] });
    buildButton();
    if (S().autoOpen && root.isWatchPage()) setTimeout(openPanel, 800);
  })();
})();
