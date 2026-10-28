# Update 2026-10-26: Favorites search fix

## Problem
`Uncaught (in promise) ReferenceError: highlightSearchText is not defined`
(`src/favorites/favorites.js`, thrown while rendering resource cards).

## Cause
`favorites.js` called `highlightSearchText`, `fuzzyMatch` and `searchScore`, but those helpers only
existed inside `dashboard.js` (an IIFE), so they were not available on the Favorites page.

## Changes
- `src/favorites/favorites.js`
  - Added a documented "Search helpers" section: `searchTokens`, `fuzzyTokenMatch`, `fuzzyMatch`,
    `searchScore`, `highlightSearchText`.
  - `highlightSearchText` matches on the raw text and escapes each piece separately, so queries
    such as "amp" can no longer corrupt HTML entities.
  - Search settings now have safe defaults before storage has loaded.
  - Re-indented `load()` and added JSDoc.
- `src/favorites/favorites.css`, `src/dashboard/dashboard.css`: styled `<mark>` highlight.
- `src/favorites/favorites.html`: bumped script cache-buster to `20261026-3`.
