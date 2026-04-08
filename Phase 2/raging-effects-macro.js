/**
 * RAGING EFFECTS MACRO
 *
 * While raging, injects a "RAGING! You have Advantage!" banner into
 * STR saving throw and STR ability/skill check roll dialogs.
 *
 * RAW (Barbarian): "You have Advantage on Strength checks and Strength
 * saving throws."
 *
 * Uses single-hook approach: reads app.config directly in the render hook
 * to detect roll type and ability — avoids fragile two-hook pending-key timing.
 *
 * Hooks:
 *   - renderRollConfigurationDialog — detects STR rolls + banner injection
 *
 * Set RE_DEBUG = true in the console to log hook traffic.
 */

let RE_DEBUG = false;

const RE_HOOK_FLAG = "ragingEffectsHookRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[RE_HOOK_FLAG]) return;
  const prev = game[RE_HOOK_FLAG];
  if (prev.renderHookId != null) Hooks.off("renderRollConfigurationDialog", prev.renderHookId);
  console.log("Raging Effects macro torn down.");
}

function register() {
  const renderHookId = Hooks.on("renderRollConfigurationDialog", onRenderDialog);
  game[RE_HOOK_FLAG] = { renderHookId };
  console.log("Raging Effects macro loaded.");
}

// ─── Dialog Banner (single-hook approach) ────────────────────────────────────

const BANNER_STYLE =
  `color:white; padding:6px 10px; border-radius:4px; ` +
  `margin:0 0 8px; text-align:center; font-size:12px; background:#8b1a1a;`;

function onRenderDialog(app, html) {
  const config = app.config;
  if (!config) return;

  // Skip attack rolls (subject is an Activity, not an Actor)
  const hookNames = config.hookNames ?? [];
  if (hookNames.includes("attack")) return;

  // Must be a STR roll
  if (config.ability !== "str") return;

  // Get the actor — for non-attack rolls, subject is the Actor
  const actor = config.subject;
  if (!actor?.isOwner) return;
  if (!actor.items) return; // Extra guard: actors have .items, activities don't

  // Must be raging
  if (!isActorRaging(actor)) return;

  // Determine label from hookNames
  const rollType = hookNames.includes("SavingThrow")
    ? "Saving Throw"
    : hookNames.includes("skill")
    ? "Skill Check"
    : "Ability Check";

  if (RE_DEBUG) console.log(`Raging Effects | ${rollType} — injecting banner (hookNames: ${hookNames})`);

  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  const buttons = el.querySelector(".dialog-buttons");
  if (!buttons) return;

  const banner = document.createElement("div");
  banner.style.cssText = BANNER_STYLE;
  banner.innerHTML =
    `<h3 style="margin:0 0 4px;">🔥 RAGING!</h3>` +
    `<p style="margin:0;">You have <strong>Advantage</strong> on this STR ${rollType}!</p>`;
  buttons.insertAdjacentElement("beforebegin", banner);

  // Highlight ADVANTAGE button to match the banner
  const advBtn = buttons.querySelector("[data-action='advantage']");
  if (advBtn) {
    advBtn.style.background = "#8b1a1a";
    advBtn.style.color = "white";
    advBtn.style.borderColor = "#8b1a1a";
  }
}

// ─── Rage Detection ──────────────────────────────────────────────────────────

function isActorRaging(actor) {
  if (!actor) return false;

  // 1) Status-based: works if the Rage effect has "raging" in its statuses array
  if (actor.statuses?.has("raging")) {
    if (RE_DEBUG) console.log("Raging Effects | Rage detected via statuses");
    return true;
  }

  // 2) Effect-based: check appliedEffects (includes transferred item effects)
  //    then fall back to actor.effects
  const effects = actor.appliedEffects ?? actor.effects;
  if (effects?.some(e => e.name === "Rage" && !e.disabled)) {
    if (RE_DEBUG) console.log("Raging Effects | Rage detected via effects");
    return true;
  }

  if (RE_DEBUG) console.log("Raging Effects | Rage NOT detected");
  return false;
}
// END: RAGING EFFECTS MACRO
