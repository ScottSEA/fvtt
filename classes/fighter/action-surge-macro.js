/**
 * ACTION SURGE REMINDER MACRO
 *
 * Posts a whispered chat reminder at the start of the Fighter's combat turn
 * when Action Surge has uses remaining.
 *
 * RAW (2024 Fighter): "You can push yourself beyond your normal limits for
 * a moment. On your turn, you can take one additional action. Once you use
 * this feature, you must finish a Short or Long Rest before you can use it
 * again. Starting at 17th level, you can use it twice before a rest."
 *
 * Hooks: updateCombat
 */

const MACRO_ICON = "fa-bolt";

const AS_HOOK_FLAG = "actionSurgeHookRegistered";
const AS_FEAT_NAME = "Action Surge";
const AS_LAST_TURN_KEY = "_actionSurgeLastTurn";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[AS_HOOK_FLAG]) return;
  const prev = game[AS_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("updateCombat", prev.hookId);
  delete game[AS_HOOK_FLAG];
  console.log("Action Surge macro torn down.");
}

function register() {
  const hookId = Hooks.on("updateCombat", onUpdateCombat);
  game[AS_HOOK_FLAG] = { hookId };
  console.log("Action Surge macro loaded.");
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
  if (game[AS_LAST_TURN_KEY] === turnKey) return;
  game[AS_LAST_TURN_KEY] = turnKey;

  // Find Action Surge feature
  const feat = actor.items.find(
    i => i.name === AS_FEAT_NAME && i.type === "feat"
  );
  if (!feat) return;

  const remaining = getUsesRemaining(feat);
  if (remaining <= 0) return;

  const max = feat.system?.uses?.max ?? 0;
  const content =
    `<div style="border:2px solid #4488cc; border-radius:8px; padding:8px; background:linear-gradient(135deg, #1a2a40 0%, #2a4060 100%); text-align:center;">` +
    `<h2 style="margin:0 0 4px; font-size:15px; font-weight:bold; color:#66bbff;">` +
    `⚡ Action Surge Available</h2>` +
    `<p style="margin:4px 0; color:#aaddff;">` +
    `<strong>${actor.name}</strong> can take one additional action this turn.</p>` +
    `<p style="margin:4px 0; color:#88bbdd; font-size:13px;">` +
    `${remaining}/${max} use${max !== 1 ? "s" : ""} remaining</p>` +
    `</div>`;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    whisper: [game.user.id],
  });
}

// ─── Uses Helper ─────────────────────────────────────────────────────────────

function getUsesRemaining(item) {
  const uses = item.system?.uses;
  if (!uses || uses.max == null || uses.max === 0) return 0;
  return uses.max - (uses.spent ?? 0);
}
// END: ACTION SURGE REMINDER MACRO
