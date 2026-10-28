# Update 2026-10-27: Focus controls, rule-based categorization, final polish

Version stays **v2.0.0**. All changes are additive.

## Focus (Settings > Productivity & Focus Intelligence)

- **Focus Modes** card: Active Mode, Focus Profile (General, Tech, Language Learning, Productivity,
  Custom), Focus Strictness (%), Temporary Focus Topic, Focus Session (minutes).
  - Strictness sets how strongly recommendation/Shorts/comment areas fade (70% = the original look).
  - Temporary topic: a local notice (and a distraction signal) when a video title shares no word with it.
  - Focus session: Focus Mode switches itself off after N minutes (0 = no timer).
- **Hide Video Info / Details** (title, channel, actions) and **Hide YouTube Description**, each with a
  delay (Immediately, 5 s, 10 s, 30 s, 1 min, Custom) and **Restore hidden areas when Focus ends**.
  Only `ytd-watch-metadata` blocks are hidden. The player, subtitles, Charlie MJ toolbar and the
  Transcript / Dual Transcript / YT Transcript Pro windows are never touched.
- **Toolbar Theme** is also available in this tab (mirrors the Toolbar setting).
- Night Focus settings (intensity, radius, glow, transition, native-UI opacity) are now applied to the
  independent overlay. YouTube's own CSS/DOM is never modified.

## Metadata auto-categorization (database/youtube-metadata-auto-categorization/)

- `rules/default.json` now holds combinable rules (`part`, `group`, `order`, keywords, phrases, tags,
  labels, `countryCodes`, `languageCodes`, `priority`, `weight`, `enabled`).
- Engine (service worker): country -> language -> weighted keyword/tag/label rules -> combination ->
  existing-category match -> explanation. Example: TR + travel + motorcycle + vlog = `TR Travel Biker Vlogger`.
- `country-keywords.json` was enriched with demonyms and major cities.
- Add dialog: detected country/language/keywords, **Why was this category suggested?**, confidence level,
  and `+ Create "name"` for new categories.
- Data Sync > YouTube Metadata Auto-Categorization: export, import, download JSON, **Download Directory ZIP**,
  **Restore Default Rules**, **Compare with GitHub**.

## Other

- YT Transcript Pro tab no longer shows Download Folder / Save As (use Settings > Downloads).
- Data Sync action buttons use one equal-size grid.
- All source files formatted with the project's Prettier configuration.
