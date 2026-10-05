# Notes, Settings and Downloads

## Word popup

Clicking a subtitle word opens one reusable word card. Clicking another word replaces the same card instead of creating a stack of windows.

The card supports:

- explicit `×` close button;
- close when clicking outside the card;
- automatic close after the configured short delay;
- POS and CEFR information;
- translation;
- save-to-vocabulary.

## Per-video notes

The Notes tab stores notes under the current YouTube video ID. A learner can create multiple independent text boxes and remove them later.

Basic formatting includes:

- bold;
- larger/smaller text;
- unordered bullet lists;
- editable rich text;
- automatic local saving while typing;
- explicit Save button.

Notes are included in complete video learning-package exports.

## Toolbar visibility

Settings now include **Show Charlie MJ toolbar under the YouTube video**. Turning it off removes the in-player toolbar while keeping the extension popup and learning panel available.

## Downloads directory

Chrome extensions cannot safely select an arbitrary Windows filesystem folder through the Downloads API. Charlie MJ therefore accepts a **relative directory inside the user's normal Downloads folder**.

Example:

```text
Charlie MJ Language
```

produces organized paths such as:

```text
Downloads/Charlie MJ Language/
Downloads/Charlie MJ Language/Transcripts/...
Downloads/Charlie MJ Language/Vocabulary/...
Downloads/Charlie MJ Language/Screenshots/...
Downloads/Charlie MJ Language/Library/...
Downloads/Charlie MJ Language/Exports/...
```

An optional **Ask me where to save every download** setting enables Chrome's save dialog instead of automatic placement.
