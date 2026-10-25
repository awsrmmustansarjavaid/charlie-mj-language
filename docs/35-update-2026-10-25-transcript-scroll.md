# Update 2026-10-25 --- Transcript windows scroll sync (Transcript, Dual Transcript, YT Transcript Pro)

## Root cause

* In the Transcript and Dual Transcript tabs the list element does not scroll itself; the outer `.cmj-panel-body` does.
  The old code called `list.scrollTo()` (no effect) or `scrollIntoView()` (moves every ancestor, including the YouTube page).
* Two competing controllers in the Transcript tab, and a manual-scroll flag cleared after 180 ms while smooth scrolling lasts longer,
  so the controller treated its own scrolling as manual scrolling.
* Panel re-renders (translations arriving, settings changes) reset the scroll position and re-triggered follow logic, also while paused.

## Fix

| File | Change |
|---|---|
| `src/lib/transcript-scroll.js` | **New.** `CMJScroll`: one follower per tab. Finds the real scroll container, scrolls only it, never moves while paused, hard re-sync on seek/click/open/Play, manual-scroll hold with catch-up, reads the shared settings. |
| `manifest.json` | Loads the module before `youtube.js`, `dualTranscript.js` and `ytp-content.js`. |
| `src/content/youtube.js` | Transcript tab uses `CMJScroll`; old `cmjAdditional*` / `bindLiveTranscriptScroll` scrollers removed; `updateLiveTranscriptHighlight()` only highlights; re-render keeps the scroll position, opening the tab jumps to the live line. |
| `src/dual-transcript/dualTranscript.js` | Uses `CMJScroll`; re-render keeps position. |
| `src/transcript-pro/ytp-content.js` | Uses `CMJScroll`; re-render keeps position; mount jumps to the live line. |
| `src/options/options.html`, `options.js` | New section **Transcript Windows Scroll** (Subtitles & Timeline). Legacy duplicate scroll controls removed from Live Transcript Highlighting. |

## New settings (main settings object)

`transcriptScrollEnabled`, `transcriptScrollTranscript`, `transcriptScrollDual`, `transcriptScrollPro`, `transcriptScrollOnSeek`,
`transcriptScrollPosition` (center/top/bottom), `transcriptScrollBehavior` (smooth/instant), `transcriptScrollRespectManual`, `transcriptScrollResumeSec`.
Older `liveTranscriptAutoScroll`, `liveTranscriptScrollPosition`, `liveTranscriptRespectManualScroll` values are used until the new keys are saved.

## Manual test checklist

1. Play: the active subtitle stays at the chosen position in all three tabs.
2. Pause: wait 30 s, nothing moves.
3. Pause and click the YouTube timeline: the list jumps to the new subtitle.
4. Scroll manually while playing: the list stays; after the delay it catches up.
5. Scroll manually while paused: it never snaps back; pressing Play catches up.
6. The YouTube page does not scroll.
