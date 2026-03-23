// Add custom CSS for Bloodshed Blade buttons
if (!document.getElementById('bloodshed-blade-macro-style')) {
  const style = document.createElement('style');
  style.id = 'bloodshed-blade-macro-style';
  style.innerHTML = `
    .bloodshed-blade-btn-group {
      display: flex;
      gap: 4px;
    }
    .bloodshed-blade-invoke-btn {
      background-color: #8B0000;
      color: white;
      margin-top: 5px;
      width: 100%;
      border: none;
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
  `;
  document.head.appendChild(style);
}
/**
 * BLOODSHED BLADE RUNE INVOCATION MACRO
*
* This macro injects a "Spend Hit Die on Attack" button into attack roll messages
* from the Bloodshed Blade weapon, allowing post-roll Hit Die expenditure.
*/

console.log("Bloodshed Blade: Macro starting execution");

if (!game.bloodshedBladeHookRegistered) {
  console.log("Bloodshed Blade: Registering hook set");
  
  Hooks.on("createChatMessage", (message, options, userId) => {
    console.log("Bloodshed Blade: createChatMessage fired", message.id, message.type, message.isRoll);
  });
  
  Hooks.on("renderChatMessage", (message, html, data) => {
    console.log("Bloodshed Blade: renderChatMessage fired", message.id, message.type, message.isRoll);
    console.log("Bloodshed Blade: renderChatMessage full message", message);
    console.log("Bloodshed Blade: renderChatMessage html content", html.html());
    
    const actor = message.actor || game.actors.get(message.speaker?.actor);
    const isRoll = message.isRoll || !!message.rolls?.length || !!message.flags?.dnd5e?.roll;
    if (!actor || !isRoll) {
      console.log("Bloodshed Blade: skip - not roll or no actor", { actor: !!actor, isRoll });
      return;
    }
    
    const isAttackRoll = message.rolls?.some(r => r.options?.type === "attack") ||
    message.flags?.dnd5e?.roll?.type === "attack" ||
    html.text().toLowerCase().includes("attack");
    const hasName = !!(message.item?.name?.includes("Bloodshed Blade") ||
    message.flavor?.includes("Bloodshed Blade") ||
    message.flags?.dnd5e?.item?.name?.includes("Bloodshed Blade") ||
    html.text().includes("Bloodshed Blade"));
    const isBlade = isAttackRoll && hasName;
    
    console.log("Bloodshed Blade: detection", { isAttackRoll, hasName, isBlade });
    if (!isBlade) return;
    
    if (html.find("[data-action='bloodshed-spend-hd']").length) return;
    
    const attackData = extractAttackRollData(message);
    if (!attackData) return;
    
    const hdData = getAvailableHitDice(actor);
    const noHitDice = hdData.available <= 0;
    
    // Check if the Bloodshed Blade's Invoke Rune activity is expended
    let runeExpended = false;
    const activity = getInvokedRuneActivity(actor);
    if (activity) {
      const spent = parseInt(activity.uses?.spent || 0);
      if (spent > 0) runeExpended = true;
    }
    
    
    const button = createHitDieButton(
      message,
      attackData,
      noHitDice || runeExpended,
      noHitDice ? "No Hit Dice" 
      : runeExpended ? "Rune Expended" 
      : "Invoke Rune"
    );
    const undoButton = createUndoButton(message, attackData, runeExpended);
    const buttonGroup = `<div class="bloodshed-blade-btn-group">${button}${undoButton}</div>`;
    const cardButtons = html.find('.card-buttons');
    const messageContent = html.find('.message-content');
    
    if (cardButtons.length) {
      cardButtons.append(buttonGroup);
    } else if (messageContent.length) {
      // Foundry message structure may not have card-buttons; place near dice results
      const diceRoll = messageContent.find(".dice-roll");
      if (diceRoll.length) {
        diceRoll.after(buttonGroup);
      }
    } else {
      html.append(buttonGroup);
    }
  function createUndoButton(message, attackData, runeExpended = false) {
    // Only enable undo if rune is expended
    const isDisabledAttr = runeExpended ? "" : "disabled";
    const dataAction = runeExpended ? `data-action=\"bloodshed-undo-hd\"` : "";
    const dataMessageId = runeExpended ? `data-message-id=\"${message.id}\"` : "";
    const dataAttackTotal = runeExpended ? `data-attack-total=\"${attackData.total}\"` : "";
    const title = "Undo rune invocation and restore hit die";
    return `<button type=\"button\" class=\"btn btn-sm bloodshed-blade-undo-btn\" ${isDisabledAttr} ${dataAction} ${dataMessageId} ${dataAttackTotal} title=\"${title}\">` +
      `<i class=\"fas fa-undo\"></i>` +
      `</button>`;
  }
  });
  
  $(document).on("click", "[data-action='bloodshed-spend-hd']", async function (e) {
    e.preventDefault();
    // Disable the button and update appearance immediately after click
    this.disabled = true;
    this.style.backgroundColor = "#777";
    this.innerHTML = `<i class=\"fas fa-dice-d20\"></i> Rune Invoked`;

    // Enable the undo button
    const btnGroup = $(this).closest('.bloodshed-blade-btn-group');
    btnGroup.find('.bloodshed-blade-undo-btn').prop('disabled', false);

    const messageId = $(this).data("messageId");
    const attackTotal = Number($(this).data("attackTotal"));
    const message = game.messages.get(messageId);
    if (!message) return;
    
    const actor = message.actor ||
    (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null) ||
    (message.speaker?.token ? canvas?.tokens?.get(message.speaker.token)?.actor : null);
    
    if (!actor) {
      ui.notifications.error("Bloodshed Blade: Unable to determine actor for this attack.");
      return;
    }

    const hdData = getAvailableHitDice(actor);
    if (hdData.available <= 0) {
      ui.notifications.warn("No Hit Dice available to spend!");
      return;
    }

    await rollHitDie(actor, message, hdData.largestType, attackTotal);
  });

  // Undo button handler
  $(document).on("click", "[data-action='bloodshed-undo-hd']", async function (e) {
    e.preventDefault();
    this.disabled = true;

    // Re-enable the invoke button
    const btnGroup = $(this).closest('.bloodshed-blade-btn-group');
    const invokeBtn = btnGroup.find('.bloodshed-blade-invoke-btn');
    invokeBtn.prop('disabled', false);
    invokeBtn.css('background-color', '#8B0000');
    invokeBtn.html('<i class="fas fa-dice-d20"></i> Invoke Rune');

    const messageId = $(this).data("messageId");
    const message = game.messages.get(messageId);
    if (!message) return;

    const actor = message.actor ||
      (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null) ||
      (message.speaker?.token ? canvas?.tokens?.get(message.speaker.token)?.actor : null);
    if (!actor) {
      ui.notifications.error("Bloodshed Blade: Unable to determine actor for this attack.");
      return;
    }

    // Undo rune expended and hit die spent
    await unmarkRuneAsExpended(actor);
    await unmarkHitDieExpended(actor);
    ui.notifications.info('Rune invocation and hit die expenditure have been undone.');
  });
// Undo helpers
async function unmarkRuneAsExpended(actor) {
  const activity = getInvokedRuneActivity(actor);
  if (activity) {
    const path = `system.activities.PXjk4FsU2X7ClsFN.uses.spent`;
    const currentSpent = activity.uses?.spent || 0;
    const item = actor.items?.getName?.("Bloodshed Blade");
    if (currentSpent > 0) {
      await item.update({ [path]: currentSpent - 1 });
    }
  }
}

async function unmarkHitDieExpended(actor) {
  const classes = actor.classes || {};
  for (const [key, cls] of Object.entries(classes)) {
    const spent = cls.system?.hd?.spent || 0;
    if (spent > 0) {
      const path = `system.classes.${key}.hd.spent`;
      await actor.update({ [path]: spent - 1 });
      break;
    }
  }
}

  game.bloodshedBladeHookRegistered = true;
}

function extractAttackRollData(message) {
  if (!message.rolls?.length) return null;
  const rollData = message.rolls[0]?.toJSON?.() || message.rolls[0];
  if (!rollData || typeof rollData.total !== 'number') return null;
  return { total: rollData.total, formula: rollData.formula, rollId: message.id };
}

function createHitDieButton(message, attackData, disabled = false, buttonText = "Invoke Rune") {
  const isDisabledAttr = disabled ? "disabled" : "";
  const dataAction = disabled ? "" : `data-action=\"bloodshed-spend-hd\"`;
  const dataMessageId = disabled ? "" : `data-message-id=\"${message.id}\"`;
  const dataAttackTotal = disabled ? "" : `data-attack-total=\"${attackData.total}\"`;
  const title = disabled ? buttonText : "Invoke the blade's rune to add a Hit Die to your attack roll";
  return `<button type=\"button\" class=\"btn btn-sm bloodshed-blade-invoke-btn\" ${isDisabledAttr} ${dataAction} ${dataMessageId} ${dataAttackTotal} title=\"${title}\">` +
    `<i class=\"fas fa-dice-d20\"></i> ${buttonText}` +
    `</button>`;
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
    if (denomination) {
      const available = level - spent;
      if (available > 0) {
        totalAvailable += available;
        const dieValue = parseInt(denomination.slice(1));
        if (dieValue > largestValue) {
          largestValue = dieValue;
          largestType = denomination;
        }
      }
    }
  }

  return { available: totalAvailable, largestType };
}

function getInvokedRuneActivity(actor) {
    const item = actor.items?.getName?.("Bloodshed Blade");
    if (!item) { return {}; }
 
    const activities = item.system?.activities || {};
    const activity = activities.get("PXjk4FsU2X7ClsFN");
    
    return activity;
}

async function rollHitDie(actor, message, hdType, originalAttackTotal) {
  try {
    const roll = new Roll(`1${hdType}`);
    await roll.evaluate({ async: true });
    
    const hdResult = roll.total;

   const newTotal = originalAttackTotal + hdResult;
    
    await roll.toMessage({
      author: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div style="border-left: 4px solid #8B0000; padding-left: 10px; margin: 10px 0;">` +
      `<p><strong style="color: #8B0000;">Rune Invoked</strong></p>` +
      `<p>Original Attack Roll: <strong>${originalAttackTotal}</strong></p>` +
      `<p>+ Spent Hit Die Roll: <strong>${hdResult}</strong> (1${hdType})</p>` +
      `<p style="font-size: 1.1em; font-weight: bold;">New Attack Total:</p>` + 
      `<p style="color: #8B0000;font-size: 2em;">${newTotal}</p>` +
      `</div>`,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });

    ui.notifications.info(`Rune invoked! Attack bonus: +${hdResult} (new total: ${newTotal})`);
  } catch (err) {
    console.error('Bloodshed Blade Rune Error', err);
    ui.notifications.error('Error invoking rune. Check console.');
    return;
  } 

  await markRuneAsExpended(actor);
  await markHitDieExpended(actor);
}

async function markRuneAsExpended(actor) {
  const activity = getInvokedRuneActivity(actor);
  if (activity) {
      const path = `system.activities.PXjk4FsU2X7ClsFN.uses.spent`;
      const currentSpent = activity.uses?.spent || 0;
      const item = actor.items?.getName?.("Bloodshed Blade");
      await item.update({ [path]: currentSpent + 1 });
  }
}

async function markHitDieExpended(actor) {
  const hdData = getAvailableHitDice(actor);
  if (hdData.available > 0) {
    const classes = actor.classes || {};
    for (const [key, cls] of Object.entries(classes)) {
      const level = cls.system?.levels || 0;
      const spent = cls.system?.hd?.spent || 0;
      if (level - spent > 0) {
        const path = `system.classes.${key}.hd.spent`;
        await actor.update({ [path]: spent + 1 });
        break;
      }
    }
  }
}