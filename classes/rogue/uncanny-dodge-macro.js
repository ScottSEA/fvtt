/**
 * UNCANNY DODGE REMINDER MACRO
 *
 * Injects a reminder banner when an incoming attack hits a Rogue who has
 * the Uncanny Dodge feature, reminding about the Reaction to halve damage.
 *
 * RAW (2024 Rogue): "When an attacker that you can see hits you with an
 * attack roll, you can use your Reaction to halve the attack's damage
 * against you (round down)."
 *
 * Hooks: dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-shield-halved";

const UD_HOOK_FLAG = "uncannyDodgeHookRegistered";
const UD_FEAT_NAME = "Uncanny Dodge";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[UD_HOOK_FLAG]) return;
  const prev = game[UD_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  delete game[UD_HOOK_FLAG];
  console.log("Uncanny Dodge macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[UD_HOOK_FLAG] = { hookId };
  console.log("Uncanny Dodge macro loaded.");
}

// ─── Chat Message Hook ──────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  // Only process attack rolls
  const rollType = message.flags?.dnd5e?.roll?.type;
  if (rollType !== "attack") return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;

  // Skip if already injected
  if (el.querySelector("[data-action='uncanny-dodge-reminder']")) return;

  // Get the attacker's actor ID — skip if this is our own attack
  const attackerActorId = message.speaker?.actor;

  // Check targets for owned Rogues that were hit
  const targets = message.flags?.dnd5e?.targets ?? [];
  if (targets.length === 0) return;

  const rollTotal = message.rolls?.[0]?.total;
  if (rollTotal == null) return;

  for (const t of targets) {
    const actor = resolveActorFromTarget(t);
    if (!actor) continue;
    if (!actor.isOwner) continue;

    // Don't remind on the actor's own attacks
    if (actor.id === attackerActorId) continue;

    // Must have Uncanny Dodge feat
    const feat = actor.items.find(
      i => i.name === UD_FEAT_NAME && i.type === "feat"
    );
    if (!feat) continue;

    // Check if the attack hit (roll total >= target AC)
    const targetAC = t.ac ?? actor.system?.attributes?.ac?.value;
    if (targetAC == null) continue;
    if (rollTotal < targetAC) continue;

    // Inject banner
    const container = el.querySelector(".message-content");
    if (!container) continue;

    const bannerHtml =
      `<div data-action="uncanny-dodge-reminder"` +
      ` style="border:2px solid #8e44ad; border-radius:8px; padding:8px;` +
      ` background:linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 100%);` +
      ` text-align:center; margin-top:8px;">` +
      `<h2 style="margin:0 0 4px; font-size:15px; font-weight:bold; color:#c084fc;">` +
      `🛡️ Uncanny Dodge</h2>` +
      `<p style="margin:4px 0; color:#d4aaff;">` +
      `<strong>${actor.name}</strong> — Use Reaction to halve damage from this attack</p>` +
      `</div>`;

    container.insertAdjacentHTML("beforeend", bannerHtml);
    // Only one banner per message even with multiple qualifying targets
    break;
  }
}

// ─── Target Resolution ───────────────────────────────────────────────────────

function resolveActorFromTarget(target) {
  try {
    const doc = fromUuidSync(target.uuid);
    if (!doc) return null;
    return doc.actor ?? (doc.documentName === "Actor" ? doc : null);
  } catch {
    return null;
  }
}
// END: UNCANNY DODGE REMINDER MACRO
