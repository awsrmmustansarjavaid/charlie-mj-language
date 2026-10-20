/**
 * Independent Favorites storage. Namespaced so existing library storage is untouched.
 */
const KEYS = { channels: 'cmjFavChannels', playlists: 'cmjFavPlaylists', categories: 'cmjFavCategories', collections: 'cmjFavCollections' };
const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`;
async function get(key) {
  const s = await chrome.storage.local.get(key);
  return Array.isArray(s[key]) ? s[key] : []
}
async function set(key, value) {
  await chrome.storage.local.set({ [key]: value });
  return value
}
function unique(list, key) {
  const seen = new Set();
  return list.filter(x => {
    const v = String(x?.[key] || '').toLowerCase();
    if (!v || seen.has(v)) return false;
    seen.add(v);
    return true
  })
}
export async function listFavorites(type) {
  return get(type === 'playlist' ? 'cmjFavPlaylists' : 'cmjFavChannels')
}
export async function saveFavorite(type, record, options = {}) {
  const key = type === 'playlist' ? 'cmjFavPlaylists' : 'cmjFavChannels';
  const list = await get(key);
  const identity = type === 'playlist' ? (record.playlistId || record.url) : (record.channelId || record.handle || record.url);
  const existing = list.find(x => String(type === 'playlist' ? x.playlistId || x.url : x.channelId || x.handle || x.url).toLowerCase() === String(identity || '').toLowerCase());
  if (existing && !options.allowExisting) throw new Error(`100% duplicate detected: this ${type} is already saved. Existing ${type} ID: ${existing[type === 'playlist' ? 'playlistId' : 'channelId'] || existing.url || existing.handle || 'unknown'}. A different ${type} with the same name can still be added.`);
  const cleanRecord = { ...(existing || {}), ...record, id: existing?.id || id(type === 'playlist' ? 'playlist' : 'channel'), dateAdded: existing?.dateAdded || now(), updatedAt: now() };
  const out = existing ? list.map(x => x.id === existing.id ? cleanRecord : x) : [cleanRecord, ...list];
  await set(key, out);
  return cleanRecord;
}
export async function updateFavorite(type, record) {
  return saveFavorite(type, record, { allowExisting: true })
}
export async function removeFavorite(type, recordId) {
  const key = type === 'playlist' ? 'cmjFavPlaylists' : 'cmjFavChannels';
  const list = await get(key);
  return set(key, list.filter(x => x.id !== recordId));
}
export async function setCategories(categories) {
  return set(KEYS.categories, unique((Array.isArray(categories) ? categories : []).map(x => typeof x === 'string' ? { id: id('cat'), name: x } : x), 'name'))
}
export async function getCategories() {
  return get(KEYS.categories)
}
export async function setCollections(collections) {
  return set(KEYS.collections, Array.isArray(collections) ? collections : [])
}
export async function getCollections() {
  return get(KEYS.collections)
}
export async function exportFavorites() {
  const [channels, playlists, categories, collections] = await Promise.all([get(KEYS.channels), get(KEYS.playlists), get(KEYS.categories), get(KEYS.collections)]);
  return { schemaVersion: 1, exportedAt: now(), channels, playlists, categories, collections };
}
export async function importFavorites(payload, mode = 'merge') {
  if (!payload || typeof payload !== 'object') throw new Error('Invalid favorites backup.');
  const incomingC = Array.isArray(payload.channels) ? payload.channels : [], incomingP = Array.isArray(payload.playlists) ? payload.playlists : [];
  const currentC = await get(KEYS.channels), currentP = await get(KEYS.playlists);
  const merge = (a, b, key) => {
    if (mode === 'replace') return b;
    const out = [...a];
    for (const item of b) {
      const k = String(item?.[key] || item?.url || '').toLowerCase();
      if (!k || !out.some(x => String(x?.[key] || x?.url || '').toLowerCase() === k)) out.push(item);
    }
    return out;
  };
  const channels = merge(currentC, incomingC, 'channelId'), playlists = merge(currentP, incomingP, 'playlistId');
  await set(KEYS.channels, channels);
  await set(KEYS.playlists, playlists);
  if (Array.isArray(payload.categories)) await set(KEYS.categories, mode === 'replace' ? payload.categories : unique([...(await get(KEYS.categories)), ...payload.categories], 'name'));
  if (Array.isArray(payload.collections)) await set(KEYS.collections, mode === 'replace' ? payload.collections : [...(await get(KEYS.collections)), ...payload.collections]);
  return { channels: channels.length, playlists: playlists.length };
}
export function favoritesToTxt(data) {
  const lines = ['Charlie MJ Language — YouTube Favorites', 'Generated: ' + now(), ''];
  for (const [label, items] of [['Favorite Channels', data.channels || []], ['Favorite Playlists', data.playlists || []]]) {
    lines.push(label, '='.repeat(label.length));
    for (const x of items) {
      lines.push(`${x.name || x.title || '(unnamed)'}`, `URL: ${x.url || ''}`, `Category: ${x.category || ''}`, `Tags: ${(x.tags || []).join(', ')}`, `Notes: ${x.notes || ''}`, `Date added: ${x.dateAdded || ''}`, '');
    }
  }
  return lines.join('\n');
}
