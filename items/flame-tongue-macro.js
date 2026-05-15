/**
 * FLAME TONGUE MACRO
 *
 * Injects a reminder banner on attack rolls made with a Flame Tongue weapon,
 * reminding the player to add +2d6 fire damage while the blade is ignited.
 *
 * RAW: "While the sword is ablaze, it deals an extra 2d6 fire damage to any
 * target it hits."
 *
 * Hooks: dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-fire";
const FLAME_HOOK_FLAG = "flameTongueHookRegistered";

teardown();
register();

function teardown() {
  if (!game[FLAME_HOOK_FLAG]) return;
  const prev = game[FLAME_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  delete game[FLAME_HOOK_FLAG];
  console.log("Flame Tongue macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[FLAME_HOOK_FLAG] = { hookId };
  console.log("Flame Tongue macro loaded.");
}

// ─── Hook Handler ─────────────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  const rollType = message.flags?.dnd5e?.roll?.type;
  if (rollType !== "attack") return;

  const actorId = message.speaker?.actor;
  if (!actorId) return;
  const actor = game.actors.get(actorId);
  if (!actor?.isOwner) return;

  // Check if the attack used a Flame Tongue weapon
  const itemId = message.flags?.dnd5e?.roll?.itemId;
  let isFlameTongue = false;

  if (itemId) {
    const item = actor.items.get(itemId);
    isFlameTongue = item?.name?.toLowerCase().includes("flame tongue");
  }

  // Fallback: check message flavor/content for item name
  if (!isFlameTongue) {
    const flavor = (message.flavor ?? "") + (message.content ?? "");
    isFlameTongue = flavor.toLowerCase().includes("flame tongue");
  }

  if (!isFlameTongue) return;

  // Verify actor actually has the item
  const flameTongue = actor.items.find(
    i => i.name?.toLowerCase().includes("flame tongue") &&
         ["weapon", "equipment"].includes(i.type)
  );
  if (!flameTongue) return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  if (el.querySelector("[data-action='flame-tongue-banner']")) return;

  el.querySelector(".message-content")?.insertAdjacentHTML("beforeend", `
    <div data-action="flame-tongue-banner" style="padding:6px 10px; border-radius:8px; margin:6px 0; text-align:center; font-size:12px;
                background:linear-gradient(135deg, #8b2500, #cc5500); color:white; border:1px solid #ff7733;">
      🔥 <strong>Flame Tongue</strong> — Don't forget +2d6 fire damage while the blade is ignited
    </div>`);
}
// END: FLAME TONGUE MACRO
