# Charlie MJ Language v4.1.3 — Collection Copy & Move Final Fix

## Purpose

v4.1.3 completes the Learning Library collection workflow. Users can now add library items to collections directly from item cards instead of creating collections without a way to populate them.

## Collection actions

Every item stored in a Library page with a data source now exposes **Add to Collection**.

Items already inside a custom collection also expose **Move to Collection**.

### Add to Collection
- Keeps the original item in its current Library page.
- Creates a copy in the selected custom collection.
- Prevents duplicate copies of the same item.
- Allows the same learning item to belong to multiple collections.

### Move to Collection
- Available from custom collections.
- Adds the item to another selected collection.
- Removes it from the original custom collection after the copy succeeds.
- Prevents selecting the current collection as the destination.

## Supported learning data

The collection workflow works with the existing local-first Library data model, including videos, word learning, sentence learning, vocabulary, bookmarks, watch-later items, captures, checkpoints and other saved learning records that expose a Library storage key.

## UI

The action appears beside Copy and other item actions. The collection dialog clearly identifies whether the operation is **Add** or **Move** and explains what will happen before confirmation.

## Storage

Custom collection records continue to use:

```text
libraryPages
libraryPage_<collection-id>
```

No cloud service or GitHub Action is required.

## Validation

- Chrome Manifest V3: validated
- Dashboard JavaScript: `node --check` validated
- Manifest JSON: validated
- No GitHub Actions: preserved
- Existing v4.1.2 settings/library architecture: preserved
