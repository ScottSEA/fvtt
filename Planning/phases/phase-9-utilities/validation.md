# Phase 9: Utility Macros — Validation

## Combat Tracker Enhancement
- [ ] Load macro via loader → console shows "Combat Tracker Enhancement macro loaded."
- [ ] Advance combat turn → whispered chat message appears with round, current, next 3
- [ ] HP statuses display correctly: healthy (>50%), bloodied (25–50%), critical (<25%)
- [ ] Conditions from `actor.statuses` displayed
- [ ] Only fires for GM or combatant owner
- [ ] No duplicate messages on same turn (dedup works)
- [ ] Reloading macro tears down and re-registers cleanly

## Rest Manager
- [ ] Click macro → dialog appears with Short Rest / Long Rest buttons
- [ ] Short Rest calls `actor.shortRest({ dialog: true })` and posts summary
- [ ] Long Rest calls `actor.longRest({ dialog: true })` and posts summary
- [ ] Shows HP and Hit Dice recovered
- [ ] Warns if no actor selected

## Condition Reference
- [ ] Click macro → dialog appears with all 15 conditions
- [ ] Typing in search box filters conditions in real time
- [ ] Scrollable container for the condition list
- [ ] Each condition shows name and effect description

## Loot Roller
- [ ] Click macro → dialog with CR range and treasure type dropdowns
- [ ] Individual treasure: rolls coins only
- [ ] Hoard treasure: rolls coins plus gems/art objects
- [ ] Results posted to chat with formatted output
- [ ] All 4 CR ranges produce reasonable values

## Manifest
- [ ] All 4 entries present in `manifest.json` after `macro-quick-exec`
- [ ] Combat Tracker: `autoExecute: true`, `category: "utility"`, `requires: {}`
- [ ] Rest Manager, Condition Reference, Loot Roller: `autoExecute: false`
