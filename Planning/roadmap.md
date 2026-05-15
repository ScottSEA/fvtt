# Roadmap — FVTT Macro Library

Project phases in priority order. Each phase follows the SDD cycle:
**spec → implement → validate → replan**.

Phase specs live in `Planning/phases/<phase-name>/` with `plan.md`, `requirements.md`, and `validation.md`.

---

## ✅ Completed

### Loader Architecture (2025-05-14)
Bootstrap stub + loader split, manifest-driven install, SHA caching, FA icons, Ctrl+Shift dev mode, public repo support.

### Macro Generalization (2025-05-15)
Removed all Tusk-specific assumptions. Added `isOwner` guards, prerequisite checks, and race flexibility across all macros.

### Phase 1: Private Repo Hardening (2026-05-15)
Plugin management dialog (add/remove/continue/skip), PAT audit (no token leakage), specific HTTP error diagnostics, non-fatal plugin errors, comprehensive dev-mode documentation.

### Phase 2: Fighter Macros (2026-05-15)
Action Surge (turn-start reminder), Second Wind (HP-gated healing reminder), Indomitable (failed save reroll button with Fighter level bonus). First non-Barbarian class validates architecture generalization.

---

## 🔜 Phase 3: Rogue Macros

- [ ] **Sneak Attack** — Reminder/button on eligible attacks (advantage or adjacent ally)
- [ ] **Uncanny Dodge** — Reaction reminder when hit by visible attacker
- [ ] **Evasion** — Banner on DEX saves noting half/no damage

## 📋 Phase 4: Paladin Macros

- [ ] **Divine Smite** — Smite button on melee hits with spell slot selection
- [ ] **Lay on Hands** — Quick-use dialog for healing pool
- [ ] **Aura of Protection** — CHA save bonus reminder for nearby allies

## 📋 Phase 5: Ranger Macros

- [ ] **Hunter's Mark** — Track marked target, bonus damage reminder
- [ ] **Favored Foe** — Concentration-free tracking alternative

## 📋 Phase 6: Caster Macros (General)

- [ ] **Concentration Check** — Auto-prompt CON save on damage while concentrating
- [ ] **Counterspell** — Reaction prompt when enemy casts within 60 ft

## 📋 Phase 7: Feat Macros

- [ ] **Sentinel** — Reaction attack when adjacent creature attacks someone else
- [ ] **Polearm Master** — Bonus action attack + OA on entering reach
- [ ] **Shield Master** — Bonus action shove after Attack action
- [ ] **War Caster** — Cast spell as opportunity attack reminder
- [ ] **Savage Attacker** — Reroll melee damage once per turn
- [ ] **Resilient** — Proficiency bonus on saves for chosen ability
- [ ] **Alert** — Initiative bonus + can't-be-surprised note
- [ ] **Tough** — HP increase tracking (informational)

## 📋 Phase 8: Item Macros

- [ ] **Cloak of Displacement** — Disadvantage on attacks reminder, resets each turn
- [ ] **Ring of Spell Storing** — Track stored spells, cast buttons
- [ ] **Winged Boots** — Flight duration tracker
- [ ] **Shield +1/+2/+3** — AC reminder (informational)
- [ ] **Flame Tongue** — Bonus fire damage reminder when activated

## 📋 Phase 9: Utility Macros

- [ ] **Combat Tracker Enhancement** — Turn order with initiative and conditions
- [ ] **Rest Manager** — Long/short rest with auto Hit Dice, spell slots, features
- [ ] **Condition Reference** — Quick lookup panel for condition rules
- [ ] **Loot Roller** — Random treasure table roller from DMG

---

## Design Principles

Carried forward as project-wide non-negotiables (see `tech-stack.md` for full conventions):

- Feature name matching is acceptable (no stable IDs in dnd5e)
- Class checks unnecessary when specific feature is already checked
- Movement/proximity validation is player responsibility
- All `autoExecute` macros MUST follow teardown/register lifecycle
- All hook-based macros MUST include `isOwner` guards
- All macros must be character-agnostic (no hardcoded names/IDs)
- Each phase gets its own spec folder before implementation begins
