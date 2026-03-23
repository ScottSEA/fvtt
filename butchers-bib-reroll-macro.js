/**
 * BUTCHER'S BIB DAMAGE REROLL MACRO
 *
 * Injects a "Reroll Damage" button into melee weapon damage roll messages
 * when the actor has an equipped Butcher's Bib. Once per turn, the weapon's
 * damage dice can be rerolled — the second result must be kept.
 */

const BUTCHERS_BIB_ITEM_NAME = "Butcher's Bib";
const BUTCHERS_BIB_HOOK_FLAG = "butchersBibHookRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[BUTCHERS_BIB_HOOK_FLAG]) return;
  const prev = game[BUTCHERS_BIB_HOOK_FLAG];
  if (prev.renderHookId != null) Hooks.off("renderChatMessage", prev.renderHookId);
  if (prev.clickHandler) document.removeEventListener("click", prev.clickHandler);
  const oldStyle = document.getElementById("butchers-bib-macro-style");
  if (oldStyle) oldStyle.remove();
}

function register() {
  ensureButchersBibStyles();
  const renderHookId = Hooks.on("renderChatMessage", onRenderChatMessage);
  const clickHandler = onDocumentClick;
  document.addEventListener("click", clickHandler);
  game[BUTCHERS_BIB_HOOK_FLAG] = { renderHookId, clickHandler };
}

// ─── Hook & Event Handlers ───────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  if (el.querySelector("[data-action='butchers-bib-reroll']")) return;

  const ctx = analyzeForReroll(message, el);
  if (!ctx) return;

  const buttonHtml = createRerollButton(message, ctx.usedThisTurn);
  injectRerollButton(el, buttonHtml);
}

async function onDocumentClick(event) {
  const btn = event.target.closest("[data-action='butchers-bib-reroll']");
  if (btn) await handleReroll(event, btn);
}

async function handleReroll(event, btn) {
  event.preventDefault();

  const intent = resolveRerollIntent(btn);
  if (!intent) return;

  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-dice"></i> Rerolled`;

  const reroll = await executeReroll(intent.originalRoll, intent.actor);
  const content = createRerollResultContent(intent.originalTotal, reroll.total);
  await sendRerollMessage(intent.actor, reroll, content);
  markRerollUsed();
}

function resolveRerollIntent(btn) {
  const message = game.messages.get(btn.dataset.messageId);
  if (!message) return null;

  const actor = resolveActorFromMessage(message);
  if (!actor) {
    ui.notifications.error("Butcher's Bib: Unable to determine actor.");
    return null;
  }

  if (hasUsedRerollThisTurn()) {
    ui.notifications.warn("Butcher's Bib: Already used reroll this turn!");
    return null;
  }

  const originalRoll = message.rolls?.[0];
  if (!originalRoll) return null;

  return {
    actor,
    message,
    originalRoll,
    originalTotal: originalRoll.total,
  };
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function ensureButchersBibStyles() {
  if (document.getElementById("butchers-bib-macro-style")) return;

  const style = document.createElement("style");
  style.id = "butchers-bib-macro-style";
  style.innerHTML = `
    .butchers-bib-reroll-btn {
      background-color: #4a0e0e;
      color: white;
      margin-top: 5px;
      width: 100%;
      border: none;
    }

    .butchers-bib-reroll-btn:disabled {
      background-color: #777;
      color: white;
    }

    .butchers-bib-reroll-card {
      padding-left: 10px;
      margin: 10px 0;
      border-left: 4px solid #4a0e0e;
    }

    .butchers-bib-title {
      color: #4a0e0e;
    }

    .butchers-bib-total {
      color: #4a0e0e;
      font-size: 2em;
      font-weight: bold;
    }

    .butchers-bib-total-label {
      font-size: 1.1em;
      font-weight: bold;
    }
  `;
  document.head.appendChild(style);
}

// ─── Message Detection ───────────────────────────────────────────────────────

function analyzeForReroll(message, el) {
  const actor = resolveActorFromMessage(message);
  if (!actor) return null;
  if (!isMeleeDamageMessage(message, actor)) return null;
  if (!actorHasEquippedBib(actor)) return null;

  return {
    actor,
    usedThisTurn: hasUsedRerollThisTurn(),
  };
}

function resolveActorFromMessage(message) {
  return message.actor ||
    (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null) ||
    (message.speaker?.token ? canvas?.tokens?.get(message.speaker.token)?.actor : null) ||
    null;
}

function isMeleeDamageMessage(message, actor) {
  const isDamage = message.rolls?.some(r => r.options?.type === "damage") ||
    message.flags?.dnd5e?.roll?.type === "damage";
  if (!isDamage) return false;

  // Check item directly on message
  if (message.item?.system?.actionType === "mwak") return true;

  // Check flags for item data
  const flagItem = message.flags?.dnd5e?.item;
  if (flagItem?.system?.actionType === "mwak") return true;

  // Look up item on actor by ID
  const itemId = message.flags?.dnd5e?.roll?.itemId ?? message.flags?.dnd5e?.itemId;
  if (itemId && actor) {
    const item = actor.items.get(itemId);
    if (item?.system?.actionType === "mwak") return true;
  }

  // Look up item on actor by name
  const itemName = message.flags?.dnd5e?.item?.name ?? message.flavor;
  if (itemName && actor) {
    const item = actor.items.getName(itemName);
    if (item?.system?.actionType === "mwak") return true;
  }

  return false;
}

function actorHasEquippedBib(actor) {
  const bib = actor.items?.getName?.(BUTCHERS_BIB_ITEM_NAME);
  if (!bib) return false;
  return bib.system?.equipped === true;
}

// ─── HTML Builders ───────────────────────────────────────────────────────────

function createRerollButton(message, usedThisTurn = false) {
  const disabled = usedThisTurn ? "disabled" : "";
  const label = usedThisTurn ? "Reroll Used" : "Reroll Damage (Butcher's Bib)";
  const title = usedThisTurn
    ? "Already used this turn"
    : "Reroll the weapon's damage dice — you must keep the second result.";

  return `<button type="button" class="btn btn-sm butchers-bib-reroll-btn" ${disabled} ` +
    `data-action="butchers-bib-reroll" data-message-id="${message.id}" title="${title}">` +
    `<i class="fas fa-dice"></i> ${label}</button>`;
}

function createRerollResultContent(originalTotal, newTotal) {
  const delta = newTotal - originalTotal;
  const deltaSign = delta >= 0 ? `+${delta}` : `${delta}`;
  const indicator = newTotal > originalTotal ? "📈" : newTotal < originalTotal ? "📉" : "➡️";

  return `<div class="butchers-bib-reroll-card">` +
    `<p><strong class="butchers-bib-title">Butcher's Bib — Damage Reroll</strong></p>` +
    `<p>Original Damage: <strong>${originalTotal}</strong></p>` +
    `<p>Rerolled Damage: <strong>${newTotal}</strong> (${deltaSign}) ${indicator}</p>` +
    `<p class="butchers-bib-total-label">New Damage Total:</p>` +
    `<p class="butchers-bib-total">${newTotal}</p>` +
    `</div>`;
}

function injectRerollButton(el, buttonHtml) {
  const target =
    el.querySelector(".card-buttons") ??
    el.querySelector(".message-content .dice-roll") ??
    el;

  const position = target.matches?.(".card-buttons") ? "beforeend"
    : target === el ? "beforeend"
    : "afterend";

  target.insertAdjacentHTML(position, buttonHtml);
}

// ─── Roll Building ───────────────────────────────────────────────────────────

async function executeReroll(originalRoll, actor) {
  const formula = originalRoll.formula;
  const rollData = actor?.getRollData?.() ?? {};
  const roll = new Roll(formula, rollData);
  await roll.evaluate();
  return roll;
}

// ─── Turn Tracking ───────────────────────────────────────────────────────────

function hasUsedRerollThisTurn() {
  const combat = game.combat;
  if (!combat?.started) return false;
  const last = game._butchersBibLastReroll;
  if (!last) return false;
  return last.combatId === combat.id &&
         last.round === combat.round &&
         last.turn === combat.turn;
}

function markRerollUsed() {
  const combat = game.combat;
  if (!combat?.started) return;
  game._butchersBibLastReroll = {
    combatId: combat.id,
    round: combat.round,
    turn: combat.turn,
  };
}

// ─── Chat Message ────────────────────────────────────────────────────────────

async function sendRerollMessage(actor, roll, content) {
  await roll.toMessage({
    author: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER,
  });
}
