/*
 * Charlie MJ Language - Storage helpers
 * --------------------------------------
 * Keeps all user learning data in chrome.storage.local. This is deliberately
 * local-first and portable: users can export their records from the popup.
 */

export const STORAGE_KEYS = {
  settings: "settings",
  vocabulary: "vocabulary",
  bookmarks: "bookmarks",
  watchLater: "watchLater",
  captures: "captures",
  transcripts: "transcripts",
  stats: "stats"
};

export async function getList(key) {
  const result = await chrome.storage.local.get(key);
  return Array.isArray(result[key]) ? result[key] : [];
}

export async function appendToList(key, item) {
  const list = await getList(key);
  list.push(item);
  await chrome.storage.local.set({ [key]: list });
  return item;
}

export async function saveList(key, list) {
  await chrome.storage.local.set({ [key]: list });
}

export function makeId(prefix = "item") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
