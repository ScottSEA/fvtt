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

### Phase 3: Rogue Macros (2026-05-15)
Sneak Attack (per-turn attack banner with dice scaling), Uncanny Dodge (reaction reminder on incoming hits), Evasion (DEX save result banner).

### Phase 4: Paladin Macros (2026-05-15)
Divine Smite (spell slot buttons on melee hits), Lay on Hands (turn-start healing reminder), Aura of Protection (CHA save bonus reminder for all owned characters).

### Phase 5: Ranger Macros (2026-05-15)
Hunter's Mark (concentration-gated damage reminder), Favored Foe (per-turn marking reminder with uses tracking).

### Phase 6: Caster Macros (2026-05-15)
Concentration Check (CON save DC reminder on damage, utility), Counterspell (reaction prompt on enemy spellcasting).

---

## 🔜 Phase 7: Feat Macros

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
