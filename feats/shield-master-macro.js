/**
 * SHIELD MASTER FEAT MACRO
 *
 * Detects attack rolls from owned actors who have the Shield Master feat
 * and an equipped shield. Injects a banner reminding the player they can
 * use a Bonus Action to shove the target (push 5 ft or knock prone).
 *
 * RAW (2024 Shield Master): "If you take the Attack action on your turn,
 * you can replace one of your attacks with a shove, pushing the target 5
 * feet away from you or knocking it prone, using your shield."
 *
 * Hooks: dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-shield-halved";
const SM_HOOK_FLAG = "shieldMasterHookRegistered";
const SM_FEAT_NAME = "Shield Master";
const SM_LAST_TURN_KEY = "_shieldMasterLastTurn";

teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[SM_HOOK_FLAG]) return;
  const prev = game[SM_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  delete game[SM_HOOK_FLAG];
  console.log("Shield Master macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[SM_HOOK_FLAG] = { hookId };
  console.log("Shield Master macro loaded.");
}

// ─── Chat Message Hook ──────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  try {
    // Must be an attack roll
    const rollType = message.flags?.dnd5e?.roll?.type;
    if (rollType !== "attack") return;

    // Attacker must be owned
    const actorId = message.speaker?.actor;
    if (!actorId) return;
    const actor = game.actors.get(actorId);
    if (!actor?.isOwner) return;

    // Check for Shield Master feat
    const feat = actor.items.find(
      i => i.name === SM_FEAT_NAME && i.type === "feat"
    );
    if (!feat) return;

    // Must have an equipped shield
    const hasShield = actor.items.some(
      i => i.type === "equipment" &&
        i.system?.type?.value === "shield" &&
        i.system?.equipped
    );
    if (!hasShield) return;

    // Per-turn dedup (in combat)
    const combat = game.combat;
    if (combat?.started) {
      const turnKey = `${combat.id}-${combat.round}-${combat.turn}`;
      if (game[SM_LAST_TURN_KEY] === turnKey) return;
      game[SM_LAST_TURN_KEY] = turnKey;
    }

    // Dedup on element
    const el = html instanceof HTMLElement ? html : html[0] ?? html;
    if (el.querySelector("[data-action='shield-master-prompt']")) return;

    const banner = `
      <div data-action="shield-master-prompt" style="
        background: linear-gradient(135deg, #1a2333 0%, #2a3d5c 50%, #1a2333 100%);
        border: 2px solid #5c8ab5;
        border-radius: 8px;
        padding: 10px 14px;
        color: #c0d8f0;
        font-size: 13px;
        margin: 6px 0 2px;
        text-align: center;
      ">
        <div style="font-size: 16px; margin-bottom: 4px;">🛡️ Shield Master</div>
        <div style="font-size: 12px; color: #90b8d8;">
          Bonus Action to shove target (push 5 ft or knock prone)
        </div>
      </div>`;

    el.querySelector(".message-content")?.insertAdjacentHTML("beforeend", banner);
  } catch (err) {
    console.error("Shield Master macro error:", err.message);
  }
}
// END: SHIELD MASTER FEAT MACRO
