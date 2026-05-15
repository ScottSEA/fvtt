/**
 * WAR CASTER FEAT MACRO
 *
 * Reminds the player at the start of their combat turn that they can
 * cast a spell instead of making an opportunity attack this round.
 *
 * RAW (2024 War Caster): "When a creature provokes an Opportunity Attack
 * from you by leaving your reach, you can take a Reaction to cast a spell
 * at the creature rather than making an Opportunity Attack."
 *
 * Hooks: updateCombat
 */

const MACRO_ICON = "fa-hat-wizard";
const WC_HOOK_FLAG = "warCasterHookRegistered";
const WC_FEAT_NAME = "War Caster";
const WC_LAST_TURN_KEY = "_warCasterLastTurn";

teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[WC_HOOK_FLAG]) return;
  const prev = game[WC_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("updateCombat", prev.hookId);
  delete game[WC_HOOK_FLAG];
  console.log("War Caster macro torn down.");
}

function register() {
  const hookId = Hooks.on("updateCombat", onUpdateCombat);
  game[WC_HOOK_FLAG] = { hookId };
  console.log("War Caster macro loaded.");
}

// ─── Combat Hook ─────────────────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  try {
    if (!("turn" in changed || "round" in changed)) return;
    if (!combat?.started) return;

    const combatant = combat.combatant;
    if (!combatant?.isOwner || combatant.isDefeated) return;

    const actor = combatant.actor;
    if (!actor) return;

    // Per-turn dedup
    const turnKey = `${combat.id}-${combat.round}-${combat.turn}`;
    if (game[WC_LAST_TURN_KEY] === turnKey) return;
    game[WC_LAST_TURN_KEY] = turnKey;

    // Check for feat
    const feat = actor.items.find(
      i => i.name === WC_FEAT_NAME && i.type === "feat"
    );
    if (!feat) return;

    const content =
      `<div style="` +
      `background: linear-gradient(135deg, #1f0a33 0%, #3a1a5c 50%, #1f0a33 100%);` +
      `border: 2px solid #9c5ce0;` +
      `border-radius: 8px;` +
      `padding: 10px 14px;` +
      `color: #dcc0f0;` +
      `font-size: 13px;` +
      `text-align: center;` +
      `">` +
      `<div style="font-size: 16px; margin-bottom: 4px;">🪄 War Caster</div>` +
      `<div style="font-size: 12px; color: #c0a0e0;">` +
      `You can cast a spell instead of making an opportunity attack this round</div>` +
      `</div>`;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      whisper: [game.user.id],
    });
  } catch (err) {
    console.error("War Caster macro error:", err.message);
  }
}
// END: WAR CASTER FEAT MACRO
