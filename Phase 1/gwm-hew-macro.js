/**
 * GREAT WEAPON MASTER — HEW MACRO
 *
 * Detects critical hits and kills (reducing to 0 HP) with melee weapons
 * from actors with the Great Weapon Master feat. Injects a prominent
 * "Hew!" banner into the triggering chat message, reminding the player
 * they can make a Bonus Action melee attack with that weapon.
 *
 * Triggers:
 * 1. Critical hit with a melee weapon (renderChatMessage)
 * 2. Reducing a creature to 0 HP with a melee weapon (dnd5e.applyDamage)
 *
 * Per-turn tracking prevents duplicate notifications within the same
 * combat turn. Outside of combat, no restriction is applied.
 */

let HEW_DEBUG = false;

const GWM_FEAT_NAME = "Great Weapon Master";
const GWM_HEW_HOOK_FLAG = "gwmHewHookRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[GWM_HEW_HOOK_FLAG]) return;
  const prev = game[GWM_HEW_HOOK_FLAG];
  if (prev.renderHookId != null) Hooks.off("renderChatMessage", prev.renderHookId);
  if (prev.applyDamageHookId != null) Hooks.off("dnd5e.applyDamage", prev.applyDamageHookId);
  const oldStyle = document.getElementById("gwm-hew-macro-style");
  if (oldStyle) oldStyle.remove();
  console.log("GWM Hew macro torn down.");
}

function register() {
  ensureHewStyles();
  const renderHookId = Hooks.on("renderChatMessage", onRenderChatMessage);
  const applyDamageHookId = Hooks.on("dnd5e.applyDamage", onApplyDamage);
  game[GWM_HEW_HOOK_FLAG] = { renderHookId, applyDamageHookId };
  console.log("GWM Hew macro loaded.");
}

// ─── Hook Handlers ────────────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;

  // Skip if already injected
  if (el.querySelector("[data-gwm-hew-banner]")) return;

  const ctx = analyzeForHew(message, el);
  if (!ctx) return;

  // Always store last melee attack for 0 HP path
  storeMeleeAttack(ctx.actor, ctx.weapon);

  // Only inject Hew banner on critical hits
  if (!ctx.isCritical) return;

  // Per-turn tracking: only trigger once per turn
  if (hasHewedThisTurn()) {
    if (HEW_DEBUG) console.log("GWM Hew: Already triggered this turn, skipping crit banner.");
    return;
  }

  injectHewBanner(el, ctx.weapon.name, "Critical hit");

  // Only mark as used and show toast for fresh messages (not re-renders of old ones)
  if (isRecentMessage(message)) {
    markHewUsed();
    ui.notifications.info(`⚔️ Hew! Critical hit with ${ctx.weapon.name} — Bonus Action attack available!`);
  }
}

function onApplyDamage(actor, amount, options) {
  // Only trigger on actual damage that reduces to 0 HP
  if (amount <= 0) return;
  if (actor.system.attributes.hp.value > 0) return;

  // Find the most recent current melee attack from a GWM actor
  const attackMap = game._gwmHewLastMeleeAttack;
  if (!attackMap?.size) return;

  let lastAttack = null;
  for (const [attackerId, attack] of attackMap) {
    if (attackerId === actor.id) continue; // Skip self-damage
    if (!isLastAttackCurrent(attack)) continue;
    if (!lastAttack || attack.timestamp > lastAttack.timestamp) lastAttack = attack;
  }
  if (!lastAttack) return;

  // Resolve the attacking actor — only process on the attacker's owner
  const attackingActor = game.actors.get(lastAttack.actorId);
  if (!attackingActor?.isOwner) return;

  // Per-turn tracking
  if (hasHewedThisTurn()) {
    if (HEW_DEBUG) console.log("GWM Hew: Already triggered this turn, skipping 0 HP notification.");
    return;
  }

  markHewUsed();
  postHewChatMessage(attackingActor, lastAttack.weaponName, `Reduced ${actor.name} to 0 HP`);
}

// ─── Message Analysis ─────────────────────────────────────────────────────────

function analyzeForHew(message, el) {
  if (!isAttackRollMessage(message)) return null;

  const actor = resolveActorFromMessage(message);
  if (!actor) return null;
  if (!actor.isOwner) return null;
  if (!actorHasGWM(actor)) return null;

  const weapon = resolveWeaponFromMessage(message, actor);
  if (!weapon) return null;
  if (!isMeleeWeapon(weapon, message)) return null;

  const isCritical = detectCritical(message, el);

  if (HEW_DEBUG) {
    console.log(`GWM Hew: Attack detected — ${actor.name} with ${weapon.name}, critical: ${isCritical}`);
  }

  return { actor, weapon, isCritical };
}

// ─── Detection Helpers ────────────────────────────────────────────────────────

function isAttackRollMessage(message) {
  return message.rolls?.some(r => r.options?.type === "attack") ||
    message.flags?.dnd5e?.roll?.type === "attack" ||
    message.flags?.dnd5e?.activity?.type === "attack";
}

function actorHasGWM(actor) {
  return actor.items?.some(i =>
    i.type === "feat" && i.name === GWM_FEAT_NAME
  ) ?? false;
}

function isMeleeWeapon(item, message) {
  if (!item) return false;

  // dnd5e v4/v5: weapon type classification (simpleM, martialM = melee)
  const weaponType = item.system?.type?.value ?? "";
  if (weaponType.endsWith("M")) return true;

  // Legacy: actionType check
  if (item.system?.actionType === "mwak") return true;

  // Fallback: attack mode from message flags (twoHanded, oneHanded = melee)
  const attackMode = message?.flags?.dnd5e?.roll?.attackMode;
  if (attackMode === "twoHanded" || attackMode === "oneHanded") return true;

  return false;
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

function resolveActorFromMessage(message) {
  return message.actor ||
    (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null) ||
    (message.speaker?.token ? canvas?.tokens?.get(message.speaker.token)?.actor : null) ||
    null;
}

function resolveWeaponFromMessage(message, actor) {
  if (!actor) return null;

  // Primary: item ID from message flags
  const itemId = message.flags?.dnd5e?.item?.id;
  if (itemId) {
    const item = actor.items.get(itemId);
    if (item?.type === "weapon") return item;
  }

  // Fallback: match weapon name from flavor text
  const flavor = message.flavor ?? "";
  if (flavor) {
    for (const item of actor.items) {
      if (item.type === "weapon" && flavor.includes(item.name)) return item;
    }
  }

  return null;
}

// ─── Melee Attack Tracking (for 0 HP path) ────────────────────────────────────

function storeMeleeAttack(actor, weapon) {
  if (!game._gwmHewLastMeleeAttack) game._gwmHewLastMeleeAttack = new Map();
  game._gwmHewLastMeleeAttack.set(actor.id, {
    actorId: actor.id,
    weaponName: weapon.name,
    timestamp: Date.now(),
    combatId: game.combat?.id,
    round: game.combat?.round,
    turn: game.combat?.turn,
  });

  if (HEW_DEBUG) {
    console.log(`GWM Hew: Stored melee attack — ${actor.name} with ${weapon.name}`);
  }
}

function isLastAttackCurrent(lastAttack) {
  const combat = game.combat;
  if (combat?.started) {
    // Must be same combat turn
    return lastAttack.combatId === combat.id &&
      lastAttack.round === combat.round &&
      lastAttack.turn === combat.turn;
  }
  // No active combat: use 5-minute timeout
  return (Date.now() - lastAttack.timestamp) < 300000;
}

// ─── Turn Tracking ────────────────────────────────────────────────────────────

function hasHewedThisTurn() {
  const combat = game.combat;
  if (!combat?.started) return false; // No restriction outside combat
  const last = game._gwmHewLastUsed;
  if (!last) return false;
  return last.combatId === combat.id &&
    last.round === combat.round &&
    last.turn === combat.turn;
}

function markHewUsed() {
  const combat = game.combat;
  if (!combat?.started) return;
  game._gwmHewLastUsed = {
    combatId: combat.id,
    round: combat.round,
    turn: combat.turn,
  };
}

// ─── Notification ─────────────────────────────────────────────────────────────

function injectHewBanner(el, weaponName, reason) {
  const banner = `<div class="gwm-hew-banner" data-gwm-hew-banner="true">` +
    `<div class="gwm-hew-banner-icon">⚔️</div>` +
    `<div class="gwm-hew-banner-text">` +
    `<strong>Hew!</strong> ${reason} with <em>${weaponName}</em>` +
    `<br>Make a melee attack as a <strong>Bonus Action</strong>!` +
    `</div></div>`;

  const target =
    el.querySelector(".card-buttons") ??
    el.querySelector(".message-content .dice-roll") ??
    el.querySelector(".message-content") ??
    el;

  // Place banner after dice roll, before buttons, or at end of content
  const position = target.matches?.(".card-buttons") ? "beforebegin"
    : target === el ? "beforeend"
    : "afterend";

  target.insertAdjacentHTML(position, banner);
}

async function postHewChatMessage(actor, weaponName, reason) {
  const content = `<div class="gwm-hew-banner" data-gwm-hew-banner="true">` +
    `<div class="gwm-hew-banner-icon">⚔️</div>` +
    `<div class="gwm-hew-banner-text">` +
    `<strong>Hew!</strong> ${reason} with <em>${weaponName}</em>` +
    `<br>Make a melee attack as a <strong>Bonus Action</strong>!` +
    `</div></div>`;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER,
    whisper: [game.user.id],
  });

  ui.notifications.info(`⚔️ Hew! ${reason} with ${weaponName} — Bonus Action attack available!`);
}

function isRecentMessage(message) {
  if (!message.timestamp) return true;
  return (Date.now() - message.timestamp) < 10000;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function ensureHewStyles() {
  if (document.getElementById("gwm-hew-macro-style")) return;

  const style = document.createElement("style");
  style.id = "gwm-hew-macro-style";
  style.innerHTML = `
    .gwm-hew-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #5c1a1a 0%, #8b2500 100%);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      margin: 8px 0;
      border: 2px solid #ff4500;
      box-shadow: 0 2px 8px rgba(139, 37, 0, 0.4);
      animation: gwm-hew-pulse 2s ease-in-out 3;
    }

    .gwm-hew-banner-icon {
      font-size: 1.8em;
      line-height: 1;
      flex-shrink: 0;
    }

    .gwm-hew-banner-text {
      font-size: 0.9em;
      line-height: 1.4;
    }

    .gwm-hew-banner-text strong {
      color: #ffcc00;
    }

    .gwm-hew-banner-text em {
      color: #ffa500;
    }

    @keyframes gwm-hew-pulse {
      0%, 100% {
        box-shadow: 0 2px 8px rgba(139, 37, 0, 0.4);
      }
      50% {
        box-shadow: 0 2px 16px rgba(255, 69, 0, 0.7);
      }
    }
  `;
  document.head.appendChild(style);
}
