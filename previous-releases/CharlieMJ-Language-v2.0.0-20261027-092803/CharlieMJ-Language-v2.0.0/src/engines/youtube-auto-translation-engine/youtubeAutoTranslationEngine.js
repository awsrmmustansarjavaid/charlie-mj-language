export function canAutoTranslate(track) {
  return Boolean(track?.baseUrl && track?.isTranslatable !== false);
}
