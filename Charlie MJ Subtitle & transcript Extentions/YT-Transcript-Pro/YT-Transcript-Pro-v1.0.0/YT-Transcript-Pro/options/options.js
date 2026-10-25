/* YT Transcript Pro - settings page. A declarative schema renders every control; all values live in chrome.storage.local. */
(() => {
  "use strict";
  const root = window.YTP;
  const { h, svg } = root;
  const D = root.DEFAULTS;
  let cur = { ...D };
  const isEdge = /Edg\//.test(navigator.userAgent);
  const controls = {};            // key -> setter(value)
  const conditional = [];         // { el, showIf }
  let pending = {}, flushTimer, toastTimer;

  /* ---------- persistence ---------- */
  function toast(msg = "Saved") {
    const t = document.getElementById("toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1300);
  }
  function save(patch) {
    Object.assign(cur, patch);
    Object.assign(pending, patch);
    refreshConditions(); renderPreview();
    clearTimeout(flushTimer);
    flushTimer = setTimeout(async () => {
      const out = pending; pending = {};
      try { await root.Settings.set(out); toast(); } catch { toast("Could not save"); }
    }, 180);
  }
  const syncControls = () => { Object.entries(controls).forEach(([k, set]) => set(cur[k])); refreshConditions(); renderPreview(); };

  /* ---------- icons ---------- */
  const I = (...kids) => svg("svg", { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" }, ...kids);
  const P = (d) => svg("path", { d });
  const L = (x1, y1, x2, y2) => svg("line", { x1, y1, x2, y2 });
  const ICONS = {
    general: () => I(L(4, 6, 20, 6), L(4, 12, 20, 12), L(4, 18, 20, 18), svg("circle", { cx: 9, cy: 6, r: 2, fill: "var(--card)" }), svg("circle", { cx: 15, cy: 12, r: 2, fill: "var(--card)" }), svg("circle", { cx: 8, cy: 18, r: 2, fill: "var(--card)" })),
    transcript: () => I(L(4, 6, 20, 6), L(4, 11, 15, 11), L(4, 16, 20, 16), L(4, 21, 12, 21)),
    dual: () => I(svg("rect", { x: 3, y: 4, width: 18, height: 16, rx: 2 }), L(12, 4, 12, 20), L(6, 9, 9, 9), L(15, 9, 18, 9), L(6, 14, 9, 14), L(15, 14, 18, 14)),
    appearance: () => I(P("M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.5-1.9-.3-1 .4-2.1 1.5-2.1H17a4 4 0 0 0 4-4c0-5-4-10-9-10Z"), svg("circle", { cx: 7.5, cy: 11, r: 1, fill: "currentColor" }), svg("circle", { cx: 11, cy: 7, r: 1, fill: "currentColor" }), svg("circle", { cx: 16, cy: 8, r: 1, fill: "currentColor" })),
    export: () => I(svg("rect", { x: 8, y: 8, width: 12, height: 12, rx: 2 }), P("M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2")),
    download: () => I(P("M12 4v11"), P("m7 11 5 5 5-5"), L(5, 20, 19, 20)),
    player: () => I(svg("rect", { x: 3, y: 5, width: 18, height: 14, rx: 3 }), P("m10 9 5 3-5 3Z")),
    keys: () => I(svg("rect", { x: 2.5, y: 6, width: 19, height: 12, rx: 2 }), L(6, 10, 6.01, 10), L(10, 10, 10.01, 10), L(14, 10, 14.01, 10), L(18, 10, 18.01, 10), L(7, 14.5, 17, 14.5)),
    advanced: () => I(P("m5 8 4 4-4 4"), L(12, 17, 19, 17)),
    about: () => I(svg("circle", { cx: 12, cy: 12, r: 9 }), L(12, 11, 12, 16), L(12, 8, 12.01, 8))
  };

  /* ---------- schema ---------- */
  const THEMES = [["system", "System"], ["light", "Light"], ["dark", "Dark"], ["midnight", "Midnight"], ["sepia", "Sepia"], ["forest", "Forest"], ["contrast", "Contrast"], ["custom", "Custom"]];
  const COLOR_FIELDS = [["colorBg", "Window background"], ["colorHeader", "Header and footer"], ["colorText", "Interface text"], ["colorOriginal", "Original text"], ["colorTranslation", "Translated text"], ["colorTime", "Timestamps"], ["colorAccent", "Buttons and accents"], ["colorActive", "Current line"], ["colorBorder", "Borders"]];
  const SCHEMA = [
    { id: "general", title: "General", icon: "general", desc: "How the extension appears on YouTube.", cards: [
      { title: "Player button", desc: "The button that opens the transcript, inside the video controls.", fields: [
        { key: "buttonPosition", type: "seg", label: "Position", options: [["start", "First"], ["beforeSettings", "Before ⚙"], ["end", "Last"]], hint: "First puts it left of the autoplay switch." },
        { key: "autoOpen", type: "toggle", label: "Open on every video", hint: "Show the transcript window as soon as a video loads." }] },
      { title: "Transcript window", desc: "Where the transcript is shown.", fields: [
        { key: "panelMode", type: "seg", label: "Window mode", options: [["docked", "Beside video"], ["floating", "Floating"]], hint: "Floating windows can be dragged and resized. Shorts always float." }] },
      { title: "Languages", desc: "Which captions load first.", fields: [
        { key: "rememberLanguages", type: "toggle", label: "Remember my languages", hint: "Reuse your last original and translation languages." },
        { key: "preferredLanguages", type: "text", label: "Preferred languages", hint: "Language codes, comma-separated (en, tr, ur). Leave empty to use the video's own captions.", stack: true, placeholder: "e.g. en, ur" }] }
    ] },
    { id: "transcript", title: "Transcript", icon: "transcript", desc: "What the text looks like when you copy or save it.", cards: [
      { title: "Timestamps", fields: [
        { key: "timestamps", type: "toggle", label: "Include timestamps", hint: "Default for copying, TXT, and the window." },
        { key: "timestampFormat", type: "select", label: "Format", options: [["auto", "Automatic (adds hours when needed)"], ["mmss", "00:00"], ["hhmmss", "00:00:00"], ["seconds", "Seconds only"], ["ms", "00:00:00.000"]] },
        { key: "timestampWrap", type: "seg", label: "Brackets", options: [["brackets", "[ ]"], ["parens", "( )"], ["none", "None"]] },
        { key: "timestampSeparator", type: "select", label: "After timestamp", options: [[" ", "Space"], [" - ", "Hyphen"], [" — ", "Em dash"], ["\t", "Tab"]] }] },
      { title: "Clean-up", fields: [
        { key: "cleanTags", type: "toggle", label: "Remove caption tags", hint: "Strips leftover markup such as <font>." },
        { key: "removeSoundCues", type: "toggle", label: "Remove sound cues", hint: "Deletes [Music], [Applause] and ♪ lines." },
        { key: "removeDuplicates", type: "toggle", label: "Remove repeated lines", hint: "Drops a line that repeats the one before it." },
        { key: "removeBlankLines", type: "toggle", label: "Remove extra blank lines" }] },
      { title: "Paragraphs", desc: "Auto-generated captions arrive in short pieces. Join them into readable paragraphs.", fields: [
        { key: "mergeParagraphs", type: "toggle", label: "Join lines into paragraphs" },
        { key: "paragraphGap", type: "range", label: "Start a new paragraph after a pause of", min: 0.5, max: 10, step: 0.5, unit: " s", showIf: (s) => s.mergeParagraphs }] },
      { title: "Copied text", fields: [
        { key: "includeHeader", type: "toggle", label: "Add video details at the top", hint: "Title, link, languages and date." }] }
    ] },
    { id: "dual", title: "Dual language", icon: "dual", desc: "Show and copy two languages together.", cards: [
      { title: "Dual mode", fields: [
        { key: "dualMode", type: "toggle", label: "Show two languages", hint: "Needs a translation language chosen in the window." },
        { key: "swapOrder", type: "toggle", label: "Translation first", hint: "Swap which language comes first." },
        { key: "copyScope", type: "select", label: "Copy and download", options: [["both", "Both languages"], ["original", "Original only"], ["translation", "Translation only"]] }] },
      { title: "Layout", desc: "Applies to the window, copied text, SRT and VTT.", fields: [
        { key: "dualLayout", type: "seg", label: "Arrangement", options: [["stacked", "Stacked"], ["side", "Side by side"], ["delimited", "One line"]], hint: "Side by side shows columns in the window and separates copied text with a tab." },
        { key: "delimiter", type: "select", label: "Separator for one line", options: [[" | ", "Vertical bar  |"], [" / ", "Slash  /"], [" — ", "Em dash  —"], [" · ", "Dot  ·"], ["\t", "Tab"]], showIf: (s) => s.dualLayout === "delimited" }] },
      { title: "Visible in the window", fields: [
        { key: "showOriginal", type: "toggle", label: "Show original text" },
        { key: "showTranslation", type: "toggle", label: "Show translated text" }] }
    ] },
    { id: "appearance", title: "Appearance", icon: "appearance", split: true, desc: "Colors, fonts and size of the transcript window. The preview updates as you change things.", cards: [
      { title: "Theme", desc: "System follows YouTube's light or dark mode.", fields: [{ key: "theme", type: "presets" }] },
      { title: "Colors", desc: "Changing a color switches the theme to Custom.", fields: COLOR_FIELDS.map(([key, label]) => ({ key, type: "color", label })) },
      { title: "Text", fields: [
        { key: "fontFamily", type: "select", label: "Font", options: [["system", "Standard"], ["serif", "Serif"], ["mono", "Monospace"], ["rounded", "Rounded"]] },
        { key: "fontSize", type: "range", label: "Original text size", min: 11, max: 24, step: 1, unit: " px" },
        { key: "translationSize", type: "range", label: "Translation size", min: 10, max: 22, step: 1, unit: " px" },
        { key: "lineHeight", type: "range", label: "Line spacing", min: 1.2, max: 2, step: 0.05, unit: "" }] },
      { title: "Window", fields: [
        { key: "density", type: "seg", label: "Spacing", options: [["comfortable", "Comfortable"], ["compact", "Compact"]] },
        { key: "highlightStyle", type: "seg", label: "Current line", options: [["bar", "Bar"], ["fill", "Fill"], ["underline", "Underline"]] },
        { key: "radius", type: "range", label: "Corner roundness", min: 0, max: 28, step: 1, unit: " px" },
        { key: "opacity", type: "range", label: "Background opacity", min: 40, max: 100, step: 5, unit: "%" }] },
      { title: "Window size", desc: "Drag the corner of a floating window to resize it. The size is saved.", fields: [
        { key: "listHeight", type: "range", label: "Height beside video", min: 240, max: 900, step: 10, unit: " px" },
        { key: "panelWidth", type: "range", label: "Floating width", min: 320, max: 900, step: 10, unit: " px" },
        { key: "panelHeight", type: "range", label: "Floating height", min: 300, max: 1000, step: 10, unit: " px" },
        { type: "button", label: "Reset floating position", hint: "Moves the window back to the top right.", button: "Reset position", action: () => { save({ floatX: -1, floatY: -1 }); toast("Position reset"); } }] }
    ] },
    { id: "export", title: "Copy & export", icon: "export", desc: "Control what ends up in your clipboard and files.", cards: [
      { title: "Download buttons", desc: "Choose which formats appear in the window.", fields: [{ key: "showFormats", type: "chips", options: [["txt", "TXT"], ["srt", "SRT"], ["vtt", "VTT"], ["csv", "CSV"]] }] },
      { title: "File details", fields: [
        { key: "lineEnding", type: "seg", label: "Line endings", options: [["lf", "LF (Mac, Linux)"], ["crlf", "CRLF (Windows)"]] },
        { key: "includeBom", type: "toggle", label: "UTF-8 byte order mark", hint: "Helps Excel and Notepad show Urdu, Arabic, Turkish and other scripts correctly." },
        { key: "csvDelimiter", type: "select", label: "CSV separator", options: [[",", "Comma"], [";", "Semicolon"], ["\t", "Tab"]] },
        { key: "srtMinDuration", type: "range", label: "Shortest subtitle (SRT, VTT)", min: 0.5, max: 5, step: 0.5, unit: " s" }] },
      { title: "Feedback", fields: [
        { key: "notifyOnCopy", type: "toggle", label: "Show a message after copying" }] }
    ] },
    { id: "downloads", title: "Downloads", icon: "download", desc: "Where files go and what they are called.", cards: [
      { title: "Save location", fields: [
        { key: "downloadFolder", type: "text", label: "Subfolder", stack: true, placeholder: "e.g. YouTube Transcripts/Turkish", hint: "Created inside your browser's Downloads folder. Leave empty to save directly in Downloads." },
        { key: "saveAs", type: "toggle", label: "Ask where to save each file", hint: "Opens the save dialog so you can pick any folder on your computer." },
        { key: "conflictAction", type: "select", label: "If the file already exists", options: [["uniquify", "Add a number"], ["overwrite", "Replace it"], ["prompt", "Ask me"]] },
        { key: "revealAfterDownload", type: "toggle", label: "Show file when finished" },
        { type: "button", label: "Browser download folder", hint: "Browsers only allow extensions to save inside the Downloads folder. To change that folder everywhere, use the browser's own setting.", button: "Open browser settings", action: openBrowserDownloads }] },
      { title: "File name", desc: "Click a tag to add it. The extension is added for you.", fields: [{ key: "filenameTemplate", type: "template" }] }
    ] },
    { id: "player", title: "Player & sync", icon: "player", desc: "How the transcript follows the video.", cards: [
      { title: "Follow the video", fields: [
        { key: "highlightCurrent", type: "toggle", label: "Highlight the current line" },
        { key: "autoScroll", type: "toggle", label: "Scroll along with the video" },
        { key: "scrollBehavior", type: "seg", label: "Scroll style", options: [["smooth", "Smooth"], ["auto", "Instant"]] },
        { key: "resumeScrollDelay", type: "range", label: "Resume after you scroll", min: 0, max: 15, step: 1, unit: " s", hint: "Auto-scroll pauses while you read elsewhere." }] },
      { title: "Clicking a line", fields: [
        { key: "clickToSeek", type: "toggle", label: "Jump the video to that line" },
        { key: "seekOffset", type: "number", label: "Start earlier or later by", min: -10, max: 10, step: 0.5, unit: "s", hint: "Use −1 to begin one second before each line." }] }
    ] },
    { id: "shortcuts", title: "Shortcuts", icon: "keys", desc: "Keyboard shortcuts that work on YouTube pages.", cards: [
      { title: "On YouTube", desc: "Click a box, then press the keys. Include Alt, Ctrl or Cmd. Esc cancels.", fields: [
        { key: "keyTogglePanel", type: "key", label: "Open or close the window" },
        { key: "keyCopyTime", type: "key", label: "Copy with timestamps" },
        { key: "keyCopyClean", type: "key", label: "Copy without timestamps" },
        { key: "keyDownloadTxt", type: "key", label: "Download TXT" },
        { key: "keyFocusSearch", type: "key", label: "Search the transcript" }] },
      { title: "Browser-wide", fields: [
        { type: "button", label: "Toggle from any page", hint: "Assign a shortcut to open the window from the browser's own shortcuts page.", button: "Open shortcut settings", action: openBrowserShortcuts }] }
    ] },
    { id: "advanced", title: "Advanced", icon: "advanced", desc: "Backup, reset and troubleshooting.", cards: [
      { title: "Backup", fields: [
        { type: "buttons", buttons: [["Export settings", exportSettings], ["Import settings", importSettings]], hint: "Save your settings to a JSON file or load them on another computer." }] },
      { title: "Reset", fields: [
        { type: "buttons", buttons: [["Reset all settings", resetAll, "danger"]], hint: "Restores every option to its default." }] },
      { title: "Troubleshooting", fields: [
        { key: "debug", type: "toggle", label: "Log details to the console", hint: "Open the YouTube tab's developer tools (F12) to see messages." }] }
    ] },
    { id: "about", title: "About", icon: "about", desc: "Privacy and help.", cards: [{ title: "YT Transcript Pro", wide: true, fields: [{ type: "about" }] }] }
  ];

  /* ---------- control builders ---------- */
  const rowEl = (f, control) => {
    const stack = f.stack || f.type === "presets" || f.type === "chips" || f.type === "template";
    const text = f.label ? h("div", { class: "row-text" }, h("span", { class: "lbl" }, f.label), f.hint ? h("small", {}, f.hint) : null) : (f.hint ? h("div", { class: "row-text" }, h("small", {}, f.hint)) : null);
    const row = h("div", { class: `row${stack ? " stack" : ""}`, data: { search: `${f.label || ""} ${f.hint || ""}`.toLowerCase() } }, text, h("div", { class: "control" }, control));
    if (f.showIf) conditional.push({ el: row, showIf: f.showIf });
    return row;
  };
  const bind = (key, setter) => { controls[key] = setter; };

  function buildField(f) {
    switch (f.type) {
      case "toggle": {
        const input = h("input", { type: "checkbox", id: `f-${f.key}`, onChange: (e) => save({ [f.key]: e.target.checked }) });
        bind(f.key, (v) => { input.checked = Boolean(v); });
        const row = rowEl(f, h("span", { class: "switch" }, input, h("span")));
        row.querySelector(".lbl").replaceWith(h("label", { class: "lbl", for: `f-${f.key}` }, f.label));
        return row;
      }
      case "select": {
        const sel = h("select", { onChange: (e) => save({ [f.key]: e.target.value }) }, f.options.map(([v, t]) => h("option", { value: v }, t)));
        bind(f.key, (v) => { sel.value = v; });
        return rowEl(f, sel);
      }
      case "seg": {
        const btns = f.options.map(([v, t]) => h("button", { type: "button", "aria-pressed": "false", data: { v }, onClick: () => save({ [f.key]: v }) }, t));
        bind(f.key, (v) => btns.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === String(v)))));
        return rowEl(f, h("div", { class: "seg", role: "group" }, btns));
      }
      case "range": {
        const out = h("output", {});
        const fmt = (v) => `${Number.isInteger(f.step) ? Math.round(v) : Number(v).toFixed(f.step < 0.1 ? 2 : 1)}${f.unit || ""}`;
        const input = h("input", { type: "range", min: f.min, max: f.max, step: f.step, "aria-label": f.label, onInput: (e) => { out.textContent = fmt(+e.target.value); save({ [f.key]: +e.target.value }); } });
        bind(f.key, (v) => { input.value = v; out.textContent = fmt(+v); });
        return rowEl(f, h("div", { class: "range" }, input, out));
      }
      case "number": {
        const input = h("input", { type: "number", min: f.min, max: f.max, step: f.step, "aria-label": f.label, onChange: (e) => { const n = Math.min(f.max, Math.max(f.min, parseFloat(e.target.value) || 0)); e.target.value = n; save({ [f.key]: n }); } });
        bind(f.key, (v) => { input.value = v; });
        return rowEl(f, [input, f.unit ? h("span", {}, f.unit) : null]);
      }
      case "text": {
        const input = h("input", { type: "text", placeholder: f.placeholder || "", "aria-label": f.label, spellcheck: "false", onInput: (e) => save({ [f.key]: e.target.value }) });
        bind(f.key, (v) => { if (document.activeElement !== input) input.value = v ?? ""; });
        return rowEl(f, input);
      }
      case "color": {
        const picker = h("input", { type: "color", "aria-label": f.label, onInput: (e) => setColor(f.key, e.target.value) });
        const hex = h("input", { type: "text", maxlength: 7, spellcheck: "false", "aria-label": `${f.label} hex`, onChange: (e) => { const v = e.target.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) setColor(f.key, v.startsWith("#") ? v : `#${v}`); else e.target.value = root.resolveColors(cur)[f.key]; } });
        bind(f.key, () => { const c = root.resolveColors(cur)[f.key]; picker.value = c; if (document.activeElement !== hex) hex.value = c; });
        return rowEl(f, h("div", { class: "swatch" }, picker, hex));
      }
      case "presets": return buildPresets(f);
      case "chips": {
        const btns = f.options.map(([v, t]) => h("button", { type: "button", "aria-pressed": "false", data: { v }, onClick: () => {
          const set = new Set(String(cur[f.key]).split(",").filter(Boolean));
          set.has(v) ? set.delete(v) : set.add(v);
          if (!set.size) { toast("Keep at least one format"); return; }
          save({ [f.key]: f.options.map(([x]) => x).filter((x) => set.has(x)).join(",") });
        } }, t));
        bind(f.key, (v) => { const set = new Set(String(v).split(",")); btns.forEach((b) => b.setAttribute("aria-pressed", String(set.has(b.dataset.v)))); });
        return rowEl({ ...f, type: "chips" }, h("div", { class: "chips" }, btns));
      }
      case "template": return buildTemplate(f);
      case "key": return buildKey(f);
      case "button": {
        const row = rowEl(f, h("button", { class: "btn", type: "button", onClick: f.action }, f.button));
        return row;
      }
      case "buttons": return h("div", { class: "btn-row", data: { search: `${f.hint || ""} ${f.buttons.map((b) => b[0]).join(" ")}`.toLowerCase() } },
        f.buttons.map(([t, fn, cls]) => h("button", { class: `btn ${cls || ""}`, type: "button", onClick: fn }, t)),
        f.hint ? h("small", { style: { flexBasis: "100%", color: "var(--muted)" } }, f.hint) : null);
      case "about": return buildAbout();
      default: return h("div");
    }
  }

  function setColor(key, value) {
    const resolved = root.resolveColors(cur);
    const patch = { ...resolved, [key]: value.toLowerCase(), theme: "custom" };
    save(patch);
    syncControls();
  }

  function buildPresets(f) {
    const btns = THEMES.map(([id, name]) => {
      const mini = h("span", { class: "mini" });
      const paint = () => {
        const colors = id === "system" ? (root.isDark() ? root.PRESETS.dark : root.PRESETS.light) : id === "custom" ? { colorBg: cur.colorBg, colorText: cur.colorText, colorTranslation: cur.colorTranslation, colorActive: cur.colorActive, colorBorder: cur.colorBorder } : root.PRESETS[id];
        mini.style.background = colors.colorBg; mini.style.borderColor = colors.colorBorder;
        mini.replaceChildren(h("i", { style: { background: colors.colorText } }), h("i", { style: { background: colors.colorTranslation } }), h("i", { class: "hl", style: { background: colors.colorActive } }), h("i", { style: { background: colors.colorText, width: "74%" } }));
      };
      paint();
      const b = h("button", { class: "preset", type: "button", "aria-pressed": "false", data: { v: id }, title: name, onClick: () => {
        if (id === "custom") save({ ...root.resolveColors(cur), theme: "custom" }); else save({ theme: id });
        syncControls();
      } }, mini, h("b", {}, name));
      b._paint = paint;
      return b;
    });
    bind(f.key, (v) => btns.forEach((b) => { b.setAttribute("aria-pressed", String(b.dataset.v === v)); if (b.dataset.v === "custom") b._paint(); }));
    return h("div", { class: "presets", data: { search: "theme preset light dark midnight sepia forest contrast custom" } }, btns);
  }

  function buildTemplate(f) {
    const input = h("input", { type: "text", spellcheck: "false", "aria-label": "File name template", onInput: (e) => { save({ [f.key]: e.target.value }); updateExample(); } });
    const example = h("div", { class: "example" });
    const tokens = ["title", "videoId", "channel", "lang", "date", "time", "format"];
    function updateExample() {
      const sample = { title: "Learn Turkish with a Slow Podcast", videoId: "vyc5-LKnNis", channel: "Learn Turkish by Listening", lang: "tr-en" };
      example.textContent = `Example: ${root.buildFilename(input.value || "{title}", sample, "txt")}`;
    }
    bind(f.key, (v) => { if (document.activeElement !== input) input.value = v; updateExample(); });
    const chips = h("div", { class: "chips" }, tokens.map((t) => h("button", { type: "button", onClick: () => { input.value += `{${t}}`; input.dispatchEvent(new Event("input")); input.focus(); } }, `{${t}}`)));
    const row = h("div", { class: "row stack", data: { search: "file name template title channel date video id language" } }, input, chips, example);
    return row;
  }
  function buildKey(f) {
    const box = h("input", { type: "text", class: "keybox", readonly: "readonly", "aria-label": f.label });
    const clear = h("button", { class: "btn", type: "button", title: "Remove shortcut", onClick: () => save({ [f.key]: "" }) || syncControls() }, "Clear");
    const combo = (e) => {
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return "";
      const parts = [];
      if (e.ctrlKey) parts.push("Ctrl"); if (e.altKey) parts.push("Alt"); if (e.shiftKey) parts.push("Shift"); if (e.metaKey) parts.push("Meta");
      const k = e.code.startsWith("Key") ? e.code.slice(3) : e.code.startsWith("Digit") ? e.code.slice(5) : (e.key.length === 1 ? e.key.toUpperCase() : e.key);
      return [...parts, k].join("+");
    };
    box.addEventListener("focus", () => { box.dataset.recording = "true"; box.value = "Press keys…"; });
    box.addEventListener("blur", () => { box.dataset.recording = "false"; box.value = cur[f.key] || "Not set"; });
    box.addEventListener("keydown", (e) => {
      e.preventDefault();
      if (e.key === "Escape") { box.blur(); return; }
      const c = combo(e);
      if (!c) return;
      if (!/^(Ctrl|Alt|Meta)/.test(c)) { box.value = "Add Alt, Ctrl or Cmd"; return; }
      const clash = Object.keys(controls).find((k) => k.startsWith("key") && k !== f.key && cur[k] === c);
      if (clash) { box.value = "Already in use"; return; }
      save({ [f.key]: c }); box.blur();
    });
    bind(f.key, (v) => { if (document.activeElement !== box) box.value = v || "Not set"; });
    return rowEl(f, [box, clear]);
  }

  function buildAbout() {
    const v = chrome.runtime.getManifest().version;
    return h("div", { class: "about" },
      h("p", {}, `Version ${v}. Copy or download YouTube transcripts and two-language subtitles, with or without timestamps.`),
      h("p", {}, h("strong", {}, "Privacy")),
      h("ul", {}, h("li", {}, "Everything runs in your browser. No account, no server, no analytics."), h("li", {}, "Captions are read from YouTube's own caption data for the video you are watching. Video and audio are never downloaded."), h("li", {}, "Settings are stored on this device with the browser's extension storage.")),
      h("p", {}, h("strong", {}, "If a transcript will not load")),
      h("ul", {}, h("li", {}, "Refresh the YouTube tab once after installing or updating the extension."), h("li", {}, "Some videos have no captions, or the uploader turned them off."), h("li", {}, "Translations come from YouTube. A language that is not offered for a video cannot be loaded."), h("li", {}, "Turn on Log details in Advanced, press F12 on the YouTube tab, and read the Console.")));
  }

  /* ---------- actions ---------- */
  function openBrowserDownloads() { chrome.tabs.create({ url: isEdge ? "edge://settings/downloads" : "chrome://settings/downloads" }); }
  function openBrowserShortcuts() { chrome.tabs.create({ url: isEdge ? "edge://extensions/shortcuts" : "chrome://extensions/shortcuts" }); }
  function exportSettings() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(cur, null, 2)], { type: "application/json" }));
    const a = h("a", { href: url, download: "yt-transcript-pro-settings.json" }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  function importSettings() {
    const input = h("input", { type: "file", accept: "application/json,.json", onChange: async () => {
      try {
        const data = JSON.parse(await input.files[0].text());
        const clean = {};
        Object.keys(D).forEach((k) => { if (k in data && typeof data[k] === typeof D[k]) clean[k] = data[k]; });
        save(clean); syncControls(); toast(`Imported ${Object.keys(clean).length} settings`);
      } catch { toast("That file is not a settings backup"); }
    } });
    input.click();
  }
  async function resetAll() {
    if (!confirm("Reset every setting to its default?")) return;
    cur = await root.Settings.reset(); syncControls(); toast("Settings reset");
  }

  /* ---------- preview ---------- */
  let previewPanel;
  const SAMPLE = [
    { start: 0, text: "Merhaba.", translation: "Hello." },
    { start: 2, text: "Bugün Türkiye hakkında konuşuyoruz.", translation: "Today we are talking about Turkey." },
    { start: 6, text: "Çay içelim mi?", translation: "Shall we have tea?" },
    { start: 9, text: "Evet, lütfen.", translation: "Yes, please." }
  ];
  function buildPreview() {
    previewPanel = h("section", { id: "ytp-panel", class: "ytp-open ytp-preview", "data-mode": "docked" });
    return h("div", { class: "card preview-card" }, h("h2", {}, "Live preview"), h("div", { class: "checker" }, previewPanel), h("p", { class: "hint" }, "Uses the same window you see on YouTube."));
  }
  function renderPreview() {
    if (!previewPanel) return;
    const s = cur; root.applyTheme(previewPanel, s);
    const cols = root.columns(s, true);
    const rows = SAMPLE.map((r, i) => {
      const parts = [{ key: cols.first, cls: "ytp-orig" }]; if (cols.second) parts.push({ key: cols.second });
      const vis = parts.filter((p) => !cols.dual || (p.key === "text" ? s.showOriginal : s.showTranslation));
      return h("article", { class: `ytp-line${i === 1 ? " ytp-active" : ""}` },
        s.timestamps ? h("button", { class: "ytp-time", type: "button", tabindex: -1 }, root.formatStamp(r.start, { ...s, timestampWrap: "none" })) : null,
        h("div", { class: "ytp-text", dir: "auto" }, vis.map((p, n) => [n > 0 && s.dualLayout === "delimited" ? h("span", { class: "ytp-delim" }, s.delimiter.trim() || "|") : null, h("div", { class: p.key === "text" ? "ytp-orig" : "ytp-trans", dir: "auto" }, r[p.key])])));
    });
    const sel = (t) => h("select", { disabled: "disabled" }, h("option", {}, t));
    previewPanel.replaceChildren(
      h("header", { class: "ytp-header" }, h("div", { class: "ytp-brand" }, h("span", { class: "ytp-logo" }, root.captionIcon(20)), h("div", { class: "ytp-brand-text" }, h("strong", {}, "YT Transcript Pro"), h("small", {}, "Learn Turkish with a Slow Podcast")))),
      h("div", { class: "ytp-body" },
        h("div", { class: "ytp-langs" }, h("label", {}, h("span", {}, "Original"), sel("Turkish")), h("label", {}, h("span", {}, "Translation"), sel("English"))),
        h("div", { class: "ytp-actions ytp-actions-copy" }, h("button", { class: "ytp-btn ytp-primary", type: "button", tabindex: -1 }, "Copy with timestamps"), h("button", { class: "ytp-btn ytp-primary", type: "button", tabindex: -1 }, "Copy without timestamps")),
        h("div", { class: "ytp-lines" }, rows)),
      h("footer", { class: "ytp-footer" }, h("span", { class: "ytp-status" }, "4 lines · Turkish"), h("span", { class: "ytp-hint" }, "Ctrl+click selects lines")));
  }

  /* ---------- page assembly ---------- */
  function refreshConditions() { conditional.forEach(({ el, showIf }) => el.classList.toggle("is-hidden", !showIf(cur))); }

  function build() {
    const nav = document.getElementById("nav"), host = document.getElementById("sections");
    SCHEMA.forEach((sec) => {
      nav.append(h("button", { type: "button", data: { id: sec.id }, "aria-current": "false", onClick: () => select(sec.id) }, ICONS[sec.icon](), h("span", {}, sec.title)));
      const cards = sec.cards.map((c) => h("div", { class: `card${c.wide ? " wide" : ""}` },
        h("h2", {}, c.title), c.desc ? h("p", { class: "card-desc" }, c.desc) : null, c.fields.map(buildField)));
      const body = sec.split ? h("div", { class: "layout-split" }, h("div", { class: "grid" }, cards), h("div", { class: "preview-col" }, buildPreview())) : h("div", { class: "grid" }, cards);
      host.append(h("section", { class: "section", id: `sec-${sec.id}`, "aria-labelledby": `h-${sec.id}` }, h("div", { class: "section-head" }, h("h1", { id: `h-${sec.id}` }, sec.title), h("p", {}, sec.desc)), body));
    });
    document.getElementById("version").textContent = `v${chrome.runtime.getManifest().version}`;
  }

  function select(id, { updateHash = true } = {}) {
    if (!SCHEMA.some((s) => s.id === id)) id = "general";
    document.body.classList.remove("searching"); document.getElementById("search").value = ""; clearSearch();
    document.querySelectorAll(".section").forEach((s) => s.classList.toggle("is-active", s.id === `sec-${id}`));
    document.querySelectorAll("#nav button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.id === id)));
    if (updateHash) history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0 });
  }

  function clearSearch() {
    document.querySelectorAll(".row, .btn-row, .presets, .card").forEach((n) => n.classList.remove("is-hidden", "search-miss"));
    document.querySelectorAll(".section").forEach((s) => s.classList.remove("has-hits"));
    document.getElementById("no-results").hidden = true;
    refreshConditions();
  }

  function runSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) { document.body.classList.remove("searching"); clearSearch(); const hash = location.hash.slice(1); select(hash || "general", { updateHash: false }); return; }
    document.body.classList.add("searching");
    let total = 0;
    document.querySelectorAll(".section").forEach((section) => {
      let hits = 0;
      section.querySelectorAll(".card").forEach((card) => {
        const title = card.querySelector("h2")?.textContent.toLowerCase() || "";
        const titleHit = title.includes(q);
        let cardHits = 0;
        card.querySelectorAll(".row, .btn-row, .presets").forEach((r) => {
          const hit = titleHit || (r.dataset.search || "").includes(q);
          r.classList.toggle("is-hidden", !hit); if (hit) cardHits += 1;
        });
        card.classList.toggle("is-hidden", cardHits === 0); hits += cardHits;
      });
      section.classList.toggle("has-hits", hits > 0); total += hits;
    });
    document.getElementById("no-results").hidden = total > 0;
  }

  (async () => {
    cur = await root.Settings.get();
    build();
    syncControls();
    select(location.hash.slice(1) || "general", { updateHash: false });
    document.getElementById("search").addEventListener("input", (e) => runSearch(e.target.value));
    window.addEventListener("hashchange", () => select(location.hash.slice(1), { updateHash: false }));
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { syncControls(); });
    root.Settings.onChange((next) => { if (!Object.keys(pending).length) { cur = next; syncControls(); } });
  })();
})();
