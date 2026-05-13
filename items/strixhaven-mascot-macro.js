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

const MACRO_ICON = "fa-paw";
const MASCOT_ITEM_NAME = "Cuddly Strixhaven Mascot";
const MASCOT_HOOK_FLAG = "strixhavenMascotHookRegistered";
const MASCOT_PENDING_KEY = "_strixhavenMascotPending";

const HOOK_PRE_ROLL = "dnd5e.preRollSavingThrowV2";
const HOOK_RENDER_DIALOG = "renderRollConfigurationDialog";

const SEL_BUTTONS = ".dialog-buttons";
const SEL_ADVANTAGE = "[data-action='advantage']";
const ABILITY_WIS = "wis";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[MASCOT_HOOK_FLAG]) return;
  const prev = game[MASCOT_HOOK_FLAG];
  if (prev.preRollHookId != null) Hooks.off(HOOK_PRE_ROLL, prev.preRollHookId);
  if (prev.renderHookId != null) Hooks.off(HOOK_RENDER_DIALOG, prev.renderHookId);
  console.log("Cuddly Strixhaven Mascot macro torn down.");
}

function register() {
  const preRollHookId = Hooks.on(HOOK_PRE_ROLL, onPreRollSavingThrow);
  const renderHookId = Hooks.on(HOOK_RENDER_DIALOG, onRenderDialog);
  game[MASCOT_HOOK_FLAG] = { preRollHookId, renderHookId };
  console.log("Cuddly Strixhaven Mascot macro loaded.");
}

// ─── Pre-Roll Hook: Flag for Dialog Injection ────────────────────────────────

function onPreRollSavingThrow(config, dialog, message) {
  const actor = config.subject;
  if (!actor) return;
  if (config.ability !== ABILITY_WIS) return;
  const mascot = getEquippedMascot(actor);
  if (!mascot) return;

  game[MASCOT_PENDING_KEY] = {
    mascot,
    hasUses: getMascotUsesRemaining(mascot) > 0,
  };
}

// ─── Dialog Injection ────────────────────────────────────────────────────────

const BASE_BANNER_STYLE =
  `color:white; padding:6px 10px; border-radius:4px; ` +
  `margin:0 0 8px; text-align:center; font-size:12px;`;

function onRenderDialog(app, html) {
  const pending = game[MASCOT_PENDING_KEY];
  if (!pending) return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  const buttons = el.querySelector(SEL_BUTTONS);
  if (!buttons) return;

  const advButton = buttons.querySelector(SEL_ADVANTAGE);
  if (!advButton) return;

  delete game[MASCOT_PENDING_KEY];

  const banner = pending.hasUses
    ? buildMascotButton(pending.mascot, advButton)
    : buildNoUsesNotice();
  buttons.insertAdjacentElement("beforebegin", banner);
}

function buildMascotButton(mascot, advButton) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.style.cssText =
    `${BASE_BANNER_STYLE} background:#2e6b30; width:100%; ` +
    `border:1px solid #4a9; cursor:pointer; display:flex; flex-direction:column; align-items:center;`;
  btn.innerHTML =
    `<h3 style="margin:0 0 4px;">🧸 Strixhaven Mascot Advantage</h3>` +
    `<p style="margin:0;">Click here to roll against <strong>FRIGHTENED</strong></p>`;
  btn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await consumeMascotUse(mascot);
    ui.notifications.info("🧸 Strixhaven Mascot use consumed — resets on long rest");
    advButton.click();
  });
  return btn;
}

function buildNoUsesNotice() {
  const notice = document.createElement("div");
  notice.style.cssText = `${BASE_BANNER_STYLE} background:#6b3a2e;`;
  notice.innerHTML =
    `<h3 style="margin:0 0 4px;">🧸 Strixhaven Mascot</h3>` +
    `<p style="margin:0;">no uses remaining (resets on long rest)</p>`;
  return notice;
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
  if (!uses || uses.max == null) {
    console.warn(
      "Strixhaven Mascot: Item uses not configured. " +
      "Set max uses to 1 with 'Long Rest' recovery for automatic tracking."
    );
    return 1;
  }
  return (uses.max - (uses.spent ?? 0));
}

// ─── Item Use ────────────────────────────────────────────────────────────────

async function consumeMascotUse(mascot) {
  const uses = mascot.system?.uses;
  if (!uses || uses.max == null || uses.max === 0) return;
  const spent = uses.spent ?? 0;
  if (spent >= uses.max) return;
  await mascot.update({ "system.uses.spent": spent + 1 });
}
// END: CUDDLY STRIXHAVEN MASCOT MACRO
