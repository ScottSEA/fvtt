/**
 * BRANCHES OF THE TREE MACRO
 *
 * World Tree Barbarian 6 feature reminder.
 * When a non-friendly creature starts its turn within 30 ft of your raging
 * character, posts a chat reminder about the Reaction teleport + speed reduction.
 *
 * Trigger: updateCombat (other creature's turn start)
 * Conditions: Owner is raging, has feature, creature is hostile/neutral and within 30 ft
 */

const BOT_HOOK_FLAG = "branchesOfTreeHookRegistered";
const BRANCHES_FEATURE_NAME = "Branches of the Tree";
const BRANCHES_RANGE_FT = 30;
let BRANCHES_DEBUG = false;

// --- Entry point ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[BOT_HOOK_FLAG]) return;
  const prev = game[BOT_HOOK_FLAG];
  if (prev.combatHookId != null) Hooks.off("updateCombat", prev.combatHookId);
  delete game[BOT_HOOK_FLAG];
  console.log("Branches of the Tree macro torn down.");
}

function register() {
  const combatHookId = Hooks.on("updateCombat", onUpdateCombat);
  game[BOT_HOOK_FLAG] = { combatHookId };
  console.log("Branches of the Tree macro loaded.");
}

// ─── Combat Hook ─────────────────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  const activeCombatant = combat.combatant;
  const owner = findOwnerCombatant(combat);
  const distance = owner ? measureTokenDistance(owner.token?.object, activeCombatant?.token?.object) : null;

  if (
    isTurnChange(changed)
    && isValidCombatant(activeCombatant)
    && owner
    && !isOwnTurn(activeCombatant, owner)
    && !isFriendly(activeCombatant)
    && isInRange(distance)
  ) {
    postReminder(owner.actor, activeCombatant, distance);
  }
}

// ─── Guard Functions ─────────────────────────────────────────────────────────

function isTurnChange(changed) {
  return "turn" in changed || "round" in changed;
}

function isValidCombatant(combatant) {
  return combatant && !combatant.isDefeated;
}

function isOwnTurn(activeCombatant, owner) {
  return activeCombatant.actor?.id === owner.actor.id;
}

function isFriendly(combatant) {
  const friendly = combatant.token?.disposition === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  if (friendly && BRANCHES_DEBUG) console.log(`Branches | ${combatant.name} is friendly, skipping.`);
  return friendly;
}

function isInRange(distance) {
  const inRange = distance != null && distance <= BRANCHES_RANGE_FT;
  if (!inRange && BRANCHES_DEBUG) console.log(`Branches | Out of range (${distance ?? "?"} ft).`);
  return inRange;
}

// ─── Owner Lookup ────────────────────────────────────────────────────────────

function findOwnerCombatant(combat) {
  for (const c of combat.combatants) {
    if (!c.isOwner || c.isDefeated || !c.actor) continue;
    if (!isActorRaging(c.actor)) continue;
    if (!hasFeature(c.actor, BRANCHES_FEATURE_NAME)) continue;
    return c;
  }
  return null;
}

// ─── Actor Checks ────────────────────────────────────────────────────────────

function isActorRaging(actor) {
  if (!actor) return false;
  if (actor.statuses?.has("raging")) return true;
  const effects = actor.appliedEffects ?? actor.effects;
  return effects?.some(e => e.name === "Rage" && !e.disabled) ?? false;
}

function hasFeature(actor, name) {
  return actor.items?.some(i => i.name === name && i.type === "feat") ?? false;
}

// ─── Distance Measurement ────────────────────────────────────────────────────

function measureTokenDistance(tokenA, tokenB) {
  if (!tokenA || !tokenB) return null;
  try {
    return canvas.grid.measurePath([tokenA.center, tokenB.center]).distance;
  } catch {
    try {
      return canvas.grid.measureDistance(tokenA.center, tokenB.center);
    } catch {
      console.error("Branches of the Tree | Could not measure distance.");
      return null;
    }
  }
}

// ─── Chat Reminder ───────────────────────────────────────────────────────────

function postReminder(actor, combatant, distance) {
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: buildReminderHtml(combatant.name ?? "Unknown Creature", Math.round(distance)),
    whisper: [game.user.id],
  });
}

function buildReminderHtml(creatureName, distance) {
  return (
    `<div style="text-align:center; border:2px solid #2d5a1d; border-radius:8px; padding:8px; background:linear-gradient(135deg, #1a3a0a 0%, #2d5a1d 100%);">` +
    `<h2 style="margin:0 0 4px; font-size:15px; font-weight:bold; color:#8fdf6f;">` +
    `🌳 Branches of the Tree 🌳</h2>` +
    `<p style="margin:4px 0; color:#d4ecc8;"><strong style="color:#b8f0a0;">${creatureName}</strong> ` +
    `starts its turn <strong>${distance} ft</strong> away.</p>` +
    `<p style="margin:4px 0; color:#d4ecc8;">Use your <strong style="color:#ffdd57;">Reaction</strong> to:</p>` +
    `<ul style="text-align:left; margin:4px 12px; color:#d4ecc8; list-style:none; padding:0;">` +
    `<li style="margin:2px 0;">🌿 Teleport it to within <strong>5 ft</strong> of you</li>` +
    `<li style="margin:2px 0;">🌿 Reduce its speed to <strong>0</strong> until end of turn</li>` +
    `</ul>` +
    `</div>`
  );
}
// END: BRANCHES OF THE TREE MACRO
