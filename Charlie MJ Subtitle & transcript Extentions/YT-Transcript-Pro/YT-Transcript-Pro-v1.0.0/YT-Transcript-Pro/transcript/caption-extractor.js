/* Talks to the page bridge (MAIN world) to list caption tracks and download caption text. */
(() => {
  const root = window.YTP = window.YTP || {};
  let counter = 0;
  const pending = new Map();

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.data?.source !== "YTP_PAGE") return;
    const entry = pending.get(event.data.id);
    if (!entry) return;
    pending.delete(event.data.id);
    clearTimeout(entry.timer);
    event.data.ok ? entry.resolve(event.data.data) : entry.reject(new Error(event.data.error || "Page bridge error"));
  });

  root.bridge = (type, payload, timeout = 15000) => new Promise((resolve, reject) => {
    const id = `ytp-${Date.now()}-${++counter}`;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("YouTube did not respond. Refresh the page and try again.")); }, timeout);
    pending.set(id, { resolve, reject, timer });
    window.postMessage({ source: "YTP_CS", id, type, payload }, "*");
  });

  root.loadVideoInfo = (videoId) => root.bridge("tracks", { videoId });

  root.fetchCaptionTrack = async (track, translateTo = "") => {
    if (!track?.baseUrl) throw new Error("This subtitle track is unavailable.");
    const url = new URL(track.baseUrl);
    if (translateTo && translateTo !== track.languageCode) url.searchParams.set("tlang", translateTo);
    const { body } = await root.bridge("timedtext", { url: url.toString(), track: { languageCode: track.languageCode, kind: track.kind } }, 25000);
    return root.parseCaptionPayload(body);
  };
})();
