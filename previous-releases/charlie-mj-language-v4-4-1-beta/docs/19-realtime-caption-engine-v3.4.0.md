# Charlie MJ Language v3.4.0 — Real-Time Caption Engine

## Purpose

Version 3.4 changes caption acquisition so the extension does not depend on YouTube CC being visible. A MAIN-world page bridge reads YouTube player caption metadata and immediately fetches the selected caption track in the page execution world.

## Timeline synchronization

The extension keeps its own ordered cue list and selects the active cue from `HTMLVideoElement.currentTime` using binary search. Playback, metadata, and seeking events force immediate synchronization; the normal polling interval is configurable.

## Translation latency

When a caption becomes active, Charlie MJ translates it immediately and can prefetch the next configurable number of captions. This reduces visible translation delay during continuous playback.

## Toolbar

The toolbar is a viewport-level fixed overlay rather than a child constrained to `#movie_player`. It can be dragged with the mouse anywhere in the browser viewport and its pixel position is persisted. Chrome extensions cannot make an in-page overlay follow the cursor outside the browser viewport or become a native Windows always-on-top window without a separate desktop/native application.

## Theme

Dark, light, and system-following learning interface themes are available in settings.

## YouTube compatibility

YouTube is a changing third-party application. Caption URLs and player internals can change, and some caption requests may be gated by YouTube. Multiple discovery/fetch paths and retry logic are therefore retained.
