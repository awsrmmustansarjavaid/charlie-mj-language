/**
 * Charlie MJ Language - YouTube MAIN-world caption bridge v3.6.
 *
 * Why this bridge exists:
 * - YouTube's current timedtext URLs can return HTTP 200 with an empty body
 *   unless the request contains a player-generated proof token (PoToken).
 * - Therefore a plain fetch(captionTrack.baseUrl) is NOT a reliable primary
 *   strategy anymore. Current research confirms this is a YouTube-side change.
 * - This bridge runs at document_start, before most YouTube page code, so it
 *   can observe the real player's caption/transcript requests.
 * - It also uses YouTube's own get_transcript InnerTube endpoint when the
 *   transcript endpoint parameters are already present in ytInitialData. This
 *   does not require the visible CC button to be enabled.
 *
 * The bridge never changes the player's playback state. It only observes and
 * parses caption/transcript data, then sends safe cue data to the isolated
 * extension world with DOM CustomEvents.
 */
(() => {
  'use strict';

  const TRACK_EVENT = 'cmj-youtube-player-response';
  const DATA_EVENT = 'cmj-youtube-player-response-data';
  const DIAG_EVENT = 'cmj-youtube-caption-diagnostics';
  const seenTrackSignatures = new Set();
  const seenDataSignatures = new Set();
  let currentVideoId = '';
  let installedNetworkHooks = false;
  let lastTranscriptAttemptAt = 0;
  let transcriptAttemptPromise = null;
  let transcriptPanelFallbackAt = 0;

  const emit = (name, payload) => {
    try { document.dispatchEvent(new CustomEvent(name, { detail: JSON.stringify(payload) })); } catch (_) {}
  };

  const cleanCaptionText = text => String(text || '')
    .replace(/(?:A1|A2|B1|B2|C1|C2)*(?:Turkish|English|German|French|Spanish|Italian|Arabic|Persian|Urdu|Japanese|Korean|Chinese|Hindi)(?:A1|A2|B1|B2|C1|C2)*\s*\(auto-generated\)(?:A1|A2|B1|B2|C1|C2)*\s*Click(?:A1|A2|B1|B2|C1|C2)*\s*for(?:A1|A2|B1|B2|C1|C2)*\s*settings(?:A1|A2|B1|B2|C1|C2)*\s*/gi, ' ')
    .replace(/(?:Turkish|English|German|French|Spanish|Italian|Arabic|Persian|Urdu|Japanese|Korean|Chinese|Hindi)\s*\(auto-generated\)\s*Click\s*for\s*settings/gi, ' ')
    .replace(/(?:A1|A2|B1|B2|C1|C2)/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const parseCaptionPayload = text => {
    const result = [];
    const raw = String(text || '').trim();
    if (!raw) return result;
    if (raw.startsWith('{')) {
      try {
        const json = JSON.parse(raw);
        for (const event of json.events || []) {
          const value = (event.segs || []).map(segment => segment.utf8 || '').join('');
          const cleaned = cleanCaptionText(value);
          if (cleaned) result.push({ start: (event.tStartMs || 0) / 1000, duration: (event.dDurationMs || 0) / 1000, text: cleaned });
        }
      } catch (_) {}
      return result;
    }
    try {
      const xml = new DOMParser().parseFromString(raw, 'text/xml');
      for (const node of [...xml.querySelectorAll('text')]) {
        const cleaned = cleanCaptionText(node.textContent || '');
        if (cleaned) result.push({ start: Number(node.getAttribute('start') || 0), duration: Number(node.getAttribute('dur') || 0), text: cleaned });
      }
    } catch (_) {}
    return result;
  };

  const normaliseTracks = tracks => (tracks || []).map(track => ({
    baseUrl: String(track.baseUrl || '').replace(/\\u0026/g, '&'),
    languageCode: track.languageCode || '',
    name: track.name?.simpleText || track.name?.runs?.map(run => run.text).join('') || '',
    vssId: track.vssId || '',
    kind: track.kind || ''
  })).filter(track => track.baseUrl);

  const emitTracks = tracks => {
    const safe = normaliseTracks(tracks);
    if (!safe.length) return;
    const signature = safe.map(t => `${t.languageCode}|${t.vssId}|${t.baseUrl.slice(0, 120)}`).join('||');
    if (seenTrackSignatures.has(signature)) return;
    seenTrackSignatures.add(signature);
    emit(TRACK_EVENT, { tracks: safe });
  };

  const emitCaptions = (captions, source = 'network') => {
    if (!captions?.length) return;
    const cleaned = captions.filter(x => x && x.text).map(x => ({
      start: Number(x.start || 0), duration: Number(x.duration || 0), text: cleanCaptionText(x.text)
    })).filter(x => x.text);
    if (!cleaned.length) return;
    const signature = `${currentVideoId}|${source}|${cleaned.length}|${cleaned[0].start}|${cleaned[cleaned.length - 1].start}`;
    if (seenDataSignatures.has(signature)) return;
    seenDataSignatures.add(signature);
    emit(DATA_EVENT, { captions: cleaned, source, videoId: currentVideoId });
  };

  function getVideoId() {
    try { return new URL(location.href).searchParams.get('v') || ''; } catch (_) { return ''; }
  }

  function publishPlayerResponse(response) {
    try {
      const parsed = typeof response === 'string' ? JSON.parse(response) : response;
      const tracks = parsed?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (Array.isArray(tracks) && tracks.length) emitTracks(tracks);
    } catch (_) {}
  }

  function findTranscriptParams(data) {
    try {
      for (const panel of data?.engagementPanels || []) {
        const section = panel?.engagementPanelSectionListRenderer;
        if (!section) continue;
        const content = section?.content;
        const direct = content?.continuationItemRenderer?.continuationEndpoint?.getTranscriptEndpoint?.params;
        if (direct) return direct;
        const contents = content?.sectionListRenderer?.contents || [];
        for (const item of contents) {
          const params = item?.continuationItemRenderer?.continuationEndpoint?.getTranscriptEndpoint?.params;
          if (params) return params;
        }
      }
    } catch (_) {}
    return '';
  }

  function getInitialData() {
    try {
      if (window.ytInitialData) return window.ytInitialData;
      const scripts = [...document.scripts];
      for (const script of scripts) {
        const text = script.textContent || '';
        const marker = 'ytInitialData = ';
        const at = text.indexOf(marker);
        if (at < 0) continue;
        const brace = text.indexOf('{', at + marker.length);
        if (brace < 0) continue;
        let depth = 0, quote = false, escaped = false;
        for (let i = brace; i < text.length; i++) {
          const c = text[i];
          if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quote = false; continue; }
          if (c === '"') { quote = true; continue; }
          if (c === '{') depth++;
          if (c === '}') { depth--; if (depth === 0) { try { return JSON.parse(text.slice(brace, i + 1)); } catch (_) { return null; } } }
        }
      }
    } catch (_) {}
    return null;
  }

  function getInnertubeContext() {
    try {
      const fromConfig = window.ytcfg?.data_?.INNERTUBE_CONTEXT || window.ytcfg?.get?.('INNERTUBE_CONTEXT');
      if (fromConfig) return fromConfig;
      const clientName = window.ytcfg?.data_?.INNERTUBE_CLIENT_NAME || window.ytcfg?.get?.('INNERTUBE_CLIENT_NAME');
      const clientVersion = window.ytcfg?.data_?.INNERTUBE_CLIENT_VERSION || window.ytcfg?.get?.('INNERTUBE_CLIENT_VERSION');
      if (clientName && clientVersion) return { client: { clientName, clientVersion } };
    } catch (_) {}
    return null;
  }

  function findTranscriptParamsDeep(root, depth = 0, seen = new Set()) {
    if (!root || depth > 10 || typeof root !== 'object') return '';
    if (seen.has(root)) return '';
    seen.add(root);
    if (root.getTranscriptEndpoint?.params) return String(root.getTranscriptEndpoint.params);
    if (root.continuationEndpoint?.getTranscriptEndpoint?.params) return String(root.continuationEndpoint.getTranscriptEndpoint.params);
    if (root.continuationEndpoint?.getTranscriptEndpoint?.params) return String(root.continuationEndpoint.getTranscriptEndpoint.params);
    for (const value of Object.values(root)) {
      const found = findTranscriptParamsDeep(value, depth + 1, seen);
      if (found) return found;
    }
    return '';
  }

  function parseTranscriptSegments(json) {
    const segments = [];
    const actions = Array.isArray(json?.actions) ? json.actions : [];
    for (const action of actions) {
      const body = action?.updateEngagementPanelAction?.content?.transcriptRenderer?.content
        ?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer;
      const initial = body?.initialSegments || [];
      for (const item of initial) {
        const r = item?.transcriptSegmentRenderer;
        if (!r) continue;
        const start = Number(r.startMs || r.startTimeMs || 0) / 1000;
        const end = Number(r.endMs || 0) / 1000;
        const text = r.snippet?.runs?.map(run => run.text || '').join('') || r.snippet?.simpleText || '';
        if (text.trim()) segments.push({ start, duration: Math.max(0, end - start), text: cleanCaptionText(text) });
      }
    }
    return segments.filter(x => x.text);
  }

  async function fetchInnertubeNextTranscriptParams(videoId, context, key) {
    try {
      const endpoint = `https://www.youtube.com/youtubei/v1/next${key ? `?key=${encodeURIComponent(key)}` : ''}`;
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ context, videoId })
      });
      if (!response.ok) return '';
      const json = await response.json();
      return findTranscriptParamsDeep(json);
    } catch (_) { return ''; }
  }

  async function fetchInnertubeTranscript() {
    const videoId = getVideoId();
    if (!videoId) return false;
    if (transcriptAttemptPromise) return transcriptAttemptPromise;
    if (performance.now() - lastTranscriptAttemptAt < 1200) return false;
    lastTranscriptAttemptAt = performance.now();
    transcriptAttemptPromise = (async () => {
    const data = getInitialData();
    const context = getInnertubeContext();
    if (!context) return false;
    try {
      const key = window.ytcfg?.data_?.INNERTUBE_API_KEY || window.ytcfg?.get?.('INNERTUBE_API_KEY') || '';
      let params = findTranscriptParams(data);
      if (!params) params = await fetchInnertubeNextTranscriptParams(videoId, context, key);
      if (!params) return false;
      const endpoint = `https://www.youtube.com/youtubei/v1/get_transcript${key ? `?key=${encodeURIComponent(key)}` : ''}`;
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ context, params })
      });
      if (!response.ok) return false;
      const json = await response.json();
      const segments = parseTranscriptSegments(json);
      if (segments.length) { emitCaptions(segments, 'innertube-get-transcript'); return true; }
    } catch (_) {}
    return false;
    })();
    try { return await transcriptAttemptPromise; } finally { transcriptAttemptPromise = null; }
  }

  function installNetworkHooks() {
    if (installedNetworkHooks) return;
    installedNetworkHooks = true;

    // Observe fetch responses created by the actual YouTube player. If YouTube
    // has already minted a valid PoToken, reusing its response avoids the
    // empty-body problem of a fresh unsigned timedtext request.
    try {
      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        try {
          const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
          if (/\/api\/timedtext|\/youtubei\/v1\/get_transcript/i.test(url)) {
            const clone = response.clone();
            clone.text().then(text => {
              const parsed = parseCaptionPayload(text);
              if (parsed.length) emitCaptions(parsed, 'player-fetch');
              else {
                try { const json = JSON.parse(text); publishTranscriptJSON(json); } catch (_) {}
              }
            }).catch(() => {});
          }
        } catch (_) {}
        return response;
      };
    } catch (_) {}

    // XHR fallback for player builds that still use XMLHttpRequest.
    try {
      const open = XMLHttpRequest.prototype.open;
      const send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this.__cmjUrl = String(url || '');
        return open.call(this, method, url, ...rest);
      };
      XMLHttpRequest.prototype.send = function(...args) {
        if (/\/api\/timedtext|\/youtubei\/v1\/get_transcript/i.test(this.__cmjUrl || '')) {
          this.addEventListener('load', () => {
            try {
              const parsed = parseCaptionPayload(this.responseText || '');
              if (parsed.length) emitCaptions(parsed, 'player-xhr');
              else { try { publishTranscriptJSON(JSON.parse(this.responseText || '{}')); } catch (_) {} }
            } catch (_) {}
          }, { once: true });
        }
        return send.apply(this, args);
      };
    } catch (_) {}
  }

  function publishTranscriptJSON(json) {
    const segments = [];
    const initial = json?.actions?.flatMap(a => a?.updateEngagementPanelAction?.content?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments || []) || [];
    for (const item of initial) {
      const r = item?.transcriptSegmentRenderer;
      if (!r) continue;
      const start = Number(r.startMs || r.startTimeMs || 0) / 1000;
      const end = Number(r.endMs || 0) / 1000;
      const text = r.snippet?.runs?.map(run => run.text || '').join('') || r.snippet?.simpleText || '';
      if (text.trim()) segments.push({ start, duration: Math.max(0, end - start), text });
    }
    if (segments.length) emitCaptions(segments, 'player-transcript-response');
  }

  function parseTimestampText(text) {
    const parts = String(text || '').trim().split(':').map(Number);
    if (parts.some(Number.isNaN)) return NaN;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
  }

  function readTranscriptPanelDOM() {
    try {
      const rows = [...document.querySelectorAll('ytd-transcript-segment-renderer')];
      if (!rows.length) return false;
      const segments = [];
      for (const row of rows) {
        const timeNode = row.querySelector('.segment-timestamp, [class*="segment-timestamp"], yt-formatted-string.segment-timestamp');
        const textNode = row.querySelector('.segment-text, yt-formatted-string.segment-text');
        const start = parseTimestampText(timeNode?.textContent || row.getAttribute('data-start-time') || '0');
        const text = cleanCaptionText(textNode?.textContent || row.textContent || '');
        if (text && Number.isFinite(start)) segments.push({ start, duration: 0, text });
      }
      if (segments.length > 2) {
        for (let i = 0; i < segments.length; i += 1) {
          segments[i].duration = Math.max(0, (segments[i + 1]?.start ?? segments[i].start + 3) - segments[i].start);
        }
        emitCaptions(segments, 'youtube-transcript-dom');
        return true;
      }
    } catch (_) {}
    return false;
  }

  function triggerTranscriptPanelFallback() {
    try {
      if (readTranscriptPanelDOM()) return true;
      if (performance.now() - transcriptPanelFallbackAt < 1800) return false;
      transcriptPanelFallbackAt = performance.now();
      const buttons = [...document.querySelectorAll('button, yt-button-shape, ytd-button-renderer, tp-yt-paper-button')];
      const button = buttons.find(node => /show transcript|transcript/i.test(node.getAttribute('aria-label') || node.textContent || ''));
      if (!button) return false;
      button.click();
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (readTranscriptPanelDOM() || attempts >= 20) {
          clearInterval(timer);
          if (attempts < 20) {
            setTimeout(() => {
              const close = [...document.querySelectorAll('button, yt-button-shape, ytd-button-renderer')]
                .find(node => /close transcript/i.test(node.getAttribute('aria-label') || ''));
              close?.click();
            }, 80);
          }
        }
      }, 120);
      return true;
    } catch (_) { return false; }
  }

  function scan() {
    currentVideoId = getVideoId();
    try {
      publishPlayerResponse(window.ytInitialPlayerResponse);
      const config = window.ytplayer?.config;
      publishPlayerResponse(config?.args?.player_response);
      publishPlayerResponse(config?.args?.raw_player_response);
      publishPlayerResponse(config?.playerResponse);
      publishPlayerResponse(document.querySelector('#movie_player')?.getPlayerResponse?.());
    } catch (_) {}
    // This is the key CC-independent route: YouTube's transcript endpoint is
    // called directly using the endpoint params already embedded in the page.
    fetchInnertubeTranscript().then(found => { if (!found) triggerTranscriptPanelFallback(); }).catch(() => triggerTranscriptPanelFallback());
    triggerTranscriptPanelFallback();
  }

  installNetworkHooks();
  scan();

  let count = 0;
  const timer = setInterval(() => {
    scan();
    if (++count > 80) clearInterval(timer);
  }, 150);

  window.addEventListener('yt-navigate-finish', () => {
    seenTrackSignatures.clear(); seenDataSignatures.clear(); lastTranscriptAttemptAt = 0; transcriptPanelFallbackAt = 0; currentVideoId = getVideoId(); scan();
  }, true);
  window.addEventListener('yt-page-data-fetched', () => { lastTranscriptAttemptAt = 0; transcriptPanelFallbackAt = 0; currentVideoId = getVideoId(); scan(); }, true);
  window.addEventListener('yt-page-data-updated', () => { lastTranscriptAttemptAt = 0; transcriptPanelFallbackAt = 0; currentVideoId = getVideoId(); scan(); }, true);
  window.addEventListener('beforeunload', () => clearInterval(timer), { once: true });

  emit(DIAG_EVENT, { version: '4.0.0', networkHooks: installedNetworkHooks });
})();
