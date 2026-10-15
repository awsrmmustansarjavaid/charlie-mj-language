# Charlie MJ Language — Database

This directory is an export/sync layout for the additive YouTube Library system.

- `channels/<category>.json` — channels grouped by category.
- `playlists/<category>.json` — playlists grouped by category.
- `categories/<category>.json` — category records when exported as individual files.
- `suggestions/` — YouTube suggestions kept separate from Favorites.
- `indexes/` — small lookup indexes used for fast startup and duplicate detection.

The Chrome extension's live source of truth remains its namespaced local storage. The database directory is a portable/sync representation so existing library behavior is not replaced.

For local PC sync, the extension uses an explicit directory permission rather than silently accessing arbitrary filesystem paths. GitHub synchronization uses the repository Contents API.
