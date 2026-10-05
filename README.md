# Charlie MJ Language — v4.1.2 Learning Workspace

Charlie MJ Language is a local-first Chrome extension for turning YouTube videos into a personal language-learning workspace.

## v4.1.2 — Learning Workspace polish update

- Complete Transcript + Word Learning + Sentence Learning
- Shared subtitle/timeline synchronization
- Word and sentence records linked to exact YouTube timestamps
- Automatic History and Continue Learning
- Resume Queue for multiple unfinished videos
- Video Learning Record with progress, session count, playback speed, subtitle mode and study state
- Learning Checkpoints
- Collections that can contain the same video/item more than once across collections
- Grid/List library layout with remembered preference
- Videos, Transcripts, Word Learning, Sentence Learning, Vocabulary, Bookmarks, Watch Later, Notes, Captures, Favorites and Review/Weak Words
- Smart Replay, A/B/Loop sentence controls and slow playback
- Toolbar Manager: drag actions between visible toolbar and More Menu
- Word + Sentence toolbar buttons
- Single Dark/Light appearance toggle
- Settings sidebar with categorized controls
- Library export/import: JSON, TXT, CSV, SRT, VTT and Anki TSV
- Local-first storage in Chrome `storage.local`

### Learning flow

**Watch → Understand → Capture → Learn → Organize → Review → Continue**

### Install

1. Download/extract the extension ZIP.
2. Open Chrome → `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose the extracted extension folder.
5. Open a YouTube video.

Your learning data stays in Chrome local storage unless you explicitly export/download it.



![Charlie MJ Language](assets/charlie-mj-language-v4.0.0-thumbnail.png)

> **Watch → Understand → Capture → Learn → Organize → Review → Export**

Charlie MJ Language is a local-first Chrome extension for learning languages from YouTube. v4.1.2 keeps the v4.0 subtitle-learning system and adds a cleaner workspace, word-to-word and sentence-to-sentence learning modes, CEFR/difficulty display, sentence mining, replay/A-B/slow playback, Study Mode, and a grid-based vocabulary library with word/sentence filters and tags.

## Download

<p align="center">
  <a href="/downloads/charlie-mj-language-v4.1.2.zip">
    <img src="https://img.shields.io/badge/%E2%AC%87%20Download%20Chrome%20Extension-2ea44f?style=for-the-badge" alt="Download Chrome Extension">
  </a>
</p>

**Release:** `v4.1.2` · **Chrome MV3** · **MIT License** · **No GitHub Actions required**

### v4.1.2 highlights

- Stateful toolbar buttons visibly show **ON** for active learning modes and return to normal when OFF.
- Action buttons show a short completion state so Save, Bookmark, Capture and exports feel responsive.
- Toolbar **Settings** now uses a reliable options-page fallback if Chrome does not open it directly.
- Library navigation is divided into **Start, Content, Learning and Organize** sections, with custom collections separated into their own area.
- Settings now use a professional category workspace: clicking **General, Toolbar, Subtitles & Timeline, Learning, Translation, Downloads, Focus, Appearance or Language Intelligence** shows only that category.
- Save Settings changes to **✓ Saved** and displays a persistent success notification before returning to the normal button state.
- Existing v4.1.0 Learning Library, Continue Learning, History, Collections, Checkpoints, Word Learning, Sentence Learning and export features remain intact.

**Charlie MJ Language** is a Chrome Manifest V3 language-learning workspace built directly around YouTube. It combines dual subtitles, interactive vocabulary, transcript mining, translation, CEFR-style levels, grammar/POS highlighting, Focus Mode, timeline bookmarks, screenshots, Watch Later and local learning productivity tools.

> **Watch → Understand → Capture → Organize → Review → Improve**

## Why I built it

Normal YouTube is excellent for immersion, but useful language-learning information is scattered between subtitles, dictionaries, notes, bookmarks and flashcard tools. Charlie MJ Language puts those actions around the video so the learner can stay focused on the content.

The project is inspired by the capabilities of FunLingo and open-source language-learning projects such as Dual Subtitles, LinguaMiner, asbplayer and related sentence-mining tools. The extension does not copy their code. It uses a separate implementation and an open architecture.

## Core features

- YouTube learning toolbar directly inside the player
- Real YouTube caption-track discovery and loading
- Original + translated dual subtitles
- Word-by-word interaction and instant translation
- Hover-to-pause subtitles
- Noun/verb/adjective/adverb/pronoun/etc. visualisation
- POS colour + bold formatting
- A1–C2 and Beginner–Proficient labels
- Complete timestamped transcript
- Complete transcript + translation export
- TXT, JSON, SRT and VTT export
- Custom vocabulary + translation CSV export
- One-click vocabulary capture
- Sentence mining
- Timeline bookmarks with tags/labels
- Timeline screenshot capture
- Watch Later library
- YouTube overflow-menu Watch Later integration
- Browser context-menu Watch Later fallback
- Focus Mode to reduce YouTube recommendations/distractions
- Full responsive library for Watch Later, Vocabulary and Bookmarks
- Copy, download, export and import on every built-in library page
- Custom library pages with create/delete and add-to-page collections
- Search, CEFR filter, tag filter and video filter
- Video-linked records so multiple videos remain separated by title, URL and timestamp
- Video learning package exports containing transcript, vocabulary, bookmarks and notes
- Local-first Chrome storage
- Translation caching
- MyMemory translation provider
- Optional LibreTranslate provider
- Keyboard shortcuts
- Custom Downloads subdirectory naming with optional Save As prompt
- Extension setting to show/hide the YouTube learning toolbar
- Word definition card with explicit close, outside-click dismissal, auto-close and instant replacement when another word is clicked
- Per-video notes with add/remove text boxes, bold, text-size and bullet formatting
- World/language/Charlie MJ icon
- Detailed documentation

## Installation

1. Download and extract the repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted `charlie-mj-language-final` directory.
6. Open or refresh a YouTube video.
7. YouTube **CC** can remain off; Charlie MJ attempts to fetch caption tracks independently.
8. The Charlie MJ learning toolbar appears in the player.

If YouTube was already open while installing/reloading the extension, refresh the video once.

## Important YouTube integration note

YouTube is a continuously changing single-page application. The extension therefore uses both a MAIN-world player-response bridge and an isolated content script. The bridge reads caption-track metadata, while the content script renders the learner interface. Native YouTube caption DOM is also monitored as a fallback.

The YouTube three-dot menu is not a public extension API. Charlie MJ watches the menu DOM and adds **Charlie MJ — Add to Watch Later** when the menu opens. A browser context-menu command is provided as a second fallback.

## Repository

```text
charlie-mj-language-v4.1.2/
├── assets/
├── icons/
├── docs/
├── src/
│   ├── background/
│   ├── content/
│   ├── dashboard/
│   ├── lib/
│   ├── options/
│   └── popup/
├── .gitignore
├── LICENSE
├── manifest.json
└── README.md
```

## Documentation

- [Project Overview](docs/01-project-overview.md)
- [Complete Feature Specification](docs/02-feature-specification.md)
- [YouTube Integration](docs/03-youtube-integration.md)
- [Architecture](docs/04-architecture.md)
- [UI/UX Design](docs/05-ui-ux-design.md)
- [Language Intelligence](docs/06-language-intelligence.md)
- [Transcript & Export](docs/07-transcript-export.md)
- [Installation & Testing](docs/08-installation-testing.md)
- [Privacy & Security](docs/09-privacy-security.md)
- [Development Guide](docs/10-development-guide.md)
- [Roadmap](docs/11-roadmap.md)
- [Library, Data Model and Import/Export](docs/14-library-data-model.md)
- [Notes, Settings and Downloads](docs/15-notes-settings-downloads.md)
- [Video-Linked Learning Packages](docs/16-video-linked-learning-packages.md)
- [v3.1 YouTube Core Rebuild](docs/13-youtube-core-rebuild.md)

## Technology

- Chrome Extensions Manifest V3
- JavaScript (ES2022+)
- HTML5/CSS3
- Chrome Storage API
- Chrome Downloads API
- Chrome Context Menus API
- Chrome Scripting API
- YouTube DOM/player integration
- MyMemory translation API
- Optional LibreTranslate

## GitHub Actions

This repository intentionally contains **no GitHub Actions workflow**. The extension is developed, tested and loaded locally through Chrome Developer Mode.

## `.exe`

A Chrome extension is not an `.exe`. This repository produces a Chrome extension. If a future Windows desktop application is required, the same learning engine can be wrapped with Tauri or Electron and documented as a separate desktop target.

## License

MIT. Third-party services and third-party video content remain subject to their own terms.


## Latest YouTube caption architecture

See `docs/21-caption-engine-root-cause-v3.6.0.md` for the historical caption-engine root-cause fix; v4.1.2 keeps that acquisition pipeline and builds the Learning Workspace, Library, toolbar-state and settings UX on top of it.
