# Charlie MJ Language 5.0.0 — Additive Final Upgrade

Version remains **5.0.0**. Existing systems are retained; new systems are additive.

## Added

- Category View/Open/Edit/Remove actions and category detail view.
- Existing-category-first Extension Intelligence with confidence controls.
- Category knowledge base under `data/category-knowledge/`.
- Separate YouTube Suggestions tab for CHANNEL and PLAYLIST suggestions.
- Services settings for legacy optional transcript comparison (removed in maintenance build), Local AI and optional services.
- Performance settings with Lightweight/Balanced/Performance profiles and service lifecycle controls.
- Data Sync settings for local database folder permission and GitHub repository health/compare/pull/backup.
- Portable database layout under `database/` with category files, suggestions and small indexes.
- Additional Learning Window settings inside UI Components.
- Original thumbnail metadata preservation and stable channel/playlist identity fields.
- Duplicate detection based on stable Channel ID / Playlist ID when available.
- legacy optional transcript comparison (removed in maintenance build) fallback hardened so the extension no longer depends on the WEB player request path that commonly returns HTTP 403.

## Performance model

Startup is intentionally limited to Core, Settings, lightweight UI, small indexes and existing essential functionality. Expensive services are on-demand or sleeping according to Performance settings. Background metadata refresh is disabled unless optional background tasks are explicitly enabled.

## GitHub/local database note

Chrome extensions cannot silently write to arbitrary PC paths. Local database sync therefore requires the user to select a folder with the browser's directory permission. GitHub mode uses the GitHub Contents API and requires a repository URL and appropriate credentials.
