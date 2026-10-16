/* Charlie MJ Dual Transcript Engine - minimal service worker.
 * It only handles cache persistence requests. Transcript fetching stays in the
 * YouTube content-script context so the extension remains small and local-first.
 */
const CACHE_KEY = 'cmjDualTranscriptCache';
const MAX_ENTRIES = 50;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message?.type === 'CMJ_INJECT_BRIDGE') {
    const tabId = sender?.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false, error: 'No YouTube tab id available.' });
      return false;
    }

    // Execute the bridge in the page's MAIN world. This avoids the CSP/security
    // error caused by inserting a chrome-extension:// script element into
    // youtube.com while still allowing us to observe YouTube's own caption
    // requests and player metadata.
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      files: ['src/inject.js']
    }).then(() => {
      sendResponse({ ok: true });
    }).catch((error) => {
      sendResponse({ ok: false, error: error?.message || String(error) });
    });
    return true;
  }
  if (message?.type === 'CACHE_GET') {
    chrome.storage.local.get(CACHE_KEY).then((data) => {
      sendResponse({ ok: true, value: data[CACHE_KEY]?.[message.key] || null });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  }

  if (message?.type === 'CACHE_SET') {
    chrome.storage.local.get(CACHE_KEY).then(async (data) => {
      const cache = data[CACHE_KEY] || {};
      cache[message.key] = { ...message.value, lastUsed: Date.now() };
      const entries = Object.entries(cache).sort((a, b) => (b[1].lastUsed || 0) - (a[1].lastUsed || 0));
      const trimmed = Object.fromEntries(entries.slice(0, MAX_ENTRIES));
      await chrome.storage.local.set({ [CACHE_KEY]: trimmed });
      sendResponse({ ok: true });
    }).catch(() => sendResponse({ ok: false }));
    return true;
  }
});
