export async function get(key) {
  const s = await chrome.storage.local.get(key);
  return s[key];
}
export async function set(key, value) {
  await chrome.storage.local.set({ [key]: value });
  return value;
}
