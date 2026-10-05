# Charlie MJ Language v4.1.1 — Settings, Library and Toolbar Polish

## Purpose

v4.1.1 is a focused UX release on top of the v4.1.0 Learning Workspace. It does not replace the shared subtitle/timeline engine or the Learning Library data model.

## 1. Toolbar state

Mode buttons now communicate state visually. Active modes receive an `ON` treatment and `aria-pressed=true`; inactive modes return to the normal toolbar appearance. Save, bookmark, capture, translation and export actions receive a short completion state rather than pretending to be persistent toggles.

Stateful examples include:

- Subtitle visibility
- Transcript
- Word Learning
- Sentence Learning
- Focus Mode
- Study Mode
- A/B replay
- Appearance

## 2. Toolbar Settings action

The Settings action first uses `chrome.runtime.openOptionsPage()`. If Chrome does not open the options page from the YouTube content context, Charlie MJ falls back to opening the packaged `src/options/options.html` URL in a new tab.

## 3. Library navigation

The former long horizontal Library navigation is now grouped into:

- **Start** — Overview, Continue Learning
- **Content** — History, Videos, Transcripts
- **Learning** — Word Learning, Sentence Learning, Vocabulary, Review / Weak Words
- **Organize** — Collections, Bookmarks, Watch Later, Notes, Captures, Favorites, Checkpoints
- **My Collections** — user-created collections

The grid/list preference and all existing Library records remain unchanged.

## 4. Settings navigation

Settings no longer behave like a long scrolling document with anchor jumps. The sidebar is now a category router. Only sections belonging to the selected category are visible.

Categories:

- General
- Appearance
- Toolbar
- Subtitles & Timeline
- Learning
- Language Intelligence
- Translation
- Downloads
- Focus

This keeps the existing individual controls while making the page behave like a professional settings workspace.

## 5. Save feedback

Saving settings writes the complete preferences object to `chrome.storage.local`, changes the button to **✓ Saved**, and shows a success notification. After a short delay the button returns to **Save Settings**.

## Compatibility

The release remains Chrome Manifest V3, local-first, and does not require GitHub Actions. Existing v4.1.0 storage keys are preserved.
