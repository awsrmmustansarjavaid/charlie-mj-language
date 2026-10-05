# Installation and Usage

## Requirements

- Google Chrome or a Chromium-based browser supporting Manifest V3.
- YouTube access.
- No Node.js, Python or GitHub Actions is required for the current extension build.

## Install locally

1. Download or clone the repository.
2. Open `chrome://extensions/`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select the repository root containing `manifest.json`.
6. Open a YouTube video.
7. Turn on YouTube captions.
8. Use the Charlie MJ toolbar inside the player.

## Settings

Open the extension popup and choose **Customize**, or open the extension's Options page.

Set target/native languages, grammar display preferences, translation provider and download root.

## Generate a Chrome extension package

Chrome extensions can be packaged from `chrome://extensions/` using **Pack extension** for local distribution. The repository does not require a GitHub workflow.

## About .exe

A Chrome extension itself is not an `.exe` application. This repository therefore does not pretend to generate a Windows executable. If a future desktop version is required, the extension's shared learning engine can be wrapped with Tauri or Electron and packaged separately. That is a different deliverable from the Chrome extension.

## First-use checklist

- Install unpacked extension.
- Open YouTube.
- Enable captions.
- Start video playback.
- Open Focus Mode if desired.
- Capture a bookmark or learning moment.
- Save vocabulary.
- Open the extension popup to inspect saved records.
- Export a JSON backup.
