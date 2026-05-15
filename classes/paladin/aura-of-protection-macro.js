/**
 * AURA OF PROTECTION REMINDER MACRO
 *
 * Injects a reminder banner into saving throw chat messages for any owned
 * character, reminding the player about the Paladin's Aura of Protection
 * bonus if the Paladin has that feature.
 *
 * RAW (2024 Paladin): "Whenever you or a creature within 10 feet of you
 * must make a saving throw, the creature gains a bonus to the saving throw
 * equal to your Charisma modifier (minimum bonus of +1). You must be
 * conscious to grant this bonus."
 *
 * Since we cannot validate proximity (tokens may not be measured), this is
 * a reminder only. Shows the Paladin's CHA modifier so the player knows
 * the potential bonus.
 *
 * Hooks: dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-shield-heart";

const AOP_HOOK_FLAG = "auraOfProtectionHookRegistered";
const AOP_FEAT_NAME = "Aura of Protection";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[AOP_HOOK_FLAG]) return;
  const prev = game[AOP_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  delete game[AOP_HOOK_FLAG];
  console.log("Aura of Protection macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[AOP_HOOK_FLAG] = { hookId };
  console.log("Aura of Protection macro loaded.");
}

// ─── Chat Message Hook ──────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  // Only process saving throw rolls
  const rollType = message.flags?.dnd5e?.roll?.type;
  if (rollType !== "save") return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;

  // Skip if already injected
  if (el.querySelector("[data-action='aura-of-protection']")) return;

  // Resolve the actor who made the save
  const actorId = message.speaker?.actor;
  if (!actorId) return;
  const savingActor = game.actors.get(actorId);
  if (!savingActor?.isOwner) return;

  // Find a Paladin with Aura of Protection among all owned actors
  const paladin = findPaladinWithAura();
  if (!paladin) return;

  const chaMod = Math.max(paladin.actor.system?.abilities?.cha?.mod ?? 0, 1);
  const paladinName = paladin.actor.name;

  const container = el.querySelector(".message-content");
  if (!container) return;

  const bannerHtml =
    `<div data-action="aura-of-protection"
          style="border:2px solid #d4a017; border-radius:8px; padding:8px;
                 background:linear-gradient(135deg, #2a2a0a 0%, #4c4420 100%);
                 text-align:center; margin-top:8px;">
       <h3 style="margin:0 0 4px; color:#ffd700;">🛡️ Aura of Protection</h3>
       <p style="margin:4px 0; color:#e8c860;">
         Don't forget <strong>+${chaMod}</strong> bonus to this save
         if <strong>${paladinName}</strong> is within 10 ft</p>
       <p style="margin:2px 0 0; color:#aa8833; font-size:12px;">
         (${paladinName}'s CHA modifier${chaMod === 1 ? ", minimum +1" : ""})</p>
     </div>`;

  container.insertAdjacentHTML("beforeend", bannerHtml);
}

// ─── Paladin Finder ─────────────────────────────────────────────────────────

function findPaladinWithAura() {
  // Search all owned actors for a Paladin with the Aura of Protection feat
  for (const actor of game.actors) {
    if (!actor.isOwner) continue;
    if (actor.type !== "character") continue;

    const hasAura = actor.items.find(
      i => i.name === AOP_FEAT_NAME && i.type === "feat"
    );
    if (!hasAura) continue;

    return { actor, feat: hasAura };
  }
  return null;
}

// END: AURA OF PROTECTION REMINDER MACRO
