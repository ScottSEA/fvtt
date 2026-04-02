/**
 * VITALITY SURGE MACRO
 *
 * Watches for the Rage condition to be activated on your character and
 * automatically grants Temporary Hit Points equal to your Barbarian level.
 *
 * RAW: "When you activate your Rage, you gain a number of Temporary Hit
 * Points equal to your Barbarian level."
 *
 * Detects Rage via multiple hooks to cover different Foundry / dnd5e versions:
 *   - dnd5e.postUseActivity — dnd5e v4+ activity system (fires after Rage is used)
 *   - createActiveEffect    — a new "Rage" effect being created (core Foundry hook)
 *   - updateActiveEffect    — a disabled "Rage" effect being re-enabled
 *
 * Set VS_DEBUG = true in the console to log all hook traffic for debugging.
 * Or use CONFIG.debug.hooks = true to see ALL Foundry hooks firing.
 */

let VS_DEBUG = false;
const VS_HOOK_FLAG = "vitalitySurgeHookRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[VS_HOOK_FLAG]) return;
  const prev = game[VS_HOOK_FLAG];
  if (prev.createHookId != null) Hooks.off("createActiveEffect", prev.createHookId);
  if (prev.updateHookId != null) Hooks.off("updateActiveEffect", prev.updateHookId);
  if (prev.postUseActivityHookId != null) Hooks.off("dnd5e.postUseActivity", prev.postUseActivityHookId);
  console.log("Vitality Surge macro torn down.");
}

function register() {
  const createHookId = Hooks.on("createActiveEffect", onCreateActiveEffect);
  const updateHookId = Hooks.on("updateActiveEffect", onUpdateActiveEffect);
  const postUseActivityHookId = Hooks.on("dnd5e.postUseActivity", onPostUseActivity);
  game[VS_HOOK_FLAG] = { createHookId, updateHookId, postUseActivityHookId };
  console.log("Vitality Surge macro loaded.");
}

// ─── dnd5e Activity Hook (v4+) ────────────────────────────────────────────────

function onPostUseActivity(activity, usageConfig, results) {
  if (VS_DEBUG) console.log("Vitality Surge | dnd5e.postUseActivity fired:",
    activity?.item?.name, { activity, usageConfig, results });

  const item = activity?.item;
  if (!item) return;
  if (!isRageItem(item)) return;

  const actor = item.actor ?? item.parent;
  if (!actor?.isOwner) return;

  applyVitalitySurge(actor).catch(err => console.error("Vitality Surge error:", err));
}

// ─── ActiveEffect Hooks (fallback) ───────────────────────────────────────────

function onCreateActiveEffect(effect, options, userId) {
  if (VS_DEBUG) console.log("Vitality Surge | createActiveEffect fired:", effect?.name, effect);
  if (game.user.id !== userId) return;
  if (!isRageEffect(effect)) return;
  if (effect.disabled) return;

  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;

  applyVitalitySurge(actor).catch(err => console.error("Vitality Surge error:", err));
}

function onUpdateActiveEffect(effect, changes, options, userId) {
  if (VS_DEBUG) console.log("Vitality Surge | updateActiveEffect fired:", effect?.name, changes);
  if (game.user.id !== userId) return;
  if (!isRageEffect(effect)) return;
  // Only trigger when the effect is being enabled (disabled → enabled)
  if (changes.disabled !== false) return;

  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;

  applyVitalitySurge(actor).catch(err => console.error("Vitality Surge error:", err));
}

// ─── Rage Detection ──────────────────────────────────────────────────────────

function isRageEffect(effect) {
  if (effect.name === "Rage") return true;
  if (effect.statuses?.has("raging")) return true;
  return false;
}

function isRageItem(item) {
  if (item.name === "Rage") return true;
  // dnd5e v4 may store the identifier on the activity or the item
  if (item.system?.identifier === "rage") return true;
  return false;
}

// ─── Barbarian Level ─────────────────────────────────────────────────────────

function getBarbarianLevel(actor) {
  // dnd5e stores class data keyed by identifier
  const barbarianClass = actor.classes?.barbarian;
  if (barbarianClass) return barbarianClass.system?.levels ?? 0;

  // Fallback: search items for a class named "Barbarian"
  const cls = actor.items?.find(
    i => i.type === "class" && i.name === "Barbarian"
  );
  return cls?.system?.levels ?? 0;
}

// ─── Apply Temp HP ───────────────────────────────────────────────────────────

async function applyVitalitySurge(actor) {
  const level = getBarbarianLevel(actor);
  if (level <= 0) {
    console.warn("Vitality Surge | No Barbarian levels found on", actor.name);
    return;
  }

  const currentTemp = actor.system?.attributes?.hp?.temp ?? 0;

  if (level > currentTemp) {
    await actor.update({ "system.attributes.hp.temp": level });
    ui.notifications.info(
      `💥 Vitality Surge! ${actor.name} gains ${level} Temporary HP!`
    );
  } else {
    ui.notifications.info(
      `💥 Vitality Surge: ${actor.name} already has ${currentTemp} Temp HP ` +
      `(would gain ${level}). No change.`
    );
  }

  // Post to chat so everyone sees it
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content:
      `<div style="text-align:center;">` +
      `<h3 style="margin:0 0 4px;">💥 Vitality Surge</h3>` +
      `<p style="margin:4px 0;"><strong>${actor.name}</strong> activates Rage and ` +
      `gains <strong>${level}</strong> Temporary HP!</p>` +
      `<p style="margin:4px 0; font-size:12px; color:#666;">` +
      `(Barbarian level ${level})</p>` +
      `</div>`,
  });
}
