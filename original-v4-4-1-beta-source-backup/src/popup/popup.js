/**
 * Charlie MJ Language - Popup controller.
 *
 * This file controls the small extension popup shown when the user clicks the
 * Charlie MJ browser-toolbar icon. The popup must never assume that a content
 * script is already running in the active tab. YouTube can be open before an
 * extension is installed/reloaded, and Chrome pages do not accept content
 * scripts at all. Therefore every page message goes through sendToActiveTab(),
 * which validates the page, attempts a normal message first, and then safely
 * injects the YouTube content layer as a recovery path when necessary.
 */

const $ = selector => document.querySelector(selector);

/**
 * Read the active browser tab.
 * @returns {Promise<chrome.tabs.Tab|undefined>} The active tab.
 */
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * Check whether a tab is a YouTube page supported by Charlie MJ.
 * @param {chrome.tabs.Tab} tab Browser tab.
 * @returns {boolean} True for supported YouTube URLs.
 */
function isYouTubeTab(tab) {
  try {
    const url = new URL(tab?.url || '');
    return /(^|\.)youtube\.com$/.test(url.hostname) || url.hostname === 'youtu.be';
  } catch {
    return false;
  }
}

/**
 * Send a message to the active tab without producing the common
 * "Receiving end does not exist" unhandled Promise rejection.
 *
 * If the YouTube content script is missing (for example because the user
 * installed/reloaded the extension while YouTube was already open), this
 * function injects the content script and stylesheet once, then retries.
 * @param {object} message Message understood by youtube.js.
 * @returns {Promise<boolean>} Whether the message reached the content layer.
 */
async function sendToActiveTab(message) {
  const tab = await getActiveTab();
  if (!tab?.id) return false;

  if (!isYouTubeTab(tab)) {
    setHint('Open a YouTube video to use this feature.');
    return false;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, message);
    return true;
  } catch (firstError) {
    // The receiver can be missing when YouTube was already open during an
    // extension reload. Recover by injecting the same files used by the MV3
    // content-script declaration, then retry the message.
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['src/content/youtube.css']
      });
    } catch (cssError) {
      // CSS may already be present; do not make a harmless duplicate error
      // prevent the JavaScript recovery path.
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['src/content/youtube.js']
      });
      await new Promise(resolve => setTimeout(resolve, 120));
      await chrome.tabs.sendMessage(tab.id, message);
      return true;
    } catch (secondError) {
      console.warn('Charlie MJ could not reach the YouTube content layer.', {
        firstError,
        secondError
      });
      setHint('Charlie MJ could not attach to this YouTube page. Refresh the page once and try again.');
      return false;
    }
  }
}

/**
 * Update the small popup hint without throwing if the element is unavailable.
 * @param {string} message User-facing status.
 */
function setHint(message) {
  const hint = $('.hint');
  if (hint) hint.textContent = message;
}

/**
 * Load local library counters whenever the popup opens.
 */
async function loadStats() {
  const data = await chrome.storage.local.get(['vocabulary', 'bookmarks', 'watchLater']);
  $('#words').textContent = String((data.vocabulary || []).length);
  $('#bookmarks').textContent = String((data.bookmarks || []).length);
  $('#videos').textContent = String((data.watchLater || []).length);
}

$('#learn').addEventListener('click', () => sendToActiveTab({ type: 'CMJ_OPEN_PANEL' }));
$('#focus').addEventListener('click', () => sendToActiveTab({ type: 'CMJ_TOGGLE_FOCUS' }));
$('#transcript').addEventListener('click', () => sendToActiveTab({ type: 'CMJ_OPEN_PANEL' }));
$('#watch').addEventListener('click', () => sendToActiveTab({ type: 'CMJ_ADD_WATCH_LATER' }));

$('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('#library').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/dashboard.html') });
});

loadStats().catch(error => console.warn('Charlie MJ popup statistics could not be loaded.', error));
