# Charlie MJ Language — v4.4.1 Beta

**A lightweight, local-first Chrome extension for learning languages through YouTube.**

![Charlie MJ Language v4.1.3](assets/charlie-mj-language-v4.0.0-thumbnail.png)

Charlie MJ Language brings subtitles, transcript study, vocabulary, sentence saving, translation, dictionary lookups, and learning-library tools into the YouTube viewing experience.

## Download

<p align="center">
  <a href="/downloads/charlie-mj-language-v4.4.1-beta-final-fixes.zip">
    <img src="https://img.shields.io/badge/%E2%AC%87%20Download%20Chrome%20Extension-2ea44f?style=for-the-badge" alt="Download Chrome Extension">
  </a>
</p>

- **Version:** `4.4.1-beta`
- **Platform:** Chrome Extension — Manifest V3
- **Minimum Chrome version:** 114
- **License:** MIT
- **Project:** [GitHub repository](https://github.com/awsrmmustansarjavaid/charlie-mj-language)

> **Learning flow:** Watch → Understand → Capture → Organize → Review → Continue

## What's new in v4.4.1 Beta

- **Transcript header visibility:** the header wraps responsively so the title and window controls remain fully visible at narrow widths. The transcript panel uses a flex layout so the header and tabs stay intact while the transcript body scrolls.
- **Two-axis resizing:** use the transcript panel's top/bottom edges to change height and left/right edges to change width; corner handles resize both dimensions. Custom handles remain inside the panel boundary so they are not clipped.
- **Viewport protection:** after resizing the browser or panel, the transcript window is constrained to the visible viewport where possible. Existing drag, dock, minimize, maximize, pin, auto-hide, and saved-size behavior is retained.

## What's new in v4.3.8 Beta

- **Verified save feedback:** Watch Later, timeline bookmarks, and Note Lab now show success only after `chrome.storage.local.set()` succeeds.
- **Watch Later reliability:** validates the video ID, normalizes the stored list, and checks the write result before showing confirmation.
- **Timeline bookmarks:** validates the current video and confirms persistence before reporting that the bookmark was saved.
- **Note Lab text boxes:** creates an editable note, persists it before rerendering, focuses the new editor, and reports failed saves instead of silently losing the note. Delete, manual save, and autosave use the same checked storage path.
- **Context invalidation:** storage-dependent actions fail safely and ask for a YouTube page refresh rather than displaying false success. Chrome does not allow an invalidated content script to reconnect to a reloaded extension.

- **Graceful extension-context invalidation:** progress-save callbacks now exit before storage access when Chrome has invalidated the old content script. The extension avoids repeated console warnings and shows one refresh notice. Refreshing the YouTube tab remains required after updating/reloading the extension.

### Configurable success notification position

The **Settings → UI Components → Success notifications** section lets you choose where save-success and status notifications appear:

- **Center Below Subtitles** — default
- **Bottom Right**
- **Bottom Left**

This setting changes notification placement without replacing the subtitle, transcript, or library workflows.

### Real-time transcript highlighting (new in v4.3.8 Beta)

The **Settings → UI Components → Live Transcript Highlighting** panel synchronizes the active transcript row to the video's caption timeline without replacing the transcript-fetching engine.

- Enable or disable live highlighting independently.
- Choose soft transparent background, rounded background, underline, left accent bar, or text-color-only styles.
- Customize highlight color (`#8B5CF6` by default), background opacity (25% by default), and active text color or inherit the transcript color.
- Show a speaker icon beside the currently spoken sentence; it moves with the active highlight.
- Synchronize from the active subtitle or the video playback position.
- Optionally auto-scroll the active row near the center, top, or bottom of the transcript window.
- Respect manual scrolling by temporarily pausing auto-scroll; keep the current sentence highlighted while paused.
- Set the transition duration (150 ms by default), preview the style in Settings, copy the preview settings, or reset the appearance.

The feature uses the existing timestamped caption segments and updates the active row's classes instead of rebuilding the transcript on every playback tick. The original subtitle and its translation are highlighted together because they share one transcript row. The active row is selected from the current playback time, and stale indices are cleared when a cue is no longer active. Native on-screen captions are used only as a fallback when no timestamped transcript is available; they are no longer appended to an existing transcript, preventing duplicate/out-of-order rows that could make the highlight jump to a different sentence. The speaker icon is a visual marker only. It does not alter transcript text, copy/selection behavior, or the caption-fetching engine. Synchronization quality depends on the timestamp accuracy supplied by YouTube.

### Modular transcript Service Engine

- Added a dedicated **Service Engine** section in Settings.
- Added `transcript-service.config.json` as a separate configuration contract for transcript services.
- Kept the existing fast YouTube transcript-fetching engine as the default: `legacy-youtube`.
- Added configurable caption-track preferences: original/manual first, manual/original first, or auto-generated first.
- Supports discovery of caption languages when YouTube exposes them for a video.
- Preserves backward compatibility; the existing fetch implementation remains authoritative while future providers can be added through adapters.

**Important:** The configuration prepares the architecture for additional providers; it does not mean that every future transcript provider is already implemented. Available tracks and languages depend on YouTube and the individual video.

### UI and learning workflow

- Adjustable YouTube learning toolbar, including position, size, scale, button arrangement, and hover-reveal behavior.
- Resizable, draggable transcript window with positioning, pinning, and window controls.
- Adjustable subtitle appearance, including size, color, and text formatting.
- Real-time transcript sentence highlighting with custom styles, playback synchronization, and optional auto-scroll.
- Word and sentence learning actions linked to YouTube video context and timestamps where available.
- Translation and dictionary information, including provider/source labels when returned by the service.
- Vocabulary and sentence saving, notes, bookmarks, and learning-library workflows.
- Local-first settings and learning data using Chrome storage.

> **Beta note:** v4.3.8 includes the verified-save fixes and retains Live Transcript Highlighting and a caption timing correction and a context-safe playback loop intended to prevent the highlight from freezing when Chrome invalidates the old extension context. The updated code has been checked with static validation and package-level checks in this environment; a live Chrome/YouTube playback regression test has not been performed here. If Chrome reports “extension context invalidated” immediately after updating/reloading the extension, refresh the open YouTube tab so Chrome can inject the new content script; the playback/highlighting loop now continues using already-loaded page data, while storage-dependent actions show a refresh notice and avoid repeated error stack traces. Refresh the YouTube tab after updating to restore storage and saving.

## Core features

### YouTube subtitles and transcript

- Fetches YouTube caption tracks independently of the native CC display when available.
- Displays original and translated subtitles.
- Provides a timestamped transcript and subtitle/timeline synchronization.
- Supports available manual/original and auto-generated caption tracks.
- Supports available caption-language discovery where YouTube exposes track metadata.
- Includes transcript and learning-data export tools.

### Word and sentence learning

- Interactive word lookup and translation.
- Dictionary and translation source details when provided by the selected service.
- Part-of-speech highlighting and visual formatting.
- Vocabulary capture and sentence saving.
- Video-linked learning records and timestamp context where available.
- Sentence replay, looping, A/B replay, and playback-speed learning controls where available in the interface.

### Learning library and productivity

- Vocabulary, sentence learning, bookmarks, notes, Watch Later, and related saved learning items.
- Search and filtering tools for supported library views.
- Import/export tools for supported formats, including common transcript and learning-data formats.
- Local-first storage: data remains in Chrome local storage unless you explicitly export or download it.
- Focus Mode and toolbar controls to support a less distracting learning workflow.

### Customization

- Success notification position settings.
- Toolbar visibility, position, size, and reveal settings.
- Transcript window position, dimensions, and controls.
- Subtitle display and learning-interface appearance settings.
- Transcript Service Engine configuration kept separate from the UI settings.

*Feature availability can depend on the current YouTube page, available caption tracks, browser permissions, and the external service response.*

## Installation

1. Download or clone the repository and extract it if you downloaded a ZIP.
2. Open Chrome and visit `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the extracted extension folder containing `manifest.json`.
6. Open or refresh a YouTube video.

If YouTube was already open when you installed or reloaded the extension, refresh that tab once.

## Settings

Open the extension's Settings page to configure the interface and learning behavior.

- **UI Components:** Set success notification position and adjust toolbar/transcript UI controls.
- **Service Engine:** Choose the available transcript engine, set caption-track preference, and enable caption-language discovery when exposed by YouTube.
- **Subtitle & timeline engine:** Configure subtitle fetching and synchronization options.
- **Appearance:** Choose the learning-interface theme where supported.

The current default transcript engine is `legacy-youtube`. Keep this setting unless you are testing a provider that has been explicitly implemented and validated.

## Transcript service configuration

The root-level `transcript-service.config.json` defines the configuration contract for transcript engines. It currently identifies `legacy-youtube` as the default and records supported capabilities and track-preference options.

The current implementation remains in `src/content/youtube.js` (`fetchYouTubeCaptionBundle`). Future providers should be added as separate adapters and integrated without replacing the stable default path until compatibility and regression tests pass.

Do not treat a listed capability as a guarantee that YouTube provides a track for every video. Caption availability is controlled by YouTube and the video owner/source.

## Project structure

```text
charlie-mj-language/
├── assets/                         # Extension images and assets
├── docs/                            # Project and implementation documentation
├── icons/                           # Extension icons
├── src/
│   ├── background/                  # Background service worker
│   ├── content/                     # YouTube integration and page scripts
│   ├── dashboard/                   # Learning library/dashboard
│   ├── lib/                         # Shared utilities
│   ├── options/                     # Settings interface and logic
│   └── popup/                       # Extension popup
├── transcript-service.config.json   # Modular transcript service configuration
├── manifest.json                    # Chrome Extension Manifest V3
├── LICENSE
└── README.md
```

## Privacy and storage

Charlie MJ Language uses Chrome extension storage for local settings and learning records. Some features contact external services, such as translation or dictionary providers, to perform the requested lookup. Review the relevant provider's terms and privacy policy when using those services. Exported files are saved through the browser's download flow.

## Development and testing

- JavaScript, HTML, and CSS for a Chrome Manifest V3 extension.
- Uses Chrome extension APIs for storage, downloads, context menus, scripting, and related browser integration.
- YouTube integration depends on page/player behavior that can change over time.
- Test on real YouTube videos with different caption-track configurations before releasing changes.

### Recommended regression checks

After changing UI settings or transcript services, verify:

1. The existing default transcript engine still fetches available captions.
2. Original/manual and auto-generated tracks are handled according to the selected preference when available.
3. Subtitle display and timeline synchronization continue to work.
4. Vocabulary and sentence saving still work and saved items appear in the library.
5. Library search, editing, import, and export remain functional.
6. Success notifications appear in the selected position.
7. Toolbar and transcript window controls remain usable at different sizes and positions.

## Compatibility and roadmap

The modular service configuration is designed to make future transcript providers possible. New providers should be introduced incrementally behind a separate adapter, with the current fast YouTube engine retained as the fallback/default until a replacement has passed regression testing.

Potential future improvements include additional caption-provider adapters and expanded provider diagnostics. These are roadmap ideas, not claims that those services are already available in this release.

## License

This project is distributed under the MIT License. See [`LICENSE`](LICENSE) for details.


## v4.3.8 Beta — bookmark persistence and independent auto-hide

- Toolbar bookmarks are now written and read back for persistence verification before a success notification appears. Duplicate clicks at the same video timestamp are handled safely, and failed writes show an error instead of a false success.
- Added independent auto-hide enable/disable settings for the Toolbar and Transcript Window.
- Each window has its own persistent 5, 10, 15, or 30 second hide delay. Disabling one does not disable or hide the other.
- Settings are stored in `chrome.storage.local` and applied by the YouTube content script.


## v4.3.9 Beta — transcript layout and resizing

- Improved responsive transcript header layout to prevent title and action controls from being clipped.
- Added/secured visible top and bottom resize edges for transcript height, preserving left and right width resizing and corner-based two-axis resizing.
- Reworked panel internals to use a flex column so header/tabs stay visible while transcript content scrolls.
- Kept resize handles inside the clipped panel boundary and added viewport-fit safeguards.
- Regression checks performed in this package: JavaScript syntax validation, manifest JSON validation, and archive integrity. Live Chrome/YouTube interaction testing is still recommended.


## v4.4.0 Beta — independent subtitle and translation layout

- **Notes keyboard isolation:** Typing in Notes editors no longer bubbles keyboard events to YouTube/page shortcuts. Native text editing remains intact; extension shortcuts continue working outside the Notes editor.
- **Independent original and translation boxes:** Each subtitle layer supports Auto/Small/Medium/Large/Custom width and height, independent maximum width and height, maximum lines (default 2), custom line limits, text wrapping, padding, background opacity, and corner radius.
- **Live settings previews and reset:** Original and translation box settings each have a live preview and a dedicated reset button.
- **Typography line spacing:** Original and translation subtitle line spacing can be adjusted independently in pixels, separately from font size.
- **Settings organization:** Maximum width/height, maximum lines/custom maximum lines, and padding/corner radius are grouped in two-column rows. The redundant subtitle font-size control was removed from the UL Subtitles settings; font size remains in Appearance.
- **Backward compatibility:** Existing stored preferences and the current caption/transcript engine remain intact. New settings use defaults when absent.

### Validation notes

JavaScript syntax, manifest JSON, and ZIP integrity were checked. Please perform final manual testing in Chrome on YouTube for the exact visual layout and key handling across different videos, window sizes, and subtitle languages.


## v4.4.1 Beta — modern settings workspace

- **Grid layout correction:** compact component cards now share two-column rows on desktop instead of each automatically consuming the entire settings section. Cards containing complex toolbar controls or large interactive previews retain full width where appropriate.
- **More useful horizontal space:** ordinary controls continue to use paired columns; grouped position, offset, dimensions, color, and behavior settings can be scanned side by side. Nested two-column controls keep their full card width so inputs remain readable.
- **Responsive behavior:** component cards stack when the available width is too narrow, and all settings collapse to a single column on small screens. Hover and focus effects remain subtle and separate from active navigation states.
- **Functionality preserved:** this is a CSS/layout-only correction. Existing setting IDs, storage keys, defaults, conditional controls, event handlers, and save behavior were not changed by this correction.

- Redesigned the settings page with a consistent dark professional visual system, clearer hierarchy, rounded section cards, subtle hover/focus states, and improved spacing.
- Improved responsive layout: two-column settings on desktop, compact three-column color controls where space allows, and single-column controls on narrow screens. Existing tab/category navigation remains in place and becomes a horizontally scrollable category bar on smaller screens.
- Standardized checkbox controls into accessible ON/OFF-style switches and unified input, select, color-picker, button, and save-bar styling.
- Added conditional visibility for custom width/height and custom maximum-line fields, plus auto-hide delay controls only when the relevant auto-hide option is enabled. Hidden controls retain their values; no settings IDs or storage keys were renamed.
- Added an unsaved-changes indicator while preserving the existing Save Settings workflow.
- This release focuses on settings-page presentation and usability. Existing stored settings, defaults, event handlers, extension behavior, and features are retained.

### Validation notes

JavaScript syntax, manifest JSON, HTML ID uniqueness, and ZIP integrity were checked for this layout-correction package. The layout rules were reviewed for desktop two-column cards and responsive stacking. Live Chrome/YouTube visual regression testing has not been performed in this environment; verify all tabs, save operations, and layouts at desktop and mobile widths before distributing the beta.

## v4.4.1 Beta — line spacing, toolbar grid and Notes keyboard fixes

- **Unitless line spacing:** replaced the old pixel-based line-spacing inputs in Original subtitle typography and Translation subtitle typography with a multiplier selector: `1.0`, `1.2`, `1.5`, `1.8`, `2.0`, plus Custom (`0.8`–`3.0`). The default is `1.0`; line height now scales with the selected font size.
- **Legacy setting migration:** old pixel values are converted to unitless multipliers on YouTube startup. The previous defaults (36 px original and 28 px translation) migrate to `1.0`; non-default legacy values are converted relative to the configured font size.
- **Toolbar settings grid:** reorganized the toolbar controls into intentional pairs, including horizontal/vertical position, horizontal/vertical offset, toolbar scale/width, height/hover zone, reveal mode/auto-hide, and hide delay/overflow behavior. This removes empty half-rows caused by groups containing an odd number of controls. The toolbar drag-and-drop manager remains full width.
- **Notes keyboard isolation:** added capture-phase keyboard isolation for the Notes contenteditable so YouTube and extension keyboard handlers do not receive keystrokes while a note is being edited. Normal typing, Space, Enter, Shift/Caps Lock, and common text-editing shortcuts retain their native behavior. Outside Notes editors, existing shortcuts continue to work.
- **Compatibility:** kept the package at version `4.4.1`, retained existing setting IDs and storage keys, and preserved all other features and save behavior.

### Validation notes

JavaScript syntax, manifest JSON, required settings IDs, duplicate HTML IDs, and ZIP integrity were checked. The uploaded screenshots were inspected and the toolbar control groups were rearranged to eliminate the highlighted empty cells. Live Chrome/YouTube testing is still required to verify native contenteditable keyboard behavior and the final layout at different window widths.

