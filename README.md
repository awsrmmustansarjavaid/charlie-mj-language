# Charlie MJ Language --- v2.0.0

> A lightweight, local-first Chrome extension for learning languages
> through YouTube.

![Charlie MJ Language v2.0.0 Stable Beta](assets/charlie-mj-language-main-thumbnail.png)

Charlie MJ Language turns YouTube into a practical language-learning
workspace while keeping the original fast transcript workflow as its
core engine. It adds transcript tools, Dual Transcript, subtitle
controls, vocabulary and sentence learning, automatic subtitle pausing,
audio replay, Favorites, Categories, Learning Groups, YouTube metadata
and thumbnails, Suggestions, and local data synchronization.

## Download

<p align="center">
  <a href="downloads/charliemj-language-v1.0.0-youtube-language-catalog-2026-10-20.zip">
    <img src="https://img.shields.io/badge/charliemj--language-v1.0.0-0969da?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Download charliemj-language v1.0.0">
  </a>
  &nbsp;
  <a href="downloads/CharlieMJ-Language-v2.0.0.zip">
    <img src="https://img.shields.io/badge/charliemj--language-v2.0.0-0969da?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Download charliemj-language v2.0.0">
  </a>
  &nbsp;
  <a href="downloads/YT-Transcript-Pro/YT-Transcript-Pro-v2.0.0.zip">
    <img src="https://img.shields.io/badge/Transcript%20Pro-v2.0.0-2ea44f?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Download YT Transcript Pro v2.0.0">
  </a>
  &nbsp;
  <a href="downloads/charlie-mj-dual-transcript-engine/charlie-mj-dual-transcript-engine-v1.0.0.zip">
    <img src="https://img.shields.io/badge/Dual%20Transcript%20Engine-v1.0.0-6c757d?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Download Dual Transcript Engine v1.0.0">
  </a>
</p>

## Key Features

- ⚡ **Quick Fetch Complete Transcript** --- quickly fetch the complete available YouTube caption track with timestamps.
- 🌐 **Dual Transcript** --- view original and YouTube-native translated subtitles/transcripts together.
- 📋 **Copy & Download Transcript** --- copy the complete transcript to the clipboard or download it as a text file, with the option to include timestamps/timeline information or export a clean version without timestamps.
- 📝 **Copy Individual Subtitle** --- copy a single selected subtitle or transcript line directly from the transcript without needing to copy the entire transcript.
- ⏸️ **Auto Pause on Each Subtitle** --- pause playback at each subtitle/cue for reading and practice.
- 🔁 **Replay Audio** --- replay the current subtitle or sentence for listening and pronunciation practice.
- 🎯 **Click-to-Seek Transcript** --- click transcript rows to jump to the matching video timestamp.
- 🔄 **Live Transcript Synchronization** --- keep transcript position synchronized with playback.
- 🗣️ **Original + Translated Subtitles** --- control subtitle display, layout, typography, opacity, and translation.
- 🌍 **YouTube Language Catalog** --- use caption and translation language availability supplied by YouTube for the current video.
- ❤️ **Favorite Channels** --- save channels using stable YouTube Channel IDs and fetch their details.
- 📚 **Favorite Playlists** --- save playlists using stable YouTube Playlist IDs and fetch their details.
- 🖼️ **YouTube Metadata & Thumbnails** --- retrieve available titles, descriptions, channel/playlist information, URLs, IDs, and thumbnails.
- 🏷️ **Categories** --- organize channels and playlists into searchable learning categories.
- 👥 **Learning Groups** --- organize saved resources into custom groups.
- 💡 **YouTube Suggestions** --- fetch Suggested Channels and Suggested Playlists and decide what to save.
- 🔎 **Search & Filtering** --- search channels, playlists, categories, suggestions, names, descriptions, tags, and categories.
- 📝 **Learning Library** --- save vocabulary, sentences, notes, bookmarks, and Watch Later records.
- 💾 **Import / Export** --- back up and restore structured local learning data.
- 🔄 **Data Sync** --- compare and synchronize local data with the configured GitHub repository when enabled.
- ⚡ **Performance Controls** --- optional services remain on-demand instead of continuously running.
- 🎛️ **Custom Learning UI** --- configurable toolbar, transcript window, subtitles, and additional learning windows.


## Table of Contents

-   [Overview](#overview)
-   [Version and Platform](#version-and-platform)
-   [Critical Core Functionality](#critical-core-functionality)
-   [Performance and Lightweight
    Architecture](#performance-and-lightweight-architecture)
-   [Dual Transcript](#dual-transcript)
-   [Transcript Window](#transcript-window)
-   [Subtitles, Translation, and Language
    Selection](#subtitles-translation-and-language-selection)
-   [Automatic Subtitle Pause](#automatic-subtitle-pause)
-   [Audio Replay and Sentence
    Learning](#audio-replay-and-sentence-learning)
-   [Vocabulary and Sentence
    Learning](#vocabulary-and-sentence-learning)
-   [My Learning Library](#my-learning-library)
-   [Favorite Channels and Playlists](#favorite-channels-and-playlists)
-   [YouTube Metadata and Thumbnails](#youtube-metadata-and-thumbnails)
-   [Learning Groups](#learning-groups)
-   [Categories](#categories)
-   [Extension Intelligence](#extension-intelligence)
-   [YouTube Suggestions](#youtube-suggestions)
-   [Search and Filtering](#search-and-filtering)
-   [Data Sync](#data-sync)
-   [Import and Export](#import-and-export)
-   [Settings](#settings)
-   [UI and Window Controls](#ui-and-window-controls)
-   [Live Transcript Highlighting](#live-transcript-highlighting)
-   [Notifications and Save
    Reliability](#notifications-and-save-reliability)
-   [Privacy and Storage](#privacy-and-storage)
-   [Installation](#installation)
-   [Recommended First-Run
    Configuration](#recommended-first-run-configuration)
-   [Project Structure](#project-structure)
-   [Architecture Principles](#architecture-principles)
-   [Regression Testing](#regression-testing)
-   [Known Platform Considerations](#known-platform-considerations)
-   [Development Guidelines](#development-guidelines)
-   [License](#license)

## Overview

Charlie MJ Language brings together:

-   YouTube subtitles and complete timestamped transcripts
-   Fast automatic transcript fetching
-   Click-to-seek transcript timeline navigation
-   Transcript scrolling and synchronization with video playback
-   Original and translated subtitles
-   YouTube-native language and translation availability
-   Dual Transcript
-   Automatic pause on each subtitle/cue
-   Audio replay for the current subtitle/sentence
-   Vocabulary and sentence learning
-   Notes, bookmarks, and Watch Later
-   Favorite YouTube Channels and Playlists
-   Channel and playlist detail fetching from YouTube
-   YouTube metadata and thumbnail support
-   Learning Groups
-   Categories and category intelligence
-   YouTube Suggestions
-   Searchable Categories and Suggestions
-   Data import/export and synchronization tools
-   Performance and service-lifecycle controls
-   Customizable toolbar, transcript window, subtitles, and learning UI

The systems are designed to work independently. Basic transcript
functionality does not depend on Dual Transcript, metadata services,
Suggestions, Categories, or Data Sync.

## Version and Platform

-   **Version:** `2.0.0`
-   **Platform:** Chrome Extension --- Manifest V3
-   **Minimum Chrome version:** 114
-   **License:** MIT
-   **Repository:** [GitHub
    repository](https://github.com/awsrmmustansarjavaid/charlie-mj-language)

## Critical Core Functionality

The original transcript system is the primary and authoritative
transcript engine.

The v2.0.0 release does **not** replace or rewrite the
original transcript-fetching implementation.

The default engine remains:

``` text
legacy-youtube
```

The core workflow is:

1.  Open a YouTube video.
2.  The extension detects the video.
3.  The original transcript engine fetches the available complete
    caption track.
4.  The complete timestamped transcript becomes available.
5.  The user can scroll through the transcript.
6.  Transcript rows remain associated with timestamps.
7.  Clicking a transcript row seeks the video to that timestamp.
8.  Playback and transcript position remain synchronized where
    supported.
9.  Existing subtitle, translation, vocabulary, sentence, notes, and
    learning workflows can use the transcript.

### Core preservation requirement

New services must never:

-   replace `legacy-youtube`
-   rewrite its fetching algorithm merely to support another service
-   delay the original transcript while waiting for an optional service
-   create a second YouTube player
-   continuously intercept YouTube traffic for basic transcript
    operation
-   remove transcript scrolling or timeline seeking
-   remove existing transcript-learning functionality

The original transcript remains the reference source for additional
transcript systems.

## Performance and Lightweight Architecture

v2.0.0 Stable Beta is designed so optional services do not make normal
YouTube playback unnecessarily heavy.

### Startup principle

The extension should load only what is required for normal operation:

-   core extension logic
-   existing transcript functionality
-   required settings
-   lightweight UI
-   small indexes/cache metadata

Optional services remain dormant until needed.

### Service lifecycle

Optional services follow an event-driven lifecycle:

``` text
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

Enabled does not mean continuously running.

### Performance controls

Performance settings provide controls for:

-   lightweight startup
-   on-demand service activation
-   service sleep timeout
-   resource-intensive service enable/disable
-   lazy loading
-   caching
-   background-task controls
-   event-driven operation
-   reduced unnecessary polling
-   reduced unnecessary YouTube requests

The goal is for normal YouTube playback and the original transcript path
to remain the priority.

## Dual Transcript

Dual Transcript is an additional, independent transcript system. It does
not replace or delay the original transcript engine.

### Entry points

Dual Transcript can be opened from:

-   the Dual Transcript button in the YouTube learning toolbar
-   the Dual Transcript tab inside the Transcript window

### YouTube language catalog

Language choices are derived from YouTube caption information where
available rather than relying only on a fixed hard-coded language list.

The system can use:

-   available caption tracks
-   YouTube translation languages
-   original caption information
-   YouTube-native translation requests

This lets the user select languages that are actually available for the
current video.

### Fetching workflow

``` text
YouTube video
    ↓
YouTube caption information
    ↓
Available caption track
    ↓
YouTube-native translation when available
    ↓
Cue parsing and alignment
    ↓
Sentence merging
    ↓
Timeline synchronization
    ↓
Dual Transcript UI
```

### Features

-   Original subtitle/transcript
-   YouTube-native auto-translated subtitle/transcript
-   Original language selection
-   Target language selection
-   Complete timestamped cues
-   Cue alignment
-   Sentence merging
-   Timeline synchronization
-   Current-sentence tracking
-   Search
-   Refresh
-   Local caching
-   Translation availability status
-   Independent original/translated subtitle colors
-   Synchronized speaker/replay control
-   Save supported words to the learning library
-   Save supported sentences to the learning library

If YouTube does not provide a requested translation track, the original
transcript workflow remains available.

## Transcript Window

The Transcript window supports:

-   dragging
-   resizing
-   minimize
-   maximize
-   pin
-   close
-   restore
-   saved position
-   saved dimensions
-   viewport protection
-   scrolling
-   transcript tabs
-   synchronized playback

When minimized, a hover-based restore/maximize control can appear when
the mouse is moved near the minimized window.

## Subtitles, Translation, and Language Selection

The extension supports:

-   original subtitles
-   translated subtitles
-   YouTube-native translation
-   subtitle appearance controls
-   subtitle layout controls
-   width and height controls
-   maximum line controls
-   wrapping
-   padding
-   corner radius
-   opacity
-   typography
-   line spacing
-   translation display
-   timestamp synchronization

Native on-screen captions may be used as a fallback when timestamped
transcript information is unavailable.

### Language controls

Language selectors can reflect the caption and translation information
available from YouTube for the current video.

## Automatic Subtitle Pause

Automatic subtitle pause is an optional learning control that pauses
playback for each subtitle/cue.

Typical workflow:

``` text
Play video
   ↓
Subtitle appears
   ↓
Pause
   ↓
Read / listen / repeat
   ↓
Continue
   ↓
Next subtitle
   ↓
Pause again
```

The feature is integrated with the existing subtitle/timing workflow and
does not require a second player.

## Audio Replay and Sentence Learning

The learning interface provides replay controls for the current subtitle
or sentence.

Supported learning actions include:

-   replay current audio
-   replay a sentence
-   seek to the sentence timestamp
-   repeat listening
-   sentence looping where supported
-   A/B replay where supported
-   playback-speed learning controls

These tools are designed for listening comprehension, pronunciation
practice, and repeated exposure.

## Vocabulary and Sentence Learning

Learning tools include:

-   interactive word lookup
-   translation
-   dictionary information
-   provider/source information where available
-   part-of-speech information where available
-   vocabulary capture
-   sentence saving
-   timestamp-linked learning records
-   sentence replay
-   looping
-   playback-speed controls
-   notes
-   bookmarks
-   supported-word saving from transcript workflows
-   supported-sentence saving from transcript workflows

## My Learning Library

The local learning library supports:

-   vocabulary
-   saved sentences
-   bookmarks
-   notes
-   Watch Later
-   learning records
-   search
-   filtering
-   import/export
-   local-first storage

Existing learning data remains independent from optional metadata and
suggestion services.

## Favorite Channels and Playlists

### Favorite Channels

Save and manage YouTube channels using stable Channel IDs.

Channel workflows can include:

-   save channel
-   fetch channel details
-   refresh metadata
-   view/open channel
-   edit local information
-   remove from Favorites
-   assign category
-   assign Learning Group
-   search/filter saved channels

### Favorite Playlists

Save and manage YouTube playlists using stable Playlist IDs.

Playlist workflows can include:

-   save playlist
-   fetch playlist details
-   refresh metadata
-   view/open playlist
-   edit local information
-   remove from Favorites
-   assign category
-   assign Learning Group
-   search/filter saved playlists

### Stable identity

Duplicate detection uses stable YouTube IDs rather than display names.

Therefore:

-   the same ID is treated as the same resource
-   different IDs can have the same display name
-   names are not the primary identity

## YouTube Metadata and Thumbnails

The Favorites and learning-library systems can obtain available YouTube
metadata and thumbnails.

Metadata can include:

-   title
-   description
-   channel information
-   playlist information
-   thumbnail
-   stable YouTube ID
-   source URL
-   type/source information

Refresh operations should not overwrite user-owned:

-   notes
-   tags
-   categories
-   learning data

Metadata refresh should be rate-limited, cached, and performed only when
needed.

## Learning Groups

Learning Groups provide another level of organization for saved YouTube
resources.

They support:

-   View
-   Edit
-   Remove
-   resource management
-   category association
-   channel organization
-   playlist organization
-   learning organization

## Categories

Categories organize channels, playlists, and learning resources.

Category cards can show:

-   category name
-   description
-   resource count
-   channel count
-   playlist count
-   View
-   Open
-   Edit
-   Remove

### Category search

Categories are searchable from the main search field.

The displayed result count follows the active search:

``` text
20 categories
↓
Search: music
↓
4 categories
```

The category list and result count are based on the same filtered result
set.

### Category detail

A category detail view provides access to channels and playlists
assigned to that category, with resource-level actions.

## Extension Intelligence

Extension Intelligence provides optional category assistance without
requiring an external AI service.

Capabilities include:

-   master enable/disable
-   automatic category detection
-   existing-category suggestions
-   new-category suggestions
-   minimum confidence
-   prefer existing categories
-   automatic application of high-confidence suggestions
-   confirmation before creating categories
-   learning from accepted suggestions
-   learning from rejected suggestions

Potential information sources include:

-   YouTube metadata
-   title
-   description
-   tags/keywords
-   existing local categories
-   category knowledge data

### Important rule

The extension must not silently create a new category when a suggestion
has not been confirmed by the user.

## Category Knowledge

The category knowledge directory is organized separately from the
extension UI:

``` text
data/
└── category-knowledge/
    ├── youtube-categories.json
    ├── learning-categories.json
    ├── category-keywords.json
    └── category-rules.json
```

Official YouTube categories remain distinct from extension-specific
learning categories.

## YouTube Suggestions

The Suggestions workspace separates recommendations from Favorites.

It supports:

-   Suggested Channels
-   Suggested Playlists

Each result clearly identifies its type:

``` text
CHANNEL
PLAYLIST
```

Supported actions include:

-   View
-   Open
-   Save to Favorites
-   Add Category
-   Add Learning Group
-   Ignore

Suggestions are not automatically treated as Favorites.

### Suggestions search

The Suggestions workspace has a dedicated query used to fetch YouTube
recommendations.

The main search workflow can also filter displayed suggestion results
where supported, while the dedicated suggestion query remains available
for fetching new recommendations.

## Search and Filtering

Search and filtering can be used across:

-   channels
-   playlists
-   categories
-   suggestions
-   names
-   descriptions
-   tags
-   categories

Category search updates both visible cards and the result count.

Suggestions keep their dedicated fetch query while allowing displayed
results to be filtered where supported.

## Data Sync

The Data Sync workspace provides one clear area for maintaining local
data and optional GitHub-backed backups/synchronization.

Supported actions include:

-   local database status
-   GitHub database status
-   total local record count
-   total GitHub record count
-   per-resource counts for channels, playlists, and categories
-   Choose Local Folder
-   Validate Local
-   Health Check
-   Compare Local ↔ GitHub
-   Pull from GitHub
-   Prepare ZIP Backup
-   scheduled synchronization
-   separate JSON data files
-   indexes for fast lookup

### Default GitHub Repository

``` text
https://github.com/awsrmmustansarjavaid/charlie-mj-language
```

The repository URL remains editable by the user.

### Compare Local ↔ GitHub

The comparison result should clearly separate:

-   Local totals
-   GitHub totals
-   matching records
-   local-only records
-   GitHub-only records
-   changed/different records
-   database directories/files involved
-   recommended next action

### ZIP backup

Prepare ZIP Backup creates one downloadable ZIP archive containing
structured database JSON files and indexes.

Stable IDs remain the primary identity:

``` text
Channel ID
Playlist ID
```

### Browser limitation

A normal Chrome extension cannot silently write to arbitrary local
filesystem paths.

Supported approaches require an appropriate browser permission/API such
as:

-   user-selected File System Access locations
-   a Native Messaging helper
-   browser download/import flows
-   GitHub API/repository synchronization

The extension must not claim unrestricted access to arbitrary folders.

## Import and Export

JSON is the primary structured backup format.

Export can include:

-   saved channels
-   saved playlists
-   categories
-   Learning Groups
-   notes
-   tags
-   metadata
-   stable IDs

Import supports:

-   JSON validation
-   duplicate detection
-   merge
-   replace where explicitly selected
-   preservation of existing records during merge
-   invalid/skipped-record reporting
-   backup restoration

TXT exports can provide a readable list containing:

-   channel/playlist name
-   URL
-   category
-   tags
-   notes
-   date added

## Settings

Important settings areas include:

-   UI Components
-   Subtitle and Timeline
-   Appearance
-   Service Engine
-   Favorites
-   Categories
-   Extension Intelligence
-   Data Sync
-   YouTube Suggestions
-   Performance
-   Additional Learning Window

Settings should remain backward-compatible with existing stored values.

## UI and Window Controls

### Learning toolbar

The YouTube learning toolbar supports configurable:

-   position
-   size
-   scale
-   button arrangement
-   hover/reveal behavior
-   visibility
-   auto-hide behavior

### Transcript window

The Transcript window supports:

-   dragging
-   resizing width
-   resizing height
-   corner resizing
-   minimize
-   maximize
-   pin
-   close
-   restore
-   saved position
-   saved dimensions
-   viewport protection
-   scrolling
-   transcript tabs
-   synchronized playback

### Additional Learning window

The Additional Learning window follows the same window-management model:

-   resize width
-   resize height
-   minimize
-   maximize
-   pin
-   close
-   restore
-   remember position
-   remember size

## Live Transcript Highlighting

Live Transcript Highlighting synchronizes the active transcript row with
playback.

Features include:

-   enable/disable
-   transparent highlight
-   rounded background
-   underline
-   left accent
-   text-color highlighting
-   custom highlight color
-   background opacity
-   active text color
-   speaker indicator
-   playback synchronization
-   subtitle synchronization
-   optional automatic transcript scrolling
-   center/top/bottom auto-scroll positioning
-   manual-scroll protection
-   transition-duration control
-   preview
-   reset

The feature operates on existing timestamped transcript segments and
does not replace the transcript-fetching engine.

## Notifications and Save Reliability

Save operations should report success only after the underlying storage
operation succeeds.

This applies to:

-   Watch Later
-   bookmarks
-   notes
-   vocabulary
-   sentences
-   library records
-   settings
-   Favorites
-   Categories
-   Learning Groups

If Chrome invalidates an extension content-script context after an
extension reload/update, storage-dependent operations should fail safely
and request a page refresh rather than falsely reporting success.

## Privacy and Storage

Charlie MJ Language is local-first.

Local settings and learning records are stored using Chrome extension
storage and/or appropriate local extension storage mechanisms.

Some optional features may contact external services when the user
requests them, such as:

-   YouTube services/endpoints
-   YouTube caption/translation services
-   GitHub synchronization

External service use should occur only for the relevant feature and
should not be required for basic transcript functionality.

## Installation

1.  Download or clone this repository.
2.  Extract the ZIP if necessary.
3.  Open Chrome.
4.  Visit:

``` text
chrome://extensions/
```

5.  Enable **Developer mode**.
6.  Click **Load unpacked**.
7.  Select the extension directory containing `manifest.json`.
8.  Open or refresh a YouTube video.

If YouTube was already open when the extension was installed or
reloaded, refresh the YouTube tab once.

## Recommended First-Run Configuration

For the lightest normal YouTube experience:

1.  Keep the original `legacy-youtube` transcript engine enabled.
2.  Keep the original transcript workflow as the default.
3.  Leave Dual Transcript inactive until needed.
4.  Enable automatic subtitle pause only when you want
    subtitle-by-subtitle practice.
5.  Use Replay Audio when practicing listening or pronunciation.
6.  Enable metadata refresh only when needed.
7.  Use category intelligence only if automatic category assistance is
    desired.
8.  Configure Data Sync separately from normal transcript operation.

This keeps the critical path focused on:

``` text
YouTube
  ↓
Original Transcript Engine
  ↓
Complete Transcript
  ↓
Scroll / Timeline / Learning
```

## Project Structure

``` text
charlie-mj-language/

│
├── assets/
├── data/
│   └── category-knowledge/
│       ├── youtube-categories.json
│       ├── learning-categories.json
│       ├── category-keywords.json
│       └── category-rules.json
│
├── docs/
├── icons/
│
├── src/
│   ├── background/
│   ├── content/
│   │   ├── youtube.js
│   │   └── youtube-page-bridge.js
│   ├── dashboard/
│   ├── dual-transcript/
│   ├── favorites/
│   ├── lib/
│   ├── options/
│   └── popup/
│
├── transcript-service.config.json
├── manifest.json
├── LICENSE
└── README.md
```

The exact source tree may evolve as independent services are added. The
important architectural rule is that the original transcript
implementation remains isolated and authoritative.

## Architecture Principles

### Strict additive-only development rule

Existing working systems and features are treated as **untouchable
unless the user explicitly requests a change**.

When adding functionality:

-   add new code as an independent subsystem where practical
-   do not remove an existing feature to make room for a new feature
-   do not replace a working implementation simply because a new
    implementation is available
-   do not change unrelated existing behavior
-   keep existing settings and storage compatible
-   test the original feature before and after every new integration
-   treat a regression in an existing working feature as a release
    blocker

### Core principles

1.  **Preserve the core** --- the original fast complete-transcript
    engine is not replaced.
2.  **Add, don't remove** --- new functionality is additive.
3.  **Independent services** --- Dual Transcript, Favorites, Categories,
    Data Sync, Suggestions, Intelligence, and other services operate
    independently.
4.  **No unnecessary continuous work** --- optional services should
    sleep when inactive.
5.  **Event-driven operation** --- prefer events and explicit user
    actions over aggressive polling.
6.  **Stable identities** --- use YouTube Channel IDs and Playlist IDs
    instead of names as primary identifiers.
7.  **Safe storage** --- do not silently erase existing user data.
8.  **Backward compatibility** --- existing settings, storage,
    transcript workflows, and learning records should remain usable.
9.  **No second YouTube player** --- additional transcript services must
    not recreate the YouTube player.
10. **Original transcript remains authoritative** --- additional
    transcript sources are compared against the original rather than
    replacing it.

## Regression Testing

Before releasing a build, verify at minimum:

### Core transcript

-   YouTube video loads normally.
-   YouTube playback starts without extension-induced buffering.
-   Original transcript automatically appears.
-   Complete transcript is fetched.
-   Transcript can scroll to the end.
-   Transcript timestamps remain available.
-   Clicking a transcript row seeks the video.
-   Playback and transcript remain synchronized.
-   Original subtitles still work.
-   Translation still works.

### Automatic subtitle pause

-   Auto pause can be enabled and disabled.
-   Playback pauses at subtitle/cue boundaries.
-   Playback continues correctly after the pause.
-   Existing transcript timing remains correct.
-   Disabling auto pause restores normal playback.

### Audio replay

-   Current subtitle/sentence can be replayed.
-   Replay seeks to the correct timestamp.
-   Replay does not create a second player.
-   Replay does not interfere with transcript synchronization.

### Dual Transcript

-   Original transcript remains available.
-   Original and target language selectors load available YouTube
    languages.
-   YouTube-native translation is used when available.
-   Cue alignment remains synchronized.
-   Missing translation does not break the original transcript.

### Library

-   Channels can be saved.
-   Playlists can be saved.
-   Channel details can be fetched/refreshed.
-   Playlist details can be fetched/refreshed.
-   Thumbnails can be displayed/refreshed.
-   Stable IDs prevent duplicate records.
-   Same-name resources with different IDs remain separate.
-   Categories can be assigned.
-   Learning Groups support view/edit/remove.
-   Metadata refresh does not overwrite user data.

### Categories

-   Categories can be searched.
-   Result count matches filtered results.
-   Clearing the search restores the total count.
-   View/Open/Edit/Remove actions continue to work.

### Suggestions

-   Suggested Channels can be fetched.
-   Suggested Playlists can be fetched.
-   Suggestion type is visible.
-   Suggestion query remains functional.
-   Results can be searched/filtered where supported.
-   Save/Add Category/Add Learning Group actions work.

### Performance

-   Extension startup remains lightweight.
-   YouTube playback remains responsive.
-   Optional services remain idle until required.
-   No unnecessary continuous network traffic is generated.
-   Service sleep/wake behavior works as configured.

### Settings

-   Existing settings remain available.
-   New settings appear in their intended sections/tabs.
-   Settings persist after Chrome restart.
-   Grid layout remains usable at different widths.

## Known Platform Considerations

YouTube can change its player, caption endpoints, page structure, and
internal APIs without notice.

Caption availability varies by video and may depend on:

-   available language tracks
-   manual captions
-   auto-generated captions
-   auto-translation availability
-   YouTube changes
-   video-owner settings

Therefore, no extension can guarantee a particular caption language for
every YouTube video.

Live Chrome/YouTube regression testing should be performed before
distributing a production build.

---

# Charlie MJ Dual Transcript Engine

A standalone, lightweight Chrome/Chromium extension whose only core job is to obtain a **complete original + YouTube-native translated transcript** from YouTube as quickly as possible, cache it locally, and keep both tracks synchronized with `video.currentTime`.

![Charlie MJ Dual Transcript Engine](assets/Charlie%20MJ%20Dual%20Transcript%20Engine%20—%20Thumbnail.png)

# Charlie MJ Dual Transcript Engine – Key Features

## 1. YouTube Caption Extraction
- Captures YouTube's native caption requests.
- Extracts complete original subtitle tracks.
- Retrieves complete translated subtitle tracks.
- Supports manually uploaded captions.
- Supports automatically generated captions (ASR).
- Uses YouTube's native translation infrastructure.
- Captures required caption request parameters.
- Fetches complete transcripts instead of individual subtitle fragments.

## 2. Dual-Language Transcript Engine
- Extracts original and translated transcripts simultaneously.
- Supports source and target language selection.
- Displays original and translated subtitles together.
- Aligns original and translated subtitle segments.
- Matches subtitle timing between both languages.
- Maintains original subtitle timing information.
- Supports normalized dual-transcript data.
- Handles fragmented automatic speech recognition captions.

## 3. Intelligent Sentence Processing
- Merges fragmented captions into readable sentences.
- Preserves original caption timing.
- Maintains subtitle segment relationships.
- Generates normalized transcript cues.
- Creates structured sentence-level transcript data.
- Associates sentence segments with their original cue IDs.
- Preserves original and translated text independently.

## 4. Real-Time Playback Synchronization
- Synchronizes subtitles with YouTube video playback.
- Uses `video.currentTime` for playback tracking.
- Highlights currently active subtitle segments.
- Uses binary search for efficient timeline lookups.
- Uses `requestAnimationFrame` for smooth synchronization.
- Supports video seeking.
- Supports pause and resume synchronization.
- Maintains synchronization between original and translated subtitles.

## 5. Dual Subtitle Overlay
- Displays original subtitles on the video.
- Displays translated subtitles alongside original subtitles.
- Provides synchronized dual-language subtitle presentation.
- Supports real-time subtitle updates.
- Maintains subtitle timing during playback.

## 6. Complete Transcript Panel
- Provides a searchable full transcript panel.
- Displays original-language sentences.
- Displays translated-language sentences.
- Supports complete transcript viewing.
- Click any sentence to jump to its video timestamp.
- Keeps transcript navigation synchronized with playback.

## 7. Local Transcript Caching
- Caches completed dual transcripts locally.
- Uses an LRU (Least Recently Used) cache strategy.
- Reduces repeated caption requests.
- Improves transcript loading performance.
- Provides a lightweight background cache service worker.

## 8. YouTube Compatibility
- Supports YouTube video pages.
- Supports YouTube Shorts URLs.
- Supports YouTube Single Page Application (SPA) navigation.
- Detects video navigation and updates transcript data.
- Adds a dedicated DT button to the YouTube player control bar.
- Provides a popup interface.
- Includes manual transcript refresh controls.

## 9. Language & Translation Management
- Select source subtitle language.
- Select target translation language.
- Uses YouTube-native automatic translation.
- Requests translated tracks using YouTube's `tlang` parameter.
- Handles unavailable translation languages.
- Reports translation unavailability instead of silently using an external translation service.

## 10. Lightweight Architecture
- Chrome Manifest V3 architecture.
- Vanilla JavaScript implementation.
- No frontend framework.
- No npm dependencies.
- No developer-owned backend.
- No mandatory third-party translation API.
- Lightweight background service worker.
- Separated caption extraction and transcript processing.
- Reusable normalized transcript data structure.
- Independent transcript engine and UI architecture.

## 11. Privacy & Security
- No user account required.
- No login system.
- No analytics tracking.
- No telemetry.
- No external developer server.
- No mandatory external API keys.
- Local transcript caching.
- Uses YouTube's own caption and translation infrastructure.

## 12. Developer & Integration Features
- Standalone reusable dual-transcript engine.
- Separated YouTube request observation layer.
- Independent caption extraction module.
- Independent transcript parsing module.
- Structured cue and sentence data models.
- Reusable normalized transcript API.
- Isolated caption-fetching architecture.
- Designed for future Charlie MJ application integration.
- MIT-licensed implementation.

## Download

<p align="center">
  <a href="downloads/charlie-mj-dual-transcript-engine/charlie-mj-dual-transcript-engine-v1.0.0.zip">
    <img src="https://img.shields.io/badge/Download-v1.0.0-6c757d?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Download v1.0.0">
  </a>
  &nbsp;
  <a href="/Charlie MJ Subtitle & transcript Extentions/charlie-mj-dual-transcript-engine/README.md">
    <img src="https://img.shields.io/badge/Main-README-0969da?style=for-the-badge&logo=readme&logoColor=white" alt="Main README">
  </a>
</p>

---

# YT Transcript Pro

Copy or download YouTube transcripts and two-language (dual) subtitles, with or without timestamps. Manifest V3, Chrome and Edge, no account, no server, no analytics.

![YT Transcript Pro v2.0.0](assets/YT-Transcript-Pro-v2-instagram-story.png)

# YT Transcript Pro v2.0.0 – Key Features

## 1. YouTube Integration
- Direct SUB button inside the YouTube video player control bar.
- One-click transcript window.
- Transcript panel beside the video or floating window.
- Supports YouTube videos and YouTube Shorts through popup and keyboard shortcuts.
- Automatic video detection and transcript loading.

## 2. Transcript Extraction
- Extract complete YouTube transcripts.
- Support manually uploaded subtitles.
- Support automatically generated captions.
- Original language selection.
- Multiple available subtitle language options.
- YouTube automatic translation support.
- Dual-language transcript extraction.

## 3. Dual-Language Subtitles
- Display original and translated subtitles together.
- Select original and translation languages independently.
- Side-by-side or combined transcript formatting.
- Timestamp-based subtitle alignment.
- Copy original language independently.
- Copy translated language independently.
- Copy both languages together.
- Copy individual subtitle lines with their translations.

## 4. Copy Transcript
- Copy the entire transcript with timestamps.
- Copy the entire transcript without timestamps.
- Copy original-language transcript.
- Copy translated-language transcript.
- Copy complete dual-language transcript.
- Select multiple transcript lines and copy them.
- Copy individual subtitle segments.
- No TXT file required for copying.

## 5. Download & Export
- Download transcripts as TXT.
- Download subtitles as SRT.
- Download subtitles as VTT.
- Export transcripts as CSV.
- Export single-language transcripts.
- Export dual-language transcripts.
- Preserve timestamps during export.
- Custom download folder and filename options.
- Option to ask where to save downloaded files.

## 6. Transcript Navigation
- Click any transcript line to jump to its video timestamp.
- Select multiple transcript segments.
- Search within the transcript.
- Navigate through subtitle segments.
- Individual subtitle copy buttons.
- Synchronized transcript and video playback.

## 7. Keyboard Shortcuts
- `Alt + T` – Open transcript window.
- `Alt + C` – Copy transcript with timestamps.
- `Alt + Shift + C` – Copy transcript without timestamps.
- `Alt + D` – Download TXT transcript.
- `Alt + F` – Search transcript.
- Customizable keyboard shortcuts.

## 8. Extension Settings
- General settings.
- Transcript settings.
- Dual-language settings.
- Appearance customization.
- Copy and export settings.
- Download preferences.
- Player and synchronization settings.
- Keyboard shortcut configuration.
- Advanced settings.
- Backup, import and reset settings.

## 9. Appearance & Customization
- Multiple interface themes.
- Nine customizable theme colors.
- Custom font selection.
- Adjustable transcript window size.
- Live appearance preview.
- Floating transcript window.
- Side-panel transcript window.

## 10. YouTube Connection & Reliability
- YouTube connection reset option.
- Clear extension caches.
- Refresh YouTube connection.
- Multiple caption-loading methods.
- Error handling for unavailable captions.
- Diagnostic logging.
- Support for YouTube's dynamic page navigation.

## 11. Privacy & Performance
- Lightweight Manifest V3 architecture.
- Google Chrome compatibility.
- Microsoft Edge compatibility.
- Brave compatibility.
- No user account required.
- No external backend server.
- No analytics tracking.
- Local browser-based processing.

## Download

<p align="center">
  <a href="downloads/YT-Transcript-Pro/YT-Transcript-Pro-v1.0.0.zip">
    <img src="https://img.shields.io/badge/Download-v1.0.0-6c757d?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Download v1.0.0">
  </a>
  &nbsp;
  <a href="downloads/YT-Transcript-Pro/YT-Transcript-Pro-v2.0.0.zip">
    <img src="https://img.shields.io/badge/Download-v2.0.0-2ea44f?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Download v2.0.0">
  </a>
  &nbsp;
  <a href="/Charlie MJ Subtitle & transcript Extentions/YT-Transcript-Pro/YT-Transcript-Pro-v2.0.0/YT-Transcript-Pro/README.md">
    <img src="https://img.shields.io/badge/Main-README-0969da?style=for-the-badge&logo=readme&logoColor=white" alt="Main README">
  </a>
</p>

## Troubleshooting: Transcript Panel Looks Transparent or Faded

![Transcript panel faded vs solid](assets/Troubleshooting%20Transcript%20Panel%20Looks%20Transparent%20or%20Faded.png)

**Problem:** The YT Transcript Pro window looks transparent or dimmed on YouTube, even though **Background opacity** is already set to 100%.

**Cause:** Another extension (for example a language-learning overlay with **Focus** or **Theme** modes) is dimming or restyling everything on the page except the video. This is not a YT Transcript Pro setting.

**Fix:**

1. Open **Settings → Appearance → Window → Background opacity** and confirm it is **100%**.
2. In the other extension's toolbar, switch **Focus** and **Theme** to **OFF**.
3. If it is still faded, disable the other extension in `chrome://extensions`, then refresh the YouTube page.
4. Optional: switch YT Transcript Pro to **floating** mode so the window sits above the page.

---


## Development Guidelines

When modifying this project:

-   Do not rewrite the original transcript-fetching engine to add a new
    feature.
-   Do not remove existing settings to make room for new settings.
-   Do not create a second YouTube player.
-   Do not introduce continuous high-frequency YouTube polling.
-   Do not overwrite user notes, tags, categories, or learning data
    during metadata refresh.
-   Do not silently erase existing records during import.
-   Preserve stable IDs.
-   Keep optional services lazy-loaded/on-demand.
-   Keep YouTube metadata requests cached and rate-limited.
-   Validate JavaScript and JSON before packaging.
-   Test the extension on real YouTube videos before release.

## License

This project is distributed under the MIT License.

See [`LICENSE`](LICENSE) for details.
---

# Charlie MJ Language — Additional Learning Library & Dashboard Features

The following section documents the newer Learning Library/dashboard functionality added after the original README content above. The existing README sections and wording are intentionally preserved.

## Learning Library Dashboard

The Learning Library now acts as a central workspace for saved language-learning material collected throughout the extension.

The dashboard is designed around the learning workflow:

```text
YouTube
  ↓
Transcript / Dual Transcript
  ↓
Vocabulary / Sentences / Notes / Bookmarks
  ↓
My Learning Library
  ↓
Search / Filter / Review / Continue Learning
```

### Dashboard overview

The dashboard provides an overview of saved learning activity, including:

- unfinished learning items
- saved vocabulary
- saved sentences
- completed learning records
- saved videos
- recent learning activity
- library statistics
- continuation of unfinished videos
- quick access to saved learning material

The dashboard keeps the learning workspace separate from the main YouTube page while retaining the local-first storage model.

## Global Learning Library Search

The Learning Library search has been expanded into a cross-library search system.

The main search field can search across saved learning records instead of being limited to the currently visible dashboard section.

### Searchable content

The search system can search for:

- video titles
- video IDs
- channel names
- saved vocabulary words
- vocabulary translations
- vocabulary definitions
- saved sentences
- sentence translations
- sentence notes
- transcript text where stored with a learning record
- bookmarks
- Watch Later records
- notes
- tags
- learning records
- saved history
- video metadata
- other searchable fields stored in the local learning records

### Video title search

Video titles are first-class search targets.

For example:

```text
Search:
How to Learn Turkish
```

can find a saved video whose title contains:

```text
How to Learn Turkish
```

The search is case-insensitive and searches the stored video metadata available to the dashboard.

### Vocabulary search

Users can search directly for saved vocabulary.

Examples:

```text
Search:
merhaba
```

or:

```text
Search:
hello
```

depending on which word, translation, definition, or related information is stored in the vocabulary record.

### Sentence search

Saved sentences can also be searched directly.

Examples:

```text
Search:
Bugün hava çok güzel
```

or a stored translation, note, or other searchable sentence field.

### Cross-library search

A single search query can return matching records from different learning areas.

For example:

```text
Search:
travel
```

may match:

```text
Video title
Vocabulary
Sentence
Note
Tag
History
```

This makes the dashboard a unified search entry point for the user's learning material.

## Search and Filtering

The dashboard supports search together with library filters.

Available filtering can include:

- search text
- level
- tag
- video
- learning item type

Filters can be combined with the global search query.

Example:

```text
Search: travel
Level: B1
Type: Sentence
```

The dashboard displays only records satisfying the active filters.

Clearing the search and filters restores the normal dashboard view.

## Learning Library Record Types

The dashboard can work with multiple categories of stored learning information.

### Videos

Saved video-related records can contain information such as:

- video title
- video ID
- YouTube URL
- channel information
- thumbnail
- progress
- timestamps
- learning state
- tags
- notes

### Vocabulary

Vocabulary records can contain:

- word
- translation
- definition
- part of speech
- source/provider information
- example context
- video relationship
- timestamp
- notes
- tags
- learning state

### Sentences

Sentence records can contain:

- original sentence
- translated sentence
- source video
- timestamp
- notes
- tags
- replay information
- learning state

### Notes

Notes remain associated with the relevant learning record where supported.

### Bookmarks

Bookmarks provide timestamp-linked access to saved moments in YouTube learning sessions.

### Watch Later

Watch Later records provide a dedicated way to keep videos or learning material for later review.

## Continue Learning

The dashboard supports a continuation workflow for unfinished learning material.

Users can return to saved learning items and continue from the relevant video or learning context where progress information is available.

The dashboard can surface unfinished items separately from completed learning records.

## Learning Progress

Learning records can retain progress information so the dashboard can distinguish between:

- unfinished
- in-progress
- completed

This allows the dashboard to act as a learning workspace rather than simply a list of saved records.

## Dashboard Result Cards

Search and library results can be represented using learning cards containing relevant information for the record type.

Depending on the item, a card may show:

- title
- word
- sentence
- translation
- thumbnail
- channel
- timestamp
- learning type
- tags
- notes
- progress
- learning status
- available actions

The dashboard uses the appropriate card behavior for the underlying record type.

## Library Search Behavior

Search is intended to be:

- case-insensitive
- local-first
- fast
- compatible with saved extension data
- independent of external search services
- usable across multiple library record types

Search does not require a remote database or external search API.

The dashboard searches locally stored extension data.

## Asynchronous Dashboard Rendering Protection

The dashboard protects search results from asynchronous Overview rendering.

When a user starts a search, an older asynchronous Overview operation must not restore the Overview and overwrite the current search results.

The dashboard therefore treats an active search query as a higher-priority UI state than the default Overview rendering.

This prevents the following unwanted sequence:

```text
Open Dashboard
      ↓
Overview starts loading
      ↓
User searches
      ↓
Search results appear
      ↓
Older Overview request finishes
      ↓
Overview overwrites search results
```

The intended behavior is:

```text
Open Dashboard
      ↓
Overview loads
      ↓
User searches
      ↓
Search results remain visible
```

## Local-First Search Architecture

The Learning Library search follows the extension's local-first architecture.

The normal search path is:

```text
User Query
    ↓
Dashboard Search
    ↓
Local Chrome Extension Storage
    ↓
Saved Learning Records
    ↓
Filtering
    ↓
Matching Results
```

No external search engine is required for normal Learning Library search.

## Search Reliability

Search should continue working after:

- opening the dashboard
- changing dashboard sections
- saving new vocabulary
- saving new sentences
- saving videos
- reloading the extension
- refreshing the dashboard
- clearing the search
- changing filters

When the dashboard is reopened, records are loaded from the extension's persisted local storage.

## Learning Library Design Goals

The newer dashboard functionality follows these principles:

1. **Search everything relevant** — saved learning material should be discoverable from one search field.
2. **Video titles matter** — saved videos should be searchable by their titles.
3. **Words remain searchable** — vocabulary should be searchable by the saved word and related stored information.
4. **Sentences remain searchable** — saved sentences and their searchable fields should be discoverable.
5. **Local-first** — normal library search does not depend on an external service.
6. **No data removal** — adding search functionality must not delete existing learning records.
7. **Independent learning records** — vocabulary, sentences, videos, notes, bookmarks, and other records remain distinct records.
8. **Stable dashboard behavior** — asynchronous rendering must not overwrite an active search.
9. **Compatible filtering** — search and filters can operate together.
10. **Preserve existing functionality** — dashboard improvements remain additive to the existing Learning Library.

## Updated Learning Library Feature Summary

The Learning Library now provides a broader learning-management workflow:

- centralized dashboard
- learning statistics
- unfinished learning
- Continue Learning
- saved video history
- video-title search
- vocabulary search
- sentence search
- translation search
- notes search
- tag filtering
- level filtering
- video filtering
- learning-type filtering
- cross-library search
- local-first search
- saved learning records
- timestamp-linked learning
- bookmarks
- Watch Later
- import/export support
- persistent local storage
- search-safe asynchronous rendering

These additions extend the existing Learning Library without replacing its original transcript, vocabulary, sentence, Favorites, Categories, Suggestions, Data Sync, or local-storage workflows.
