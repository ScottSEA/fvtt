# Phase 3: Rogue Macros — Plan

## Task Groups

### 1. Sneak Attack Macro
- [x] Create `classes/rogue/sneak-attack-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.renderChatMessage` hook
- [x] Detect attack rolls from owned Rogue with finesse/ranged weapon
- [x] Calculate Sneak Attack dice from Rogue level
- [x] Inject banner reminder with dice count
- [x] `isOwner` guard, per-turn dedup via combat snapshot key
- [x] Add manifest entry with `requires: { class: "rogue", feat: "Sneak Attack" }`

### 2. Uncanny Dodge Macro
- [x] Create `classes/rogue/uncanny-dodge-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.renderChatMessage` hook
- [x] Detect incoming attacks that hit owned Rogue (targets + AC comparison)
- [x] Exclude actor's own attacks
- [x] Inject banner reminder about Reaction to halve damage
- [x] `isOwner` guard, target resolution via `fromUuidSync`
- [x] Add manifest entry with `requires: { class: "rogue", feat: "Uncanny Dodge" }`

### 3. Evasion Macro
- [x] Create `classes/rogue/evasion-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.renderChatMessage` hook
- [x] Detect DEX saving throw results for owned actors
- [x] Show color-coded success/failure result when DC available
- [x] Inject banner reminder about Evasion damage modification
- [x] `isOwner` guard, DEX-only filter
- [x] Add manifest entry with `requires: { class: "rogue", feat: "Evasion" }`

### 4. Manifest & Spec
- [x] Add all three macros to `manifest.json` (before token-dashboard)
- [x] Create `Planning/phases/phase-3-rogue/requirements.md`
- [x] Create `Planning/phases/phase-3-rogue/plan.md`
- [x] Create `Planning/phases/phase-3-rogue/validation.md`

## Status
- [x] Task Group 1: Sneak Attack
- [x] Task Group 2: Uncanny Dodge
- [x] Task Group 3: Evasion
- [x] Task Group 4: Manifest & Spec
