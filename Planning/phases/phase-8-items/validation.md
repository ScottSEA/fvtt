# Phase 8: Item Macros — Validation

## Success Criteria

### Cloak of Displacement
- [ ] Registers `updateCombat` and `dnd5e.renderChatMessage` hooks on load
- [ ] Turn-start whispered reminder fires for owned actors with Cloak of Displacement
- [ ] Per-turn dedup prevents duplicate reminders in same turn
- [ ] Incoming attack banner appears on enemy attacks targeting cloak owner
- [ ] Banner dedup prevents duplicate banners on same message
- [ ] Does not fire for non-owned actors
- [ ] Teardown removes both hooks cleanly on re-execution

### Ring of Spell Storing
- [ ] Registers `updateCombat` hook on load
- [ ] Whispered reminder shows remaining stored spell levels
- [ ] Does not fire when remaining uses are 0
- [ ] Per-turn dedup prevents duplicate reminders
- [ ] Does not fire for non-owned actors
- [ ] Teardown removes hook cleanly on re-execution

### Winged Boots
- [ ] Registers `updateCombat` hook on load
- [ ] Whispered reminder fires once per combat only
- [ ] Requires item to be equipped
- [ ] Does not fire for non-owned actors or missing item
- [ ] Teardown removes hook cleanly on re-execution

### Magic Shield
- [ ] Registers `updateCombat` hook on load
- [ ] Detects equipped shield items with +1, +2, or +3 in name
- [ ] Displays correct bonus value extracted from item name
- [ ] Once-per-combat dedup prevents repeated reminders
- [ ] Does not fire for non-owned actors or non-magic shields
- [ ] Teardown removes hook cleanly on re-execution

### Flame Tongue
- [ ] Registers `dnd5e.renderChatMessage` hook on load
- [ ] Banner appears on attack rolls made with Flame Tongue weapon
- [ ] Checks itemId from message flags, falls back to flavor text
- [ ] Banner dedup prevents duplicate banners on same message
- [ ] Does not fire for non-owned actors or non-Flame Tongue attacks
- [ ] Teardown removes hook cleanly on re-execution

### Manifest Integration
- [ ] All 5 entries in `manifest.json` before `token-dashboard`
- [ ] All entries have `category: "item"` and `autoExecute: true`
- [ ] Correct `requires` for each macro
- [ ] Correct file paths in `path` fields
- [ ] Manifest JSON remains valid after edits

## Manual Testing
- [ ] Load all macros → console confirms registration for each
- [ ] Re-execute each macro → teardown + re-register works cleanly
- [ ] Start combat with Cloak of Displacement owner → whispered reminder
- [ ] Enemy attacks Cloak owner → displacement banner on attack message
- [ ] Ring of Spell Storing with uses remaining → turn-start reminder
- [ ] Ring with 0 uses → no reminder
- [ ] Winged Boots equipped → reminder on first turn, no repeats
- [ ] +2 Shield equipped → reminder on first turn with correct bonus
- [ ] Attack with Flame Tongue → fire damage reminder banner
- [ ] Non-Flame Tongue attack → no banner
