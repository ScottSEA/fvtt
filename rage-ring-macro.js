/**
 * RAGE RING MACRO
 *
 * Adds a glowing red token ring while the character is raging, and removes it
 * when Rage ends. Purely visual — no mechanical effect.
 *
 * Activates on:
 *   - dnd5e.postUseActivity  — Rage used via the dnd5e v4+ activity system
 *   - createActiveEffect     — Rage effect created on actor
 *   - updateActiveEffect     — disabled Rage effect re-enabled
 *
 * Deactivates on:
 *   - deleteActiveEffect     — Rage effect deleted
 *   - updateActiveEffect     — Rage effect disabled
 *
 * Set RAGE_RING_DEBUG = true in the console to log hook traffic.
 */

let RAGE_RING_DEBUG = false;

const RAGE_RING_HOOK_FLAG = "rageRingHookRegistered";

// Ring appearance while raging
const RING_COLOR     = "#cc2200";  // deep red
const RING_EFFECT    = 2;          // TOKEN_RING_EFFECTS.GLOWING_COLORS
const BG_COLOR       = "#550000";  // dark inner glow

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[RAGE_RING_HOOK_FLAG]) return;
  const prev = game[RAGE_RING_HOOK_FLAG];
  if (prev.createHookId   != null) Hooks.off("createActiveEffect",    prev.createHookId);
  if (prev.updateHookId   != null) Hooks.off("updateActiveEffect",    prev.updateHookId);
  if (prev.deleteHookId   != null) Hooks.off("deleteActiveEffect",    prev.deleteHookId);
  if (prev.postUseHookId  != null) Hooks.off("dnd5e.postUseActivity", prev.postUseHookId);
  console.log("Rage Ring macro torn down.");
}

function register() {
  const createHookId  = Hooks.on("createActiveEffect",    onCreateActiveEffect);
  const updateHookId  = Hooks.on("updateActiveEffect",    onUpdateActiveEffect);
  const deleteHookId  = Hooks.on("deleteActiveEffect",    onDeleteActiveEffect);
  const postUseHookId = Hooks.on("dnd5e.postUseActivity", onPostUseActivity);
  game[RAGE_RING_HOOK_FLAG] = { createHookId, updateHookId, deleteHookId, postUseHookId };
  console.log("Rage Ring macro loaded.");
}

// ─── Hook Handlers ────────────────────────────────────────────────────────────

function onPostUseActivity(activity, usageConfig, results) {
  if (RAGE_RING_DEBUG) console.log("Rage Ring | postUseActivity fired:", activity?.item?.name);
  const item = activity?.item;
  if (!item || !isRageItem(item)) return;
  const actor = item.actor ?? item.parent;
  if (!actor?.isOwner) return;
  applyRageRing(actor).catch(err => console.error("Rage Ring error:", err));
}

function onCreateActiveEffect(effect, options, userId) {
  if (RAGE_RING_DEBUG) console.log("Rage Ring | createActiveEffect fired:", effect?.name);
  if (game.user.id !== userId) return;
  if (!isRageEffect(effect) || effect.disabled) return;
  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;
  applyRageRing(actor).catch(err => console.error("Rage Ring error:", err));
}

function onUpdateActiveEffect(effect, changes, options, userId) {
  if (RAGE_RING_DEBUG) console.log("Rage Ring | updateActiveEffect fired:", effect?.name, changes);
  if (game.user.id !== userId) return;
  if (!isRageEffect(effect)) return;
  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;

  if (changes.disabled === false) {
    // Rage re-enabled
    applyRageRing(actor).catch(err => console.error("Rage Ring error:", err));
  } else if (changes.disabled === true) {
    // Rage disabled (ended)
    removeRageRing(actor).catch(err => console.error("Rage Ring error:", err));
  }
}

function onDeleteActiveEffect(effect, options, userId) {
  if (RAGE_RING_DEBUG) console.log("Rage Ring | deleteActiveEffect fired:", effect?.name);
  if (game.user.id !== userId) return;
  if (!isRageEffect(effect)) return;
  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;
  removeRageRing(actor).catch(err => console.error("Rage Ring error:", err));
}

// ─── Ring Application ─────────────────────────────────────────────────────────

async function applyRageRing(actor) {
  const token = getActorToken(actor);
  if (!token) {
    if (RAGE_RING_DEBUG) console.log("Rage Ring | No token found for", actor.name);
    return;
  }

  if (RAGE_RING_DEBUG) console.log("Rage Ring | Applying ring to", actor.name);

  await token.document.update({
    "ring.enabled":           true,
    "ring.colors.ring":       RING_COLOR,
    "ring.colors.background": BG_COLOR,
    "ring.effects":           RING_EFFECT,
  });
}

async function removeRageRing(actor) {
  const token = getActorToken(actor);
  if (!token) {
    if (RAGE_RING_DEBUG) console.log("Rage Ring | No token found for", actor.name);
    return;
  }

  if (RAGE_RING_DEBUG) console.log("Rage Ring | Removing ring from", actor.name);

  await token.document.update({
    "ring.enabled":           false,
    "ring.colors.ring":       "#000000",
    "ring.colors.background": "#000000",
    "ring.effects":           0,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getActorToken(actor) {
  // Prefer the active scene token for this actor
  return canvas?.tokens?.placeables?.find(t => t.actor?.id === actor.id) ?? null;
}

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
