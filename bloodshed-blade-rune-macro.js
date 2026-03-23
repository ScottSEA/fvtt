/**
 * BLOODSHED BLADE RUNE INVOCATION MACRO
 *
 * Injects an "Invoke Rune" button into Bloodshed Blade attack roll messages,
 * allows undoing the rune expenditure, and adds an "Attack with Hit Dice"
 * damage button to the rune result message.
 */

const BLOODSHED_BLADE_ITEM_NAME = "Bloodshed Blade";
const BLOODSHED_BLADE_ACTIVITY_ID = "PXjk4FsU2X7ClsFN";
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
}

function register() {
  ensureBloodshedBladeStyles();
  const renderHookId = Hooks.on("renderChatMessage", onRenderChatMessage);
  const clickHandler = onDocumentClick;
  document.addEventListener("click", clickHandler);
  game[BLOODSHED_HOOK_FLAG] = { renderHookId, clickHandler };
}

// ─── Hook & Event Handlers ───────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;

  const actor = resolveActorFromMessage(message);
  const isRoll = message.isRoll || !!message.rolls?.length || !!message.flags?.dnd5e?.roll;
  if (!actor || !isRoll) return;

  if (!isBloodshedBladeAttackMessage(message, el)) return;
  if (el.querySelector("[data-action='bloodshed-spend-hd']")) return;

  const attackData = extractAttackRollData(message);
  if (!attackData) return;

  attackData.isCritical = detectCritical(message, el);

  const hdData = getAvailableHitDice(actor);
  const noHitDice = hdData.available <= 0;
  const runeExpended = isRuneExpended(actor);

  const invokeButton = createHitDieButton(
    message,
    attackData,
    noHitDice || runeExpended,
    noHitDice ? "No Hit Dice" : runeExpended ? "Rune Expended" : "Invoke Rune"
  );
  const undoButton = createUndoButton(message, attackData, runeExpended);
  const buttonGroup = `<div class="bloodshed-blade-btn-group">${invokeButton}${undoButton}</div>`;

  const cardButtons = el.querySelector(".card-buttons");
  if (cardButtons) {
    cardButtons.insertAdjacentHTML("beforeend", buttonGroup);
    return;
  }

  const diceRoll = el.querySelector(".message-content .dice-roll");
  if (diceRoll) {
    diceRoll.insertAdjacentHTML("afterend", buttonGroup);
    return;
  }

  el.insertAdjacentHTML("beforeend", buttonGroup);
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

  const messageId = btn.dataset.messageId;
  const attackTotal = Number(btn.dataset.attackTotal);
  const isCritical = btn.dataset.isCritical === "true";
  const message = game.messages.get(messageId);
  if (!message) return;

  const actor = resolveActorFromMessage(message);
  if (!actor) {
    ui.notifications.error("Bloodshed Blade: Unable to determine actor for this attack.");
    return;
  }

  const hdData = getAvailableHitDice(actor);
  if (hdData.available <= 0) {
    ui.notifications.warn("No Hit Dice available to spend!");
    return;
  }

  setInvokeButtonState(btn, true, "Rune Invoked");
  const undoSibling = btn.closest(".bloodshed-blade-btn-group")?.querySelector(".bloodshed-blade-undo-btn");
  if (undoSibling) undoSibling.disabled = false;

  await rollHitDie(actor, message, hdData.largestType, attackTotal, isCritical);
}

async function handleUndoRune(event, btn) {
  event.preventDefault();

  const messageId = btn.dataset.messageId;
  const message = game.messages.get(messageId);
  if (!message) return;

  const actor = resolveActorFromMessage(message);
  if (!actor) {
    ui.notifications.error("Bloodshed Blade: Unable to determine actor for this attack.");
    return;
  }

  await unmarkRuneAsExpended(actor);
  await unmarkHitDieExpended(actor);

  const invokeButton = btn.closest(".bloodshed-blade-btn-group")?.querySelector(".bloodshed-blade-invoke-btn");
  if (invokeButton) {
    setInvokeButtonState(invokeButton, false, "Invoke Rune");
  }
  btn.disabled = true;

  ui.notifications.info("Rune invocation and hit die expenditure have been undone.");
}

async function handleDamageRoll(event, btn) {
  event.preventDefault();

  const actorId = btn.dataset.actorId;
  const actor = game.actors.get(actorId);
  if (!actor) {
    ui.notifications.error("Bloodshed Blade: Unable to determine actor for this damage roll.");
    return;
  }

  const blade = actor.items?.getName?.(BLOODSHED_BLADE_ITEM_NAME);
  if (!blade) {
    ui.notifications.error("Bloodshed Blade: Could not find the weapon on this actor.");
    return;
  }

  const isCritical = btn.dataset.isCritical === "true";
  const gustoRollData = await buildGustoRollData(actor, blade, isCritical);
  if (!gustoRollData.roll) {
    ui.notifications.error("Bloodshed Blade: Unable to build the damage roll.");
    return;
  }

  const { roll: gustoRoll, prof, hdType, displayFormula } = gustoRollData;
  const damageTotal = gustoRoll.total;

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

  await gustoRoll.toMessage({
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

function resolveActorFromMessage(message) {
  return message.actor ||
    (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null) ||
    (message.speaker?.token ? canvas?.tokens?.get(message.speaker.token)?.actor : null) ||
    null;
}

function isBloodshedBladeAttackMessage(message, el) {
  const text = el.textContent || "";
  const isAttackRoll = message.rolls?.some((roll) => roll.options?.type === "attack") ||
    message.flags?.dnd5e?.roll?.type === "attack" ||
    text.toLowerCase().includes("attack");

  const hasName = !!(
    message.item?.name?.includes(BLOODSHED_BLADE_ITEM_NAME) ||
    message.flavor?.includes(BLOODSHED_BLADE_ITEM_NAME) ||
    message.flags?.dnd5e?.item?.name?.includes(BLOODSHED_BLADE_ITEM_NAME) ||
    text.includes(BLOODSHED_BLADE_ITEM_NAME)
  );

  return isAttackRoll && hasName;
}

function extractAttackRollData(message) {
  if (!message.rolls?.length) return null;

  const rollData = message.rolls[0]?.toJSON?.() || message.rolls[0];
  if (!rollData || typeof rollData.total !== "number") return null;

  return {
    total: rollData.total,
    formula: rollData.formula,
    rollId: message.id
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

function createGustoButtonForOutput(actor, isCritical = false) {
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

// ─── Roll Building ───────────────────────────────────────────────────────────

async function buildGustoRollData(actor, blade, isCritical = false) {
  const baseDamage = blade.system?.damage?.base;
  if (!baseDamage?.number || !baseDamage?.denomination) {
    return { roll: null, prof: 0, hdType: null, displayFormula: null };
  }

  const diceNum = baseDamage.number;
  const diceDenom = baseDamage.denomination;

  let formula;

  if (isCritical) {
    formula = `${diceNum}d${diceDenom} + ${diceNum}d${diceDenom}`;
  } else {
    formula = `${diceNum}d${diceDenom}`;
  }

  const bonus = `${baseDamage.bonus || ""}`.trim();
  const conMod = actor.system?.abilities?.con?.mod ?? actor.getRollData?.()?.abilities?.con?.mod ?? 0;
  if (bonus) {
    formula += /^[+\-]/.test(bonus) ? ` ${bonus}` : ` + ${bonus}`;
  }

  const prof = actor.system?.attributes?.prof || 2;
  const hdData = getAvailableHitDice(actor);
  const hdType = hdData.largestType || null;
  if (prof > 0 && hdType) {
    if (isCritical) {
      formula += ` + ${prof}${hdType} + ${prof}${hdType}`;
    } else {
      formula += ` + ${prof}${hdType}`;
    }
  }

  const rollData = actor.getRollData ? actor.getRollData() : {};
  const roll = new Roll(formula, rollData);
  await roll.evaluate();

  // Max Criticals: force every other dice group to max (the "max" copy of each pair)
  if (isCritical) {
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

  // Build displayFormula from actual rolled/maxed values
  let displayFormula;
  const diceTerms = roll.terms.filter(t => t.faces && t.results);

  if (isCritical) {
    // diceTerms: [0] weapon max, [1] weapon roll, [2] HD max (if present), [3] HD roll (if present)
    const weaponMax = diceTerms[0];
    const weaponRoll = diceTerms[1];
    const parts = [];
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
    if (bonus) {
      parts.push(`${conMod} (CON)`);
    }
    displayFormula = parts.join(" + ");
  } else {
    const parts = [];
    parts.push(`${diceTerms[0].number}d${diceTerms[0].faces} (${diceTerms[0]._total ?? diceTerms[0].total})`);
    if (diceTerms.length > 1) {
      parts.push(`${diceTerms[1].number}${hdType} HD (${diceTerms[1]._total ?? diceTerms[1].total})`);
    }
    if (bonus) {
      parts.push(`${conMod} (CON)`);
    }
    displayFormula = parts.join(" + ");
  }

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

  const activities = item.system?.activities || {};
  return activities.get?.(BLOODSHED_BLADE_ACTIVITY_ID) || null;
}

function isRuneExpended(actor) {
  const activity = getInvokedRuneActivity(actor);
  const spent = parseInt(activity?.uses?.spent || 0, 10);
  return spent > 0;
}

// ─── State Mutations ─────────────────────────────────────────────────────────

async function rollHitDie(actor, message, hdType, originalAttackTotal, isCritical = false) {
  try {
    const roll = new Roll(`1${hdType}`);
    await roll.evaluate();

    const hdResult = roll.total;
    const newTotal = originalAttackTotal + hdResult;
    const gustoButton = createGustoButtonForOutput(actor, isCritical);

    const content = createResultCardStart("bloodshed-blade-rune-card", "Rune Invoked") +
      `<p>Original Attack Roll: <strong>${originalAttackTotal}</strong></p>` +
      `<p>+ Spent Hit Die Roll: <strong>${hdResult}</strong> (1${hdType})</p>` +
      createResultTotal(newTotal, "bloodshed-blade-rune-total") +
      gustoButton +
      `</div>`;

    await roll.toMessage({
      author: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content,
      style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER
    });
  } catch (err) {
    console.error("Bloodshed Blade Rune Error", err);
    ui.notifications.error("Error invoking rune. Check console.");
    return;
  }

  await markRuneAsExpended(actor);
  await markHitDieExpended(actor, hdType);
}

async function markRuneAsExpended(actor) {
  const activity = getInvokedRuneActivity(actor);
  if (!activity) return;

  const item = actor.items?.getName?.(BLOODSHED_BLADE_ITEM_NAME);
  if (!item) return;

  const path = `system.activities.${BLOODSHED_BLADE_ACTIVITY_ID}.uses.spent`;
  const currentSpent = activity.uses?.spent || 0;
  await item.update({ [path]: currentSpent + 1 });
}

async function unmarkRuneAsExpended(actor) {
  const activity = getInvokedRuneActivity(actor);
  if (!activity) return;

  const item = actor.items?.getName?.(BLOODSHED_BLADE_ITEM_NAME);
  if (!item) return;

  const path = `system.activities.${BLOODSHED_BLADE_ACTIVITY_ID}.uses.spent`;
  const currentSpent = activity.uses?.spent || 0;
  if (currentSpent > 0) {
    await item.update({ [path]: currentSpent - 1 });
  }
}

async function markHitDieExpended(actor, hdType) {
  const classes = actor.classes || {};
  for (const [key, cls] of Object.entries(classes)) {
    const level = cls.system?.levels || 0;
    const spent = cls.system?.hd?.spent || 0;
    const denomination = cls.system?.hd?.denomination;
    if (denomination !== hdType || level - spent <= 0) continue;

    await cls.update({ "system.hd.spent": spent + 1 });
    return;
  }
}

async function unmarkHitDieExpended(actor) {
  const classes = actor.classes || {};
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