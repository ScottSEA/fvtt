/**
 * TEST CRIT ATTACK
 *
 * Rolls a fake critical hit attack message against the current target
 * (or self if no target) for testing adamantine armor and other crit-reaction macros.
 */
const MACRO_ICON = "fa-burst";
(async () => {
  const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
  if (!actor) {
    ui.notifications.warn("Select a token first.");
    return;
  }

  const target = game.user.targets.first() ?? canvas.tokens.controlled[0];
  const targetUuid = target?.document?.uuid ?? target?.uuid ?? null;

  const roll = new Roll("1d20 + 5");
  await roll.evaluate();

  // Force the d20 to 20
  const d20 = roll.terms.find(t => t.faces === 20);
  if (d20?.results?.[0]) {
    const oldResult = d20.results[0].result;
    d20.results[0].result = 20;
    d20._total = 20;
    roll._total = roll._total - oldResult + 20;
  }

  const targets = targetUuid ? [{ uuid: targetUuid, ac: 10 }] : [];

  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: `Unarmed Strike — Test Crit`,
    flags: {
      dnd5e: {
        roll: { type: "attack", isCritical: true },
        targets,
      }
    }
  });

  ui.notifications.info("Test crit attack posted!");
})();
// END: TEST CRIT ATTACK
