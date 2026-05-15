# Phase 4: Paladin Macros — Plan

## Task Groups

### 1. Divine Smite Macro
- [x] Create `classes/paladin/divine-smite-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.renderChatMessage` hook
- [x] Detect melee weapon attack hits from owned Paladin characters
- [x] Build spell slot buttons (levels 1–5) showing remaining slots
- [x] Click handler: roll radiant damage dice, consume spell slot via `actor.update()`
- [x] Show undead/fiend bonus info (+1d8)
- [x] `isOwner` guard, skip-if-injected dedup
- [x] Add manifest entry with `requires: { class: "paladin", feat: "Divine Smite" }`

### 2. Lay on Hands Macro
- [x] Create `classes/paladin/lay-on-hands-macro.js`
- [x] Teardown/register lifecycle with `updateCombat` hook
- [x] Detect Paladin's turn, check Lay on Hands uses remaining
- [x] Check if Paladin or allies are damaged before reminding
- [x] Post whispered chat reminder with pool remaining
- [x] `isOwner` guard, per-turn dedup
- [x] Add manifest entry with `requires: { class: "paladin", feat: "Lay on Hands" }`

### 3. Aura of Protection Macro
- [x] Create `classes/paladin/aura-of-protection-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.renderChatMessage` hook
- [x] Detect saving throw rolls from any owned character
- [x] Find Paladin with "Aura of Protection" feat among owned actors
- [x] Inject reminder banner with Paladin's CHA modifier (minimum +1)
- [x] `isOwner` guard, skip-if-injected dedup
- [x] Add manifest entry with `requires: { class: "paladin", feat: "Aura of Protection" }`

### 4. Manifest & Validation
- [x] Add all three macros to `manifest.json` before `token-dashboard`
- [x] Create spec folder with requirements, plan, validation docs

## Status
- [x] Task Group 1: Divine Smite
- [x] Task Group 2: Lay on Hands
- [x] Task Group 3: Aura of Protection
- [x] Task Group 4: Manifest & Validation
