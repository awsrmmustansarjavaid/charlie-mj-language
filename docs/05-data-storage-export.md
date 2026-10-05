# Data, Storage and Export

## Local storage

The current implementation uses `chrome.storage.local` for settings and learning records. This keeps the first release simple and portable.

Stored collections include:

- settings
- vocabulary
- bookmarks
- watchLater
- captures
- transcripts
- stats

## Download structure

The service worker uses Chrome's downloads API and a relative download path such as:

```text
Charlie MJ Language/
  Transcripts/
  Vocabulary/
  Bookmarks/
  Screenshots/
  Audio/
  Thumbnails/
  Notes/
  Backups/
```

Chrome controls the actual Downloads root. An extension cannot silently choose arbitrary Windows filesystem locations.

## Backup

The popup's Export Data action writes a JSON backup containing the local learning collections.

## Future exports

The architecture reserves room for:

- TXT
- CSV
- TSV
- JSON
- Markdown
- SRT
- VTT
- HTML
- Anki package/card formats

## Data ownership

The user should always be able to export important learning records without an account or proprietary database lock-in.
