/**
 * TOUGH FEAT MACRO
 *
 * On the first combat turn, whispers a note to characters with the
 * Tough feat showing how much bonus HP they receive from the feat
 * (2 × character level).
 *
 * RAW (2024 Tough): "Your Hit Point Maximum increases by an amount
 * equal to twice your character level when you gain this feat.
 * Whenever you gain a level thereafter, your Hit Point Maximum
 * increases by an additional 2 Hit Points."
 *
 * Hooks: updateCombat
 */

const MACRO_ICON = "fa-heart";
const TOUGH_HOOK_FLAG = "toughFeatHookRegistered";
const TOUGH_FEAT_NAME = "Tough";
const TOUGH_LAST_COMBAT_KEY = "_toughLastCombat";

teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[TOUGH_HOOK_FLAG]) return;
  const prev = game[TOUGH_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("updateCombat", prev.hookId);
  delete game[TOUGH_HOOK_FLAG];
  console.log("Tough macro torn down.");
}

function register() {
  const hookId = Hooks.on("updateCombat", onUpdateCombat);
  game[TOUGH_HOOK_FLAG] = { hookId };
  console.log("Tough macro loaded.");
}

// ─── Combat Hook ─────────────────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  try {
    if (!("turn" in changed || "round" in changed)) return;
    if (!combat?.started) return;

    // Per-combat dedup — only fire once per combat
    if (game[TOUGH_LAST_COMBAT_KEY] === combat.id) return;

    const combatant = combat.combatant;
    if (!combatant?.isOwner || combatant.isDefeated) return;

    const actor = combatant.actor;
    if (!actor) return;

    const feat = actor.items.find(
      i => i.name === TOUGH_FEAT_NAME && i.type === "feat"
    );
    if (!feat) return;

    // Mark combat as notified
    game[TOUGH_LAST_COMBAT_KEY] = combat.id;

    // Calculate bonus HP: 2 × character level
    const level = actor.system?.details?.level ?? 0;
    const bonusHP = 2 * level;

    const content =
      `<div style="` +
      `background: linear-gradient(135deg, #330d0d 0%, #5c1a1a 50%, #330d0d 100%);` +
      `border: 2px solid #e05555;` +
      `border-radius: 8px;` +
      `padding: 10px 14px;` +
      `color: #f0c0c0;` +
      `font-size: 13px;` +
      `text-align: center;` +
      `">` +
      `<div style="font-size: 16px; margin-bottom: 4px;">❤️ Tough</div>` +
      `<div style="font-size: 12px; color: #e0a0a0;">` +
      `<strong>${actor.name}</strong>'s HP maximum includes +${bonusHP} from Tough feat (2 × level ${level})</div>` +
      `</div>`;

    ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      whisper: [game.user.id],
    });
  } catch (err) {
    console.error("Tough macro error:", err.message);
  }
}
// END: TOUGH FEAT MACRO
