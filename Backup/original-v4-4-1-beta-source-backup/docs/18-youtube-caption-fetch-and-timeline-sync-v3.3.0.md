# Charlie MJ Language — YouTube Caption Fetch & Timeline Sync

## Purpose

This release makes YouTube caption acquisition independent from the visible YouTube CC switch. Charlie MJ reads caption-track metadata from multiple player-response surfaces and downloads the caption track directly.

## Discovery order

- MAIN-world `ytInitialPlayerResponse`
- `ytplayer.config.args.player_response`
- `ytplayer.config.playerResponse`
- `#movie_player.getPlayerResponse()`
- page script fallback
- delayed SPA polling

## Timeline synchronization

The extension keeps its own subtitle timeline and compares it with the HTML5 video `currentTime`. A binary search selects the active segment, with configurable tolerance and polling intervals. Seeking and normal playback therefore use the same synchronization path.

## CC independence

The learner does not have to click YouTube CC. The extension's subtitle layer is independent of YouTube's native caption visibility. If YouTube exposes no caption track for a video, the extension reports that condition instead of pretending that CC must be enabled.

## Toolbar

The toolbar can be always visible or revealed when the mouse is near it. It can be dragged within the player and double-clicked on its background to reset its position.
