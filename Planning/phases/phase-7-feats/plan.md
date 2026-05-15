# Phase 7: Feat Macros — Plan

## Task Groups

### 1. Sentinel Macro
- [x] Create `feats/sentinel-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.renderChatMessage` hook
- [x] Detect enemy melee attacks targeting non-Sentinel characters
- [x] Scan all owned actors for Sentinel feat
- [x] Inject reaction prompt banner with dedup guard
- [x] Add manifest entry

### 2. Polearm Master Macro
- [x] Create `feats/polearm-master-macro.js`
- [x] Teardown/register lifecycle with `updateCombat` hook
- [x] Whispered reminder on turn start with per-turn dedup
- [x] Add manifest entry

### 3. Shield Master Macro
- [x] Create `feats/shield-master-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.renderChatMessage` hook
- [x] Detect owned actor attack rolls with equipped shield
- [x] Inject shove reminder banner with per-turn dedup
- [x] Add manifest entry

### 4. War Caster Macro
- [x] Create `feats/war-caster-macro.js`
- [x] Teardown/register lifecycle with `updateCombat` hook
- [x] Whispered reminder on turn start with per-turn dedup
- [x] Add manifest entry

### 5. Savage Attacker Macro
- [x] Create `feats/savage-attacker-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.renderChatMessage` hook
- [x] Detect melee weapon damage rolls from owned actors
- [x] Inject reroll banner with per-turn dedup
- [x] Add manifest entry

### 6. Resilient Macro
- [x] Create `feats/resilient-macro.js`
- [x] Teardown/register lifecycle with `dnd5e.renderChatMessage` hook
- [x] Detect saving throw rolls from owned actors
- [x] Inject informational proficiency banner
- [x] Add manifest entry

### 7. Alert Macro
- [x] Create `feats/alert-macro.js`
- [x] Teardown/register lifecycle with `updateCombat` hook
- [x] Detect combat start (round 1, turn 0), per-combat dedup
- [x] Whisper to all owned Alert characters
- [x] Add manifest entry

### 8. Tough Macro
- [x] Create `feats/tough-macro.js`
- [x] Teardown/register lifecycle with `updateCombat` hook
- [x] Calculate bonus HP (2 × level), per-combat dedup
- [x] Add manifest entry

### 9. Manifest & Spec
- [x] Add all 8 entries to `manifest.json` before `token-dashboard`
- [x] Create spec folder at `Planning/phases/phase-7-feats/`

## Status
- [x] All 8 macros complete
- [x] Manifest updated
- [x] Spec documents created
