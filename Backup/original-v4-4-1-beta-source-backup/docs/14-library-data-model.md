# Library, Data Model and Import/Export

## Purpose

Charlie MJ Language 3.1 treats the library as a real learning database rather than a simple list. Watch Later, Vocabulary and Bookmarks are built-in collections, while learners can create their own custom collections.

## Built-in pages

- **Watch Later** — saved YouTube videos.
- **Vocabulary** — words and sentence-mining records.
- **Bookmarks** — timestamped learning moments.

Every page supports:

- Copy
- Download
- Export
- Import
- Search
- Tag filtering
- Video filtering
- Responsive card/grid layout

Vocabulary and bookmark pages additionally expose CEFR information when it exists.

## Custom library pages

Custom pages are stored in `libraryPages`. Each page has an ID, name, tags and creation time. Its records live in a separate `libraryPage_<id>` storage key.

Learners can:

- create a page such as `Turkish B1`, `YouTube Course`, or `Difficult Words`;
- add saved vocabulary, bookmarks or Watch Later items to it;
- search and filter it;
- copy/download/export/import it;
- delete it and its records.

## Video ownership

Saved records should retain:

- `videoId`
- `videoTitle` / `title`
- `url`
- `timestamp` when relevant
- `subtitle` or sentence context
- translation when available
- tags and CEFR/POS metadata

This prevents material from Video A and Video B from becoming indistinguishable.

## Import/export

JSON is the recommended backup format because it preserves the complete object structure. CSV is useful for spreadsheet workflows and simple vocabulary migration. TXT is designed for human reading.

The export dialog can select multiple library pages in one operation. Downloading is also multi-page aware and asks which pages should be included.

## Data ownership

The library uses Chrome local storage. No mandatory account or cloud database is required. Users can export their data whenever they want.
