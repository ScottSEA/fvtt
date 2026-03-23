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
    console.log("Bloodshed Blade: renderChatMessage fired", message.id, message.type, message.isRoll);

    const actor = resolveActorFromMessage(message);
    const isRoll = message.isRoll || !!message.rolls?.length || !!message.flags?.dnd5e?.roll;
    if (!actor || !isRoll) {
      console.log("Bloodshed Blade: skip - not roll or no actor", { actor: !!actor, isRoll });
      return;
    }

    if (!isBloodshedBladeAttackMessage(message, html)) return;
    if (html.find("[data-action='bloodshed-spend-hd']").length) return;

    const attackData = extractAttackRollData(message);
    if (!attackData) return;

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

    const cardButtons = html.find(".card-buttons");
    const messageContent = html.find(".message-content");

    if (cardButtons.length) {
      cardButtons.append(buttonGroup);
      return;
    }

    if (messageContent.length) {
      const diceRoll = messageContent.find(".dice-roll");
      if (diceRoll.length) {
        diceRoll.after(buttonGroup);
        return;
      }
    }

    html.append(buttonGroup);
  });

  $(document).on("click", "[data-action='bloodshed-spend-hd']", async function (event) {
    event.preventDefault();

    const button = this;
    const messageId = $(button).data("messageId");
    const attackTotal = Number($(button).data("attackTotal"));
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

    setInvokeButtonState(button, true, "Rune Invoked");
    $(button).closest(".bloodshed-blade-btn-group").find(".bloodshed-blade-undo-btn").prop("disabled", false);

    await rollHitDie(actor, message, hdData.largestType, attackTotal);
  });

  $(document).on("click", "[data-action='bloodshed-undo-hd']", async function (event) {
    event.preventDefault();

    const button = this;
    const messageId = $(button).data("messageId");
    const message = game.messages.get(messageId);
    if (!message) return;

    const actor = resolveActorFromMessage(message);
    if (!actor) {
      ui.notifications.error("Bloodshed Blade: Unable to determine actor for this attack.");
      return;
    }

    await unmarkRuneAsExpended(actor);
    await unmarkHitDieExpended(actor);

    const buttonGroup = $(button).closest(".bloodshed-blade-btn-group");
    const invokeButton = buttonGroup.find(".bloodshed-blade-invoke-btn").get(0);
    if (invokeButton) {
      setInvokeButtonState(invokeButton, false, "Invoke Rune");
    }
    $(button).prop("disabled", true);

    ui.notifications.info("Rune invocation and hit die expenditure have been undone.");
  });

  $(document).on("click", "[data-action='bloodshed-gusto-damage']", async function (event) {
    event.preventDefault();

    const actorId = $(this).data("actorId");
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

    const gustoRollData = await buildGustoRollData(actor, blade);
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

function isBloodshedBladeAttackMessage(message, html) {
  const isAttackRoll = message.rolls?.some((roll) => roll.options?.type === "attack") ||
    message.flags?.dnd5e?.roll?.type === "attack" ||
    html.text().toLowerCase().includes("attack");

  const hasName = !!(
    message.item?.name?.includes(BLOODSHED_BLADE_ITEM_NAME) ||
    message.flavor?.includes(BLOODSHED_BLADE_ITEM_NAME) ||
    message.flags?.dnd5e?.item?.name?.includes(BLOODSHED_BLADE_ITEM_NAME) ||
    html.text().includes(BLOODSHED_BLADE_ITEM_NAME)
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

  return `<button type="button" class="btn btn-sm bloodshed-blade-invoke-btn" ${isDisabledAttr} data-action="bloodshed-spend-hd" data-message-id="${message.id}" data-attack-total="${attackData.total}" title="${title}">` +
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

function createGustoButtonForOutput(actor) {
  const dataAction = `data-action="bloodshed-gusto-damage"`;
  const dataActorId = actor.id ? `data-actor-id="${actor.id}"` : "";
  const title = "Attack with Gusto! Roll damage + proficiency hit dice.";

  return `<button type="button" class="btn btn-sm bloodshed-blade-gusto-btn" ${dataAction} ${dataActorId} title="${title}">` +
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

async function buildGustoRollData(actor, blade) {
  const baseDamage = blade.system?.damage?.base;
  if (!baseDamage?.number || !baseDamage?.denomination) {
    return { roll: null, prof: 0, hdType: null, displayFormula: null };
  }

  let formula = `${baseDamage.number}d${baseDamage.denomination}`;
  let displayFormula = `${baseDamage.number}d${baseDamage.denomination}`;
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
    formula += ` + ${prof}${hdType}`;
    displayFormula += ` + ${prof}${hdType} (HD)`;
  }

  const rollData = actor.getRollData ? actor.getRollData() : {};
  const roll = new Roll(formula, rollData);
  await roll.evaluate({ async: true });

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

async function rollHitDie(actor, message, hdType, originalAttackTotal) {
  try {
    const roll = new Roll(`1${hdType}`);
    await roll.evaluate({ async: true });

    const hdResult = roll.total;
    const newTotal = originalAttackTotal + hdResult;
    const gustoButton = createGustoButtonForOutput(actor);

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
  await markHitDieExpended(actor);
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

async function markHitDieExpended(actor) {
  const hdData = getAvailableHitDice(actor);
  if (hdData.available <= 0) return;

  const classes = actor.classes || {};
  for (const [key, cls] of Object.entries(classes)) {
    const level = cls.system?.levels || 0;
    const spent = cls.system?.hd?.spent || 0;
    if (level - spent <= 0) continue;

    const path = `system.classes.${key}.hd.spent`;
    await actor.update({ [path]: spent + 1 });
    break;
  }
}

async function unmarkHitDieExpended(actor) {
  const classes = actor.classes || {};
  for (const [key, cls] of Object.entries(classes)) {
    const spent = cls.system?.hd?.spent || 0;
    if (spent <= 0) continue;

    const path = `system.classes.${key}.hd.spent`;
    await actor.update({ [path]: spent - 1 });
    break;
  }
}