/**
 * DANGER SENSE MACRO
 *
 * Injects a reminder into the dnd5e DEX saving throw dialog that the
 * character has advantage from Danger Sense.
 *
 * RAW (Barbarian): "You have advantage on Dexterity saving throws against
 * effects that you can see, such as traps and spells. To gain this benefit,
 * you can't be blinded, deafened, or incapacitated."
 */

const MACRO_ICON = "fa-triangle-exclamation";
const DANGER_SENSE_HOOK_FLAG = "dangerSenseHookRegistered";
const DANGER_SENSE_PENDING_KEY = "_dangerSensePending";

const HOOK_PRE_ROLL = "dnd5e.preRollSavingThrowV2";
const HOOK_RENDER_DIALOG = "renderRollConfigurationDialog";

const SEL_BUTTONS = ".dialog-buttons";
const SEL_ADVANTAGE = "[data-action='advantage']";
const ABILITY_DEX = "dex";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[DANGER_SENSE_HOOK_FLAG]) return;
  const prev = game[DANGER_SENSE_HOOK_FLAG];
  if (prev.preRollHookId != null) Hooks.off(HOOK_PRE_ROLL, prev.preRollHookId);
  if (prev.renderHookId != null) Hooks.off(HOOK_RENDER_DIALOG, prev.renderHookId);
  console.log("Danger Sense macro torn down.");
}

function register() {
  const preRollHookId = Hooks.on(HOOK_PRE_ROLL, onPreRollSavingThrow);
  const renderHookId = Hooks.on(HOOK_RENDER_DIALOG, onRenderDialog);
  game[DANGER_SENSE_HOOK_FLAG] = { preRollHookId, renderHookId };
  console.log("Danger Sense macro loaded.");
}

// ─── Pre-Roll Hook: Flag for Dialog Injection ────────────────────────────────

function onPreRollSavingThrow(config, dialog, message) {
  const actor = config.subject;
  if (!actor?.isOwner) return;
  if (config.ability !== ABILITY_DEX) return;

  // Only trigger if the actor actually has the Danger Sense feature
  if (!actor.items?.some(i => i.name === "Danger Sense" && i.type === "feat")) return;

  game[DANGER_SENSE_PENDING_KEY] = true;
}

// ─── Dialog Injection ────────────────────────────────────────────────────────

const BANNER_STYLE =
  `color:white; padding:6px 10px; border-radius:4px; ` +
  `margin:0 0 8px; text-align:center; font-size:12px; background:#1a3a5c;`;

function onRenderDialog(app, html) {
  if (!game[DANGER_SENSE_PENDING_KEY]) return;
  delete game[DANGER_SENSE_PENDING_KEY];

  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  const buttons = el.querySelector(SEL_BUTTONS);
  if (!buttons) return;

  const advButton = buttons.querySelector(SEL_ADVANTAGE);
  if (!advButton) return;

  const banner = document.createElement("div");
  banner.style.cssText = BANNER_STYLE;
  banner.innerHTML =
    `<h3 style="margin:0 0 4px;">⚡ Danger Sense Active</h3>` +
    `<p style="margin:0;">You have <strong>Advantage</strong>!</p>`;
  buttons.insertAdjacentElement("beforebegin", banner);

  // Highlight ADVANTAGE button to match the banner
  if (advButton) {
    advButton.style.background = "#1a3a5c";
    advButton.style.color = "white";
    advButton.style.borderColor = "#1a3a5c";
  }
}
// END: DANGER SENSE MACRO
