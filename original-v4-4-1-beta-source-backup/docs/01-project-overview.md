# Project Overview

## What is Charlie MJ Language?

Charlie MJ Language is a Chrome extension designed for learners who use real online media as their classroom. The first-class experience is YouTube, where the learner can watch a video, read original and translated subtitles, inspect individual words, save vocabulary, capture moments and build a personal learning library without leaving the video.

## Why build it?

Traditional subtitle tools often solve only one problem: displaying another language. Charlie MJ Language combines comprehension and productivity. A learner should be able to move from a difficult sentence to a saved vocabulary item, a timestamped bookmark, a screenshot, a transcript export and a later review session without copying information manually between applications.

## Product philosophy

- Local-first: learner data is stored in Chrome whenever possible.
- Exportable: vocabulary and learning artifacts should not be locked inside the extension.
- Context-first: words are saved with their sentence and video context.
- Focus-first: YouTube recommendations should not dominate a study session.
- Language-agnostic: Turkish is an important use case, but the architecture supports other languages.
- Modular: translation, language analysis and UI systems can evolve independently.

## Primary user journey

1. Open YouTube.
2. Start a video with captions.
3. Charlie MJ detects the video and loads the caption track.
4. The learning toolbar appears around the video.
5. Original and translated subtitles appear together.
6. The learner hovers a word for meaning and language information.
7. The learner saves vocabulary, bookmarks and screenshots.
8. The learner opens Complete Transcript.
9. The extension translates missing transcript segments and exports the complete learning document.
10. The learner reviews saved material in My Library.
