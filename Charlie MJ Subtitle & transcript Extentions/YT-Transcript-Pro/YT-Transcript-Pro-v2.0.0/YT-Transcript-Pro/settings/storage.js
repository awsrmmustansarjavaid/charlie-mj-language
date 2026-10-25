/* chrome.storage.local wrapper with defaults and live change events. */
(() => {
  const root = (typeof window !== "undefined" ? (window.YTP = window.YTP || {}) : {});
  const KEY = root.STORAGE_KEY;
  root.Settings = {
    async get() {
      try {
        const stored = await chrome.storage.local.get(KEY);
        return { ...root.DEFAULTS, ...(stored[KEY] || {}) };
      } catch { return { ...root.DEFAULTS }; }
    },
    async set(patch) {
      const current = await this.get();
      const next = { ...current, ...patch };
      await chrome.storage.local.set({ [KEY]: next });
      return next;
    },
    async reset() { await chrome.storage.local.set({ [KEY]: { ...root.DEFAULTS } }); return { ...root.DEFAULTS }; },
    onChange(callback) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes[KEY]) callback({ ...root.DEFAULTS, ...(changes[KEY].newValue || {}) });
      });
    }
  };
})();
