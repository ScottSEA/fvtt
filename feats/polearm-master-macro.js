/**
 * POLEARM MASTER FEAT MACRO
 *
 * Reminds the player at the start of their combat turn that they can
 * make a Bonus Action attack with the opposite end of a polearm weapon
 * (1d4 bludgeoning damage).
 *
 * RAW (2024 Polearm Master): "When you take the Attack action and attack
 * with a Quarterstaff, Spear, or weapon with the Heavy and Reach properties,
 * you can make one extra attack as a Bonus Action with the opposite end
 * of the weapon. The weapon deals 1d4 Bludgeoning damage on a hit."
 *
 * Hooks: updateCombat
 */

const MACRO_ICON = "fa-khanda";
const PAM_HOOK_FLAG = "polearmMasterHookRegistered";
const PAM_FEAT_NAME = "Polearm Master";
const PAM_LAST_TURN_KEY = "_polearmMasterLastTurn";

teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[PAM_HOOK_FLAG]) return;
  const prev = game[PAM_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("updateCombat", prev.hookId);
  delete game[PAM_HOOK_FLAG];
  console.log("Polearm Master macro torn down.");
}

function register() {
  const hookId = Hooks.on("updateCombat", onUpdateCombat);
  game[PAM_HOOK_FLAG] = { hookId };
  console.log("Polearm Master macro loaded.");
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
    if (game[PAM_LAST_TURN_KEY] === turnKey) return;
    game[PAM_LAST_TURN_KEY] = turnKey;

    // Check for feat
    const feat = actor.items.find(
      i => i.name === PAM_FEAT_NAME && i.type === "feat"
    );
    if (!feat) return;

    const content =
      `<div style="` +
      `background: linear-gradient(135deg, #2a1a00 0%, #4a3000 50%, #2a1a00 100%);` +
      `border: 2px solid #c87c00;` +
      `border-radius: 8px;` +
      `padding: 10px 14px;` +
      `color: #ffe0a0;` +
      `font-size: 13px;` +
      `text-align: center;` +
      `">` +
      `<div style="font-size: 16px; margin-bottom: 4px;">🔱 Polearm Master</div>` +
      `<div style="font-size: 12px; color: #e0c080;">` +
      `Bonus Action attack with opposite end (1d4 bludgeoning) available</div>` +
      `</div>`;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      whisper: [game.user.id],
    });
  } catch (err) {
    console.error("Polearm Master macro error:", err.message);
  }
}
// END: POLEARM MASTER FEAT MACRO
