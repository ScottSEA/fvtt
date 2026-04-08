/**
 * BATTERING ROOTS MACRO
 *
 * World Tree Barbarian 10 feature. While raging, when you hit with a melee
 * weapon that has the Heavy or Versatile property, you can activate one of
 * the weapon mastery properties Push or Topple (regardless of the weapon's
 * actual mastery) as part of the Battering Roots feature.
 *
 * Injects "🌳 Push 10 ft" and "🌳 Topple (STR Save)" buttons on eligible
 * attack hit messages. Once per turn while in combat.
 *
 * Push: Push the target 10 ft straight away.
 * Topple: Target must succeed on a STR save (DC = 8 + prof + STR mod)
 *         or be knocked prone.
 *
 * Hooks: dnd5e.renderChatMessage, click delegation
 */

let BR_DEBUG = false;

const BR_HOOK_FLAG = "batteringRootsHookRegistered";
const BR_FEAT_NAME = "Battering Roots";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[BR_HOOK_FLAG]) return;
  const prev = game[BR_HOOK_FLAG];
  if (prev.renderHookId != null) Hooks.off("dnd5e.renderChatMessage", prev.renderHookId);
  if (prev.clickHandler) document.removeEventListener("click", prev.clickHandler);
  const oldStyle = document.getElementById("battering-roots-macro-style");
  if (oldStyle) oldStyle.remove();
  delete game[BR_HOOK_FLAG];
  console.log("Battering Roots macro torn down.");
}

function register() {
  ensureBRStyles();
  const renderHookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  const clickHandler = onDocumentClick;
  document.addEventListener("click", clickHandler);
  game[BR_HOOK_FLAG] = { renderHookId, clickHandler, usedThisTurn: null };
  console.log("Battering Roots macro loaded.");
}

// ─── Hook & Event Handlers ───────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  if (el.querySelector("[data-action='br-push']")) return; // already injected

  const ctx = analyzeForBatteringRoots(message);
  if (!ctx) return;

  if (BR_DEBUG) console.log("Battering Roots | Eligible melee hit detected:", message.id);

  const buttonHtml = createBRButtons(message, ctx);
  injectBRButtons(el, buttonHtml);
}

function onDocumentClick(event) {
  const pushBtn = event.target.closest("[data-action='br-push']");
  if (pushBtn) { handlePush(event, pushBtn); return; }

  const toppleBtn = event.target.closest("[data-action='br-topple']");
  if (toppleBtn) { handleTopple(event, toppleBtn); return; }
}

// ─── Message Analysis ────────────────────────────────────────────────────────

function analyzeForBatteringRoots(message) {
  // Must be an attack roll
  const rollType = message.flags?.dnd5e?.roll?.type;
  if (rollType !== "attack") return null;

  const actor = resolveActorFromMessage(message);
  if (!actor || !actor.isOwner) return null;

  // Must be raging
  if (!isActorRaging(actor)) {
    if (BR_DEBUG) console.log("Battering Roots | Actor not raging.");
    return null;
  }

  // Must have the Battering Roots feat
  if (!hasFeature(actor, BR_FEAT_NAME)) {
    if (BR_DEBUG) console.log("Battering Roots | Actor lacks feat.");
    return null;
  }

  // Must be a melee attack with a Heavy or Versatile weapon
  const item = resolveItemFromMessage(message, actor);
  if (!item) {
    if (BR_DEBUG) console.log("Battering Roots | Could not resolve item.");
    return null;
  }

  if (!isMeleeWeapon(item, message)) {
    if (BR_DEBUG) console.log("Battering Roots | Not a melee weapon attack.");
    return null;
  }

  if (!isHeavyOrVersatile(item)) {
    if (BR_DEBUG) console.log("Battering Roots | Weapon is not Heavy or Versatile:", item.name);
    return null;
  }

  return { actor, item };
}

// ─── Actor & Item Resolution ─────────────────────────────────────────────────

function resolveActorFromMessage(message) {
  return message.actor
    || (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null)
    || (message.speaker?.token ? canvas?.tokens?.get(message.speaker.token)?.actor : null)
    || null;
}

function resolveItemFromMessage(message, actor) {
  const itemId = message.flags?.dnd5e?.item?.id;
  if (itemId && actor) {
    const item = actor.items.get(itemId);
    if (item) return item;
  }
  const itemName = message.flags?.dnd5e?.item?.name;
  if (itemName && actor) return actor.items.getName(itemName);
  return null;
}

// ─── Condition Checks ────────────────────────────────────────────────────────

function isActorRaging(actor) {
  if (!actor) return false;
  if (actor.statuses?.has("raging")) return true;
  const effects = actor.appliedEffects ?? actor.effects;
  return effects?.some(e => e.name === "Rage" && !e.disabled) ?? false;
}

function hasFeature(actor, name) {
  return actor.items?.some(i => i.name === name && i.type === "feat") ?? false;
}

function isMeleeWeapon(item, message) {
  if (item.system?.actionType === "mwak") return true;
  // Check attackMode from flags — exclude ranged/thrown
  const attackMode = message.flags?.dnd5e?.roll?.attackMode;
  if (attackMode && ["ranged", "thrown"].includes(attackMode)) return false;
  // Weapon type check
  if (item.type === "weapon" && item.system?.type?.value === "simpleM") return true;
  if (item.type === "weapon" && item.system?.type?.value === "martialM") return true;
  return false;
}

function isHeavyOrVersatile(item) {
  const props = item.system?.properties;
  if (!props) return false;
  // properties is a Set in dnd5e v5
  if (typeof props.has === "function") {
    return props.has("hvy") || props.has("ver");
  }
  // Fallback: array or iterable
  if (Array.isArray(props)) {
    return props.includes("hvy") || props.includes("ver");
  }
  return false;
}

// ─── Per-Turn Tracking ───────────────────────────────────────────────────────

function hasUsedThisTurn() {
  const combat = game.combat;
  if (!combat?.started) return false;
  const last = game[BR_HOOK_FLAG]?.usedThisTurn;
  if (!last) return false;
  return last.combatId === combat.id
    && last.round === combat.round
    && last.turn === combat.turn;
}

function markUsedThisTurn() {
  const combat = game.combat;
  if (!game[BR_HOOK_FLAG]) return;
  game[BR_HOOK_FLAG].usedThisTurn = {
    combatId: combat?.id,
    round: combat?.round,
    turn: combat?.turn,
  };
}

// ─── Button Handlers ─────────────────────────────────────────────────────────

async function handlePush(event, btn) {
  event.preventDefault();

  if (hasUsedThisTurn()) {
    ui.notifications.warn("Battering Roots: Already used this turn.");
    return;
  }

  const actor = resolveActorFromBtn(btn);
  if (!actor) return;

  // Disable both buttons on this message
  disableSiblingButtons(btn);
  markUsedThisTurn();

  const content = `
    <div class="br-result-card">
      <h4 class="br-result-title">🌳 Battering Roots — Push</h4>
      <p class="br-result-desc">
        Push the target up to <strong>10 feet</strong> straight away from you.
      </p>
    </div>`;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER,
  });

  if (BR_DEBUG) console.log("Battering Roots | Push activated.");
}

async function handleTopple(event, btn) {
  event.preventDefault();

  if (hasUsedThisTurn()) {
    ui.notifications.warn("Battering Roots: Already used this turn.");
    return;
  }

  const actor = resolveActorFromBtn(btn);
  if (!actor) return;

  // Disable both buttons on this message
  disableSiblingButtons(btn);
  markUsedThisTurn();

  const prof = actor.system?.attributes?.prof ?? 0;
  const strMod = actor.system?.abilities?.str?.mod ?? 0;
  const saveDC = 8 + prof + strMod;

  const content = `
    <div class="br-result-card">
      <h4 class="br-result-title">🌳 Battering Roots — Topple</h4>
      <p class="br-result-desc">
        The target must make a <strong>STR Save (DC ${saveDC})</strong>
        or be knocked <strong>prone</strong>.
      </p>
      <p class="br-dc-breakdown">DC = 8 + ${prof} (prof) + ${strMod} (STR mod)</p>
    </div>`;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER,
  });

  if (BR_DEBUG) console.log(`Battering Roots | Topple activated. DC ${saveDC}`);
}

// ─── Button Utilities ────────────────────────────────────────────────────────

function resolveActorFromBtn(btn) {
  const actorUuid = btn.dataset.actorUuid;
  if (actorUuid) {
    const actor = fromUuidSync(actorUuid);
    if (actor) return actor;
  }
  const messageId = btn.dataset.messageId;
  const message = game.messages.get(messageId);
  if (message) return resolveActorFromMessage(message);
  return null;
}

function disableSiblingButtons(btn) {
  const container = btn.closest(".br-btn-container");
  if (!container) { btn.disabled = true; return; }
  container.querySelectorAll("button").forEach(b => {
    b.disabled = true;
    b.classList.add("br-btn-used");
  });
}

// ─── HTML Builders ───────────────────────────────────────────────────────────

function createBRButtons(message, ctx) {
  const actorUuid = ctx.actor.uuid;
  return `
    <div class="br-btn-container">
      <button type="button" class="btn btn-sm br-btn br-push-btn"
        data-action="br-push"
        data-message-id="${message.id}"
        data-actor-uuid="${actorUuid}"
        title="Battering Roots: Push the target 10 ft away">
        🌳 Push 10 ft
      </button>
      <button type="button" class="btn btn-sm br-btn br-topple-btn"
        data-action="br-topple"
        data-message-id="${message.id}"
        data-actor-uuid="${actorUuid}"
        title="Battering Roots: Target makes STR save or falls prone">
        🌳 Topple (STR Save)
      </button>
    </div>`;
}

function injectBRButtons(el, buttonHtml) {
  const target =
    el.querySelector(".card-buttons")
    ?? el.querySelector(".message-content .dice-roll")
    ?? el;

  const position = target.matches?.(".card-buttons") ? "beforeend"
    : target === el ? "beforeend"
    : "afterend";

  target.insertAdjacentHTML(position, buttonHtml);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function ensureBRStyles() {
  if (document.getElementById("battering-roots-macro-style")) return;

  const style = document.createElement("style");
  style.id = "battering-roots-macro-style";
  style.innerHTML = `
    .br-btn-container {
      display: flex;
      gap: 4px;
      margin-top: 5px;
    }

    .br-btn {
      color: white;
      border: none;
      flex: 1;
      font-size: 12px;
      padding: 4px 8px;
      cursor: pointer;
    }

    .br-push-btn {
      background-color: #2d5a1d;
    }

    .br-push-btn:hover:not(:disabled) {
      background-color: #3a7a2a;
    }

    .br-topple-btn {
      background-color: #1a3a0a;
    }

    .br-topple-btn:hover:not(:disabled) {
      background-color: #2d5a1d;
    }

    .br-btn:disabled {
      background-color: #777;
      color: #ccc;
      cursor: default;
    }

    .br-btn-used:disabled {
      background-color: #2d5a1d;
      color: #aaddaa;
    }

    .br-result-card {
      padding-left: 10px;
      margin: 10px 0;
      border-left: 4px solid #2d5a1d;
    }

    .br-result-title {
      color: #2d5a1d;
      margin: 0 0 4px;
      font-size: 1.1em;
    }

    .br-result-desc {
      margin: 0;
      font-size: 0.9em;
    }

    .br-dc-breakdown {
      margin: 4px 0 0;
      font-size: 0.8em;
      color: #888;
      font-style: italic;
    }
  `;
  document.head.appendChild(style);
}
// END: BATTERING ROOTS MACRO
