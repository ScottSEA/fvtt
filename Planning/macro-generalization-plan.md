# Macro Generalization Plan — Remove Tusk-Specific Assumptions

All macros should work for any character, not just Tusk. This document tracks the audit findings and required changes.

## Phase 1: Critical — Hardcoded Character Name

| Macro | Issue | Fix |
|-------|-------|-----|
| `lucky-macro.js` | `LUCKY_CHARACTER_NAME = "Tusk"` — defensive path uses `game.actors.getName("Tusk")`, completely broken for non-Tusk characters | Replace with dynamic actor resolution from attack message target tokens/UUIDs |

## Phase 2: Missing Feature/Item Prerequisite Checks

| Macro | Issue | Fix |
|-------|-------|-----|
| `danger-sense-macro.js` | No check for Danger Sense feature — triggers on ALL DEX saves for ALL characters | Add `actor.items.some(i => i.name === "Danger Sense" && i.type === "feat")` check before showing banner |
| `bloodshed-blade-rune-macro.js` | No `system.equipped` check — triggers even if weapon is in inventory but not equipped. Hardcoded activity ID `"PXjk4FsU2X7ClsFN"` | Add equipped check; resolve activity by name/type instead of hardcoded ID |

## Phase 3: Missing `isOwner` Guards

| Macro | Issue | Fix |
|-------|-------|-----|
| `gwm-hew-macro.js` | `analyzeForHew()` in `renderChatMessage` path has no `actor?.isOwner` check — could inject banners on other players' GWM attacks | Add `isOwner` guard early in `analyzeForHew()` |
| `brutal-strike-macro.js` | No `actor?.isOwner` check — could inject buttons on any character's attacks | Add `isOwner` guard before button injection |
| `vitality-surge-macro.js` | No `actor?.isOwner` guard in all three hook paths — could fire on other players' Rage activations | Add `isOwner` check in postUseActivity, createActiveEffect, and updateActiveEffect handlers |

## Phase 4: Race Flexibility

| Macro | Issue | Fix |
|-------|-------|-----|
| `relentless-rage-macro.js` | Assumes Relentless Endurance (Orc racial) is always available — not all Barbarians are Orcs | Make Relentless Endurance conditional: only offer if actor has the feature, otherwise skip straight to Relentless Rage CON save |

## Phase 5: No Changes Needed

These macros already have proper prerequisite checks:

| Macro | Checks Present |
|-------|---------------|
| `butchers-bib-reroll-macro.js` | Butcher's Bib equipped ✓ |
| `strixhaven-mascot-macro.js` | Mascot equipped + uses remaining ✓ |
| `charger-macro.js` | Charger feat exists ✓ |
| `primal-knowledge-macro.js` | Raging + Primal Knowledge feat ✓ |
| `life-giving-force-macro.js` | Raging + Vitality of the Tree feat ✓ |
| `branches-of-tree-macro.js` | Raging + Branches of the Tree feat ✓ |
| `reckless-attack-macro.js` | Reckless Attack feat + isOwner ✓ |

## Verification Checklist

- [ ] `grep -i "tusk"` across all files → zero matches
- [ ] `grep` for hardcoded actor/activity IDs → zero matches
- [ ] Each modified macro retains teardown/register lifecycle
- [ ] Manual test: non-Tusk Barbarian triggers all relevant macros
- [ ] Manual test: non-Barbarian does NOT see Barbarian-specific banners

## Design Decisions

- **Feature name matching** (e.g., `"Danger Sense"`, `"Bloodshed Blade"`) is acceptable — standard pattern in this codebase and dnd5e doesn't provide stable IDs for features
- **Class checks are unnecessary** when the macro already checks for the specific feature — if you have the feature, the macro should work regardless of how you got it
- **Movement/proximity validation** (Charger dash, Branches distance) is out of scope — player responsibility
- **Strixhaven Mascot** restricting to Frightened-only saves is out of scope — dnd5e hooks don't expose what condition the save is against
- **Relentless Endurance ordering** — if the actor doesn't have Relentless Endurance, skip silently to the Relentless Rage CON save
- **Lucky defensive detection** — dnd5e attack messages store targets in message flags; need to verify exact flag path for dynamic resolution
