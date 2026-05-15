/**
 * WINGED BOOTS MACRO
 *
 * Once-per-combat whispered reminder that you have a flying speed equal to
 * your walking speed while wearing equipped Winged Boots.
 *
 * RAW: "While you wear these boots, you have a flying speed equal to your
 * walking speed."
 *
 * Hooks: updateCombat
 */

const MACRO_ICON = "fa-feather";
const BOOTS_HOOK_FLAG = "wingedBootsHookRegistered";
const BOOTS_COMBAT_KEY = "_wingedBootsCombatId";

teardown();
register();

function teardown() {
  if (!game[BOOTS_HOOK_FLAG]) return;
  const prev = game[BOOTS_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("updateCombat", prev.hookId);
  delete game[BOOTS_COMBAT_KEY];
  delete game[BOOTS_HOOK_FLAG];
  console.log("Winged Boots macro torn down.");
}

function register() {
  const hookId = Hooks.on("updateCombat", onUpdateCombat);
  game[BOOTS_HOOK_FLAG] = { hookId };
  console.log("Winged Boots macro loaded.");
}

// ─── Hook Handler ─────────────────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  if (!("turn" in changed || "round" in changed)) return;
  const combatant = combat.combatant;
  if (!combatant?.isOwner) return;

  const actor = combatant.actor;
  if (!actor?.isOwner) return;

  const boots = actor.items.find(
    i => i.name?.toLowerCase().includes("winged boots") &&
         ["equipment", "loot"].includes(i.type)
  );
  if (!boots) return;
  if (!boots.system?.equipped) return;

  // Once per combat
  if (game[BOOTS_COMBAT_KEY] === combat.id) return;
  game[BOOTS_COMBAT_KEY] = combat.id;

  ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div style="padding:8px 12px; border-radius:8px; margin:4px 0; text-align:center; font-size:13px;
                  background:linear-gradient(135deg, #2a4a2a, #3a7a3a); color:white; border:1px solid #5aaa5a;">
        <strong>🦅 Winged Boots</strong><br>
        You have a flying speed equal to your walking speed
      </div>`,
    whisper: [game.user.id],
    type: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}
// END: WINGED BOOTS MACRO
