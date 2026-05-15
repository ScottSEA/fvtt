# Phase 5: Ranger Macros — Plan

## Task Groups

### 1. Hunter's Mark Macro
- [x] Create `classes/ranger/hunters-mark-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.renderChatMessage` hook
- [x] Detect attack rolls, resolve actor, check for Hunter's Mark spell
- [x] Check concentration status (`statuses.has("concentrating")` + effect fallback)
- [x] Inject green-themed reminder banner with 1d6 damage note
- [x] `isOwner` guard, dedup guard on banner element
- [x] Add manifest entry with `requires: { class: "ranger", spell: "Hunter's Mark" }`

### 2. Favored Foe Macro
- [x] Create `classes/ranger/favored-foe-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.renderChatMessage` hook
- [x] Detect attack rolls, resolve actor, check for Favored Foe feat
- [x] Check uses remaining via `system.uses`
- [x] Per-turn dedup using combat snapshot key
- [x] Inject green-themed reminder banner with uses count
- [x] `isOwner` guard, dedup guard on banner element
- [x] Add manifest entry with `requires: { class: "ranger", feat: "Favored Foe" }`

### 3. Manifest & Specs
- [x] Add both macros to `manifest.json` before `token-dashboard`
- [x] Create `Planning/phases/phase-5-ranger/requirements.md`
- [x] Create `Planning/phases/phase-5-ranger/plan.md`
- [x] Create `Planning/phases/phase-5-ranger/validation.md`

## Status
- [x] Task Group 1: Hunter's Mark
- [x] Task Group 2: Favored Foe
- [x] Task Group 3: Manifest & Specs
