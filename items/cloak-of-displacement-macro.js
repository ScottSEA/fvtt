/**
 * CLOAK OF DISPLACEMENT MACRO
 *
 * Turn-start whispered reminder that attacks against you have disadvantage,
 * and banner injection on incoming enemy attack rolls.
 *
 * RAW: "While you wear this cloak, creatures have disadvantage on attack rolls
 * against you. If you take damage, the property ceases to function until the
 * start of your next turn. This property is suppressed while you are
 * incapacitated, restrained, or otherwise unable to move."
 *
 * Hooks: updateCombat, dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-ghost";
const CLOAK_HOOK_FLAG = "cloakOfDisplacementHookRegistered";
const CLOAK_TURN_KEY = "_cloakDisplacementLastTurn";

teardown();
register();

function teardown() {
  if (!game[CLOAK_HOOK_FLAG]) return;
  const prev = game[CLOAK_HOOK_FLAG];
  if (prev.combatHookId != null) Hooks.off("updateCombat", prev.combatHookId);
  if (prev.renderHookId != null) Hooks.off("dnd5e.renderChatMessage", prev.renderHookId);
  delete game[CLOAK_TURN_KEY];
  delete game[CLOAK_HOOK_FLAG];
  console.log("Cloak of Displacement macro torn down.");
}

function register() {
  const combatHookId = Hooks.on("updateCombat", onUpdateCombat);
  const renderHookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[CLOAK_HOOK_FLAG] = { combatHookId, renderHookId };
  console.log("Cloak of Displacement macro loaded.");
}

// ─── Turn-Start Reminder ──────────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  if (!("turn" in changed || "round" in changed)) return;
  const combatant = combat.combatant;
  if (!combatant?.isOwner) return;

  const actor = combatant.actor;
  if (!actor?.isOwner) return;

  const cloak = actor.items.find(
    i => i.name?.toLowerCase().includes("cloak of displacement") &&
         ["equipment", "loot"].includes(i.type)
  );
  if (!cloak) return;

  const turnKey = `${combat.id}-${combat.round}-${combat.turn}`;
  if (game[CLOAK_TURN_KEY] === turnKey) return;
  game[CLOAK_TURN_KEY] = turnKey;

  ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div style="padding:8px 12px; border-radius:8px; margin:4px 0; text-align:center; font-size:13px;
                  background:linear-gradient(135deg, #1a3a5c, #2a5a8c); color:white; border:1px solid #4a8abf;">
        <strong>🌀 Cloak of Displacement</strong><br>
        Attacks against you have disadvantage this turn<br>
        <span style="font-size:11px; opacity:0.8;">(resets if you take damage or are restrained)</span>
      </div>`,
    whisper: [game.user.id],
    type: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}

// ─── Incoming Attack Banner ───────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  const rollType = message.flags?.dnd5e?.roll?.type;
  if (rollType !== "attack") return;

  const attackerActorId = message.speaker?.actor;
  const targets = message.flags?.dnd5e?.targets ?? [];
  if (targets.length === 0) return;

  for (const t of targets) {
    try {
      const doc = fromUuidSync(t.uuid);
      if (!doc) continue;
      const actor = doc.actor ?? (doc.documentName === "Actor" ? doc : null);
      if (!actor?.isOwner) continue;
      if (actor.id === attackerActorId) continue;

      const cloak = actor.items.find(
        i => i.name?.toLowerCase().includes("cloak of displacement") &&
             ["equipment", "loot"].includes(i.type)
      );
      if (!cloak) continue;

      const el = html instanceof HTMLElement ? html : html[0] ?? html;
      if (el.querySelector("[data-action='cloak-displacement-banner']")) return;

      el.querySelector(".message-content")?.insertAdjacentHTML("beforeend", `
        <div data-action="cloak-displacement-banner" style="padding:6px 10px; border-radius:8px; margin:6px 0; text-align:center; font-size:12px;
                    background:linear-gradient(135deg, #1a3a5c, #2a5a8c); color:white; border:1px solid #4a8abf;">
          🌀 <strong>Cloak of Displacement Active</strong> — This attack has disadvantage
        </div>`);
      return;
    } catch (err) {
      console.warn("Cloak of Displacement | target resolve error:", err.message);
    }
  }
}
// END: CLOAK OF DISPLACEMENT MACRO
