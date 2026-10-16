# Dual Transcript — v1.0.0 Stable Beta

## Purpose
Dual Transcript is an additional subsystem for displaying a YouTube video's original caption track together with a YouTube-native translated track.

## Entry points
- Dual Transcript button in the YouTube learning toolbar
- Dual Transcript tab in the existing Transcript window
- Dedicated Dual Transcript settings tab

## Workflow
1. Detect the current YouTube video and caption information.
2. Discover/use the relevant YouTube timed-text request/session information.
3. Fetch the original track.
4. Request the YouTube-native translated track when the target language differs.
5. Parse timestamped cues.
6. Align original and translated cues.
7. Merge cues into readable learning sentences.
8. Synchronize the current sentence with the YouTube timeline.
9. Display the Dual Transcript view.

## Features
- Original transcript
- YouTube-native translation
- Target language
- Cue alignment
- Sentence merging
- Timeline synchronization
- Search
- Refresh
- Local cache
- Original subtitle color
- Translated subtitle color
- Current sentence
- Speaker indicator
- Speaker replay/seek
- Word/sentence saving where supported

## Independence
Dual Transcript is optional. Its failure must not break the original transcript system.
