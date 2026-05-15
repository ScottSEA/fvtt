# Phase 3: Rogue Macros — Validation

## Success Criteria

### Sneak Attack
- [ ] Registers `dnd5e.renderChatMessage` hook on load
- [ ] Injects banner only on attack rolls with finesse or ranged weapons
- [ ] Displays correct Sneak Attack dice count (ceil(rogueLevel/2)d6)
- [ ] Does not fire on non-finesse melee weapons
- [ ] Per-turn dedup: only one banner per combat turn
- [ ] `isOwner` guard prevents firing for other players' rogues
- [ ] Teardown removes hook cleanly on re-execution

### Uncanny Dodge
- [ ] Registers `dnd5e.renderChatMessage` hook on load
- [ ] Injects banner only on incoming attacks that HIT the Rogue
- [ ] Does not inject on the actor's own attacks
- [ ] Correctly resolves targets from `message.flags.dnd5e.targets`
- [ ] Compares roll total vs target AC for hit detection
- [ ] Does not inject if attack misses (roll < AC)
- [ ] `isOwner` guard present
- [ ] Teardown removes hook cleanly

### Evasion
- [ ] Registers `dnd5e.renderChatMessage` hook on load
- [ ] Only triggers on DEX saves (ability === "dex")
- [ ] Does not trigger on other save types (STR, CON, WIS, etc.)
- [ ] Shows color-coded success (green) / failure (orange) when DC available
- [ ] Shows generic reminder when DC not available
- [ ] `isOwner` guard present
- [ ] Teardown removes hook cleanly

### Manifest Integration
- [ ] All three macros appear in `manifest.json` with correct `requires`
- [ ] Entries placed after fighter macros, before token-dashboard
- [ ] `category: "class"` for all three
- [ ] `autoExecute: true` for all three
- [ ] Loader installs them for a character with Rogue class + matching feats
- [ ] Loader skips them for non-Rogue characters

## Manual Testing

### Sneak Attack
- [ ] Load macros for a Rogue character → Sneak Attack registers
- [ ] Attack with a finesse weapon → banner appears with correct dice
- [ ] Attack again same turn → no duplicate banner
- [ ] New turn → banner appears again on first eligible attack
- [ ] Attack with non-finesse melee weapon → no banner
- [ ] Attack with ranged weapon → banner appears

### Uncanny Dodge
- [ ] Load macros for a Rogue character → Uncanny Dodge registers
- [ ] Enemy attacks and hits the Rogue → banner appears
- [ ] Enemy attacks and misses the Rogue → no banner
- [ ] Rogue attacks another target → no banner (own attacks excluded)
- [ ] Non-owned character is hit → no banner

### Evasion
- [ ] Load macros for a Rogue character → Evasion registers
- [ ] Make a DEX save → banner appears with success/fail indicator
- [ ] Make a WIS save → no banner
- [ ] Make a CON save → no banner
- [ ] Non-owned character makes DEX save → no banner
