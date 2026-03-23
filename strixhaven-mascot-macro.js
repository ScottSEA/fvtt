/**
 * CUDDLY STRIXHAVEN MASCOT MACRO
 *
 * Hooks into the dnd5e saving throw dialog to remind the player they can
 * choose advantage on saves against the Frightened condition.
 *
 * RAW: "When you make a saving throw to avoid or end the frightened condition
 * on yourself, you can give yourself advantage on the roll if the toy is on
 * your person. You must decide to do so before rolling the d20. If the save
 * succeeds, you can't use the toy in this way until you finish a long rest."
 *
 * Uses are tracked via the item's system.uses (max: 1, recovery: Long Rest).
 */

const MASCOT_ITEM_NAME = "Cuddly Strixhaven Mascot";
const MASCOT_HOOK_FLAG = "strixhavenMascotHookRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[MASCOT_HOOK_FLAG]) return;
  const prev = game[MASCOT_HOOK_FLAG];
  if (prev.preRollHookId != null) Hooks.off("dnd5e.preRollAbilitySave", prev.preRollHookId);
  if (prev.rollHookId != null) Hooks.off("dnd5e.rollAbilitySave", prev.rollHookId);
}

function register() {
  const preRollHookId = Hooks.on("dnd5e.preRollAbilitySave", onPreRollAbilitySave);
  const rollHookId = Hooks.on("dnd5e.rollAbilitySave", onRollAbilitySave);
  game[MASCOT_HOOK_FLAG] = { preRollHookId, rollHookId };
}

// ─── Pre-Roll Hook: Reminder ─────────────────────────────────────────────────

function onPreRollAbilitySave(actor, config, abilityId) {
  const mascot = getEquippedMascot(actor);
  if (!mascot) return;

  const uses = getMascotUsesRemaining(mascot);
  if (uses <= 0) {
    ui.notifications.info(
      `🧸 Strixhaven Mascot equipped — no uses remaining (resets on long rest)`
    );
    return;
  }

  ui.notifications.info(
    `🧸 Strixhaven Mascot equipped — choose Advantage if this save is vs Frightened`
  );
}

// ─── Post-Roll Hook: Consume Use ─────────────────────────────────────────────

function onRollAbilitySave(actor, roll, abilityId) {
  const mascot = getEquippedMascot(actor);
  if (!mascot) return;
  if (getMascotUsesRemaining(mascot) <= 0) return;

  const wasAdvantage = roll.options?.advantageMode === 1 ||
    roll.hasAdvantage === true ||
    roll.options?.advantage === true;
  if (!wasAdvantage) return;

  // Player chose advantage — check if it succeeded (met or beat DC)
  // We can't reliably know the DC, so we prompt the player to confirm usage
  confirmMascotUsage(actor, mascot, roll);
}

async function confirmMascotUsage(actor, mascot, roll) {
  const confirmed = await Dialog.confirm({
    title: "Cuddly Strixhaven Mascot",
    content:
      `<p>Was this saving throw against the <strong>Frightened</strong> condition?</p>` +
      `<p>If so and the save <strong>succeeded</strong>, the mascot's use will be consumed ` +
      `(resets on long rest).</p>`,
    yes: () => true,
    no: () => false,
    defaultYes: false,
  });

  if (!confirmed) return;

  await consumeMascotUse(mascot);
  ui.notifications.info(`🧸 Strixhaven Mascot use consumed — resets on long rest`);
}

// ─── Item Detection ──────────────────────────────────────────────────────────

function getEquippedMascot(actor) {
  const mascot = actor.items?.getName?.(MASCOT_ITEM_NAME);
  if (!mascot) return null;
  if (mascot.system?.equipped !== true) return null;
  return mascot;
}

function getMascotUsesRemaining(mascot) {
  const uses = mascot.system?.uses;
  if (!uses || uses.max == null || uses.max === 0) {
    console.warn(
      "Strixhaven Mascot: Item uses not configured. " +
      "Set max uses to 1 with 'Long Rest' recovery for automatic tracking."
    );
    return 1;
  }
  return uses.value ?? 0;
}

// ─── Item Use ────────────────────────────────────────────────────────────────

async function consumeMascotUse(mascot) {
  const uses = mascot.system?.uses;
  if (!uses || uses.max == null || uses.max === 0) return;
  const current = uses.value ?? 0;
  if (current <= 0) return;
  await mascot.update({ "system.uses.value": current - 1 });
}
