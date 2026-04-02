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

let ADAM_DEBUG = false;

const ADAM_HOOK_FLAG = "adamantineArmorHookRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

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
      if (actor.id === attackerActorId) continue;

      const armorName = getAdamantineArmorName(actor);
      if (armorName) results.push({ actor, armorName });
    }
  } else {
    // No target data — check all owned characters (fallback)
    for (const actor of game.actors) {
      if (!actor.isOwner) continue;
      if (actor.type !== "character") continue;
      if (actor.id === attackerActorId) continue;

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
