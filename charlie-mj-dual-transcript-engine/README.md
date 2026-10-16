# Charlie MJ Dual Transcript Engine

A standalone, lightweight Chrome/Chromium extension whose only core job is to obtain a **complete original + YouTube-native translated transcript** from YouTube as quickly as possible, cache it locally, and keep both tracks synchronized with `video.currentTime`.

## Name / directory

- Extension name: **Charlie MJ Dual Transcript Engine**
- Directory: **`charlie-mj-dual-transcript-engine`**
- Manifest V3
- No framework and no npm dependency
- No developer-owned backend
- No mandatory third-party translation API

## What it does

- Captures the caption request made by YouTube itself, including current proof-of-origin parameters when present.
- Fetches the complete original caption track rather than requesting subtitle fragments one at a time.
- Requests the complete YouTube auto-translated track with `tlang` when YouTube supports that language.
- Parses YouTube JSON3 captions into a small normalized cue model.
- Aligns original and translated cues.
- Merges fragmented ASR cues into readable sentences without throwing away raw timing.
- Uses binary search + `requestAnimationFrame` for precise timeline synchronization.
- Caches completed dual transcripts locally with an LRU limit.
- Provides a dual subtitle overlay.
- Provides a searchable complete transcript panel; clicking a sentence seeks the YouTube video.
- Adds a small DT control to the YouTube player when the control bar is available.
- Supports YouTube SPA navigation and Shorts URLs.
- Has no analytics, login, telemetry, developer server, or required API key.

## Installation

1. Extract this folder.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the folder containing `manifest.json`.
6. Open a YouTube video with captions.

## Test workflow

1. Open a video with normal or auto-generated captions.
2. Select a target language in the extension popup.
3. YouTube's CC/caption track must exist for the source transcript.
4. The engine captures YouTube's own caption request and downloads the full track.
5. It then requests YouTube's translated track when available.
6. Open the **DT** button or the extension popup's transcript panel.
7. Seek, pause, resume, and navigate to another YouTube video. The transcript should remain synchronized.

## Important behavior

This project deliberately uses YouTube's own caption/translation infrastructure first. It does **not** pretend that a public transcript API is stable. YouTube changes internal caption behavior, so the fetching layer is isolated in `src/inject.js` and `src/content.js` so it can be updated without changing the transcript UI or consumer API.

If YouTube does not expose a requested translated track, this first standalone version reports that translation as unavailable instead of silently sending caption text to an external translation service. This preserves the project's direct-to-YouTube, lightweight goal.

## Internal API boundary

The engine is intentionally separable from the UI. Future Charlie MJ integration should consume the normalized data instead of implementing another caption fetcher.

Main data fields:

```js
{
  videoId,
  sourceLanguage,
  targetLanguage,
  cues: [
    { id, start, end, text, translated }
  ],
  sentences: [
    { id, start, end, original, translated, cueIds }
  ]
}
```

## File map

- `manifest.json` — MV3 permissions and entry points.
- `src/inject.js` — MAIN-world YouTube request observer and player metadata bridge.
- `src/content.js` — fetching, JSON3 parsing, translation-track fetching, alignment, cache integration, synchronization and UI bridge.
- `src/background.js` — tiny persistent cache service worker.
- `src/content.css` — lightweight overlay and transcript-panel styling.
- `src/popup.*` — settings and manual refresh controls.
- `docs/ARCHITECTURE.md` — detailed design and future integration plan.
- `docs/TESTING.md` — acceptance test checklist.
- `docs/SOURCES.md` — technical references used as architectural inspiration.

## License

This standalone implementation is released under the MIT License. It is a clean implementation of the documented architecture and does not copy source code from the reference repositories.

YouTube and Google are trademarks of their respective owners. This project is not affiliated with or endorsed by YouTube or Google.
