# Update 2026-10-25 --- Settings deep link, Library search, Subtitle Learning

## Files changed

| File | Change |
|---|---|
| `src/background/service-worker.js` | `ytp:openOptions` opens/re-uses the Settings tab on a requested category (default *YT Transcript Pro*). |
| `src/options/options.js` | Reads `?category=` / `#hash` and selects that Settings tab before the remembered one. |
| `src/transcript-pro/ytp-content.js` | Open-settings button sends the category; per-line **Save** button, **Save selected (n)**, `saveLines()` writes `subtitleLearning`. |
| `src/transcript-pro/ytp-defaults.js` | New setting `showLineSave: true`. |
| `src/dashboard/dashboard.js` | New *Subtitle Learning* tab; hardened, accent-insensitive, debounced search; safe tag handling. |
| `src/dashboard/dashboard.html` | *Subtitle Learning* type filter. |

## Subtitle Learning record

```json
{
  "id": "uuid", "type": "subtitle", "source": "Subtitle Learning",
  "sentence": "original subtitle", "translation": "translated subtitle",
  "sentenceTranslation": "translated subtitle",
  "language": "tr", "targetLanguage": "en", "level": "B1",
  "videoId": "...", "videoTitle": "...", "channel": "...", "url": "...",
  "timestamp": 12.4, "endTimestamp": 15.1,
  "tags": ["YouTube", "Subtitle", "B1"], "createdAt": "ISO-8601"
}
```

## Manual test checklist

1. Open a YouTube video, open YT Transcript Pro, click **Open settings** → Settings opens on *YT Transcript Pro*.
2. Click the bookmark icon on a line → toast *saved to My Library › Subtitle Learning*; click again → *Already in My Library*.
3. Ctrl/Shift-select several lines → **Save selected (n)**.
4. My Library → Learning → **Subtitle Learning**: Details, Copy, Add to Collection, Checkpoint, Open at time, Download, Export, Remove.
5. Type a title word, a saved word, a sentence fragment, a note word or a translation in the Library search bar → matching cards appear from all tabs.
