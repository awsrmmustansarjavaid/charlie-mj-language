# Charlie MJ Language v4.1.0 — Final Learning Library

## Product model

Charlie MJ Language is organized around one connected **Video Learning Record**.

```text
YouTube Video
  ├─ Progress / Sessions
  ├─ Checkpoints
  ├─ Transcript Segments
  ├─ Word Learning
  ├─ Sentence Learning
  ├─ Vocabulary
  ├─ Bookmarks
  ├─ Notes
  ├─ Captures
  ├─ Collections
  └─ Review signals
```

Every learning item should preserve the video ID, URL and timestamp whenever available.

## Library

- Overview
- Continue Learning
- History
- Collections
- Videos
- Transcripts
- Word Learning
- Sentence Learning
- Vocabulary
- Bookmarks
- Watch Later
- Notes
- Captures
- Favorites
- Checkpoints
- Review / Weak Words

## Continue Learning

The extension records:

- exact YouTube position
- watch percentage
- current subtitle/sentence index
- current sentence text
- learning mode
- study mode
- playback speed
- subtitle/translation mode
- session timestamp
- cumulative study time
- completion state

Long videos can therefore be resumed from the exact learning context instead of only the last approximate position.

## Collections

A user-created collection stores a name, tags and description. Library records can be added to multiple collections without moving or deleting the original record.

## Toolbar

The toolbar contains watching actions. Settings provide a Toolbar Manager where actions can be dragged between Visible Toolbar and More Menu.

Default visible actions:

- CMJ
- Transcript
- Word
- Sentence
- Save
- Bookmark
- Capture
- Watch Later
- Focus
- Theme

The More Menu contains translation, replay, loop, speed, A/B replay, Study Mode, saving sentence, exports, report, diagnostics and settings.

## Synchronization architecture

The same caption segment data drives:

- Complete Transcript
- Word Learning
- Sentence Learning
- Subtitle overlay
- translation
- timeline seeking
- resume state

A segment contains its start time, duration, source text and translated text when available.

## Productivity

The current release includes:

- Focus Mode
- Study Mode
- Smart replay / repeated replay
- A/B sentence loop
- playback speed controls
- learning checkpoints
- Continue Learning queue
- progress statistics
- weak-word review signals
- keyboard shortcuts from the existing extension

## Data and privacy

The extension remains local-first. Learning records are stored in `chrome.storage.local`. Translation may call the configured translation provider when enabled. Exports are explicitly downloaded by the user.
