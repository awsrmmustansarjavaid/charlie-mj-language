# Charlie MJ Language v4.1.4 — Library Export & Learning Cards

## Purpose

This release extends the existing Library rather than replacing it. Existing YouTube timestamp navigation, collections, favorites, settings, search and Library actions remain available.

## Library exports

Copy works for the current Library page and individual items. Download/Export can operate on one selected item or one/multiple Library sections. Formats include TXT, Markdown, DOC, PDF, JSON, CSV, SRT, VTT and Anki TSV where applicable.

## Detailed learning cards

Words, vocabulary and sentences now expose a Details / Card action containing original text, translation, language, A1-C2 level, difficulty, video metadata, exact timestamp, saved date, collections, favorite state, tags, notes and source context.

## Sentence study

Sentence cards show the complete translation first, followed by word-by-word analysis. Saved sentence records retain analyzed words. When word-level translations are missing, Charlie MJ requests them from the configured translation provider (MyMemory by default) and stores the resulting word analysis locally. POS, lemma and Turkish suffix/case/tense heuristics are shown where available.

## PDF

PDF export is generated locally in the extension. The document is rendered to paginated images so Turkish and other Unicode text can be preserved without requiring a remote PDF service.

## Compatibility

Chrome Manifest V3. No GitHub Actions are required.
