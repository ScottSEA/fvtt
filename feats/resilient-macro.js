/**
 * RESILIENT FEAT MACRO
 *
 * Detects saving throw rolls from owned actors with the Resilient feat
 * and injects an informational banner reminding the player that they
 * have proficiency in this save from Resilient.
 *
 * RAW (2024 Resilient): "Choose one ability in which you lack Saving
 * Throw Proficiency. You gain Saving Throw Proficiency with that ability."
 *
 * Hooks: dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-gem";
const RES_HOOK_FLAG = "resilientFeatHookRegistered";
const RES_FEAT_NAME = "Resilient";

teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[RES_HOOK_FLAG]) return;
  const prev = game[RES_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  delete game[RES_HOOK_FLAG];
  console.log("Resilient macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[RES_HOOK_FLAG] = { hookId };
  console.log("Resilient macro loaded.");
}

// ─── Chat Message Hook ──────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  try {
    // Must be a saving throw
    const rollType = message.flags?.dnd5e?.roll?.type;
    if (rollType !== "save") return;

    // Actor must be owned
    const actorId = message.speaker?.actor;
    if (!actorId) return;
    const actor = game.actors.get(actorId);
    if (!actor?.isOwner) return;

    // Check for Resilient feat
    const feat = actor.items.find(
      i => i.name === RES_FEAT_NAME && i.type === "feat"
    );
    if (!feat) return;

    // Dedup on element
    const el = html instanceof HTMLElement ? html : html[0] ?? html;
    if (el.querySelector("[data-action='resilient-info']")) return;

    const banner = `
      <div data-action="resilient-info" style="
        background: linear-gradient(135deg, #0d2b2b 0%, #1a4a4a 50%, #0d2b2b 100%);
        border: 2px solid #40a0a0;
        border-radius: 8px;
        padding: 10px 14px;
        color: #b0e0e0;
        font-size: 13px;
        margin: 6px 0 2px;
        text-align: center;
      ">
        <div style="font-size: 16px; margin-bottom: 4px;">🔰 Resilient</div>
        <div style="font-size: 12px; color: #80c8c8;">
          You have proficiency in this save
        </div>
      </div>`;

    el.querySelector(".message-content")?.insertAdjacentHTML("beforeend", banner);
  } catch (err) {
    console.error("Resilient macro error:", err.message);
  }
}
// END: RESILIENT FEAT MACRO
