/**
 * MAGIC SHIELD REMINDER MACRO
 *
 * Once-per-combat whispered reminder that a +1/+2/+3 magic shield is equipped
 * and its AC bonus is already applied.
 *
 * Hooks: updateCombat
 */

const MACRO_ICON = "fa-shield";
const MSHIELD_HOOK_FLAG = "magicShieldHookRegistered";
const MSHIELD_COMBAT_KEY = "_magicShieldCombatId";

teardown();
register();

function teardown() {
  if (!game[MSHIELD_HOOK_FLAG]) return;
  const prev = game[MSHIELD_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("updateCombat", prev.hookId);
  delete game[MSHIELD_COMBAT_KEY];
  delete game[MSHIELD_HOOK_FLAG];
  console.log("Magic Shield macro torn down.");
}

function register() {
  const hookId = Hooks.on("updateCombat", onUpdateCombat);
  game[MSHIELD_HOOK_FLAG] = { hookId };
  console.log("Magic Shield macro loaded.");
}

// ─── Hook Handler ─────────────────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  if (!("turn" in changed || "round" in changed)) return;
  const combatant = combat.combatant;
  if (!combatant?.isOwner) return;

  const actor = combatant.actor;
  if (!actor?.isOwner) return;

  const shield = actor.items.find(i => {
    if (!["equipment", "shield"].includes(i.type)) return false;
    if (!i.system?.equipped) return false;
    const name = i.name?.toLowerCase() ?? "";
    // Must be a shield with a +1/+2/+3 enhancement
    const isShield = name.includes("shield") ||
                     i.system?.type?.value === "shield" ||
                     i.system?.armor?.type === "shield";
    const hasBonus = /\+[123]/.test(i.name);
    return isShield && hasBonus;
  });
  if (!shield) return;

  // Once per combat
  if (game[MSHIELD_COMBAT_KEY] === combat.id) return;
  game[MSHIELD_COMBAT_KEY] = combat.id;

  const bonusMatch = shield.name.match(/\+([123])/);
  const bonus = bonusMatch ? bonusMatch[1] : "?";

  ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div style="padding:8px 12px; border-radius:8px; margin:4px 0; text-align:center; font-size:13px;
                  background:linear-gradient(135deg, #3a3a4a, #5a5a6a); color:white; border:1px solid #8a8a9a;">
        <strong>🛡️ ${shield.name}</strong> equipped<br>
        AC bonus of +${bonus} is already applied
      </div>`,
    whisper: [game.user.id],
    type: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}
// END: MAGIC SHIELD REMINDER MACRO
