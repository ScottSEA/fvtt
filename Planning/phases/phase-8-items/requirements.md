# Phase 8: Item Macros — Requirements

## Scope
Item-triggered macros for common magic items. These provide turn-start reminders and attack-roll banners for items that players commonly forget to account for.

## Macros

### Cloak of Displacement
- **Trigger:** `updateCombat` (turn start) + `dnd5e.renderChatMessage` (incoming attacks)
- **Behavior on turn start:** Whispered reminder that attacks have disadvantage
- **Behavior on incoming attack:** Banner on enemy attack rolls targeting this character
- **Gating:** `isOwner`, actor has item matching "Cloak of Displacement". Per-turn dedup for turn start.
- **Path:** `items/cloak-of-displacement-macro.js`
- **Category:** `item`
- **Requires:** `{ "item": "Cloak of Displacement" }`

### Ring of Spell Storing
- **Trigger:** `updateCombat` (turn start)
- **Behavior:** Whispered reminder if ring has stored spell levels remaining (uses > 0)
- **Gating:** `isOwner`, actor has item matching "Ring of Spell Storing". Per-turn dedup.
- **Path:** `items/ring-of-spell-storing-macro.js`
- **Category:** `item`
- **Requires:** `{ "item": "Ring of Spell Storing" }`

### Winged Boots
- **Trigger:** `updateCombat` (turn start)
- **Behavior:** Whispered reminder of flying speed. Once per combat only.
- **Gating:** `isOwner`, actor has item matching "Winged Boots", item is equipped.
- **Path:** `items/winged-boots-macro.js`
- **Category:** `item`
- **Requires:** `{ "item": "Winged Boots" }`

### Magic Shield
- **Trigger:** `updateCombat` (turn start)
- **Behavior:** Once-per-combat reminder that a +1/+2/+3 shield is equipped and AC bonus is applied.
- **Gating:** `isOwner`, actor has equipped shield with "+1", "+2", or "+3" in the name.
- **Path:** `items/magic-shield-macro.js`
- **Category:** `item`
- **Requires:** `{ "item": "Shield" }`

### Flame Tongue
- **Trigger:** `dnd5e.renderChatMessage` — attack rolls with Flame Tongue weapon
- **Behavior:** Banner reminder to add +2d6 fire damage while blade is ignited
- **Gating:** `isOwner`, attack must be from owned actor using Flame Tongue weapon. Dedup per message.
- **Path:** `items/flame-tongue-macro.js`
- **Category:** `item`
- **Requires:** `{ "item": "Flame Tongue" }`

## Key Decisions
- All macros are character-agnostic — they check for item possession at runtime
- Turn-start macros use whispered messages; attack banners are inline injections
- Winged Boots and Magic Shield use once-per-combat dedup; others use per-turn
- Item detection uses partial name matching with `.includes()` for flexibility
- Colors are item-thematic: blue (cloak), gold (ring), green (boots), gray (shield), orange/red (flame)
