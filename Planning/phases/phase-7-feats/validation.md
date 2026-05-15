# Phase 7: Feat Macros — Validation

## Success Criteria

### Sentinel
- [ ] Registers `dnd5e.renderChatMessage` hook on load
- [ ] Only triggers on melee attack rolls from non-owned actors
- [ ] Checks all owned actors for Sentinel feat
- [ ] Verifies target is not the Sentinel character
- [ ] Injects reaction prompt banner with dedup guard
- [ ] Teardown removes hook cleanly on re-execution

### Polearm Master
- [ ] Registers `updateCombat` hook on load
- [ ] Only triggers on owned combatant's turn start
- [ ] Checks actor for Polearm Master feat
- [ ] Per-turn dedup prevents duplicate messages
- [ ] Posts whispered chat message
- [ ] Teardown removes hook cleanly on re-execution

### Shield Master
- [ ] Registers `dnd5e.renderChatMessage` hook on load
- [ ] Only triggers on attack rolls from owned actors
- [ ] Checks actor for Shield Master feat
- [ ] Verifies actor has an equipped shield
- [ ] Per-turn dedup prevents duplicate banners
- [ ] Injects shove reminder banner
- [ ] Teardown removes hook cleanly on re-execution

### War Caster
- [ ] Registers `updateCombat` hook on load
- [ ] Only triggers on owned combatant's turn start
- [ ] Checks actor for War Caster feat
- [ ] Per-turn dedup prevents duplicate messages
- [ ] Posts whispered chat message
- [ ] Teardown removes hook cleanly on re-execution

### Savage Attacker
- [ ] Registers `dnd5e.renderChatMessage` hook on load
- [ ] Only triggers on damage rolls from owned actors
- [ ] Checks actor for Savage Attacker feat
- [ ] Verifies damage is from a melee weapon (not ranged)
- [ ] Per-turn dedup prevents duplicate banners
- [ ] Injects reroll reminder banner
- [ ] Teardown removes hook cleanly on re-execution

### Resilient
- [ ] Registers `dnd5e.renderChatMessage` hook on load
- [ ] Only triggers on saving throw rolls from owned actors
- [ ] Checks actor for Resilient feat
- [ ] Injects informational banner
- [ ] Dedup prevents duplicate banners on same message
- [ ] Teardown removes hook cleanly on re-execution

### Alert
- [ ] Registers `updateCombat` hook on load
- [ ] Only triggers at combat start (round 1, turn 0)
- [ ] Per-combat dedup prevents duplicate messages
- [ ] Checks all owned combatants for Alert feat
- [ ] Posts whispered reminder for each Alert character
- [ ] Teardown removes hook cleanly on re-execution

### Tough
- [ ] Registers `updateCombat` hook on load
- [ ] Only triggers once per combat (per-combat dedup)
- [ ] Checks combatant for Tough feat
- [ ] Calculates bonus HP correctly (2 × character level)
- [ ] Posts whispered informational message
- [ ] Teardown removes hook cleanly on re-execution

### Manifest Integration
- [ ] All 8 entries in `manifest.json` with category `"feat"` and `autoExecute: true`
- [ ] All entries placed before `token-dashboard`
- [ ] Each entry has correct `requires` with feat name
- [ ] Paths point to correct files in `feats/` folder
