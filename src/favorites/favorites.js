'use strict';

const $ = (s, r = document) => r.querySelector(s);

const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let tab = 'channels',
  items = [],
  allResources = [],
  categories = [],
  groups = [],
  editingId = null,
  editingType = null,
  /* Defaults mirror options.js; overwritten from chrome.storage inside load(). */
  searchSettings = {
    highlight: true,
    fuzzy: true,
    ranking: true,
    suggestions: true,
    debounceMs: 180,
  };
let loadInFlight = null,
  addSuggestTimer = null;

const send = (m) =>
  new Promise((resolve) =>
    chrome.runtime.sendMessage(m, (r) =>
      resolve(
        r || {
          ok: false,
          error: chrome.runtime.lastError?.message || 'No response',
        }
      )
    )
  );

const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]
  );

/**
 * Convert any stored value (string, number, or YouTube-style object such as
 * { text }, { simpleText }, { title }, { runs: [{ text }] }) into plain text,
 * so objects never render as "[object Object]".
 */
const cmjTextOf = (v, depth = 0) => {
  if (v == null || depth > 6) return '';

  if (typeof v === 'string') return v;

  if (typeof v === 'number' || typeof v === 'boolean') return String(v);

  if (Array.isArray(v)) {
    return v.map((i) => cmjTextOf(i, depth + 1)).join('');
  }

  if (typeof v === 'object') {
    if (v.runs) return cmjTextOf(v.runs, depth + 1);

    for (const k of ['simpleText', 'text', 'title', 'name', 'value', 'content', 'label']) {
      if (v[k] != null) {
        const t = cmjTextOf(v[k], depth + 1);

        if (t) return t;
      }
    }
  }

  return '';
};

/* A previous bug stored the literal text "[object Object]" as the title.
   Treat that (and similar) as "no title" so it can be re-fetched. */
const BAD_TITLE_RE = /^\[object \w+\]$/i;

const cmjCleanText = (v) => {
  const t = cmjTextOf(v).trim();

  return BAD_TITLE_RE.test(t) ? '' : t;
};

const cmjNameOf = (x) => cmjCleanText(x && x.name) || cmjCleanText(x && x.title) || '';

/* -------------------------------------------------------------------------- */
/* Search helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Split a search query into lowercase, non-empty tokens.
 * @param {string} query Raw text typed into the search box.
 * @returns {string[]} Lowercase tokens.
 */
const searchTokens = (query) =>
  String(query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

/**
 * Check whether a single token matches the haystack.
 * Exact substring matches always pass; when fuzzy search is enabled, tokens of three or more
 * characters may also match as an in-order character subsequence (e.g. "trkc" -> "turkce").
 * @param {string} hay Lowercase text to search in.
 * @param {string} token Lowercase search token.
 * @returns {boolean}
 */
function fuzzyTokenMatch(hay, token) {
  if (!token || hay.includes(token)) return true;

  if (searchSettings.fuzzy === false || token.length < 3) return false;

  let cursor = 0;

  for (const char of token) {
    cursor = hay.indexOf(char, cursor);

    if (cursor < 0) return false;

    cursor += 1;
  }

  return true;
}

/**
 * Check whether EVERY token of the query matches the haystack.
 * @param {string} hay Lowercase text to search in.
 * @param {string} query Raw or lowercase search query.
 * @returns {boolean} True when the query is empty or all tokens match.
 */
const fuzzyMatch = (hay, query) => searchTokens(query).every((t) => fuzzyTokenMatch(hay, t));

/**
 * Relevance score used to rank results (higher is better).
 * Prefix match = 6, substring match = 3, fuzzy match = 1.
 * @param {string} hay Lowercase text to score.
 * @param {string} query Raw or lowercase search query.
 * @returns {number}
 */
function searchScore(hay, query) {
  return searchTokens(query).reduce((score, token) => {
    if (hay.startsWith(token)) return score + 6;

    if (hay.includes(token)) return score + 3;

    return score + (fuzzyTokenMatch(hay, token) ? 1 : 0);
  }, 0);
}

/**
 * Escape a value for HTML and wrap every search-term match in <mark>.
 * Matching runs on the RAW text and each piece is escaped separately, so a query such as
 * "amp" can never break HTML entities like "&amp;".
 * @param {*} value Text to render.
 * @param {string} query Raw search query.
 * @returns {string} Safe HTML string.
 */
function highlightSearchText(value, query) {
  const text = String(value ?? '');

  const terms = searchTokens(query).sort((a, b) => b.length - a.length);

  if (searchSettings.highlight === false || !terms.length) return esc(text);

  const pattern = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

  return text
    .split(new RegExp(`(${pattern})`, 'gi'))
    .map((part, i) => (i % 2 ? `<mark>${esc(part)}</mark>` : esc(part)))
    .join('');
}

function typeOfResource(x) {
  return x && (x.playlistId || x.type === 'playlist' || /[?&]list=|\/playlist\?/.test(x.url || ''))
    ? 'playlist'
    : 'channel';
}

/**
 * Fetch the real title straight from YouTube.
 * 1) oEmbed (works for playlists and videos)
 * 2) og:title from the page HTML (fallback; also works for channels)
 */
async function fetchYouTubeTitle(url) {
  if (!url) return '';

  try {
    const r = await fetch(
      'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent(url)
    );

    if (r.ok) {
      const j = await r.json();

      const t = cmjCleanText(j && j.title);

      if (t) return t;
    }
  } catch (e) {
    /* fall through to the page fallback */
  }

  try {
    const r = await fetch(url, { credentials: 'omit' });

    if (r.ok) {
      const html = await r.text();

      const m =
        html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["']/i);

      if (m) {
        const ta = document.createElement('textarea');

        ta.innerHTML = m[1];

        const t = cmjCleanText(ta.value);

        if (t) return t;
      }
    }
  } catch (e) {
    /* no title available */
  }

  return '';
}

const titleRepairTried = new Set();

/* Silently re-fetch titles for saved items whose title is missing/corrupt. */
async function repairTitles() {
  const bad = allResources
    .filter((x) => x && x.url && !cmjNameOf(x) && !titleRepairTried.has(x.id))
    .slice(0, 8);

  if (!bad.length) return;

  let fixed = 0;

  for (const x of bad) {
    titleRepairTried.add(x.id);

    const t = await fetchYouTubeTitle(x.url);

    if (!t) continue;

    const itemType = typeOfResource(x);

    const r = await send({
      type: 'CMJ_FAVORITES',
      action: 'update',
      itemType,
      record: {
        ...x,
        name: t,
        title: itemType === 'playlist' ? t : x.title,
      },
    });

    if (r.ok) fixed++;
  }

  if (fixed) load();
}

function ensureFetchTitleButton() {
  if ($('#editFetchTitle')) return;

  const input = $('#editName');

  if (!input) return;

  const b = document.createElement('button');

  b.type = 'button';

  b.id = 'editFetchTitle';

  b.className = 'secondary small';

  b.textContent = 'Fetch title from YouTube';

  b.style.marginTop = '6px';

  b.addEventListener('click', async () => {
    const label = b.textContent;

    b.disabled = true;

    b.textContent = 'Fetching…';

    const t = await fetchYouTubeTitle($('#editUrl').value.trim());

    b.disabled = false;

    b.textContent = label;

    if (t) {
      input.value = t;

      toast('Title fetched from YouTube. Edit it if you want, then Save.', 'success');
    } else {
      toast('Could not fetch the title from YouTube.', 'error');
    }
  });

  input.insertAdjacentElement('afterend', b);
}

function toast(message, type = 'info') {
  const host = $('#toastHost');

  const n = document.createElement('div');

  n.className = `toast ${type}`;

  n.textContent = message;

  host.appendChild(n);

  setTimeout(() => n.remove(), 2800);
}

function typeForTab() {
  return tab === 'playlists' ? 'playlist' : 'channel';
}

/**
 * Load every dataset the page needs (current tab, channels, playlists, categories, groups,
 * settings) in parallel, then re-render. Concurrent calls share one in-flight promise.
 * @returns {Promise<void>}
 */
async function load() {
  if (loadInFlight) return loadInFlight;

  const refreshButton = $('#refresh');

  const previousLabel = refreshButton?.textContent || '↻ Refresh';

  if (refreshButton) {
    refreshButton.disabled = true;

    refreshButton.textContent = '↻ Refreshing…';
  }

  loadInFlight = (async () => {
    const list = (itemType) => send({ type: 'CMJ_FAVORITES', action: 'list', itemType });

    const [r, cr, pr, c, g, settingsStore] = await Promise.all([
      list(typeForTab()),
      list('channel'),
      list('playlist'),
      send({ type: 'CMJ_FAVORITES', action: 'categories' }),
      send({ type: 'CMJ_FAVORITES', action: 'collections' }),
      chrome.storage.local.get('settings'),
    ]);

    items = r.ok && Array.isArray(r.result) ? r.result : [];

    searchSettings = { ...searchSettings, ...(settingsStore?.settings?.search || {}) };

    allResources = [...(cr.result || []), ...(pr.result || [])];

    categories = c.ok && Array.isArray(c.result) ? c.result : [];

    groups = g.ok && Array.isArray(g.result) ? g.result : [];

    renderCategoryFilter();

    render();

    repairTitles();
  })().finally(() => {
    loadInFlight = null;

    if (refreshButton) {
      refreshButton.disabled = false;

      refreshButton.textContent = previousLabel;
    }
  });

  return loadInFlight;
}

function renderCategoryFilter() {
  const s = $('#categoryFilter');

  const old = s.value;

  s.innerHTML =
    '<option value="">All categories</option>' +
    categories.map((c) => `<option value="${esc(c.name)}">${esc(c.name)}</option>`).join('');

  if ([...s.options].some((o) => o.value === old)) {
    s.value = old;
  }

  const a = $('#addCategory');
  if (a && a.tagName === 'INPUT' && !a.value) a.value = '';

  const d = $('#categoryOptions');
  const addOptions = $('#addCategoryOptions');
  const options = categories.map((c) => `<option value="${esc(c.name)}"></option>`).join('');
  if (d) d.innerHTML = options;
  if (addOptions) addOptions.innerHTML = options;
}

function render() {
  if (tab === 'categories') {
    renderCategories();

    return;
  }

  if (tab === 'groups') {
    renderGroups();

    return;
  }

  if (tab === 'suggestions') {
    renderSuggestions();

    return;
  }

  const q = $('#search').value.trim().toLowerCase();

  const cat = $('#categoryFilter').value.toLowerCase();

  const list = items.filter((x) => {
    const hay = [
      cmjTextOf(x.name),
      cmjTextOf(x.title),
      x.description,
      x.handle,
      x.owner,
      x.category,
      (x.tags || []).join(' '),
      x.notes || '',
    ]
      .join(' ')
      .toLowerCase();

    return (!q || fuzzyMatch(hay, q)) && (!cat || String(x.category || '').toLowerCase() === cat);
  });

  if (searchSettings.ranking && q) {
    list.sort((a, b) => {
      const aHay = [cmjTextOf(a.name), cmjTextOf(a.title), a.description, a.category]
        .join(' ')
        .toLowerCase();
      const bHay = [cmjTextOf(b.name), cmjTextOf(b.title), b.description, b.category]
        .join(' ')
        .toLowerCase();
      return searchScore(bHay, q) - searchScore(aHay, q);
    });
  }

  $('#resultCount').textContent = `${list.length} ${tab === 'channels' ? 'channel' : 'playlist'}${
    list.length === 1 ? '' : 's'
  }`;

  $('#list').innerHTML = list.length
    ? `<div class="resource-grid">${list.map(card).join('')}</div>`
    : '<div class="empty"><div class="empty-icon">☆</div><h3>No resources found</h3><p>Add a YouTube channel or playlist, or change your search/filter.</p></div>';

  bindCards();
}

function card(x) {
  const name = cmjNameOf(x) || 'Unnamed';

  const type = typeForTab();

  const thumb = x.thumbnail?.url || x.thumbnail || '';

  return `<article class="resource-card ${x.isPinned ? 'pinned' : ''}" data-id="${esc(x.id)}">
  <div class="thumb-wrap"><img class="thumb" src="${esc(thumb)}" alt="" data-thumb-fallback><span class="type-badge">${type === 'channel' ? 'CHANNEL' : 'PLAYLIST'}</span>${x.isPinned ? '<span class="pin-badge">📌</span>' : ''}</div>
  <div class="card-body"><div class="card-title-row"><h3>${highlightSearchText(name, $('#search').value)}</h3><button class="icon-btn" data-menu="${esc(x.id)}" title="More actions">⋮</button></div>
  <p class="muted clamp">${highlightSearchText(x.description || 'No description available.', $('#search').value)}</p><div class="meta-line">${esc(x.handle || x.owner || '')}${x.videoCount ? ' · ' + esc(x.videoCount) : ''}</div>
  <div class="chips"><span class="chip category-chip">${esc(x.category || 'Uncategorized')}</span>${(
    x.tags || []
  )
    .slice(0, 3)
    .map((t) => `<span class="chip">${esc(t)}</span>`)
    .join('')}</div>
  <div class="card-footer"><span>${x.isPinned ? 'Pinned · ' : ''}${x.dateAdded ? new Date(x.dateAdded).toLocaleDateString() : ''}</span><button class="secondary small" data-detail="${esc(x.id)}">View Detail</button></div></div></article>`;
}

function bindCards() {
  $$('[data-detail]').forEach((b) =>
    b.addEventListener('click', () => openDetail(b.dataset.detail))
  );

  $$('[data-menu]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();

      openCardMenu(b);
    })
  );

  $$('[data-thumb-fallback]').forEach((img) =>
    img.addEventListener(
      'error',
      () => {
        img.src = chrome.runtime.getURL('assets/charlie-mj-language-main-thumbnail.png');

        img.classList.add('fallback');
      },
      { once: true }
    )
  );
}

function openCardMenu(btn) {
  const old = $('.card-menu');

  old?.remove();

  const x = items.find((i) => i.id === btn.dataset.menu);

  if (!x) return;

  const m = document.createElement('div');

  m.className = 'card-menu';

  m.innerHTML =
    `<button data-act="detail">View Detail</button>` +
    `<button data-act="edit">Edit</button>` +
    `<button data-act="open">Open YouTube</button>` +
    `<button data-act="group">Add to Learning Group</button>` +
    `<button data-act="pin">${x.isPinned ? 'Unpin' : 'Pin'}</button>` +
    `<button data-act="refresh">Refresh Metadata</button>` +
    `<button data-act="remove" class="danger">Remove</button>`;

  btn.parentElement.appendChild(m);

  m.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;

    if (!act) return;

    m.remove();

    if (act === 'detail') {
      openDetail(x.id);
    }

    if (act === 'edit') {
      openEdit(x.id);
    }

    if (act === 'open') {
      chrome.tabs.create({
        url: x.url,
      });
    }

    if (act === 'group') {
      openGroupPicker(x.id);
    }

    if (act === 'pin') {
      await mutatePin(x);
    }

    if (act === 'refresh') {
      await refreshOne(x);
    }

    if (act === 'remove') {
      await removeOne(x);
    }
  });

  setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
}

function cmjFormatDateTime(value, withSeconds = true) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return cmjTextOf(value) || '—';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    timeZoneName: 'short',
  }).format(d);
}

function cmjRelativeTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const units = [
    ['day', 86400000],
    ['hour', 3600000],
    ['minute', 60000],
    ['second', 1000],
  ];
  const hit = units.find(([, ms]) => abs >= ms);
  if (!hit) return 'just now';
  const amount = Math.round(diff / hit[1]);
  return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-amount, hit[0]);
}

function cmjDisplayValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toLocaleString() : '—';
  if (Array.isArray(value)) return value.length ? value.map((v) => cmjTextOf(v)).filter(Boolean).join(', ') : '—';
  if (typeof value === 'object') return cmjTextOf(value) || JSON.stringify(value);
  return String(value);
}

function cmjMetric(label, value, extra = '') {
  return `<div class="yt-detail-metric"><span>${esc(label)}</span><strong>${esc(cmjDisplayValue(value))}</strong>${extra ? `<small>${esc(extra)}</small>` : ''}</div>`;
}

function cmjDetailRow(label, value, options = {}) {
  const display = cmjDisplayValue(value);
  const url = options.url || (typeof value === 'string' && /^https?:\/\//i.test(value) ? value : '');
  const rendered = url
    ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(display)}</a>`
    : esc(display);
  return `<div class="yt-detail-row"><span>${esc(label)}</span><strong>${rendered}</strong></div>`;
}

function cmjThumbnailSet(x) {
  const candidates = [];
  const add = (label, value) => {
    const url = typeof value === 'string' ? value : value?.url;
    if (url && !candidates.some((v) => v.url === url)) candidates.push({ label, url });
  };
  add('Primary', x.thumbnail);
  add('Banner', x.banner);
  add('Avatar', x.avatar);
  for (const key of ['default', 'medium', 'high', 'standard', 'maxres']) add(key, x.thumbnails?.[key]);
  return candidates;
}

function cmjMetadataCoverage(x) {
  const checks = [
    ['Identity', Boolean(x.channelId || x.playlistId || x.id)],
    ['Title', Boolean(cmjNameOf(x))],
    ['Description', Boolean(x.description)],
    ['Thumbnail', Boolean(x.thumbnail)],
    ['URL', Boolean(x.url || x.canonicalUrl)],
    ['Published date', Boolean(x.publishedAt || x.datePublished || x.createdAt)],
    ['Statistics', Boolean(x.subscriberCount || x.videoCount || x.viewCount || x.itemCount)],
    ['Language', Boolean(x.language || x.languageCode)],
    ['Country', Boolean(x.country || x.countryCode)],
    ['Keywords / tags', Boolean((x.keywords || []).length || (x.tags || []).length)],
    ['Playlist items', typeOfResource(x) === 'playlist' ? Boolean((x.playlistItems || []).length || x.itemCount) : true],
    ['Verification / status', Boolean(x.verified != null || x.privacy || x.status)],
    ['Branding / banner', Boolean(x.banner || x.brandingSettings)],
    ['Topics', Boolean(x.topicDetails || x.topics)],
  ];
  const available = checks.filter(([, ok]) => ok).length;
  return { checks, available, total: checks.length, percent: Math.round((available / checks.length) * 100) };
}

function cmjKnownYoutubeFields(x) {
  return [
    'id', 'channelId', 'playlistId', 'ownerChannelId', 'name', 'title', 'handle', 'customUrl',
    'url', 'canonicalUrl', 'sourceUrl', 'description', 'thumbnail', 'banner', 'owner', 'country',
    'countryCode', 'language', 'languageCode', 'keywords', 'tags', 'labels', 'publishedAt',
    'subscriberCount', 'subscriberCountNumber', 'videoCount', 'videoCountNumber', 'viewCount',
    'viewCountNumber', 'hiddenSubscriberCount', 'verified', 'verificationLabels', 'itemCount',
    'itemCountNumber', 'privacy', 'playlistItems', 'metadataSources', 'metadataLastChecked', 'channelPlaylists',
    'channelPlaylistsFetchedAt', 'channelPlaylistsPages', 'channelPlaylistsComplete', 'channelPlaylistsSource',
    'thumbnailChecked', 'dateAdded', 'createdAt', 'updatedAt', 'notes', 'category', 'categorySuggestion',
    'collectionIds', 'isPinned', 'type', 'kind', 'resourceType', 'avatar', 'thumbnails', 'statistics',
    'brandingSettings', 'topicDetails', 'topics', 'status', 'contentDetails', 'localizations',
  ];
}

function cmjExtraYoutubeData(x) {
  const known = new Set(cmjKnownYoutubeFields(x));
  const entries = Object.entries(x).filter(([key, value]) => {
    if (known.has(key) || value == null || value === '') return false;
    return typeof value === 'object' || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  });
  if (!entries.length) return '<p class="muted">No additional stored YouTube fields.</p>';
  return entries.map(([key, value]) => cmjDetailRow(key, Array.isArray(value) ? value : value)).join('');
}

function cmjJsonBlock(value) {
  try {
    return esc(JSON.stringify(value, null, 2));
  } catch {
    return esc(String(value));
  }
}

function cmjPlaylistItemsHtml(x) {
  const list = Array.isArray(x.playlistItems) ? x.playlistItems : [];
  if (!list.length) {
    return `<div class="yt-empty-state"><strong>No playlist items stored.</strong><span>The current fetcher did not expose playlist videos for this record.</span></div>`;
  }
  return `<div class="yt-playlist-toolbar"><input id="detailPlaylistSearch" placeholder="Search playlist videos…" autocomplete="off"><select id="detailPlaylistSort"><option value="position">Playlist order</option><option value="title">Title</option><option value="owner">Channel</option><option value="added">Date added</option></select><span class="muted">${list.length.toLocaleString()} stored item${list.length === 1 ? '' : 's'}</span></div><div class="yt-playlist-items" id="detailPlaylistItems">${cmjRenderPlaylistItems(list, '', 'position')}</div>`;
}

function cmjRenderPlaylistItems(list, query = '', sort = 'position') {
  const q = String(query || '').trim().toLowerCase();
  const filtered = list.filter((item) => !q || [item.title, item.description, item.owner, item.videoId, item.index].join(' ').toLowerCase().includes(q));
  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'title') return String(a.title || '').localeCompare(String(b.title || ''));
    if (sort === 'owner') return String(a.owner || '').localeCompare(String(b.owner || ''));
    if (sort === 'added') return String(a.addedAt || a.publishedAt || '').localeCompare(String(b.addedAt || b.publishedAt || ''));
    return Number(a.index || 0) - Number(b.index || 0);
  });
  if (!sorted.length) return '<div class="yt-empty-state"><strong>No matching videos.</strong><span>Try another search.</span></div>';
  return sorted.map((item, i) => {
    const thumb = item.thumbnail?.url || item.thumbnail || '';
    const href = item.url || (item.videoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}` : '#');
    return `<article class="yt-playlist-item"><div class="yt-playlist-index">${esc(item.index || String(i + 1))}</div><img src="${esc(thumb)}" alt="" data-detail-thumb-fallback><div class="yt-playlist-main"><div class="yt-playlist-title-row"><a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(cmjTextOf(item.title) || 'Untitled video')}</a>${item.videoId ? `<button type="button" class="secondary small" data-detail-open-video="${esc(href)}">Open Video</button>` : ''}</div><p>${esc(cmjTextOf(item.description) || '')}</p><div><span>${esc(cmjTextOf(item.owner) || '—')}</span>${item.lengthText ? ` · ${esc(item.lengthText)}` : ''}${item.videoId ? ` · ${esc(item.videoId)}` : ''}</div></div></article>`;
  }).join('');
}

/* ============================================================================
   CHARLIE MJ — ADDITIVE YOUTUBE PLAYLIST HYDRATION
   ============================================================================

   PURPOSE
   -------
   This supplements the existing YouTube metadata fetcher.

   It DOES NOT replace the existing fetch system.

   When a playlist detail window opens, this code:

   1. Fetches the public YouTube playlist page.
   2. Reads ytInitialData.
   3. Extracts playlist metadata.
   4. Extracts playlist videos.
   5. Extracts thumbnails.
   6. Extracts video IDs.
   7. Extracts owner information where available.
   8. Extracts item count where available.
   9. Follows YouTube continuation tokens.
   10. Saves the additional information into the existing playlist record.

   ========================================================================== */

let cmjPlaylistHydrationInFlight = new Map();

let cmjDetailActiveTab = 'overview';


/* --------------------------------------------------------------------------
   Generic YouTube text reader
   -------------------------------------------------------------------------- */

function cmjYtText(value, depth = 0) {
  if (value == null || depth > 8) return '';

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => cmjYtText(item, depth + 1))
      .join('');
  }

  if (typeof value === 'object') {
    if (Array.isArray(value.runs)) {
      return value.runs
        .map((run) => cmjYtText(run, depth + 1))
        .join('');
    }

    for (const key of [
      'simpleText',
      'text',
      'title',
      'name',
      'label',
      'content',
    ]) {
      if (value[key] != null) {
        const text = cmjYtText(value[key], depth + 1);

        if (text) {
          return text;
        }
      }
    }
  }

  return '';
}


/* --------------------------------------------------------------------------
   Balanced JSON extraction
   -------------------------------------------------------------------------- */

function cmjParseBalancedJson(source, start) {
  const s = String(source || '');

  let depth = 0;
  let quote = false;
  let escaped = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        quote = false;
      }

      continue;
    }

    if (ch === '"') {
      quote = true;
      continue;
    }

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;

      if (depth === 0) {
        try {
          return JSON.parse(s.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}


function cmjExtractJsonAfter(source, marker) {
  const s = String(source || '');

  const markerPosition = s.indexOf(marker);

  if (markerPosition < 0) {
    return null;
  }

  const start = s.indexOf(
    '{',
    markerPosition + marker.length
  );

  if (start < 0) {
    return null;
  }

  return cmjParseBalancedJson(s, start);
}


/* --------------------------------------------------------------------------
   YouTube initial data
   -------------------------------------------------------------------------- */

function cmjExtractYtInitialData(html) {
  const markers = [
    'var ytInitialData = ',
    'ytInitialData = ',
    'window["ytInitialData"] = ',
    "window['ytInitialData'] = ",
  ];

  for (const marker of markers) {
    const data = cmjExtractJsonAfter(html, marker);

    if (data) {
      return data;
    }
  }

  return null;
}


/* --------------------------------------------------------------------------
   YouTube internal configuration
   -------------------------------------------------------------------------- */

function cmjExtractYtConfig(html) {
  const s = String(html || '');

  const apiKey =
    s.match(
      /"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/
    )?.[1] ||
    s.match(
      /INNERTUBE_API_KEY\s*[:=]\s*["']([^"']+)["']/
    )?.[1] ||
    '';

  const clientVersion =
    s.match(
      /"INNERTUBE_CLIENT_VERSION"\s*:\s*"([^"]+)"/
    )?.[1] ||
    s.match(
      /INNERTUBE_CLIENT_VERSION\s*[:=]\s*["']([^"']+)["']/
    )?.[1] ||
    '';

  const clientName =
    s.match(
      /"INNERTUBE_CONTEXT_CLIENT_NAME"\s*:\s*([0-9]+)/
    )?.[1] ||
    '1';

  return {
    apiKey,
    clientVersion,
    clientName,
  };
}


/* --------------------------------------------------------------------------
   Deep object collector
   -------------------------------------------------------------------------- */

function cmjDeepCollect(root, predicate, limit = 10000) {
  const found = [];
  const seen = new WeakSet();

  function walk(value) {
    if (
      found.length >= limit ||
      value == null ||
      typeof value !== 'object'
    ) {
      return;
    }

    if (seen.has(value)) {
      return;
    }

    seen.add(value);

    try {
      if (predicate(value)) {
        found.push(value);
      }

      if (found.length >= limit) {
        return;
      }

      if (Array.isArray(value)) {
        for (const child of value) {
          walk(child);
        }
      } else {
        for (const child of Object.values(value)) {
          walk(child);
        }
      }
    } catch {
      /* Ignore malformed objects. */
    }
  }

  walk(root);

  return found;
}


/* --------------------------------------------------------------------------
   Thumbnail extraction
   -------------------------------------------------------------------------- */

function cmjFirstThumbnail(value) {
  const source = value?.thumbnails || value?.sources || value;

  if (!Array.isArray(source)) {
    return '';
  }

  const preferred =
    source[source.length - 1] ||
    source[0];

  return preferred?.url || preferred?.src || '';
}


/* --------------------------------------------------------------------------
   Playlist video extraction
   -------------------------------------------------------------------------- */

function cmjPlaylistVideoFromRenderer(
  renderer,
  fallbackIndex = ''
) {
  if (!renderer?.videoId) {
    return null;
  }

  const title =
    cmjYtText(renderer.title) ||
    cmjYtText(renderer.videoTitle) ||
    '';

  const description =
    cmjYtText(renderer.description);

  const owner =
    cmjYtText(
      renderer.longBylineText ||
      renderer.shortBylineText ||
      renderer.videoOwner
    );

  const index =
    cmjYtText(renderer.index) ||
    String(fallbackIndex || '');

  const thumbnail =
    cmjFirstThumbnail(renderer.thumbnail) ||
    `https://i.ytimg.com/vi/${encodeURIComponent(renderer.videoId)}/hqdefault.jpg`;

  const addedAt =
    renderer.publishedAt || '';

  const videoPublishedAt =
    renderer.videoPublishedAt ||
    renderer.videoInfo?.publishedAt ||
    '';

  const lengthText =
    cmjYtText(renderer.lengthText);

  let ownerChannelId = '';

  const ownerEndpoint =
    renderer.shortBylineText
      ?.runs?.[0]
      ?.navigationEndpoint
      ?.browseEndpoint ||
    renderer.longBylineText
      ?.runs?.[0]
      ?.navigationEndpoint
      ?.browseEndpoint;

  if (ownerEndpoint?.browseId) {
    ownerChannelId =
      ownerEndpoint.browseId;
  }

  return {
    playlistItemId:
      renderer.id || '',

    videoId:
      renderer.videoId,

    title,

    description,

    index,

    thumbnail,

    lengthText,

    owner,

    ownerChannelId,

    addedAt,

    publishedAt:
      addedAt,

    videoPublishedAt,

    url:
      `https://www.youtube.com/watch?v=${encodeURIComponent(
        renderer.videoId
      )}`,
  };
}


/* --------------------------------------------------------------------------
   YouTube 2026+ lockupViewModel playlist item

   YouTube has moved public playlist entries away from
   playlistVideoRenderer on some pages. The current shape uses:

   lockupViewModel.contentId
   lockupViewModel.metadata.lockupMetadataViewModel

   Keep this parser additive so older playlists still use the legacy
   playlistVideoRenderer / playlistPanelVideoRenderer path above.
   -------------------------------------------------------------------------- */

function cmjPlaylistVideoFromLockup(
  model,
  fallbackIndex = ''
) {
  const contentId =
    model?.contentId ||
    model?.videoId ||
    '';

  const contentType =
    String(model?.contentType || '').toUpperCase();

  if (
    !contentId ||
    (contentType &&
      !contentType.includes('VIDEO'))
  ) {
    return null;
  }

  const lockup =
    model?.metadata?.lockupMetadataViewModel ||
    model?.metadata ||
    {};

  const title =
    cmjYtText(lockup.title?.content) ||
    cmjYtText(lockup.title) ||
    cmjYtText(model.title) ||
    cmjYtText(model.contentTitle) ||
    '';

  const metadataRows =
    lockup.metadata?.contentMetadataViewModel
      ?.metadataRows ||
    lockup.contentMetadataViewModel
      ?.metadataRows ||
    [];

  const rowText = (row, index = 0) =>
    cmjYtText(
      row?.metadataParts?.[index]?.text?.content
    ) ||
    cmjYtText(
      row?.metadataParts?.[index]?.text
    ) ||
    '';

  const owner =
    rowText(metadataRows[0], 0) ||
    cmjYtText(lockup.byline) ||
    cmjYtText(lockup.owner);

  const videoPublishedAt =
    rowText(metadataRows[1], 1) ||
    rowText(metadataRows[1], 0);

  const durationCandidates =
    cmjDeepCollect(
      model,
      (value) =>
        value &&
        typeof value === 'object' &&
        (
          value.thumbnailBadgeViewModel?.text?.content ||
          value.thumbnailBadgeViewModel?.text?.simpleText
        ),
      20
    );

  const lengthText =
    durationCandidates
      .map((node) =>
        cmjYtText(
          node.thumbnailBadgeViewModel?.text
        )
      )
      .find(Boolean) ||
    '';

  const imageModel =
    model?.contentImage?.thumbnailViewModel?.image ||
    model?.contentImage?.image ||
    model?.thumbnail ||
    null;

  const thumbnail =
    cmjFirstThumbnail(imageModel) ||
    `https://i.ytimg.com/vi/${encodeURIComponent(contentId)}/hqdefault.jpg`;

  return {
    playlistItemId:
      model?.id || '',

    videoId:
      contentId,

    title,

    description:
      cmjYtText(model.description),

    index:
      String(fallbackIndex || ''),

    thumbnail,

    lengthText,

    owner,

    ownerChannelId: '',

    addedAt: '',

    publishedAt: '',

    videoPublishedAt,

    url:
      `https://www.youtube.com/watch?v=${encodeURIComponent(
        contentId
      )}`,
  };
}


function cmjExtractPlaylistVideos(data) {
  const legacyRenderers = cmjDeepCollect(
    data,
    (value) =>
      value &&
      typeof value === 'object' &&
      (
        value.playlistVideoRenderer?.videoId ||
        value.playlistPanelVideoRenderer?.videoId
      ),
    10000
  );

  const lockupRenderers = cmjDeepCollect(
    data,
    (value) =>
      value &&
      typeof value === 'object' &&
      value.lockupViewModel?.contentId,
    10000
  );

  const directLockups = cmjDeepCollect(
    data,
    (value) =>
      value &&
      typeof value === 'object' &&
      value.contentId &&
      String(value.contentType || '')
        .toUpperCase()
        .includes('VIDEO') &&
      value.metadata,
    10000
  );

  const seen = new Set();
  const result = [];

  const add = (item) => {
    if (!item?.videoId || seen.has(item.videoId)) {
      return;
    }

    seen.add(item.videoId);
    item.index = item.index || String(result.length + 1);
    result.push(item);
  };

  for (const wrapper of legacyRenderers) {
    const renderer =
      wrapper.playlistVideoRenderer ||
      wrapper.playlistPanelVideoRenderer;

    add(
      cmjPlaylistVideoFromRenderer(
        renderer,
        result.length + 1
      )
    );
  }

  for (const wrapper of lockupRenderers) {
    add(
      cmjPlaylistVideoFromLockup(
        wrapper.lockupViewModel,
        result.length + 1
      )
    );
  }

  for (const model of directLockups) {
    add(
      cmjPlaylistVideoFromLockup(
        model,
        result.length + 1
      )
    );
  }

  return result;
}


/* --------------------------------------------------------------------------
   Continuation token extraction
   -------------------------------------------------------------------------- */

function cmjExtractContinuationTokens(data) {
  const nodes = cmjDeepCollect(
    data,
    (value) =>
      value &&
      typeof value === 'object' &&
      (
        value.continuationCommand?.token ||
        value.continuationEndpoint
          ?.continuationCommand?.token ||
        value.reloadContinuationData
          ?.continuation ||
        value.continuationItemRenderer
          ?.continuationEndpoint
          ?.continuationCommand?.token ||
        value.continuationItemViewModel
          ?.continuationCommand
          ?.innertubeCommand
          ?.continuationCommand
          ?.token ||
        value.nextContinuationData?.continuation ||
        value.continuationEndpoint
          ?.commandMetadata
          ?.webCommandMetadata
          ?.url
      ),
    10000
  );

  const tokens = [];
  const seen = new Set();

  for (const node of nodes) {
    let token =
      node.continuationCommand?.token ||
      node.continuationEndpoint
        ?.continuationCommand?.token ||
      node.reloadContinuationData
        ?.continuation ||
      node.continuationItemRenderer
        ?.continuationEndpoint
        ?.continuationCommand?.token ||
      node.continuationItemViewModel
        ?.continuationCommand
        ?.innertubeCommand
        ?.continuationCommand
        ?.token ||
      node.nextContinuationData?.continuation ||
      '';

    /*
     * Some newer responses expose the continuation only in the
     * command URL. Prefer an actual token, but accept the URL form
     * when it contains ?continuation=... as a final fallback.
     */
    if (!token) {
      const commandUrl =
        node.continuationEndpoint
          ?.commandMetadata
          ?.webCommandMetadata
          ?.url || '';

      try {
        token =
          new URL(
            commandUrl,
            'https://www.youtube.com'
          )
            .searchParams
            .get('continuation') ||
          '';
      } catch {
        token = '';
      }
    }

    if (!token || seen.has(token)) {
      continue;
    }

    seen.add(token);
    tokens.push(token);
  }

  return tokens;
}


/* --------------------------------------------------------------------------
   Playlist item count
   -------------------------------------------------------------------------- */

function cmjExtractPlaylistCount(data) {
  const candidates = cmjDeepCollect(
    data,
    (value) =>
      value &&
      typeof value === 'object' &&
      (
        value.numVideosText ||
        value.videoCountText ||
        value.itemCountText ||
        value.numVideos
      ),
    100
  );

  for (const node of candidates) {
    const raw =
      cmjYtText(node.numVideosText) ||
      cmjYtText(node.videoCountText) ||
      cmjYtText(node.itemCountText) ||
      cmjYtText(node.numVideos);

    const match =
      raw
        .replace(/,/g, '')
        .match(/\d+/);

    if (match) {
      return Number(match[0]);
    }
  }

  const statsNodes = cmjDeepCollect(
    data,
    (value) =>
      value &&
      typeof value === 'object' &&
      Array.isArray(value.stats),
    20
  );

  for (const node of statsNodes) {
    const text =
      cmjYtText(node.stats);

    const match =
      text
        .replace(/,/g, '')
        .match(
          /(\d[\d.]*)\s*(?:videos?|items?)/i
        );

    if (match) {
      return Number(
        match[1].replace(/\./g, '')
      );
    }
  }

  return 0;
}


/* --------------------------------------------------------------------------
   Playlist owner
   -------------------------------------------------------------------------- */

function cmjExtractPlaylistOwner(data) {
  const owners = cmjDeepCollect(
    data,
    (value) =>
      value &&
      typeof value === 'object' &&
      (
        value.videoOwner ||
        value.playlistSidebarSecondaryInfoRenderer
      ),
    20
  );

  for (const node of owners) {
    const ownerBlock =
      node.playlistSidebarSecondaryInfoRenderer ||
      node.videoOwner ||
      node;

    const title =
      cmjYtText(
        ownerBlock.videoOwner?.title
      ) ||
      cmjYtText(ownerBlock.title);

    const channelId =
      ownerBlock.videoOwner
        ?.navigationEndpoint
        ?.browseEndpoint
        ?.browseId ||
      ownerBlock.navigationEndpoint
        ?.browseEndpoint
        ?.browseId ||
      '';

    if (title || channelId) {
      return {
        owner: title,
        ownerChannelId: channelId,
      };
    }
  }

  return {
    owner: '',
    ownerChannelId: '',
  };
}


/* --------------------------------------------------------------------------
   Playlist metadata
   -------------------------------------------------------------------------- */

function cmjExtractPlaylistMetadata(
  data,
  url
) {
  const microformat =
    cmjDeepCollect(
      data,
      (value) =>
        value &&
        typeof value === 'object' &&
        value.microformatDataRenderer,
      10
    )[0]
      ?.microformatDataRenderer ||
    {};

  const header =
    cmjDeepCollect(
      data,
      (value) =>
        value &&
        typeof value === 'object' &&
        value.playlistHeaderRenderer,
      10
    )[0]
      ?.playlistHeaderRenderer ||
    {};

  const sidebar =
    cmjDeepCollect(
      data,
      (value) =>
        value &&
        typeof value === 'object' &&
        value.playlistSidebarPrimaryInfoRenderer,
      10
    )[0]
      ?.playlistSidebarPrimaryInfoRenderer ||
    {};

  const owner =
    cmjExtractPlaylistOwner(data);

  const items =
    cmjExtractPlaylistVideos(data);

  const count =
    cmjExtractPlaylistCount(data);

  const playlistId =
    new URL(url)
      .searchParams
      .get('list') ||
    '';

  const title =
    cmjYtText(header.title) ||
    cmjYtText(sidebar.title) ||
    cmjYtText(microformat.title) ||
    '';

  const description =
    cmjYtText(header.description) ||
    cmjYtText(sidebar.description) ||
    cmjYtText(microformat.description) ||
    '';

  const publishedAt =
    microformat.publishDate ||
    '';

  return {
    playlistId,

    title,

    description,

    owner:
      owner.owner,

    ownerChannelId:
      owner.ownerChannelId,

    itemCountNumber:
      count || items.length,

    itemCount:
      String(
        count ||
        items.length ||
        ''
      ),

    playlistItems:
      items,

    publishedAt,

    privacy:
      cmjYtText(header.privacy) ||
      cmjYtText(sidebar.privacy) ||
      '',

    podcastStatus:
      cmjYtText(header.podcastStatus) ||
      '',

    metadataSupplementSource:
      'youtube-playlist-page',
  };
}


async function cmjFetchPlaylistBrowse(
  apiKey,
  clientVersion,
  playlistId
) {
  if (
    !apiKey ||
    !clientVersion ||
    !playlistId
  ) {
    return null;
  }

  const endpoint =
    `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(
      apiKey
    )}`;

  const response =
    await fetch(endpoint, {
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion,
          },
        },
        browseId: `VL${playlistId}`,
      }),
    });

  if (!response.ok) {
    throw new Error(
      `YouTube playlist browse HTTP ${response.status}`
    );
  }

  return response.json();
}


/* --------------------------------------------------------------------------
   Fetch a YouTube continuation page
   -------------------------------------------------------------------------- */

async function cmjFetchPlaylistContinuation(
  apiKey,
  clientVersion,
  token
) {
  if (
    !apiKey ||
    !clientVersion ||
    !token
  ) {
    return null;
  }

  const endpoint =
    `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(
      apiKey
    )}`;

  const response =
    await fetch(endpoint, {
      method: 'POST',

      credentials: 'omit',

      cache: 'no-store',

      headers: {
        'content-type':
          'application/json',

        accept:
          'application/json',
      },

      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion,
          },
        },

        continuation: token,
      }),
    });

  if (!response.ok) {
    throw new Error(
      `YouTube continuation HTTP ${response.status}`
    );
  }

  return response.json();
}


/* --------------------------------------------------------------------------
   Main playlist supplemental fetch
   -------------------------------------------------------------------------- */

async function cmjFetchPlaylistSupplement(
  url,
  options = {}
) {
  const playlistUrl =
    String(url || '').trim();

  if (!playlistUrl) {
    throw new Error(
      'Playlist URL is required.'
    );
  }

  const playlistId =
    new URL(playlistUrl)
      .searchParams
      .get('list');

  if (!playlistId) {
    throw new Error(
      'Could not find the playlist ID.'
    );
  }

  const response =
    await fetch(
      playlistUrl,
      {
        credentials: 'omit',

        cache: 'no-store',

        redirect: 'follow',

        headers: {
          accept:
            'text/html,application/xhtml+xml',
        },
      }
    );

  if (!response.ok) {
    throw new Error(
      `YouTube playlist HTTP ${response.status}`
    );
  }

  const html =
    await response.text();

  const data =
    cmjExtractYtInitialData(html);

  if (!data) {
    throw new Error(
      'YouTube playlist data was not available on the page.'
    );
  }

  const cfg =
    cmjExtractYtConfig(html);

  const base =
    cmjExtractPlaylistMetadata(
      data,
      playlistUrl
    );

  const allItems =
    [...base.playlistItems];

  const seenVideos =
    new Set(
      allItems.map(
        (item) => item.videoId
      )
    );

  const queue =
    [...cmjExtractContinuationTokens(data)];

  const seenTokens =
    new Set();

  /*
   * ADDITIVE 2026+ FALLBACK
   *
   * YouTube now serves some public playlists through the VL<playlistId>
   * InnerTube browse route. Those responses can contain lockupViewModel
   * entries instead of playlistVideoRenderer entries. The existing page
   * fetch remains the first source; this browse call is only used when
   * that source exposes zero playlist videos.
   */
  if (
    !allItems.length &&
    cfg.apiKey &&
    cfg.clientVersion
  ) {
    try {
      const browseData =
        await cmjFetchPlaylistBrowse(
          cfg.apiKey,
          cfg.clientVersion,
          playlistId
        );

      const browseItems =
        cmjExtractPlaylistVideos(
          browseData
        );

      for (const item of browseItems) {
        if (
          !seenVideos.has(item.videoId)
        ) {
          seenVideos.add(item.videoId);
          allItems.push(item);
        }
      }

      /* Prefer continuation tokens from the playlist-specific browse response. */
      queue.length = 0;

      for (
        const nextToken of
          cmjExtractContinuationTokens(
            browseData
          )
      ) {
        if (!seenTokens.has(nextToken)) {
          queue.push(nextToken);
        }
      }
    } catch (error) {
      console.warn(
        '[Charlie MJ] Playlist browse fallback failed:',
        error
      );
    }
  }

  const maxPages =
    Number(
      options.maxPages || 100
    );

  let pagesFetched = 0;

  while (
    queue.length &&
    pagesFetched < maxPages &&
    cfg.apiKey &&
    cfg.clientVersion
  ) {
    const token =
      queue.shift();

    if (
      !token ||
      seenTokens.has(token)
    ) {
      continue;
    }

    seenTokens.add(token);

    let nextData;

    try {
      nextData =
        await cmjFetchPlaylistContinuation(
          cfg.apiKey,
          cfg.clientVersion,
          token
        );
    } catch (error) {
      console.warn(
        '[Charlie MJ] Playlist continuation failed:',
        error
      );

      break;
    }

    pagesFetched++;

    const nextItems =
      cmjExtractPlaylistVideos(
        nextData
      );

    for (const item of nextItems) {
      if (
        !seenVideos.has(
          item.videoId
        )
      ) {
        seenVideos.add(
          item.videoId
        );

        allItems.push(item);
      }
    }

    for (
      const nextToken of
      cmjExtractContinuationTokens(
        nextData
      )
    ) {
      if (
        !seenTokens.has(
          nextToken
        )
      ) {
        queue.push(
          nextToken
        );
      }
    }

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 0)
    );
  }

  return {
    ...base,

    playlistItems:
      allItems,

    itemCountNumber:
      base.itemCountNumber ||
      allItems.length,

    itemCount:
      String(
        base.itemCountNumber ||
        allItems.length ||
        ''
      ),

    playlistSupplementFetchedAt:
      new Date().toISOString(),

    playlistSupplementPages:
      pagesFetched,

    playlistSupplementComplete:
      queue.length === 0 ||
      pagesFetched >= maxPages,

    playlistSupplementSource:
      'youtube-playlist-page',
  };
}


/* --------------------------------------------------------------------------
   Merge playlist supplement into existing record
   -------------------------------------------------------------------------- */

async function cmjHydratePlaylistRecord(
  x,
  options = {}
) {
  if (
    !x ||
    typeOfResource(x) !== 'playlist' ||
    !x.url
  ) {
    return x;
  }

  const key =
    x.id ||
    x.playlistId ||
    x.url;

  if (
    cmjPlaylistHydrationInFlight.has(
      key
    )
  ) {
    return cmjPlaylistHydrationInFlight.get(
      key
    );
  }

  const promise =
    (async () => {
      const supplement =
        await cmjFetchPlaylistSupplement(
          x.url,
          options
        );

      const merged = {
        ...x,

        ...supplement,

        /*
         * Keep the existing Charlie MJ fields.
         * YouTube supplemental metadata is simply added.
         */
        name:
          supplement.title ||
          x.name,

        title:
          supplement.title ||
          x.title,

        playlistId:
          supplement.playlistId ||
          x.playlistId,

        playlistItems:
          Array.isArray(
            supplement.playlistItems
          ) &&
          supplement.playlistItems.length
            ? supplement.playlistItems
            : Array.isArray(
                x.playlistItems
              )
              ? x.playlistItems
              : [],

        /*
         * Do not replace the existing
         * metadata fetch timestamp.
         */
        metadataLastChecked:
          x.metadataLastChecked ||
          new Date().toISOString(),
      };

      if (options.persist !== false) {
        const result =
          await send({
            type:
              'CMJ_FAVORITES',

            action:
              'update',

            itemType:
              'playlist',

            record:
              merged,
          });

        if (!result.ok) {
          throw new Error(
            result.error ||
            'Could not save playlist details.'
          );
        }
      }

      /*
       * Update the current UI memory immediately.
       */
      allResources =
        allResources.map(
          (item) =>
            item.id === merged.id
              ? merged
              : item
        );

      items =
        items.map(
          (item) =>
            item.id === merged.id
              ? merged
              : item
        );

      return merged;
    })();

  cmjPlaylistHydrationInFlight.set(
    key,
    promise
  );

  try {
    return await promise;
  } finally {
    cmjPlaylistHydrationInFlight.delete(
      key
    );
  }
}


/* --------------------------------------------------------------------------
   Hydrate currently open playlist
   -------------------------------------------------------------------------- */


/* ============================================================================
   CHARLIE MJ — ADDITIVE CHANNEL PLAYLIST HYDRATION
   ============================================================================ */

let cmjChannelPlaylistHydrationInFlight = new Map();

function cmjChannelPlaylistsUrl(x) {
  const raw = String(x?.url || '').trim();
  const channelId = String(x?.channelId || '').trim();
  if (channelId) return `https://www.youtube.com/channel/${encodeURIComponent(channelId)}/playlists`;
  if (!raw) return '';
  try {
    const u = new URL(raw);
    const path = u.pathname.replace(/\/+$/, '');
    if (/\/playlists$/i.test(path)) return u.toString();
    return `${u.origin}${path}/playlists`;
  } catch {
    return '';
  }
}

function cmjPlaylistCountFromText(value) {
  const text = cmjYtText(value).replace(/,/g, '');
  const match = text.match(/(\d[\d.]*)\s*(?:videos?|items?)/i);
  return match ? Number(match[1].replace(/\./g, '')) || 0 : 0;
}

function cmjPlaylistFromLegacyRenderer(renderer) {
  if (!renderer?.playlistId) return null;
  const title = cmjYtText(renderer.title) || cmjYtText(renderer.headline) || '';
  const thumbnail = cmjFirstThumbnail(renderer.thumbnail) || cmjFirstThumbnail(renderer.thumbnails) || '';
  const count = Number(renderer.videoCount || renderer.itemCount || 0) || cmjPlaylistCountFromText(renderer.videoCountText) || cmjPlaylistCountFromText(renderer.stats) || cmjPlaylistCountFromText(renderer.subtitle) || 0;
  const owner = cmjYtText(renderer.shortBylineText) || cmjYtText(renderer.longBylineText) || '';
  return {
    id: `yt-playlist:${renderer.playlistId}`,
    playlistId: renderer.playlistId,
    type: 'playlist', resourceType: 'playlist',
    title, name: title,
    description: cmjYtText(renderer.descriptionSnippet) || cmjYtText(renderer.description) || '',
    thumbnail,
    url: `https://www.youtube.com/playlist?list=${encodeURIComponent(renderer.playlistId)}`,
    owner,
    itemCountNumber: count, itemCount: count ? String(count) : '',
  };
}

function cmjPlaylistFromLockup(lockup) {
  if (!lockup?.contentId) return null;
  const contentType = String(lockup.contentType || '');
  if (contentType && contentType !== 'LOCKUP_CONTENT_TYPE_PLAYLIST' && contentType !== 'LOCKUP_CONTENT_TYPE_PODCAST') return null;
  const metadata = lockup.metadata?.lockupMetadataViewModel || lockup.metadata || {};
  const title = cmjYtText(metadata.title) || cmjYtText(lockup.title) || '';
  const thumbnail = cmjFirstThumbnail(lockup.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image?.sources) || cmjFirstThumbnail(lockup.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image) || cmjFirstThumbnail(lockup.thumbnail) || '';
  const count = cmjPlaylistCountFromText(metadata) || cmjPlaylistCountFromText(lockup.subtitle) || cmjPlaylistCountFromText(lockup.secondaryText) || cmjPlaylistCountFromText(lockup.videoCountText);
  const owner = cmjYtText(metadata.byline) || cmjYtText(metadata.owner) || cmjYtText(lockup.byline) || '';
  return {
    id: `yt-playlist:${lockup.contentId}`,
    playlistId: lockup.contentId,
    type: 'playlist', resourceType: 'playlist',
    title, name: title,
    description: cmjYtText(metadata.description) || cmjYtText(lockup.description) || '',
    thumbnail,
    url: `https://www.youtube.com/playlist?list=${encodeURIComponent(lockup.contentId)}`,
    owner,
    itemCountNumber: count || 0, itemCount: count ? String(count) : '',
  };
}

function cmjExtractChannelPlaylists(data) {
  const result = [], seen = new Set();
  const add = (item) => {
    if (!item?.playlistId || seen.has(item.playlistId)) return;
    seen.add(item.playlistId); result.push(item);
  };
  const legacy = cmjDeepCollect(data, (value) => value && typeof value === 'object' && (value.playlistRenderer?.playlistId || value.gridPlaylistRenderer?.playlistId || value.richPlaylistRenderer?.playlistId), 10000);
  for (const wrapper of legacy) add(cmjPlaylistFromLegacyRenderer(wrapper.playlistRenderer || wrapper.gridPlaylistRenderer || wrapper.richPlaylistRenderer));
  const lockups = cmjDeepCollect(data, (value) => value && typeof value === 'object' && value.lockupViewModel?.contentId, 10000);
  for (const wrapper of lockups) add(cmjPlaylistFromLockup(wrapper.lockupViewModel));
  return result;
}

async function cmjFetchChannelPlaylistBrowse(apiKey, clientVersion, channelId, params = '') {
  if (!apiKey || !clientVersion || !channelId) return null;
  const endpoint = `https://www.youtube.com/youtubei/v1/browse?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(endpoint, {
    method: 'POST', credentials: 'omit', cache: 'no-store',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion } }, browseId: channelId, ...(params ? { params } : {}) }),
  });
  if (!response.ok) throw new Error(`YouTube channel playlists HTTP ${response.status}`);
  return response.json();
}

async function cmjFetchChannelPlaylistsSupplement(x, options = {}) {
  const channelUrl = cmjChannelPlaylistsUrl(x);
  if (!channelUrl) throw new Error('Could not determine the YouTube channel URL.');
  const response = await fetch(channelUrl, { credentials: 'omit', cache: 'no-store', redirect: 'follow', headers: { accept: 'text/html,application/xhtml+xml' } });
  if (!response.ok) throw new Error(`YouTube channel playlists HTTP ${response.status}`);
  const html = await response.text();
  const data = cmjExtractYtInitialData(html);
  if (!data) throw new Error('YouTube channel playlist data was not available on the page.');
  const cfg = cmjExtractYtConfig(html);
  const allPlaylists = [...cmjExtractChannelPlaylists(data)];
  const seenPlaylists = new Set(allPlaylists.map((item) => item.playlistId));
  const queue = [...cmjExtractContinuationTokens(data)];
  const seenTokens = new Set();
  const maxPages = Number(options.maxPages || 50);
  let pagesFetched = 0;

  while (queue.length && pagesFetched < maxPages && cfg.apiKey && cfg.clientVersion) {
    const token = queue.shift();
    if (!token || seenTokens.has(token)) continue;
    seenTokens.add(token);
    let nextData;
    try { nextData = await cmjFetchPlaylistContinuation(cfg.apiKey, cfg.clientVersion, token); }
    catch (error) { console.warn('[Charlie MJ] Channel playlist continuation failed:', error); break; }
    pagesFetched++;
    for (const playlist of cmjExtractChannelPlaylists(nextData)) {
      if (!seenPlaylists.has(playlist.playlistId)) { seenPlaylists.add(playlist.playlistId); allPlaylists.push(playlist); }
    }
    for (const nextToken of cmjExtractContinuationTokens(nextData)) if (!seenTokens.has(nextToken)) queue.push(nextToken);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (!allPlaylists.length && cfg.apiKey && cfg.clientVersion && x.channelId) {
    try {
      const browseData = await cmjFetchChannelPlaylistBrowse(cfg.apiKey, cfg.clientVersion, x.channelId);
      for (const playlist of cmjExtractChannelPlaylists(browseData)) {
        if (!seenPlaylists.has(playlist.playlistId)) { seenPlaylists.add(playlist.playlistId); allPlaylists.push(playlist); }
      }
      for (const token of cmjExtractContinuationTokens(browseData)) if (!seenTokens.has(token)) queue.push(token);
      while (queue.length && pagesFetched < maxPages) {
        const token = queue.shift();
        if (!token || seenTokens.has(token)) continue;
        seenTokens.add(token);
        let nextData;
        try { nextData = await cmjFetchPlaylistContinuation(cfg.apiKey, cfg.clientVersion, token); }
        catch (error) { console.warn('[Charlie MJ] Channel playlist browse continuation failed:', error); break; }
        pagesFetched++;
        for (const playlist of cmjExtractChannelPlaylists(nextData)) {
          if (!seenPlaylists.has(playlist.playlistId)) { seenPlaylists.add(playlist.playlistId); allPlaylists.push(playlist); }
        }
        for (const nextToken of cmjExtractContinuationTokens(nextData)) if (!seenTokens.has(nextToken)) queue.push(nextToken);
      }
    } catch (error) { console.warn('[Charlie MJ] Channel playlist browse fallback failed:', error); }
  }

  return {
    channelPlaylists: allPlaylists,
    channelPlaylistsFetchedAt: new Date().toISOString(),
    channelPlaylistsPages: pagesFetched,
    channelPlaylistsComplete: queue.length === 0 || pagesFetched >= maxPages,
    channelPlaylistsSource: 'youtube-channel-playlists-page',
  };
}

async function cmjHydrateChannelPlaylistsRecord(x, options = {}) {
  if (!x || typeOfResource(x) !== 'channel' || (!x.url && !x.channelId)) return x;
  const key = x.id || x.channelId || x.url;
  if (cmjChannelPlaylistHydrationInFlight.has(key)) return cmjChannelPlaylistHydrationInFlight.get(key);
  const promise = (async () => {
    const supplement = await cmjFetchChannelPlaylistsSupplement(x, options);
    const merged = { ...x, ...supplement, channelPlaylists: Array.isArray(supplement.channelPlaylists) ? supplement.channelPlaylists : [] };
    const result = await send({ type: 'CMJ_FAVORITES', action: 'update', itemType: 'channel', record: merged });
    if (!result.ok) throw new Error(result.error || 'Could not save channel playlist details.');
    allResources = allResources.map((item) => item.id === merged.id ? merged : item);
    items = items.map((item) => item.id === merged.id ? merged : item);
    return merged;
  })();
  cmjChannelPlaylistHydrationInFlight.set(key, promise);
  try { return await promise; } finally { cmjChannelPlaylistHydrationInFlight.delete(key); }
}

function cmjRenderChannelPlaylists(x) {
  const list = Array.isArray(x?.channelPlaylists) ? x.channelPlaylists : [];
  if (!list.length) return `<div class="yt-empty-state"><strong>No channel playlists loaded.</strong><span>Use “Fetch Playlists” to load the playlists currently exposed by this YouTube channel.</span><button type="button" class="secondary small" data-detail-fetch-playlists="${esc(x.id || '')}">↻ Fetch Playlists</button></div>`;
  return `<section class="yt-panel-section"><div class="yt-section-heading"><div><span class="eyebrow">CHANNEL PLAYLISTS</span><h3>${list.length.toLocaleString()} playlist${list.length === 1 ? '' : 's'}</h3></div><button class="secondary small" type="button" data-detail-fetch-playlists="${esc(x.id || '')}">↻ Fetch Playlists</button></div><div class="yt-channel-playlist-grid">${list.map((playlist) => {
    const thumb = playlist.thumbnail?.url || playlist.thumbnail || '';
    const title = cmjCleanText(playlist.title) || cmjCleanText(playlist.name) || 'Untitled playlist';
    const count = playlist.itemCount || playlist.itemCountNumber || '';
    return `<article class="yt-channel-playlist-card" data-detail-channel-playlist="${esc(playlist.playlistId || '')}" tabindex="0" role="button"><div class="yt-channel-playlist-thumb"><img src="${esc(thumb)}" alt="" data-detail-thumb-fallback><span class="yt-channel-playlist-count">${count ? `${esc(count)} video${Number(count) === 1 ? '' : 's'}` : 'Playlist'}</span></div><div class="yt-channel-playlist-body"><h4>${esc(title)}</h4><p>${esc(cmjCleanText(playlist.description) || 'YouTube playlist')}</p><div class="yt-channel-playlist-meta"><span>${esc(cmjCleanText(playlist.owner) || cmjNameOf(x) || 'YouTube')}</span><span>Open playlist →</span></div></div></article>`;
  }).join('')}</div></section>`;
}

async function cmjOpenChannelPlaylist(channel, playlistId) {
  const playlist = (Array.isArray(channel?.channelPlaylists) ? channel.channelPlaylists : []).find((item) => item.playlistId === playlistId);
  if (!playlist) return;
  const existing = allResources.find((item) => typeOfResource(item) === 'playlist' && item.playlistId === playlist.playlistId) || items.find((item) => typeOfResource(item) === 'playlist' && item.playlistId === playlist.playlistId);
  if (existing?.id) { await openDetail(existing.id); return; }
  const transient = { ...playlist, id: `yt-transient-playlist:${playlist.playlistId}`, type: 'playlist', resourceType: 'playlist', isTransientYouTubePlaylist: true, owner: playlist.owner || cmjNameOf(channel) || '' };
  editingId = transient.id;
  cmjDetailActiveTab = 'overview';
  $('#detailContent').innerHTML = cmjDetailShell(transient, 'overview');
  bindDetailInteractions(transient);
  $('#detailDialog').showModal();
  void cmjHydrateOpenPlaylist(transient, { persist: false });
}

async function cmjHydrateOpenChannelPlaylists(x) {
  if (!x || typeOfResource(x) !== 'channel') return x;
  if (Array.isArray(x.channelPlaylists) && x.channelPlaylists.length) return x;
  try {
    const latest = await cmjHydrateChannelPlaylistsRecord(x, { maxPages: 50 });
    const current = allResources.find((resource) => resource.id === latest.id) || latest;
    if ($('#detailDialog')?.open && editingId === latest.id) {
      $('#detailContent').innerHTML = cmjDetailShell(current, cmjDetailActiveTab);
      bindDetailInteractions(current);
    }
    return current;
  } catch (error) {
    console.warn('[Charlie MJ] Channel playlist supplement failed:', error);
    return x;
  }
}

async function cmjHydrateOpenPlaylist(x, options = {}) {
  if (
    !x ||
    typeOfResource(x) !== 'playlist'
  ) {
    return x;
  }

  try {
    const latest =
      await cmjHydratePlaylistRecord(
        x,
        {
          /*
           * 100 continuation pages gives
           * roughly up to 5,000 playlist items
           * when YouTube exposes 50 per page.
           */
          maxPages: 100,
          ...options,
        }
      );

    const current =
      allResources.find(
        (resource) =>
          resource.id === latest.id
      ) ||
      latest;

    if (
      $('#detailDialog')?.open &&
      editingId === latest.id
    ) {
      $('#detailContent').innerHTML =
        cmjDetailShell(
          current,
          cmjDetailActiveTab
        );

      bindDetailInteractions(
        current
      );
    }

    return current;
  } catch (error) {
    console.warn(
      '[Charlie MJ] Playlist detail supplement failed:',
      error
    );

    toast(
      `Playlist videos could not be loaded: ${error.message}`,
      'error'
    );

    return x;
  }
}

function cmjDetailShell(x, active = 'overview') {
  const type = typeOfResource(x);
  const label = type === 'playlist' ? 'YOUTUBE PLAYLIST' : 'YOUTUBE CHANNEL';
  const thumbs = cmjThumbnailSet(x);
  const primaryThumb = x.thumbnail?.url || x.thumbnail || thumbs[0]?.url || '';
  const coverage = cmjMetadataCoverage(x);
  const checked = x.metadataLastChecked || x.thumbnail?.lastChecked || x.updatedAt || x.dateAdded;
  const stats = type === 'channel'
    ? [
        cmjMetric('Subscribers', x.subscriberCount || x.subscriberCountNumber, x.hiddenSubscriberCount ? 'Hidden by channel' : ''),
        cmjMetric('Public videos', x.videoCount || x.videoCountNumber),
        cmjMetric('Total views', x.viewCount || x.viewCountNumber),
      ]
    : [cmjMetric('Playlist videos', x.itemCount || x.itemCountNumber), cmjMetric('Owner', x.owner || x.handle || x.ownerChannelId), cmjMetric('Privacy', x.privacy || '—')];
  return `<div class="yt-detail-head"><div class="yt-detail-cover"><img id="detailThumb" src="${esc(primaryThumb)}" alt=""><div class="yt-detail-cover-shade"></div></div><div class="yt-detail-identity"><span class="eyebrow">${label}</span><h2>${esc(cmjNameOf(x) || 'Unnamed')}</h2><p>${esc(x.description || 'No description available.')}</p><div class="yt-detail-actions"><button class="secondary small" data-detail-open-youtube="${esc(x.url || '')}">Open YouTube</button><button class="secondary small" data-detail-refresh="${esc(x.id || '')}">↻ Refresh Metadata</button></div></div></div>` +
    `<div class="yt-detail-statusbar"><div><span>Metadata fetched</span><strong>${esc(cmjFormatDateTime(checked))}</strong><small>${esc(cmjRelativeTime(checked))}</small></div><div><span>Coverage</span><strong>${coverage.percent}%</strong><small>${coverage.available}/${coverage.total} checks available</small></div><div><span>Resource ID</span><strong>${esc(x.channelId || x.playlistId || x.id || '—')}</strong><small>${esc(x.handle || x.owner || '')}</small></div></div>` +
    `<nav class="yt-detail-tabs" aria-label="Resource detail sections">${(type === 'channel' ? ['overview','statistics','playlists','content','youtube','charlie','history','raw'] : ['overview','statistics','content','youtube','charlie','history','raw']).map((t) => `<button class="${active === t ? 'active' : ''}" data-detail-tab="${t}">${t === 'overview' ? 'Overview' : t === 'statistics' ? 'Statistics' : t === 'playlists' ? 'Playlists' : t === 'content' ? (type === 'playlist' ? 'Playlist Videos' : 'Content') : t === 'youtube' ? 'YouTube Data' : t === 'charlie' ? 'Charlie MJ' : t === 'history' ? 'Fetch & History' : 'Raw Data'}</button>`).join('')}</nav>` +
    `<div class="yt-detail-panel" id="ytDetailPanel">${cmjDetailPanel(x, active)}</div>`;
}

function cmjDetailPanel(x, active) {
  const type = typeOfResource(x);
  if (active === 'statistics') {
    return `<section class="yt-panel-section"><div class="yt-section-heading"><div><span class="eyebrow">${type === 'channel' ? 'CHANNEL STATISTICS' : 'PLAYLIST STATISTICS'}</span><h3>Performance & counts</h3></div></div><div class="yt-metrics-grid">${type === 'channel' ? [cmjMetric('Subscribers', x.subscriberCount || x.subscriberCountNumber), cmjMetric('Subscriber count (number)', x.subscriberCountNumber), cmjMetric('Public videos', x.videoCount || x.videoCountNumber), cmjMetric('Video count (number)', x.videoCountNumber), cmjMetric('Total views', x.viewCount || x.viewCountNumber), cmjMetric('View count (number)', x.viewCountNumber), cmjMetric('Hidden subscribers', x.hiddenSubscriberCount), cmjMetric('Verified', x.verified)].join('') : [cmjMetric('Items', x.itemCount || x.itemCountNumber), cmjMetric('Item count (number)', x.itemCountNumber), cmjMetric('Privacy', x.privacy), cmjMetric('Podcast', x.podcastStatus ?? x.isPodcast)].join('')}</div></section>`;
  }
  if (active === 'playlists' && type === 'channel') {
    return cmjRenderChannelPlaylists(x);
  }
  if (active === 'content') {
    return type === 'playlist' ? cmjPlaylistItemsHtml(x) : `<section class="yt-panel-section"><div class="yt-section-heading"><div><span class="eyebrow">CONTENT</span><h3>Channel content links</h3></div></div><div class="yt-detail-card">${cmjDetailRow('Uploads playlist', x.uploadsPlaylistId || x.contentDetails?.relatedPlaylists?.uploads || '—')} ${cmjDetailRow('Topic details', x.topicDetails || x.topics || '—')} ${cmjDetailRow('Keywords', (x.keywords || []).join(', ') || '—')}</div></section>`;
  }
  if (active === 'youtube') {
    const sourceRows = Object.entries(x.metadataSources || {}).map(([k, v]) => cmjDetailRow(k, v));
    return `<section class="yt-panel-section"><div class="yt-section-heading"><div><span class="eyebrow">OFFICIAL / STORED YOUTUBE FIELDS</span><h3>All YouTube metadata currently stored</h3></div></div><div class="yt-detail-card">${cmjDetailRow('Resource type', x.resourceType || x.kind || type)}${cmjDetailRow('Channel ID', x.channelId)}${cmjDetailRow('Playlist ID', x.playlistId)}${cmjDetailRow('Owner channel ID', x.ownerChannelId)}${cmjDetailRow('Handle', x.handle)}${cmjDetailRow('Custom URL', x.customUrl)}${cmjDetailRow('Canonical URL', x.canonicalUrl)}${cmjDetailRow('Source URL', x.sourceUrl)}${cmjDetailRow('Published / created', x.publishedAt)}${cmjDetailRow('Country', x.country)}${cmjDetailRow('Country code', x.countryCode)}${cmjDetailRow('Language', x.language)}${cmjDetailRow('Language code', x.languageCode)}${cmjDetailRow('Owner', x.owner)}${cmjDetailRow('Privacy', x.privacy)}${cmjDetailRow('Verified', x.verified)}${cmjDetailRow('Verification labels', (x.verificationLabels || []).join(', '))}${cmjDetailRow('Keywords', (x.keywords || []).join(', '))}${cmjDetailRow('Tags', (x.tags || []).join(', '))}</div><div class="yt-detail-card"><h4>Metadata sources</h4>${sourceRows.join('') || '<p class="muted">No source flags stored.</p>'}</div><div class="yt-detail-card"><h4>Additional stored YouTube fields</h4>${cmjExtraYoutubeData(x)}</div></section>`;
  }
  if (active === 'charlie') {
    const collections = (x.collectionIds || []).join(', ') || 'None';
    const suggestion = x.categorySuggestion || {};
    return `<section class="yt-panel-section"><div class="yt-section-heading"><div><span class="eyebrow">CHARLIE MJ</span><h3>Local library metadata</h3></div></div><div class="yt-detail-card">${cmjDetailRow('Category', x.category || 'Uncategorized')}${cmjDetailRow('Tags', (x.tags || []).join(', '))}${cmjDetailRow('Learning groups', collections)}${cmjDetailRow('Pinned', x.isPinned)}${cmjDetailRow('Category suggestion', suggestion.suggestedName || '—')}${cmjDetailRow('Suggestion confidence', suggestion.confidence != null ? `${Math.round(Number(suggestion.confidence) * 100)}%` : '—')}${cmjDetailRow('Suggestion reason', suggestion.reason || (suggestion.reasons || []).join(' · ') || '—')}</div><div class="yt-detail-card"><h4>Personal notes</h4><p class="yt-long-text">${esc(x.notes || 'No personal notes.')}</p></div></section>`;
  }
  if (active === 'history') {
    const checked = x.metadataLastChecked || x.thumbnail?.lastChecked;
    const thumbnailChecked = x.thumbnailChecked || x.thumbnail?.lastChecked;
    const dates = [
      ['Metadata fetched', checked], ['Thumbnail checked', thumbnailChecked], ['Library added', x.dateAdded || x.createdAt], ['Record updated', x.updatedAt], ['YouTube published / created', x.publishedAt],
    ];
    const coverage = cmjMetadataCoverage(x);
    return `<section class="yt-panel-section"><div class="yt-section-heading"><div><span class="eyebrow">FETCH HISTORY</span><h3>Dates, times & metadata freshness</h3></div><button class="secondary small" data-detail-refresh="${esc(x.id || '')}">↻ Fetch again</button></div><div class="yt-detail-card">${dates.map(([label, value]) => `${cmjDetailRow(label, value)}${value ? `<div class="yt-time-note">${esc(cmjRelativeTime(value))}</div>` : ''}`).join('')}</div><div class="yt-detail-card"><h4>Metadata coverage</h4><div class="yt-coverage-bar"><span style="width:${coverage.percent}%"></span></div><strong>${coverage.percent}% complete</strong><div class="yt-check-list">${coverage.checks.map(([label, ok]) => `<span class="${ok ? 'ok' : 'missing'}">${ok ? '✓' : '○'} ${esc(label)}</span>`).join('')}</div></div><div class="yt-detail-card"><h4>Stored fetch state</h4>${cmjDetailRow('Metadata last checked', checked)}${cmjDetailRow('Thumbnail checked', thumbnailChecked)}${cmjDetailRow('Metadata age', cmjRelativeTime(checked))}</div><div class="yt-detail-card"><h4>Metadata change history</h4>${(x.metadataHistory || []).length ? `<div class="yt-history-list">${x.metadataHistory.map((entry) => `<div class="yt-history-entry"><strong>${esc(cmjFormatDateTime(entry.fetchedAt))}</strong><span>${entry.changed ? `${entry.changed} field${entry.changed === 1 ? '' : 's'} changed` : 'Fetched; no tracked field changes'}</span>${entry.changes?.length ? `<small>${entry.changes.map((c) => esc(c.field)).join(', ')}</small>` : ''}</div>`).join('')}</div>` : '<p class="muted">No refresh history has been recorded yet. Use “Fetch again” to create the first snapshot.</p>'}</div></section>`;
  }
  if (active === 'raw') {
    return `<section class="yt-panel-section"><div class="yt-section-heading"><div><span class="eyebrow">ADVANCED</span><h3>Raw stored resource data</h3></div><div class="yt-raw-actions"><button class="secondary small" data-copy-raw>Copy JSON</button><button class="secondary small" data-download-raw>Download JSON</button></div></div><pre class="yt-raw-json" id="detailRawJson">${cmjJsonBlock(x)}</pre></section>`;
  }
  const thumbs = cmjThumbnailSet(x);
  return `<section class="yt-panel-section"><div class="yt-section-heading"><div><span class="eyebrow">OVERVIEW</span><h3>Identity</h3></div></div><div class="yt-detail-card">${cmjDetailRow('Title', cmjNameOf(x))}${cmjDetailRow('Channel ID', x.channelId)}${cmjDetailRow('Playlist ID', x.playlistId)}${cmjDetailRow('Handle', x.handle)}${cmjDetailRow('Owner', x.owner)}${cmjDetailRow('Country', x.country)}${cmjDetailRow('Language', x.language)}${cmjDetailRow('Published / created', x.publishedAt)}${cmjDetailRow('YouTube URL', x.url)}${cmjDetailRow('Canonical URL', x.canonicalUrl)}</div><div class="yt-metrics-grid">${type === 'channel' ? [cmjMetric('Subscribers', x.subscriberCount || x.subscriberCountNumber), cmjMetric('Videos', x.videoCount || x.videoCountNumber), cmjMetric('Views', x.viewCount || x.viewCountNumber)] .join('') : [cmjMetric('Videos', x.itemCount || x.itemCountNumber), cmjMetric('Owner', x.owner || x.handle), cmjMetric('Privacy', x.privacy || '—')].join('')}</div><div class="yt-detail-card"><h4>Description</h4><p class="yt-long-text">${esc(x.description || 'No description available.')}</p></div><div class="yt-detail-card"><h4>Keywords & tags</h4><div class="yt-chip-wrap">${[...(x.keywords || []), ...(x.tags || [])].map((v) => `<span class="chip">${esc(v)}</span>`).join('') || '<span class="muted">None stored</span>'}</div></div><div class="yt-detail-card"><h4>Images</h4><div class="yt-image-grid">${thumbs.map((v) => `<figure><img src="${esc(v.url)}" alt="" data-detail-thumb-fallback><figcaption>${esc(v.label)}</figcaption></figure>`).join('') || '<span class="muted">No image metadata stored.</span>'}</div></div></section>`;
}

function bindDetailInteractions(x) {
  const dialog = $('#detailDialog');
  dialog.querySelectorAll('[data-detail-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const active = button.dataset.detailTab;
      cmjDetailActiveTab = active;
      $('#detailContent').innerHTML = cmjDetailShell(x, active);
      bindDetailInteractions(x);
    });
  });

  dialog.querySelectorAll('[data-detail-fetch-playlists]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Fetching…';
    try {
      const latest = await cmjHydrateChannelPlaylistsRecord(x, { maxPages: 50 });
      const current = allResources.find((resource) => resource.id === latest.id) || latest;
      if ($('#detailDialog')?.open && editingId === current.id) {
        $('#detailContent').innerHTML = cmjDetailShell(current, 'playlists');
        bindDetailInteractions(current);
      }
      toast(`${(current.channelPlaylists || []).length.toLocaleString()} channel playlists loaded.`, 'success');
    } catch (error) {
      toast(`Channel playlists could not be loaded: ${error.message}`, 'error');
      button.disabled = false;
      button.textContent = '↻ Fetch Playlists';
    }
  }));

  dialog.querySelectorAll('[data-detail-channel-playlist]').forEach((card) => {
    const open = () => cmjOpenChannelPlaylist(x, card.dataset.detailChannelPlaylist);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });

  dialog.querySelectorAll('[data-detail-open-youtube]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.detailOpenYoutube) chrome.tabs.create({ url: button.dataset.detailOpenYoutube });
  }));

  /* Open an individual playlist video in a new YouTube tab. */
  dialog.querySelectorAll('[data-detail-open-video]').forEach((button) => button.addEventListener('click', () => {
    if (button.dataset.detailOpenVideo) chrome.tabs.create({ url: button.dataset.detailOpenVideo });
  }));
  dialog.querySelectorAll('[data-detail-refresh]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Fetching…';
    await refreshOne(x);
    const latest = allResources.find((r) => r.id === x.id) || items.find((r) => r.id === x.id) || x;
    $('#detailContent').innerHTML = cmjDetailShell(latest, 'overview');
    bindDetailInteractions(latest);
  }));
  const rawCopy = dialog.querySelector('[data-copy-raw]');
  if (rawCopy) rawCopy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(x, null, 2));
      toast('Raw JSON copied.', 'success');
    } catch {
      toast('Could not copy JSON.', 'error');
    }
  });
  const rawDownload = dialog.querySelector('[data-download-raw]');
  if (rawDownload) rawDownload.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(x, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(cmjNameOf(x) || 'youtube-resource').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  const search = dialog.querySelector('#detailPlaylistSearch');
  const sort = dialog.querySelector('#detailPlaylistSort');
  if (search && sort) {
    const rerender = () => {
      const host = dialog.querySelector('#detailPlaylistItems');
      if (host) host.innerHTML = cmjRenderPlaylistItems(x.playlistItems || [], search.value, sort.value);
    };
    search.addEventListener('input', rerender);
    sort.addEventListener('change', rerender);
  }
  dialog.querySelectorAll('[data-detail-thumb-fallback], #detailThumb').forEach((img) => img.addEventListener('error', () => {
    img.src = chrome.runtime.getURL('assets/charlie-mj-language-main-thumbnail.png');
    img.classList.add('fallback');
  }, { once: true }));
}

async function openDetail(id) {
  const x =
    items.find((i) => i.id === id) ||
    allResources.find((i) => i.id === id);

  if (!x) {
    return;
  }

  editingId = id;

  cmjDetailActiveTab = 'overview';

  /*
   * Render immediately using the existing stored data.
   */
  $('#detailContent').innerHTML =
    cmjDetailShell(
      x,
      'overview'
    );

  bindDetailInteractions(x);

  $('#detailDialog').showModal();

  /*
   * ADDITIVE PLAYLIST LOGIC
   *
   * Do NOT replace the existing fetcher.
   *
   * If this is a playlist, supplement it directly
   * from the public YouTube playlist page.
   */
  if (
    typeOfResource(x) === 'playlist'
  ) {
    void cmjHydrateOpenPlaylist(x);
  } else {
    void cmjHydrateOpenChannelPlaylists(x);
  }
}
function openEdit(id) {
  const x = items.find((i) => i.id === id);

  if (!x) return;

  editingId = id;

  editingType = typeForTab();

  $('#editTitle').textContent = `Edit ${editingType === 'channel' ? 'Channel' : 'Playlist'}`;

  const nameInput = $('#editName');

  nameInput.readOnly = false;

  nameInput.disabled = false;

  nameInput.removeAttribute('readonly');

  nameInput.removeAttribute('disabled');

  nameInput.value = cmjNameOf(x);

  ensureFetchTitleButton();

  if (!nameInput.value) {
    nameInput.placeholder = 'Fetching title from YouTube…';

    const forId = id;

    fetchYouTubeTitle(x.url).then((t) => {
      nameInput.placeholder = 'Name';

      if (t && editingId === forId && !nameInput.value) {
        nameInput.value = t;
      }
    });
  }

  $('#editUrl').value = x.url || '';

  $('#editCategory').value = x.category || '';

  $('#editTags').value = (x.tags || []).join(', ');

  $('#editNotes').value = x.notes || '';

  $('#editPinned').checked = !!x.isPinned;

  $('#editGroupIds').value = (x.collectionIds || []).join(',');

  $('#editDialog').showModal();
}

/**
 * Save all editable fields.
 *
 * ADDITIVE FIX:
 * The edited name is now included in the update record.
 *
 * For playlists, the edited value is written to BOTH `name`
 * and `title` so existing code that reads either property
 * continues to work.
 */
async function saveEdit() {
  const x = items.find((i) => i.id === editingId);

  if (!x) return;

  const editedName = $('#editName').value.trim();

  const record = {
    ...x,

    name: editedName || cmjNameOf(x),

    title: editingType === 'playlist' ? editedName || cmjNameOf(x) : x.title,

    category: $('#editCategory').value.trim(),

    tags: $('#editTags')
      .value.split(',')
      .map((s) => s.trim())
      .filter(Boolean),

    notes: $('#editNotes').value,

    isPinned: $('#editPinned').checked,

    collectionIds: $('#editGroupIds')
      .value.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };

  const r = await send({
    type: 'CMJ_FAVORITES',

    action: 'update',

    itemType: editingType,

    record,
  });

  if (!r.ok) {
    toast(r.error, 'error');

    return;
  }

  $('#editDialog').close();

  toast('Saved successfully.', 'success');

  load();
}

function cmjBuildMetadataHistoryEntry(before, after) {
  const fields = ['name', 'description', 'thumbnail', 'banner', 'country', 'language', 'publishedAt', 'subscriberCount', 'videoCount', 'viewCount', 'itemCount', 'privacy', 'verified', 'keywords', 'tags'];
  const changes = [];
  for (const field of fields) {
    const a = JSON.stringify(before?.[field] ?? null);
    const b = JSON.stringify(after?.[field] ?? null);
    if (a !== b) changes.push({ field, before: before?.[field] ?? null, after: after?.[field] ?? null });
  }
  return {
    fetchedAt: after?.metadataLastChecked || new Date().toISOString(),
    changes,
    changed: changes.length,
  };
}

async function refreshOne(x) {

  const r = await send({
    type: 'CMJ_FAVORITES',

    action: 'refreshMetadata',

    itemType: typeOfResource(x),

    url: x.url,

    record: x,
  });

  if (!r.ok) {
    toast(r.error, 'error');

    return;
  }

  const fetchedResult =
  r.result &&
  typeof r.result === 'object'
    ? r.result
    : {};

  const refreshed = {
    ...x,
    ...fetchedResult,

    /*
    * IMPORTANT:
    * Never destroy playlist videos that were
    * already loaded by the supplemental detail
    * fetch when the original fetcher returns [].
    */
    ...(typeOfResource(x) === 'playlist' &&
    Array.isArray(x.playlistItems) &&
    x.playlistItems.length &&
    (!Array.isArray(
      fetchedResult.playlistItems
    ) ||
      !fetchedResult.playlistItems.length)
      ? {
          playlistItems:
            x.playlistItems,
        }
      : {}),

    ...(typeOfResource(x) === 'playlist' &&
    x.itemCountNumber &&
    !fetchedResult.itemCountNumber
      ? {
          itemCountNumber:
            x.itemCountNumber,

          itemCount:
            x.itemCount,
        }
      : {}),
  };
  const historyEntry = cmjBuildMetadataHistoryEntry(x, refreshed);
  const previousHistory = Array.isArray(x.metadataHistory) ? x.metadataHistory : [];
  refreshed.metadataHistory = [historyEntry, ...previousHistory].slice(0, 30);

  await send({
    type: 'CMJ_FAVORITES',
    action: 'update',
    itemType: typeOfResource(x),
    record: refreshed,
  });

  if (!cmjNameOf(refreshed)) {
    const t = await fetchYouTubeTitle(x.url);

    if (t) {
      const itemType = typeForTab();

      await send({
        type: 'CMJ_FAVORITES',
        action: 'update',
        itemType,
        record: {
          ...x,
          ...(r.result && typeof r.result === 'object' ? r.result : {}),
          metadataHistory: refreshed.metadataHistory,
          name: t,
          title: itemType === 'playlist' ? t : x.title,
        },
      });
    }
  }

  toast('Metadata and thumbnail refreshed.', 'success');

  load();
}

async function mutatePin(x) {
  const r = await send({
    type: 'CMJ_FAVORITES',

    action: 'update',

    itemType: typeForTab(),

    record: {
      ...x,
      isPinned: !x.isPinned,
    },
  });

  if (!r.ok) {
    toast(r.error || 'Could not update pin state.', 'error');
    return;
  }

  toast(x.isPinned ? 'Unpinned.' : 'Pinned.', 'success');
  await load();
}

async function removeOne(x) {
  if (!confirm(`Remove “${cmjNameOf(x)}” from favorites?`)) {
    return;
  }

  const r = await send({
    type: 'CMJ_FAVORITES',

    action: 'remove',

    itemType: typeForTab(),

    id: x.id,
  });

  if (!r.ok) {
    toast(r.error, 'error');
  } else {
    toast('Removed from favorites.', 'success');

    load();
  }
}

async function openGroupPicker(id) {
  if (!groups.length) {
    toast('Create a Learning Group first.', 'error');

    return;
  }

  const box = document.createElement('dialog');

  box.innerHTML = `<form method="dialog" class="dialog-form"><button class="close" type="button" data-x>×</button><span class="eyebrow">LEARNING GROUP</span><h2>Add to Learning Group</h2><label>Group<select id="pickGroup">${groups.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></label><div class="dialog-actions"><button type="button" data-x>Cancel</button><button class="primary" value="default">Add</button></div></form>`;

  document.body.appendChild(box);

  box.querySelectorAll('[data-x]').forEach((b) => b.addEventListener('click', () => box.close()));

  box.addEventListener('close', async () => {
    const gid = box.querySelector('#pickGroup')?.value;

    box.remove();

    if (!gid) return;

    const g = groups.find((x) => x.id === gid);

    if (!g) return;

    const copy = {
      ...g,
    };

    const key = typeForTab() === 'channel' ? 'channels' : 'playlists';

    copy[key] = Array.isArray(copy[key]) ? copy[key] : [];

    if (!copy[key].includes(id)) {
      copy[key].push(id);
    }

    await send({
      type: 'CMJ_FAVORITES',

      action: 'setCollections',

      data: groups.map((x) => (x.id === gid ? copy : x)),
    });

    toast(`Added to ${copy.name}.`, 'success');
  });

  box.showModal();
}

function renderGroups() {
  $('#resultCount').textContent = `${groups.length} learning groups`;

  $('#list').innerHTML =
    `<div class="resource-grid">${groups.map((g) => `<article class="group-card"><div class="group-icon">▦</div><div><h3>${esc(g.name)}</h3><p>${esc(g.description || '')}</p><span class="muted">${(g.channels || []).length} channels · ${(g.playlists || []).length} playlists</span></div><div class="group-actions"><button data-group-view="${esc(g.id)}">View</button><button data-group-edit="${esc(g.id)}">Edit</button><button data-group-remove="${esc(g.id)}" class="danger">Remove</button></div></article>`).join('') || '<div class="empty">No Learning Groups yet.</div>'}</div>`;

  $$('[data-group-view]').forEach((b) =>
    b.addEventListener('click', () => viewGroup(b.dataset.groupView))
  );

  $$('[data-group-edit]').forEach((b) =>
    b.addEventListener('click', () => editGroup(b.dataset.groupEdit))
  );

  $$('[data-group-remove]').forEach((b) =>
    b.addEventListener('click', () => removeGroup(b.dataset.groupRemove))
  );
}

function renderCategories() {
  const q = $('#search').value.trim().toLowerCase();

  const filteredCategories = categories.filter(
    (c) => !q || [c.name, c.description].join(' ').toLowerCase().includes(q)
  );

  const countResources = (name) =>
    allResources.filter(
      (x) => String(x.category || '').toLowerCase() === String(name || '').toLowerCase()
    );

  $('#resultCount').textContent = `${filteredCategories.length} categories`;

  $('#list').innerHTML = `<div class="resource-grid">${
    filteredCategories
      .map((c) => {
        const rs = countResources(c.name);

        const ch = rs.filter((x) => x.channelId || x.type === 'channel').length;

        const pl = rs.filter((x) => x.playlistId || x.type === 'playlist').length;

        return `<article class="group-card"><div class="group-icon">#</div><div><h3>${esc(c.name)}</h3><p>${esc(c.description || 'Category for YouTube learning resources.')}</p><span class="muted">${rs.length} resources · ${ch} channels · ${pl} playlists</span></div><div class="group-actions"><button data-cat-view="${esc(c.id)}">View</button><button data-cat-open="${esc(c.id)}">Open</button><button data-cat-edit="${esc(c.id)}">Edit</button><button data-cat-remove="${esc(c.id)}" class="danger">Remove</button></div></article>`;
      })
      .join('') || '<div class="empty">No categories yet.</div>'
  }</div>`;

  $$('[data-cat-view]').forEach((b) =>
    b.addEventListener('click', () => viewCategory(b.dataset.catView))
  );

  $$('[data-cat-open]').forEach((b) =>
    b.addEventListener('click', () => viewCategory(b.dataset.catOpen))
  );

  $$('[data-cat-edit]').forEach((b) =>
    b.addEventListener('click', () => editCategory(b.dataset.catEdit))
  );

  $$('[data-cat-remove]').forEach((b) =>
    b.addEventListener('click', () => removeCategory(b.dataset.catRemove))
  );
}

async function viewCategory(id) {
  const c = categories.find((x) => x.id === id);

  if (!c) return;

  const resources = allResources.filter(
    (x) => String(x.category || '').toLowerCase() === String(c.name || '').toLowerCase()
  );

  const channels = resources.filter((x) => x.channelId || (!x.playlistId && x.type !== 'playlist'));

  const playlists = resources.filter((x) => x.playlistId || x.type === 'playlist');

  $('#detailContent').innerHTML =
    `<div class="detail-hero"><div class="group-icon large">#</div><div><span class="eyebrow">CATEGORY</span><h2>${esc(c.name)}</h2><p>${esc(c.description || '')}</p></div></div>` +
    `<div class="detail-grid"><div><b>Channels</b><span>${channels.length}</span></div><div><b>Playlists</b><span>${playlists.length}</span></div><div><b>Total</b><span>${resources.length}</span></div><div><b>Category ID</b><span>${esc(c.id || '—')}</span></div></div>` +
    `<div class="detail-notes"><b>Channels</b>${channels.map((x) => `<div class="member-row"><span>◉ ${esc(cmjNameOf(x))}</span><button data-cat-resource="${esc(x.id)}">View</button></div>`).join('') || '<p class="muted">None</p>'}</div>` +
    `<div class="detail-notes"><b>Playlists</b>${playlists.map((x) => `<div class="member-row"><span>▣ ${esc(cmjNameOf(x))}</span><button data-cat-resource="${esc(x.id)}">View</button></div>`).join('') || '<p class="muted">None</p>'}</div>`;

  $$('[data-cat-resource]').forEach((b) =>
    b.addEventListener('click', () => openDetail(b.dataset.catResource))
  );

  $('#detailDialog').showModal();
}

function renderSuggestions() {
  const box = $('#suggestionQuery');

  const type = $('#suggestionType').value;

  chrome.storage.local.get('cmjYoutubeSuggestions').then((s) => {
    const data = s.cmjYoutubeSuggestions || {
      channels: [],
      playlists: [],
    };

    const list = type === 'channel' ? data.channels || [] : data.playlists || [];

    const q = (box.value || '').trim().toLowerCase();

    const filtered = list.filter((x) => !q || [x.name, x.url].join(' ').toLowerCase().includes(q));

    $('#resultCount').textContent = `${filtered.length} ${
      type === 'channel' ? 'channel' : 'playlist'
    } suggestions`;

    $('#list').innerHTML = filtered.length
      ? `<div class="resource-grid">${filtered.map((x) => `<article class="resource-card"><div class="thumb-wrap"><img class="thumb" src="${esc(x.thumbnail || '')}" data-suggestion-thumb><span class="type-badge">${type.toUpperCase()}</span></div><div class="card-body"><h3>${esc(x.name)}</h3><p class="muted">Suggestion — not yet saved to Favorites.</p><div class="group-actions"><button data-sug-view="${esc(x.id)}">View</button><button data-sug-open="${esc(x.url)}">Open</button><button data-sug-save="${esc(x.id)}">Save to Favorites</button><button data-sug-ignore="${esc(x.id)}">Ignore</button></div></div></article>`).join('')}</div>`
      : '<div class="empty"><h3>No suggestions</h3><p>Enter a search term and fetch YouTube suggestions.</p></div>';

    $$('[data-suggestion-thumb]').forEach((img) =>
      img.addEventListener(
        'error',
        () => {
          img.src = chrome.runtime.getURL('assets/charlie-mj-language-main-thumbnail.png');

          img.classList.add('fallback');
        },
        { once: true }
      )
    );

    $$('[data-sug-open]').forEach((b) =>
      b.addEventListener('click', () =>
        chrome.tabs.create({
          url: b.dataset.sugOpen,
        })
      )
    );

    $$('[data-sug-view]').forEach((b) =>
      b.addEventListener('click', () => {
        const x = list.find((v) => v.id === b.dataset.sugView);

        if (!x) return;

        $('#detailContent').innerHTML =
          `<div class="detail-hero"><img src="${esc(x.thumbnail || '')}" alt=""><div><span class="eyebrow">${type.toUpperCase()} SUGGESTION</span><h2>${esc(x.name)}</h2><p>${esc(x.url)}</p></div></div>` +
          `<div class="dialog-actions"><button type="button" data-suggestion-open>Open YouTube</button><button type="button" data-close>Close</button></div>`;

        $('#detailContent [data-suggestion-open]').addEventListener('click', () =>
          chrome.tabs.create({
            url: x.url,
          })
        );

        $('#detailDialog').showModal();
      })
    );

    $$('[data-sug-save]').forEach((b) =>
      b.addEventListener('click', async () => {
        const x = list.find((v) => v.id === b.dataset.sugSave);

        if (!x) return;

        const r = await send({
          type: 'CMJ_FAVORITES',

          action: 'add',

          itemType: type,

          url: x.url,

          record: {
            url: x.url,

            name: x.name,

            title: type === 'playlist' ? x.name : undefined,

            thumbnail: {
              url: x.thumbnail,
            },

            category: '',
          },
        });

        toast(
          r.ok ? 'Saved to Favorites.' : r.error,

          r.ok ? 'success' : 'error'
        );

        if (r.ok) {
          const key = type === 'channel' ? 'channels' : 'playlists';

          data[key] = list.filter((v) => v.id !== x.id);

          await chrome.storage.local.set({
            cmjYoutubeSuggestions: data,
          });

          renderSuggestions();
        }
      })
    );

    $$('[data-sug-ignore]').forEach((b) =>
      b.addEventListener('click', async () => {
        const next = list.filter((v) => v.id !== b.dataset.sugIgnore);

        data[type === 'channel' ? 'channels' : 'playlists'] = next;

        await chrome.storage.local.set({
          cmjYoutubeSuggestions: data,
        });

        renderSuggestions();
      })
    );
  });
}

async function viewGroup(id) {
  const g = groups.find((x) => x.id === id);

  if (!g) return;

  const [cr, pr] = await Promise.all([
    send({
      type: 'CMJ_FAVORITES',

      action: 'list',

      itemType: 'channel',
    }),

    send({
      type: 'CMJ_FAVORITES',

      action: 'list',

      itemType: 'playlist',
    }),
  ]);

  const channels = cr.result || [];

  const playlists = pr.result || [];

  const members = [
    ...(g.channels || []).map((id) => ({
      id,
      type: 'channel',
      item: channels.find((x) => x.id === id),
    })),

    ...(g.playlists || []).map((id) => ({
      id,
      type: 'playlist',
      item: playlists.find((x) => x.id === id),
    })),
  ];

  $('#detailContent').innerHTML =
    `<div class="detail-hero"><div class="group-icon large">▦</div><div><span class="eyebrow">LEARNING GROUP</span><h2>${esc(g.name)}</h2><p>${esc(g.description || '')}</p></div></div>` +
    `<div class="detail-notes"><b>Tags</b><p>${esc((g.tags || []).join(', ') || 'None')}</p></div>` +
    `<div class="detail-notes"><b>Members</b><div class="group-member-list" id="groupMemberList">${members.map((m) => `<div class="member-row"><span>${m.type === 'channel' ? '◉' : '▣'} ${esc((m.item && cmjNameOf(m.item)) || m.id)}</span><button data-member-remove="${esc(m.id)}" data-member-type="${m.type}">Remove</button></div>`).join('') || '<span class="muted">No resources in this group.</span>'}</div></div>` +
    `<div class="dialog-actions"><button type="button" id="detailEditGroup">Edit Group</button><button type="button" class="danger" id="detailRemoveGroup">Remove Group</button><button type="button" data-close>Close</button></div>`;

  $('#detailEditGroup').addEventListener('click', () => {
    $('#detailDialog').close();

    editGroup(g.id);
  });

  $('#detailRemoveGroup').addEventListener('click', () => {
    $('#detailDialog').close();

    removeGroup(g.id);
  });

  $$('[data-member-remove]').forEach((b) =>
    b.addEventListener('click', async () => {
      const copy = { ...g };

      const key = b.dataset.memberType === 'channel' ? 'channels' : 'playlists';

      copy[key] = (copy[key] || []).filter((x) => x !== b.dataset.memberRemove);

      await send({
        type: 'CMJ_FAVORITES',

        action: 'setCollections',

        data: groups.map((x) => (x.id === g.id ? copy : x)),
      });

      toast('Removed from Learning Group.', 'success');

      $('#detailDialog').close();

      load();
    })
  );

  $('#detailDialog').showModal();
}

function editGroup(id) {
  const g = groups.find((x) => x.id === id);

  if (!g) return;

  editingId = id;

  $('#groupName').value = g.name || '';

  $('#groupDescription').value = g.description || '';

  $('#groupTags').value = (g.tags || []).join(', ');

  $('#groupDialog').showModal();
}

async function saveGroup() {
  const existing = groups.find((x) => x.id === editingId);

  const g = {
    ...(existing || {
      id: 'group_' + Date.now(),

      channels: [],

      playlists: [],

      createdAt: new Date().toISOString(),
    }),

    name: $('#groupName').value.trim(),

    description: $('#groupDescription').value.trim(),

    tags: $('#groupTags')
      .value.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };

  if (!g.name) return;

  await send({
    type: 'CMJ_FAVORITES',

    action: 'setCollections',

    data: existing ? groups.map((x) => (x.id === g.id ? g : x)) : [g, ...groups],
  });

  $('#groupDialog').close();

  toast('Learning Group saved.', 'success');

  load();
}

async function removeGroup(id) {
  if (!confirm('Remove this Learning Group? Saved channels/playlists will not be removed.')) {
    return;
  }

  await send({
    type: 'CMJ_FAVORITES',

    action: 'setCollections',

    data: groups.filter((g) => g.id !== id),
  });

  toast('Learning Group removed.', 'success');

  load();
}

function editCategory(id) {
  const c = categories.find((x) => x.id === id);

  if (!c) return;

  editingId = id;

  $('#categoryName').value = c.name || '';

  $('#categoryDescription').value = c.description || '';

  $('#categoryDialog').showModal();
}

async function saveCategory() {
  const name = $('#categoryName').value.trim();

  if (!name) return;

  const existing = categories.find((x) => x.id === editingId);

  const c = {
    ...(existing || {
      id: 'cat_' + Date.now(),
    }),

    name,

    description: $('#categoryDescription').value.trim(),
  };

  const next = existing ? categories.map((x) => (x.id === c.id ? c : x)) : [c, ...categories];

  await send({
    type: 'CMJ_FAVORITES',

    action: 'setCategories',

    data: next,
  });

  $('#categoryDialog').close();

  toast('Category saved.', 'success');

  load();
}

async function removeCategory(id) {
  const c = categories.find((x) => x.id === id);

  if (!c) return;

  if (!confirm(`Remove category “${c.name}”? Resources will remain saved.`)) {
    return;
  }

  await send({
    type: 'CMJ_FAVORITES',

    action: 'setCategories',

    data: categories.filter((x) => x.id !== id),
  });

  toast('Category removed.', 'success');

  load();
}

async function createAddCategory() {
  const input = $('#addCategory');
  const name = input.value.trim();
  if (!name) {
    toast('Enter a category name first.', 'error');
    input.focus();
    return;
  }
  const existing = categories.find(
    (x) => String(x.name).trim().toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    input.value = existing.name;
    toast('This category already exists.', 'info');
    return;
  }
  const r = await send({
    type: 'CMJ_FAVORITES',
    action: 'setCategories',
    data: [
      { id: `cat_${Date.now()}`, name, description: 'Created while adding a YouTube resource.' },
      ...categories,
    ],
  });
  if (!r.ok) {
    toast(r.error || 'Could not create category.', 'error');
    return;
  }
  input.value = name;
  $('#addCategorySuggestion').hidden = true;
  toast(`Category “${name}” created and selected.`, 'success');
  await load();
  updateCreateCategoryButton();
}

async function suggestAddCategory() {
  const url = $('#addUrl').value.trim();
  if (!url) return;
  const box = $('#addCategorySuggestion');
  box.hidden = false;
  box.textContent = 'Checking local metadata rules…';
  const type = /[?&]list=|\/playlist\?/.test(url) ? 'playlist' : 'channel';
  const r = await send({ type: 'CMJ_FAVORITES', action: 'suggest', itemType: type, url });
  if (!r.ok) {
    box.hidden = true;
    return;
  }
  const suggestion = r.result || {};
  const name = suggestion.name || suggestion.suggestedName || 'Uncategorized';
  const confidence = Math.round(Math.max(0, Number(suggestion.confidence) || 0) * 100);
  // Detected signals + "Why was this category suggested?" (local rule engine explanation).
  const detected = [
    suggestion.countryName
      ? `Country: ${esc(suggestion.countryCode)} (${esc(suggestion.countryName)})`
      : '',
    suggestion.languageName ? `Language: ${esc(suggestion.languageName)}` : '',
    suggestion.keywords?.length ? `Keywords: ${suggestion.keywords.map(esc).join(', ')}` : '',
  ].filter(Boolean);
  const why = (suggestion.reasons || []).map((line) => `<li>${esc(line)}</li>`).join('');
  const candidates = (suggestion.candidates || []).map((candidate) => {
    const pct = Math.round(Number(candidate.confidence || 0) * 100);
    return `<button type="button" class="suggestion-candidate" data-suggestion-category="${esc(candidate.name)}">${esc(candidate.name)} <span>${pct}%</span></button>`;
  }).join('');
  box.innerHTML =
    `<strong>Suggested:</strong> ${esc(name)} <span>(${confidence}% ${esc(suggestion.level || 'confidence')})</span>` +
    (suggestion.reason ? ` <small>${esc(suggestion.reason)}</small>` : '') +
    (detected.length ? `<div class="add-detected">${detected.join(' · ')}</div>` : '') +
    (candidates ? `<div class="suggestion-candidates"><span>Top matches:</span>${candidates}</div>` : '') +
    (why
      ? `<details class="add-why"><summary>Why was this category suggested?</summary><ul>${why}<li>Confidence: ${confidence}%${suggestion.level ? ' (' + esc(suggestion.level) + ')' : ''}</li></ul></details>`
      : '');
  box.querySelectorAll('[data-suggestion-category]').forEach((button) => button.addEventListener('click', () => {
    $('#addCategory').value = button.dataset.suggestionCategory || '';
    updateCreateCategoryButton();
  }));
  if (!$('#addCategory').value && name !== 'Uncategorized') $('#addCategory').value = name;
  updateCreateCategoryButton();
}

/** Shows "+ Create “x”" only when the typed name is not an existing category. */
function updateCreateCategoryButton() {
  const button = $('#addCreateCategory');
  const typed = $('#addCategory').value.trim();
  const exists = categories.some(
    (c) => String(c.name).trim().toLowerCase() === typed.toLowerCase()
  );
  button.hidden = !typed || exists;
  button.textContent = typed ? `＋ Create “${typed}”` : '＋ Create this category';
}

function openAdd() {
  editingId = null;

  $('#addForm').reset();
  $('#addCategorySuggestion').hidden = true;
  $('#addCategorySuggestion').textContent = '';
  updateCreateCategoryButton();
  $('#addDialog').showModal();
}

async function addResource() {
  const url = $('#addUrl').value.trim();

  const type = /[?&]list=|\/playlist\?/.test(url) ? 'playlist' : 'channel';

  const category = $('#addCategory').value.trim();

  const r = await send({
    type: 'CMJ_FAVORITES',

    action: 'add',

    itemType: type,

    url,

    record: {
      url,

      category,

      tags: $('#addTags')
        .value.split(',')
        .map((s) => s.trim())
        .filter(Boolean),

      notes: $('#addNotes').value,
    },
  });

  if (!r.ok) {
    toast(r.error, 'error');

    return;
  }

  $('#addDialog').close();

  tab = type === 'channel' ? 'channels' : 'playlists';

  syncTabs();

  toast('YouTube resource added successfully.', 'success');

  if (r.result && typeof r.result === 'object' && !cmjNameOf(r.result)) {
    const t = await fetchYouTubeTitle(url);

    if (t) {
      await send({
        type: 'CMJ_FAVORITES',
        action: 'update',
        itemType: type,
        record: {
          ...r.result,
          name: t,
          title: type === 'playlist' ? t : r.result.title,
        },
      });
    }
  }

  if (r.result?.categorySuggestion?.suggestedName && !category) {
    showCategorySuggestion(r.result, type);
  }

  load();
}

function showCategorySuggestion(record, type) {
  const s = record.categorySuggestion;

  if (!s?.suggestedName) return;

  const box = document.createElement('dialog');

  box.innerHTML = `<form method="dialog" class="dialog-form"><button class="close" type="button" data-close-suggestion>×</button><span class="eyebrow">EXTENSION INTELLIGENCE</span><h2>Category suggestion</h2><p>Suggested new category: <strong>${esc(s.suggestedName)}</strong></p><p class="form-note">Confidence: ${Math.round((s.confidence || 0) * 100)}%. Existing categories were checked first.</p><div class="dialog-actions"><button type="button" data-close-suggestion>Keep Uncategorized</button><button type="button" class="primary" id="acceptSuggestedCategory">Create & Apply</button></div></form>`;

  document.body.appendChild(box);

  box.querySelectorAll('[data-close-suggestion]').forEach((b) =>
    b.addEventListener('click', () => {
      box.close();

      box.remove();
    })
  );

  box.querySelector('#acceptSuggestedCategory').addEventListener('click', async () => {
    const next = [
      ...categories,
      {
        id: 'cat_' + Date.now(),

        name: s.suggestedName,

        description: 'Created from Extension Intelligence suggestion',
      },
    ];

    const c = await send({
      type: 'CMJ_FAVORITES',

      action: 'setCategories',

      data: next,
    });

    const x = allResources.find((v) => v.id === record.id);

    if (x) {
      await send({
        type: 'CMJ_FAVORITES',

        action: 'update',

        itemType: type,

        record: {
          ...x,
          category: s.suggestedName,
        },
      });
    }

    toast(c.ok ? 'New category created and applied.' : c.error, c.ok ? 'success' : 'error');

    box.close();

    box.remove();

    load();
  });

  box.showModal();
}

function syncTabs() {
  $$('.side-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));

  const sug = tab === 'suggestions';

  $('#search').disabled = false;

  $('#search').placeholder =
    tab === 'categories'
      ? 'Search categories…'
      : tab === 'suggestions'
        ? 'Search suggestions…'
        : 'Search names, descriptions, tags, categories…';

  $('#categoryFilter').disabled = tab === 'categories' || sug;

  $('#suggestionQuery').hidden = !sug;

  $('#suggestionType').hidden = !sug;

  $('#fetchSuggestions').hidden = !sug;
}

function openSearchSuggestions() {
  const q = $('#search').value.trim().toLowerCase();

  const box = $('#suggestions');

  if (!q) {
    box.hidden = true;

    return;
  }

  const vals = new Set();

  [...allResources, ...categories].forEach((x) =>
    [cmjTextOf(x.name), cmjTextOf(x.title), x.category, ...(x.tags || [])].forEach((v) => {
      if (v && String(v).toLowerCase().includes(q)) {
        vals.add(String(v));
      }
    })
  );

  box.innerHTML = [...vals]
    .slice(0, 8)
    .map((v) => `<button data-suggest="${esc(v)}">${esc(v)}</button>`)
    .join('');

  box.hidden = !vals.size;

  $$('[data-suggest]').forEach((b) =>
    b.addEventListener('click', () => {
      $('#search').value = b.dataset.suggest;

      box.hidden = true;

      render();
    })
  );
}

$('#add').addEventListener('click', openAdd);

let searchTimer = null;
$('#search').addEventListener('input', () => {
  clearTimeout(searchTimer);
  if (searchSettings.suggestions) openSearchSuggestions();
  searchTimer = setTimeout(() => render(), Math.max(0, Number(searchSettings.debounceMs) || 120));
});

$('#categoryFilter').addEventListener('change', render);

$('#refresh').addEventListener('click', () => load());

$('#recategorize')?.addEventListener('click', async () => {
  const button = $('#recategorize');
  if (!confirm('Re-run the category engine only for resources currently marked Uncategorized? Manually categorized resources will not be changed.')) return;
  button.disabled = true;
  button.textContent = '🧠 Re-categorizing…';
  try {
    const [channels, playlists] = await Promise.all([
      send({ type: 'CMJ_FAVORITES', action: 'recategorize', itemType: 'channel', onlyUncategorized: true, limit: 500 }),
      send({ type: 'CMJ_FAVORITES', action: 'recategorize', itemType: 'playlist', onlyUncategorized: true, limit: 500 }),
    ]);
    if (!channels?.ok || !playlists?.ok) throw new Error(channels?.error || playlists?.error || 'Re-categorization failed.');
    toast(`Re-categorized ${Number(channels.result?.changed || 0) + Number(playlists.result?.changed || 0)} resources.`, 'success');
    await load();
  } catch (error) {
    toast(error.message || 'Re-categorization failed.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = '🧠 Re-categorize Uncategorized';
  }
});

$('#addCreateCategory').addEventListener('click', createAddCategory);
$('#addCategory').addEventListener('input', updateCreateCategoryButton);
$('#addUrl').addEventListener('blur', () => {
  clearTimeout(addSuggestTimer);
  addSuggestTimer = setTimeout(suggestAddCategory, 80);
});

$('#settings').addEventListener('click', () => chrome.runtime.openOptionsPage());

$('#openLibrary').addEventListener('click', () =>
  chrome.tabs.create({
    url: chrome.runtime.getURL('src/dashboard/dashboard.html'),
  })
);

$$('.side-tab').forEach((b) =>
  b.addEventListener('click', () => {
    tab = b.dataset.tab;

    syncTabs();

    load();
  })
);

$('#suggestionQuery').addEventListener('input', renderSuggestions);

$('#suggestionType').addEventListener('change', renderSuggestions);

$('#fetchSuggestions').addEventListener('click', async () => {
  const query = $('#suggestionQuery').value.trim();

  const type = $('#suggestionType').value;

  if (!query) {
    toast('Enter a YouTube suggestion search term.', 'error');

    return;
  }

  const r = await send({
    type: 'CMJ_YOUTUBE_SUGGESTIONS',

    query,

    itemType: type,
  });

  toast(
    r.ok ? `Fetched ${r.result.length} ${type} suggestions.` : r.error,

    r.ok ? 'success' : 'error'
  );

  if (r.ok) {
    renderSuggestions();
  }
});

$('#addForm').addEventListener('submit', (e) => {
  e.preventDefault();

  addResource();
});

$('#editForm').addEventListener('submit', (e) => {
  e.preventDefault();

  saveEdit();
});

$('#groupForm').addEventListener('submit', (e) => {
  e.preventDefault();

  saveGroup();
});

$('#categoryForm').addEventListener('submit', (e) => {
  e.preventDefault();

  saveCategory();
});

$$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));

$('#newGroup').addEventListener('click', () => {
  editingId = null;

  $('#groupForm').reset();

  $('#groupDialog').showModal();
});

$('#newCategory').addEventListener('click', () => {
  editingId = null;

  $('#categoryForm').reset();

  $('#categoryDialog').showModal();
});

$('#backup').addEventListener('click', async () => {
  const r = await send({
    type: 'CMJ_FAVORITES',

    action: 'export',
  });

  download(
    'charlie-mj-youtube-favorites.json',
    JSON.stringify(r.result, null, 2),
    'application/json'
  );
});

$('#restore').addEventListener('click', () => $('#file').click());

$('#file').addEventListener('change', async (e) => {
  const f = e.target.files[0];

  if (!f) return;

  try {
    const data = JSON.parse(await f.text());

    const mode = confirm('Merge backup with existing favorites? Cancel = replace.')
      ? 'merge'
      : 'replace';

    const r = await send({
      type: 'CMJ_FAVORITES',

      action: 'import',

      data,

      mode,
    });

    if (!r.ok) {
      throw Error(r.error);
    }

    toast('Backup restored.', 'success');

    load();
  } catch (err) {
    toast(err.message, 'error');
  }

  e.target.value = '';
});

$('#txt').addEventListener('click', async () => {
  const r = await send({
    type: 'CMJ_FAVORITES',

    action: 'txt',
  });

  download('charlie-mj-youtube-favorites.txt', r.result.text, 'text/plain');
});

function download(name, text, mime) {
  const a = document.createElement('a');

  a.href = URL.createObjectURL(
    new Blob([text], {
      type: mime,
    })
  );

  a.download = name;

  document.body.appendChild(a);

  a.click();

  a.remove();

  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'CMJ_LIBRARY_DATA_CHANGED') load();
});

syncTabs();

load();
