# Architecture

```text
Chrome Extension
│
├── manifest.json
├── background/service-worker.js
│   ├── context menus
│   ├── commands
│   ├── translation providers
│   └── downloads
│
├── content/youtube.js
│   ├── YouTube SPA detection
│   ├── caption extraction
│   ├── subtitle rendering
│   ├── word analysis
│   ├── Focus Mode
│   ├── bookmarks
│   ├── screenshots
│   ├── Watch Later
│   └── transcript panel
│
├── content/page-translator.js
│   └── explicit selection translation
│
├── popup/
│   └── quick controls and statistics
│
├── dashboard/
│   └── Watch Later / vocabulary / bookmarks
│
└── options/
    └── language, translation and appearance settings
```

## Data flow

```text
YouTube video
   ↓
Content script
   ↓
Caption track parser
   ↓
Timestamped subtitle model
   ├── subtitle renderer
   ├── translation request → service worker → provider
   ├── vocabulary storage → chrome.storage.local
   ├── bookmarks → chrome.storage.local
   └── transcript exporter → chrome.downloads
```

## Storage model

The primary collections are:

- `settings`
- `vocabulary`
- `bookmarks`
- `watchLater`
- `lastWatchLaterRequest`
- cached translation keys

## Security model

No remote JavaScript is executed. All extension code is bundled in the repository, matching the Manifest V3 model. External services are called only for data operations such as translation.
