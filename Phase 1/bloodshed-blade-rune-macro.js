/**
 * BLOODSHED BLADE RUNE INVOCATION MACRO
 *
 * Injects an "Invoke Rune" button into Bloodshed Blade attack roll messages,
 * allows undoing the rune expenditure, and adds an "Attack with Hit Dice"
 * damage button to the rune result message.
 */

const BLOODSHED_BLADE_ITEM_NAME = "Bloodshed Blade";
const BLOODSHED_HOOK_FLAG = "bloodshedBladeHookRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[BLOODSHED_HOOK_FLAG]) return;
  const prev = game[BLOODSHED_HOOK_FLAG];
  if (prev.renderHookId != null) Hooks.off("renderChatMessage", prev.renderHookId);
  if (prev.clickHandler) document.removeEventListener("click", prev.clickHandler);
  const oldStyle = document.getElementById("bloodshed-blade-macro-style");
  if (oldStyle) oldStyle.remove();
  console.log("Bloodshed Blade macro torn down.");
}

function register() {
  ensureBloodshedBladeStyles();
  const renderHookId = Hooks.on("renderChatMessage", onRenderChatMessage);
  const clickHandler = onDocumentClick;
  document.addEventListener("click", clickHandler);
  game[BLOODSHED_HOOK_FLAG] = { renderHookId, clickHandler };
  console.log("Bloodshed Blade macro loaded.");
}

// ─── Hook & Event Handlers ───────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  if (el.querySelector("[data-action='bloodshed-spend-hd']")) return;

  const ctx = analyzeMessage(message, el);
  if (!ctx) return;

  const buttonHtml = buildButtonGroup(message, ctx);
  injectButtons(el, buttonHtml);
}

async function onDocumentClick(event) {
  const spendBtn = event.target.closest("[data-action='bloodshed-spend-hd']");
  const undoBtn = event.target.closest("[data-action='bloodshed-undo-hd']");
  const gustoBtn = event.target.closest("[data-action='bloodshed-gusto-damage']");

  if (spendBtn) await handleInvokeRune(event, spendBtn);
  else if (undoBtn) await handleUndoRune(event, undoBtn);
  else if (gustoBtn) await handleDamageRoll(event, gustoBtn);
}

async function handleInvokeRune(event, btn) {
  event.preventDefault();

  const intent = resolveInvokeIntent(btn);
  if (!intent) return;

  updateInvokeUI(btn);
  await executeInvoke(intent);
}

function resolveInvokeIntent(btn) {
  const message = game.messages.get(btn.dataset.messageId);
  if (!message) return null;

  const actor = resolveActorFromMessage(message);
  if (!actor) {
    ui.notifications.error("Bloodshed Blade: Unable to determine actor for this attack.");
    return null;
  }

  const hdData = getAvailableHitDice(actor);
  if (hdData.available <= 0) {
    ui.notifications.warn("No Hit Dice available to spend!");
    return null;
  }

  return {
    actor,
    message,
    hdType: hdData.largestType,
    attackTotal: Number(btn.dataset.attackTotal),
    isCritical: btn.dataset.isCritical === "true",
  };
}

function updateInvokeUI(btn) {
  setInvokeButtonState(btn, true, "Rune Invoked");
  const undoSibling = btn.closest(".bloodshed-blade-btn-group")?.querySelector(".bloodshed-blade-undo-btn");
  if (undoSibling) undoSibling.disabled = false;
}

async function executeInvoke({ actor, message, hdType, attackTotal, isCritical }) {
  await rollHitDie(actor, message, hdType, attackTotal, isCritical);
}

async function handleUndoRune(event, btn) {
  event.preventDefault();

  const intent = resolveUndoIntent(btn);
  if (!intent) return;

  await updateRuneState(intent.actor, "restore");
  updateUndoUI(btn);
  ui.notifications.info("Rune invocation and hit die expenditure have been undone.");
}

function resolveUndoIntent(btn) {
  const message = game.messages.get(btn.dataset.messageId);
  if (!message) return null;

  const actor = resolveActorFromMessage(message);
  if (!actor) {
    ui.notifications.error("Bloodshed Blade: Unable to determine actor for this attack.");
    return null;
  }

  return { actor, message };
}

function updateUndoUI(btn) {
  const invokeButton = btn.closest(".bloodshed-blade-btn-group")?.querySelector(".bloodshed-blade-invoke-btn");
  if (invokeButton) {
    setInvokeButtonState(invokeButton, false, "Invoke Rune");
  }
  btn.disabled = true;
}

async function handleDamageRoll(event, btn) {
  event.preventDefault();

  const intent = resolveDamageIntent(btn);
  if (!intent) return;

  const rollResult = await buildDamageRoll(intent.actor, intent.blade, intent.isCritical);
  if (!rollResult) return;

  const content = createDamageResultContent(rollResult.displayFormula, rollResult.roll.total, intent.isCritical);
  await sendRollMessage(intent.actor, rollResult.roll, content);
}

function resolveDamageIntent(btn) {
  const actor = game.actors.get(btn.dataset.actorId);
  if (!actor) {
    ui.notifications.error("Bloodshed Blade: Unable to determine actor for this damage roll.");
    return null;
  }

  const blade = actor.items?.getName?.(BLOODSHED_BLADE_ITEM_NAME);
  if (!blade) {
    ui.notifications.error("Bloodshed Blade: Could not find the weapon on this actor.");
    return null;
  }

  return { actor, blade, isCritical: btn.dataset.isCritical === "true" };
}

async function sendRollMessage(actor, roll, content) {
  await roll.toMessage({
    author: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER
  });
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function ensureBloodshedBladeStyles() {
  if (document.getElementById("bloodshed-blade-macro-style")) return;

  const style = document.createElement("style");
  style.id = "bloodshed-blade-macro-style";
  style.innerHTML = `
    .bloodshed-blade-btn-group {
      display: flex;
      gap: 4px;
    }

    .bloodshed-blade-invoke-btn,
    .bloodshed-blade-gusto-btn {
      color: white;
      margin-top: 5px;
      width: 100%;
      border: none;
    }

    .bloodshed-blade-invoke-btn {
      background-color: #8b0000;
    }

    .bloodshed-blade-invoke-btn:disabled {
      background-color: #777;
      color: white;
    }

    .bloodshed-blade-undo-btn {
      background-color: #444;
      color: white;
      margin-top: 5px;
      width: 40px;
      border: none;
    }

    .bloodshed-blade-undo-btn:disabled {
      background-color: #222;
      color: #aaa;
    }

    .bloodshed-blade-gusto-btn {
      background-color: #8b0000;
    }

    .bloodshed-blade-rune-card,
    .bloodshed-blade-gusto-card {
      padding-left: 10px;
      margin: 10px 0;
      border-left: 4px solid;
    }

    .bloodshed-blade-rune-card {
      border-left-color: #8b0000;
    }

    .bloodshed-blade-gusto-card {
      border-left-color: #8b0000;
    }

    .bloodshed-blade-rune-title {
      color: #8b0000;
    }

    .bloodshed-blade-gusto-title,
    .bloodshed-blade-gusto-total {
      color: #8b0000;
    }

    .bloodshed-blade-rune-total,
    .bloodshed-blade-gusto-total {
      font-size: 2em;
      font-weight: bold;
    }

    .bloodshed-blade-total-label {
      font-size: 1.1em;
      font-weight: bold;
    }

    .bloodshed-blade-crit-smash {
      animation: crit-smash 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards,
                 crit-fade 0.8s ease-out 4.0s forwards;
      transform-origin: center center;
      position: relative;
      z-index: 100;
      font-size: 7em !important;
      font-weight: bold;
      color: #8b0000;
      line-height: 1;
      height: 0;
      overflow: visible;
      margin: 0;
      pointer-events: none;
      text-align: center;
      display: block;
    }

    @keyframes crit-smash {
      0% {
        transform: scale(6) rotate(-40deg) translate(60px, -300px);
        opacity: 0;
        color: #ff0000;
        text-shadow: 0 0 0 transparent;
      }
      30% {
        opacity: 1;
        color: #ff0000;
      }
      50% {
        transform: scale(1.2) rotate(-30deg) translate(60px, -120px);
        color: #cc0000;
        text-shadow:
          0 0 40px rgba(255, 0, 0, 0.9),
          0 0 80px rgba(139, 0, 0, 0.6),
          0 4px 8px rgba(0, 0, 0, 0.5);
      }
      65% {
        transform: scale(1.3) rotate(-32deg) translate(60px, -125px);
      }
      80% {
        transform: scale(1.15) rotate(-29deg) translate(60px, -118px);
      }
      100% {
        transform: scale(1.2) rotate(-30deg) translate(60px, -120px);
        opacity: 1;
        color: #8b0000;
        text-shadow:
          0 0 20px rgba(139, 0, 0, 0.6),
          0 0 40px rgba(139, 0, 0, 0.3),
          0 4px 6px rgba(0, 0, 0, 0.4);
      }
    }

    @keyframes crit-fade {
      0% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

// ─── Message Detection ───────────────────────────────────────────────────────

function analyzeMessage(message, el) {
  const actor = resolveActorFromMessage(message);
  const isRoll = message.isRoll || !!message.rolls?.length || !!message.flags?.dnd5e?.roll;
  if (!actor || !isRoll) return null;
  if (!actor.isOwner) return null;

  // Verify the Bloodshed Blade is equipped
  const blade = actor.items?.find(i => i.name === BLOODSHED_BLADE_ITEM_NAME && i.type === "weapon");
  if (!blade || !blade.system?.equipped) return null;

  if (!isBloodshedBladeAttackMessage(message, el)) return null;

  const attackData = extractAttackRollData(message);
  if (!attackData) return null;

  return {
    actor,
    attackTotal: attackData.total,
    formula: attackData.formula,
    isCritical: detectCritical(message, el),
    hdData: getAvailableHitDice(actor),
    runeExpended: isRuneExpended(actor),
  };
}

function resolveButtonState(hdData, runeExpended) {
  if (hdData.available <= 0) return { disabled: true, label: "No Hit Dice" };
  if (runeExpended)          return { disabled: true, label: "Rune Expended" };
  return                            { disabled: false, label: "Invoke Rune" };
}

function buildButtonGroup(message, ctx) {
  const { disabled, label } = resolveButtonState(ctx.hdData, ctx.runeExpended);
  const attackData = { total: ctx.attackTotal, isCritical: ctx.isCritical };

  const invokeButton = createHitDieButton(message, attackData, disabled, label);
  const undoButton = createUndoButton(message, attackData, ctx.runeExpended);
  return `<div class="bloodshed-blade-btn-group">${invokeButton}${undoButton}</div>`;
}

function injectButtons(el, buttonHtml) {
  const target =
    el.querySelector(".card-buttons") ??
    el.querySelector(".message-content .dice-roll") ??
    el;

  const position = target.matches?.(".card-buttons") ? "beforeend"
    : target === el ? "beforeend"
    : "afterend";

  target.insertAdjacentHTML(position, buttonHtml);
}

function resolveActorFromMessage(message) {
  return message.actor ||
    (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null) ||
    (message.speaker?.token ? canvas?.tokens?.get(message.speaker.token)?.actor : null) ||
    null;
}

function isBloodshedBladeAttackMessage(message, el) {
  // Must be a proper dnd5e attack roll — not just any message mentioning "attack"
  const isAttackRoll = message.rolls?.some((roll) => roll.options?.type === "attack") ||
    message.flags?.dnd5e?.roll?.type === "attack" ||
    message.flags?.dnd5e?.activity?.type === "attack";

  if (!isAttackRoll) return false;

  const text = el.textContent || "";
  const hasName = !!(
    message.item?.name?.includes(BLOODSHED_BLADE_ITEM_NAME) ||
    message.flavor?.includes(BLOODSHED_BLADE_ITEM_NAME) ||
    message.flags?.dnd5e?.item?.name?.includes(BLOODSHED_BLADE_ITEM_NAME) ||
    text.includes(BLOODSHED_BLADE_ITEM_NAME)
  );

  return hasName;
}

function extractAttackRollData(message) {
  if (!message.rolls?.length) return null;

  const rollData = message.rolls[0]?.toJSON?.() || message.rolls[0];
  if (!rollData || typeof rollData.total !== "number") return null;

  return {
    total: rollData.total,
    formula: rollData.formula,
  };
}

function detectCritical(message, el) {
  // CSS class on the dice total (dnd5e v3 and earlier)
  if (el.querySelector(".dice-total.critical")) return true;

  // D20Roll.isCritical property (dnd5e v3+)
  if (message.rolls?.some(r => r.isCritical)) return true;

  // Flags set by dnd5e
  if (message.flags?.dnd5e?.roll?.isCritical) return true;

  // Check the raw d20 result against the critical threshold
  const roll = message.rolls?.[0];
  if (roll) {
    const d20Term = roll.terms?.find(t => t.faces === 20);
    if (d20Term) {
      const threshold = roll.options?.critical ?? 20;
      const result = d20Term.results?.[0]?.result;
      if (result != null && result >= threshold) return true;
    }
  }

  return false;
}

// ─── HTML Builders ───────────────────────────────────────────────────────────

function createHitDieButton(message, attackData, disabled = false, buttonText = "Invoke Rune") {
  const isDisabledAttr = disabled ? "disabled" : "";
  const title = disabled ? buttonText : "Invoke the blade's rune to add a Hit Die to your attack roll";

  return `<button type="button" class="btn btn-sm bloodshed-blade-invoke-btn" ${isDisabledAttr} data-action="bloodshed-spend-hd" data-message-id="${message.id}" data-attack-total="${attackData.total}" data-is-critical="${attackData.isCritical || false}" title="${title}">` +
    `<i class="fas fa-dice-d20"></i> ${buttonText}` +
    `</button>`;
}

function createUndoButton(message, attackData, runeExpended = false) {
  const isDisabledAttr = runeExpended ? "" : "disabled";
  const title = "Undo rune invocation and restore hit die";

  return `<button type="button" class="btn btn-sm bloodshed-blade-undo-btn" ${isDisabledAttr} data-action="bloodshed-undo-hd" data-message-id="${message.id}" data-attack-total="${attackData.total}" title="${title}">` +
    `<i class="fas fa-undo"></i>` +
    `</button>`;
}

function createDamageButton(actor, isCritical = false) {
  const dataAction = `data-action="bloodshed-gusto-damage"`;
  const dataActorId = actor.id ? `data-actor-id="${actor.id}"` : "";
  const dataIsCritical = `data-is-critical="${isCritical}"`;
  const label = isCritical ? "CRITICAL with Hit Dice" : "Attack with Hit Dice";
  const title = `${label}! Roll damage + proficiency hit dice.`;

  return `<button type="button" class="btn btn-sm bloodshed-blade-gusto-btn" ${dataAction} ${dataActorId} ${dataIsCritical} title="${title}">`+
    `<i class="fas fa-fist-raised"></i> ${label}` +
    `</button>`;
}

function setInvokeButtonState(button, disabled, label) {
  button.disabled = disabled;
  button.innerHTML = `<i class="fas fa-dice-d20"></i> ${label}`;
}

function createResultCardStart(cardClass, title) {
  const titleClass = cardClass === "bloodshed-blade-gusto-card"
    ? "bloodshed-blade-gusto-title"
    : "bloodshed-blade-rune-title";

  return `<div class="${cardClass}">` +
    `<p><strong class="${titleClass}">${title}</strong></p>`;
}

function createResultTotal(total, totalClass) {
  return `<p class="bloodshed-blade-total-label">Total:</p>` +
    `<p class="${totalClass}">${total}</p>`;
}

function createRuneInvokedContent(originalAttackTotal, hdResult, hdType, newTotal, gustoButton) {
  return createResultCardStart("bloodshed-blade-rune-card", "Rune Invoked") +
    `<p>Original Attack Roll: <strong>${originalAttackTotal}</strong></p>` +
    `<p>+ Spent Hit Die Roll: <strong>${hdResult}</strong> (1${hdType})</p>` +
    createResultTotal(newTotal, "bloodshed-blade-rune-total") +
    gustoButton +
    `</div>`;
}

function createDamageResultContent(displayFormula, damageTotal, isCritical) {
  const cardTitle = isCritical ? "CRITICAL with Hit Dice" : "Attack with Hit Dice";
  let content = createResultCardStart("bloodshed-blade-gusto-card", cardTitle);
  if (displayFormula) {
    content += `<p>Formula: <strong>${displayFormula}</strong></p>`;
  }
  if (damageTotal !== null) {
    content += `<p>Combined Damage Roll: <strong>${damageTotal}</strong></p>`;
    content += createResultTotal(damageTotal, "bloodshed-blade-gusto-total");
  }
  content += `</div>`;
  if (isCritical) {
    content += `<p class="bloodshed-blade-crit-smash">${damageTotal}</p>`;
  }
  return content;
}

// ─── Roll Building ───────────────────────────────────────────────────────────

function buildDamageFormula(baseDamage, prof, hdType, isCritical) {
  const diceNum = baseDamage.number;
  const diceDenom = baseDamage.denomination;

  let formula = isCritical
    ? `${diceNum}d${diceDenom} + ${diceNum}d${diceDenom}`
    : `${diceNum}d${diceDenom}`;

  const bonus = `${baseDamage.bonus || ""}`.trim();
  if (bonus) {
    formula += /^[+\-]/.test(bonus) ? ` ${bonus}` : ` + ${bonus}`;
  }

  if (prof > 0 && hdType) {
    formula += isCritical
      ? ` + ${prof}${hdType} + ${prof}${hdType}`
      : ` + ${prof}${hdType}`;
  }

  return formula;
}

function applyMaxCriticals(roll) {
  const diceTerms = roll.terms.filter(t => t.faces && t.results);
  // diceTerms: [0] weapon max, [1] weapon roll, [2] HD max, [3] HD roll
  for (let i = 0; i < diceTerms.length; i += 2) {
    const term = diceTerms[i];
    const originalTermTotal = term.total;
    for (const r of term.results) {
      if (r.active) r.result = term.faces;
    }
    const newTermTotal = term.results
      .filter(r => r.active)
      .reduce((sum, r) => sum + r.result, 0);
    term._total = newTermTotal;
    roll._total = roll._total - originalTermTotal + newTermTotal;
  }
}

function buildDisplayFormula(roll, hdType, conMod, isCritical) {
  const diceTerms = roll.terms.filter(t => t.faces && t.results);
  const parts = [];

  if (isCritical) {
    const weaponMax = diceTerms[0];
    const weaponRoll = diceTerms[1];
    parts.push(`${weaponMax.number}d${weaponMax.faces} MAX (${weaponMax._total ?? weaponMax.total})`);
    if (diceTerms.length > 2) {
      const hdMax = diceTerms[2];
      parts.push(`${hdMax.number}${hdType} HD MAX (${hdMax._total ?? hdMax.total})`);
    }
    parts.push(`${weaponRoll.number}d${weaponRoll.faces} (${weaponRoll._total ?? weaponRoll.total})`);
    if (diceTerms.length > 3) {
      const hdRoll = diceTerms[3];
      parts.push(`${hdRoll.number}${hdType} HD (${hdRoll._total ?? hdRoll.total})`);
    }
  } else {
    parts.push(`${diceTerms[0].number}d${diceTerms[0].faces} (${diceTerms[0]._total ?? diceTerms[0].total})`);
    if (diceTerms.length > 1) {
      parts.push(`${diceTerms[1].number}${hdType} HD (${diceTerms[1]._total ?? diceTerms[1].total})`);
    }
  }

  if (conMod != null) {
    parts.push(`${conMod} (CON)`);
  }

  return parts.join(" + ");
}

async function buildDamageRoll(actor, blade, isCritical = false) {
  const baseDamage = blade.system?.damage?.base;
  if (!baseDamage?.number || !baseDamage?.denomination) {
    ui.notifications.error("Bloodshed Blade: Unable to build the damage roll.");
    return null;
  }

  const bonus = `${baseDamage.bonus || ""}`.trim();
  const conMod = actor.system?.abilities?.con?.mod ?? actor.getRollData?.()?.abilities?.con?.mod ?? 0;
  const prof = actor.system?.attributes?.prof || 2;
  const hdData = getAvailableHitDice(actor);
  const hdType = hdData.largestType || null;

  const formula = buildDamageFormula(baseDamage, prof, hdType, isCritical);
  const rollData = actor.getRollData ? actor.getRollData() : {};
  const roll = new Roll(formula, rollData);
  await roll.evaluate();

  if (isCritical) applyMaxCriticals(roll);

  const displayFormula = buildDisplayFormula(roll, hdType, conMod, isCritical);

  return { roll, prof, hdType, displayFormula };
}

// ─── Actor / Item Queries ────────────────────────────────────────────────────

function getAvailableHitDice(actor) {
  const classes = actor.classes || {};
  let totalAvailable = 0;
  let largestType = null;
  let largestValue = 0;

  for (const [key, cls] of Object.entries(classes)) {
    const level = cls.system?.levels || 0;
    const spent = cls.system?.hd?.spent || 0;
    const denomination = cls.system?.hd?.denomination;
    if (!denomination) continue;

    const available = level - spent;
    if (available <= 0) continue;

    totalAvailable += available;
    const dieValue = parseInt(denomination.slice(1), 10);
    if (dieValue > largestValue) {
      largestValue = dieValue;
      largestType = denomination;
    }
  }

  return { available: totalAvailable, largestType };
}

function getInvokedRuneActivity(actor) {
  const item = actor.items?.getName?.(BLOODSHED_BLADE_ITEM_NAME);
  if (!item) return null;

  const activities = item.system?.activities;
  if (!activities) return null;

  // Find the rune invocation activity (the one with limited uses)
  for (const [id, activity] of activities.entries()) {
    if (activity.uses?.max > 0) return { activity, id, item };
  }
  return null;
}

function isRuneExpended(actor) {
  const result = getInvokedRuneActivity(actor);
  if (!result) return false;
  const spent = parseInt(result.activity?.uses?.spent || 0, 10);
  return spent > 0;
}

// ─── State Mutations ─────────────────────────────────────────────────────────

async function rollHitDie(actor, message, hdType, originalAttackTotal, isCritical = false) {
  try {
    const roll = new Roll(`1${hdType}`);
    await roll.evaluate();

    const hdResult = roll.total;
    const newTotal = originalAttackTotal + hdResult;
    const damageButton = createDamageButton(actor, isCritical);
    const content = createRuneInvokedContent(originalAttackTotal, hdResult, hdType, newTotal, damageButton);

    await sendRollMessage(actor, roll, content);
  } catch (err) {
    console.error("Bloodshed Blade Rune Error", err);
    ui.notifications.error("Error invoking rune. Check console.");
    return;
  }

  await updateRuneState(actor, "expend", hdType);
}

async function updateRuneState(actor, direction, hdType = null) {
  const delta = direction === "expend" ? 1 : -1;
  await updateRuneUses(actor, delta);
  await updateHitDieSpent(actor, delta, hdType);
}

async function updateRuneUses(actor, delta) {
  const result = getInvokedRuneActivity(actor);
  if (!result) return;

  const { activity, id, item } = result;
  const path = `system.activities.${id}.uses.spent`;
  const currentSpent = activity.uses?.spent || 0;
  const newSpent = currentSpent + delta;
  if (newSpent >= 0) {
    await item.update({ [path]: newSpent });
  }
}

async function updateHitDieSpent(actor, delta, hdType = null) {
  const classes = actor.classes || {};

  if (delta > 0 && hdType) {
    // Expend: find matching class with available HD
    for (const [key, cls] of Object.entries(classes)) {
      const level = cls.system?.levels || 0;
      const spent = cls.system?.hd?.spent || 0;
      const denomination = cls.system?.hd?.denomination;
      if (denomination !== hdType || level - spent <= 0) continue;

      await cls.update({ "system.hd.spent": spent + 1 });
      return;
    }
  } else if (delta < 0) {
    // Restore: find the largest-die class with spent HD
    let target = null;
    let targetValue = 0;

    for (const [key, cls] of Object.entries(classes)) {
      const spent = cls.system?.hd?.spent || 0;
      if (spent <= 0) continue;

      const denomination = cls.system?.hd?.denomination;
      if (!denomination) continue;

      const dieValue = parseInt(denomination.slice(1), 10);
      if (dieValue > targetValue) {
        targetValue = dieValue;
        target = cls;
      }
    }

    if (target) {
      const spent = target.system?.hd?.spent || 0;
      await target.update({ "system.hd.spent": spent - 1 });
    }
  }
}