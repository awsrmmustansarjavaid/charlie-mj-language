/**
 * Charlie MJ Language Library controller.
 *
 * The library is intentionally local-first. Every saved learning record keeps
 * its YouTube video identity so material from multiple videos never becomes
 * anonymous. Main collections support copy, download, export and import; user
 * collections are stored as separate local datasets and can be created/deleted.
 */
(() => {
  'use strict';

  const BUILTIN = [
    { id: 'watchLater', name: 'Watch Later', key: 'watchLater' },
    { id: 'vocabulary', name: 'Vocabulary', key: 'vocabulary' },
    { id: 'bookmarks', name: 'Bookmarks', key: 'bookmarks' }
  ];
  let pages = [];
  let current = 'watchLater';
  let data = [];
  let pendingDelete = null;

  const $ = selector => document.querySelector(selector);
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  const safeName = value => String(value || 'library').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 100) || 'library';

  init().catch(error => console.error('Charlie MJ Library failed to start:', error));

  async function init() {
    $('#openOptions').onclick = () => chrome.runtime.openOptionsPage();
    $('#refresh').onclick = load;
    $('#addPage').onclick = () => { $('#pageName').value = ''; $('#pageTags').value = ''; $('#pageDialog').showModal(); };
    $('#copyPage').onclick = copyCurrentPage;
    $('#downloadPage').onclick = openDownloadDialog;
    $('#exportPage').onclick = openExportDialog;
    $('#importPage').onclick = () => $('#importFile').click();
    $('#importFile').addEventListener('change', importCurrentPage);
    $('#search').oninput = render;
    $('#levelFilter').onchange = render;
    $('#tagFilter').oninput = render;
    $('#videoFilter').onchange = render;
    $('#typeFilter').onchange = render;
    $('#pageForm').addEventListener('submit', createPage);
    $('#confirmYes').onclick = confirmDelete;
    $('#pagePickerForm').addEventListener('submit', submitPagePicker);
    $('#exportForm').addEventListener('submit', submitExport);
    document.addEventListener('click', event => {
      const tab = event.target.closest('[data-page-id]');
      if (tab) { current = tab.dataset.pageId; load(); }
      const del = event.target.closest('[data-delete-page]');
      if (del) askDeletePage(del.dataset.deletePage);
      const remove = event.target.closest('[data-remove-item]');
      if (remove) removeItem(remove.dataset.removeItem, remove.dataset.itemId);
      const add = event.target.closest('[data-add-custom]');
      if (add) openPagePicker(add.dataset.itemId, add.dataset.itemSource);
      const copy = event.target.closest('[data-copy-item]');
      if (copy) copyItem(copy.dataset.copyItem);
      if (event.target.matches('[data-close]')) event.target.closest('dialog')?.close();
    });
    await loadPages();
    await load();
  }

  async function loadPages() {
    const stored = await chrome.storage.local.get('libraryPages');
    pages = Array.isArray(stored.libraryPages) ? stored.libraryPages : [];
    renderNav();
  }

  function allPages() { return [...BUILTIN, ...pages.map(p => ({ id: `custom:${p.id}`, name: p.name, key: `libraryPage_${p.id}`, custom: true, rawId: p.id }))]; }
  function pageInfo(id = current) { return allPages().find(p => p.id === id) || BUILTIN[0]; }

  function renderNav() {
    $('#libraryNav').innerHTML = allPages().map(page => `
      <div class="library-tab-wrap">
        <button class="library-tab ${page.id === current ? 'active' : ''}" data-page-id="${escapeHTML(page.id)}">${escapeHTML(page.name)} <span class="count" data-count-for="${escapeHTML(page.id)}"></span></button>
        ${page.custom ? `<button class="icon-btn page-delete" data-delete-page="${escapeHTML(page.rawId)}" title="Delete custom page">×</button>` : ''}
      </div>`).join('');
  }

  async function getPageData(page) {
    const stored = await chrome.storage.local.get(page.key);
    return Array.isArray(stored[page.key]) ? stored[page.key] : [];
  }

  async function load() {
    await loadPages();
    const info = pageInfo();
    data = await getPageData(info);
    render();
  }

  function render() {
    const info = pageInfo();
    const query = $('#search').value.trim().toLowerCase();
    const level = $('#levelFilter').value;
    const tag = $('#tagFilter').value.trim().toLowerCase();
    const videoId = $('#videoFilter').value;
    const type = $('#typeFilter').value;
    const filtered = data.filter(item => {
      const haystack = JSON.stringify(item).toLowerCase();
      const levels = String(item.level || '').toUpperCase();
      const tags = (item.tags || []).map(String).join(' ').toLowerCase();
      return (!query || haystack.includes(query)) && (!level || levels === level) && (!tag || tags.includes(tag)) && (!videoId || item.videoId === videoId) && (!type || (item.type || 'word') === type);
    });

    $('#levelFilter').disabled = !['vocabulary', 'bookmarks'].includes(info.key) && !info.custom;
    $('#typeFilter').disabled = info.key !== 'vocabulary';
    renderNav();
    renderVideoFilter();
    renderStats(filtered, info);
    $('#items').innerHTML = filtered.length ? filtered.map(item => card(item, info)).join('') : `<div class="empty"><h3>No items here yet</h3><p>${escapeHTML(info.name)} is ready for your next learning session.</p></div>`;
  }

  function renderVideoFilter() {
    const selected = $('#videoFilter').value;
    const videos = new Map();
    data.forEach(item => { if (item.videoId) videos.set(item.videoId, item.videoTitle || item.title || item.videoId); });
    $('#videoFilter').innerHTML = `<option value="">All videos</option>${[...videos.entries()].map(([id,title]) => `<option value="${escapeHTML(id)}">${escapeHTML(title)}</option>`).join('')}`;
    if ([...videos.keys()].includes(selected)) $('#videoFilter').value = selected;
  }

  function renderStats(items, info) {
    const videos = new Set(items.map(x => x.videoId).filter(Boolean));
    const tags = new Set(items.flatMap(x => x.tags || []).filter(Boolean));
    const levels = new Set(items.map(x => x.level).filter(Boolean));
    $('#stats').innerHTML = [
      ['Items', items.length, info.name],
      ['Videos', videos.size, 'linked YouTube videos'],
      ['Tags', tags.size, 'active tags'],
      ['Levels', levels.size, 'CEFR levels present']
    ].map(([a,b,c]) => `<div class="stat"><strong>${b}</strong><span>${a} · ${escapeHTML(c)}</span></div>`).join('');
    document.querySelectorAll('[data-count-for]').forEach(el => {
      const page = pageInfo(el.dataset.countFor);
      getPageData(page).then(items => { el.textContent = items.length ? `(${items.length})` : ''; }).catch(() => {});
    });
  }

  function card(item, info) {
    const title = item.videoTitle || item.title || item.word || item.label || 'Saved learning item';
    const subtitle = item.word ? `${item.word}${item.translation ? ` — ${item.translation}` : ''}` : (item.subtitle || item.sentence || item.label || '');
    const time = item.timestamp != null ? formatTime(item.timestamp) : '';
    const tags = (item.tags || []).map(tag => `<span class="tag">#${escapeHTML(tag)}</span>`).join('');
    const thumb = item.thumbnail || (item.videoId ? `https://i.ytimg.com/vi/${encodeURIComponent(item.videoId)}/hqdefault.jpg` : '');
    const source = item.source || info.name;
    return `<article class="item-card">
      ${thumb ? `<img class="thumb" src="${escapeHTML(thumb)}" alt="Video thumbnail" loading="lazy">` : ''}
      <div class="item-body"><h3 class="item-title">${item.url ? `<a href="${escapeHTML(withTimestamp(item.url, item.timestamp))}" target="_blank" rel="noopener">${escapeHTML(title)}</a>` : escapeHTML(title)}</h3>
      <p class="item-meta"><strong>${escapeHTML(subtitle)}</strong></p>
      <p class="item-context">${escapeHTML(source)}${time ? ` · ${time}` : ''}${item.pos ? ` · ${escapeHTML(item.pos)}` : ''}${item.level ? ` · ${escapeHTML(item.level)} ${escapeHTML(item.levelLabel || '')}` : ''}</p>
      ${item.sentence ? `<p class="item-context">${escapeHTML(item.sentence)}</p>` : ''}
      <div>${tags}</div>
      <div class="item-actions"><button data-remove-item="${escapeHTML(info.id)}" data-item-id="${escapeHTML(item.id || '')}">🗑 Remove</button>${item.url ? `<button data-copy-item="${escapeHTML(item.id || '')}">📋 Copy</button>` : ''}${pages.length ? `<button data-add-custom="menu" data-item-id="${escapeHTML(item.id || '')}" data-item-source="${escapeHTML(info.key)}">＋ Add to page</button>` : ''}</div></div></article>`;
  }

  function withTimestamp(url, timestamp) {
    if (!timestamp) return url;
    try { const u = new URL(url); u.searchParams.set('t', `${Math.floor(timestamp)}s`); return u.toString(); } catch { return url; }
  }

  async function copyCurrentPage() {
    const text = buildReadableText(data, pageInfo());
    try { await navigator.clipboard.writeText(text); notify('Current library page copied.'); } catch { notify('Clipboard permission was blocked.'); }
  }

  async function downloadSelected(ids) {
    const selected = ids.map(id => pageInfo(id));
    const bundles = [];
    for (const page of selected) bundles.push({ page, items: await getPageData(page) });
    const text = buildReadableBundle(bundles);
    const settings = await getSettings();
    const first = safeName(selected.map(p => p.name).join('-'));
    await downloadText(`${settings.downloadRoot}/Library/${first}.txt`, text, 'text/plain');
    notify('Library download started in your Downloads folder.');
  }

  async function openExportDialog() {
    const choices = allPages().map(page => `<label class="choice"><input type="checkbox" value="${escapeHTML(page.id)}" ${page.id === current ? 'checked' : ''}> ${escapeHTML(page.name)}</label>`).join('');
    $('#exportChoices').innerHTML = choices;
    $('#exportTitle').textContent = 'Export library data';
    $('#exportFormat').disabled = false;
    $('#exportDialog').showModal();
  }

  async function openDownloadDialog() {
    const choices = allPages().map(page => `<label class="choice"><input type="checkbox" value="${escapeHTML(page.id)}" ${page.id === current ? 'checked' : ''}> ${escapeHTML(page.name)}</label>`).join('');
    $('#exportChoices').innerHTML = choices;
    $('#exportTitle').textContent = 'Download selected library pages';
    $('#exportFormat').value = 'txt';
    $('#exportFormat').disabled = true;
    $('#exportDialog').showModal();
  }

  async function submitExport(event) {
    event.preventDefault();
    const ids = [...$('#exportChoices').querySelectorAll('input:checked')].map(input => input.value);
    if (!ids.length) return notify('Select at least one library page.');
    const bundles = [];
    for (const id of ids) { const page = pageInfo(id); bundles.push({ page, items: await getPageData(page) }); }
    const format = $('#exportFormat').value;
    const settings = await getSettings();
    const name = safeName(bundles.map(x => x.page.name).join('-'));
    let payload = buildReadableBundle(bundles), mime = 'text/plain', ext = 'txt';
    if (format === 'json') { payload = JSON.stringify({ program: 'Charlie MJ Language', exportedAt: new Date().toISOString(), pages: bundles.map(x => ({ id: x.page.id, name: x.page.name, items: x.items })) }, null, 2); mime = 'application/json'; ext = 'json'; }
    if (format === 'csv') { payload = buildCSV(bundles.flatMap(x => x.items.map(item => ({ page: x.page.name, ...item })))); mime = 'text/csv'; ext = 'csv'; }
    if (format === 'srt' || format === 'vtt') {
      const source = bundles.flatMap(x => x.items).filter(item => item.sentence || item.subtitle);
      const cueTime = seconds => { const ms = Math.max(0, Math.round((Number(seconds) || 0) * 1000)); const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); const sec = Math.floor((ms % 60000) / 1000); const milli = ms % 1000; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}${format === 'srt' ? ',' : '.'}${String(milli).padStart(3,'0')}`; };
      const rows = source.map((item,i) => { const start = Number(item.timestamp) || 0; const end = start + Math.max(1, Number(item.duration) || 2); return `${format === 'srt' ? `${i+1}\n` : ''}${cueTime(start)} --> ${cueTime(end)}\n${item.sentence || item.subtitle || ''}${item.translation ? `\n${item.translation}` : ''}`; }).join('\n\n');
      payload = format === 'vtt' ? `WEBVTT\n\n${rows}` : rows; mime = 'text/plain'; ext = format;
    }
    if (format === 'anki') { payload = bundles.flatMap(x=>x.items).map(item=>`${String(item.word||item.sentence||'').replaceAll('\t',' ')}\t${String(item.translation||item.sentenceTranslation||'').replaceAll('\t',' ')}\t${String(item.sentence||'').replaceAll('\t',' ')}`).join('\n'); mime='text/tab-separated-values'; ext='txt'; }
    await downloadText(`${settings.downloadRoot}/Exports/${name}.${ext}`, payload, mime);
    $('#exportDialog').close(); notify('Selected library pages exported.');
  }

  async function importCurrentPage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      let imported;
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        imported = Array.isArray(parsed) ? parsed : parsed.items || parsed.pages?.flatMap(page => page.items || []) || [];
      } else imported = parseCSV(text);
      const info = pageInfo();
      const existing = await getPageData(info);
      const merged = dedupe(existing.concat(imported));
      await chrome.storage.local.set({ [info.key]: merged });
      await load();
      notify(`${imported.length} item(s) imported into ${info.name}.`);
    } catch (error) { notify(`Import failed: ${error.message}`); }
  }

  async function createPage(event) {
    event.preventDefault();
    const name = $('#pageName').value.trim();
    if (!name) return;
    const page = { id: crypto.randomUUID(), name, tags: $('#pageTags').value.split(',').map(x => x.trim()).filter(Boolean), createdAt: new Date().toISOString() };
    pages.push(page);
    await chrome.storage.local.set({ libraryPages: pages, [`libraryPage_${page.id}`]: [] });
    $('#pageDialog').close(); current = `custom:${page.id}`; await load(); notify(`Created ${name}.`);
  }

  function askDeletePage(id) {
    const page = pages.find(p => p.id === id);
    if (!page) return;
    pendingDelete = page;
    $('#confirmTitle').textContent = 'Delete custom library page?';
    $('#confirmText').textContent = `Delete “${page.name}” and its saved items? This cannot be undone.`;
    $('#confirmDialog').showModal();
  }

  async function confirmDelete(event) {
    event.preventDefault();
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    pages = pages.filter(page => page.id !== id);
    await chrome.storage.local.set({ libraryPages: pages });
    await chrome.storage.local.remove(`libraryPage_${id}`);
    current = 'watchLater'; pendingDelete = null; $('#confirmDialog').close(); await load(); notify('Custom library page deleted.');
  }

  function openPagePicker(itemId, sourceKey) {
    if (!pages.length) return notify('Create a custom library page first.');
    $('#pickerItemId').value = itemId || '';
    $('#pickerSource').value = sourceKey || '';
    $('#pagePickerSelect').innerHTML = pages.map(page => `<option value="${escapeHTML(page.id)}">${escapeHTML(page.name)}</option>`).join('');
    $('#pagePickerDialog').showModal();
  }

  async function submitPagePicker(event) {
    event.preventDefault();
    const page = pages.find(item => item.id === $('#pagePickerSelect').value);
    if (!page) return;
    const sourceKey = $('#pickerSource').value;
    const source = BUILTIN.find(x => x.key === sourceKey) || pages.map(x => ({ key: `libraryPage_${x.id}` })).find(x => x.key === sourceKey);
    if (!source) return notify('Source library page was not found.');
    const sourceItems = await getPageData(source);
    const item = sourceItems.find(x => x.id === $('#pickerItemId').value);
    if (!item) return notify('The learning item was not found.');
    const key = `libraryPage_${page.id}`;
    const target = await getPageData({ key });
    if (!target.some(x => x.id === item.id)) target.unshift({ ...item, librarySource: page.name, copiedAt: new Date().toISOString() });
    await chrome.storage.local.set({ [key]: target });
    $('#pagePickerDialog').close();
    notify(`Added to ${page.name}.`);
  }

  async function copyItem(itemId) {
    const item = data.find(entry => entry.id === itemId);
    if (!item) return;
    try { await navigator.clipboard.writeText(buildReadableText([item], pageInfo())); notify('Item copied.'); } catch { notify('Clipboard permission was blocked.'); }
  }

  async function removeItem(pageId, itemId) {
    const page = pageInfo(pageId);
    if (!itemId) return notify('This record has no removable ID.');
    const items = await getPageData(page);
    await chrome.storage.local.set({ [page.key]: items.filter(item => item.id !== itemId) });
    await load();
  }

  function buildReadableBundle(bundles) {
    return bundles.map(bundle => buildReadableText(bundle.items, bundle.page)).join('\n\n' + '='.repeat(78) + '\n\n');
  }

  function buildReadableText(items, page) {
    const lines = [`Charlie MJ Language`, `Library: ${page.name}`, `Exported: ${new Date().toLocaleString()}`, '', `Total items: ${items.length}`, ''];
    const byVideo = groupByVideo(items);
    for (const [videoId, videoItems] of byVideo) {
      const first = videoItems[0];
      lines.push(`VIDEO: ${first.videoTitle || first.title || videoId || 'Unlinked item'}`);
      if (first.url) lines.push(`URL: ${first.url}`);
      if (videoId) lines.push(`Video ID: ${videoId}`);
      lines.push('');
      videoItems.forEach((item, index) => {
        const name = item.word || item.title || item.label || `Item ${index + 1}`;
        lines.push(`• ${name}`);
        if (item.translation) lines.push(`  Translation: ${item.translation}`);
        if (item.sentence) lines.push(`  Sentence: ${item.sentence}`);
        if (item.sentenceTranslation) lines.push(`  Sentence translation: ${item.sentenceTranslation}`);
        if (item.subtitle) lines.push(`  Subtitle: ${item.subtitle}`);
        if (item.timestamp != null) lines.push(`  Timestamp: ${formatTime(item.timestamp)}`);
        if (item.level) lines.push(`  CEFR: ${item.level} — ${item.levelLabel || ''}`);
        if (item.pos) lines.push(`  Part of speech: ${item.pos}`);
        if (item.tags?.length) lines.push(`  Tags: ${item.tags.join(', ')}`);
        lines.push('');
      });
    }
    return lines.join('\n');
  }

  function groupByVideo(items) {
    const map = new Map();
    items.forEach(item => { const key = item.videoId || `unlinked:${item.id}`; if (!map.has(key)) map.set(key, []); map.get(key).push(item); });
    return map;
  }

  function buildCSV(items) {
    const keys = [...new Set(items.flatMap(item => Object.keys(item)))];
    return [keys.join(','), ...items.map(item => keys.map(key => csv(Array.isArray(item[key]) ? item[key].join('|') : item[key])).join(','))].join('\n');
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = splitCSV(lines[0]);
    return lines.slice(1).map(line => { const values = splitCSV(line); const item = {}; headers.forEach((h,i) => { item[h] = values[i] || ''; }); item.id = item.id || crypto.randomUUID(); item.tags = String(item.tags || '').split('|').map(x => x.trim()).filter(Boolean); if (item.timestamp) item.timestamp = Number(item.timestamp); return item; });
  }
  function splitCSV(line) { const out=[]; let cur='', quote=false; for(let i=0;i<line.length;i++){const c=line[i]; if(c==='"' && line[i+1]==='"'){cur+='"';i++;continue} if(c==='"'){quote=!quote;continue} if(c===','&&!quote){out.push(cur);cur='';continue} cur+=c} out.push(cur); return out; }
  function dedupe(items) { const map = new Map(); items.forEach(item => map.set(item.id || `${item.videoId}:${item.word}:${item.timestamp}`, item)); return [...map.values()]; }
  function csv(value) { return `"${String(value ?? '').replaceAll('"','""')}"`; }
  function formatTime(seconds) { const total=Math.max(0,Math.floor(Number(seconds)||0)); const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }

  async function getSettings() { const { settings={} } = await chrome.storage.local.get('settings'); return { downloadRoot: 'Charlie MJ Language', ...settings }; }
  async function downloadText(filename, text, mime) { const url=URL.createObjectURL(new Blob([text],{type:`${mime};charset=utf-8`})); try { await chrome.downloads.download({ url, filename, saveAs:false }); } finally { setTimeout(()=>URL.revokeObjectURL(url),15000); } }
  function notify(message) { let el=$('#libraryNotice'); if(!el){el=document.createElement('div');el.id='libraryNotice';el.style.cssText='position:fixed;right:18px;bottom:18px;z-index:99;padding:12px 15px;border:1px solid #ffffff18;border-radius:11px;background:#0b1425;color:#fff;box-shadow:0 15px 45px #0008';document.body.appendChild(el)} el.textContent=message; clearTimeout(notify.timer); notify.timer=setTimeout(()=>el.remove(),3000); }
})();
