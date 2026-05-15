# Phase 2: Fighter Macros — Plan

## Task Groups

### 1. Action Surge Macro
- [ ] Create `classes/fighter/action-surge-macro.js`
- [ ] Teardown/register lifecycle with `updateCombat` hook
- [ ] Detect actor's turn, check Action Surge uses remaining
- [ ] Post chat reminder with uses count
- [ ] `isOwner` guard, per-turn dedup
- [ ] Add manifest entry with `requires: { class: "fighter", feat: "Action Surge" }`

### 2. Second Wind Macro
- [ ] Create `classes/fighter/second-wind-macro.js`
- [ ] Teardown/register lifecycle with `updateCombat` hook
- [ ] Detect actor's turn, check Second Wind uses AND HP < 50%
- [ ] Post chat reminder with healing formula
- [ ] `isOwner` guard, per-turn dedup
- [ ] Add manifest entry with `requires: { class: "fighter", feat: "Second Wind" }`

### 3. Indomitable Macro
- [ ] Create `classes/fighter/indomitable-macro.js`
- [ ] Teardown/register lifecycle with `renderChatMessage` hook
- [ ] Detect failed saving throws (roll total < DC) for owned actors
- [ ] Inject reroll button into chat message
- [ ] Button handler: roll new save, post result as chat message
- [ ] `isOwner` guard, resource check (uses remaining)
- [ ] Add manifest entry with `requires: { class: "fighter", feat: "Indomitable" }`

### 4. Manifest & Validation
- [ ] Add all three macros to `manifest.json`
- [ ] Verify loader installs them for a Fighter character
- [ ] Verify loader skips them for non-Fighter characters

## Status
- [ ] Task Group 1: Action Surge
- [ ] Task Group 2: Second Wind
- [ ] Task Group 3: Indomitable
- [ ] Task Group 4: Manifest & Validation
