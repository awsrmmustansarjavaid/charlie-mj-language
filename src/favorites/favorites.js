'use strict';

const $ = (s, r = document) =>
  r.querySelector(s);

const $$ = (s, r = document) =>
  [...r.querySelectorAll(s)];

let tab = 'channels',
    items = [],
    allResources = [],
    categories = [],
    groups = [],
    editingId = null,
    editingType = null;

const send = m =>
  new Promise(resolve =>
    chrome.runtime.sendMessage(
      m,
      r =>
        resolve(
          r || {
            ok: false,
            error:
              chrome.runtime.lastError?.message ||
              'No response'
          }
        )
    )
  );

const esc = v =>
  String(v ?? '').replace(
    /[&<>"']/g,
    c =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
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
    return v.map(i => cmjTextOf(i, depth + 1)).join('');
  }
  if (typeof v === 'object') {
    if (v.runs) return cmjTextOf(v.runs, depth + 1);
    for (const k of [
      'simpleText',
      'text',
      'title',
      'name',
      'value',
      'content',
      'label'
    ]) {
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

const cmjCleanText = v => {
  const t = cmjTextOf(v).trim();
  return BAD_TITLE_RE.test(t) ? '' : t;
};

const cmjNameOf = x =>
  cmjCleanText(x && x.name) ||
  cmjCleanText(x && x.title) ||
  '';

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
      'https://www.youtube.com/oembed?format=json&url=' +
        encodeURIComponent(url)
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
    .filter(
      x =>
        x &&
        x.url &&
        !cmjNameOf(x) &&
        !titleRepairTried.has(x.id)
    )
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
        title: itemType === 'playlist' ? t : x.title
      }
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

function toast(
  message,
  type = 'info'
) {
  const host =
    $('#toastHost');

  const n =
    document.createElement(
      'div'
    );

  n.className =
    `toast ${type}`;

  n.textContent =
    message;

  host.appendChild(n);

  setTimeout(
    () => n.remove(),
    2800
  );
}

function typeForTab() {
  return tab === 'playlists'
    ? 'playlist'
    : 'channel';
}

async function load() {
  const [
    r,
    cr,
    pr,
    c,
    g
  ] = await Promise.all([
    send({
      type: 'CMJ_FAVORITES',
      action: 'list',
      itemType:
        typeForTab()
    }),

    send({
      type: 'CMJ_FAVORITES',
      action: 'list',
      itemType: 'channel'
    }),

    send({
      type: 'CMJ_FAVORITES',
      action: 'list',
      itemType: 'playlist'
    }),

    send({
      type: 'CMJ_FAVORITES',
      action: 'categories'
    }),

    send({
      type: 'CMJ_FAVORITES',
      action: 'collections'
    })
  ]);

  items =
    r.ok &&
    Array.isArray(r.result)
      ? r.result
      : [];

  allResources = [
    ...(cr.result || []),
    ...(pr.result || [])
  ];

  categories =
    c.ok &&
    Array.isArray(c.result)
      ? c.result
      : [];

  groups =
    g.ok &&
    Array.isArray(g.result)
      ? g.result
      : [];

  renderCategoryFilter();
  render();

  repairTitles();
}

function renderCategoryFilter() {
  const s =
    $('#categoryFilter');

  const old =
    s.value;

  s.innerHTML =
    '<option value="">All categories</option>' +
    categories
      .map(
        c =>
          `<option value="${esc(c.name)}">${esc(c.name)}</option>`
      )
      .join('');

  if (
    [...s.options].some(
      o => o.value === old
    )
  ) {
    s.value = old;
  }

  const a =
    $('#addCategory');

  if (a) {
    a.innerHTML =
      '<option value="">Auto-suggest from YouTube metadata</option>' +
      categories
        .map(
          c =>
            `<option value="${esc(c.name)}">${esc(c.name)}</option>`
        )
        .join('');
  }

  const d =
    $('#categoryOptions');

  if (d) {
    d.innerHTML =
      categories
        .map(
          c =>
            `<option value="${esc(c.name)}"></option>`
        )
        .join('');
  }
}

function render() {
  if (
    tab === 'categories'
  ) {
    renderCategories();
    return;
  }

  if (
    tab === 'groups'
  ) {
    renderGroups();
    return;
  }

  if (
    tab === 'suggestions'
  ) {
    renderSuggestions();
    return;
  }

  const q =
    $('#search')
      .value
      .trim()
      .toLowerCase();

  const cat =
    $('#categoryFilter')
      .value
      .toLowerCase();

  const list =
    items.filter(x => {
      const hay = [
        cmjTextOf(x.name),
        cmjTextOf(x.title),
        x.description,
        x.handle,
        x.owner,
        x.category,
        (x.tags || [])
          .join(' '),
        x.notes || ''
      ]
        .join(' ')
        .toLowerCase();

      return (
        (!q ||
          hay.includes(q)) &&
        (
          !cat ||
          String(
            x.category || ''
          ).toLowerCase() === cat
        )
      );
    });

  $('#resultCount')
    .textContent =
      `${list.length} ${
        tab === 'channels'
          ? 'channel'
          : 'playlist'
      }${
        list.length === 1
          ? ''
          : 's'
      }`;

  $('#list').innerHTML =
    list.length
      ? `<div class="resource-grid">${list.map(card).join('')}</div>`
      : '<div class="empty"><div class="empty-icon">☆</div><h3>No resources found</h3><p>Add a YouTube channel or playlist, or change your search/filter.</p></div>';

  bindCards();
}

function card(x) {
  const name =
    cmjNameOf(x) ||
    'Unnamed';

  const type =
    typeForTab();

  const thumb =
    x.thumbnail?.url ||
    x.thumbnail ||
    '';

  return `<article class="resource-card ${x.isPinned ? 'pinned' : ''}" data-id="${esc(x.id)}">
  <div class="thumb-wrap"><img class="thumb" src="${esc(thumb)}" alt="" data-thumb-fallback><span class="type-badge">${type === 'channel' ? 'CHANNEL' : 'PLAYLIST'}</span>${x.isPinned ? '<span class="pin-badge">📌</span>' : ''}</div>
  <div class="card-body"><div class="card-title-row"><h3>${esc(name)}</h3><button class="icon-btn" data-menu="${esc(x.id)}" title="More actions">⋮</button></div>
  <p class="muted clamp">${esc(x.description || 'No description available.')}</p><div class="meta-line">${esc(x.handle || x.owner || '')}${x.videoCount ? ' · ' + esc(x.videoCount) : ''}</div>
  <div class="chips"><span class="chip category-chip">${esc(x.category || 'Uncategorized')}</span>${(x.tags || []).slice(0, 3).map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>
  <div class="card-footer"><span>${x.isPinned ? 'Pinned · ' : ''}${x.dateAdded ? new Date(x.dateAdded).toLocaleDateString() : ''}</span><button class="secondary small" data-detail="${esc(x.id)}">View Detail</button></div></div></article>`;
}

function bindCards() {
  $$('[data-detail]')
    .forEach(b =>
      b.addEventListener(
        'click',
        () =>
          openDetail(
            b.dataset.detail
          )
      )
    );

  $$('[data-menu]')
    .forEach(b =>
      b.addEventListener(
        'click',
        e => {
          e.stopPropagation();
          openCardMenu(b);
        }
      )
    );

  $$('[data-thumb-fallback]')
    .forEach(img =>
      img.addEventListener(
        'error',
        () => {
          img.src =
            chrome.runtime.getURL(
              'assets/charlie-mj-language-main-thumbnail.png'
            );

          img.classList.add(
            'fallback'
          );
        },
        { once: true }
      )
    );
}

function openCardMenu(btn) {
  const old =
    $('.card-menu');

  old?.remove();

  const x =
    items.find(
      i =>
        i.id ===
        btn.dataset.menu
    );

  if (!x) return;

  const m =
    document.createElement(
      'div'
    );

  m.className =
    'card-menu';

  m.innerHTML =
    `<button data-act="detail">View Detail</button>` +
    `<button data-act="edit">Edit</button>` +
    `<button data-act="open">Open YouTube</button>` +
    `<button data-act="group">Add to Learning Group</button>` +
    `<button data-act="pin">${x.isPinned ? 'Unpin' : 'Pin'}</button>` +
    `<button data-act="refresh">Refresh Metadata</button>` +
    `<button data-act="remove" class="danger">Remove</button>`;

  btn.parentElement
    .appendChild(m);

  m.addEventListener(
    'click',
    async e => {
      const act =
        e.target
          .closest(
            '[data-act]'
          )
          ?.dataset.act;

      if (!act) return;

      m.remove();

      if (
        act === 'detail'
      ) {
        openDetail(x.id);
      }

      if (
        act === 'edit'
      ) {
        openEdit(x.id);
      }

      if (
        act === 'open'
      ) {
        chrome.tabs.create({
          url: x.url
        });
      }

      if (
        act === 'group'
      ) {
        openGroupPicker(
          x.id
        );
      }

      if (
        act === 'pin'
      ) {
        await mutatePin(x);
      }

      if (
        act === 'refresh'
      ) {
        await refreshOne(x);
      }

      if (
        act === 'remove'
      ) {
        await removeOne(x);
      }
    }
  );

  setTimeout(
    () =>
      document.addEventListener(
        'click',
        () =>
          m.remove(),
        { once: true }
      ),
    0
  );
}

function openDetail(id) {
  const x =
    items.find(
      i => i.id === id
    ) ||
    allResources.find(
      i => i.id === id
    );

  if (!x) return;

  editingId = id;

  $('#detailContent')
    .innerHTML =
      `<div class="detail-hero"><img id="detailThumb" src="${esc(x.thumbnail?.url || x.thumbnail || '')}"><div><span class="eyebrow">${tab === 'channels' ? 'YOUTUBE CHANNEL' : 'YOUTUBE PLAYLIST'}</span><h2>${esc(cmjNameOf(x) || 'Unnamed')}</h2><p>${esc(x.description || 'No description available.')}</p></div></div>` +
      `<div class="detail-grid"><div><b>Category</b><span>${esc(x.category || 'Uncategorized')}</span></div>` +
      `<div><b>Tags</b><span>${esc((x.tags || []).join(', ') || 'None')}</span></div>` +
      `<div><b>Owner</b><span>${esc(x.owner || x.handle || '—')}</span></div>` +
      `<div><b>Video count</b><span>${esc(x.videoCount || '—')}</span></div>` +
      `<div><b>ID</b><span>${esc(x.channelId || x.playlistId || '—')}</span></div>` +
      `<div><b>Last checked</b><span>${esc(x.metadataLastChecked || x.thumbnail?.lastChecked || '—')}</span></div></div>` +
      `<div class="detail-notes"><b>Notes</b><p>${esc(x.notes || 'No personal notes.')}</p></div>`;

  const img =
    $('#detailThumb');

  if (img) {
    img.addEventListener(
      'error',
      () => {
        img.src =
          chrome.runtime.getURL(
            'assets/charlie-mj-language-main-thumbnail.png'
          );
      },
      { once: true }
    );
  }

  $('#detailDialog')
    .showModal();
}

function openEdit(id) {
  const x =
    items.find(
      i => i.id === id
    );

  if (!x) return;

  editingId = id;

  editingType =
    typeForTab();

  $('#editTitle')
    .textContent =
      `Edit ${
        editingType === 'channel'
          ? 'Channel'
          : 'Playlist'
      }`;

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

    fetchYouTubeTitle(x.url).then(t => {
      nameInput.placeholder = 'Name';

      if (t && editingId === forId && !nameInput.value) {
        nameInput.value = t;
      }
    });
  }

  $('#editUrl')
    .value =
      x.url ||
      '';

  $('#editCategory')
    .value =
      x.category ||
      '';

  $('#editTags')
    .value =
      (x.tags || [])
        .join(', ');

  $('#editNotes')
    .value =
      x.notes ||
      '';

  $('#editPinned')
    .checked =
      !!x.isPinned;

  $('#editGroupIds')
    .value =
      (x.collectionIds || [])
        .join(',');

  $('#editDialog')
    .showModal();
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
  const x =
    items.find(
      i => i.id === editingId
    );

  if (!x) return;

  const editedName =
    $('#editName')
      .value
      .trim();

  const record = {
    ...x,

    name:
      editedName ||
      cmjNameOf(x),

    title:
      editingType === 'playlist'
        ? (
            editedName ||
            cmjNameOf(x)
          )
        : x.title,

    category:
      $('#editCategory')
        .value
        .trim(),

    tags:
      $('#editTags')
        .value
        .split(',')
        .map(
          s => s.trim()
        )
        .filter(Boolean),

    notes:
      $('#editNotes')
        .value,

    isPinned:
      $('#editPinned')
        .checked,

    collectionIds:
      $('#editGroupIds')
        .value
        .split(',')
        .map(
          s => s.trim()
        )
        .filter(Boolean)
  };

  const r =
    await send({
      type:
        'CMJ_FAVORITES',

      action:
        'update',

      itemType:
        editingType,

      record
    });

  if (!r.ok) {
    toast(
      r.error,
      'error'
    );

    return;
  }

  $('#editDialog')
    .close();

  toast(
    'Saved successfully.',
    'success'
  );

  load();
}

async function refreshOne(x) {
  const r =
    await send({
      type:
        'CMJ_FAVORITES',

      action:
        'refreshMetadata',

      itemType:
        typeForTab(),

      url:
        x.url,

      record:
        x
    });

  if (!r.ok) {
    toast(
      r.error,
      'error'
    );

    return;
  }

  const refreshed =
    r.result && typeof r.result === 'object' ? r.result : x;

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
          name: t,
          title: itemType === 'playlist' ? t : x.title
        }
      });
    }
  }

  toast(
    'Metadata and thumbnail refreshed.',
    'success'
  );

  load();
}

async function mutatePin(x) {
  const r =
    await send({
      type:
        'CMJ_FAVORITES',

      action:
        'update',

      itemType:
        typeForTab(),

      record: {
        ...x,
        isPinned:
          !x.isPinned
      }
    });

  if (!r.ok) {
    toast(
      x.isPinned
        ? 'Unpinned.'
        : 'Pinned.',
      'success'
    );
  } else {
    toast(
      x.isPinned
        ? 'Unpinned.'
        : 'Pinned.',
      'success'
    );

    load();
  }
}

async function removeOne(x) {
  if (
    !confirm(
      `Remove “${
        cmjNameOf(x)
      }” from favorites?`
    )
  ) {
    return;
  }

  const r =
    await send({
      type:
        'CMJ_FAVORITES',

      action:
        'remove',

      itemType:
        typeForTab(),

      id:
        x.id
    });

  if (!r.ok) {
    toast(
      r.error,
      'error'
    );
  } else {
    toast(
      'Removed from favorites.',
      'success'
    );

    load();
  }
}

async function openGroupPicker(id) {
  if (!groups.length) {
    toast(
      'Create a Learning Group first.',
      'error'
    );

    return;
  }

  const box =
    document.createElement(
      'dialog'
    );

  box.innerHTML =
    `<form method="dialog" class="dialog-form"><button class="close" type="button" data-x>×</button><span class="eyebrow">LEARNING GROUP</span><h2>Add to Learning Group</h2><label>Group<select id="pickGroup">${groups.map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select></label><div class="dialog-actions"><button type="button" data-x>Cancel</button><button class="primary" value="default">Add</button></div></form>`;

  document.body.appendChild(
    box
  );

  box
    .querySelectorAll(
      '[data-x]'
    )
    .forEach(b =>
      b.addEventListener(
        'click',
        () =>
          box.close()
      )
    );

  box.addEventListener(
    'close',
    async () => {
      const gid =
        box.querySelector(
          '#pickGroup'
        )?.value;

      box.remove();

      if (!gid) return;

      const g =
        groups.find(
          x => x.id === gid
        );

      if (!g) return;

      const copy = {
        ...g
      };

      const key =
        typeForTab() ===
        'channel'
          ? 'channels'
          : 'playlists';

      copy[key] =
        Array.isArray(
          copy[key]
        )
          ? copy[key]
          : [];

      if (
        !copy[key].includes(id)
      ) {
        copy[key].push(id);
      }

      await send({
        type:
          'CMJ_FAVORITES',

        action:
          'setCollections',

        data:
          groups.map(
            x =>
              x.id === gid
                ? copy
                : x
          )
      });

      toast(
        `Added to ${copy.name}.`,
        'success'
      );
    }
  );

  box.showModal();
}

function renderGroups() {
  $('#resultCount')
    .textContent =
      `${groups.length} learning groups`;

  $('#list').innerHTML =
    `<div class="resource-grid">${groups.map(g => `<article class="group-card"><div class="group-icon">▦</div><div><h3>${esc(g.name)}</h3><p>${esc(g.description || '')}</p><span class="muted">${(g.channels || []).length} channels · ${(g.playlists || []).length} playlists</span></div><div class="group-actions"><button data-group-view="${esc(g.id)}">View</button><button data-group-edit="${esc(g.id)}">Edit</button><button data-group-remove="${esc(g.id)}" class="danger">Remove</button></div></article>`).join('') || '<div class="empty">No Learning Groups yet.</div>'}</div>`;

  $$('[data-group-view]')
    .forEach(b =>
      b.addEventListener(
        'click',
        () =>
          viewGroup(
            b.dataset.groupView
          )
      )
    );

  $$('[data-group-edit]')
    .forEach(b =>
      b.addEventListener(
        'click',
        () =>
          editGroup(
            b.dataset.groupEdit
          )
      )
    );

  $$('[data-group-remove]')
    .forEach(b =>
      b.addEventListener(
        'click',
        () =>
          removeGroup(
            b.dataset.groupRemove
          )
      )
    );
}

function renderCategories() {
  const countResources =
    name =>
      allResources.filter(
        x =>
          String(
            x.category || ''
          ).toLowerCase() ===
          String(
            name || ''
          ).toLowerCase()
      );

  $('#resultCount')
    .textContent =
      `${categories.length} categories`;

  $('#list').innerHTML =
    `<div class="resource-grid">${categories.map(c => {
      const rs =
        countResources(
          c.name
        );

      const ch =
        rs.filter(
          x =>
            x.channelId ||
            x.type === 'channel'
        ).length;

      const pl =
        rs.filter(
          x =>
            x.playlistId ||
            x.type === 'playlist'
        ).length;

      return `<article class="group-card"><div class="group-icon">#</div><div><h3>${esc(c.name)}</h3><p>${esc(c.description || 'Category for YouTube learning resources.')}</p><span class="muted">${rs.length} resources · ${ch} channels · ${pl} playlists</span></div><div class="group-actions"><button data-cat-view="${esc(c.id)}">View</button><button data-cat-open="${esc(c.id)}">Open</button><button data-cat-edit="${esc(c.id)}">Edit</button><button data-cat-remove="${esc(c.id)}" class="danger">Remove</button></div></article>`;
    }).join('') || '<div class="empty">No categories yet.</div>'}</div>`;

  $$('[data-cat-view]')
    .forEach(b =>
      b.addEventListener(
        'click',
        () =>
          viewCategory(
            b.dataset.catView
          )
      )
    );

  $$('[data-cat-open]')
    .forEach(b =>
      b.addEventListener(
        'click',
        () =>
          viewCategory(
            b.dataset.catOpen
          )
      )
    );

  $$('[data-cat-edit]')
    .forEach(b =>
      b.addEventListener(
        'click',
        () =>
          editCategory(
            b.dataset.catEdit
          )
      )
    );

  $$('[data-cat-remove]')
    .forEach(b =>
      b.addEventListener(
        'click',
        () =>
          removeCategory(
            b.dataset.catRemove
          )
      )
    );
}

async function viewCategory(id) {
  const c =
    categories.find(
      x => x.id === id
    );

  if (!c) return;

  const resources =
    allResources.filter(
      x =>
        String(
          x.category || ''
        ).toLowerCase() ===
        String(
          c.name || ''
        ).toLowerCase()
    );

  const channels =
    resources.filter(
      x =>
        x.channelId ||
        (
          !x.playlistId &&
          x.type !== 'playlist'
        )
    );

  const playlists =
    resources.filter(
      x =>
        x.playlistId ||
        x.type === 'playlist'
    );

  $('#detailContent')
    .innerHTML =
      `<div class="detail-hero"><div class="group-icon large">#</div><div><span class="eyebrow">CATEGORY</span><h2>${esc(c.name)}</h2><p>${esc(c.description || '')}</p></div></div>` +
      `<div class="detail-grid"><div><b>Channels</b><span>${channels.length}</span></div><div><b>Playlists</b><span>${playlists.length}</span></div><div><b>Total</b><span>${resources.length}</span></div><div><b>Category ID</b><span>${esc(c.id || '—')}</span></div></div>` +
      `<div class="detail-notes"><b>Channels</b>${channels.map(x => `<div class="member-row"><span>◉ ${esc(cmjNameOf(x))}</span><button data-cat-resource="${esc(x.id)}">View</button></div>`).join('') || '<p class="muted">None</p>'}</div>` +
      `<div class="detail-notes"><b>Playlists</b>${playlists.map(x => `<div class="member-row"><span>▣ ${esc(cmjNameOf(x))}</span><button data-cat-resource="${esc(x.id)}">View</button></div>`).join('') || '<p class="muted">None</p>'}</div>`;

  $$('[data-cat-resource]')
    .forEach(b =>
      b.addEventListener(
        'click',
        () =>
          openDetail(
            b.dataset.catResource
          )
      )
    );

  $('#detailDialog')
    .showModal();
}

function renderSuggestions() {
  const box =
    $('#suggestionQuery');

  const type =
    $('#suggestionType')
      .value;

  chrome.storage.local
    .get(
      'cmjYoutubeSuggestions'
    )
    .then(s => {
      const data =
        s.cmjYoutubeSuggestions ||
        {
          channels: [],
          playlists: []
        };

      const list =
        type === 'channel'
          ? (
              data.channels ||
              []
            )
          : (
              data.playlists ||
              []
            );

      const q =
        (
          box.value ||
          ''
        )
          .trim()
          .toLowerCase();

      const filtered =
        list.filter(
          x =>
            !q ||
            [
              x.name,
              x.url
            ]
              .join(' ')
              .toLowerCase()
              .includes(q)
        );

      $('#resultCount')
        .textContent =
          `${filtered.length} ${
            type === 'channel'
              ? 'channel'
              : 'playlist'
          } suggestions`;

      $('#list').innerHTML =
        filtered.length
          ? `<div class="resource-grid">${filtered.map(x => `<article class="resource-card"><div class="thumb-wrap"><img class="thumb" src="${esc(x.thumbnail || '')}" data-suggestion-thumb><span class="type-badge">${type.toUpperCase()}</span></div><div class="card-body"><h3>${esc(x.name)}</h3><p class="muted">Suggestion — not yet saved to Favorites.</p><div class="group-actions"><button data-sug-view="${esc(x.id)}">View</button><button data-sug-open="${esc(x.url)}">Open</button><button data-sug-save="${esc(x.id)}">Save to Favorites</button><button data-sug-ignore="${esc(x.id)}">Ignore</button></div></div></article>`).join('')}</div>`
          : '<div class="empty"><h3>No suggestions</h3><p>Enter a search term and fetch YouTube suggestions.</p></div>';

      $$('[data-suggestion-thumb]')
        .forEach(img =>
          img.addEventListener(
            'error',
            () => {
              img.src =
                chrome.runtime.getURL(
                  'assets/charlie-mj-language-main-thumbnail.png'
                );

              img.classList.add(
                'fallback'
              );
            },
            { once: true }
          )
        );

      $$('[data-sug-open]')
        .forEach(b =>
          b.addEventListener(
            'click',
            () =>
              chrome.tabs.create({
                url:
                  b.dataset.sugOpen
              })
          )
        );

      $$('[data-sug-view]')
        .forEach(b =>
          b.addEventListener(
            'click',
            () => {
              const x =
                list.find(
                  v =>
                    v.id ===
                    b.dataset.sugView
                );

              if (!x) return;

              $('#detailContent')
                .innerHTML =
                  `<div class="detail-hero"><img src="${esc(x.thumbnail || '')}" alt=""><div><span class="eyebrow">${type.toUpperCase()} SUGGESTION</span><h2>${esc(x.name)}</h2><p>${esc(x.url)}</p></div></div>` +
                  `<div class="dialog-actions"><button type="button" data-suggestion-open>Open YouTube</button><button type="button" data-close>Close</button></div>`;

              $('#detailContent [data-suggestion-open]')
                .addEventListener(
                  'click',
                  () =>
                    chrome.tabs.create({
                      url:
                        x.url
                    })
                );

              $('#detailDialog')
                .showModal();
            }
          )
        );

      $$('[data-sug-save]')
        .forEach(b =>
          b.addEventListener(
            'click',
            async () => {
              const x =
                list.find(
                  v =>
                    v.id ===
                    b.dataset.sugSave
                );

              if (!x) return;

              const r =
                await send({
                  type:
                    'CMJ_FAVORITES',

                  action:
                    'add',

                  itemType:
                    type,

                  url:
                    x.url,

                  record: {
                    url:
                      x.url,

                    name:
                      x.name,

                    title:
                      type ===
                      'playlist'
                        ? x.name
                        : undefined,

                    thumbnail: {
                      url:
                        x.thumbnail
                    },

                    category:
                      ''
                  }
                });

              toast(
                r.ok
                  ? 'Saved to Favorites.'
                  : r.error,

                r.ok
                  ? 'success'
                  : 'error'
              );

              if (r.ok) {
                const key =
                  type === 'channel'
                    ? 'channels'
                    : 'playlists';

                data[key] =
                  list.filter(
                    v =>
                      v.id !==
                      x.id
                  );

                await chrome.storage.local
                  .set({
                    cmjYoutubeSuggestions:
                      data
                  });

                renderSuggestions();
              }
            }
          )
        );

      $$('[data-sug-ignore]')
        .forEach(b =>
          b.addEventListener(
            'click',
            async () => {
              const next =
                list.filter(
                  v =>
                    v.id !==
                    b.dataset.sugIgnore
                );

              data[
                type === 'channel'
                  ? 'channels'
                  : 'playlists'
              ] = next;

              await chrome.storage.local
                .set({
                  cmjYoutubeSuggestions:
                    data
                });

              renderSuggestions();
            }
          )
        );
    });
}

async function viewGroup(id) {
  const g =
    groups.find(
      x => x.id === id
    );

  if (!g) return;

  const [
    cr,
    pr
  ] = await Promise.all([
    send({
      type:
        'CMJ_FAVORITES',

      action:
        'list',

      itemType:
        'channel'
    }),

    send({
      type:
        'CMJ_FAVORITES',

      action:
        'list',

      itemType:
        'playlist'
    })
  ]);

  const channels =
    cr.result || [];

  const playlists =
    pr.result || [];

  const members = [
    ...(g.channels || [])
      .map(id => ({
        id,
        type:
          'channel',
        item:
          channels.find(
            x => x.id === id
          )
      })),

    ...(g.playlists || [])
      .map(id => ({
        id,
        type:
          'playlist',
        item:
          playlists.find(
            x => x.id === id
          )
      }))
  ];

  $('#detailContent')
    .innerHTML =
      `<div class="detail-hero"><div class="group-icon large">▦</div><div><span class="eyebrow">LEARNING GROUP</span><h2>${esc(g.name)}</h2><p>${esc(g.description || '')}</p></div></div>` +
      `<div class="detail-notes"><b>Tags</b><p>${esc((g.tags || []).join(', ') || 'None')}</p></div>` +
      `<div class="detail-notes"><b>Members</b><div class="group-member-list" id="groupMemberList">${members.map(m => `<div class="member-row"><span>${m.type === 'channel' ? '◉' : '▣'} ${esc((m.item && cmjNameOf(m.item)) || m.id)}</span><button data-member-remove="${esc(m.id)}" data-member-type="${m.type}">Remove</button></div>`).join('') || '<span class="muted">No resources in this group.</span>'}</div></div>` +
      `<div class="dialog-actions"><button type="button" id="detailEditGroup">Edit Group</button><button type="button" class="danger" id="detailRemoveGroup">Remove Group</button><button type="button" data-close>Close</button></div>`;

  $('#detailEditGroup')
    .addEventListener(
      'click',
      () => {
        $('#detailDialog')
          .close();

        editGroup(g.id);
      }
    );

  $('#detailRemoveGroup')
    .addEventListener(
      'click',
      () => {
        $('#detailDialog')
          .close();

        removeGroup(g.id);
      }
    );

  $$('[data-member-remove]')
    .forEach(b =>
      b.addEventListener(
        'click',
        async () => {
          const copy =
            { ...g };

          const key =
            b.dataset.memberType ===
            'channel'
              ? 'channels'
              : 'playlists';

          copy[key] =
            (
              copy[key] ||
              []
            ).filter(
              x =>
                x !==
                b.dataset.memberRemove
            );

          await send({
            type:
              'CMJ_FAVORITES',

            action:
              'setCollections',

            data:
              groups.map(
                x =>
                  x.id === g.id
                    ? copy
                    : x
              )
          });

          toast(
            'Removed from Learning Group.',
            'success'
          );

          $('#detailDialog')
            .close();

          load();
        }
      )
    );

  $('#detailDialog')
    .showModal();
}

function editGroup(id) {
  const g =
    groups.find(
      x => x.id === id
    );

  if (!g) return;

  editingId = id;

  $('#groupName')
    .value =
      g.name || '';

  $('#groupDescription')
    .value =
      g.description || '';

  $('#groupTags')
    .value =
      (g.tags || [])
        .join(', ');

  $('#groupDialog')
    .showModal();
}

async function saveGroup() {
  const existing =
    groups.find(
      x => x.id === editingId
    );

  const g = {
    ...(existing || {
      id:
        'group_' +
        Date.now(),

      channels: [],

      playlists: [],

      createdAt:
        new Date()
          .toISOString()
    }),

    name:
      $('#groupName')
        .value
        .trim(),

    description:
      $('#groupDescription')
        .value
        .trim(),

    tags:
      $('#groupTags')
        .value
        .split(',')
        .map(
          s => s.trim()
        )
        .filter(Boolean)
  };

  if (!g.name) return;

  await send({
    type:
      'CMJ_FAVORITES',

    action:
      'setCollections',

    data:
      existing
        ? groups.map(
            x =>
              x.id === g.id
                ? g
                : x
          )
        : [g, ...groups]
  });

  $('#groupDialog')
    .close();

  toast(
    'Learning Group saved.',
    'success'
  );

  load();
}

async function removeGroup(id) {
  if (
    !confirm(
      'Remove this Learning Group? Saved channels/playlists will not be removed.'
    )
  ) {
    return;
  }

  await send({
    type:
      'CMJ_FAVORITES',

    action:
      'setCollections',

    data:
      groups.filter(
        g =>
          g.id !== id
      )
  });

  toast(
    'Learning Group removed.',
    'success'
  );

  load();
}

function editCategory(id) {
  const c =
    categories.find(
      x => x.id === id
    );

  if (!c) return;

  editingId = id;

  $('#categoryName')
    .value =
      c.name || '';

  $('#categoryDescription')
    .value =
      c.description || '';

  $('#categoryDialog')
    .showModal();
}

async function saveCategory() {
  const name =
    $('#categoryName')
      .value
      .trim();

  if (!name) return;

  const existing =
    categories.find(
      x =>
        x.id === editingId
    );

  const c = {
    ...(existing || {
      id:
        'cat_' +
        Date.now()
    }),

    name,

    description:
      $('#categoryDescription')
        .value
        .trim()
  };

  const next =
    existing
      ? categories.map(
          x =>
            x.id === c.id
              ? c
              : x
        )
      : [
          c,
          ...categories
        ];

  await send({
    type:
      'CMJ_FAVORITES',

    action:
      'setCategories',

    data:
      next
  });

  $('#categoryDialog')
    .close();

  toast(
    'Category saved.',
    'success'
  );

  load();
}

async function removeCategory(id) {
  const c =
    categories.find(
      x =>
        x.id === id
    );

  if (!c) return;

  if (
    !confirm(
      `Remove category “${c.name}”? Resources will remain saved.`
    )
  ) {
    return;
  }

  await send({
    type:
      'CMJ_FAVORITES',

    action:
      'setCategories',

    data:
      categories.filter(
        x =>
          x.id !== id
      )
  });

  toast(
    'Category removed.',
    'success'
  );

  load();
}

function openAdd() {
  editingId = null;

  $('#addForm')
    .reset();

  $('#addDialog')
    .showModal();
}

async function addResource() {
  const url =
    $('#addUrl')
      .value
      .trim();

  const type =
    /[?&]list=|\/playlist\?/
      .test(url)
      ? 'playlist'
      : 'channel';

  const category =
    $('#addCategory')
      .value
      .trim();

  const r =
    await send({
      type:
        'CMJ_FAVORITES',

      action:
        'add',

      itemType:
        type,

      url,

      record: {
        url,

        category,

        tags:
          $('#addTags')
            .value
            .split(',')
            .map(
              s => s.trim()
            )
            .filter(Boolean),

        notes:
          $('#addNotes')
            .value
      }
    });

  if (!r.ok) {
    toast(
      r.error,
      'error'
    );

    return;
  }

  $('#addDialog')
    .close();

  tab =
    type === 'channel'
      ? 'channels'
      : 'playlists';

  syncTabs();

  toast(
    'YouTube resource added successfully.',
    'success'
  );

  if (
    r.result &&
    typeof r.result === 'object' &&
    !cmjNameOf(r.result)
  ) {
    const t = await fetchYouTubeTitle(url);

    if (t) {
      await send({
        type: 'CMJ_FAVORITES',
        action: 'update',
        itemType: type,
        record: {
          ...r.result,
          name: t,
          title: type === 'playlist' ? t : r.result.title
        }
      });
    }
  }

  if (
    r.result
      ?.categorySuggestion
      ?.suggestedName &&
    !category
  ) {
    showCategorySuggestion(
      r.result,
      type
    );
  }

  load();
}

function showCategorySuggestion(
  record,
  type
) {
  const s =
    record.categorySuggestion;

  if (!s?.suggestedName)
    return;

  const box =
    document.createElement(
      'dialog'
    );

  box.innerHTML =
    `<form method="dialog" class="dialog-form"><button class="close" type="button" data-close-suggestion>×</button><span class="eyebrow">EXTENSION INTELLIGENCE</span><h2>Category suggestion</h2><p>Suggested new category: <strong>${esc(s.suggestedName)}</strong></p><p class="form-note">Confidence: ${Math.round((s.confidence || 0) * 100)}%. Existing categories were checked first.</p><div class="dialog-actions"><button type="button" data-close-suggestion>Keep Uncategorized</button><button type="button" class="primary" id="acceptSuggestedCategory">Create & Apply</button></div></form>`;

  document.body.appendChild(
    box
  );

  box
    .querySelectorAll(
      '[data-close-suggestion]'
    )
    .forEach(b =>
      b.addEventListener(
        'click',
        () => {
          box.close();
          box.remove();
        }
      )
    );

  box
    .querySelector(
      '#acceptSuggestedCategory'
    )
    .addEventListener(
      'click',
      async () => {
        const next = [
          ...categories,
          {
            id:
              'cat_' +
              Date.now(),

            name:
              s.suggestedName,

            description:
              'Created from Extension Intelligence suggestion'
          }
        ];

        const c =
          await send({
            type:
              'CMJ_FAVORITES',

            action:
              'setCategories',

            data:
              next
          });

        const x =
          allResources.find(
            v =>
              v.id ===
              record.id
          );

        if (x) {
          await send({
            type:
              'CMJ_FAVORITES',

            action:
              'update',

            itemType:
              type,

            record: {
              ...x,
              category:
                s.suggestedName
            }
          });
        }

        toast(
          c.ok
            ? 'New category created and applied.'
            : c.error,
          c.ok
            ? 'success'
            : 'error'
        );

        box.close();
        box.remove();

        load();
      }
    );

  box.showModal();
}

function syncTabs() {
  $$('.side-tab')
    .forEach(b =>
      b.classList.toggle(
        'active',
        b.dataset.tab === tab
      )
    );

  const sug =
    tab ===
    'suggestions';

  $('#search')
    .disabled =
      tab ===
        'categories' ||
      sug;

  $('#categoryFilter')
    .disabled =
      tab ===
        'categories' ||
      sug;

  $('#suggestionQuery')
    .hidden =
      !sug;

  $('#suggestionType')
    .hidden =
      !sug;

  $('#fetchSuggestions')
    .hidden =
      !sug;
}

function openSearchSuggestions() {
  const q =
    $('#search')
      .value
      .trim()
      .toLowerCase();

  const box =
    $('#suggestions');

  if (!q) {
    box.hidden =
      true;

    return;
  }

  const vals =
    new Set();

  [
    ...allResources,
    ...categories
  ].forEach(
    x =>
      [
        cmjTextOf(x.name),
        cmjTextOf(x.title),
        x.category,
        ...(x.tags || [])
      ].forEach(v => {
        if (
          v &&
          String(v)
            .toLowerCase()
            .includes(q)
        ) {
          vals.add(
            String(v)
          );
        }
      })
  );

  box.innerHTML =
    [...vals]
      .slice(0, 8)
      .map(
        v =>
          `<button data-suggest="${esc(v)}">${esc(v)}</button>`
      )
      .join('');

  box.hidden =
    !vals.size;

  $$('[data-suggest]')
    .forEach(b =>
      b.addEventListener(
        'click',
        () => {
          $('#search')
            .value =
              b.dataset.suggest;

          box.hidden =
            true;

          render();
        }
      )
    );
}

$('#add')
  .addEventListener(
    'click',
    openAdd
  );

$('#search')
  .addEventListener(
    'input',
    () => {
      openSearchSuggestions();
      render();
    }
  );

$('#categoryFilter')
  .addEventListener(
    'change',
    render
  );

$('#refresh')
  .addEventListener(
    'click',
    load
  );

$('#settings')
  .addEventListener(
    'click',
    () =>
      chrome.runtime
        .openOptionsPage()
  );

$('#openLibrary')
  .addEventListener(
    'click',
    () =>
      chrome.tabs.create({
        url:
          chrome.runtime.getURL(
            'src/dashboard/dashboard.html'
          )
      })
  );

$$('.side-tab')
  .forEach(b =>
    b.addEventListener(
      'click',
      () => {
        tab =
          b.dataset.tab;

        syncTabs();
        load();
      }
    )
  );

$('#suggestionQuery')
  .addEventListener(
    'input',
    renderSuggestions
  );

$('#suggestionType')
  .addEventListener(
    'change',
    renderSuggestions
  );

$('#fetchSuggestions')
  .addEventListener(
    'click',
    async () => {
      const query =
        $('#suggestionQuery')
          .value
          .trim();

      const type =
        $('#suggestionType')
          .value;

      if (!query) {
        toast(
          'Enter a YouTube suggestion search term.',
          'error'
        );

        return;
      }

      const r =
        await send({
          type:
            'CMJ_YOUTUBE_SUGGESTIONS',

          query,

          itemType:
            type
        });

      toast(
        r.ok
          ? `Fetched ${r.result.length} ${type} suggestions.`
          : r.error,

        r.ok
          ? 'success'
          : 'error'
      );

      if (r.ok) {
        renderSuggestions();
      }
    }
  );

$('#addForm')
  .addEventListener(
    'submit',
    e => {
      e.preventDefault();
      addResource();
    }
  );

$('#editForm')
  .addEventListener(
    'submit',
    e => {
      e.preventDefault();
      saveEdit();
    }
  );

$('#groupForm')
  .addEventListener(
    'submit',
    e => {
      e.preventDefault();
      saveGroup();
    }
  );

$('#categoryForm')
  .addEventListener(
    'submit',
    e => {
      e.preventDefault();
      saveCategory();
    }
  );

$$('[data-close]')
  .forEach(b =>
    b.addEventListener(
      'click',
      () =>
        b.closest(
          'dialog'
        ).close()
    )
  );

$('#newGroup')
  .addEventListener(
    'click',
    () => {
      editingId = null;

      $('#groupForm')
        .reset();

      $('#groupDialog')
        .showModal();
    }
  );

$('#newCategory')
  .addEventListener(
    'click',
    () => {
      editingId = null;

      $('#categoryForm')
        .reset();

      $('#categoryDialog')
        .showModal();
    }
  );

$('#backup')
  .addEventListener(
    'click',
    async () => {
      const r =
        await send({
          type:
            'CMJ_FAVORITES',

          action:
            'export'
        });

      download(
        'charlie-mj-youtube-favorites.json',
        JSON.stringify(
          r.result,
          null,
          2
        ),
        'application/json'
      );
    }
  );

$('#restore')
  .addEventListener(
    'click',
    () =>
      $('#file').click()
  );

$('#file')
  .addEventListener(
    'change',
    async e => {
      const f =
        e.target.files[0];

      if (!f) return;

      try {
        const data =
          JSON.parse(
            await f.text()
          );

        const mode =
          confirm(
            'Merge backup with existing favorites? Cancel = replace.'
          )
            ? 'merge'
            : 'replace';

        const r =
          await send({
            type:
              'CMJ_FAVORITES',

            action:
              'import',

            data,

            mode
          });

        if (!r.ok) {
          throw Error(
            r.error
          );
        }

        toast(
          'Backup restored.',
          'success'
        );

        load();
      } catch (err) {
        toast(
          err.message,
          'error'
        );
      }

      e.target.value =
        '';
    }
  );

$('#txt')
  .addEventListener(
    'click',
    async () => {
      const r =
        await send({
          type:
            'CMJ_FAVORITES',

          action:
            'txt'
        });

      download(
        'charlie-mj-youtube-favorites.txt',
        r.result.text,
        'text/plain'
      );
    }
  );

function download(
  name,
  text,
  mime
) {
  const a =
    document.createElement(
      'a'
    );

  a.href =
    URL.createObjectURL(
      new Blob(
        [text],
        {
          type: mime
        }
      )
    );

  a.download =
    name;

  document.body.appendChild(
    a
  );

  a.click();

  a.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(
        a.href
      ),
    1000
  );
}

syncTabs();
load();