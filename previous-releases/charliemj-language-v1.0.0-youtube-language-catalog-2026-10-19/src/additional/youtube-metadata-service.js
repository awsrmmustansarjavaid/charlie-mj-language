/**
 * Additive public-page YouTube metadata resolver.
 *
 * IMPORTANT:
 * - This file is intentionally independent.
 * - Channel identity is based on the canonical YouTube Channel ID.
 * - Different Channel IDs are always allowed to coexist.
 * - Parent/child channels are NOT merged by name, handle, URL, or relationship.
 * - Playlist identity is based on the YouTube playlist ID.
 * - Playlist names come from YouTube page metadata before generic fallbacks.
 */

function clean(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

function firstJson(text, marker) {
  const i = text.indexOf(marker);
  if (i < 0) return null;

  const start = text.indexOf('{', i);
  if (start < 0) return null;

  let depth = 0;
  let quote = false;
  let esc = false;

  for (let p = start; p < text.length; p++) {
    const c = text[p];

    if (quote) {
      if (esc) {
        esc = false;
      } else if (c === '\\') {
        esc = true;
      } else if (c === '"') {
        quote = false;
      }
      continue;
    }

    if (c === '"') {
      quote = true;
      continue;
    }

    if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;

      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, p + 1));
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
    const x = stack.pop();

    if (!x || typeof x !== 'object') continue;

    for (const [k, v] of Object.entries(x)) {
      if (wanted.has(k) && v != null) return v;

      if (v && typeof v === 'object') {
        stack.push(v);
      }
    }
  }

  return null;
}

function textValue(value) {
  if (value == null) return '';

  if (typeof value === 'string') {
    return clean(value);
  }

  if (value.simpleText) {
    return clean(value.simpleText);
  }

  if (Array.isArray(value.runs)) {
    return clean(
      value.runs
        .map(x => x?.text || '')
        .join('')
    );
  }

  return '';
}

function metaTag(html, name) {
  const escapedName = name.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );

  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escapedName}["'][^>]+content=["']([^"']+)["']` +
      `|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escapedName}["']`,
    'i'
  );

  const m = String(html || '').match(re);

  return clean(
    m?.[1] ||
    m?.[2] ||
    ''
  );
}

/**
 * Extract a real channel ID from a URL.
 */
function channelIdFromUrl(url) {
  try {
    const u = new URL(url);

    const match = u.pathname.match(
      /^\/channel\/(UC[\w-]{10,})\/?/i
    );

    return clean(
      match?.[1] || ''
    );
  } catch {
    return '';
  }
}

/**
 * Extract channel ID from canonical YouTube URL references.
 */
function channelIdFromCanonicalHtml(html) {
  const text = String(html || '');

  const patterns = [
    /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"]*\/channel\/(UC[\w-]{10,})[^"]*["']/i,

    /<link[^>]+href=["'][^"]*\/channel\/(UC[\w-]{10,})[^"]*["'][^>]+rel=["']canonical["']/i,

    /<meta[^>]+property=["']og:url["'][^>]+content=["'][^"]*\/channel\/(UC[\w-]{10,})[^"]*["']/i,

    /<meta[^>]+content=["'][^"]*\/channel\/(UC[\w-]{10,})[^"]*["'][^>]+property=["']og:url["']/i
  ];

  for (const re of patterns) {
    const match = text.match(re);

    if (match?.[1]) {
      return clean(match[1]);
    }
  }

  return '';
}

/**
 * Extract a channel ID from explicit YouTube channel references.
 *
 * This is only used after URL/canonical detection.
 */
function channelIdFromHtml(html) {
  const text = String(html || '');

  const patterns = [
    /"channelId"\s*:\s*"(UC[\w-]{10,})"/i,

    /"externalId"\s*:\s*"(UC[\w-]{10,})"/i,

    /"browseId"\s*:\s*"(UC[\w-]{10,})"/i
  ];

  for (const re of patterns) {
    const match = text.match(re);

    if (match?.[1]) {
      return clean(match[1]);
    }
  }

  return '';
}

/**
 * Extract the handle from the requested URL.
 */
function handleFromUrl(url) {
  try {
    const u = new URL(url);

    const match = u.pathname.match(
      /^\/@([^/]+)\/?/i
    );

    return match?.[1]
      ? `@${clean(match[1])}`
      : '';
  } catch {
    return '';
  }
}

function isChannelUrl(url) {
  try {
    const u = new URL(url);

    return (
      /^\/channel\/UC[\w-]{10,}/i.test(
        u.pathname
      ) ||
      /^\/@[^/]+/i.test(
        u.pathname
      ) ||
      /^\/c\/[^/]+/i.test(
        u.pathname
      ) ||
      /^\/user\/[^/]+/i.test(
        u.pathname
      )
    );
  } catch {
    return false;
  }
}

function isPlaylistUrl(url) {
  try {
    const u = new URL(url);

    return (
      u.pathname === '/playlist' ||
      (
        u.searchParams.has('list') &&
        u.pathname !== '/watch'
      )
    );
  } catch {
    return false;
  }
}

/**
 * Extract the actual playlist title from YouTube's
 * playlist-specific page structures.
 *
 * Priority:
 * 1. playlistHeaderRenderer
 * 2. playlistRenderer
 * 3. playlistSidebarPrimaryInfoRenderer
 * 4. microformatDataRenderer
 */
function playlistTitleFromData(yt) {
  const header = deepFind(
    yt,
    ['playlistHeaderRenderer']
  );

  const headerTitle =
    textValue(header?.title);

  if (headerTitle) {
    return headerTitle;
  }

  const playlistRenderer = deepFind(
    yt,
    ['playlistRenderer']
  );

  const rendererTitle =
    textValue(
      playlistRenderer?.title
    );

  if (rendererTitle) {
    return rendererTitle;
  }

  const playlistSidebar = deepFind(
    yt,
    ['playlistSidebarPrimaryInfoRenderer']
  );

  const sidebarTitle =
    textValue(
      playlistSidebar?.title
    );

  if (sidebarTitle) {
    return sidebarTitle;
  }

  const microformat = deepFind(
    yt,
    ['microformatDataRenderer']
  );

  const microformatTitle =
    clean(
      microformat?.title
    );

  if (microformatTitle) {
    return microformatTitle;
  }

  return '';
}

export function parseYouTubeMetadata(
  url,
  html,
  type = 'auto'
) {
  const u = new URL(url);
  const text = String(html || '');

  const isPlaylist =
    isPlaylistUrl(url);

  const isChannel =
    isChannelUrl(url);

  const kind =
    type === 'auto'
      ? (
          isChannel
            ? 'channel'
            : isPlaylist
              ? 'playlist'
              : 'unknown'
        )
      : type;

  /**
   * JSON-LD extraction.
   */
  const ld = [];

  const ldRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;

  let m;

  while ((m = ldRe.exec(text))) {
    try {
      const x = JSON.parse(m[1]);

      if (Array.isArray(x)) {
        ld.push(...x);
      } else {
        ld.push(x);
      }
    } catch {
      // Ignore malformed JSON-LD.
    }
  }

  const schema =
    ld.find(
      x =>
        x &&
        typeof x === 'object' &&
        (
          x.name ||
          x.description
        )
    ) || {};

  /**
   * YouTube initial data.
   */
  const yt =
    firstJson(
      text,
      'var ytInitialData'
    ) ||
    firstJson(
      text,
      'ytInitialData ='
    ) ||
    firstJson(
      text,
      'window["ytInitialData"]'
    ) ||
    null;

  /**
   * Playlist title.
   *
   * IMPORTANT:
   * Playlist-specific YouTube metadata is checked first.
   * This prevents unrelated page/comment/title text from becoming
   * the saved playlist name.
   */
  const playlistName =
    kind === 'playlist'
      ? (
          playlistTitleFromData(yt) ||
          clean(schema.name || '') ||
          metaTag(
            text,
            'og:title'
          )
        )
      : '';

  const name = clean(
    kind === 'playlist'
      ? playlistName
      : (
          schema.name ||
          textValue(
            deepFind(
              yt,
              ['title']
            )
          ) ||
          textValue(
            deepFind(
              yt,
              ['text']
            )
          ) ||
          metaTag(
            text,
            'og:title'
          ) ||
          ''
        )
  );

  const description = clean(
    schema.description ||
    textValue(
      deepFind(
        yt,
        ['description']
      )
    ) ||
    metaTag(
      text,
      'og:description'
    ) ||
    ''
  );

  let thumb = clean(
    schema.image?.url ||
    schema.thumbnailUrl?.[0] ||
    metaTag(
      text,
      'og:image'
    ) ||
    metaTag(
      text,
      'twitter:image'
    ) ||
    ''
  );

  const avatar =
    deepFind(
      yt,
      ['avatar']
    );

  if (
    !thumb &&
    avatar?.thumbnails?.length
  ) {
    thumb =
      avatar.thumbnails.at(-1)?.url ||
      '';
  }

  if (
    kind === 'playlist' &&
    !thumb
  ) {
    const pv =
      deepFind(
        yt,
        ['playlistVideoRenderer']
      );

    thumb =
      pv?.thumbnail?.thumbnails?.at(-1)?.url ||
      '';
  }

  /**
   * CHANNEL ID RESOLUTION
   *
   * 1. Explicit /channel/UC... URL
   * 2. Canonical page URL
   * 3. Explicit channelId/externalId/browseId
   *
   * Different Channel IDs remain separate records.
   */
  let id = '';

  if (kind === 'channel') {
    id =
      channelIdFromUrl(url) ||
      channelIdFromCanonicalHtml(text) ||
      channelIdFromHtml(text);
  } else if (kind === 'playlist') {
    id =
      clean(
        u.searchParams.get('list') || ''
      );
  }

  const handle =
    handleFromUrl(url);

  const subscriberValue =
    deepFind(
      yt,
      ['subscriberCountText']
    );

  const subscribers = clean(
    subscriberValue?.simpleText ||
    subscriberValue?.runs
      ?.map(x => x.text)
      .join('') ||
    ''
  );

  const videoValue =
    deepFind(
      yt,
      ['videoCountText']
    );

  const videoCount = clean(
    videoValue?.simpleText ||
    videoValue?.runs
      ?.map(x => x.text)
      .join('') ||
    ''
  );

  const ownerValue =
    deepFind(
      yt,
      ['ownerText']
    ) ||
    deepFind(
      yt,
      ['longBylineText']
    );

  const owner = clean(
    ownerValue?.runs
      ?.map(x => x.text)
      .join('') ||
    ''
  );

  return {
    kind,

    id,

    channelId:
      kind === 'channel'
        ? id
        : '',

    playlistId:
      kind === 'playlist'
        ? id
        : '',

    name,

    handle,

    url: u.href,

    description,

    thumbnail: thumb,

    subscriberCount:
      subscribers,

    videoCount,

    owner,

    metadataLastChecked:
      new Date().toISOString(),

    thumbnailChecked:
      new Date().toISOString()
  };
}

export async function fetchYouTubeMetadata(
  url,
  type = 'auto'
) {
  const r = await fetch(
    url,
    {
      credentials: 'include',

      cache: 'no-store',

      headers: {
        accept:
          'text/html,application/xhtml+xml'
      }
    }
  );

  if (!r.ok) {
    throw new Error(
      `YouTube metadata HTTP ${r.status}`
    );
  }

  const html =
    await r.text();

  /**
   * Use the final response URL when YouTube redirects
   * a legacy/custom URL to another canonical page.
   */
  const finalUrl =
    r.url || url;

  return parseYouTubeMetadata(
    finalUrl,
    html,
    type
  );
}