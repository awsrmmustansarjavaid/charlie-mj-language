# Charlie MJ Language v2.1.0 — Additive Focus + Category Intelligence Update

This release preserves existing features and adds two independent subsystems.

## Focus additions

- Optional page fullscreen request from Focus Mode to hide Chrome browser chrome where Chrome allows it.
- Independent YouTube UI switches for navbar, search, logo, profile, notifications, Create, sidebar, recommendations, Shorts, comments, video actions and related videos.
- Optional Focus hiding of video info and description through the new engine while preserving the existing controls.
- Hide triggers: immediately, video start, inactivity and mouse leaving the video.
- Configurable hide delay, top-edge reveal zone, re-hide delay and fade/instant behavior.
- Mouse proximity reveal and automatic re-hide.
- Optional bottom-edge reveal for the Charlie MJ toolbar without replacing the existing toolbar auto-hide system.
- Focus HUD with session timer and position options.
- Additional Deep Focus, Video Only and Minimal profiles; existing General, Tech, Language Learning, Productivity and Custom modes remain.
- Optional 25/5, 50/10 and 80/20 focus/break session plans with optional automatic restart.

## Category intelligence fixes

- Rule engine now accepts both `part` and legacy `category` rule shapes.
- Compound-word normalization supports names such as `TurkuazKitchen`.
- Turkish food/travel/technology/history vocabulary was added without removing existing vocabulary.
- Recent video titles and playlist titles are now available as categorization signals.
- Existing library categories are scored as first-class candidates.
- Learned accepted category signals are stored separately in `cmjCategoryLearning`.
- Top candidate results and evidence are returned for low-confidence choices.
- Added a Rule Tester to Extension Intelligence settings.
- Added a manual Re-categorize Uncategorized action in the YouTube Library.
- Added controls for compound matching, multilingual vocabulary, recent videos, playlist titles, candidate count and bulk re-categorization.

## Compatibility

All new Focus controls are additive. Existing Focus, Night Focus, toolbar, subtitle and transcript behavior remains available and is not removed.
