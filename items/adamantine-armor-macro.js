/**
 * ADAMANTINE ARMOR REMINDER MACRO
 *
 * When an incoming attack roll against the character is a critical hit,
 * posts a whispered reminder that Adamantine Armor reduces it to a normal hit.
 *
 * NOTE: dnd5e v5 may already handle adamantine crit negation automatically
 * via the item's ActiveEffect. This macro serves as a visible confirmation
 * that the effect triggered — it does NOT modify the roll itself.
 *
 * Detection:
 *   - Watches renderChatMessage for attack rolls that are critical hits
 *   - Checks if any targeted actor (owned by the current user) has an
 *     equipped item with "adamantine" in the name (type "equipment") or
 *     an armor item whose properties include "adamantine"
 *   - Posts a whispered chat reminder
 *
 * Hooks: dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-shield-halved";
let ADAM_DEBUG = false;

const ADAM_HOOK_FLAG = "adamantineArmorHookRegistered";

const ADAM_ICON_SVG = `<svg fill="#FFF" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" stroke="#FFF"><g stroke-width="0"></g><g stroke-linecap="round" stroke-linejoin="round"></g><g><path d="M26.905 9.991l1.082 0.249c0.655-2.851 0.948-5.73 0.875-8.6l-7.143 0v1.064h-2.989v-1.562h-5.225v1.562h-2.973v-1.064l-7.361-0c-0.074 2.869 0.224 5.751 0.875 8.6l1.082-0.246c0.261 1.227 0.597 2.449 1.006 3.663l-2.548 0.384 3.937 8.298 1.872-1.679c0.628 1.045 1.315 2.079 2.062 3.097l2.21-1.636-3.097 2.296c1.571 2.207 3.394 4.349 5.466 6.414 2.066-2.066 3.859-4.201 5.43-6.414l-0.894-0.66c0.75-1.024 1.44-2.065 2.071-3.117l1.895 1.699 3.937-8.298-2.578-0.389c0.411-1.213 0.748-2.434 1.010-3.661zM10.815 8.232h10.431c0.105 4.394-1.654 8.271-5.215 12.060-3.583-3.797-5.322-7.669-5.215-12.060zM18.403 22.156l0 0c-0.731 0.899-1.509 1.764-2.369 2.624 0 0-0-0-0-0 0.859-0.86 1.637-1.724 2.369-2.624z"></path></g></svg>`;
const ADAM_ICON_URI = `data:image/svg+xml;base64,${btoa(ADAM_ICON_SVG)}`;

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();
setMacroIcon();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[ADAM_HOOK_FLAG]) return;
  const prev = game[ADAM_HOOK_FLAG];
  if (prev.renderHookId != null) Hooks.off("dnd5e.renderChatMessage", prev.renderHookId);
  console.log("Adamantine Armor macro torn down.");
}

function register() {
  const renderHookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[ADAM_HOOK_FLAG] = { renderHookId };
  console.log("Adamantine Armor macro loaded.");
}

// ─── Hook Handler ─────────────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  if (!isAttackRollMessage(message)) return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  if (!detectCritical(message, el)) return;

  const attackerActorId = message.speaker?.actor;
  const targets = message.flags?.dnd5e?.targets ?? [];

  // Find owned actors with adamantine armor among targets
  const adamantineActors = findTargetedAdamantineActors(targets, attackerActorId);
  if (adamantineActors.length === 0) return;

  for (const { actor, armorName } of adamantineActors) {
    if (ADAM_DEBUG) console.log("Adamantine Armor | Crit detected against", actor.name, "with", armorName);
    postReminder(actor, armorName);
  }
}

// ─── Detection Helpers ────────────────────────────────────────────────────────

function isAttackRollMessage(message) {
  return message.rolls?.some(r => r.options?.type === "attack") ||
    message.flags?.dnd5e?.roll?.type === "attack" ||
    message.flags?.dnd5e?.activity?.type === "attack";
}

function detectCritical(message, el) {
  // CSS class on the dice total (dnd5e renders this)
  if (el.querySelector(".dice-total.critical")) return true;

  // D20Roll.isCritical property
  if (message.rolls?.some(r => r.isCritical)) return true;

  // Flags set by dnd5e
  if (message.flags?.dnd5e?.roll?.isCritical) return true;

  // Raw d20 result vs critical threshold
  const roll = message.rolls?.[0];
  if (roll) {
    const d20Term = roll.terms?.find(t => t.faces === 20);
    if (d20Term) {
      const threshold = roll.options?.criticalSuccess ?? roll.options?.critical ?? 20;
      const result = d20Term.results?.[0]?.result;
      if (result != null && result >= threshold) return true;
    }
  }

  return false;
}

// ─── Target & Armor Detection ─────────────────────────────────────────────────

/**
 * Find all owned actors among the message's targets that have adamantine armor equipped.
 */
function findTargetedAdamantineActors(targets, attackerActorId) {
  const results = [];

  if (targets.length > 0) {
    // Message has explicit target data — only check those actors
    for (const t of targets) {
      const actor = resolveActorFromTarget(t);
      if (!actor) continue;
      if (!actor.isOwner) continue;

      const armorName = getAdamantineArmorName(actor);
      if (armorName) results.push({ actor, armorName });
    }
  } else {
    // No target data — check all owned characters (fallback)
    for (const actor of game.actors) {
      if (!actor.isOwner) continue;
      if (actor.type !== "character") continue;

      const armorName = getAdamantineArmorName(actor);
      if (armorName) results.push({ actor, armorName });
    }
  }

  return results;
}

/**
 * Resolve an actor from a target entry ({ uuid, ac }).
 */
function resolveActorFromTarget(target) {
  try {
    const doc = fromUuidSync(target.uuid);
    if (!doc) return null;
    return doc.actor ?? (doc.documentName === "Actor" ? doc : null);
  } catch {
    return null;
  }
}

/**
 * Check if actor has adamantine armor equipped. Returns the item name or null.
 *
 * Checks two paths:
 *   1. Equipment items with "adamantine" in the name that are equipped
 *   2. Armor items whose system.armor.properties include "adamantine"
 */
function getAdamantineArmorName(actor) {
  if (!actor?.items) return null;

  for (const item of actor.items) {
    if (!item.system?.equipped) continue;

    // Check: equipment with "adamantine" in the name
    if (item.type === "equipment" && item.name.toLowerCase().includes("adamantine")) {
      return item.name;
    }

    // Check: armor properties set includes "adamantine"
    const props = item.system?.armor?.properties ?? item.system?.properties;
    if (props) {
      const propSet = props instanceof Set ? props : (Array.isArray(props) ? props : []);
      if ((propSet instanceof Set && propSet.has("adamantine")) ||
          (Array.isArray(propSet) && propSet.includes("adamantine"))) {
        return item.name;
      }
    }
  }

  return null;
}

// ─── Chat Reminder ────────────────────────────────────────────────────────────

function postReminder(actor, armorName) {
  const content = `
    <div style="color:white; padding:8px 12px; border-radius:4px; margin:4px 0; text-align:center; font-size:13px; background:#3a3a3a; border:1px solid #666;">
      <strong>🛡️ Adamantine Armor</strong><br>
      Critical hit reduced to a normal hit!<br>
      <span style="font-size:11px; opacity:0.8;">${armorName} — ${actor.name}</span>
    </div>`;

  ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    whisper: [game.user.id],
    type: CONST.CHAT_MESSAGE_STYLES.OTHER,
  });
}

// ─── Self-Setting Icon ───────────────────────────────────────────────────────

function setMacroIcon() {
  const self = game.macros.find(m => m.name.startsWith("scottb") && m.name.toLowerCase().includes("adamantine"));
  if (self && self.img !== ADAM_ICON_URI) {
    self.update({ img: ADAM_ICON_URI });
    if (ADAM_DEBUG) console.log("Adamantine Armor | Macro icon updated.");
  }
}
// END: ADAMANTINE ARMOR REMINDER MACRO
