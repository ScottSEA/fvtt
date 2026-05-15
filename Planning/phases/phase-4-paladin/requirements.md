# Phase 4: Paladin Macros — Requirements

## Scope
First divine caster class. Three core Paladin features as hook-based macros: one interactive (Divine Smite with spell slot consumption), one reminder (Lay on Hands healing pool), and one cross-character aura reminder (Aura of Protection).

## Macros

### Divine Smite
- **Trigger:** Melee attack hit detected via `dnd5e.renderChatMessage`
- **Behavior:** Inject a "⚔️ Divine Smite?" banner with buttons for each available spell slot level (1–5). Clicking rolls extra radiant damage (2d8 base + 1d8 per slot level above 1st) and consumes the slot. Shows +1d8 note for undead/fiend targets.
- **Resource:** Consumes a spell slot of the chosen level via `actor.update()`
- **Gating:** `isOwner` guard; must have "Divine Smite" feat; must have spell slots remaining; only on melee weapon attacks (not thrown)
- **Design note:** Damage caps at 6d8 total. Undead/fiend bonus is informational (player adds manually since creature type detection is out of scope).

### Lay on Hands
- **Trigger:** Start of the Paladin's combat turn (`updateCombat` hook)
- **Behavior:** Whispered reminder: "✋ Lay on Hands — X HP in healing pool remaining (Action to heal)"
- **Resource:** Track via `system.uses` on the Lay on Hands item (max = 5 × Paladin level)
- **Gating:** `isOwner` guard; must have "Lay on Hands" feat; only remind if pool > 0 and Paladin or allies are damaged; per-turn dedup
- **Recharge:** Long Rest (handled by dnd5e system)

### Aura of Protection
- **Trigger:** Saving throw detected via `dnd5e.renderChatMessage`
- **Behavior:** Inject a reminder banner: "🛡️ Aura of Protection — Don't forget +X (CHA mod) bonus to this save if the Paladin is within 10 ft"
- **Gating:** `isOwner` guard; show on saves from ANY owned character (not just the Paladin); requires a Paladin actor with "Aura of Protection" feat among owned actors; CHA mod comes from the Paladin's stats (minimum +1)
- **Design note:** Cannot validate proximity (out of scope), so this is a reminder only.

## Key Decisions
- Feature detection by name (`"Divine Smite"`, `"Lay on Hands"`, `"Aura of Protection"`) — consistent with all existing macros
- Divine Smite uses spell slot system (`system.spells.spell1.value`, etc.) — not feat uses
- Lay on Hands uses `system.uses.spent` / `system.uses.max` on the feat item
- Aura of Protection is cross-character: scans all owned actors for a Paladin with the feat, then shows the CHA modifier on ANY owned character's saving throw
- Gold/warm theme colors (#ffd700, #d4a017, #3a2a0a) for Paladin identity

## Out of Scope
- Paladin subclass features (Oath features) — future phases
- Automatic undead/fiend detection for Divine Smite bonus damage
- Proximity validation for Aura of Protection (would require token distance measurement)
- Lay on Hands disease/poison curing (5 HP per condition)
