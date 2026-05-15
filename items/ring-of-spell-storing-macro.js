/**
 * RING OF SPELL STORING MACRO
 *
 * Turn-start whispered reminder when the Ring of Spell Storing has stored
 * spell levels remaining to cast.
 *
 * RAW: "This ring stores spells cast into it, holding them until the attuned
 * wearer uses them. The ring can store up to 5 levels worth of spells at a
 * time."
 *
 * Hooks: updateCombat
 */

const MACRO_ICON = "fa-ring";
const RING_HOOK_FLAG = "ringOfSpellStoringHookRegistered";
const RING_TURN_KEY = "_ringSpellStoringLastTurn";

teardown();
register();

function teardown() {
  if (!game[RING_HOOK_FLAG]) return;
  const prev = game[RING_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("updateCombat", prev.hookId);
  delete game[RING_TURN_KEY];
  delete game[RING_HOOK_FLAG];
  console.log("Ring of Spell Storing macro torn down.");
}

function register() {
  const hookId = Hooks.on("updateCombat", onUpdateCombat);
  game[RING_HOOK_FLAG] = { hookId };
  console.log("Ring of Spell Storing macro loaded.");
}

// ─── Hook Handler ─────────────────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  if (!("turn" in changed || "round" in changed)) return;
  const combatant = combat.combatant;
  if (!combatant?.isOwner) return;

  const actor = combatant.actor;
  if (!actor?.isOwner) return;

  const ring = actor.items.find(
    i => i.name?.toLowerCase().includes("ring of spell storing") &&
         ["equipment", "loot"].includes(i.type)
  );
  if (!ring) return;

  // Check stored spell levels via system.uses
  const uses = ring.system?.uses;
  const max = uses?.max ?? 0;
  const spent = uses?.spent ?? 0;
  const remaining = max - spent;
  if (remaining <= 0) return;

  const turnKey = `${combat.id}-${combat.round}-${combat.turn}`;
  if (game[RING_TURN_KEY] === turnKey) return;
  game[RING_TURN_KEY] = turnKey;

  ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div style="padding:8px 12px; border-radius:8px; margin:4px 0; text-align:center; font-size:13px;
                  background:linear-gradient(135deg, #5c4a1a, #8c7a2a); color:white; border:1px solid #bfa84a;">
        <strong>💍 Ring of Spell Storing</strong><br>
        ${remaining} level${remaining !== 1 ? "s" : ""} of spells stored and ready to cast
      </div>`,
    whisper: [game.user.id],
    type: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}
// END: RING OF SPELL STORING MACRO
