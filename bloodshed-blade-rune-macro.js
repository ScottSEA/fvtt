/**
 * BLOODSHED BLADE RUNE INVOCATION MACRO
 *
 * Injects an "Invoke Rune" button into Bloodshed Blade attack roll messages,
 * allows undoing the rune expenditure, and adds an "Attack with Gusto!"
 * damage button to the rune result message.
 */

const BLOODSHED_BLADE_ITEM_NAME = "Bloodshed Blade";
const BLOODSHED_BLADE_ACTIVITY_ID = "PXjk4FsU2X7ClsFN";
const BLOODSHED_HOOK_FLAG = "bloodshedBladeHookRegistered";

ensureBloodshedBladeStyles();

console.log("Bloodshed Blade: Macro starting execution");

if (!game[BLOODSHED_HOOK_FLAG]) {
  console.log("Bloodshed Blade: Registering hook set");

  Hooks.on("createChatMessage", (message) => {
    console.log("Bloodshed Blade: createChatMessage fired", message.id, message.type, message.isRoll);
  });

  Hooks.on("renderChatMessage", (message, html) => {
    const el = html instanceof HTMLElement ? html : html[0] ?? html;
    console.log("Bloodshed Blade: renderChatMessage fired", message.id, message.type, message.isRoll);

    const actor = resolveActorFromMessage(message);
    const isRoll = message.isRoll || !!message.rolls?.length || !!message.flags?.dnd5e?.roll;
    if (!actor || !isRoll) {
      console.log("Bloodshed Blade: skip - not roll or no actor", { actor: !!actor, isRoll });
      return;
    }

    if (!isBloodshedBladeAttackMessage(message, el)) return;
    if (el.querySelector("[data-action='bloodshed-spend-hd']")) return;

    const attackData = extractAttackRollData(message);
    if (!attackData) return;

    attackData.isCritical = !!el.querySelector(".dice-total.critical");

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
  });

  document.addEventListener("click", async (event) => {
    const spendBtn = event.target.closest("[data-action='bloodshed-spend-hd']");
    const undoBtn = event.target.closest("[data-action='bloodshed-undo-hd']");
    const gustoBtn = event.target.closest("[data-action='bloodshed-gusto-damage']");

    if (spendBtn) {
      event.preventDefault();

      const messageId = spendBtn.dataset.messageId;
      const attackTotal = Number(spendBtn.dataset.attackTotal);
      const isCritical = spendBtn.dataset.isCritical === "true";
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

      setInvokeButtonState(spendBtn, true, "Rune Invoked");
      const undoSibling = spendBtn.closest(".bloodshed-blade-btn-group")?.querySelector(".bloodshed-blade-undo-btn");
      if (undoSibling) undoSibling.disabled = false;

      await rollHitDie(actor, message, hdData.largestType, attackTotal, isCritical);
    }

    else if (undoBtn) {
      event.preventDefault();

      const messageId = undoBtn.dataset.messageId;
      const message = game.messages.get(messageId);
      if (!message) return;

      const actor = resolveActorFromMessage(message);
      if (!actor) {
        ui.notifications.error("Bloodshed Blade: Unable to determine actor for this attack.");
        return;
      }

      await unmarkRuneAsExpended(actor);
      await unmarkHitDieExpended(actor);

      const invokeButton = undoBtn.closest(".bloodshed-blade-btn-group")?.querySelector(".bloodshed-blade-invoke-btn");
      if (invokeButton) {
        setInvokeButtonState(invokeButton, false, "Invoke Rune");
      }
      undoBtn.disabled = true;

      ui.notifications.info("Rune invocation and hit die expenditure have been undone.");
    }

    else if (gustoBtn) {
      event.preventDefault();

      const actorId = gustoBtn.dataset.actorId;
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

      const isCritical = true; //gustoBtn.dataset.isCritical === "true";
      const gustoRollData = await buildGustoRollData(actor, blade, isCritical);
      if (!gustoRollData.roll) {
        ui.notifications.error("Bloodshed Blade: Unable to build the Gusto damage roll.");
        return;
      }

      const { roll: gustoRoll, prof, hdType, displayFormula } = gustoRollData;
      const damageTotal = gustoRoll.total;

      let content = createResultCardStart("bloodshed-blade-gusto-card", "Fuck 'Em Up!");
      if (displayFormula) {
        content += `<p>Formula: <strong>${displayFormula}</strong></p>`;
      }
      if (damageTotal !== null) {
        content += `<p>Combined Damage Roll: <strong>${damageTotal}</strong></p>`;
        content += createResultTotal(damageTotal, "bloodshed-blade-gusto-total");
      }
      content += `</div>`;

      await gustoRoll.toMessage({
        author: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content,
        type: CONST.CHAT_MESSAGE_TYPES.OTHER
      });
    }
  });

  game[BLOODSHED_HOOK_FLAG] = true;
}

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
  `;
  document.head.appendChild(style);
}

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

  const isBlade = isAttackRoll && hasName;
  console.log("Bloodshed Blade: detection", { isAttackRoll, hasName, isBlade });
  return isBlade;
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
  const title = "Attack with Gusto! Roll damage + proficiency hit dice.";

  return `<button type="button" class="btn btn-sm bloodshed-blade-gusto-btn" ${dataAction} ${dataActorId} ${dataIsCritical} title="${title}">` +
    `<i class="fas fa-fist-raised"></i> Attack with Gusto!` +
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

async function createBladeDamageRoll(actor, blade) {
  const baseDamage = blade.system?.damage?.base;
  if (!baseDamage?.number || !baseDamage?.denomination) return null;

  let formula = `${baseDamage.number}d${baseDamage.denomination}`;
  const bonus = `${baseDamage.bonus || ""}`.trim();
  if (bonus) {
    formula += /^[+\-]/.test(bonus) ? ` ${bonus}` : ` + ${bonus}`;
  }

  const rollData = actor.getRollData ? actor.getRollData() : {};
  const damageRoll = new Roll(formula, rollData);
  await damageRoll.evaluate({ async: true });
  return damageRoll;
}

async function buildGustoRollData(actor, blade, isCritical = false) {
  const baseDamage = blade.system?.damage?.base;
  if (!baseDamage?.number || !baseDamage?.denomination) {
    return { roll: null, prof: 0, hdType: null, displayFormula: null };
  }

  const diceNum = baseDamage.number;
  const diceDenom = baseDamage.denomination;

  let formula;
  let displayFormula;

  if (isCritical) {
    formula = `${diceNum}d${diceDenom} + ${diceNum}d${diceDenom}`;
    displayFormula = `${diceNum}d${diceDenom} (max) + ${diceNum}d${diceDenom}`;
  } else {
    formula = `${diceNum}d${diceDenom}`;
    displayFormula = `${diceNum}d${diceDenom}`;
  }

  const bonus = `${baseDamage.bonus || ""}`.trim();
  const conMod = actor.system?.abilities?.con?.mod ?? actor.getRollData?.()?.abilities?.con?.mod ?? 0;
  if (bonus) {
    formula += /^[+\-]/.test(bonus) ? ` ${bonus}` : ` + ${bonus}`;
    displayFormula += ` + ${conMod} (con)`;
  }

  const prof = actor.system?.attributes?.prof || 2;
  const hdData = getAvailableHitDice(actor);
  const hdType = hdData.largestType || null;
  if (prof > 0 && hdType) {
    if (isCritical) {
      formula += ` + ${prof}${hdType} + ${prof}${hdType}`;
      displayFormula += ` + ${prof}${hdType} (max) + ${prof}${hdType}`;
    } else {
      formula += ` + ${prof}${hdType}`;
      displayFormula += ` + ${prof}${hdType} (HD)`;
    }
  }

  const rollData = actor.getRollData ? actor.getRollData() : {};
  const roll = new Roll(formula, rollData);
  await roll.evaluate({ async: true });

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

  return { roll, prof, hdType, displayFormula };
}

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

async function rollHitDie(actor, message, hdType, originalAttackTotal, isCritical = false) {
  try {
    const roll = new Roll(`1${hdType}`);
    await roll.evaluate({ async: true });

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
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
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