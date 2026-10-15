# Development Guide

## Source layout

The project intentionally avoids a build framework so it can be loaded directly in Chrome. This makes the repository easy to inspect and modify.

## Coding conventions

- Every source file begins with a documentation comment.
- Keep YouTube-specific code in `src/content/youtube.js`.
- Keep translation/network orchestration in the service worker.
- Keep persistent data in `chrome.storage.local`.
- Prefix UI CSS classes with `cmj-`.
- Do not add remote executable JavaScript.
- Keep user-facing features functional without a mandatory login.

## Testing loop

1. Edit source.
2. Open `chrome://extensions`.
3. Reload the extension.
4. Refresh YouTube.
5. Test video navigation because YouTube is an SPA.
6. Test captions, translation, saving, exporting and Watch Later.

## Future module boundaries

The next major refactors should separate:

- `caption-engine.js`
- `translation-engine.js`
- `language-analyzer.js`
- `storage-engine.js`
- `export-engine.js`
- platform adapters for Netflix, Prime Video and other services
