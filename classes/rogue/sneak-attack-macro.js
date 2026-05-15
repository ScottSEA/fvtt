/**
 * SNEAK ATTACK REMINDER MACRO
 *
 * Injects a banner reminder into attack roll chat messages when a Rogue
 * attacks with a finesse or ranged weapon, reminding about Sneak Attack
 * extra damage.
 *
 * RAW (2024 Rogue): "Once per turn, you can deal an extra 1d6 damage to
 * one creature you hit with an attack roll if the attack is made with a
 * Finesse or Ranged weapon and if at least one of the following is true:
 * You have Advantage on the attack roll, or an ally is within 5 feet of
 * the target, the ally doesn't have the Incapacitated condition, and you
 * don't have Disadvantage on the attack roll."
 *
 * Hooks: dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-crosshairs";

const SA_HOOK_FLAG = "sneakAttackHookRegistered";
const SA_FEAT_NAME = "Sneak Attack";
const SA_LAST_TURN_KEY = "_sneakAttackLastTurn";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[SA_HOOK_FLAG]) return;
  const prev = game[SA_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  delete game[SA_HOOK_FLAG];
  console.log("Sneak Attack macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[SA_HOOK_FLAG] = { hookId };
  console.log("Sneak Attack macro loaded.");
}

// ─── Chat Message Hook ──────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  // Only process attack rolls
  const rollType = message.flags?.dnd5e?.roll?.type;
  if (rollType !== "attack") return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;

  // Skip if already injected
  if (el.querySelector("[data-action='sneak-attack-reminder']")) return;

  // Resolve the actor who made the attack
  const actorId = message.speaker?.actor;
  if (!actorId) return;
  const actor = game.actors.get(actorId);
  if (!actor?.isOwner) return;

  // Must have Sneak Attack feat
  const feat = actor.items.find(
    i => i.name === SA_FEAT_NAME && i.type === "feat"
  );
  if (!feat) return;

  // Check weapon is finesse or ranged
  const item = getMessageItem(message, actor);
  if (!item) return;
  if (!isFinesseOrRanged(item)) return;

  // Per-turn dedup via combat snapshot key
  if (!checkAndMarkTurn()) return;

  // Determine Sneak Attack dice (Rogue level determines Xd6)
  const rogueClass = actor.items.find(
    i => i.type === "class" && (i.system?.identifier === "rogue" || i.name?.toLowerCase() === "rogue")
  );
  const rogueLevel = rogueClass?.system?.levels ?? rogueClass?.system?.level ?? 1;
  const sneakDice = Math.ceil(rogueLevel / 2);

  // Inject banner
  const container = el.querySelector(".message-content");
  if (!container) return;

  const bannerHtml =
    `<div data-action="sneak-attack-reminder"` +
    ` style="border:2px solid #9b59b6; border-radius:8px; padding:8px;` +
    ` background:linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 100%);` +
    ` text-align:center; margin-top:8px;">` +
    `<h2 style="margin:0 0 4px; font-size:15px; font-weight:bold; color:#bb77ff;">` +
    `🗡️ Sneak Attack</h2>` +
    `<p style="margin:4px 0; color:#d4aaff;">` +
    `Extra <strong>${sneakDice}d6</strong> damage if you have advantage` +
    ` or an ally within 5ft of target</p>` +
    `</div>`;

  container.insertAdjacentHTML("beforeend", bannerHtml);
}

// ─── Weapon Detection ────────────────────────────────────────────────────────

function getMessageItem(message, actor) {
  const itemId = message.flags?.dnd5e?.roll?.itemId
    ?? message.flags?.dnd5e?.activity?.itemId;
  if (itemId) return actor.items.get(itemId);

  const itemUuid = message.flags?.dnd5e?.item?.uuid
    ?? message.flags?.dnd5e?.roll?.itemUuid;
  if (itemUuid) {
    try { return fromUuidSync(itemUuid); } catch { return null; }
  }
  return null;
}

function isFinesseOrRanged(item) {
  if (!item) return false;

  // Check properties for finesse
  const props = item.system?.properties;
  let hasFinesse = false;
  if (props instanceof Set) hasFinesse = props.has("fin");
  else if (Array.isArray(props)) hasFinesse = props.includes("fin");
  if (hasFinesse) return true;

  // Check weapon type for ranged (simpleR, martialR)
  const weaponType = item.system?.type?.value;
  if (weaponType && weaponType.endsWith("R")) return true;

  return false;
}

// ─── Per-Turn Dedup ──────────────────────────────────────────────────────────

function checkAndMarkTurn() {
  const combat = game.combat;
  if (!combat?.started) {
    // Outside combat — allow once then block until combat resets
    if (game[SA_LAST_TURN_KEY] === "no-combat") return false;
    game[SA_LAST_TURN_KEY] = "no-combat";
    return true;
  }

  const turnKey = `${combat.id}-${combat.round}-${combat.turn}`;
  if (game[SA_LAST_TURN_KEY] === turnKey) return false;
  game[SA_LAST_TURN_KEY] = turnKey;
  return true;
}
// END: SNEAK ATTACK REMINDER MACRO
