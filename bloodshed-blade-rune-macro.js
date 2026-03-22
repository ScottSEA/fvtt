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
    const runeUsed = hasUsedRune(actor);

    const button = createHitDieButton(
      message,
      attackData,
      noHitDice || runeUsed,
      noHitDice ? "No Hit Dice" : runeUsed ? "Can't Invoke Rune Until Dawn" : "Invoke Rune"
    );
    const cardButtons = html.find('.card-buttons');
    const messageContent = html.find('.message-content');

    if (cardButtons.length) {
      cardButtons.append(button);
    } else if (messageContent.length) {
      // Foundry message structure may not have card-buttons; place near dice results
      const diceRoll = messageContent.find(".dice-roll");
      if (diceRoll.length) {
        diceRoll.after(button);
      } else {
        messageContent.append(button);
      }
    } else {
      html.append(button);
    }
  });

  $(document).on("click", "[data-action='bloodshed-spend-hd']", async function (e) {
    e.preventDefault();
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

    const runeUsed = hasUsedRune(actor);
    if (runeUsed) {
      ui.notifications.warn("Bloodshed Blade: Rune already invoked today (next dawn). ");
      return;
    }

    const hdData = getAvailableHitDice(actor);
    if (hdData.available <= 0) {
      ui.notifications.warn("No Hit Dice available to spend!");
      return;
    }

    await spendHitDieAndRoll(actor, message, hdData.largestType, attackTotal);
  });

  game.bloodshedBladeHookRegistered = true;
}

function extractAttackRollData(message) {
  if (!message.rolls?.length) return null;
  const rollData = message.rolls[0]?.toJSON?.() || message.rolls[0];
  if (!rollData || typeof rollData.total !== 'number') return null;
  return { total: rollData.total, formula: rollData.formula, rollId: message.id };
}

function createHitDieButton(message, attackData, disabled = false, buttonText = "Invoke Rune") {
  const btnColor = disabled ? "#777" : "#8B0000";
  const isDisabledAttr = disabled ? "disabled" : "";
  const dataAction = disabled ? "" : `data-action="bloodshed-spend-hd"`;
  const dataMessageId = disabled ? "" : `data-message-id="${message.id}"`;
  const dataAttackTotal = disabled ? "" : `data-attack-total="${attackData.total}"`;
  const title = disabled ? buttonText : "Invoke the blade's rune to add a Hit Die to your attack roll";

  return `<button type="button" class="btn btn-sm" style="background-color: ${btnColor}; color: white; margin-top: 5px; width: 100%;" ${isDisabledAttr} ${dataAction} ${dataMessageId} ${dataAttackTotal} title="${title}">` +
    `<i class="fas fa-dice-d20"></i> ${buttonText}` +
    `</button>`;
}

function getCurrentDateString() {
  const worldTime = game.time?.worldTime;
  const date = worldTime ? new Date(worldTime * 1000) : new Date();
  return date.toISOString().slice(0, 10);
}

function hasUsedRune(actor) {
  const lastUsed = actor.getFlag("dnd5e", "bloodshedBladeRuneLastUsed");
  if (!lastUsed) return false;
  return lastUsed === getCurrentDateString();
}

function markRuneUsed(actor) {
  return actor.setFlag("dnd5e", "bloodshedBladeRuneLastUsed", getCurrentDateString());
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

async function spendHitDieAndRoll(actor, message, hdType, originalAttackTotal) {
  try {
    const roll = new Roll(`1${hdType}`);
    await roll.evaluate({ async: true });
    const hdResult = roll.total;

    // Find the class with the matching denomination and increment spent
    const classes = actor.classes || {};
    for (const [key, cls] of Object.entries(classes)) {
      if (cls.system?.hd?.denomination === hdType) {
        const currentSpent = cls.system.hd.spent || 0;
        await cls.update({ "system.hd.spent": currentSpent + 1 });
        break; // Assume only one class has this denomination, or update the first
      }
    }

    const newTotal = originalAttackTotal + hdResult;
    await markRuneUsed(actor);
    await ChatMessage.create({
      author: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div style="border-left: 4px solid #8B0000; padding-left: 10px; margin: 10px 0;">` +
        `<p><strong style="color: #8B0000;">Bloodshed Blade - Rune Invoked</strong></p>` +
        `<p>Spent Hit Die: <strong>${hdResult}</strong> (rolled 1${hdType})</p>` +
        `<p>Original Attack Roll: <strong>${originalAttackTotal}</strong></p>` +
        `<p style="font-size: 1.1em; font-weight: bold;">New Attack Total: <strong style="color: #8B0000;">${newTotal}</strong></p>` +
        `</div>`,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER
    });

    ui.notifications.info(`Rune invoked! Attack bonus: +${hdResult} (new total: ${newTotal})`);
  } catch (err) {
    console.error('Bloodshed Blade Rune Error', err);
    ui.notifications.error('Error invoking rune. Check console.');
  }
}

ui.notifications.info('✓ Bloodshed Blade Rune Macro loaded. Attack with the blade to see the button!');
