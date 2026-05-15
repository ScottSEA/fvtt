/**
 * EVASION REMINDER MACRO
 *
 * Injects a banner reminder into DEX saving throw chat messages when the
 * Rogue has the Evasion feature, noting that success means no damage and
 * failure means half damage.
 *
 * RAW (2024 Rogue): "When you are subjected to an effect that allows you
 * to make a Dexterity saving throw to take only half damage, you instead
 * take no damage if you succeed on the saving throw, and only half damage
 * if you fail."
 *
 * Hooks: dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-wind";

const EV_HOOK_FLAG = "evasionHookRegistered";
const EV_FEAT_NAME = "Evasion";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[EV_HOOK_FLAG]) return;
  const prev = game[EV_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  delete game[EV_HOOK_FLAG];
  console.log("Evasion macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[EV_HOOK_FLAG] = { hookId };
  console.log("Evasion macro loaded.");
}

// ─── Chat Message Hook ──────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  // Only process saving throw rolls
  const rollType = message.flags?.dnd5e?.roll?.type;
  if (rollType !== "save") return;

  // Only DEX saves
  const ability = message.flags?.dnd5e?.roll?.ability;
  if (ability !== "dex") return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;

  // Skip if already injected
  if (el.querySelector("[data-action='evasion-reminder']")) return;

  // Resolve the actor who made the save
  const actorId = message.speaker?.actor;
  if (!actorId) return;
  const actor = game.actors.get(actorId);
  if (!actor?.isOwner) return;

  // Must have Evasion feat
  const feat = actor.items.find(
    i => i.name === EV_FEAT_NAME && i.type === "feat"
  );
  if (!feat) return;

  // Determine save result for messaging
  const dc = message.flags?.dnd5e?.roll?.dc;
  const rollTotal = message.rolls?.[0]?.total;

  let resultLine = "";
  if (dc != null && rollTotal != null) {
    if (rollTotal >= dc) {
      resultLine = `<p style="margin:4px 0; color:#77ff77; font-weight:bold;">` +
        `✅ Save succeeded — Take NO damage</p>`;
    } else {
      resultLine = `<p style="margin:4px 0; color:#ff9977; font-weight:bold;">` +
        `⚠️ Save failed — Take HALF damage instead of full</p>`;
    }
  }

  // Inject banner
  const container = el.querySelector(".message-content");
  if (!container) return;

  const bannerHtml =
    `<div data-action="evasion-reminder"` +
    ` style="border:2px solid #7c3aed; border-radius:8px; padding:8px;` +
    ` background:linear-gradient(135deg, #0f0a1e 0%, #1e1040 100%);` +
    ` text-align:center; margin-top:8px;">` +
    `<h2 style="margin:0 0 4px; font-size:15px; font-weight:bold; color:#a78bfa;">` +
    `🌀 Evasion</h2>` +
    `<p style="margin:4px 0; color:#c4b5fd;">` +
    `Success: no damage / Failure: half damage instead of full</p>` +
    resultLine +
    `</div>`;

  container.insertAdjacentHTML("beforeend", bannerHtml);
}
// END: EVASION REMINDER MACRO
