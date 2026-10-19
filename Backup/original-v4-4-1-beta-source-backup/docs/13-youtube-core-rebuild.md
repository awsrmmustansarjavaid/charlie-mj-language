# Charlie MJ Language v3.0 — YouTube Core Rebuild

## Why v3 was required

The earlier prototype depended too heavily on a page-HTML regular expression and placed most of the interface outside the actual player lifecycle. That made the core experience unreliable: the toolbar could be missing and subtitle tracks could remain empty.

Version 3 changes the foundation rather than adding another workaround.

## New subtitle architecture

### 1. MAIN-world bridge

`src/content/youtube-page-bridge.js` runs in YouTube's page world. It reads the current `ytInitialPlayerResponse` caption metadata and dispatches a DOM event containing only the caption-track information required by Charlie MJ.

### 2. Isolated learner engine

`src/content/youtube.js` receives that event, fetches the selected caption track, parses JSON/XML timed-text responses, merges duplicate segments and synchronizes them to the HTML5 video element.

### 3. Native caption fallback

The engine also observes `.ytp-caption-segment`. If YouTube has rendered native CC but the track response has not become available yet, Charlie MJ can still show a live learning subtitle and word translation.

## Toolbar placement

The toolbar is now attached directly to `#movie_player`, rather than depending on a generic page container. A second small learning-status bar is inserted below the video metadata area.

## Watch Later

There are three routes:

1. Charlie MJ player toolbar → **Watch Later**.
2. YouTube overflow menu → **Charlie MJ — Add to Watch Later**, inserted by a DOM observer when a menu is visible.
3. Chrome right-click context menu → **Charlie MJ Language → Add YouTube video to Watch Later**.

The second route is necessarily DOM-based because YouTube does not expose its internal three-dot menu as a public extension API.

## Translation

Current providers are local-configurable through the background service worker:

- MyMemory
- LibreTranslate (user-provided endpoint)

Translations are cached in `chrome.storage.local`. Google Translate itself is not open source; an official Google Cloud Translation provider can be added later with the user's own credentials without changing the subtitle architecture.

## Validation

The release process validates:

- Manifest JSON
- JavaScript syntax
- Required content-script files
- No GitHub Actions workflow
- ZIP contents

## Known external dependency

YouTube can change its internal DOM and player implementation without notice. The extension therefore has multiple caption paths and multiple Watch Later paths, but a future YouTube markup change can still require selector maintenance.
