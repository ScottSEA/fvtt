# Phase 8: Item Macros — Plan

## Task Groups

### 1. Cloak of Displacement Macro
- [x] Create `items/cloak-of-displacement-macro.js`
- [x] Teardown/register lifecycle with `updateCombat` + `dnd5e.renderChatMessage` hooks
- [x] Turn-start whispered reminder with per-turn dedup
- [x] Incoming attack banner injection with target detection
- [x] `isOwner` guard, partial item name match
- [x] Add manifest entry

### 2. Ring of Spell Storing Macro
- [x] Create `items/ring-of-spell-storing-macro.js`
- [x] Teardown/register lifecycle with `updateCombat` hook
- [x] Check `system.uses` for remaining stored spell levels
- [x] Turn-start whispered reminder with per-turn dedup
- [x] `isOwner` guard, partial item name match
- [x] Add manifest entry

### 3. Winged Boots Macro
- [x] Create `items/winged-boots-macro.js`
- [x] Teardown/register lifecycle with `updateCombat` hook
- [x] Once-per-combat whispered reminder
- [x] `isOwner` guard, partial item name match, equipped check
- [x] Add manifest entry

### 4. Magic Shield Macro
- [x] Create `items/magic-shield-macro.js`
- [x] Teardown/register lifecycle with `updateCombat` hook
- [x] Detect equipped shield with +1/+2/+3 in name
- [x] Once-per-combat whispered reminder
- [x] `isOwner` guard
- [x] Add manifest entry

### 5. Flame Tongue Macro
- [x] Create `items/flame-tongue-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.renderChatMessage` hook
- [x] Detect attack rolls using Flame Tongue weapon (itemId or name fallback)
- [x] Banner injection with dedup
- [x] `isOwner` guard, partial item name match
- [x] Add manifest entry

### 6. Manifest & Spec Files
- [x] Add all 5 macros to `manifest.json` before `token-dashboard`
- [x] Create `Planning/phases/phase-8-items/` with requirements, plan, validation

## Status
- [x] Task Group 1: Cloak of Displacement
- [x] Task Group 2: Ring of Spell Storing
- [x] Task Group 3: Winged Boots
- [x] Task Group 4: Magic Shield
- [x] Task Group 5: Flame Tongue
- [x] Task Group 6: Manifest & Spec Files
