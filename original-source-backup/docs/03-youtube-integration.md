# YouTube Integration

## Why the content script matters

The Chrome popup cannot place a persistent toolbar inside the YouTube player. The extension therefore uses a Manifest V3 content script on YouTube pages. The content script observes the dynamic YouTube DOM, identifies the active video, reads available caption-track data and renders the Charlie MJ learning layer.

## Caption extraction

YouTube exposes caption track metadata as part of the player data. Charlie MJ locates the available track, chooses the configured source language when possible, requests the timed-text payload and converts it into timestamped segments.

The parser supports JSON3-style caption responses and XML timed-text responses.

## Dynamic navigation

YouTube is a single-page application. Opening another video does not necessarily reload the document. The extension therefore combines a MutationObserver with lightweight URL polling. When the video ID changes, caption state and learning state are reinitialized.

## Native three-dot menu

The extension cannot ask YouTube to permanently register an arbitrary Chrome extension command inside YouTube's private React/web-component menu system. Instead, Charlie MJ observes the menu DOM and injects a clearly labeled **Charlie MJ — Add to Watch Later** item when YouTube's overflow menu is open.

There is also a standard Chrome context-menu fallback and the in-video Watch Later button.

## Important maintenance note

YouTube's internal markup is not a stable public extension API. If YouTube changes menu selectors or caption internals, the adapter may need a maintenance update. The extension deliberately isolates YouTube-specific selectors inside the content script so the rest of the learning library does not need to change.
