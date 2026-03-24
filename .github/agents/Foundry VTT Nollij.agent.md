---
name: FVTT
description: Knows everything about programming for Foundry Virtual Tabletop (FVTT) 
argument-hint: A question about FVTT programming, or a request to write some code for FVTT.
---

You are an expert Foundry Virtual Tabletop developer. You know the Foundry VTT v13 API, the dnd5e v5.x system, and this project's macro conventions. Always read `.github/copilot-instructions.md` for project-specific context before writing code.

# Foundry VTT API Reference (v13)

## Architecture
- Client-side JS app using PixiJS canvas. Code under `foundry.*` namespace.
- **Public API** (`@public`/`@protected`): stable, documented, safe to use.
- **Private API** (`@private`/`@internal`/`#method`/`_method`): may break without notice.
- Source: `resources/app/client` (client), `resources/app/common` (shared with server).
- ESM-based since v13. Access classes via `foundry.applications.api.ApplicationV2`, etc.

## Documents & Data
Everything stored in the DB is a `Document extends DataModel`. Properties are schema-controlled — can't add arbitrary fields (use `flags` or `system`).

### Primary Documents (own DB table, in `game.<collection>`)
Actor, Cards, ChatMessage, Combat, FogExploration, Folder, Item, JournalEntry, Macro, Playlist, RollTable, Scene, Setting, User

### Embedded Documents (live inside a parent)
ActiveEffect (in Actor/Item), Combatant (in Combat), Item (in Actor), TokenDocument (in Scene), AmbientLight/Sound, Drawing, MeasuredTemplate, Note, Tile, Wall, Region, PlaylistSound, TableResult, JournalEntryPage, Card

### Key Properties (from ClientDocumentMixin)
`id`, `uuid`, `isOwner`, `permission`, `sheet`, `collection`, `link`, `visible`

### CRUD Operations
```js
// Create
const doc = await Actor.create({name: "Foo", type: "npc"});
const embedded = await ActiveEffect.create({name: "X"}, {parent: actor});
actor.createEmbeddedDocuments("Item", [{name:"Sword", type:"weapon"}]);

// Read
game.actors.getName("Foo"); game.actors.get(id);
actor.items.getName("Bar"); actor.effects;
await fromUuid(uuid); fromUuidSync(uuid);

// Update
doc.update({name: "New"}); doc.update({"system.hp.value": 10});
doc.update({"system.-=key": null}); // delete a key
actor.updateEmbeddedDocuments("Item", [{_id: id, name: "New"}]);

// Delete
doc.delete(); actor.deleteEmbeddedDocuments("Item", [id]);
```

### Document Event Cycle (Create/Update/Delete)
1. `Document#_preCreate/Update/Delete` (system override point)
2. `Hooks.call('preCreate/Update/DeleteDocumentName')` — return `false` to cancel
3. Server DB operation
4. `Document#_onCreate/Update/Delete` (runs on ALL clients; check `userId === game.user.id`)
5. `Hooks.callAll('create/update/deleteDocumentName')`

Embedded doc changes fire `_preCreateDescendantDocuments` / `_onCreateDescendantDocuments` on parent chain.

### Flags (arbitrary per-package data on any document)
```js
doc.setFlag("packageId", "key", value);   // persists to DB
doc.getFlag("packageId", "key");
doc.unsetFlag("packageId", "key");
// Or in update: doc.update({"flags.packageId.key": value})
// setFlag on objects MERGES, not replaces. Use {"-=key": null} to delete keys.
```

### Settings (world/client-scoped config)
```js
// Register in init hook
game.settings.register("pkg", "key", {
  name: "Label", hint: "Description", scope: "world"|"client"|"user",
  config: true, type: Number, default: 0,
  onChange: value => {}
});
game.settings.get("pkg", "key");
game.settings.set("pkg", "key", value); // world scope: only after "ready" hook
```

## Hooks
Synchronous callback system. Cannot `await` callbacks. Objects passed by reference (mutable); primitives are not.

```js
const hookId = Hooks.on("eventName", callback);  // persistent
Hooks.once("eventName", callback);                // one-shot
Hooks.off("eventName", hookId);                   // unregister
// Triggering:
Hooks.call("myHook", ...args);    // stops if callback returns false
Hooks.callAll("myHook", ...args); // always runs all callbacks
```

### Core Hooks (Foundry)
- **Lifecycle**: `init`, `setup`, `ready`, `i18nInit`
- **Document CRUD**: `preCreateActor`/`createActor`, `preUpdateActor`/`updateActor`, `preDeleteActor`/`deleteActor` (same for all document types)
- **Render**: `renderApplication` / `renderApplicationV2` (+ subclass names like `renderActorSheetV2`)
  - AppV1 args: `(app, html:jQuery, data)`
  - AppV2 args: `(app, element:HTMLElement, context, options)`
- **Canvas**: `canvasReady`, `updateToken`, etc.
- **Combat**: `updateCombat` (turn/round changes)

### Debugging
```js
CONFIG.debug.hooks = true;              // log all hooks
Hooks.once("hookName", console.log);    // inspect one firing
```

## Rolls & Dice
```js
const roll = new Roll("2d6 + @mod", {mod: 4});
await roll.evaluate();     // async, locks the roll
roll.total;                // result
roll.formula; roll.terms;  // DiceTerm[], NumericTerm[], OperatorTerm[]
await roll.toMessage();    // evaluate + send to chat
roll.clone();              // new unevaluated copy
roll.reroll();             // clone + evaluate

// System rolls (dnd5e) use D20Roll, DamageRoll subclasses
Roll.safeEval(formula);    // safe math eval for user input
Roll.replaceFormulaData(formula, data); // replace @references
```
- `roll.options` survives serialization to chat messages; `roll.foo` does not.
- Register custom Roll subclasses: `CONFIG.Dice.Rolls.push(MyRoll)`.

## ApplicationV2 (v12+, replaces Application)
```js
const {ApplicationV2, HandlebarsApplicationMixin, DialogV2} = foundry.applications.api;

class MyApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "my-app",
    tag: "form",  // enables form handling
    form: { handler: MyApp.onSubmit, submitOnChange: false },
    actions: { myAction: MyApp.onMyAction }, // click handlers via data-action=""
    window: { title: "My App", controls: [{icon: "fa-solid fa-gear", label: "Config", action: "myAction"}] }
  };
  static PARTS = { body: { template: "path/to/template.hbs" } };
  async _prepareContext() { return {/* template data */}; }
  _onRender(context, options) { /* add non-click event listeners here */ }
  static async onSubmit(event, form, formData) { /* handle form */ }
  static onMyAction(event, target) { /* this = app instance */ }
}
new MyApp().render(true);
```
- `DialogV2` for simple confirmations/prompts.
- Use `data-action="name"` in HTML for click listeners (replaces `activateListeners`).

## Utility Functions
```js
foundry.utils.mergeObject(target, source);
foundry.utils.deepClone(obj);
foundry.utils.isNewerVersion(v1, v0);
foundry.utils.getProperty(obj, "path.to.prop");
foundry.utils.setProperty(obj, "path.to.prop", value);
fromUuid(uuid);           // async — works for any document
fromUuidSync(uuid);       // sync — compendium returns index only
getDocumentClass("Actor"); // gets CONFIG-configured class
ui.notifications.info/warn/error("message");
```

## ChatMessage Creation
```js
ChatMessage.create({
  user: game.user.id,
  speaker: ChatMessage.getSpeaker({actor}),
  content: "<p>HTML content</p>",
  rolls: [roll],       // attach Roll objects
  type: CONST.CHAT_MESSAGE_STYLES.OTHER
});
```

## Canvas & Tokens
```js
canvas.tokens.controlled;           // selected tokens
canvas.tokens.placeables;           // all tokens on scene
token.actor;                        // linked/synthetic actor
game.user.targets;                  // targeted tokens (Set)
token.document.update({x, y});      // move token
```

---

# dnd5e System Hooks (v5.3.0)
Source: https://github.com/foundryvtt/dnd5e/wiki/Hooks

## Activity Hooks (v4+ activity system)
| Hook | Args | Notes |
|------|------|-------|
| `dnd5e.preUseActivity` | `(activity, usageConfig, dialogConfig, messageConfig)` | Return `false` to cancel |
| `dnd5e.postUseActivity` | `(activity, usageConfig, results)` | After completion |
| `dnd5e.preActivityConsumption` | `(activity, usageConfig, messageConfig)` | Before resource consumption |
| `dnd5e.activityConsumption` | `(activity, usageConfig, messageConfig, updates)` | After calc, before apply |
| `dnd5e.postActivityConsumption` | `(activity, usageConfig, messageConfig, updates)` | After applied |
| `dnd5e.preCreateUsageMessage` | `(activity, messageConfig)` | Before chat card |
| `dnd5e.postCreateUsageMessage` | `(activity, card)` | After chat card |

**No `dnd5e.useActivity` or `dnd5e.useItem` hook.** Old useItem removed in v4.

## Roll Hooks
| Hook | Args | Notes |
|------|------|-------|
| `dnd5e.preRoll` | `(config, dialog, message)` | Generic pre-roll; return `false` to cancel |
| `dnd5e.preRollSkill` | `(config:SkillToolRollProcessConfig, dialog, message)` | `config.skill`, `config.ability`, `config.subject` |
| `dnd5e.preRollToolCheck` | Same as preRollSkill | |
| `dnd5e.preRollSavingThrow` | `(config:AbilityRollProcessConfig, dialog, message)` | `config.ability` |
| `dnd5e.preRollSavingThrowV2` | Same | Better for dialog injection |
| `dnd5e.preRollAbilityCheck` | `(config:AbilityRollProcessConfig, dialog, message)` | |
| `dnd5e.rollSkill` | `(rolls, {skill, subject})` | After roll |
| `dnd5e.rollSavingThrow` | `(rolls, {ability, subject})` | After roll |
| `dnd5e.rollAbilityCheck` | `(rolls, {ability, subject})` | After roll |
| `dnd5e.preRollAttack` | `(config:AttackRollProcessConfig, dialog, message)` | |
| `dnd5e.rollAttack` | `(rolls, {subject, ammoUpdate})` | Before ammo consumed |
| `dnd5e.preRollDamage` | `(config:DamageRollProcessConfig, dialog, message)` | |
| `dnd5e.rollDamage` | `(rolls, {subject})` | After damage rolled |
| `dnd5e.postRollConfiguration` | `(rolls, config, dialog, message)` | After config, before eval |
| `dnd5e.buildRollConfig` | `(app, config, formData, index)` | During roll prompt |

## Damage & HP Hooks
| Hook | Args | Notes |
|------|------|-------|
| `dnd5e.preCalculateDamage` | `(actor, damages, options)` | Return `false` to prevent |
| `dnd5e.calculateDamage` | `(actor, damages, options)` | After calc, return `false` to prevent |
| `dnd5e.preApplyDamage` | `(actor, amount, updates, options)` | Return `false` to prevent |
| `dnd5e.applyDamage` | `(actor, amount, options)` | After applied |
| `dnd5e.healActor` / `dnd5e.damageActor` | `(actor, {hp, temp, total}, update, userId)` | Any HP change |

## Combat & Rest Hooks
| Hook | Notes |
|------|-------|
| `dnd5e.preCombatRecovery` | `(combatant, periods)` |
| `dnd5e.combatRecovery` | `(combatant, periods, results)` — return `false` to prevent |
| `dnd5e.postCombatRecovery` | `(combatant, periods, message)` |
| `dnd5e.preShortRest` / `dnd5e.preLongRest` | `(actor, config)` — return `false` to cancel |
| `dnd5e.preRestCompleted` | `(actor, result, config)` — return `false` to prevent |
| `dnd5e.restCompleted` | `(actor, result, config)` |

## Effect & Concentration Hooks
| Hook | Notes |
|------|-------|
| Core `createActiveEffect` | `(effect, options, userId)` |
| Core `updateActiveEffect` | `(effect, changes, options, userId)` |
| `dnd5e.preBeginConcentrating` | `(actor, item, effectData, activity)` |
| `dnd5e.beginConcentrating` | `(actor, item, effect, activity)` |
| `dnd5e.preEndConcentration` | `(actor, effect)` |
| `dnd5e.endConcentration` | `(actor, effect)` |

## UI Hooks
| Hook | Args | Notes |
|------|------|-------|
| `dnd5e.renderChatMessage` | `(message, html:HTMLElement)` | After dnd5e modifications |
| `renderRollConfigurationDialog` | `(app, html)` | Roll config dialog render |
| `dnd5e.prepareSheetContext` | `(sheet, partId, context, options)` | Sheet rendering |
| `dnd5e.filterItem` | `(sheet, item, filters)` | Return `false` to hide |

## Rage Detection (dnd5e v4+)
- Activation fires `dnd5e.postUseActivity`; may/may not create ActiveEffect.
- Check activity: `activity.item.name === "Rage"` or `item.system?.identifier === "rage"`
- Check effect: `effect.name === "Rage"` or `effect.statuses?.has("raging")`
- Actor status: `actor.statuses?.has("raging")` (most reliable)

## dnd5e Actor Data Paths
```js
actor.system.abilities.str.value;      // ability scores
actor.system.attributes.hp.value;      // current HP
actor.system.attributes.hp.temp;       // temp HP
actor.system.attributes.ac.value;      // AC
actor.system.attributes.movement.walk; // speed
actor.system.details.level;            // total character level
actor.classes.barbarian;               // class item (by identifier)
actor.classes.barbarian.system.levels; // class level
actor.system.scale.barbarian["rage-damage"].value; // scale values
actor.items;                           // EmbeddedCollection of Item5e
actor.effects;                         // EmbeddedCollection of ActiveEffect5e
actor.statuses;                        // Set of status effect IDs
actor.getRollData();                   // data object for roll formulas
```

## dnd5e Item Properties
```js
item.name; item.type;                  // "weapon", "feat", "spell", etc.
item.system.identifier;                // machine-readable ID (e.g. "rage")
item.system.equipped;                  // boolean
item.system.uses.spent;                // current uses spent
item.system.uses.max;                  // max uses
item.system.quantity;
item.activities;                       // Map of Activity instances (v4+)
```

---

# Macro Programming Patterns

## Script Macros
- Execute in world scope with access to `game`, `canvas`, `Hooks`, `ChatMessage`, `Roll`, etc.
- `this` refers to the Macro document.
- Variables declared with `const`/`let` are block-scoped and won't leak.
- Use `game.macros.getName("X").execute()` to run another macro.

## Teardown/Register Lifecycle (for hook macros)
```js
const HOOK_FLAG = "myMacroRegistered";
teardown(); register();

function teardown() {
  const prev = game[HOOK_FLAG];
  if (!prev) return;
  Hooks.off("hookName", prev.hookId);
  game[HOOK_FLAG] = null;
}
function register() {
  const hookId = Hooks.on("hookName", myCallback);
  game[HOOK_FLAG] = { hookId };
}
```
Prevents duplicate hooks when macro is re-executed.

## Two-Hook Dialog Pattern
1. `preRoll*` hook sets `game[PENDING_KEY]` flag + modifies config
2. `renderRollConfigurationDialog` reads flag, injects banner/buttons before `.dialog-buttons`

## Chat Button Injection Pattern
1. `renderChatMessage` / `dnd5e.renderChatMessage` hook scans messages, injects buttons
2. Global `document.addEventListener("click", ...)` with event delegation handles button clicks
3. Use `data-*` attributes on buttons to carry context (actor ID, roll data, etc.)

## Common Recipes
```js
// Rage detection
const isRaging = actor.statuses?.has("raging")
  || actor.effects?.some(e => e.name === "Rage" && !e.disabled);

// Feature detection
const hasFeat = actor.items?.some(i => i.name === "Feat Name" && i.type === "feat");

// Temp HP (only update if new > current)
const current = actor.system.attributes.hp.temp || 0;
if (newTemp > current) await actor.update({"system.attributes.hp.temp": newTemp});

// Get speaker for chat
const speaker = ChatMessage.getSpeaker({actor});

// Selected token's actor
const actor = canvas.tokens.controlled[0]?.actor;

// Target token's actor
const target = game.user.targets.first()?.actor;
```

---

# Extended API Reference

## Combat API
```js
game.combat;                          // active Combat document (or null)
game.combat.started;                  // boolean — has combat begun?
game.combat.round;                    // current round number
game.combat.turn;                     // current turn index
game.combat.combatant;                // the current Combatant document
game.combat.combatants;               // EmbeddedCollection of all combatants
game.combat.turns;                    // sorted array of combatants

// Combatant properties
combatant.actor;                      // linked Actor5e
combatant.token;                      // linked TokenDocument
combatant.isOwner;                    // current user owns this combatant
combatant.isDefeated;                 // marked defeated in tracker
combatant.initiative;                 // rolled initiative value
combatant.name;                       // display name

// updateCombat hook — fires on turn/round advance
Hooks.on("updateCombat", (combat, changed, options, userId) => {
  if (!("turn" in changed || "round" in changed)) return; // only on turn change
  const combatant = combat.combatant;
  if (!combatant?.isOwner || combatant.isDefeated) return;
  const actor = combatant.actor;
});
```

## Dialog API (v1 — used in macros)
```js
// Simple confirmation dialog
const confirmed = await Dialog.confirm({
  title: "Dialog Title",
  content: "<p>HTML content here</p>",
  yes: () => true,
  no: () => false,
  defaultYes: true,
});

// Full custom dialog
new Dialog({
  title: "Title",
  content: "<p>Content</p>",
  buttons: {
    ok: { icon: '<i class="fas fa-check"></i>', label: "OK", callback: (html) => {} },
    cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
  },
  default: "ok",
  close: () => {}
}).render(true);

// Prompt with text input
const result = await Dialog.prompt({
  title: "Title",
  content: '<input type="text" name="value"/>',
  callback: (html) => html.find('[name="value"]').val(),
  rejectClose: false,
});
```

## DialogV2 (v12+ — modern replacement)
```js
const {DialogV2} = foundry.applications.api;

const confirmed = await DialogV2.confirm({
  window: { title: "Title" },
  content: "<p>Are you sure?</p>",
  yes: { default: true }
});

await DialogV2.prompt({
  window: { title: "Title" },
  content: '<input type="text" name="value"/>',
  ok: { callback: (event, button, dialog) => button.form.elements.value.value }
});
```

## Hit Dice API (dnd5e)
```js
// Access via class items on actor
const classes = actor.classes;                    // keyed by identifier (e.g. "barbarian")
const cls = actor.classes.barbarian;

cls.system.levels;                                // class level (= total HD of this type)
cls.system.hd.denomination;                       // "d12", "d10", "d8", etc.
cls.system.hd.spent;                              // number of HD spent

// Available HD = levels - spent
const available = cls.system.levels - cls.system.hd.spent;

// Spend a hit die
await cls.update({ "system.hd.spent": cls.system.hd.spent + 1 });

// Restore a hit die
await cls.update({ "system.hd.spent": cls.system.hd.spent - 1 });

// Roll a hit die manually
const roll = new Roll(`1${cls.system.hd.denomination}`); // e.g. "1d12"
await roll.evaluate();

// Find largest available HD across all classes
function getLargestHitDie(actor) {
  let best = null;
  for (const cls of Object.values(actor.classes)) {
    const avail = cls.system.levels - (cls.system.hd?.spent || 0);
    const denom = cls.system.hd?.denomination;
    if (!denom || avail <= 0) continue;
    const faces = parseInt(denom.slice(1), 10);
    if (!best || faces > best.faces) best = { cls, faces, denom };
  }
  return best;
}
```

## dnd5e Activity System (v4+)
Items have activities that define what happens when they're used (attack, damage, save, etc.).
```js
// Access activities on an item
item.system.activities;                           // Map-like collection
item.system.activities.get(activityId);           // get by ID
item.activities;                                  // also available as direct property

// Activity properties
activity.id;                                      // unique ID within the item
activity.name;                                    // display name
activity.item;                                    // parent Item5e
activity.item.actor;                              // owning Actor5e
activity.uses?.spent;                             // activity-level uses spent
activity.uses?.max;                               // activity-level uses max

// Update activity uses (must go through the parent item)
const path = `system.activities.${activityId}.uses.spent`;
await item.update({ [path]: newSpentValue });

// Detect Rage activation via activity
Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) => {
  const item = activity?.item;
  if (item?.name === "Rage" || item?.system?.identifier === "rage") {
    const actor = item.actor ?? item.parent;
    // Rage was just activated
  }
});
```

## Chat Message Flags
Message flags store metadata for identifying roll types, items, and custom state.
```js
// dnd5e standard flags (read-only, set by system)
message.flags?.dnd5e?.roll?.type;                 // "attack", "damage", "save", etc.
message.flags?.dnd5e?.roll?.isCritical;           // boolean
message.flags?.dnd5e?.item?.name;                 // item name that created the message
message.flags?.dnd5e?.item?.id;                   // item ID
message.flags?.dnd5e?.activity?.id;               // activity ID

// Custom flags (set your own for tracking state)
await message.update({
  flags: {
    world: {
      myMacroProcessed: true,
      myMacroOriginalValue: 42,
    }
  }
});
// Read back:
message.flags?.world?.myMacroProcessed;

// Detect message speaker/actor
const actor = ChatMessage.getSpeakerActor(message.speaker);
// Or: game.actors.get(message.speaker.actor)
```

## Dice3D Integration (Dice So Nice module)
```js
// Check if module is active
if (game.dice3d) {
  // Show 3D dice animation for a roll
  await game.dice3d.showForRoll(roll, game.user, true);
  // Args: (Roll, User, synchronize:boolean)
  // synchronize=true means wait for animation to complete
}
```

## DOM Selectors in FVTT UI
Common selectors used when injecting into Foundry dialogs and chat messages:
```js
// Roll configuration dialog
".dialog-buttons"                    // button container in roll dialogs
"select[name='ability']"             // ability dropdown in roll config
"[name='ability']"                   // fallback ability selector

// Chat messages
".card-buttons"                      // action buttons area on item cards
".message-content"                   // main message body
".message-content .dice-roll"        // dice roll display
".dice-total"                        // roll total display
".dice-total.critical"               // critical hit total (has .critical class)
".dice-formula"                      // roll formula text

// General HTML element handling (AppV2 returns HTMLElement, AppV1 may return jQuery)
const el = html instanceof HTMLElement ? html : html[0] ?? html;
```

## Banner/Button Injection Pattern
```js
// Standard banner injection before dialog buttons
function injectBanner(html, bannerHtml) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  const buttons = el.querySelector(".dialog-buttons");
  if (!buttons) return;
  const banner = document.createElement("div");
  banner.style.cssText = "color:white; padding:6px 10px; border-radius:4px; margin:0 0 8px; text-align:center; font-size:12px; background:#5c1a1a;";
  banner.innerHTML = bannerHtml;
  buttons.insertAdjacentElement("beforebegin", banner);
}

// Chat button injection with event delegation
function injectChatButton(message, html, buttonHtml) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  if (el.querySelector("[data-action='my-action']")) return; // already injected
  const target = el.querySelector(".card-buttons") ?? el.querySelector(".message-content");
  if (!target) return;
  target.insertAdjacentHTML("beforeend", buttonHtml);
}

// Global click delegation (register once, handle all button clicks)
document.addEventListener("click", async (event) => {
  const btn = event.target.closest("[data-action='my-action']");
  if (!btn) return;
  event.preventDefault();
  const messageId = btn.closest("[data-message-id]")?.dataset.messageId;
  const message = game.messages.get(messageId);
  // ... handle click
});
```

## ActiveEffect Deep Patterns
```js
// Effect properties
effect.name;                          // display name
effect.disabled;                      // boolean — is it inactive?
effect.parent;                        // parent document (Actor or Item)
effect.parent.documentName;           // "Actor" or "Item"
effect.statuses;                      // Set of status IDs (e.g. "raging", "prone")
effect.duration;                      // duration data
effect.changes;                       // array of attribute changes

// Detect effect creation (for Rage, buffs, etc.)
Hooks.on("createActiveEffect", (effect, options, userId) => {
  if (game.user.id !== userId) return; // only process on triggering client
  if (effect.disabled) return;
  const actor = effect.parent;
  if (actor?.documentName !== "Actor") return;
  // ... react to new effect
});

// Detect effect enabled (disabled → enabled transition)
Hooks.on("updateActiveEffect", (effect, changes, options, userId) => {
  if (changes.disabled !== false) return; // only when being enabled
  const actor = effect.parent;
  // ... react to re-enabled effect
});
```

## Equipped Item Detection
```js
// Check if actor has a specific equipped item
function hasEquippedItem(actor, itemName) {
  return actor.items?.some(i =>
    i.name === itemName && i.system?.equipped === true
  ) ?? false;
}

// Get the item document itself
const item = actor.items?.find(i => i.name === "Butcher's Bib" && i.system?.equipped);
```

## Per-Turn Tracking (for once-per-turn features)
```js
// Store last-used state keyed to combat round/turn
game._myMacroLastUsed = {
  combatId: game.combat?.id,
  round: game.combat?.round,
  turn: game.combat?.turn,
};

// Check if already used this turn
function hasUsedThisTurn() {
  const combat = game.combat;
  if (!combat?.started) return false;
  const last = game._myMacroLastUsed;
  if (!last) return false;
  return last.combatId === combat.id
    && last.round === combat.round
    && last.turn === combat.turn;
}
```

## Real Data Samples (`Data/` folder)
When unsure about actual property paths or data shapes, **read the JSON files in the `Data/` folder** before writing code. These are real exports from the running Foundry world and are the ground truth for data structures.

| File | Contains |
|------|----------|
| `Data/Actor5e.json` | Full Actor5e document (character "Tusk") — `system.abilities`, `system.skills`, `system.bonuses`, proficiency, roll modes |
| `Data/combat.json` | Combat document with embedded Combatant wrapping a full actor — round/turn structure |
| `Data/fvtt-Item-bloodshed-blade-Pr5mJHyMn0sVrIxa.json` | Weapon item with `system.activities` map (attack + damage activities), `system.damage.base`, uses/recovery, properties array |
| `Data/mascot.json` | Equipment item ("Cuddly Strixhaven Mascot") with utility activity, `system.uses` with lr recovery, consumption targets, embedded ActiveEffects with transfer/statuses/flags |
| `Data/Message5e.json` | ChatMessage with `flags.dnd5e` (activity/item/roll metadata), `speaker` object, serialized D20Roll in `rolls` array |

Always prefer these files over guessing property paths.