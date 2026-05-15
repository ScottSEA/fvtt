# Phase 3: Rogue Macros — Requirements

## Scope
First Rogue class macros. Three core features as hook-based reminder macros using `dnd5e.renderChatMessage`. Validates chat-injection patterns for attack detection, incoming-hit detection, and saving throw detection.

## Macros

### Sneak Attack
- **Trigger:** `dnd5e.renderChatMessage` — detect attack rolls from owned Rogue characters
- **Behavior:** If the attack is with a finesse or ranged weapon, inject a banner reminder: "🗡️ Sneak Attack — Extra Xd6 damage if you have advantage or an ally within 5ft of target"
- **Gating:** Only once per turn (combat round/turn key dedup). `isOwner` guard. Actor must have "Sneak Attack" feat.
- **Dice:** Xd6 where X = ceil(rogueLevel / 2)
- **manifest requires:** `{ "class": "rogue", "feat": "Sneak Attack" }`

### Uncanny Dodge
- **Trigger:** `dnd5e.renderChatMessage` — detect incoming attack rolls that HIT the Rogue (check targets in message flags)
- **Behavior:** Inject a reminder banner: "🛡️ Uncanny Dodge — Use Reaction to halve damage from this attack"
- **Gating:** `isOwner` guard. Actor must have "Uncanny Dodge" feat. Don't inject on the actor's own attacks.
- **Hit detection:** Compare `message.rolls[0].total` vs target AC from `message.flags.dnd5e.targets`
- **manifest requires:** `{ "class": "rogue", "feat": "Uncanny Dodge" }`

### Evasion
- **Trigger:** `dnd5e.renderChatMessage` — detect saving throw results where the owned actor made a DEX save
- **Behavior:** Inject a banner: "🌀 Evasion — Success: no damage / Failure: half damage instead of full"
- **Gating:** `isOwner` guard. Actor must have "Evasion" feat. Only on DEX saves.
- **Result display:** If DC and roll total are available, show whether the save succeeded or failed with color-coded result
- **manifest requires:** `{ "class": "rogue", "feat": "Evasion" }`

## Key Decisions
- Feature detection by name (`"Sneak Attack"`, `"Uncanny Dodge"`, `"Evasion"`) — consistent with all existing macros
- All three use `dnd5e.renderChatMessage` hook — banner injection into `.message-content`
- Sneak Attack uses per-turn dedup via combat snapshot key (`combatId-round-turn`), NOT per-message
- Uncanny Dodge uses target resolution via `fromUuidSync` on `message.flags.dnd5e.targets`
- Evasion checks `message.flags.dnd5e.roll.ability === "dex"` for DEX save filtering
- Purple/dark theme for all Rogue banners to distinguish from Fighter (blue) and Barbarian (orange/brown)

## Out of Scope
- Rogue subclass features (Assassin, Arcane Trickster, etc.) — future phases
- Automatic Sneak Attack damage application (reminder only)
- Automatic Uncanny Dodge damage halving (reminder only)
- Automatic Evasion damage modification (reminder only)
