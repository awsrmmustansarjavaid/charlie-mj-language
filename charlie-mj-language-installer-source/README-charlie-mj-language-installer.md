# Charlie MJ Language – Windows Installer

**File:** `charlie-mj-language-installer.exe`
**Extension version:** 2.1.0
**Platform:** Windows 10 / 11 (64-bit or 32-bit)
**Browser:** Google Chrome (version 114 or newer)

Charlie MJ Language is a Chrome extension for multilingual YouTube language learning: transcripts, dual transcripts, YT Transcript Pro, learning tools, language intelligence and Focus Mode.

This installer puts the extension on your PC, lets you choose which **Chrome profile** to use, and walks you through adding it to Chrome.

---

## What is included

| File | Purpose |
|------|---------|
| `charlie-mj-language-installer.exe` | The installer. Includes the full extension and the app launcher. |
| `charlie-mj-language.exe` | The app launcher. Opens YouTube in your chosen Chrome profile. It is installed automatically by the installer. |
| `charlie-mj-language-installer-source.zip` | Source code, so the EXEs can be rebuilt. |

Both EXEs use the Charlie MJ Language logo.

---

## Installation

1. Double-click **`charlie-mj-language-installer.exe`**.
2. If Windows SmartScreen shows *"Windows protected your PC"*, click **More info**, then **Run anyway**. (The installer is not code-signed, so Windows shows this for unknown publishers.)
3. Click **Next** on the welcome page.
4. **Choose your Chrome profile** from the dropdown. Each entry shows the profile name, email and folder, for example `Work (me@example.com) [Profile 1]`.
5. Wait for the files to copy, then click **Finish** with *"Open Chrome Extensions page now"* ticked.

No administrator rights are needed.

### Final step: add the extension to Chrome

Chrome does not allow any installer to add an extension silently, so this last step is done by you. It takes about 20 seconds.

When the installer finishes, Chrome opens the Extensions page in your selected profile, and the extension folder path is already copied to your clipboard.

1. Turn on **Developer mode** (toggle at the top-right of `chrome://extensions`).
2. Click **Load unpacked**.
3. Paste the folder path into the address bar of the folder dialog (**Ctrl+V**), press Enter, then click **Select Folder**.
4. Optional: click the puzzle-piece icon in Chrome's toolbar and **pin** Charlie MJ Language.

You only need to do this once per profile.

> The folder is: `%LOCALAPPDATA%\Charlie MJ Language\Extension`
> (usually `C:\Users\<your name>\AppData\Local\Charlie MJ Language\Extension`)

---

## Where things are installed

| Item | Location |
|------|----------|
| Program files | `%LOCALAPPDATA%\Charlie MJ Language\` |
| Extension folder | `%LOCALAPPDATA%\Charlie MJ Language\Extension\` |
| Selected profile setting | `%LOCALAPPDATA%\Charlie MJ Language\config.ini` |
| Desktop shortcut | `Charlie MJ Language` |
| Start Menu | `Charlie MJ Language` folder (app, *Add extension to Chrome*, *Uninstall*) |

---

## Using the app

- **Charlie MJ Language** shortcut – opens YouTube in the Chrome profile you chose.
- **Add extension to Chrome** (Start Menu) – repeats the final step: copies the extension folder path, opens the folder, and opens `chrome://extensions` in your profile. Use it if you closed the page too early.

### Keyboard shortcuts (inside Chrome)

| Shortcut | Action |
|----------|--------|
| `Alt + Shift + F` | Toggle Focus Mode |
| `Alt + Shift + S` | Save the current subtitle as vocabulary |

You can change these at `chrome://extensions/shortcuts`.

---

## Changing the Chrome profile

Run `charlie-mj-language-installer.exe` again and pick a different profile. The extension itself works in whichever profile you load it into, so repeat the *Load unpacked* step in that profile.

## Updating

Run the newer installer. It replaces the files in the same folder. Then open `chrome://extensions` and click the **reload** icon on Charlie MJ Language.

## Uninstalling

1. Open **Settings → Apps → Installed apps → Charlie MJ Language → Uninstall**, or use the *Uninstall* shortcut in the Start Menu folder.
2. Remove the extension from Chrome: `chrome://extensions` → **Remove** on Charlie MJ Language.

The uninstaller removes the program files, shortcuts and registry entry. It cannot remove the extension from Chrome itself, so step 2 is manual.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| *"Windows protected your PC"* | Click **More info → Run anyway**. The file is unsigned. |
| Profile list is empty | The installer falls back to Chrome's **Default** profile. Open Chrome at least once, then run the installer again. |
| *"Google Chrome was not found"* | Install Google Chrome, then run the installer or **Add extension to Chrome** again. |
| "Load unpacked" is missing | Developer mode is off. Turn it on at the top-right of `chrome://extensions`. |
| Chrome says "Manifest file is missing or unreadable" | Select the **`Extension`** folder itself, not its parent. |
| Extension disappeared after Chrome restart | Chrome may disable unpacked extensions on startup. Click **Keep** or re-enable it on `chrome://extensions`. |
| Opened the wrong profile | Run the installer again and choose the correct profile. |
| Extension not working on YouTube | Reload the YouTube tab (**Ctrl+R**) after loading the extension. |

---

## Notes

- Works with **Google Chrome**. Other browsers (Edge, Brave) are not configured by this installer.
- The extension stores its settings in Chrome. Uninstalling the app does not delete your saved vocabulary until you remove the extension from Chrome.
- The extension needs access to YouTube pages and a few translation and dictionary services (DeepL, Microsoft Translator, MyMemory, Wiktionary, dictionaryapi.dev), as declared in its `manifest.json`.

---

## Rebuilding from source

Source files are in `charlie-mj-language-installer-source.zip`. On Linux or WSL:

```bash
sudo apt install nsis mingw-w64 imagemagick

# 1. Place the unzipped extension at:  ext/CharlieMJ-Language-v2.0.0
# 2. Build the launcher
cd src
x86_64-w64-mingw32-windres launcher.rc -O coff -o launcher_res.o
x86_64-w64-mingw32-gcc -municode -mwindows -Os -s \
  -o ../charlie-mj-language.exe launcher.c launcher_res.o \
  -luser32 -lshell32 -ladvapi32 -static

# 3. Build the installer
makensis installer.nsi    # creates ../charlie-mj-language-installer.exe
```

---

© Charlie MJ. Extension license: see `LICENSE` inside the extension folder.
