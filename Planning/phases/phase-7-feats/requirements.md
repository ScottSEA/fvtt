# Phase 7: Feat Macros — Requirements

## Scope
General feat macros that apply to any character with the specified feat. These are class-agnostic and support any character build.

## Macros

### Sentinel
- **Trigger:** `dnd5e.renderChatMessage` — detect melee attack rolls from NON-owned actors targeting someone other than the Sentinel character
- **Behavior:** Inject banner: "⚔️ Sentinel — Use Reaction to make an opportunity attack against this attacker"
- **Gating:** `isOwner` guard on Sentinel character. Attacker must not be owned. Check all owned actors for "Sentinel" feat. Only on melee attacks.
- **Path:** `feats/sentinel-macro.js`
- **Category:** `feat`
- **Requires:** `{ "feat": "Sentinel" }`

### Polearm Master
- **Trigger:** `updateCombat` (turn start) — remind about bonus action attack
- **Behavior:** Whispered reminder: "🔱 Polearm Master — Bonus Action attack with opposite end (1d4 bludgeoning) available"
- **Gating:** `isOwner`, actor has "Polearm Master" feat, per-turn dedup
- **Path:** `feats/polearm-master-macro.js`
- **Category:** `feat`
- **Requires:** `{ "feat": "Polearm Master" }`

### Shield Master
- **Trigger:** `dnd5e.renderChatMessage` — detect attack rolls from owned actors
- **Behavior:** Inject banner: "🛡️ Shield Master — Bonus Action to shove target (push 5ft or knock prone)"
- **Gating:** `isOwner`, actor has "Shield Master" feat, actor must have equipped shield, per-turn dedup
- **Path:** `feats/shield-master-macro.js`
- **Category:** `feat`
- **Requires:** `{ "feat": "Shield Master" }`

### War Caster
- **Trigger:** `updateCombat` (turn start) — reminder about spell opportunity attacks
- **Behavior:** Whispered reminder: "🪄 War Caster — You can cast a spell instead of making an opportunity attack this round"
- **Gating:** `isOwner`, actor has "War Caster" feat, per-turn dedup
- **Path:** `feats/war-caster-macro.js`
- **Category:** `feat`
- **Requires:** `{ "feat": "War Caster" }`

### Savage Attacker
- **Trigger:** `dnd5e.renderChatMessage` — detect melee damage rolls from owned actors
- **Behavior:** Inject banner: "💪 Savage Attacker — You may reroll this weapon's damage dice (once per turn)"
- **Gating:** `isOwner`, actor has "Savage Attacker" feat, per-turn dedup, melee weapon damage only
- **Path:** `feats/savage-attacker-macro.js`
- **Category:** `feat`
- **Requires:** `{ "feat": "Savage Attacker" }`

### Resilient
- **Trigger:** `dnd5e.renderChatMessage` — detect saving throw rolls from owned actors
- **Behavior:** Inject banner: "🔰 Resilient — You have proficiency in this save"
- **Gating:** `isOwner`, actor has "Resilient" feat. Informational only.
- **Path:** `feats/resilient-macro.js`
- **Category:** `feat`
- **Requires:** `{ "feat": "Resilient" }`

### Alert
- **Trigger:** `updateCombat` — detect combat start (round 1, turn 0)
- **Behavior:** Whispered reminder: "🚨 Alert — You add proficiency bonus to Initiative and can't be surprised"
- **Gating:** `isOwner`, actor has "Alert" feat, once per combat (track combat ID)
- **Path:** `feats/alert-macro.js`
- **Category:** `feat`
- **Requires:** `{ "feat": "Alert" }`

### Tough
- **Trigger:** `updateCombat` — first combat turn
- **Behavior:** Whispered note: "❤️ Tough — HP maximum includes +X from Tough feat (2 × character level)"
- **Gating:** `isOwner`, actor has "Tough" feat, once per combat
- **Path:** `feats/tough-macro.js`
- **Category:** `feat`
- **Requires:** `{ "feat": "Tough" }`

## Key Decisions
- All macros are character-agnostic (no class prerequisite)
- Sentinel scans all owned actors for the feat (reactive to enemy attacks)
- Shield Master checks for equipped shield via `actor.items`
- Alert fires for all owned combatants at combat start, not just current turn
- Each feat has a unique color theme for visual distinction
