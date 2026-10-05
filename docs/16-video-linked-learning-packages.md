# Video-Linked Learning Packages

## Problem solved

A transcript by itself is not enough when a learner studies several YouTube videos. Charlie MJ Language 3.1 therefore treats the video as the ownership boundary for learning material.

For example:

```text
Video A — Ege'den | Muğla-Menteşe Yemişendere Mahallesi
  ├─ transcript + translation
  ├─ vocabulary
  ├─ bookmarks
  └─ notes

Video B — another YouTube lesson
  ├─ transcript + translation
  ├─ vocabulary
  ├─ bookmarks
  └─ notes
```

## Complete TXT package

The complete text export contains:

1. YouTube title
2. URL
3. Video ID
4. source and target languages
5. complete timestamped transcript
6. translation for each subtitle segment
7. vocabulary saved from that video
8. vocabulary translation, CEFR, POS, sentence and timestamp
9. bookmarks from that video
10. notes from that video

This fixes the earlier behavior where a text download could contain subtitles but omit the associated vocabulary context.

## JSON package

JSON preserves the structured collections separately as `captions`, `vocabulary`, `bookmarks` and `notes`. It is the preferred archival/backup format.

## Multiple-video library exports

The library dashboard groups records by `videoId`. Human-readable exports print a separate `VIDEO:` section for each source video, so material from different videos remains traceable.

## Future compatibility

The video ID is deliberately stored separately from the title because YouTube titles can change. A timestamp is stored as seconds so the dashboard can reopen the video at the original learning moment.
