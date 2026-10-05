# Charlie MJ Language — Caption Engine Root-Cause Fix v3.6.0

## Why earlier versions could still fail

The previous engine depended heavily on caption-track URLs and on transcript parameters already being present in the first page payload. Current YouTube pages can expose the transcript endpoint only after the `next`/watch response is available.

## v3.6 acquisition order

1. Observe the player response in the MAIN world.
2. Inspect `ytInitialData` for `getTranscriptEndpoint.params`.
3. If parameters are not present, request YouTube's own `next` endpoint with the current page client context and video ID.
4. Extract the transcript endpoint parameters from that response.
5. Call `get_transcript` with the same YouTube client context.
6. Observe the real player's timedtext/get_transcript network response as a fallback.
7. If the transcript panel is available, use its timestamped DOM rows as the final browser-side fallback.
8. Convert every cue into `{ start, duration, text }`.
9. The isolated content script selects the active cue using `HTMLVideoElement.currentTime` and binary search.

## Performance

Transcript requests are throttled and deduplicated. The engine does not issue a new network transcript request every animation frame. Timeline synchronization remains local and can run at display-frame frequency without additional network traffic.

## Translation

Translation is attached by cue index/text cache. The original subtitle never waits for translation; the current cue is translated first and upcoming cues are prefetched.

## Diagnostics

The toolbar's More menu contains **Caption engine status**. It reports video ID, player availability, track count, cue count, active cue, current time, translation cache size and bridge status.

## External dependency caveat

YouTube controls its private page/player APIs. This architecture uses several independent acquisition paths to reduce breakage, but it cannot guarantee compatibility with future undocumented YouTube changes.
