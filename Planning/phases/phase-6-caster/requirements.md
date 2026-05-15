# Phase 6: Caster Macros (General) — Requirements

## Scope
Class-agnostic spellcasting macros that apply to any character who concentrates or has specific spells. Validates cross-class utility hooks beyond class-specific features.

## Macros

### Concentration Check
- **Trigger:** `dnd5e.damageActor` — fires when an actor takes damage
- **Behavior:** If the damaged actor is concentrating, post a whispered chat reminder: "🔮 Concentration Check Required — CON save DC X"
- **DC Calculation:** DC = max(10, floor(damageTaken / 2))
- **Gating:** `isOwner` guard. Actor must have an active concentration effect (`actor.statuses?.has("concentrating")` or effects check). No class/feat prerequisite.
- **Path:** `utilities/concentration-check-macro.js`
- **Category:** `utility`
- **Requires:** `{}` (empty — fires for any concentrating character)

### Counterspell
- **Trigger:** `dnd5e.renderChatMessage` — detect spell usage by non-owned actors (enemy spellcasting)
- **Behavior:** If any owned character has the Counterspell spell prepared and a 3rd+ level slot available, inject a reaction prompt banner
- **Gating:** `isOwner` guard on reacting character. Caster must NOT be owned (enemy). Reactor must have Counterspell spell and 3rd+ level slot remaining.
- **Detection:** `message.flags?.dnd5e?.use?.type === "spell"` for spell usage
- **Path:** `feats/counterspell-macro.js`
- **Category:** `feat`
- **Requires:** `{ "spell": "Counterspell" }`

## Key Decisions
- Concentration Check is a utility (no class/feat prerequisite) — placed in `utilities/`
- Counterspell is spell-based and cross-class — placed in `feats/`
- Both use arcane purple/blue banner themes
- Counterspell checks ALL owned characters, not just the message speaker
- Pact magic slots are included in available slot checks

## Out of Scope
- Automatic Concentration save rolling (player uses the reminder to roll manually)
- Counterspell contested ability check automation
- Class-specific spellcasting features (future phases)
