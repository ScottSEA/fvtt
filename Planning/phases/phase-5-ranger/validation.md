# Phase 5: Ranger Macros — Validation

## Success Criteria

### Hunter's Mark
- [ ] Registers `dnd5e.renderChatMessage` hook on load
- [ ] Injects banner only on attack rolls from owned actors
- [ ] Only shows when actor has "Hunter's Mark" spell item
- [ ] Only shows when actor is concentrating (statuses or effects check)
- [ ] Does not show on non-attack rolls (saves, checks, damage)
- [ ] Dedup guard prevents duplicate banners on same message
- [ ] `isOwner` guard prevents firing for other players' rangers
- [ ] Teardown removes hook cleanly on re-execution
- [ ] Green/forest-themed banner with correct styling

### Favored Foe
- [ ] Registers `dnd5e.renderChatMessage` hook on load
- [ ] Injects banner only on attack rolls from owned actors
- [ ] Only shows when actor has "Favored Foe" feat item
- [ ] Only shows when uses remain (checks `system.uses`)
- [ ] Displays correct uses remaining count
- [ ] Per-turn dedup prevents multiple banners in same combat turn
- [ ] Dedup guard prevents duplicate banners on same message
- [ ] `isOwner` guard present
- [ ] Teardown removes hook cleanly on re-execution
- [ ] Green/forest-themed banner with correct styling

### Manifest Integration
- [ ] Both macros appear in `manifest.json` before `token-dashboard`
- [ ] `category: "class"` for both
- [ ] `autoExecute: true` for both
- [ ] Hunter's Mark has `requires: { class: "ranger", spell: "Hunter's Mark" }`
- [ ] Favored Foe has `requires: { class: "ranger", feat: "Favored Foe" }`
- [ ] Loader installs them for a character with Ranger class + matching features
- [ ] Loader skips them for non-Ranger characters

## Manual Testing
- [ ] Load macros for a Ranger with Hunter's Mark → macro registers
- [ ] Cast Hunter's Mark (concentration active) → banner appears on attack rolls
- [ ] Drop concentration → banner stops appearing
- [ ] Load macros for a Ranger with Favored Foe → macro registers
- [ ] Make attack roll → Favored Foe banner appears with uses count
- [ ] Use all Favored Foe charges → banner stops appearing
- [ ] Multiple attacks same turn → only one Favored Foe banner (dedup)
- [ ] Load macros for a non-Ranger → none of these register
