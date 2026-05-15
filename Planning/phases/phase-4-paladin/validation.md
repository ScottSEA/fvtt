# Phase 4: Paladin Macros — Validation

## Success Criteria

### Divine Smite
- [ ] Registers `dnd5e.renderChatMessage` hook on load
- [ ] Detects melee weapon attack messages from owned Paladin actors
- [ ] Does not trigger on ranged or thrown attacks
- [ ] Shows spell slot buttons only for levels with remaining slots
- [ ] Clicking a button rolls correct radiant damage (2d8 at level 1, +1d8 per level above)
- [ ] Consuming a slot decrements `system.spells.spellN.value` via `actor.update()`
- [ ] Shows undead/fiend bonus note (+1d8)
- [ ] `isOwner` guard prevents firing for other players' Paladins
- [ ] Skip-if-injected prevents duplicate banners on same message
- [ ] Banner disables after use
- [ ] Teardown removes hook and click handler cleanly on re-execution

### Lay on Hands
- [ ] Registers `updateCombat` hook on load
- [ ] Posts whispered reminder only on Paladin's turn start
- [ ] Shows correct healing pool remaining from `system.uses`
- [ ] Does not fire if pool is empty (0 remaining)
- [ ] Does not fire if Paladin and all allies are at full HP
- [ ] Per-turn dedup prevents multiple reminders per turn
- [ ] `isOwner` guard present
- [ ] Teardown removes hook cleanly

### Aura of Protection
- [ ] Registers `dnd5e.renderChatMessage` hook on load
- [ ] Detects saving throw messages from ANY owned character
- [ ] Finds a Paladin actor with "Aura of Protection" feat among owned actors
- [ ] Shows the Paladin's CHA modifier (minimum +1) in the reminder
- [ ] Displays Paladin's name so player knows which character provides the aura
- [ ] Does not inject banner if no owned Paladin has the feat
- [ ] Skip-if-injected prevents duplicate banners
- [ ] `isOwner` guard present
- [ ] Teardown removes hook cleanly

### Manifest Integration
- [ ] All three macros appear in `manifest.json` with correct `requires`
- [ ] `category: "class"` for all three
- [ ] `autoExecute: true` for all three
- [ ] Entries appear before `token-dashboard` and after fighter macros
- [ ] Loader installs them for a character with Paladin class + matching feats
- [ ] Loader skips them for non-Paladin characters
- [ ] Aura of Protection installs for any character if a Paladin with the feat exists

## Manual Testing
- [ ] Load macros for a Paladin character → all three register
- [ ] Make a melee attack → Divine Smite banner appears with slot buttons
- [ ] Click a slot button → radiant damage rolled, slot consumed
- [ ] Make a ranged attack → no Divine Smite banner
- [ ] Enter combat with Paladin damaged → Lay on Hands reminder on turn start
- [ ] Paladin and allies at full HP → no Lay on Hands reminder
- [ ] Any owned character rolls a save → Aura of Protection reminder with CHA mod
- [ ] No Paladin with Aura feat → no banner on saves
- [ ] Load macros for a non-Paladin → Paladin-specific macros not installed
