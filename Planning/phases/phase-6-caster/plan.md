# Phase 6: Caster Macros (General) — Plan

## Task Groups

### 1. Concentration Check Macro
- [x] Create `utilities/concentration-check-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.damageActor` hook
- [x] Detect concentration via `actor.statuses` or effects fallback
- [x] Calculate DC = max(10, floor(damage / 2))
- [x] Post whispered chat reminder with DC and damage info
- [x] `isOwner` guard, no class prerequisite
- [x] Add manifest entry with `requires: {}`

### 2. Counterspell Macro
- [x] Create `feats/counterspell-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.renderChatMessage` hook
- [x] Detect enemy spell usage via `message.flags?.dnd5e?.use?.type`
- [x] Guard: caster must NOT be owned
- [x] Find all owned characters with Counterspell + available 3rd+ level slots
- [x] Include pact magic slot checking
- [x] Inject reaction prompt banner with dedup guard
- [x] Add manifest entry with `requires: { "spell": "Counterspell" }`

### 3. Manifest & Validation
- [x] Add both macros to `manifest.json` before `token-dashboard`
- [x] Create spec folder at `Planning/phases/phase-6-caster/`

## Status
- [x] Task Group 1: Concentration Check
- [x] Task Group 2: Counterspell
- [x] Task Group 3: Manifest & Validation
