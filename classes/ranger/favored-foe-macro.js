/**
 * FAVORED FOE REMINDER MACRO
 *
 * Injects a reminder banner into attack roll chat messages when the Ranger
 * has the Favored Foe feat with uses remaining, offering to mark the target
 * for extra damage without requiring concentration.
 *
 * RAW (2024 PHB): "When you hit a creature with an attack roll, you can call
 * on your mystical bond with nature to mark the target as your favored enemy
 * for 1 minute or until you lose your concentration. ... The first time on
 * each of your turns that you hit the favored enemy and deal damage to it,
 * including when you mark it, you can deal an extra 1d6 damage to it."
 *
 * Hooks: dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-bullseye";
const HOOK_FLAG = "favoredFoeHookRegistered";
const DEDUP_KEY = "_favoredFoeLastTurn";

teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[HOOK_FLAG]) return;
  const prev = game[HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  delete game[HOOK_FLAG];
  console.log("Favored Foe macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[HOOK_FLAG] = { hookId };
  console.log("Favored Foe macro loaded.");
}

// ─── Hook Handler ─────────────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  try {
    // Only attack rolls
    if (!isAttackRoll(message)) return;

    const actor = resolveActor(message);
    if (!actor?.isOwner) return;

    // Must have Favored Foe feat
    const feat = actor.items.find(i => i.name === "Favored Foe" && i.type === "feat");
    if (!feat) return;

    // Check uses remaining
    const usesMax = feat.system?.uses?.max ?? 0;
    const usesSpent = feat.system?.uses?.spent ?? 0;
    const usesRemaining = usesMax - usesSpent;
    if (usesRemaining <= 0) return;

    // Per-turn dedup
    const combat = game.combat;
    if (combat?.started) {
      const turnKey = `${combat.id}-${combat.round}-${combat.turn}`;
      if (game[DEDUP_KEY] === turnKey) return;
      game[DEDUP_KEY] = turnKey;
    }

    const el = html instanceof HTMLElement ? html : html[0] ?? html;

    // Dedup guard
    if (el.querySelector("[data-action='favored-foe-reminder']")) return;

    const bannerHtml =
      `<div data-action="favored-foe-reminder" style="` +
      `background:linear-gradient(135deg, #2a4a1a 0%, #3d6b2e 100%);` +
      `color:white; padding:8px 12px; border-radius:8px; margin:8px 0;` +
      `border:2px solid #5a9a4a; text-align:center; font-size:0.9em;` +
      `box-shadow:0 2px 8px rgba(58,107,46,0.4);">` +
      `<strong>🏹 Favored Foe</strong> (${usesRemaining}/${usesMax} uses)<br>` +
      `Mark this target for extra <strong style="color:#90ee90;">1d6 damage</strong> (no concentration)` +
      `</div>`;

    el.querySelector(".message-content")?.insertAdjacentHTML("beforeend", bannerHtml);
  } catch (err) {
    console.error("Favored Foe macro error:", err.message);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAttackRoll(message) {
  return message.flags?.dnd5e?.roll?.type === "attack" ||
    message.rolls?.some(r => r.options?.type === "attack") ||
    message.flags?.dnd5e?.activity?.type === "attack";
}

function resolveActor(message) {
  return message.actor ||
    (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null) ||
    (message.speaker?.token ? canvas?.tokens?.get(message.speaker.token)?.actor : null) ||
    null;
}
// END: FAVORED FOE REMINDER MACRO
