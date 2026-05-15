/**
 * ALERT FEAT MACRO
 *
 * At combat start (round 1, turn 0), whispers a reminder to Alert feat
 * characters that they add proficiency bonus to Initiative and cannot
 * be surprised.
 *
 * RAW (2024 Alert): "You gain the following benefits: Initiative
 * Proficiency — when you roll Initiative, you can add your Proficiency
 * Bonus to the roll. Initiative Swap — immediately after you roll
 * Initiative, you can swap your result with a willing ally."
 *
 * Hooks: updateCombat
 */

const MACRO_ICON = "fa-bell";
const ALERT_HOOK_FLAG = "alertFeatHookRegistered";
const ALERT_FEAT_NAME = "Alert";
const ALERT_LAST_COMBAT_KEY = "_alertLastCombat";

teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[ALERT_HOOK_FLAG]) return;
  const prev = game[ALERT_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("updateCombat", prev.hookId);
  delete game[ALERT_HOOK_FLAG];
  console.log("Alert macro torn down.");
}

function register() {
  const hookId = Hooks.on("updateCombat", onUpdateCombat);
  game[ALERT_HOOK_FLAG] = { hookId };
  console.log("Alert macro loaded.");
}

// ─── Combat Hook ─────────────────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  try {
    if (!("turn" in changed || "round" in changed)) return;
    if (!combat?.started) return;

    // Only fire at combat start: round 1, turn 0
    if (combat.round !== 1 || combat.turn !== 0) return;

    // Per-combat dedup
    if (game[ALERT_LAST_COMBAT_KEY] === combat.id) return;
    game[ALERT_LAST_COMBAT_KEY] = combat.id;

    // Check all combatants for owned characters with Alert
    for (const combatant of combat.combatants) {
      if (!combatant?.isOwner || combatant.isDefeated) continue;
      const actor = combatant.actor;
      if (!actor) continue;

      const feat = actor.items.find(
        i => i.name === ALERT_FEAT_NAME && i.type === "feat"
      );
      if (!feat) continue;

      const content =
        `<div style="` +
        `background: linear-gradient(135deg, #332200 0%, #5c3d00 50%, #332200 100%);` +
        `border: 2px solid #e6a800;` +
        `border-radius: 8px;` +
        `padding: 10px 14px;` +
        `color: #ffe680;` +
        `font-size: 13px;` +
        `text-align: center;` +
        `">` +
        `<div style="font-size: 16px; margin-bottom: 4px;">🚨 Alert</div>` +
        `<div style="font-size: 12px; color: #e6c860;">` +
        `<strong>${actor.name}</strong> adds proficiency bonus to Initiative and can't be surprised</div>` +
        `</div>`;

      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content,
        whisper: [game.user.id],
      });
    }
  } catch (err) {
    console.error("Alert macro error:", err.message);
  }
}
// END: ALERT FEAT MACRO
