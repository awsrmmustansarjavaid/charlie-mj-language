/*
 * YT Transcript Pro - page bridge (runs in YouTube's own JS world).
 *
 * Content scripts live in an isolated world and cannot call methods that
 * YouTube attaches to the player element (getPlayerResponse, setOption ...)
 * or read window.ytcfg. This tiny bridge runs in the page world, answers
 * requests from the content script via window.postMessage, and returns plain
 * data only. It never touches the UI.
 */
(() => {
  'use strict';
  if (window.__ytpBridge) return;
  window.__ytpBridge = true;

  const SRC_CS = 'YTP_CS';
  const SRC_PAGE = 'YTP_PAGE';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const getPlayer = () =>
    document.querySelector('#movie_player') ||
    document.querySelector('ytd-player #movie_player') ||
    document.querySelector('.html5-video-player');

  const cfg = (key) => {
    try {
      return window.ytcfg?.get?.(key) ?? window.ytcfg?.data_?.[key];
    } catch {
      return undefined;
    }
  };

  /* ---------- player response (current video only) ---------- */
  const matches = (resp, videoId) => resp?.videoDetails?.videoId === videoId;

  async function innertubePlayer(videoId, client) {
    const key = cfg('INNERTUBE_API_KEY');
    const baseContext = cfg('INNERTUBE_CONTEXT') || {
      client: {
        clientName: 'WEB',
        clientVersion: cfg('INNERTUBE_CLIENT_VERSION') || '2.20250101.00.00',
        hl: 'en',
      },
    };
    const context =
      client === 'ANDROID'
        ? {
            client: {
              clientName: 'ANDROID',
              clientVersion: '20.10.38',
              androidSdkVersion: 30,
              hl: 'en',
              gl: 'US',
            },
          }
        : baseContext;
    const url =
      '/youtubei/v1/player?prettyPrint=false' + (key ? `&key=${encodeURIComponent(key)}` : '');
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ context, videoId, contentCheckOk: true, racyCheckOk: true }),
    });
    if (!res.ok) throw new Error(`Player request failed (${res.status})`);
    return res.json();
  }

  async function getPlayerResponse(videoId) {
    try {
      const resp = getPlayer()?.getPlayerResponse?.();
      if (matches(resp, videoId) && resp.captions) return resp;
    } catch {
      /* player API may not be ready */
    }
    try {
      if (
        matches(window.ytInitialPlayerResponse, videoId) &&
        window.ytInitialPlayerResponse.captions
      )
        return window.ytInitialPlayerResponse;
    } catch {
      /* ignore */
    }
    for (const client of ['WEB', 'ANDROID']) {
      try {
        const resp = await innertubePlayer(videoId, client);
        if (matches(resp, videoId) && resp.captions) return resp;
      } catch {
        /* try next client */
      }
    }
    // Last resort: return whatever the player has, even without captions, so the UI can explain.
    try {
      const resp = getPlayer()?.getPlayerResponse?.();
      if (matches(resp, videoId)) return resp;
    } catch {
      /* ignore */
    }
    return null;
  }

  const text = (node) => node?.simpleText || node?.runs?.map((r) => r.text).join('') || '';

  async function getTracks({ videoId }) {
    const resp = await getPlayerResponse(videoId);
    const list = resp?.captions?.playerCaptionsTracklistRenderer;
    const tracks = (list?.captionTracks || [])
      .map((t, i) => ({
        id: `${t.languageCode || 'und'}-${t.kind || 'manual'}-${i}`,
        languageCode: t.languageCode || 'und',
        name: text(t.name) || t.languageCode || `Track ${i + 1}`,
        kind: t.kind || 'manual',
        baseUrl: t.baseUrl,
        isTranslatable: Boolean(t.isTranslatable),
      }))
      .filter((t) => t.baseUrl);
    const translationLanguages = (list?.translationLanguages || [])
      .map((l) => ({
        languageCode: l.languageCode,
        name: text(l.languageName),
      }))
      .filter((l) => l.languageCode);
    const d = resp?.videoDetails || {};
    return {
      videoId,
      title: d.title || '',
      author: d.author || '',
      lengthSeconds: Number(d.lengthSeconds) || 0,
      playability: resp?.playabilityStatus?.status || '',
      playabilityReason: resp?.playabilityStatus?.reason || '',
      tracks,
      translationLanguages,
    };
  }

  /* ---------- timedtext fetching (handles YouTube's PO-token requirement) ---------- */
  const timedtextEntries = () =>
    performance.getEntriesByType('resource').filter((e) => e.name.includes('/api/timedtext'));

  function potParams() {
    const entries = timedtextEntries();
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      try {
        const u = new URL(entries[i].name);
        if (u.searchParams.get('pot')) {
          const out = {};
          ['pot', 'potc', 'c', 'cver'].forEach((k) => {
            if (u.searchParams.get(k)) out[k] = u.searchParams.get(k);
          });
          return out;
        }
      } catch {
        /* skip */
      }
    }
    return null;
  }

  /* One request at a time with a small gap, and back-off on 429/5xx, so we never trip YouTube's rate limit. */
  let queue = Promise.resolve();
  const enqueue = (fn) => {
    const run = queue.then(fn);
    queue = run.catch(() => {}).then(() => sleep(250));
    return run;
  };

  async function fetchText(url) {
    let last = { ok: false, status: 0, body: '' };
    for (const wait of [0, 1200, 3000]) {
      if (wait) await sleep(wait);
      const res = await fetch(url, { credentials: 'include' });
      last = { ok: res.ok, status: res.status, body: res.ok ? await res.text() : '' };
      if (res.ok || (res.status !== 429 && res.status < 500)) return last;
    }
    return last;
  }

  const startPlayerCaptions = (player, track) => {
    player.loadModule?.('captions');
    const want = { languageCode: track.languageCode };
    if (track.kind === 'asr') want.kind = 'asr';
    player.setOption('captions', 'track', want);
  };

  /** Ask the player itself to load a caption track so it produces a valid, signed timedtext request. */
  async function primeFromPlayer(track) {
    const player = getPlayer();
    if (!player?.setOption) return false;
    const before = timedtextEntries().length;
    let previous = null;
    try {
      previous = player.getOption?.('captions', 'track');
    } catch {
      /* ignore */
    }
    try {
      startPlayerCaptions(player, track);
    } catch {
      return false;
    }
    for (let i = 0; i < 20; i += 1) {
      await sleep(150);
      if (timedtextEntries().length > before && potParams()) break;
    }
    try {
      if (previous?.languageCode) player.setOption('captions', 'track', previous);
      else player.unloadModule?.('captions');
    } catch {
      /* ignore */
    }
    return Boolean(potParams());
  }

  /** Translations are signed per language: make the player request this exact translation and reuse its URL. */
  async function primeTranslation(track, tl) {
    const player = getPlayer();
    if (!player?.setOption) return null;
    const before = timedtextEntries().length;
    let previous = null;
    try {
      previous = player.getOption?.('captions', 'track');
    } catch {
      /* ignore */
    }
    let found = null;
    try {
      startPlayerCaptions(player, track);
      player.setOption('captions', 'translationLanguage', { languageCode: tl });
      for (let i = 0; i < 28 && !found; i += 1) {
        await sleep(150);
        found =
          timedtextEntries()
            .slice(before)
            .reverse()
            .find((e) => {
              try {
                const u = new URL(e.name);
                return u.searchParams.get('tlang') === tl && u.searchParams.get('pot');
              } catch {
                return false;
              }
            })?.name || null;
      }
    } catch {
      /* ignore */
    }
    try {
      if (previous?.languageCode) player.setOption('captions', 'track', previous);
      else player.unloadModule?.('captions');
    } catch {
      /* ignore */
    }
    return found;
  }

  const limitMessage = (status) =>
    status === 429
      ? 'YouTube is limiting requests (429). Click Reset YouTube connection in the toolbar popup, or wait a few minutes.'
      : `Caption request failed (${status}).`;

  async function fetchTimedTextNow({ url, track }) {
    const u = new URL(url, location.origin);
    u.searchParams.set('fmt', 'json3');
    const tl = u.searchParams.get('tlang');
    const ok = (r) => r.ok && r.body.trim();

    // 1) Plain request.
    let r = await fetchText(u.toString());
    if (ok(r)) return { body: r.body, via: 'direct' };
    if (r.status === 429) throw new Error(limitMessage(429));

    // 2) Reuse the signature the player already produced.
    let pot = potParams();
    if (!pot && track) {
      await primeFromPlayer(track);
      pot = potParams();
    }
    if (pot) {
      const withPot = new URL(u);
      Object.entries(pot).forEach(([k, v]) => withPot.searchParams.set(k, v));
      r = await fetchText(withPot.toString());
      if (ok(r)) return { body: r.body, via: 'pot' };
      if (r.status === 429) throw new Error(limitMessage(429));
    }

    // 3) Translations: let the player request this exact translation, then reuse its signed URL.
    if (tl && track) {
      const signed = await primeTranslation(track, tl);
      if (signed) {
        const su = new URL(signed);
        su.searchParams.set('fmt', 'json3');
        r = await fetchText(su.toString());
        if (ok(r)) return { body: r.body, via: 'player-translation' };
        if (r.status === 429) throw new Error(limitMessage(429));
      }
    }

    // 4) Legacy XML format as a final attempt.
    u.searchParams.delete('fmt');
    r = await fetchText(u.toString());
    if (ok(r)) return { body: r.body, via: 'xml' };

    throw new Error(
      r.ok ? 'YouTube returned an empty caption file for this track.' : limitMessage(r.status)
    );
  }
  const fetchTimedText = (payload) => enqueue(() => fetchTimedTextNow(payload));

  /** Forget signatures and cached timing entries; used by the Reset button. */
  async function resetNetwork() {
    try {
      performance.clearResourceTimings();
    } catch {
      /* ignore */
    }
    try {
      getPlayer()?.unloadModule?.('captions');
    } catch {
      /* ignore */
    }
    queue = Promise.resolve();
    return true;
  }

  /* ---------- playback helpers ---------- */
  function getState() {
    const player = getPlayer();
    return {
      hasPlayer: Boolean(player),
      videoId: (() => {
        try {
          return player?.getVideoData?.().video_id || '';
        } catch {
          return '';
        }
      })(),
    };
  }

  const handlers = {
    tracks: getTracks,
    timedtext: fetchTimedText,
    state: getState,
    reset: resetNetwork,
  };

  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.source !== SRC_CS || !handlers[msg.type]) return;
    try {
      const data = await handlers[msg.type](msg.payload || {});
      window.postMessage({ source: SRC_PAGE, id: msg.id, ok: true, data }, '*');
    } catch (error) {
      window.postMessage(
        { source: SRC_PAGE, id: msg.id, ok: false, error: String(error?.message || error) },
        '*'
      );
    }
  });
})();
