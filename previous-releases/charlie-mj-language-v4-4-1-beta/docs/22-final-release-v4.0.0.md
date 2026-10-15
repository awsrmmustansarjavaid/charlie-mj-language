# Charlie MJ Language v4.0.0 — Final Release

## Release focus

v4.0.0 keeps the v3.6 caption acquisition/timeline engine and adds the learner-facing display, sentence mining, study controls and vocabulary-library improvements requested for the final Chrome extension.

## Subtitle display

- Original + translation, original-only, translation-only and sentence-to-sentence modes.
- Independent original and translation font sizes.
- Independent bold, underline and italic settings.
- Source POS colors are reused for corresponding translated tokens in word-to-word mode.
- Sentence CEFR level and learner difficulty label are available from A1–C2.

## Sentence learning

- Save the active subtitle as a sentence-learning record.
- Keep video title, URL, video ID and timestamp.
- Keep sentence translation, level, tags and learning stage.
- Transcript lines remain clickable for timestamp navigation.

## Video learning

- Replay current subtitle 1–5 times.
- A/B replay between the active caption and the next caption boundary.
- Playback speeds 0.5×, 0.75×, 1×, 1.25× and 1.5×.
- Optional auto-pause when a new subtitle begins.
- Study Mode hides the translation until the learner clicks it.

## Vocabulary library

Vocabulary records now carry an explicit `type`: `word` or `sentence`. The in-video Vocabulary panel and Library dashboard can filter these independently and render tags/labels in a responsive grid.

## Export

The existing local export system remains available for TXT, CSV and JSON; transcript exports include SRT/VTT, and library export supports an Anki-compatible tab-separated format.

## Compatibility note

YouTube caption acquisition relies on page/player behavior that YouTube can change. The extension uses multiple acquisition paths and timestamped cue synchronization, but no private YouTube endpoint can be guaranteed permanently compatible.
