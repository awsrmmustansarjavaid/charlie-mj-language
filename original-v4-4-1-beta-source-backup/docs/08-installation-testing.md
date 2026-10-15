# Installation, Testing and Troubleshooting

## Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select the repository root.
5. Pin Charlie MJ Language.
6. Open YouTube and start a video with captions.

## Reload after source changes

Use the **Reload** button on the extension card in `chrome://extensions`. Refresh the YouTube tab afterward.

## If the toolbar is missing

- Confirm the extension is enabled.
- Confirm the page is `youtube.com/watch?...`.
- Refresh the YouTube page.
- Open DevTools Console and look for Charlie MJ errors.
- Make sure the content script has not been blocked by a browser policy.
- Turn on YouTube CC and reload the video.

## If transcript is empty

Some videos do not expose usable captions. Turn on CC, choose an available caption language and reload. YouTube can also change internal caption data structures, which may require adapter maintenance.

## If Watch Later is missing from the three-dot menu

Open the video overflow menu after the extension has loaded. Charlie MJ observes the menu and inserts its item. If YouTube changes the menu DOM, use the Charlie MJ toolbar button or the right-click context-menu fallback.

## No GitHub Actions

There is no CI workflow. Local Chrome loading is the intended development/test loop.

## Popup receiver recovery

The popup does not assume that `youtube.js` is already present. If Chrome reports
that a message receiver does not exist, the popup checks the active URL, injects
the YouTube stylesheet/content script through the MV3 scripting API, and retries
the requested action. This is especially important when YouTube was already open
while the extension was installed, updated, or reloaded. Non-YouTube pages are
handled without sending unsupported messages.
