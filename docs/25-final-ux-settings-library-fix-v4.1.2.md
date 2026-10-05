# Charlie MJ Language v4.1.2 — Final Settings & Library UX Fix

## Purpose

v4.1.2 is a maintenance release focused on restoring the complete v4.1.0 settings experience while keeping the v4.1.1 categorized navigation model.

## Settings restoration

- Restores all v4.1.0 settings controls.
- Adds visible controls for Focus Mode default and word-definition popup auto-close, which were referenced by the settings controller but were not exposed in the UI.
- Sidebar navigation is initialized reliably when the options page loads.
- Selecting a category displays only that category's settings cards; it no longer jumps to an anchor inside one long settings page.
- Save preserves unknown/new stored preference keys instead of replacing the entire settings object with a reduced subset.
- Save shows a persistent short-lived `✓ Saved` state and confirmation message.

## Library toolbar alignment

The Library toolbar now uses three deliberate rows:

1. Search
2. Filters, including **All videos**
3. Copy / Download / Export / Import actions

This prevents the All Videos filter and Copy button from occupying the same layout space at intermediate widths.

## Compatibility

The release keeps the existing v4.1.x local storage keys, learning records, collections, checkpoints, transcript data and toolbar preferences. No migration that clears user data is performed.
