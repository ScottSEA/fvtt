# Macro Expansion Plan — New Classes, Feats, Items & Utilities

Expand the macro library beyond Barbarian into additional classes, feats, items, and utilities. Also implement the Ctrl+Shift private-repo functionality end-to-end.

---

## Phase 1: Ctrl+Shift Private Repo (Dev Mode)

The loader already has plugin scaffolding (PAT prompt, plugin manifest merging, SHA caching). Verify and harden:

- [ ] Test the `promptPluginSetup()` dialog flow — does it actually persist across reloads?
- [ ] Add a "Manage Plugins" option on subsequent dev-mode runs (add/remove/list plugins)
- [ ] Ensure PAT is never logged or stored in macro documents
- [ ] Validate error handling when private repo is unreachable or PAT is invalid
- [ ] Document the dev-mode workflow in a README or inline help

## Phase 2: New Class Macros

Expand into other popular 5e 2024 classes. Each macro follows the existing pattern: teardown/register lifecycle, `isOwner` guard, prerequisite checks via `requires` in manifest.

### Fighter
- [ ] **Action Surge** — Reminder on turn start when Action Surge is available
- [ ] **Second Wind** — Bonus action healing reminder when below 50% HP
- [ ] **Indomitable** — Reroll failed save button on saving throw failures

### Rogue
- [ ] **Sneak Attack** — Reminder/button on eligible attacks (advantage or adjacent ally)
- [ ] **Uncanny Dodge** — Reaction reminder when hit by an attack you can see
- [ ] **Evasion** — Banner on DEX saves noting half/no damage

### Paladin
- [ ] **Divine Smite** — Smite button on melee hits with spell slot selection
- [ ] **Lay on Hands** — Quick-use dialog for healing pool
- [ ] **Aura of Protection** — CHA save bonus reminder for nearby allies

### Ranger
- [ ] **Hunter's Mark** — Track marked target, bonus damage reminder
- [ ] **Favored Foe** — Alternative to Hunter's Mark, concentration-free tracking

### Wizard / Casters (General)
- [ ] **Concentration Check** — Auto-prompt CON save on damage while concentrating
- [ ] **Counterspell** — Reaction prompt when enemy casts within 60 ft (if detectable)

## Phase 3: New Feat Macros

- [ ] **Sentinel** — Reaction attack reminder when adjacent creature attacks someone else
- [ ] **Polearm Master** — Bonus action attack + opportunity attack on entering reach
- [ ] **Shield Master** — Bonus action shove reminder after Attack action
- [ ] **War Caster** — Cast spell instead of opportunity attack reminder
- [ ] **Savage Attacker** — Reroll melee damage once per turn
- [ ] **Resilient** — Proficiency bonus reminder on saves for chosen ability
- [ ] **Alert** — Initiative bonus reminder and can't-be-surprised note
- [ ] **Tough** — HP increase tracking (informational)

## Phase 4: New Item Macros

- [ ] **Cloak of Displacement** — Disadvantage on attacks reminder, resets each turn
- [ ] **Ring of Spell Storing** — Track stored spells, cast buttons
- [ ] **Winged Boots** — Flight duration tracker
- [ ] **Shield +1/+2/+3** — AC reminder (informational)
- [ ] **Flame Tongue** — Bonus fire damage reminder when activated

## Phase 5: New Utility Macros

- [ ] **Combat Tracker Enhancement** — Turn order display with initiative and conditions
- [ ] **Rest Manager** — Long/short rest button that auto-manages Hit Dice, spell slots, features
- [ ] **Condition Reference** — Quick lookup panel for condition rules
- [ ] **Loot Roller** — Random treasure table roller from DMG

## Phase 6: Manifest & Loader Updates

- [ ] Add all new macros to `manifest.json` with correct `requires` and `category`
- [ ] Create folder structure: `classes/fighter/`, `classes/rogue/`, `classes/paladin/`, `classes/ranger/`, `classes/wizard/`
- [ ] Verify loader handles new categories gracefully
- [ ] Update README with full macro catalog

---

## Priority Order

1. **Phase 1** — Private repo support (unblocks personal/private macros)
2. **Phase 2** — Class macros (highest value, most players benefit)
3. **Phase 3** — Feat macros (cross-class value)
4. **Phase 4** — Item macros (situational but impactful)
5. **Phase 5** — Utility macros (quality of life)
6. **Phase 6** — Manifest/loader updates (done incrementally with each phase)

## Design Principles (carried forward)

- Feature name matching is acceptable (no stable IDs in dnd5e)
- Class checks unnecessary when specific feature is checked
- Movement/proximity validation is player responsibility
- All `autoExecute` macros MUST follow teardown/register lifecycle
- All hook-based macros MUST include `isOwner` guards
- All macros must be character-agnostic (no hardcoded names/IDs)
