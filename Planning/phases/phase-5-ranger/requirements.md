# Phase 5: Ranger Macros — Requirements

## Scope
First Ranger class macros. Two core features as hook-based macros using `dnd5e.renderChatMessage` to inject reminder banners into attack roll messages.

## Macros

### Hunter's Mark
- **Trigger:** `dnd5e.renderChatMessage` — detect attack rolls from owned Ranger characters
- **Behavior:** If the Ranger has the Hunter's Mark spell and is currently concentrating, inject a reminder banner: "🎯 Hunter's Mark — Add 1d6 damage if this is your marked target"
- **Gating:** `isOwner` guard. Actor must have "Hunter's Mark" spell (type `spell`). Only show if actor has an active concentration effect (`actor.statuses.has("concentrating")` or `actor.effects` fallback). Only on attack rolls.
- **manifest requires:** `{ "class": "ranger", "spell": "Hunter's Mark" }`

### Favored Foe
- **Trigger:** `dnd5e.renderChatMessage` — detect attack rolls from owned Ranger characters
- **Behavior:** If the Ranger has the "Favored Foe" feat and hasn't used it this turn, inject a reminder: "🏹 Favored Foe — Mark this target for extra 1d6 damage (no concentration)"
- **Gating:** `isOwner` guard. Actor must have "Favored Foe" feat (type `feat`). Per-turn dedup using combat snapshot key. Check uses remaining via `system.uses`.
- **manifest requires:** `{ "class": "ranger", "feat": "Favored Foe" }`

## Key Decisions
- Feature detection by name (`"Hunter's Mark"`, `"Favored Foe"`) — consistent with all existing macros
- Hunter's Mark uses concentration status check rather than resource tracking — the spell is active as long as concentration holds
- Favored Foe uses `system.uses.spent` / `system.uses.max` for resource tracking and per-turn dedup via combat snapshot key
- Both macros are reminder-only — they do not auto-apply damage or consume resources
- Green/forest theme colors for Ranger banners to visually distinguish from other class macros

## Out of Scope
- Ranger subclass features (Hunter, Beast Master, Gloom Stalker) — future phases
- Automatic damage application (player applies damage manually)
- Automatic resource consumption for Favored Foe (player uses the item)
- Tracking which target is marked for Hunter's Mark
