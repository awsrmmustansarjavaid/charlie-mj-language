export function thumbnailRecord(url, previous = {}) {
  return {
    ...previous,
    url: String(url || previous.url || ''),
    lastChecked: new Date().toISOString(),
  };
}
