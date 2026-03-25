/**
 * LIFE-GIVING FORCE MACRO
 *
 * Displays a notification when it becomes your turn in combat.
 * If Rage is active and the actor has the Vitality of the Tree feature,
 * offers a dialog to use Life-Giving Force via the item's native Heal activity.
 * The dnd5e system handles the roll, chat card, and cross-client Apply buttons.
 */

const LGF_HOOK_FLAG = "lifeGivingForceHookRegistered";
const LIFE_GIVING_FORCE_NAME = "Vitality of the Tree";
const LIFE_GIVING_FORCE_ACTIVITY = "Life-Giving Force";
let LGF_DEBUG = false;

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  // Clean up legacy hook from old flag name
  const legacyFlag = "turnNotifyHookRegistered";
  if (game[legacyFlag]) {
    const legacy = game[legacyFlag];
    if (legacy.hookId != null) Hooks.off("updateCombat", legacy.hookId);
    delete game[legacyFlag];
  }

  if (!game[LGF_HOOK_FLAG]) return;
  const prev = game[LGF_HOOK_FLAG];
  if (prev.combatHookId != null) Hooks.off("updateCombat", prev.combatHookId);
  console.log("Life-Giving Force macro torn down.");
}

function register() {
  const combatHookId = Hooks.on("updateCombat", onUpdateCombat);
  game[LGF_HOOK_FLAG] = { combatHookId };
  console.log("Life-Giving Force macro loaded.");
}

// ─── Combat Hook ─────────────────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  if (!("turn" in changed || "round" in changed)) return;

  const combatant = combat.combatant;
  if (!combatant?.isOwner) return;
  if (combatant.isDefeated) return;

  const actor = combatant.actor;
  if (!actor) return;
  const name = actor.name ?? "Unknown";

  ui.notifications.info(`⚔️ It's ${name}'s turn!`);

  const isRaging = isActorRaging(actor);
  const hasLifeGiving = actor?.items?.find(
    i => i.name === LIFE_GIVING_FORCE_NAME && i.type === "feat"
  );

  console.log(`Life-Giving Force | Raging: ${isRaging}, Has Feature: ${!!hasLifeGiving}`);

  if (isRaging && hasLifeGiving) {
    showLifeGivingForceDialog(actor, name);
  }
}

// ─── Rage Detection ──────────────────────────────────────────────────────────

function isActorRaging(actor) {
  if (!actor) return false;
  // Check for "raging" status (set by Rage active effect)
  if (actor.statuses?.has("raging")) return true;
  // Fallback: look for an enabled effect named "Rage"
  return actor.effects?.some(e => e.name === "Rage" && !e.disabled) ?? false;
}

// ─── Rage Damage Bonus ───────────────────────────────────────────────────────

function getRageDamageBonus(actor) {
  return actor.system?.scale?.barbarian?.["rage-damage"]?.value ?? 0;
}

// ─── Life-Giving Force ───────────────────────────────────────────────────────

async function showLifeGivingForceDialog(actor, name) {
  const rageDmg = getRageDamageBonus(actor);
  if (rageDmg <= 0) return;

  // Find the Vitality of the Tree item and its Life-Giving Force heal activity
  const item = actor.items?.find(
    i => i.name === LIFE_GIVING_FORCE_NAME && i.type === "feat"
  );
  if (!item) return;

  const activity = Array.from(item.system.activities?.values() ?? []).find(
    a => a.name === LIFE_GIVING_FORCE_ACTIVITY
  );
  if (!activity) {
    ui.notifications.warn("🌳 Could not find Life-Giving Force activity on the item.");
    return;
  }

  if (LGF_DEBUG) console.log("Life-Giving Force | Found activity:", activity);

  const confirmed = await Dialog.confirm({
    title: "🌳 Life-Giving Force",
    content:
      `<p><strong>${name}</strong> is Raging with Vitality of the Tree!</p>` +
      `<p>Use <strong>Life-Giving Force</strong> to grant <strong>${rageDmg}d6</strong> ` +
      `Temporary HP to a creature within 10 feet?</p>` +
      `<p><em>Target a token before clicking Yes.</em></p>`,
    yes: () => true,
    no: () => false,
    defaultYes: true,
  });

  if (!confirmed) return;

  const target = game.user.targets.first();
  if (!target) {
    ui.notifications.warn("🌳 No target selected — select a token and try again.");
    return;
  }

  // Post a narrative message, then trigger the native dnd5e heal activity.
  // The system handles the roll, chat card, and Apply buttons on ALL clients.
  const targetName = target.actor?.name ?? target.name;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content:
      `<div style="text-align:center;">` +
      `<h2 style="margin:0 0 4px; font-size:15px;font-weight:bold;">🌳 Life-Giving Force 🌳</h2>` +
      `<p style="margin:4px 0;"><strong>${name}</strong> reaches out to </p>` +
      `<h2>${targetName}</h2>` +
      `<p>channeling the life force of the World Tree!</p>` +
      `</div>`,
  });

  await activity.use(
    { consume: false, subsequentActions: false },
    { configure: false },
    { create: false }
  );

  // Roll healing directly, skipping the roll dialog
  await activity.rollDamage({}, { configure: false }, {});
}

