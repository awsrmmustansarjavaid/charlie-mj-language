# Charlie MJ Language — v1.0.0 Stable Beta

> A lightweight, local-first Chrome extension for learning languages through YouTube.

![Charlie MJ Language v1.0.0 Stable Beta](assets/charlie-mj-language-main-thumbnail.png)

Charlie MJ Language keeps the original fast YouTube transcript workflow as its core engine and adds optional learning, transcript, library, category, synchronization, performance, and Dual Transcript systems around it.

## Download

<p align="center">
  <a href="/downloads/charliemj-language-v1.0.0-stable-beta-final.zip">
    <img src="https://img.shields.io/badge/%E2%AC%87%20Download%20Chrome%20Extension-2ea44f?style=for-the-badge" alt="Download Chrome Extension">
  </a>
</p>

## Table of Contents

- [Overview](#overview)
- [Version and Platform](#version-and-platform)
- [Critical Core Functionality](#critical-core-functionality)
- [Performance and Lightweight Architecture](#performance-and-lightweight-architecture)
- [Dual Transcript](#dual-transcript--additional-system)
- [Transcript Window](#transcript-window--additional-restore-behavior)
- [Library and Notes](#library-notes--add-note)
- [Local AI Learning](#local-ai-learning)
- [YouTube Learning Interface](#youtube-learning-interface)
- [My Learning Library](#my-learning-library)
- [Categories](#categories)
- [Data Sync](#data-sync)
- [Settings](#settings)
- [Installation](#installation)
- [Recommended First-Run Configuration](#recommended-first-run-configuration)
- [Troubleshooting](#troubleshooting)
- [Development Guidelines](#development-guidelines)
- [Regression Testing](#regression-testing)
- [License](#license)
## Overview

Charlie MJ Language brings together:

- YouTube subtitles and the complete timestamped transcript
- Fast automatic transcript fetching
- Click-to-seek transcript timeline navigation
- Transcript scrolling and synchronization with video playback
- Original and translated subtitles
- Vocabulary and sentence learning
- Notes, bookmarks, Watch Later, and learning-library tools
- Favorite YouTube Channels and Playlists
- Learning Groups
- Categories and category intelligence
- YouTube metadata and thumbnail support
- YouTube suggestions
- Data import/export and synchronization tools
- Optional Local AI/Ollama learning services
- Additional Learning window controls
- Performance and service-lifecycle controls
- Customizable toolbar, transcript window, subtitles, and learning UI

The systems are designed to work independently. Basic transcript functionality does not depend on Dual Transcript, Local AI, metadata services, or other optional services.

---

## Version and Platform

- **Version:** `1.0.0 Stable Beta`
- **Platform:** Chrome Extension — Manifest V3
- **Minimum Chrome version:** 114
- **License:** MIT
- **Repository:**  [GitHub repository](https://github.com/awsrmmustansarjavaid/charlie-mj-language)

![Charlie MJ Language v1.0.0 Stable Beta](assets/YouTube%20Learning%20Companion%20Extension.png)

## Critical Core Functionality

### Fast Complete YouTube Transcript

The original transcript system is the primary and authoritative transcript engine.

The v1.0.0 Stable Beta release **does not replace or rewrite the original transcript-fetching implementation**.

The default engine remains:
```text
legacy-youtube
```

The core transcript workflow is:

1. Open a YouTube video.
2. The extension detects the video.
3. The original transcript engine fetches the available complete caption track.
4. The complete timestamped transcript becomes available in the transcript window.
5. The user can freely scroll through the transcript.
6. Transcript rows remain associated with their timestamps.
7. Clicking a transcript row seeks the YouTube video to that timestamp.
8. Playback and transcript position remain synchronized where supported.
9. Existing subtitle, translation, vocabulary, sentence, notes, and learning workflows continue to use the transcript.

### Core preservation requirement

New services must never:

- replace `legacy-youtube`
- rewrite its fetching algorithm merely to support another service
- delay the original transcript while waiting for Dual Transcript
- require Local AI for transcript fetching
- create a second YouTube player
- continuously intercept YouTube traffic for basic transcript operation
- remove transcript scrolling or timeline seeking
- remove existing transcript-learning functionality

The original transcript remains the reference source for additional transcript comparison.

---

## Performance and Lightweight Architecture

v1.0.0 Stable Beta is designed so that optional services do not make normal YouTube playback heavy.

### Startup principle

The extension should load only what is required for normal operation:

- core extension logic
- existing transcript functionality
- required settings
- lightweight UI
- small indexes/cache metadata

Heavy or optional services remain dormant until needed.

### Service lifecycle

Optional services follow an event-driven lifecycle:
```text
IDLE

  ↓

ACTIVE

  ↓

INACTIVE

  ↓

SLEEPING

  ↓

WAKE

  ↓

ACTIVE
```

Enabled does **not** mean continuously running.

### Performance controls

The Performance settings provide controls for:

- lightweight startup
- on-demand service activation
- service sleep timeout
- resource-intensive service enable/disable
- lazy loading
- caching
- background-task controls
- event-driven operation
- reduced unnecessary polling
- reduced unnecessary YouTube requests

The goal is for normal YouTube playback and the original fast transcript path to remain the priority.

---

## Additional Transcript Services

The original `legacy-youtube` transcript system remains the primary and authoritative transcript path.

Dual Transcript is an **additional, independent transcript system**. It does not replace, rewrite, delay, or become a dependency of the original transcript engine.

The original transcript remains the reference source for:

- complete timestamped transcript fetching
- transcript scrolling
- timeline seeking
- playback synchronization
- subtitles and translation
- vocabulary and sentence learning

No second YouTube player is created.

---

## Dual Transcript — Additional System

Dual Transcript is an optional additional transcript system. It does not replace or rewrite the original transcript engine.

### Entry points

Dual Transcript can be opened from:

- the additional **Dual Transcript** button in the YouTube learning toolbar
- the additional **Dual Transcript** tab inside the existing Transcript window

### Fetching

The system works directly with YouTube caption information and YouTube-native translation. Its workflow is:
```text
YouTube video
    ↓
YouTube player/caption information
    ↓
Real timed-text request/session detection
    ↓
Original caption track
    ↓
YouTube-native translated track
    ↓
Cue parsing and alignment
    ↓
Sentence merging
    ↓
YouTube timeline synchronization
    ↓
Dual Transcript UI
```

The original transcript engine remains independent.

### Dual Transcript features

- Original subtitle/transcript
- YouTube-native auto-translated subtitle/transcript
- Target-language selection
- Complete timestamped cues
- Cue alignment
- Sentence merging
- Timeline synchronization
- Current-sentence tracking
- Search
- Refresh
- Local caching
- Translation availability status
- Original subtitle color
- Translated subtitle color
- Synchronized speaker icon
- Speaker replay/seek behavior
- Dedicated Dual Transcript settings
- Toolbar access
- Transcript-window tab
- Save supported words to the existing library
- Save supported sentences to the existing library

### Dual Transcript colors

The dedicated **Dual Transcript** settings area provides independent colors for:

- Original subtitle
- Translated subtitle

These colors affect the Dual Transcript display and do not replace the existing general subtitle styling.

### Current sentence and speaker icon

The optional speaker icon follows the sentence currently synchronized with the YouTube video's playback position.

Dual Transcript settings provide controls for:

- speaker indicator enable/disable
- speaker icon color
- speaker icon size
- current-sentence synchronization

The speaker action can seek/replay the associated sentence where supported.

### Dual Transcript settings

A separate **Dual Transcript** settings tab/section contains its own controls rather than replacing previous settings.

### Dual Transcript independence

If Dual Transcript cannot obtain a translated track, the original transcript workflow remains available. Translation availability depends on YouTube and the video's available caption tracks.

---

## Transcript Window — Additional Restore Behavior

The existing Transcript window keeps its normal drag, resize, minimize, maximize, pin, close, restore, scrolling, and tab behavior.

When the Transcript window is minimized, an additional hover-based restore/maximize control can appear when the mouse is moved near the minimized window. This provides a visible way to restore the window without replacing the existing window-management system.

---

## Library Notes — Add Note

The **Notes** area of My Learning Library includes an additional **Add Note** action.

A note can contain information such as:

- title
- note text
- YouTube URL where applicable
- timestamp where applicable

Notes remain local learning records and must not be silently overwritten by metadata refresh or optional services.

---

### Data Sync — Default GitHub Repository

The GitHub Repository URL field defaults to:
```text
https://github.com/awsrmmustansarjavaid/charlie-mj-language
```

The URL remains editable by the user.

---

## Local AI Learning
Local AI/Ollama is an **optional service**.

It is not required for the original transcript engine.

When enabled and available, it can support learning workflows such as:

- word explanations
- vocabulary analysis
- sentence explanations
- context-aware translation
- literal and natural translation
- alternative translations
- translation verification
- grammar explanations
- pronunciation/romanization information where supported
- part-of-speech information
- synonyms and related vocabulary
- example sentences
- vocabulary extraction
- transcript sentence analysis
- learning exercises
- flashcard generation
- quiz generation
- sentence simplification
- formal/informal alternatives
- Anki-oriented export workflows

Ollama runs locally and is contacted only when an AI operation is requested.

### AI safety/performance rule

Local AI must never become a dependency for:

- opening YouTube
- playing YouTube videos
- fetching the original transcript
- scrolling the transcript
- transcript timeline seeking
- basic subtitles
- normal extension startup

---

## YouTube Learning Interface

### Learning toolbar

The YouTube learning toolbar supports configurable:

- position
- size
- scale
- button arrangement
- hover/reveal behavior
- visibility
- auto-hide behavior

The toolbar remains integrated with the extension's YouTube learning workflow.

### Transcript window

The transcript window supports:

- dragging
- resizing width
- resizing height
- corner resizing
- minimize
- maximize
- pin
- close
- restore
- saved position
- saved dimensions
- viewport protection
- scrolling
- transcript tabs
- synchronized playback

### Additional Learning window

The Additional Learning window follows the same window-management model as transcript windows:

- resize width
- resize height
- minimize
- maximize
- pin
- close
- restore
- remember position
- remember size

---

## Live Transcript Highlighting

Live Transcript Highlighting synchronizes the active transcript row with playback.

Features include:

- enable/disable
- transparent highlight
- rounded background
- underline
- left accent
- text-color highlighting
- custom highlight color
- background opacity
- active text color
- speaker indicator
- playback synchronization
- subtitle synchronization
- optional automatic transcript scrolling
- center/top/bottom auto-scroll positioning
- manual-scroll protection
- transition-duration control
- preview
- reset

The feature operates on existing timestamped transcript segments and does not replace the transcript-fetching engine.

---

## Subtitles and Translation

The extension supports:

- original subtitles
- translated subtitles
- subtitle appearance controls
- independent subtitle layout controls
- width and height controls
- maximum line controls
- wrapping
- padding
- corner radius
- opacity
- typography
- line spacing
- translation display
- timestamp synchronization

Native on-screen captions may be used as a fallback when timestamped transcript information is unavailable.

---

## Word and Sentence Learning

Learning tools include:

- interactive word lookup
- translation
- dictionary information
- provider/source information where available
- part-of-speech highlighting
- vocabulary capture
- sentence saving
- timestamp-linked learning records
- sentence replay
- looping
- A/B replay
- playback-speed learning controls
- notes
- bookmarks

---

## My Learning Library

The local learning library supports:

- vocabulary
- saved sentences
- bookmarks
- notes
- Watch Later
- learning records
- search
- filtering
- import/export
- local-first storage

Existing learning data should remain independent from optional services.

---

## YouTube Favorites Library

The Favorites workspace supports:

## Favorite Channels

Save and manage YouTube channels using stable Channel IDs.

## Favorite Playlists

Save and manage playlists using stable Playlist IDs.

## Learning Groups

The collection system is presented as **Learning Groups**.

Learning Groups support:

- View
- Edit
- Remove
- resource management
- category association
- learning organization

## Channel and Playlist cards

Cards can include:

- View Detail
- View/Open
- Edit
- Remove
- item count
- description
- type/source
- pinned status

Inside a collection/detail view, individual resources can also be managed.

## Saving resources

When saving a YouTube channel or playlist, the user can select a category.

Duplicate detection uses stable YouTube IDs rather than names.

Therefore:

- the same ID is treated as the same resource
- different IDs may have the same display name
- names are not used as the primary identity

---

## Categories

The library includes a dedicated **Category** area alongside:

- Favorite Channels
- Favorite Playlists
- Learning Groups

Categories can organize:

- channels
- playlists
- learning resources

## Category cards

Category cards can show:

- category name
- description
- item count
- source/type
- pinned status
- View
- Open
- Edit
- Remove

## Category detail

A category detail view provides access to the channels and playlists assigned to that category, with resource-level actions.

---

## Extension Intelligence

The **Extension Intelligence** settings provide optional category assistance.

Capabilities include:

- master enable/disable
- automatic category detection
- existing-category suggestions
- new-category suggestions
- minimum confidence
- prefer existing categories
- automatic application of high-confidence suggestions
- confirmation before creating categories
- learning from accepted suggestions
- learning from rejected suggestions

Potential information sources include:

- YouTube metadata
- title
- description
- tags/keywords
- existing local categories
- category knowledge data

### Important rule

The extension must not silently create a new category when a suggestion has not been confirmed by the user.

---

## Category Knowledge

The category knowledge directory is organized separately from the extension UI:
```text
data/

└── category-knowledge/

    ├── youtube-categories.json

    ├── learning-categories.json

    ├── category-keywords.json

    └── category-rules.json
```

Official YouTube categories remain distinct from extension-specific learning categories.

---

## YouTube Suggestions

The Suggestions workspace separates recommendations from Favorites.

It supports:

- Suggested Channels
- Suggested Playlists

Each result clearly identifies its type:
```text
CHANNEL

PLAYLIST
```

Supported actions include:

- View
- Open
- Save to Favorites
- Add Category
- Add Learning Group
- Ignore

Suggestions are not automatically treated as Favorites.

---

## Metadata and Thumbnails

The Favorites/library system can obtain YouTube metadata and thumbnails when available.

Metadata can include:

- title
- description
- channel information
- playlist information
- thumbnail
- stable YouTube ID
- source URL

Refresh operations must not overwrite user-owned:

- notes
- tags
- categories
- learning data

Metadata refresh should be rate-limited, cached, and performed only when needed.

---

## Data Sync

The ****Data Sync**** system provides one clear workspace for maintaining local data and optional GitHub-backed backups/synchronization.

The Data Sync workspace is intentionally presented as a ****single Data Sync section**** so the user is not confused by repeated sections for the same feature.

Supported actions include:

- local database status
- GitHub database status
- total local record count
- total GitHub record count
- per-resource counts for channels, playlists, and categories
- Choose Local Folder
- Validate Local
- Health Check
- Compare Local ↔ GitHub
- Pull from GitHub
- Prepare ZIP Backup
- scheduled synchronization
- separate JSON data files
- indexes for fast lookup

**### Compare Local ↔ GitHub**

The comparison result is displayed as a structured result view rather than raw JSON. It should clearly separate:

- Local totals
- GitHub totals
- matching records
- local-only records
- GitHub-only records
- changed/different records
- database directories/files involved
- recommended next action

**### ZIP backup**

****Prepare ZIP Backup**** creates one downloadable ZIP archive containing the structured database JSON files and indexes. It does not download the backup as a single loose JSON file.

Stable IDs remain the primary identity:
```text
Channel ID

Playlist ID
```

**### Important browser limitation**

A normal Chrome extension cannot silently write to arbitrary local filesystem paths.

Supported approaches require an appropriate browser permission/API such as:

- user-selected File System Access locations
- a Native Messaging helper
- browser download/import flows
- GitHub API/repository synchronization

The extension must not claim unrestricted access to arbitrary folders.

---

**# Import and Export**

JSON is the primary structured backup format.

Export can include:

- saved channels
- saved playlists
- categories
- Learning Groups
- notes
- tags
- metadata
- stable IDs

Import supports:

- JSON validation
- duplicate detection
- merge
- replace where explicitly selected
- preservation of existing records during merge
- invalid/skipped-record reporting
- backup restoration

TXT exports can provide a readable list containing:

- channel/playlist name
- URL
- category
- tags
- notes
- date added

---

### Settings

The existing settings remain part of the extension.

New settings are organized into dedicated sections/tabs rather than replacing previous settings.

Important settings areas include:

- UI Components
- Subtitle and Timeline
- Appearance
- Service Engine
- Local AI
- Favorites
- Categories
- Extension Intelligence
- Data Sync
- YouTube Suggestions
- Performance
- Additional Learning Window

Settings should remain backward-compatible with existing stored values.

---

## UI Design

The settings workspace uses a grid-oriented layout.

The interface is designed around:

- responsive two-column desktop settings
- single-column narrow layouts
- grouped controls
- consistent cards
- accessible switches
- clear navigation
- readable spacing
- live previews where appropriate
- unsaved-change indication
- preserved setting IDs and storage keys where possible

Existing functionality should not be removed merely to redesign the interface.

---

## Notifications and Save Reliability

Save operations should report success only after the underlying storage operation succeeds.

This applies to areas such as:

- Watch Later
- bookmarks
- notes
- vocabulary
- sentences
- library records
- settings

If Chrome invalidates an extension content-script context after an extension reload/update, storage-dependent operations should fail safely and request a page refresh rather than falsely reporting success.

---

## Privacy and Storage

Charlie MJ Language is local-first.

Local settings and learning records are stored using Chrome extension storage and/or appropriate local extension storage mechanisms.

Some optional features may contact external services when the user requests them, such as:

- translation providers
- dictionary providers
- GitHub synchronization
- Ollama on the user's own computer

External service use should occur only for the relevant feature and should not be required for basic transcript functionality.

Users should review the privacy policies and terms of any external provider they choose to use.

---

## Installation

1. Download or clone this repository.
2. Extract the ZIP if necessary.
3. Open Chrome.
4. Visit:
```text
chrome://extensions/
```

5. Enable **Developer mode**.
6. Click **Load unpacked**.
7. Select the extension directory containing `manifest.json`.
8. Open or refresh a YouTube video.

If YouTube was already open when the extension was installed or reloaded, refresh the YouTube tab once.

---

## Recommended First-Run Configuration

For the lightest normal YouTube experience:

1. Keep the original `legacy-youtube` transcript engine enabled.
2. Keep the original transcript workflow as the default.
3. Leave Dual Transcript inactive until needed.
4. Leave Local AI inactive until needed.
5. Use Performance settings to configure service sleep/on-demand behavior.
6. Enable metadata refresh only when needed.
7. Use category intelligence only if automatic category assistance is desired.
8. Configure Data Sync separately from normal transcript operation.

This keeps the critical path focused on:
```text
YouTube

  ↓

Original Transcript Engine

  ↓

Complete Transcript

  ↓

Scroll / Timeline / Learning
```

---

## Project Structure
```text
charlie-mj-language/

│

├── assets/

├── data/

│   └── category-knowledge/

│       ├── youtube-categories.json

│       ├── learning-categories.json

│       ├── category-keywords.json

│       └── category-rules.json

│

├── docs/

├── icons/

│

├── src/

│   ├── background/

│   ├── content/

│   │   ├── youtube.js

│   │   └── youtube-page-bridge.js

│   ├── dashboard/

│   ├── favorites/

│   ├── lib/

│   ├── options/

│   └── popup/

│

├── transcript-service.config.json

├── manifest.json

├── LICENSE

└── README.md
```

The exact source tree may evolve as new independent services are added. The important architectural rule is that the original transcript implementation remains isolated and authoritative.

---

## Architecture Principles

## Strict additive-only development rule

For this project, existing working systems and features are treated as **untouchable unless the user explicitly requests a change**.

When adding functionality:

- add new code as an independent subsystem where practical
- do not remove an existing feature to make room for a new feature
- do not replace a working implementation simply because a new implementation is available
- do not change unrelated existing behavior
- keep existing settings and storage compatible
- test the original feature before and after every new integration
- treat a regression in an existing working feature as a release blocker

v5.0.0 follows these principles:

### 1. Preserve the core

The original fast complete-transcript engine is not replaced.

### 2. Add, don't remove

New functionality is additive.

### 3. Independent services

Dual Transcript, Local AI, Favorites, Categories, Data Sync, Intelligence, and other services operate independently.

### 4. No unnecessary continuous work

Optional services should sleep when inactive.

### 5. Event-driven operation

Prefer events and explicit user actions over aggressive polling.

### 6. Stable identities

Use YouTube Channel IDs and Playlist IDs instead of names as primary identifiers.

### 7. Safe storage

Do not silently erase existing user data.

### 8. Backward compatibility

Existing settings, storage, transcript workflows, and learning records should remain usable.

### 9. No second YouTube player

Additional transcript services must not recreate the YouTube player.

### 10. Original transcript remains authoritative

Additional transcript sources are compared against the original rather than replacing it.

---

## Regression Testing

Before releasing a build, verify at minimum:

### Core transcript

- YouTube video loads normally.
- YouTube playback starts without extension-induced buffering.
- Original transcript automatically appears.
- Complete transcript is fetched.
- Transcript can scroll to the end.
- Transcript timestamps remain available.
- Clicking a transcript row seeks the video.
- Playback and transcript remain synchronized.
- Original subtitles still work.
- Translation still works.

### Additional transcript services

- No Dual Transcript / Dual Fetch service is loaded.
- The original transcript engine remains unchanged.
- Additional optional services cannot delay or replace the original transcript.
- No second YouTube player is created.

**## Local AI**

- AI can be disabled.
- Disabling AI does not affect the transcript.
- AI requests occur only when an AI feature is used.
- Failure to connect to Ollama does not break YouTube.

### Library

- Channels can be saved.
- Playlists can be saved.
- Stable IDs prevent duplicate records.
- Same-name resources with different IDs remain separate.
- Categories can be assigned.
- Learning Groups support view/edit/remove.
- Metadata and thumbnails can refresh without overwriting user data.

### Performance

- Extension startup remains lightweight.
- YouTube playback remains responsive.
- Optional services remain idle until required.
- No unnecessary continuous network traffic is generated.
- Service sleep/wake behavior works as configured.

### Settings

- Existing settings remain available.
- New settings appear in their intended sections/tabs.
- Settings persist after Chrome restart.
- Grid layout remains usable at different widths.

---

## Known Platform Considerations

YouTube can change its player, caption endpoints, page structure, and internal APIs without notice.

Caption availability varies by video and may depend on:

- available language tracks
- manual captions
- auto-generated captions
- auto-translation availability
- YouTube changes
- video-owner settings

Therefore, no extension can guarantee a particular caption language for every YouTube video.

Live Chrome/YouTube regression testing should be performed before distributing a production build.

---

## Development Guidelines

When modifying this project:

- Do not rewrite the original transcript-fetching engine to add a new feature.
- Do not remove existing settings to make room for new settings.
- Do not make Local AI a transcript dependency.
- Do not create a second YouTube player.
- Do not introduce continuous high-frequency YouTube polling.
- Do not overwrite user notes, tags, categories, or learning data during metadata refresh.
- Do not silently erase existing records during import.
- Preserve stable IDs.
- Keep optional services lazy-loaded/on-demand.
- Validate JavaScript and JSON before packaging.
- Test the extension on real YouTube videos before release.

---

## License

This project is distributed under the MIT License.

See [`LICENSE`](LICENSE) for details.
