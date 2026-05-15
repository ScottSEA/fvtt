/**
 * HUNTER'S MARK REMINDER MACRO
 *
 * Injects a reminder banner into attack roll chat messages when the Ranger
 * has Hunter's Mark active (concentrating). Reminds the player to add 1d6
 * damage if the target is their marked creature.
 *
 * RAW (2024 PHB): "Until the spell ends, you deal an extra 1d6 Force damage
 * to the target whenever you hit it with an attack roll."
 *
 * Hooks: dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-crosshairs";
const HOOK_FLAG = "huntersMarkHookRegistered";

teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[HOOK_FLAG]) return;
  const prev = game[HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  delete game[HOOK_FLAG];
  console.log("Hunter's Mark macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[HOOK_FLAG] = { hookId };
  console.log("Hunter's Mark macro loaded.");
}

// ─── Hook Handler ─────────────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  try {
    // Only attack rolls
    if (!isAttackRoll(message)) return;

    const actor = resolveActor(message);
    if (!actor?.isOwner) return;

    // Must have Hunter's Mark spell
    const spell = actor.items.find(i => i.name === "Hunter's Mark" && i.type === "spell");
    if (!spell) return;

    // Must be concentrating
    if (!isConcentrating(actor)) return;

    const el = html instanceof HTMLElement ? html : html[0] ?? html;

    // Dedup guard
    if (el.querySelector("[data-action='hunters-mark-reminder']")) return;

    const bannerHtml =
      `<div data-action="hunters-mark-reminder" style="` +
      `background:linear-gradient(135deg, #1a3a1a 0%, #2d5a27 100%);` +
      `color:white; padding:8px 12px; border-radius:8px; margin:8px 0;` +
      `border:2px solid #4a8c3f; text-align:center; font-size:0.9em;` +
      `box-shadow:0 2px 8px rgba(45,90,39,0.4);">` +
      `<strong>🎯 Hunter's Mark</strong><br>` +
      `Add <strong style="color:#90ee90;">1d6 damage</strong> if this is your marked target` +
      `</div>`;

    el.querySelector(".message-content")?.insertAdjacentHTML("beforeend", bannerHtml);
  } catch (err) {
    console.error("Hunter's Mark macro error:", err.message);
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

function isConcentrating(actor) {
  // Preferred: check statuses set
  if (actor.statuses?.has("concentrating")) return true;
  // Fallback: check for active Concentrating effect
  return actor.effects?.some(
    e => e.name === "Concentrating" && !e.disabled
  ) ?? false;
}
// END: HUNTER'S MARK REMINDER MACRO
