# Phase 2: Fighter Macros — Requirements

## Scope
First non-Barbarian class. Three core Fighter features as hook-based macros. Validates that the loader architecture generalizes beyond Barbarian.

## Macros

### Action Surge
- **Trigger:** Start of the Fighter's combat turn (`updateCombat` hook)
- **Behavior:** If Action Surge has uses remaining, post a chat reminder: "⚡ Action Surge available (X/Y uses remaining)"
- **Resource:** `actor.items` where `name === "Action Surge"`, tracked via `system.uses.spent` / `system.uses.max`
- **Gating:** Only on the actor's turn; only if uses remain; only once per turn
- **Recharge:** Short or Long Rest (handled by dnd5e system)

### Second Wind
- **Trigger:** Start of the Fighter's combat turn (`updateCombat` hook)
- **Behavior:** If Second Wind has uses remaining AND the actor is below 50% HP, post a chat reminder: "💨 Second Wind available — Bonus Action to heal 1d10 + Fighter level"
- **Resource:** `actor.items` where `name === "Second Wind"`, tracked via `system.uses`
- **Gating:** Only on the actor's turn; only if uses remain; only if HP < 50%; once per turn
- **Recharge:** Short or Long Rest

### Indomitable
- **Trigger:** Failed saving throw (`dnd5e.preRollSavingThrowV2` or `renderRollConfigurationDialog`)
- **Behavior:** After a failed save, inject a "🛡️ Invoke Indomitable — Reroll this save" button into the chat message or roll dialog
- **Resource:** `actor.items` where `name === "Indomitable"`, tracked via `system.uses`
- **Gating:** Only if uses remain; `isOwner` guard; once per save
- **Recharge:** Long Rest
- **Design decision:** Use `renderChatMessage` to detect failed saves (check roll total vs DC) and inject a reroll button, similar to Lucky's defensive pattern. The button should roll a new save and post the result.

## Key Decisions
- Feature detection by name (`"Action Surge"`, `"Second Wind"`, `"Indomitable"`) — consistent with all existing macros
- Use `system.uses.spent` / `system.uses.max` for resource tracking — let dnd5e handle recharge on rest
- Action Surge and Second Wind share the same trigger (turn start) — can be combined into a single hook registration or kept separate for modularity. **Decision: keep separate** for independent install/uninstall.
- Indomitable reroll: post a new chat message with the reroll result rather than modifying the original roll

## Out of Scope
- Fighter subclass features (Champion, Battle Master, Eldritch Knight) — future phases
- Automatic resource consumption (player clicks the item to use it)
- Multi-class level detection for Second Wind healing formula
