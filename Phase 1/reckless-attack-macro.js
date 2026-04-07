/**
 * RECKLESS ATTACK REMINDER MACRO
 *
 * Injects a reminder banner into the attack roll configuration dialog when
 * the character makes a STR-based melee attack, reminding about Reckless
 * Attack.
 *
 * RAW (2024 Barbarian): "You have Advantage on Strength-based attack rolls
 * using this option. When you do so, attacks against you have Advantage
 * until the start of your next turn."
 *
 * Decision: "When you make your first attack on your turn, you can decide
 * to attack recklessly." — so the reminder only shows on the first STR
 * melee attack of the turn. If Reckless is already active, a confirmation
 * banner shows on every STR melee attack instead.
 *
 * Uses a single-hook approach: reads all context directly from the dialog
 * app's config property in renderRollConfigurationDialog, avoiding the
 * fragile two-hook pending-key pattern that can break when the attack
 * dialog subclass (AttackRollConfigurationDialog) renders asynchronously.
 *
 * Hooks: renderRollConfigurationDialog
 */

let RECKLESS_DEBUG = false;

const RA_HOOK_FLAG = "recklessAttackHookRegistered";
const RA_LAST_ATTACK_KEY = "_recklessAttackLastAttack";
const RA_CONFIRMED_KEY = "_recklessAttackConfirmed";

const RECKLESS_ATTACK_NAME = "Reckless Attack";

const HOOK_RENDER_DIALOG = "renderRollConfigurationDialog";

const SEL_BUTTONS = ".dialog-buttons";
const SEL_ADVANTAGE = "[data-action='advantage']";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[RA_HOOK_FLAG]) return;
  const prev = game[RA_HOOK_FLAG];
  if (prev.renderHookId != null) Hooks.off(HOOK_RENDER_DIALOG, prev.renderHookId);
  console.log("Reckless Attack macro torn down.");
}

function register() {
  const renderHookId = Hooks.on(HOOK_RENDER_DIALOG, onRenderDialog);
  game[RA_HOOK_FLAG] = { renderHookId };
  console.log("Reckless Attack macro loaded.");
}

// ─── Dialog Banner (single-hook approach) ────────────────────────────────────

const BANNER_BUTTON_STYLE =
  `color:white; padding:6px 10px; border-radius:4px; ` +
  `margin:0 0 8px; text-align:center; font-size:12px; background:#7a4a1a; ` +
  `width:100%; border:1px solid #a06828; cursor:pointer; display:flex; ` +
  `flex-direction:column; align-items:center;`;

const BANNER_ACTIVE_STYLE =
  `color:white; padding:6px 10px; border-radius:4px; ` +
  `margin:0 0 8px; text-align:center; font-size:12px; background:#2a5c2a; ` +
  `display:flex; flex-direction:column; align-items:center;`;

function onRenderDialog(app, html) {
  // Read roll config directly from the dialog app — no pending key needed
  const config = app.config;
  if (!config) return;

  // Only process attack roll dialogs (hookNames includes "attack" for attacks)
  if (!config.hookNames?.includes("attack")) return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;

  // Skip if already injected (re-render guard)
  if (el.querySelector("[data-reckless-banner]")) return;

  // Extract activity, item, actor from the dialog's config
  const activity = config.subject;
  const item = activity?.item;
  const actor = activity?.actor ?? item?.actor ?? item?.parent;

  if (RECKLESS_DEBUG) console.log("Reckless Attack | renderDialog fired:", {
    hookNames: config.hookNames, activity, item: item?.name, actor: actor?.name,
    isOwner: actor?.isOwner,
  });

  if (!actor?.isOwner) return;
  if (!actor?.system?.abilities) return;

  // Must have the Reckless Attack feature
  if (!hasRecklessAttack(actor)) return;

  // Must be a melee weapon attack (not thrown)
  if (!isMeleeWeaponAttack(item, config)) return;

  // Must be STR-based (non-finesse, or finesse with STR >= DEX)
  if (!isStrengthBased(item, actor)) return;

  // Must be the actor's turn in combat (or outside of combat)
  if (!isActorsTurn(actor)) return;

  // Check if Reckless Attack is already active (effect OR confirmed this turn)
  const recklessActive = isRecklessActive(actor) || isRecklessConfirmedThisTurn();

  // If Reckless is not yet active, only offer on the first attack of the turn
  if (!recklessActive && !isFirstAttackOfTurn()) {
    if (RECKLESS_DEBUG) console.log("Reckless Attack | Skipping — not first attack and Reckless not active");
    return;
  }

  // Record that an attack happened this turn
  markAttackThisTurn();

  // Find the buttons container
  const buttons = el.querySelector(SEL_BUTTONS);
  if (!buttons) {
    if (RECKLESS_DEBUG) console.log("Reckless Attack | No .dialog-buttons found in dialog");
    return;
  }

  if (recklessActive) {
    // Green informational banner — Reckless is already active this turn
    if (RECKLESS_DEBUG) console.log("Reckless Attack | Injecting active banner");
    const banner = document.createElement("div");
    banner.setAttribute("data-reckless-banner", "true");
    banner.style.cssText = BANNER_ACTIVE_STYLE;
    banner.innerHTML =
      `<h3 style="margin:0 0 2px;">⚔️ Reckless Attack Active</h3>` +
      `<p style="margin:0;">You have <strong>Advantage</strong> on this STR attack</p>`;
    buttons.insertAdjacentElement("beforebegin", banner);
  } else {
    // Clickable button — first attack, rolls with advantage
    const advButton = buttons.querySelector(SEL_ADVANTAGE);
    if (!advButton) {
      if (RECKLESS_DEBUG) console.log("Reckless Attack | No advantage button found in dialog");
      return;
    }

    if (RECKLESS_DEBUG) console.log("Reckless Attack | Injecting reckless button");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-reckless-banner", "true");
    btn.style.cssText = BANNER_BUTTON_STYLE;
    btn.innerHTML =
      `<h3 style="margin:0 0 2px;">⚔️ Reckless Attack</h3>` +
      `<p style="margin:0;">Click to roll with <strong>Advantage</strong></p>`;
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      markRecklessConfirmed();
      advButton.click(); // Sets advantage AND submits the dialog
    });
    buttons.insertAdjacentElement("beforebegin", btn);
  }
}

// ─── Melee Weapon Detection ──────────────────────────────────────────────────

function isMeleeWeaponAttack(item, config) {
  if (!item) return false;

  const weaponType = item.system?.type?.value;
  if (!weaponType) return false;

  // dnd5e weapon types: simpleM, martialM (melee), simpleR, martialR (ranged), natural
  const isMelee = weaponType.endsWith("M") || weaponType === "natural";
  if (!isMelee) return false;

  // Exclude thrown attacks — check attackMode in roll options
  const attackMode = config.attackMode
    ?? config.rolls?.[0]?.options?.attackMode;
  if (attackMode === "thrown") return false;

  if (RECKLESS_DEBUG) console.log("Reckless Attack | Melee weapon confirmed:", {
    weaponType, attackMode, itemName: item.name,
  });

  return true;
}

// ─── STR-Based Detection ─────────────────────────────────────────────────────

function isStrengthBased(item, actor) {
  // Finesse weapons can use DEX instead of STR
  const props = item.system?.properties;
  let hasFinesse = false;
  if (props instanceof Set) hasFinesse = props.has("fin");
  else if (Array.isArray(props)) hasFinesse = props.includes("fin");

  if (hasFinesse) {
    // Finesse: dnd5e auto-picks the higher ability.
    // Only STR-based if STR >= DEX.
    const str = actor.system?.abilities?.str?.value ?? 0;
    const dex = actor.system?.abilities?.dex?.value ?? 0;
    if (dex > str) {
      if (RECKLESS_DEBUG) console.log("Reckless Attack | Finesse weapon using DEX — skipping");
      return false;
    }
  }

  return true;
}

// ─── Reckless Attack Detection ───────────────────────────────────────────────

function isRecklessActive(actor) {
  if (!actor) return false;
  // Preferred: check statuses set (status effect ID)
  if (actor.statuses?.has("reckless")) return true;
  // Fallback: check for an active effect named Reckless Attack
  return actor.effects?.some(
    e => (e.name === "Reckless Attack" || e.name === "Reckless") && !e.disabled
  ) ?? false;
}

function hasRecklessAttack(actor) {
  return actor.items?.some(
    i => i.name === RECKLESS_ATTACK_NAME && i.type === "feat"
  ) ?? false;
}

// ─── Turn Tracking ───────────────────────────────────────────────────────────

function isActorsTurn(actor) {
  const combat = game.combat;
  if (!combat?.started) return true; // Outside combat — allow reminder
  return combat.combatant?.actor?.id === actor.id;
}

function isFirstAttackOfTurn() {
  const combat = game.combat;
  if (!combat?.started) return true; // Outside combat — treat as first
  const last = game[RA_LAST_ATTACK_KEY];
  if (!last) return true;
  return last.combatId !== combat.id
    || last.round !== combat.round
    || last.turn !== combat.turn;
}

function markAttackThisTurn() {
  const combat = game.combat;
  if (!combat?.started) return;
  game[RA_LAST_ATTACK_KEY] = {
    combatId: combat.id,
    round: combat.round,
    turn: combat.turn,
  };
}

function markRecklessConfirmed() {
  const combat = game.combat;
  if (combat?.started) {
    game[RA_CONFIRMED_KEY] = {
      combatId: combat.id,
      round: combat.round,
      turn: combat.turn,
    };
  } else {
    game[RA_CONFIRMED_KEY] = { timestamp: Date.now() };
  }
}

function isRecklessConfirmedThisTurn() {
  const confirmed = game[RA_CONFIRMED_KEY];
  if (!confirmed) return false;
  const combat = game.combat;
  if (combat?.started) {
    return confirmed.combatId === combat.id
      && confirmed.round === combat.round
      && confirmed.turn === combat.turn;
  }
  return confirmed.timestamp && (Date.now() - confirmed.timestamp < 60000);
}
