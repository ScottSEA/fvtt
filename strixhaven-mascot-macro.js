/**
 * CUDDLY STRIXHAVEN MASCOT MACRO
 *
 * Injects a reminder into the dnd5e saving throw dialog so the player can
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
  if (prev.preRollHookId != null) Hooks.off("dnd5e.preRollSavingThrowV2", prev.preRollHookId);
  if (prev.rollHookId != null) Hooks.off("dnd5e.rollAbilitySaveV2", prev.rollHookId);
  if (prev.renderHookId != null) Hooks.off("renderDialog", prev.renderHookId);
  console.log("Cuddly Strixhaven Mascot macro torn down.");
}

function register() {
  const preRollHookId = Hooks.on("dnd5e.preRollSavingThrowV2", onpreRollSavingThrow);
  const rollHookId = Hooks.on("dnd5e.rollAbilitySaveV2", onRollAbilitySave);
  const renderHookId = Hooks.on("renderDialog", onRenderDialog);
  game[MASCOT_HOOK_FLAG] = { preRollHookId, rollHookId, renderHookId };
  console.log("Cuddly Strixhaven Mascot macro loaded.");
}

// ─── Pre-Roll Hook: Flag for Dialog Injection ────────────────────────────────

function onpreRollSavingThrow(actor, config, abilityId) {
  const mascot = getEquippedMascot(actor);
  if (!mascot) return;

  game._strixhavenMascotPending = {
    hasUses: getMascotUsesRemaining(mascot) > 0,
  };
}

// ─── Dialog Injection ────────────────────────────────────────────────────────

function onRenderDialog(app, html) {
  const pending = game._strixhavenMascotPending;
  if (!pending) return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  const buttons = el.querySelector(".dialog-buttons");
  if (!buttons) return;

  const advButton = buttons.querySelector("[data-button='advantage']");
  if (!advButton) return;

  delete game._strixhavenMascotPending;

  const message = pending.hasUses
    ? "🧸 Strixhaven Mascot equipped — choose Advantage if this save is vs Frightened"
    : "🧸 Strixhaven Mascot — no uses remaining (resets on long rest)";
  const bgColor = pending.hasUses ? "#2e6b30" : "#6b3a2e";

  const reminder = document.createElement("div");
  reminder.style.cssText =
    `background:${bgColor}; color:white; padding:6px 10px; border-radius:4px; ` +
    `margin:8px 0; text-align:center; font-size:12px;`;
  reminder.textContent = message;

  buttons.insertAdjacentElement("beforebegin", reminder);
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

  confirmMascotUsage(actor, mascot);
}

async function confirmMascotUsage(actor, mascot) {
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
