/*
 * folder-picker-fix.js  (additive patch, does not modify existing code)
 *
 * Problem: Chrome refuses to open protected folders (Desktop, Documents, Downloads,
 * user profile, drive roots, Program Files...) with "Can't open this folder because it
 * contains system files", and the existing handler then shows a confusing
 * "Failed to execute 'showDirectoryPicker' ... The user aborted a request".
 *
 * What this file does:
 *  1. Wraps window.showDirectoryPicker so the picker starts in Documents and remembers
 *     the last folder (id), with a safe fallback if startIn is not supported.
 *  2. Turns the cryptic AbortError / SecurityError into a clear, actionable message that
 *     the existing handler in upgrade-settings.js already displays (it prints e.message).
 *  3. Adds a small hint under the "Choose Local Folder" button.
 *
 * Load it BEFORE upgrade-settings.js in options.html.
 */
(function () {
  'use strict';

  if (typeof window.showDirectoryPicker !== 'function') return;
  if (window.__cmjPickerPatched) return;
  window.__cmjPickerPatched = true;

  const original = window.showDirectoryPicker.bind(window);

  const HELP =
    'Chrome blocks system folders (Desktop, Documents, Downloads, your user folder, drive roots, Program Files). ' +
    'Create a NEW subfolder first (for example Documents\\CharlieMJ-Data) and select that folder.';

  function friendly(err) {
    const name = err && err.name;
    const msg = (err && err.message) || '';
    let text;
    if (name === 'AbortError') {
      // Chrome raises AbortError both for Cancel and after the "system files" dialog.
      text = 'No folder selected. ' + HELP;
    } else if (name === 'SecurityError' || name === 'NotAllowedError' || /system files/i.test(msg)) {
      text = HELP;
    } else {
      return err;
    }
    const out = new Error(text);
    out.name = name || 'Error';
    out.cause = err;
    return out;
  }

  window.showDirectoryPicker = async function patchedShowDirectoryPicker(options) {
    const opts = Object.assign({ id: 'cmj-data-sync', startIn: 'documents' }, options || {});
    try {
      return await original(opts);
    } catch (err) {
      // Older Chrome builds may reject startIn/id: retry once with the plain options.
      if (err && err.name === 'TypeError') {
        const plain = Object.assign({}, options || {});
        delete plain.startIn;
        delete plain.id;
        try {
          return await original(plain);
        } catch (err2) {
          throw friendly(err2);
        }
      }
      throw friendly(err);
    }
  };

  // Small hint under the button (no HTML edit needed).
  function addHint() {
    const btn = document.getElementById('syncChooseFolder');
    if (!btn || document.getElementById('syncFolderHint')) return;
    const hint = document.createElement('div');
    hint.id = 'syncFolderHint';
    hint.style.cssText = 'font-size:12px;opacity:.75;margin-top:6px;line-height:1.4;grid-column:1/-1;';
    hint.textContent =
      'Tip: create a new folder (e.g. Documents\\CharlieMJ-Data) and select it. ' +
      'Chrome will not allow Desktop, Documents or Downloads themselves.';
    (btn.parentElement || document.body).appendChild(hint);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addHint);
  } else {
    addHint();
  }
})();
