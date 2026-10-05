/*
 * Charlie MJ Language - Extension Service Worker
 * ------------------------------------------------
 * Central background logic for MV3. It handles keyboard commands, downloads,
 * default settings, and messages that are shared by the popup/content scripts.
 * The service worker intentionally contains no page-specific DOM code.
 */

const DEFAULT_SETTINGS = {
  targetLanguage: "tr",
  nativeLanguage: "en",
  translationProvider: "mymemory",
  libreTranslateUrl: "",
  focusMode: false,
  grammarColors: true,
  grammarBold: true,
  showLevels: true,
  autoSaveCaptures: true,
  downloadFolder: "Charlie MJ Language",
  theme: "midnight"
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get("settings");
  if (!current.settings) await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
});

chrome.commands.onCommand.addListener(async (command) => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url?.includes("youtube.com")) return;
  if (command === "toggle-focus-mode") {
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_FOCUS" });
  }
  if (command === "capture-learning-moment") {
    await chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_MOMENT" });
  }
});

/** Download UTF-8 text using the Chrome downloads API. */
async function downloadText({ filename, text, mime = "text/plain;charset=utf-8" }) {
  const url = `data:${mime},${encodeURIComponent(text)}`;
  const settings = await chrome.storage.local.get("settings");
  const folder = settings.settings?.downloadFolder || DEFAULT_SETTINGS.downloadFolder;
  return chrome.downloads.download({
    url,
    filename: `${folder}/${filename}`,
    saveAs: false,
    conflictAction: "uniquify"
  });
}


/** Translate text through the configured provider. External calls are isolated
 * in the service worker so content scripts do not need direct API permissions. */
async function translateText({ text, source, target }) {
  if (!text?.trim()) return { text: "", provider: "none" };
  const settingsResult = await chrome.storage.local.get("settings");
  const settings = { ...DEFAULT_SETTINGS, ...(settingsResult.settings || {}) };
  const cacheResult = await chrome.storage.local.get("translationCache");
  const cache = cacheResult.translationCache || {};
  const cacheKey = `${settings.translationProvider}|${source}|${target}|${text}`;
  if (cache[cacheKey]) return { text: cache[cacheKey], provider: settings.translationProvider, cached: true };

  let translated = "";
  if (settings.translationProvider === "mymemory") {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(source || "auto")}|${encodeURIComponent(target || "en")}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`MyMemory HTTP ${response.status}`);
    const data = await response.json();
    translated = data?.responseData?.translatedText || "";
  } else if (settings.translationProvider === "libretranslate") {
    if (!settings.libreTranslateUrl) throw new Error("LibreTranslate URL is not configured");
    const response = await fetch(settings.libreTranslateUrl.replace(/\/$/, "") + "/translate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: text, source: source || "auto", target: target || "en", format: "text" })
    });
    if (!response.ok) throw new Error(`LibreTranslate HTTP ${response.status}`);
    const data = await response.json();
    translated = data?.translatedText || "";
  }
  if (!translated) return { text: "", provider: settings.translationProvider };
  cache[cacheKey] = translated;
  const entries = Object.entries(cache);
  if (entries.length > 500) delete cache[entries[0][0]];
  await chrome.storage.local.set({ translationCache: cache });
  return { text: translated, provider: settings.translationProvider, cached: false };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "DOWNLOAD_TEXT") {
    downloadText(message).then(id => sendResponse({ ok: true, id })).catch(error => {
      sendResponse({ ok: false, error: error.message });
    });
    return true;
  }

  if (message?.type === "DOWNLOAD_DATA_URL") {
    chrome.storage.local.get("settings").then(settings => {
      const folder = settings.settings?.downloadFolder || DEFAULT_SETTINGS.downloadFolder;
      return chrome.downloads.download({ url: message.dataUrl, filename: `${folder}/${message.filename}`, saveAs: false, conflictAction: "uniquify" });
    }).then(id => sendResponse({ ok: true, id })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "DOWNLOAD_URL") {
    chrome.storage.local.get("settings").then(settings => {
      const folder = settings.settings?.downloadFolder || DEFAULT_SETTINGS.downloadFolder;
      return chrome.downloads.download({ url: message.url, filename: `${folder}/${message.filename}`, saveAs: false, conflictAction: "uniquify" });
    }).then(id => sendResponse({ ok: true, id })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "TRANSLATE") {
    translateText(message).then(result => sendResponse({ ok: true, ...result })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "CAPTURE_VISIBLE_TAB") {
    chrome.tabs.captureVisibleTab(sender.tab?.windowId, { format: "png" }).then(dataUrl => sendResponse({ ok: true, dataUrl })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message?.type === "GET_DEFAULTS") {
    sendResponse(DEFAULT_SETTINGS);
  }
});
