(() => {
  'use strict';
  const DEFAULT = {
    favoritesChannels: true,
    favoritesPlaylists: true,
    thumbnailRefresh: true,
    thumbnailRefreshHours: 168,
    metadataRefreshHours: 168,
    autoCategory: true,
    duplicateProtection: true,
    autoRefreshOnAdd: true,
    window: {
      width: 560,
      height: 620,
      minWidth: 360,
      minHeight: 280,
      pinned: false,
      rememberPosition: true,
    },
  };
  const $ = (id) => document.getElementById(id);
  const send = (m) =>
    new Promise((resolve) =>
      chrome.runtime.sendMessage(m, (r) =>
        resolve(r || { ok: false, error: chrome.runtime.lastError?.message || 'No response' })
      )
    );
  function makeSection(category, title, html) {
    const el = document.createElement('section');
    el.dataset.settingsCategory = category;
    el.className = 'additional-settings-section settings-visible';
    el.innerHTML = `<h2>${title}</h2>${html}`;
    return el;
  }
  function build() {
    const wrap = document.createDocumentFragment();
    wrap.append(
      makeSection(
        'Services',
        '✦ Optional Services',
        `<div class="component-card"><h3>Optional services</h3><p class="note">Optional services are kept separate from the original fast transcript engine. Resource-intensive features run only when requested.</p><div class="two-col"><label class="check"><input id="cmjFavC" type="checkbox"> YouTube favorite channels</label><label class="check"><input id="cmjFavP" type="checkbox"> YouTube favorite playlists</label><label class="check"><input id="cmjAutoCategory" type="checkbox"> Automatic category suggestions</label><label class="check"><input id="cmjDuplicate" type="checkbox"> Duplicate protection by stable ID</label><label class="check"><input id="cmjAutoAddRefresh" type="checkbox"> Refresh library after adding resources</label><label class="check"><input id="cmjThumb" type="checkbox"> Thumbnail refresh</label></div></div>`
      )
    );
    wrap.append(
      makeSection(
        'YouTube Library',
        '▶ YouTube Favorites Library',
        `<div class="component-card"><h3>Channels, Playlists, Categories & Learning Groups</h3><div class="two-col"><label class="check"><input id="cmjFavC" type="checkbox"> Favorite Channels</label><label class="check"><input id="cmjFavP" type="checkbox"> Favorite Playlists</label><label class="check"><input id="cmjAutoCategory" type="checkbox"> Automatically suggest category from YouTube metadata</label><label class="check"><input id="cmjDuplicate" type="checkbox"> 100% duplicate protection by Channel/Playlist ID</label><label class="check"><input id="cmjAutoAddRefresh" type="checkbox"> Fetch metadata + thumbnail when adding</label><label class="check"><input id="cmjThumb" type="checkbox"> Automatic thumbnail refresh</label><label>Thumbnail refresh interval<select id="cmjThumbHours"><option value="24">Every 24 hours</option><option value="72">Every 3 days</option><option value="168">Every 7 days</option></select></label><label>Metadata refresh interval (hours)<input id="cmjMetaHours" type="number" min="1" max="720"></label></div><p class="note">Saved resources use stable YouTube IDs. Same names are allowed when the underlying channel or playlist ID is different.</p></div>`
      )
    );
    wrap.append(
      makeSection(
        'UI Components',
        '▣ Additional Learning Window',
        `<div class="component-card"><h3>Window behavior — matches Transcript window controls</h3><div class="two-col"><label>Default width (px)<input id="cmjWinWidth" type="number" min="360" max="1400"></label><label>Default height (px)<input id="cmjWinHeight" type="number" min="280" max="1000"></label><label>Minimum width (px)<input id="cmjWinMinWidth" type="number" min="280" max="800"></label><label>Minimum height (px)<input id="cmjWinMinHeight" type="number" min="220" max="700"></label><label class="check"><input id="cmjWinRemember" type="checkbox"> Remember size and position</label><label class="check"><input id="cmjWinPinned" type="checkbox"> Start pinned on top</label></div><p class="note">The Additional Learning window supports drag, resize, minimize, maximize, pin and close independently of the Transcript window.</p></div>`
      )
    );
    const main = document.querySelector('main');
    const header = main?.querySelector('header');
    if (main && !document.getElementById('cmjAdditionalSettingsRoot')) {
      const root = document.createElement('div');
      root.id = 'cmjAdditionalSettingsRoot';
      root.append(wrap);
      header?.insertAdjacentElement('afterend', root);
      return true;
    }
    return false;
  }
  function read() {
    return {
      favoritesChannels: $('cmjFavC').checked,
      favoritesPlaylists: $('cmjFavP').checked,
      autoCategory: $('cmjAutoCategory').checked,
      duplicateProtection: $('cmjDuplicate').checked,
      autoRefreshOnAdd: $('cmjAutoAddRefresh').checked,
      thumbnailRefresh: $('cmjThumb').checked,
      thumbnailRefreshHours: Number($('cmjThumbHours').value) || 168,
      metadataRefreshHours: Number($('cmjMetaHours').value) || 168,
      window: {
        width: Number($('cmjWinWidth').value) || 560,
        height: Number($('cmjWinHeight').value) || 620,
        minWidth: Number($('cmjWinMinWidth').value) || 360,
        minHeight: Number($('cmjWinMinHeight').value) || 280,
        rememberPosition: $('cmjWinRemember').checked,
        pinned: $('cmjWinPinned').checked,
      },
    };
  }
  async function init() {
    if (document.getElementById('cmjAdditionalSettingsRoot')) return;
    if (!build()) return;
    const stored = await chrome.storage.local.get('cmjAdditionalSettings');
    const s = {
      ...DEFAULT,
      ...(stored.cmjAdditionalSettings || {}),
      window: { ...DEFAULT.window, ...(stored.cmjAdditionalSettings?.window || {}) },
    };
    const map = {
      cmjFavC: 'favoritesChannels',
      cmjFavP: 'favoritesPlaylists',
      cmjAutoCategory: 'autoCategory',
      cmjDuplicate: 'duplicateProtection',
      cmjAutoAddRefresh: 'autoRefreshOnAdd',
      cmjThumb: 'thumbnailRefresh',
    };
    for (const [id, key] of Object.entries(map)) $(id).checked = s[key] !== false;
    Object.assign($('cmjThumbHours'), { value: String(s.thumbnailRefreshHours) });
    $('cmjMetaHours').value = String(s.metadataRefreshHours);
    $('cmjWinWidth').value = s.window.width;
    $('cmjWinHeight').value = s.window.height;
    $('cmjWinMinWidth').value = s.window.minWidth;
    $('cmjWinMinHeight').value = s.window.minHeight;
    $('cmjWinRemember').checked = s.window.rememberPosition !== false;
    $('cmjWinPinned').checked = !!s.window.pinned;
    const save = document.createElement('button');
    save.className = 'primary';
    save.type = 'button';
    save.textContent = 'Save Additional Settings';
    save.addEventListener('click', async () => {
      await chrome.storage.local.set({ cmjAdditionalSettings: read() });
      save.textContent = '✓ Saved';
      setTimeout(() => (save.textContent = 'Save Additional Settings'), 1600);
    });
    document.getElementById('cmjAdditionalSettingsRoot').appendChild(save);
    document.dispatchEvent(new Event('cmj-rebuild-settings-nav'));
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
