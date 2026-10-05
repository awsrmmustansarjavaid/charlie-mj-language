# Charlie MJ Language v3.5.0 — Realtime Caption Fetch Architecture

## Why v3.5 was necessary

YouTube caption fetching changed. A caption `baseUrl` exposed by the web player can now return HTTP 200 with an empty body when fetched independently because the player may add a runtime proof-of-origin token. A plain `fetch(baseUrl)` is therefore no longer a reliable primary strategy.

Charlie MJ v3.5 stops treating that direct request as the main path.

## Primary caption pipeline

```text
YouTube SPA navigation
        ↓
MAIN-world bridge at document_start
        ↓
Read player response / caption tracks
        ↓
Read ytInitialData transcript endpoint params
        ↓
Call YouTube get_transcript when available
        ↓
Observe player's timedtext / get_transcript fetch/XHR
        ↓
Parse timed cues
        ↓
Send cues to isolated extension world
        ↓
Synchronize against HTML5 video.currentTime
```

## CC button

The extension does not require the learner to turn YouTube CC on for the `get_transcript` path. If YouTube's own player requests timedtext, the bridge can also capture the player's real response.

## Timeline synchronization

The renderer uses the video's `currentTime` as the source of truth. Cue selection uses binary search and a requestAnimationFrame-driven synchronization loop. Seeking, play, metadata loading, and SPA navigation reset the active cue state.

## Direct timedtext fallback

A direct caption URL fetch is retained only as a short, abortable fallback. It is intentionally capped so an empty-body YouTube response cannot freeze subtitle startup for many seconds.

## Diagnostics

The bridge emits `cmj-youtube-caption-diagnostics`. Future diagnostic UI can expose whether the following succeeded:

- player response
- caption track discovery
- transcript endpoint parameter discovery
- get_transcript response
- player timedtext response
- XHR timedtext response
- direct fallback
- parsed cue count

## Translation

Translation starts after cue data arrives. Upcoming cue translation is prefetched so the next sentence can already be cached when the video reaches it.

## Known platform limitation

YouTube controls its internal player and caption infrastructure. If YouTube changes the transcript endpoint shape, proof-token mechanism, or page data structure, this bridge may require another compatibility update.
