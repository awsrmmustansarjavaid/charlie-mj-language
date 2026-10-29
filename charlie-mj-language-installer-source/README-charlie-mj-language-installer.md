# Charlie MJ Language – Windows Installer

**Installer:** `charlie-mj-language-installer.exe`  
**Extension version:** 2.1.0  
**Platform:** Windows 10 / 11  
**Browser:** Google Chrome 114 or newer  
**Installs to:** `C:\Program Files (x86)\Charlie MJ Language\` (asks for Administrator permission)

Both EXEs use the Charlie MJ Language logo.

---

## Installation

1. Double-click **`charlie-mj-language-installer.exe`** and click **Yes** on the Windows permission (UAC) prompt.  
   If SmartScreen says *"Windows protected your PC"*, click **More info → Run anyway** (the EXE is not code-signed).
2. Click **Next**, then **choose your Chrome profile** from the dropdown (for example `Work (me@example.com) [Profile 1]`).
3. Wait for the install to finish and click **Finish** with *"Open Chrome Extensions page now"* ticked.
4. In the Chrome window that opens (your selected profile):
   1. Turn on **Developer mode** (top-right).
   2. Click **Load unpacked**.
   3. Press **Ctrl+V** to paste the folder path (already on your clipboard), then **Select Folder**.

Chrome starts as your normal user, not as Administrator.

### Why step 4 is manual

Chrome does not let an installer put an extension into a specific profile by itself.

- Editing Chrome's `Preferences` / `Secure Preferences` is protected and Chrome removes such extensions.
- `--load-extension` is ignored by current Google Chrome.
- Chrome's force-install policies and registry method apply to **every profile on the PC** (not one selected profile), and for an extension hosted outside the Chrome Web Store they only work on managed (domain/enterprise) PCs.

True one-click install into a chosen profile requires publishing the extension on the **Chrome Web Store** (an unlisted listing is enough). Ask for a Web Store version of this installer if you publish it.

---

## What gets installed

```
C:\Program Files (x86)\Charlie MJ Language\
├── charlie-mj-language.exe      launcher (opens Chrome in your profile)
├── config.ini                   selected Chrome profile
├── Uninstall.exe
├── assets\
│   └── charlie-mj-language.ico
└── extension\                   <- the folder you "Load unpacked"
    ├── manifest.json
    └── ...
```

Shortcuts (for all users): Desktop **Charlie MJ Language**; Start Menu folder with **Charlie MJ Language**, **Add extension to Chrome** and **Uninstall**.

## Using it

- **Charlie MJ Language** shortcut – opens YouTube in your chosen Chrome profile.
- **Add extension to Chrome** – copies the extension folder path, opens the folder, and opens `chrome://extensions` in your profile (same as `charlie-mj-language.exe --setup`).
- Shortcuts inside Chrome: `Alt+Shift+F` Focus Mode, `Alt+Shift+S` save subtitle as vocabulary (change at `chrome://extensions/shortcuts`).

## Changing the profile / updating

Run the installer again. Pick another profile or just install the new version, then in `chrome://extensions` load the folder in the new profile or click **reload** on the extension.

## Upgrading from the old AppData version

If an older install in `%LOCALAPPDATA%\Charlie MJ Language` is found, the installer asks whether to remove it.

**Important:** Chrome derives an unpacked extension's ID from its folder path, so the Program Files copy is a *new* extension to Chrome. Remove the old extension in `chrome://extensions` and load the new one. Data stored inside the old extension (for example saved vocabulary) does not carry over. If you need to keep it, export it from the old extension first.

## Uninstalling

**Settings → Apps → Installed apps → Charlie MJ Language → Uninstall** (or the Start Menu *Uninstall* shortcut).  
Then remove the extension from Chrome: `chrome://extensions` → **Remove**.

## Troubleshooting

| Problem | Fix |
|---|---|
| UAC prompt / "Unknown publisher" | Expected: the installer writes to Program Files and is unsigned. |
| Profile list empty | Open Chrome once, then run the installer again. The Default profile is used as a fallback. |
| Wrong profile list when using a different admin account | Run the installer from your own account (the list is read from the signed-in user's Chrome data). |
| *"Load unpacked"* missing | Turn on Developer mode. |
| *"Manifest file is missing or unreadable"* | Select the **`extension`** folder itself. |
| Extension not working on YouTube | Reload the YouTube tab (Ctrl+R). |

---

## Source code & rebuilding

```
charlie-mj-language-installer-source/
├── installer/CharlieMJLanguageInstaller.nsi   installer (NSIS) – admin, Program Files (x86), profile picker
├── app/launcher.c, launcher.rc                launcher EXE source (+ icon / version info)
├── scripts/Detect-ChromeProfiles.ps1          lists Chrome profiles for the picker
├── assets/                                    logo .ico and installer artwork
├── extension/                                 the unchanged Charlie MJ Language extension
└── build.sh                                   builds both EXEs into dist/
```

Build on Linux / WSL:

```bash
sudo apt install nsis mingw-w64
./build.sh
```

Output: `dist/charlie-mj-language.exe` and `dist/charlie-mj-language-installer.exe`.
