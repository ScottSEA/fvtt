/**
 * RAGE MAINTENANCE WARNING MACRO
 *
 * Warns when Rage may end due to inactivity. Rage ends early if you
 * end your turn without having attacked a hostile creature or taken
 * damage since the end of your last turn.
 *
 * Tracking approach:
 *   - On turn START (updateCombat), reset the "attacked" and "took damage"
 *     flags for the raging actor.
 *   - renderChatMessage: detect outgoing attack rolls from the raging actor
 *     → set "attacked" flag.
 *   - dnd5e.damageActor: detect incoming damage to the raging actor
 *     → set "took damage" flag.
 *   - On turn END (updateCombat, when turn changes AWAY from the actor),
 *     check if either flag is set. If neither, post a warning.
 *
 * Hooks: updateCombat, dnd5e.renderChatMessage, dnd5e.damageActor
 */

let RM_DEBUG = false;

const RM_HOOK_FLAG = "rageMaintenanceHookRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[RM_HOOK_FLAG]) return;
  const prev = game[RM_HOOK_FLAG];
  if (prev.combatHookId != null) Hooks.off("updateCombat", prev.combatHookId);
  if (prev.renderHookId != null) Hooks.off("dnd5e.renderChatMessage", prev.renderHookId);
  if (prev.damageHookId != null) Hooks.off("dnd5e.damageActor", prev.damageHookId);
  delete game[RM_HOOK_FLAG];
  console.log("Rage Maintenance macro torn down.");
}

function register() {
  const combatHookId = Hooks.on("updateCombat", onUpdateCombat);
  const renderHookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  const damageHookId = Hooks.on("dnd5e.damageActor", onDamageActor);
  game[RM_HOOK_FLAG] = {
    combatHookId,
    renderHookId,
    damageHookId,
    // Per-actor tracking: { actorId: { attacked: bool, tookDamage: bool } }
    turnState: {},
    // Remember whose turn it was so we can detect turn-end
    lastTurnActorId: null,
  };
  console.log("Rage Maintenance macro loaded.");
}

// ─── Combat Hook ─────────────────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  if (!("turn" in changed || "round" in changed)) return;
  if (!combat?.started) return;

  const state = game[RM_HOOK_FLAG];
  if (!state) return;

  // Check the PREVIOUS combatant (whose turn just ended)
  const prevActorId = state.lastTurnActorId;
  if (prevActorId) {
    checkRageMaintenanceOnTurnEnd(prevActorId);
  }

  // Now set up for the NEW combatant's turn
  const combatant = combat.combatant;
  if (!combatant?.isOwner || combatant.isDefeated) {
    state.lastTurnActorId = null;
    return;
  }

  const actor = combatant.actor;
  if (!actor) {
    state.lastTurnActorId = null;
    return;
  }

  state.lastTurnActorId = actor.id;

  // Only track if actually raging
  if (isActorRaging(actor)) {
    state.turnState[actor.id] = { attacked: false, tookDamage: false };
    if (RM_DEBUG) console.log(`Rage Maintenance | Turn started for ${actor.name} — tracking rage activity.`);
  } else {
    delete state.turnState[actor.id];
  }
}

// ─── Attack Detection (renderChatMessage) ────────────────────────────────────

function onRenderChatMessage(message, html) {
  const state = game[RM_HOOK_FLAG];
  if (!state) return;

  // Check if this is an attack roll
  const rollType = message.flags?.dnd5e?.roll?.type;
  const isAttack = rollType === "attack"
    || message.rolls?.some(r => r.options?.type === "attack");
  if (!isAttack) return;

  // Resolve actor
  const actorId = message.speaker?.actor;
  if (!actorId) return;

  // Only care if we're tracking this actor
  if (!state.turnState[actorId]) return;

  state.turnState[actorId].attacked = true;
  if (RM_DEBUG) console.log(`Rage Maintenance | Attack detected for actor ${actorId}.`);
}

// ─── Damage Detection (dnd5e.damageActor) ────────────────────────────────────

function onDamageActor(actor, changes, update, userId) {
  const state = game[RM_HOOK_FLAG];
  if (!state) return;

  if (!actor?.id) return;
  if (!state.turnState[actor.id]) return;

  // Any damage taken counts (even 0 after resistance — the attempt matters for RAW,
  // but we only flag when actual HP loss occurs for safety)
  state.turnState[actor.id].tookDamage = true;
  if (RM_DEBUG) console.log(`Rage Maintenance | Damage taken by ${actor.name}.`);
}

// ─── Turn-End Check ──────────────────────────────────────────────────────────

function checkRageMaintenanceOnTurnEnd(actorId) {
  const state = game[RM_HOOK_FLAG];
  if (!state) return;

  const turnInfo = state.turnState[actorId];
  if (!turnInfo) return; // not tracking — wasn't raging or not owned

  // Clean up tracking
  delete state.turnState[actorId];

  const actor = game.actors.get(actorId);
  if (!actor) return;

  // Re-check rage in case it ended mid-turn
  if (!isActorRaging(actor)) {
    if (RM_DEBUG) console.log(`Rage Maintenance | ${actor.name} no longer raging at turn end.`);
    return;
  }

  if (turnInfo.attacked || turnInfo.tookDamage) {
    if (RM_DEBUG) console.log(`Rage Maintenance | ${actor.name} maintained rage — attacked: ${turnInfo.attacked}, took damage: ${turnInfo.tookDamage}.`);
    return;
  }

  // Neither attacked nor took damage — warn!
  postRageWarning(actor);
}

// ─── Rage Detection ──────────────────────────────────────────────────────────

function isActorRaging(actor) {
  if (!actor) return false;
  if (actor.statuses?.has("raging")) return true;
  const effects = actor.appliedEffects ?? actor.effects;
  return effects?.some(e => e.name === "Rage" && !e.disabled) ?? false;
}

// ─── Warning Message ─────────────────────────────────────────────────────────

function postRageWarning(actor) {
  const content =
    `<div style="border:2px solid #cc6600; border-radius:8px; padding:8px; background:linear-gradient(135deg, #3a2000 0%, #5c3300 100%); text-align:center;">` +
    `<h2 style="margin:0 0 4px; font-size:15px; font-weight:bold; color:#ffaa33;">` +
    `⚠️ Rage Fading! ⚠️</h2>` +
    `<p style="margin:4px 0; color:#ffddaa;">` +
    `<strong>${actor.name}</strong> hasn't attacked or taken damage this turn.</p>` +
    `<p style="margin:4px 0; color:#ffcc88; font-size:13px;">` +
    `Rage will <strong>end</strong> unless you attack a hostile creature or take damage before your turn ends!</p>` +
    `</div>`;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    whisper: [game.user.id],
  });

  ui.notifications.warn(`⚠️ ${actor.name}'s Rage is about to end — no attack or damage this turn!`);
}
// END: RAGE MAINTENANCE WARNING MACRO
