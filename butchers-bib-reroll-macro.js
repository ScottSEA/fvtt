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

  const buttonHtml = createRerollButton(message, ctx);
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
  btn.innerHTML = `<i class="fas fa-dice"></i> Rerolling...`;

  const reroll = await executeReroll(intent.originalRoll, intent.actor);
  if (game.dice3d) {
    await game.dice3d.showForRoll(reroll, game.user, true);
  }
  await updateOriginalMessage(intent.message, reroll, intent.originalTotal);
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

    .butchers-bib-rerolled-up:disabled,
    .butchers-bib-rerolled-down:disabled {
      cursor: default;
    }

    .butchers-bib-rerolled-up:disabled {
      background-color: #2e6b30;
      color: white;
    }

    .butchers-bib-rerolled-down:disabled {
      background-color: #6b3a2e;
      color: white;
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

  const rerolled = !!message.flags?.world?.butchersBibRerolled;

  return {
    actor,
    rerolled,
    originalTotal: message.flags?.world?.butchersBibOriginalTotal ?? null,
    newTotal: rerolled ? (message.rolls?.[0]?.total ?? null) : null,
    usedThisTurn: rerolled || hasUsedRerollThisTurn(),
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

function createRerollButton(message, ctx) {
  const { usedThisTurn, rerolled, originalTotal, newTotal } = ctx;
  const disabled = usedThisTurn ? "disabled" : "";
  let label, title, extraClass;

  if (rerolled) {
    const improved = newTotal > originalTotal;
    const icon = improved ? "fa-thumbs-up" : "fa-thumbs-down";
    extraClass = improved ? "butchers-bib-rerolled-up" : "butchers-bib-rerolled-down";
    label = `Rerolled (was ${originalTotal})`;
    title = `Damage was rerolled via Butcher's Bib. Original total: ${originalTotal}.`;
    return `<button type="button" class="btn btn-sm butchers-bib-reroll-btn ${extraClass}" disabled ` +
      `data-action="butchers-bib-reroll" data-message-id="${message.id}" title="${title}">` +
      `<i class="fas ${icon}"></i> ${label}</button>`;
  } else if (usedThisTurn) {
    label = "Reroll Used";
    title = "Already used this turn";
  } else {
    label = "Reroll Damage (Butcher's Bib)";
    title = "Reroll the weapon's damage dice — you must keep the second result.";
  }

  return `<button type="button" class="btn btn-sm butchers-bib-reroll-btn" ${disabled} ` +
    `data-action="butchers-bib-reroll" data-message-id="${message.id}" title="${title}">` +
    `<i class="fas fa-dice"></i> ${label}</button>`;
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
  return false; // TEMP: disabled for testing
  // const combat = game.combat;
  // if (!combat?.started) return false;
  // const last = game._butchersBibLastReroll;
  // if (!last) return false;
  // return last.combatId === combat.id &&
  //        last.round === combat.round &&
  //        last.turn === combat.turn;
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

// ─── Message Update ──────────────────────────────────────────────────────────

async function updateOriginalMessage(message, newRoll, originalTotal) {
  await message.update({
    rolls: [newRoll.toJSON()],
    flags: {
      world: {
        butchersBibRerolled: true,
        butchersBibOriginalTotal: originalTotal,
      },
    },
  });
}
