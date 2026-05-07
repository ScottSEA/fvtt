/**
 * INSTINCTIVE POUNCE MACRO
 *
 * Watches for the Rage condition to be activated on your character and
 * reminds you that you can move up to half your speed as part of the
 * Rage bonus action (Instinctive Pounce, Barbarian level 7).
 *
 * RAW: "As part of the Bonus Action you take to enter your Rage, you
 * can move up to half your Speed."
 *
 * Detects Rage via multiple hooks to cover different Foundry / dnd5e versions:
 *   - dnd5e.postUseActivity — dnd5e v4+ activity system (fires after Rage is used)
 *   - createActiveEffect    — a new "Rage" effect being created (core Foundry hook)
 *   - updateActiveEffect    — a disabled "Rage" effect being re-enabled
 *
 * Set IP_DEBUG = true in the console to log all hook traffic for debugging.
 */

let IP_DEBUG = false;
const IP_HOOK_FLAG = "instinctivePounceHookRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[IP_HOOK_FLAG]) return;
  const prev = game[IP_HOOK_FLAG];
  if (prev.createHookId != null) Hooks.off("createActiveEffect", prev.createHookId);
  if (prev.updateHookId != null) Hooks.off("updateActiveEffect", prev.updateHookId);
  if (prev.postUseActivityHookId != null) Hooks.off("dnd5e.postUseActivity", prev.postUseActivityHookId);
  console.log("Instinctive Pounce macro torn down.");
}

function register() {
  const createHookId = Hooks.on("createActiveEffect", onCreateActiveEffect);
  const updateHookId = Hooks.on("updateActiveEffect", onUpdateActiveEffect);
  const postUseActivityHookId = Hooks.on("dnd5e.postUseActivity", onPostUseActivity);
  game[IP_HOOK_FLAG] = { createHookId, updateHookId, postUseActivityHookId };
  console.log("Instinctive Pounce macro loaded.");
}

// ─── dnd5e Activity Hook (v4+) ────────────────────────────────────────────────

function onPostUseActivity(activity, usageConfig, results) {
  if (IP_DEBUG) console.log("Instinctive Pounce | dnd5e.postUseActivity fired:",
    activity?.item?.name, { activity, usageConfig, results });

  const item = activity?.item;
  if (!item) return;
  if (!isRageItem(item)) return;

  const actor = item.actor ?? item.parent;
  if (!actor?.isOwner) return;

  showPounceReminder(actor).catch(err => console.error("Instinctive Pounce error:", err));
}

// ─── ActiveEffect Hooks (fallback) ───────────────────────────────────────────

function onCreateActiveEffect(effect, options, userId) {
  if (IP_DEBUG) console.log("Instinctive Pounce | createActiveEffect fired:", effect?.name, effect);
  if (game.user.id !== userId) return;
  if (!isRageEffect(effect)) return;
  if (effect.disabled) return;

  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;
  if (!actor.isOwner) return;

  showPounceReminder(actor).catch(err => console.error("Instinctive Pounce error:", err));
}

function onUpdateActiveEffect(effect, changes, options, userId) {
  if (IP_DEBUG) console.log("Instinctive Pounce | updateActiveEffect fired:", effect?.name, changes);
  if (game.user.id !== userId) return;
  if (!isRageEffect(effect)) return;
  if (changes.disabled !== false) return;

  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;
  if (!actor.isOwner) return;

  showPounceReminder(actor).catch(err => console.error("Instinctive Pounce error:", err));
}

// ─── Rage Detection ──────────────────────────────────────────────────────────

function isRageEffect(effect) {
  if (effect.name === "Rage") return true;
  if (effect.statuses?.has("raging")) return true;
  return false;
}

function isRageItem(item) {
  if (item.name === "Rage") return true;
  if (item.system?.identifier === "rage") return true;
  return false;
}

// ─── Feature Detection ───────────────────────────────────────────────────────

function hasInstinctivePounce(actor) {
  return actor.items?.some(i => i.name === "Instinctive Pounce" && i.type === "feat") ?? false;
}

// ─── Half Speed Calculation ──────────────────────────────────────────────────

function getHalfSpeed(actor) {
  const walk = actor.system?.attributes?.movement?.walk ?? 0;
  return Math.floor(walk / 2);
}

// ─── Reminder Message ────────────────────────────────────────────────────────

async function showPounceReminder(actor) {
  if (!hasInstinctivePounce(actor)) {
    if (IP_DEBUG) console.log("Instinctive Pounce | Actor lacks Instinctive Pounce feat:", actor.name);
    return;
  }

  const halfSpeed = getHalfSpeed(actor);
  if (halfSpeed <= 0) {
    if (IP_DEBUG) console.log("Instinctive Pounce | Actor has 0 walk speed:", actor.name);
    return;
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content:
      `<div style="text-align:center;">` +
      `<h3 style="margin:0 0 4px;">🏃 Instinctive Pounce</h3>` +
      `<p style="margin:4px 0;"><strong>${actor.name}</strong> can move up to ` +
      `<strong>${halfSpeed} ft</strong> as part of the Rage activation!</p>` +
      `<p style="margin:4px 0; font-size:12px; color:#666;">` +
      `(Half of ${actor.system.attributes.movement.walk} ft walking speed)</p>` +
      `</div>`,
    whisper: [game.user.id],
  });
}
// END: INSTINCTIVE POUNCE MACRO
