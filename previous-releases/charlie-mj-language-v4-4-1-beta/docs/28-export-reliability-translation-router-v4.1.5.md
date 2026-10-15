# Charlie MJ Language v4.1.5 — Export Reliability and Translation Router

## Export fix

The Library previously failed in Chrome because the export form used the single-element `$()` selector for a collection of checked inputs. v4.1.5 uses `document.querySelectorAll('#exportChoices input[type="checkbox"]:checked')`.

Downloads now:
- validate the Chrome downloads API result;
- use conflict-safe filenames;
- sanitize the configured download path;
- retain object URLs long enough for Chrome to consume them;
- report provider/download/PDF errors in the Library UI.

Supported Library formats remain TXT, MD, DOC, PDF, JSON, CSV, SRT, VTT and Anki TSV where applicable.

## YouTube-first translation

When a target-language YouTube caption track is available, Charlie MJ uses the matching timed subtitle at the current cue before calling an external translation provider. The subtitle source is shown in the subtitle metadata.

If the target caption is not available, the Translation Router selects configured providers according to the user's priority order.

## Providers

Core/default:
- YouTube subtitle data.
- Dictionary/reference engine.

Optional:
- Google Translation — API key required.
- Microsoft Translator — API key and optional region.
- DeepL — API key.
- MyMemory — public online fallback.
- LibreTranslate — configured server.
- Argos — optional local service; no large model is bundled.

Provider modules fail independently and fall through to the next configured provider.

## Privacy and performance

Translations can be cached locally. Timeout/retry limits and maximum request length are configurable. Privacy Mode prevents online provider use. Online-only and offline-only modes are available.

Verification Mode is a comparison aid, not a guarantee of correctness.

## Compatibility note

Google, Microsoft, DeepL, LibreTranslate and Argos availability depends on valid configuration, credentials, service availability and provider limits. Charlie MJ does not claim unlimited usage or guaranteed translation accuracy.

## Existing learning behavior

The v4.1.5 build preserves the existing Library item → YouTube timestamp navigation, Collections, Favorites, Notes, Checkpoints, Learning Workspace, subtitle timeline synchronization and Settings category navigation.
