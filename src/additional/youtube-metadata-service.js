/**
 * Charlie MJ Language — YouTube Metadata Service
 *
 * Local/public-page metadata resolver for Channels and Playlists.
 *
 * Design goals:
 * - No YouTube Data API key required.
 * - Uses the user's authenticated YouTube page when available.
 * - Never invents metadata: unavailable fields remain empty/null.
 * - Keeps YouTube-owned metadata separate from Charlie MJ library fields.
 * - Preserves the existing return fields used by Favorites.
 * - Extracts enough structured metadata for the local categorization engine:
 *   title, description, channel/playlist IDs, handle, language, country,
 *   keywords, tags, statistics, dates, thumbnails, banner and playlist items.
 */

function clean(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtml(value) {
  return clean(String(value ?? ''))
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/');
}

function textValue(value) {
  if (value == null) return '';
  if (typeof value === 'string') return decodeHtml(value);
  if (value.simpleText) return decodeHtml(value.simpleText);
  if (Array.isArray(value.runs)) return decodeHtml(value.runs.map((x) => x?.text || '').join(''));
  return '';
}

function firstThumbnail(value) {
  if (Array.isArray(value?.thumbnails) && value.thumbnails.length) {
    return clean(value.thumbnails.at(-1)?.url || '');
  }
  if (typeof value?.url === 'string') return clean(value.url);
  return '';
}

function metaTag(html, name) {
  const escapedName = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapedName}["'][^>]+content=["']([^"']+)["']` +
      `|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedName}["']`,
    'i'
  );
  const match = String(html || '').match(re);
  return decodeHtml(match?.[1] || match?.[2] || '');
}

function metaTags(html, name) {
  const out = [];
  const escapedName = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapedName}["'][^>]+content=["']([^"']+)["']` +
      `|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedName}["']`,
    'gi'
  );
  let match;
  while ((match = re.exec(String(html || '')))) {
    const value = decodeHtml(match[1] || match[2] || '');
    if (value) out.push(value);
  }
  return out;
}

function splitKeywords(value) {
  if (Array.isArray(value)) return value.flatMap(splitKeywords).filter(Boolean);
  return String(value || '')
    .split(/[,;|]/)
    .map((x) => decodeHtml(x))
    .filter(Boolean);
}

function unique(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const v = clean(value);
    if (!v) continue;
    const key = v.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function firstJson(text, marker) {
  const source = String(text || '');
  const index = source.indexOf(marker);
  if (index < 0) return null;
  const start = source.indexOf('{', index);
  if (start < 0) return null;

  let depth = 0;
  let quote = false;
  let escaped = false;

  for (let position = start; position < source.length; position += 1) {
    const character = source[position];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quote = false;
      continue;
    }
    if (character === '"') {
      quote = true;
      continue;
    }
    if (character === '{') depth += 1;
    else if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(source.slice(start, position + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function deepFind(obj, keys) {
  const wanted = new Set(keys);
  const stack = [obj];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    for (const [key, value] of Object.entries(current)) {
      if (wanted.has(key) && value != null) return value;
      if (value && typeof value === 'object') stack.push(value);
    }
  }
  return null;
}

function collectValues(obj, keys, limit = 100) {
  const wanted = new Set(keys);
  const out = [];
  const stack = [obj];
  while (stack.length && out.length < limit) {
    const current = stack.pop();
    if (!current || typeof current !== 'object') continue;
    for (const [key, value] of Object.entries(current)) {
      if (wanted.has(key) && value != null) out.push(value);
      if (value && typeof value === 'object') stack.push(value);
      if (out.length >= limit) break;
    }
  }
  return out;
}

function parseJsonLd(html) {
  const result = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(String(html || '')))) {
    try {
      const value = JSON.parse(match[1]);
      if (Array.isArray(value)) result.push(...value);
      else if (value && typeof value === 'object') result.push(value);
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }
  return result;
}

function schemaOf(ld) {
  return (
    ld.find((item) => {
      const type = item?.['@type'];
      const types = Array.isArray(type) ? type : [type];
      return types.some((x) => ['Channel', 'Organization', 'Person', 'Playlist', 'CollectionPage'].includes(x));
    }) ||
    ld.find((item) => item && typeof item === 'object' && (item.name || item.description)) ||
    {}
  );
}

function channelIdFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    return clean(pathname.match(/^\/channel\/(UC[\w-]{10,})\/?/i)?.[1] || '');
  } catch {
    return '';
  }
}

function channelIdFromHtml(html) {
  const text = String(html || '');
  const patterns = [
    /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']*\/channel\/(UC[\w-]{10,})[^"']*/i,
    /<link[^>]+href=["'][^"']*\/channel\/(UC[\w-]{10,})[^"']*["'][^>]+rel=["']canonical["']/i,
    /<meta[^>]+property=["']og:url["'][^>]+content=["'][^"']*\/channel\/(UC[\w-]{10,})[^"']*/i,
    /"channelId"\s*:\s*"(UC[\w-]{10,})"/i,
    /"externalId"\s*:\s*"(UC[\w-]{10,})"/i,
    /"browseId"\s*:\s*"(UC[\w-]{10,})"/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return clean(match[1]);
  }
  return '';
}

function handleFromUrl(url) {
  try {
    const match = new URL(url).pathname.match(/^\/@([^/]+)\/?/i);
    return match?.[1] ? `@${clean(match[1])}` : '';
  } catch {
    return '';
  }
}

function isChannelUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    return (
      /^\/channel\/UC[\w-]{10,}/i.test(pathname) ||
      /^\/@[^/]+/i.test(pathname) ||
      /^\/c\/[^/]+/i.test(pathname) ||
      /^\/user\/[^/]+/i.test(pathname)
    );
  } catch {
    return false;
  }
}

function isPlaylistUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname === '/playlist' || (u.searchParams.has('list') && u.pathname !== '/watch');
  } catch {
    return false;
  }
}

function parseCount(value) {
  const text = clean(value);
  if (!text) return null;
  const normalized = text.replace(/,/g, '');
  const match = normalized.match(/([\d.]+)\s*([KMBT])?/i);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const multiplier = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 }[String(match[2] || '').toUpperCase()] || 1;
  return Math.round(amount * multiplier);
}

function findCountText(value) {
  return textValue(value);
}

function extractCanonicalUrl(html) {
  const match = String(html || '').match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i
  );
  return clean(match?.[1] || '');
}

function extractUrlFromNavigation(value) {
  return clean(
    value?.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url ||
      value?.navigationEndpoint?.urlEndpoint?.url ||
      value?.commandMetadata?.webCommandMetadata?.url ||
      ''
  );
}

function playlistTitleFromData(yt) {
  const candidates = [
    deepFind(yt, ['playlistHeaderRenderer'])?.title,
    deepFind(yt, ['playlistSidebarPrimaryInfoRenderer'])?.title,
    deepFind(yt, ['playlistRenderer'])?.title,
    deepFind(yt, ['microformatDataRenderer'])?.title,
  ];
  for (const candidate of candidates) {
    const value = textValue(candidate);
    if (value) return value;
  }
  return '';
}

function extractRecentVideoTitles(yt, limit = 30) {
  const renderers = collectValues(yt, ['videoRenderer', 'gridVideoRenderer', 'compactVideoRenderer'], limit * 3);
  const out = [];
  const seen = new Set();
  for (const item of renderers) {
    const title = textValue(item?.title || item?.headline || item?.metadata?.title);
    if (!title) continue;
    const key = title.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title);
    if (out.length >= limit) break;
  }
  return out;
}

function extractPlaylistTitles(yt, limit = 50) {
  const renderers = collectValues(yt, ['playlistRenderer', 'gridPlaylistRenderer', 'compactPlaylistRenderer'], limit * 2);
  const out = [];
  const seen = new Set();
  for (const item of renderers) {
    const title = textValue(item?.title || item?.headline || item?.metadata?.title);
    if (!title) continue;
    const key = title.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(title);
    if (out.length >= limit) break;
  }
  return out;
}

function extractPlaylistItems(yt) {
  const values = collectValues(yt, ['playlistVideoRenderer'], 150);
  const seen = new Set();
  const items = [];
  for (const item of values) {
    const videoId = clean(item?.videoId || '');
    if (!videoId || seen.has(videoId)) continue;
    seen.add(videoId);
    items.push({
      videoId,
      title: textValue(item?.title),
      description: textValue(item?.description),
      index: textValue(item?.index),
      thumbnail: firstThumbnail(item?.thumbnail),
      lengthText: textValue(item?.lengthText),
      owner: textValue(item?.shortBylineText || item?.longBylineText),
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    });
  }
  return items;
}

function extractOwnerChannelId(yt) {
  const values = collectValues(yt, ['ownerText', 'longBylineText', 'shortBylineText'], 30);
  for (const value of values) {
    const id = clean(
      value?.navigationEndpoint?.browseEndpoint?.browseId ||
        value?.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl?.match?.(/^\/channel\/(UC[\w-]+)/i)?.[1] ||
        ''
    );
    if (id) return id;
  }
  return channelIdFromHtml(JSON.stringify(yt));
}

function extractVerification(yt) {
  const badges = collectValues(yt, ['metadataBadgeRenderer'], 30);
  const labels = [];
  let verified = false;
  for (const badge of badges) {
    const label = clean(badge?.tooltip || badge?.label || badge?.style || '');
    if (label) labels.push(label);
    if (/verified/i.test(label) || /VERIFIED/i.test(label)) verified = true;
  }
  return { verified, labels: unique(labels) };
}

function extractCountry(yt, schema) {
  const candidates = [
    schema?.address?.addressCountry,
    schema?.addressCountry,
    schema?.contentLocation?.name,
    schema?.contentLocation?.address?.addressCountry,
    deepFind(yt, ['countryCode']),
    deepFind(yt, ['countryName']),
    deepFind(yt, ['country']),
    deepFind(yt, ['addressCountry']),
  ];
  for (const candidate of candidates) {
    const value = clean(typeof candidate === 'object' ? candidate?.name || candidate?.code : candidate);
    if (value) return value;
  }
  return '';
}

function extractLanguage(yt, schema, html) {
  const candidates = [
    schema?.inLanguage,
    schema?.language,
    deepFind(yt, ['inLanguage']),
    deepFind(yt, ['defaultLanguage']),
    deepFind(yt, ['languageCode']),
    metaTag(html, 'content-language'),
    metaTag(html, 'language'),
  ];
  for (const candidate of candidates) {
    const value = clean(typeof candidate === 'object' ? candidate?.name || candidate?.code : candidate);
    if (value) return value;
  }
  return '';
}

function extractBanner(yt, schema) {
  const candidates = [
    schema?.image?.url,
    deepFind(yt, ['banner']),
    deepFind(yt, ['channelBanner']),
    deepFind(yt, ['imageBanner']),
    deepFind(yt, ['mastheadThumbnail']),
  ];
  for (const candidate of candidates) {
    const value = firstThumbnail(candidate);
    if (value) return value;
  }
  return '';
}

function extractStats(yt, schema) {
  const subscriberText =
    textValue(deepFind(yt, ['subscriberCountText'])) ||
    clean(schema?.interactionStatistic?.userInteractionCount || '');
  const videoText = textValue(deepFind(yt, ['videoCountText']));
  const viewText =
    textValue(deepFind(yt, ['viewCountText'])) ||
    clean(schema?.interactionStatistic?.userInteractionCount || '');
  const hiddenValue = deepFind(yt, ['hiddenSubscriberCount']);
  return {
    subscriberCount: subscriberText,
    subscriberCountNumber: parseCount(subscriberText),
    videoCount: videoText,
    videoCountNumber: parseCount(videoText),
    viewCount: viewText,
    viewCountNumber: parseCount(viewText),
    hiddenSubscriberCount:
      typeof hiddenValue === 'boolean' ? hiddenValue : /hidden/i.test(subscriberText),
  };
}

function extractDates(yt, schema) {
  const candidates = [
    schema?.datePublished,
    schema?.uploadDate,
    schema?.dateCreated,
    deepFind(yt, ['publishDate']),
    deepFind(yt, ['publishedAt']),
    deepFind(yt, ['publishedTimeText']),
  ];
  for (const candidate of candidates) {
    const value = clean(typeof candidate === 'object' ? textValue(candidate) : candidate);
    if (value) return value;
  }
  return '';
}

function extractPrivacy(yt, schema) {
  const candidates = [
    deepFind(yt, ['privacyStatus']),
    deepFind(yt, ['privacy']),
    schema?.isAccessibleForFree === false ? 'private' : '',
  ];
  for (const candidate of candidates) {
    const value = clean(typeof candidate === 'object' ? textValue(candidate) : candidate);
    if (value) return value;
  }
  return '';
}

function normalizeKeywordSources(schema, html, yt) {
  const metaKeywords = metaTags(html, 'keywords').flatMap(splitKeywords);
  const schemaKeywords = splitKeywords(schema?.keywords);
  const ytKeywords = collectValues(yt, ['keywords', 'tags'], 20).flatMap(splitKeywords);
  return unique([...metaKeywords, ...schemaKeywords, ...ytKeywords]);
}

export function parseYouTubeMetadata(url, html, type = 'auto') {
  const requestedUrl = String(url || '').trim();
  const sourceHtml = String(html || '');
  const inputUrl = new URL(requestedUrl);
  const ld = parseJsonLd(sourceHtml);
  const schema = schemaOf(ld);
  const yt =
    firstJson(sourceHtml, 'var ytInitialData') ||
    firstJson(sourceHtml, 'ytInitialData =') ||
    firstJson(sourceHtml, 'window["ytInitialData"]') ||
    null;

  const isPlaylist = isPlaylistUrl(requestedUrl);
  const isChannel = isChannelUrl(requestedUrl);
  const kind =
    type === 'auto' ? (isChannel ? 'channel' : isPlaylist ? 'playlist' : 'unknown') : type;

  const canonicalUrl = extractCanonicalUrl(sourceHtml);
  const playlistItems = kind === 'playlist' ? extractPlaylistItems(yt) : [];
  const playlistId = kind === 'playlist' ? clean(inputUrl.searchParams.get('list') || '') : '';
  const channelId =
    kind === 'channel'
      ? channelIdFromUrl(requestedUrl) || channelIdFromHtml(sourceHtml)
      : extractOwnerChannelId(yt);
  const handle = handleFromUrl(requestedUrl) || clean(deepFind(yt, ['canonicalBaseUrl'])?.match?.(/^\/@([^/]+)/i)?.[1] ? `@${deepFind(yt, ['canonicalBaseUrl']).match(/^\/@([^/]+)/i)[1]}` : '');

  const playlistName =
    kind === 'playlist'
      ? playlistTitleFromData(yt) || clean(schema?.name) || metaTag(sourceHtml, 'og:title')
      : '';

  const name = clean(
    kind === 'playlist'
      ? playlistName
      : schema?.name ||
          textValue(deepFind(yt, ['channelMetadataRenderer'])?.title) ||
          textValue(deepFind(yt, ['title'])) ||
          metaTag(sourceHtml, 'og:title') ||
          ''
  );

  const description = clean(
    schema?.description ||
      textValue(deepFind(yt, ['channelMetadataRenderer'])?.description) ||
      textValue(deepFind(yt, ['description'])) ||
      metaTag(sourceHtml, 'og:description') ||
      ''
  );

  const thumbnail =
    clean(schema?.image?.url || schema?.thumbnailUrl?.[0] || '') ||
    metaTag(sourceHtml, 'og:image') ||
    metaTag(sourceHtml, 'twitter:image') ||
    firstThumbnail(deepFind(yt, ['avatar'])) ||
    firstThumbnail(deepFind(yt, ['thumbnail']));

  const banner = kind === 'channel' ? extractBanner(yt, schema) : '';
  const ownerValue =
    deepFind(yt, ['ownerText']) ||
    deepFind(yt, ['longBylineText']) ||
    deepFind(yt, ['shortBylineText']);
  const owner = textValue(ownerValue);
  const stats = extractStats(yt, schema);
  const verification = extractVerification(yt);
  const country = extractCountry(yt, schema);
  const language = extractLanguage(yt, schema, sourceHtml);
  const publishedAt = extractDates(yt, schema);
  const keywords = normalizeKeywordSources(schema, sourceHtml, yt);
  const tags = unique([
    ...keywords,
    ...metaTags(sourceHtml, 'keywords').flatMap(splitKeywords),
  ]);
  const recentVideoTitles = kind === 'channel' ? extractRecentVideoTitles(yt, 30) : [];
  const playlistTitles = kind === 'channel' ? extractPlaylistTitles(yt, 50) : [];

  const itemCountText =
    kind === 'playlist'
      ? textValue(deepFind(yt, ['numVideosText'])) || textValue(deepFind(yt, ['videoCountText']))
      : '';

  const privacy = kind === 'playlist' ? extractPrivacy(yt, schema) : '';
  const finalUrl = canonicalUrl || inputUrl.href;

  return {
    kind,
    resourceType: kind,
    id: kind === 'channel' ? channelId : kind === 'playlist' ? playlistId : '',
    channelId: kind === 'channel' ? channelId : '',
    playlistId,
    ownerChannelId: kind === 'playlist' ? channelId : '',
    name,
    title: kind === 'playlist' ? name : name,
    handle,
    customUrl: handle ? `https://www.youtube.com/${handle}` : '',
    url: inputUrl.href,
    canonicalUrl: finalUrl,
    sourceUrl: inputUrl.href,
    description,
    thumbnail,
    banner,
    owner,
    country,
    countryCode: /^[A-Z]{2}$/i.test(country) ? country.toUpperCase() : '',
    language,
    languageCode: /^[a-z]{2,3}(?:[_-][A-Za-z0-9]+)?$/.test(language) ? language : '',
    keywords,
    tags,
    recentVideoTitles,
    videoTitles: recentVideoTitles,
    playlistTitles,
    labels: [],
    publishedAt,
    subscriberCount: stats.subscriberCount,
    subscriberCountNumber: stats.subscriberCountNumber,
    videoCount: stats.videoCount,
    videoCountNumber: stats.videoCountNumber,
    viewCount: stats.viewCount,
    viewCountNumber: stats.viewCountNumber,
    hiddenSubscriberCount: stats.hiddenSubscriberCount,
    verified: verification.verified,
    verificationLabels: verification.labels,
    itemCount: itemCountText,
    itemCountNumber: parseCount(itemCountText),
    privacy,
    playlistItems,
    metadataSources: {
      jsonLd: ld.length > 0,
      ytInitialData: Boolean(yt),
      canonicalUrl: Boolean(canonicalUrl),
      metaTags: Boolean(metaTag(sourceHtml, 'og:title') || metaTag(sourceHtml, 'og:description')),
    },
    metadataLastChecked: new Date().toISOString(),
    thumbnailChecked: new Date().toISOString(),
  };
}

export async function fetchYouTubeMetadata(url, type = 'auto') {
  const normalized = String(url || '').trim();
  if (!normalized) throw new Error('YouTube URL is required.');

  const response = await fetch(normalized, {
    credentials: 'include',
    cache: 'no-store',
    redirect: 'follow',
    headers: {
      accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube metadata HTTP ${response.status}`);
  }

  const html = await response.text();
  return parseYouTubeMetadata(response.url || normalized, html, type);
}
