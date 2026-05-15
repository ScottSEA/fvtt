# Phase 2: Fighter Macros — Validation

## Success Criteria

### Action Surge
- [ ] Registers `updateCombat` hook on load
- [ ] Posts reminder only on Fighter's turn start
- [ ] Shows correct uses remaining count
- [ ] Does not fire if no uses remain
- [ ] Does not fire multiple times per turn
- [ ] `isOwner` guard prevents firing for other players' fighters
- [ ] Teardown removes hook cleanly on re-execution

### Second Wind
- [ ] Registers `updateCombat` hook on load
- [ ] Posts reminder only when HP < 50% AND uses remain
- [ ] Does not fire if HP >= 50%
- [ ] Does not fire if no uses remain
- [ ] Per-turn dedup works correctly
- [ ] `isOwner` guard present
- [ ] Teardown removes hook cleanly

### Indomitable
- [ ] Registers `renderChatMessage` hook on load
- [ ] Detects failed saving throws (roll < DC)
- [ ] Injects reroll button only for owned actors
- [ ] Button rolls a new save and posts result
- [ ] Does not inject if no Indomitable uses remain
- [ ] Dedup prevents multiple buttons on same message
- [ ] Teardown removes hook cleanly

### Manifest Integration
- [ ] All three macros appear in `manifest.json` with correct `requires`
- [ ] `category: "class"` for all three
- [ ] `autoExecute: true` for all three
- [ ] Loader installs them for a character with Fighter class + matching feats
- [ ] Loader skips them for non-Fighter characters

## Manual Testing
- [ ] Load macros for a Fighter character → all three register
- [ ] Enter combat → Action Surge and Second Wind reminders on turn start
- [ ] Take damage below 50% → Second Wind reminder appears
- [ ] Heal above 50% → Second Wind reminder stops
- [ ] Fail a saving throw → Indomitable button appears
- [ ] Click Indomitable → reroll posted
- [ ] Load macros for a non-Fighter → none of these register
