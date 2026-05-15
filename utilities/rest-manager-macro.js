/**
 * REST MANAGER MACRO
 *
 * Shows a dialog with Short Rest / Long Rest buttons. Calls the dnd5e
 * system's built-in rest methods and displays a summary of what was
 * recovered.
 */

const MACRO_ICON = "fa-bed";

(async () => {
  // Resolve actor
  const actor =
    canvas.tokens.controlled[0]?.actor ??
    game.user.character;

  if (!actor) {
    ui.notifications.warn("Rest Manager: select or assign a token first.");
    return;
  }

  const dialogContent = `
<div style="text-align:center;padding:8px 0;">
  <p style="margin:0 0 8px 0;font-size:14px;color:#ddd;">
    <strong>${actor.name}</strong> — choose a rest type:
  </p>
</div>`;

  new Dialog({
    title: "Rest Manager",
    content: dialogContent,
    buttons: {
      short: {
        icon: '<i class="fas fa-mug-hot"></i>',
        label: "Short Rest",
        callback: () => doRest(actor, "short"),
      },
      long: {
        icon: '<i class="fas fa-bed"></i>',
        label: "Long Rest",
        callback: () => doRest(actor, "long"),
      },
    },
    default: "short",
  }).render(true);
})();

async function doRest(actor, type) {
  try {
    const hpBefore = actor.system.attributes.hp.value;
    const hdBefore = countHitDice(actor);

    let result;
    if (type === "short") {
      result = await actor.shortRest({ dialog: true });
    } else {
      result = await actor.longRest({ dialog: true });
    }

    // If the user cancelled the rest dialog, result is falsy
    if (!result) return;

    const hpAfter = actor.system.attributes.hp.value;
    const hdAfter = countHitDice(actor);
    const hpRecovered = hpAfter - hpBefore;
    const hdRecovered = hdAfter - hdBefore;

    const label = type === "short" ? "Short Rest" : "Long Rest";
    const icon = type === "short" ? "fa-mug-hot" : "fa-bed";

    const content = `
<div style="border:1px solid #4b4a44;border-radius:6px;padding:8px 10px;background:#1a1a1a;color:#ddd;font-size:13px;">
  <div style="font-size:15px;font-weight:bold;margin-bottom:6px;color:#8abeb7;">
    <i class="fas ${icon}" style="margin-right:4px;"></i> ${actor.name} — ${label} Complete
  </div>
  <ul style="list-style:none;padding:0;margin:0;">
    <li>❤️ HP recovered: <strong>${hpRecovered >= 0 ? "+" : ""}${hpRecovered}</strong> (now ${hpAfter})</li>
    <li>🎲 Hit Dice recovered: <strong>${hdRecovered >= 0 ? "+" : ""}${hdRecovered}</strong> (now ${hdAfter})</li>
  </ul>
</div>`;

    ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor }),
    });
  } catch (err) {
    console.error("Rest Manager |", err.message);
    ui.notifications.error(`Rest Manager: ${err.message}`);
  }
}

function countHitDice(actor) {
  let total = 0;
  for (const cls of actor.items.filter((i) => i.type === "class")) {
    const hd = cls.system?.hitDice?.value ?? cls.system?.levels ?? 0;
    if (typeof hd === "number") total += hd;
  }
  return total;
}
// END: REST MANAGER MACRO
