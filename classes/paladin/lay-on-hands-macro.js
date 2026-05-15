/**
 * LAY ON HANDS REMINDER MACRO
 *
 * Posts a whispered chat reminder at the start of the Paladin's combat turn
 * when Lay on Hands has points remaining in the healing pool and the Paladin
 * or an ally is damaged.
 *
 * RAW (2024 Paladin): "Your blessed touch can heal wounds. You have a pool
 * of healing power that replenishes when you take a Long Rest. With that
 * pool, you can restore a total number of Hit Points equal to five times
 * your Paladin level. As an Action, you can touch a creature (including
 * yourself) and draw power from the pool to restore a number of Hit Points
 * to that creature, up to the maximum amount remaining in the pool."
 *
 * Hooks: updateCombat
 */

const MACRO_ICON = "fa-hand-holding-medical";

const LOH_HOOK_FLAG = "layOnHandsHookRegistered";
const LOH_FEAT_NAME = "Lay on Hands";
const LOH_LAST_TURN_KEY = "_layOnHandsLastTurn";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[LOH_HOOK_FLAG]) return;
  const prev = game[LOH_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("updateCombat", prev.hookId);
  delete game[LOH_HOOK_FLAG];
  console.log("Lay on Hands macro torn down.");
}

function register() {
  const hookId = Hooks.on("updateCombat", onUpdateCombat);
  game[LOH_HOOK_FLAG] = { hookId };
  console.log("Lay on Hands macro loaded.");
}

// ─── Combat Hook ─────────────────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  if (!("turn" in changed || "round" in changed)) return;
  if (!combat?.started) return;

  const combatant = combat.combatant;
  if (!combatant?.isOwner || combatant.isDefeated) return;

  const actor = combatant.actor;
  if (!actor) return;

  // Per-turn dedup
  const turnKey = `${combat.id}-${combat.round}-${combat.turn}`;
  if (game[LOH_LAST_TURN_KEY] === turnKey) return;
  game[LOH_LAST_TURN_KEY] = turnKey;

  // Find Lay on Hands feature
  const feat = actor.items.find(
    i => i.name === LOH_FEAT_NAME && i.type === "feat"
  );
  if (!feat) return;

  const remaining = getUsesRemaining(feat);
  if (remaining <= 0) return;

  // Only remind if someone is damaged — check the Paladin or any ally in combat
  if (!anyoneDamaged(combat, actor)) return;

  const max = feat.system?.uses?.max ?? 0;

  const content =
    `<div style="border:2px solid #d4a017; border-radius:8px; padding:8px; background:linear-gradient(135deg, #2a2a0a 0%, #4c4420 100%); text-align:center;">` +
    `<h2 style="margin:0 0 4px; font-size:15px; font-weight:bold; color:#ffd700;">` +
    `✋ Lay on Hands</h2>` +
    `<p style="margin:4px 0; color:#e8c860;">` +
    `<strong>${actor.name}</strong> has <strong>${remaining}</strong> HP in healing pool (${remaining}/${max})</p>` +
    `<p style="margin:4px 0; color:#ccaa44; font-size:13px;">` +
    `Action to touch and heal a creature</p>` +
    `</div>`;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    whisper: [game.user.id],
  });
}

// ─── Damage Check ────────────────────────────────────────────────────────────

function anyoneDamaged(combat, paladinActor) {
  // Check if the Paladin is damaged
  const paladinHp = paladinActor.system?.attributes?.hp;
  if (paladinHp && paladinHp.value < paladinHp.max) return true;

  // Check if any allied combatant is damaged
  for (const c of combat.combatants) {
    if (c.isDefeated) continue;
    const a = c.actor;
    if (!a || !a.isOwner) continue;
    if (a.id === paladinActor.id) continue;
    const hp = a.system?.attributes?.hp;
    if (hp && hp.value < hp.max) return true;
  }

  return false;
}

// ─── Uses Helper ─────────────────────────────────────────────────────────────

function getUsesRemaining(item) {
  const uses = item.system?.uses;
  if (!uses || uses.max == null || uses.max === 0) return 0;
  return uses.max - (uses.spent ?? 0);
}
// END: LAY ON HANDS REMINDER MACRO
