/**
 * Charlie MJ Language - Manifest V3 service worker.
 * Responsible for context menus, commands, translation requests, downloads and
 * lightweight background coordination. No GitHub Actions or remote code is used.
 */

const MENU_ROOT = 'cmj-root';
const MENU_WATCH = 'cmj-watch-later';
const MENU_LEARN = 'cmj-open-learning';
const MENU_BOOKMARK = 'cmj-bookmark';
const MENU_SAVE_SELECTION = 'cmj-save-selection';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll().then(() => {
    chrome.contextMenus.create({ id: MENU_ROOT, title: 'Charlie MJ Language', contexts: ['page', 'link', 'selection'] });
    chrome.contextMenus.create({ id: MENU_WATCH, parentId: MENU_ROOT, title: '➕ Add YouTube video to Watch Later', contexts: ['page', 'link'], documentUrlPatterns: ['https://*.youtube.com/*', 'https://youtu.be/*'] });
    chrome.contextMenus.create({ id: MENU_LEARN, parentId: MENU_ROOT, title: '🎬 Open Charlie MJ Learning Panel', contexts: ['page'], documentUrlPatterns: ['https://*.youtube.com/*'] });
    chrome.contextMenus.create({ id: MENU_BOOKMARK, parentId: MENU_ROOT, title: '🔖 Bookmark current YouTube moment', contexts: ['page'], documentUrlPatterns: ['https://*.youtube.com/*'] });
    chrome.contextMenus.create({ id: MENU_SAVE_SELECTION, parentId: MENU_ROOT, title: '⭐ Save selected text as vocabulary', contexts: ['selection'] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === MENU_WATCH) {
    const url = info.linkUrl || tab.url || '';
    if (/youtube\.com|youtu\.be/.test(url)) {
      await chrome.storage.local.set({ lastWatchLaterRequest: { url, title: tab.title || '', addedAt: Date.now() } });
      await sendToTab(tab.id, { type: 'CMJ_ADD_WATCH_LATER', url, title: tab.title || '' });
    }
  }
  if (info.menuItemId === MENU_LEARN) await sendToTab(tab.id, { type: 'CMJ_OPEN_PANEL' });
  if (info.menuItemId === MENU_BOOKMARK) await sendToTab(tab.id, { type: 'CMJ_BOOKMARK' });
  if (info.menuItemId === MENU_SAVE_SELECTION) await sendToTab(tab.id, { type: 'CMJ_SAVE_TEXT', text: info.selectionText || '' });
});

chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) return;
  if (command === 'toggle-focus-mode') await sendToTab(tab.id, { type: 'CMJ_TOGGLE_FOCUS' });
  if (command === 'save-current-vocabulary') await sendToTab(tab.id, { type: 'CMJ_SAVE_CURRENT' });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CMJ_TRANSLATE') {
    translate(message.text, message.source, message.target, message.provider, message.libreUrl)
      .then(result => sendResponse({ ok: true, ...result }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'CMJ_CAPTURE_TAB') {
    chrome.tabs.captureVisibleTab(sender.tab?.windowId, { format: 'png' })
      .then(dataUrl => getDownloadSettings().then(settings => chrome.downloads.download({ url: dataUrl, filename: message.filename || 'Charlie MJ Language/Screenshots/capture.png', saveAs: Boolean(settings.downloadSaveAs) })))
      .then(id => sendResponse({ ok: true, id }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'CMJ_DOWNLOAD_DATA') {
    let base64;
    if (message.dataUrl) base64 = message.dataUrl;
    else {
      const bytes = new TextEncoder().encode(message.text || '');
      base64 = `data:${message.mime || 'text/plain'};base64,${btoa(String.fromCharCode(...bytes))}`;
    }
    getDownloadSettings().then(settings => chrome.downloads.download({
      url: base64,
      filename: message.filename || 'charlie-mj.txt',
      saveAs: Boolean(settings.downloadSaveAs)
    })).then(id => sendResponse({ ok: true, id })).catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
});

async function sendToTab(tabId, message) {
  try { return await chrome.tabs.sendMessage(tabId, message); } catch { return null; }
}

/** Read the local download preference before placing a generated file. */
async function getDownloadSettings() {
  const stored = await chrome.storage.local.get('settings');
  return { downloadSaveAs: false, ...(stored.settings || {}) };
}

async function translate(text, source = 'auto', target = 'en', provider = 'mymemory', libreUrl = '') {
  const key = `translation:${provider}:${source}:${target}:${text}`;
  const cached = await chrome.storage.local.get(key);
  if (cached[key]) return { translation: cached[key], cached: true };

  let translation = '';
  if (provider === 'libretranslate' && libreUrl) {
    const response = await fetch(`${libreUrl.replace(/\/$/, '')}/translate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source, target, format: 'text' })
    });
    if (!response.ok) throw new Error(`LibreTranslate HTTP ${response.status}`);
    const data = await response.json();
    translation = data.translatedText || '';
  } else {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(source || 'auto')}|${encodeURIComponent(target)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`MyMemory HTTP ${response.status}`);
    const data = await response.json();
    translation = data?.responseData?.translatedText || '';
  }
  if (!translation) throw new Error('No translation returned.');
  await chrome.storage.local.set({ [key]: translation });
  return { translation, cached: false };
}
