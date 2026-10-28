# Transcript, Export and File Organization

## Complete transcript

The transcript contains:

- YouTube title
- URL
- source language
- target language
- timestamps
- original subtitle text
- translated subtitle text

When the learner chooses an export, missing translations are requested and cached before the file is created.

## Formats

Current working exports:

- TXT
- JSON
- SRT
- vocabulary CSV
- screenshot PNG

The architecture can add VTT, Markdown and Anki formats without changing the storage model.

## Organized downloads

Exports use Chrome's Downloads API with organized relative paths such as:

```text
Charlie MJ Language/
├── Transcripts/<Video>/
├── Vocabulary/<Video>/
├── Screenshots/<Video>/
├── Bookmarks/
└── Thumbnails/
```

Chrome controls the actual system Downloads directory. A normal browser extension cannot silently choose and write to arbitrary filesystem directories. A future desktop wrapper can provide unrestricted folder selection.
