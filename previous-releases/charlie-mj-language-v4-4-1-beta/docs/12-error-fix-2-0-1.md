# Charlie MJ Language 2.0.1 — Popup Receiver Fix

## Problem

Chrome could show:

`Uncaught (in promise) Error: Could not establish connection. Receiving end does not exist.`

This happened when the popup attempted to send a message to the YouTube content
script while that receiver was not currently loaded. A common example is opening
YouTube before installing/reloading the extension.

## Fix

Version 2.0.1 changes the popup communication path so it:

1. Checks that the active tab is a supported YouTube page.
2. Sends the requested command normally.
3. Catches a missing receiver instead of producing an unhandled Promise error.
4. Injects `src/content/youtube.css` and `src/content/youtube.js` through the
   Manifest V3 scripting API when the content layer is missing.
5. Retries the command after injection.
6. Displays a useful status message if Chrome still prevents attachment.

## User installation rule

After installing or updating the unpacked extension, refresh an already-open
YouTube tab once. The popup recovery path also attempts automatic attachment,
but refreshing the page gives YouTube a clean content-script lifecycle.

## YouTube overflow menu

The content script also watches YouTube's dynamic menu surfaces and inserts:

**🌍 Charlie MJ — Add to Watch Later**

The extension's background context-menu entry remains available as a reliable
browser-level fallback when YouTube changes its own internal menu structure.
