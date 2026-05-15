/**
 * SAVAGE ATTACKER FEAT MACRO
 *
 * Detects melee weapon damage rolls from owned actors with the Savage
 * Attacker feat. Injects a banner reminding the player they may reroll
 * the weapon's damage dice (once per turn).
 *
 * RAW (2024 Savage Attacker): "You've trained to deal particularly
 * damaging strikes. Once per turn when you hit a target with a weapon,
 * you can roll the weapon's damage dice twice and use either roll
 * against the target."
 *
 * Hooks: dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-hand-fist";
const SA_HOOK_FLAG = "savageAttackerHookRegistered";
const SA_FEAT_NAME = "Savage Attacker";
const SA_LAST_TURN_KEY = "_savageAttackerLastTurn";

teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[SA_HOOK_FLAG]) return;
  const prev = game[SA_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  delete game[SA_HOOK_FLAG];
  console.log("Savage Attacker macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[SA_HOOK_FLAG] = { hookId };
  console.log("Savage Attacker macro loaded.");
}

// ─── Chat Message Hook ──────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  try {
    // Must be a damage roll
    const rollType = message.flags?.dnd5e?.roll?.type;
    if (rollType !== "damage") return;

    // Actor must be owned
    const actorId = message.speaker?.actor;
    if (!actorId) return;
    const actor = game.actors.get(actorId);
    if (!actor?.isOwner) return;

    // Check for Savage Attacker feat
    const feat = actor.items.find(
      i => i.name === SA_FEAT_NAME && i.type === "feat"
    );
    if (!feat) return;

    // Check if this is melee weapon damage
    if (!isMeleeWeaponDamage(message, actor)) return;

    // Per-turn dedup (in combat)
    const combat = game.combat;
    if (combat?.started) {
      const turnKey = `${combat.id}-${combat.round}-${combat.turn}`;
      if (game[SA_LAST_TURN_KEY] === turnKey) return;
      game[SA_LAST_TURN_KEY] = turnKey;
    }

    // Dedup on element
    const el = html instanceof HTMLElement ? html : html[0] ?? html;
    if (el.querySelector("[data-action='savage-attacker-prompt']")) return;

    const banner = `
      <div data-action="savage-attacker-prompt" style="
        background: linear-gradient(135deg, #331a1a 0%, #5c2a2a 50%, #331a1a 100%);
        border: 2px solid #cc4444;
        border-radius: 8px;
        padding: 10px 14px;
        color: #f0c0c0;
        font-size: 13px;
        margin: 6px 0 2px;
        text-align: center;
      ">
        <div style="font-size: 16px; margin-bottom: 4px;">💪 Savage Attacker</div>
        <div style="font-size: 12px; color: #e0a0a0;">
          You may reroll this weapon's damage dice (once per turn)
        </div>
      </div>`;

    el.querySelector(".message-content")?.insertAdjacentHTML("beforeend", banner);
  } catch (err) {
    console.error("Savage Attacker macro error:", err.message);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isMeleeWeaponDamage(message, actor) {
  const itemId = message.flags?.dnd5e?.roll?.itemId;
  if (!itemId) return false;
  const item = actor.items.get(itemId);
  if (!item) return false;
  if (item.type !== "weapon") return false;
  const actionType = item.system?.actionType ??
    item.system?.activities?.contents?.[0]?.actionType;
  return actionType !== "rwak"; // not ranged
}
// END: SAVAGE ATTACKER FEAT MACRO
