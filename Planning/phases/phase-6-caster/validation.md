# Phase 6: Caster Macros (General) — Validation

## Success Criteria

### Concentration Check
- [ ] Registers `dnd5e.damageActor` hook on load
- [ ] Detects concentration via `actor.statuses.has("concentrating")`
- [ ] Falls back to effects check if statuses not available
- [ ] Calculates DC correctly: max(10, floor(damage / 2))
- [ ] Posts whispered chat message (only visible to owner)
- [ ] Does not fire for non-owned actors
- [ ] Does not fire if actor is not concentrating
- [ ] Does not fire if no HP damage was taken (0 or negative)
- [ ] Teardown removes hook cleanly on re-execution

### Counterspell
- [ ] Registers `dnd5e.renderChatMessage` hook on load
- [ ] Detects spell usage via `message.flags.dnd5e.use.type === "spell"`
- [ ] Only triggers for non-owned casters (enemy spells)
- [ ] Checks ALL owned characters for Counterspell availability
- [ ] Verifies 3rd+ level spell slots remaining (including pact slots)
- [ ] Injects banner with list of available reactors
- [ ] Dedup prevents duplicate banners on same message
- [ ] Does not inject if no owned character has Counterspell + slots
- [ ] Teardown removes hook cleanly on re-execution

### Manifest Integration
- [ ] Concentration Check entry in `manifest.json` with `requires: {}`
- [ ] Counterspell entry in `manifest.json` with `requires: { "spell": "Counterspell" }`
- [ ] Both entries placed before `token-dashboard`
- [ ] `category` values correct: `"utility"` and `"feat"`
- [ ] `autoExecute: true` for both
- [ ] Loader installs Concentration Check for any character
- [ ] Loader installs Counterspell only for characters with Counterspell spell

## Manual Testing
- [ ] Load macros → both register hooks with console confirmation
- [ ] Concentrating character takes damage → whispered DC reminder appears
- [ ] Non-concentrating character takes damage → no reminder
- [ ] Enemy casts a spell → Counterspell banner appears (if owned character has it)
- [ ] Owned character casts a spell → no Counterspell banner
- [ ] No owned character has Counterspell → no banner on enemy spells
- [ ] Re-execute macros → teardown + re-register works cleanly
