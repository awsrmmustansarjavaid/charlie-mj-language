# Architecture

## Runtime model

Charlie MJ Language is a Manifest V3 Chrome extension. It uses a service worker for background operations, a YouTube content script for page integration, a popup for quick controls, and an options page for settings.

```text
Chrome
  |
  +-- Popup ---------------------- local learning library
  |
  +-- Options -------------------- settings / provider configuration
  |
  +-- YouTube Content Script ----- video/subtitle/focus/capture UI
  |
  +-- Service Worker ------------- commands / downloads / shared events
  |
  +-- chrome.storage.local ------- local-first learning data
```

## Data flow

1. YouTube renders captions.
2. The content script observes caption nodes.
3. Caption text and timestamps are normalized into transcript records.
4. User can capture a word, sentence, screenshot moment or bookmark.
5. Records are stored locally.
6. Popup exposes the local library.
7. Export messages are sent to the service worker.
8. The service worker uses Chrome's downloads API to write files under the configured relative Downloads path.

## Why no build system?

The project deliberately uses plain HTML, CSS and JavaScript. This keeps the repository easy to audit and install as an unpacked extension. A future production release can introduce TypeScript/Vite without changing the product model.

## Extension boundaries

The extension does not attempt to bypass YouTube access controls or obtain private media. It works with information available to the active page, particularly captions rendered in the YouTube UI.
