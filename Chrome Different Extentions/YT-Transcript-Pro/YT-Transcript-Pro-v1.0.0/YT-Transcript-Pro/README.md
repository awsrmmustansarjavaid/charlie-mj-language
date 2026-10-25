# YT Transcript Pro v1.0.0

Copy or download YouTube transcripts and two-language (dual) subtitles, with or without timestamps. Manifest V3, Chrome and Edge, no account, no server, no analytics.

## Install (Chrome / Edge / Brave)
1. **Remove any older YT Transcript Pro** at `chrome://extensions` (or `edge://extensions`). The version number is unchanged, so the old copy would otherwise keep running.
2. Extract the ZIP. Turn on **Developer mode**, click **Load unpacked**, choose the `YT-Transcript-Pro` folder.
3. Open YouTube and press **Ctrl+Shift+R**. A caption button appears first in the player's right-hand controls.

## Using it
- **Player button** opens the transcript window (beside the video, or floating).
- **Copy with / without timestamps** copies the whole transcript, no file needed.
- **TXT, SRT, VTT, CSV** download buttons. Dual-language works in every format.
- Pick **Original** and **Translation**. Translation uses YouTube's own caption tracks and its auto-translation list.
- Click a line to jump the video. **Ctrl+click** or **Shift+click** to select lines, then *Copy selected*.
- Toolbar icon: front panel with copy/download and quick settings.

## Settings (toolbar icon > settings icon, or `chrome://extensions` > Details > Extension options)
Side tabs: General, Transcript, Dual language, Appearance (themes, 9 custom colors, fonts, window size, live preview), Copy & export, Downloads (subfolder, ask where to save, file-name template), Player & sync, Shortcuts, Advanced (backup, import, reset).

Default shortcuts on YouTube: Alt+T window, Alt+C copy with timestamps, Alt+Shift+C copy without, Alt+D download TXT, Alt+F search. All can be changed.

## Notes
- **Download location:** browsers let extensions save only inside the Downloads folder. Use the *Subfolder* option, or *Ask where to save each file* to choose any folder.
- **Shorts:** supported through the toolbar popup and shortcuts (floating window). The in-player button is for normal videos.
- A video with captions disabled, or a translation YouTube does not offer, cannot be loaded; the window says so.
- YouTube changes its internals often. Caption loading tries several methods, but if it breaks, Advanced > *Log details*, then check the Console (F12).

## Layout
`content/page-bridge.js` runs inside YouTube's page to read the player and fetch captions; `content/content.js` is the UI; `transcript/` parse, align, format; `export/` file builders; `background/` saves files; `popup/` and `options/` are the front panel and settings.
