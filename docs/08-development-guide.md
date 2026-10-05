# Development Guide

## Source layout

```text
src/
  background.js
  content/
    youtube.js
    youtube.css
  popup/
    popup.html
    popup.css
    popup.js
  options/
    options.html
    options.css
    options.js
  shared/
    levels.js
    storage.js
```

## Code comments

Every source file contains a header comment describing its responsibility. Functions that perform non-obvious work include local comments or documentation comments.

## Testing

### Manual smoke test

1. Load the unpacked extension.
2. Open YouTube.
3. Confirm the toolbar appears inside the player.
4. Turn captions on.
5. Play a video and confirm transcript entries accumulate.
6. Capture a moment.
7. Save a bookmark.
8. Add the video to Watch Later.
9. Save vocabulary.
10. Open the popup and verify counts.
11. Export the backup.
12. Open Options and save settings.

## YouTube maintenance

YouTube's DOM is not a stable public extension API. Selectors may change. The content script therefore isolates YouTube selectors in a small number of functions so they can be updated independently.

## No CI requirement

The repository intentionally has no `.github/workflows` directory. Local loading and Chrome packaging are sufficient for development.
