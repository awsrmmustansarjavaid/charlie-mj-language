/* Charlie MJ Language v2.0.0 storage adapter for the integrated YT Transcript Pro module. */
(() => {
  const root = (typeof window !== "undefined" ? (window.YTP = window.YTP || {}) : {});
  const readAll = async () => {
    try { return (await chrome.storage.local.get("settings")).settings || {}; } catch { return {}; }
  };
  const getNested = (settings) => ({ ...root.DEFAULTS, ...(settings.ytTranscriptPro || {}) });
  root.Settings = {
    async get() { return getNested(await readAll()); },
    async set(patch) {
      const settings = await readAll();
      const next = { ...getNested(settings), ...patch };
      await chrome.storage.local.set({ settings: { ...settings, ytTranscriptPro: next } });
      return next;
    },
    async reset() {
      const settings = await readAll();
      const next = { ...root.DEFAULTS };
      await chrome.storage.local.set({ settings: { ...settings, ytTranscriptPro: next } });
      return next;
    },
    onChange(callback) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local" || !changes.settings) return;
        callback(getNested(changes.settings.newValue || {}));
      });
    }
  };
})();
