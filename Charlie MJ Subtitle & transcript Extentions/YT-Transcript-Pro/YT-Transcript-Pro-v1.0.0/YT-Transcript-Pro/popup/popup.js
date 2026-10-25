/* Toolbar popup: shows the current video, one-click copy/download, and quick settings. */
(async () => {
  "use strict";
  const root = window.YTP, { h, svg } = root;
  const $ = (s) => document.querySelector(s);
  let tab = null, cur = await root.Settings.get();

  $("#version").textContent = `v${chrome.runtime.getManifest().version}`;
  $("#open-settings").append(svg("svg", { viewBox: "0 0 24 24", width: 18, height: 18, fill: "none", stroke: "currentColor", "stroke-width": 1.8, "stroke-linecap": "round" },
    svg("line", { x1: 4, y1: 6, x2: 20, y2: 6 }), svg("line", { x1: 4, y1: 12, x2: 20, y2: 12 }), svg("line", { x1: 4, y1: 18, x2: 20, y2: 18 }),
    svg("circle", { cx: 9, cy: 6, r: 2, fill: "var(--soft)" }), svg("circle", { cx: 15, cy: 12, r: 2, fill: "var(--soft)" }), svg("circle", { cx: 8, cy: 18, r: 2, fill: "var(--soft)" })));

  const openSettings = () => { chrome.runtime.openOptionsPage(); window.close(); };
  $("#open-settings").addEventListener("click", openSettings);
  $("#more").addEventListener("click", openSettings);

  /* ----- quick settings ----- */
  const paint = () => {
    document.querySelectorAll("input[data-key]").forEach((i) => { i.checked = Boolean(cur[i.dataset.key]); });
    document.querySelectorAll("select[data-key]").forEach((s) => { s.value = cur[s.dataset.key]; });
    document.querySelectorAll(".seg[data-key]").forEach((g) => g.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(cur[g.dataset.key] === b.dataset.v))));
  };
  const set = async (patch) => { cur = await root.Settings.set(patch); paint(); };
  document.querySelectorAll("input[data-key]").forEach((i) => i.addEventListener("change", () => set({ [i.dataset.key]: i.checked })));
  document.querySelectorAll("select[data-key]").forEach((s) => s.addEventListener("change", () => set({ [s.dataset.key]: s.value })));
  document.querySelectorAll(".seg[data-key] button").forEach((b) => b.addEventListener("click", () => set({ [b.parentElement.dataset.key]: b.dataset.v })));
  paint();

  /* ----- current tab ----- */
  const say = (text, kind = "") => { const r = $("#result"); r.textContent = text; r.dataset.kind = kind; };
  const send = (msg) => chrome.tabs.sendMessage(tab.id, msg);

  function showEmpty(title, body, link) {
    $("#video").replaceChildren(h("div", { class: "empty" }, h("strong", {}, title), body, link ? [" ", h("a", { href: link.href, target: "_blank", rel: "noreferrer" }, link.text)] : null));
    $("#actions").hidden = true;
  }

  async function refresh() {
    if (!tab?.url || !/^https:\/\/(www\.)?youtube(-nocookie)?\.com\//.test(tab.url)) {
      showEmpty("Open a YouTube video", "Then use the caption button in the player controls, or come back here.", { href: "https://www.youtube.com", text: "Go to YouTube" });
      return;
    }
    let st;
    try { st = await send({ type: "ytp:status" }); }
    catch { showEmpty("Refresh this tab", "The extension was added after this page loaded. Press F5 on the YouTube tab, then try again."); return; }
    if (!st?.supported) { showEmpty("Pick a video", "Transcripts are available on video pages."); return; }

    const meta = [];
    if (st.ready) {
      meta.push(h("div", { class: "meta" }, h("b", {}, `${st.lines} lines`), st.source ? ` · ${st.source}` : "", st.target ? ` + ${st.target}` : ""));
    } else {
      meta.push(h("div", { class: "meta" }, st.status?.kind === "error" ? st.status.text : "Transcript loads when you copy, download, or open the window."));
    }
    $("#video").replaceChildren(h("div", { class: "name" }, st.title || "YouTube video"), ...meta);
    $("#actions").hidden = false;
    $("#scope-row").hidden = !st.target;
    $("#open-panel").textContent = st.open ? "Close transcript window" : "Open transcript window";
  }

  async function run(action, button) {
    if (!tab) return;
    const buttons = document.querySelectorAll("#actions button");
    buttons.forEach((b) => { b.disabled = true; });
    say("Working…");
    try {
      const reply = await send({ type: "ytp:action", action });
      if (reply?.ok) { say(action.startsWith("copy") ? "Copied to clipboard" : action.startsWith("download") ? "Download started" : "", "ok"); if (action === "toggle") { window.close(); return; } }
      else say(reply?.error || "Something went wrong", "error");
    } catch { say("Refresh the YouTube tab and try again.", "error"); }
    buttons.forEach((b) => { b.disabled = false; });
    refresh();
  }

  document.querySelectorAll("[data-action]").forEach((b) => b.addEventListener("click", () => run(b.dataset.action, b)));
  $("#open-panel").addEventListener("click", () => run("toggle"));

  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  refresh();
})();
