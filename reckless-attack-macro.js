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
 * Uses: dnd5e.preRollAttack + renderRollConfigurationDialog (two-hook
 * dialog pattern).
 */

let RECKLESS_DEBUG = false;

const RA_HOOK_FLAG = "recklessAttackHookRegistered";
const RA_PENDING_KEY = "_recklessAttackPending";
const RA_LAST_ATTACK_KEY = "_recklessAttackLastAttack";

const RECKLESS_ATTACK_NAME = "Reckless Attack";

const HOOK_PRE_ATTACK = "dnd5e.preRollAttack";
const HOOK_RENDER_DIALOG = "renderRollConfigurationDialog";

const SEL_BUTTONS = ".dialog-buttons";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[RA_HOOK_FLAG]) return;
  const prev = game[RA_HOOK_FLAG];
  if (prev.preAttackHookId != null) Hooks.off(HOOK_PRE_ATTACK, prev.preAttackHookId);
  if (prev.renderHookId != null) Hooks.off(HOOK_RENDER_DIALOG, prev.renderHookId);
  console.log("Reckless Attack macro torn down.");
}

function register() {
  const preAttackHookId = Hooks.on(HOOK_PRE_ATTACK, onPreRollAttack);
  const renderHookId = Hooks.on(HOOK_RENDER_DIALOG, onRenderDialog);
  game[RA_HOOK_FLAG] = { preAttackHookId, renderHookId };
  console.log("Reckless Attack macro loaded.");
}

// ─── Pre-Roll Hook: Flag for Dialog Injection ────────────────────────────────

function onPreRollAttack(config, dialog, message) {
  if (RECKLESS_DEBUG) console.log("Reckless Attack | preRollAttack fired:", {
    config, dialog, message,
    subject: config.subject,
    subjectItem: config.subject?.item,
    subjectActor: config.subject?.item?.actor,
  });

  // Extract activity, item, actor from config
  const activity = config.subject;
  const item = activity?.item;
  const actor = item?.actor ?? item?.parent;

  if (!actor?.isOwner) return;
  if (!actor?.system?.abilities) return; // Ensure it's a real Actor5e

  // Must have the Reckless Attack feature
  if (!hasRecklessAttack(actor)) return;

  // Must be a melee weapon attack (not thrown)
  if (!isMeleeWeaponAttack(item, config)) return;

  // Must be STR-based (non-finesse, or finesse with STR >= DEX)
  if (!isStrengthBased(item, actor)) return;

  // Must be the actor's turn in combat (or outside of combat)
  if (!isActorsTurn(actor)) return;

  // Check if Reckless Attack is already active
  const recklessActive = isRecklessActive(actor);

  // If Reckless is not yet active, only remind on the first attack of the turn
  if (!recklessActive && !isFirstAttackOfTurn()) {
    if (RECKLESS_DEBUG) console.log("Reckless Attack | Skipping — not first attack and Reckless not active");
    return;
  }

  // Record that an attack happened this turn
  markAttackThisTurn();

  if (RECKLESS_DEBUG) console.log("Reckless Attack | Setting pending flag", { recklessActive });

  // Flag for the dialog banner
  game[RA_PENDING_KEY] = { recklessActive };
}

// ─── Dialog Banner ───────────────────────────────────────────────────────────

const BANNER_REMINDER_STYLE =
  `color:white; padding:6px 10px; border-radius:4px; ` +
  `margin:0 0 8px; text-align:center; font-size:12px; background:#7a4a1a;`;

const BANNER_ACTIVE_STYLE =
  `color:white; padding:6px 10px; border-radius:4px; ` +
  `margin:0 0 8px; text-align:center; font-size:12px; background:#2a5c2a;`;

function onRenderDialog(app, html) {
  const pending = game[RA_PENDING_KEY];
  if (!pending) return;
  delete game[RA_PENDING_KEY];

  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  const buttons = el.querySelector(SEL_BUTTONS);
  if (!buttons) return;

  const banner = document.createElement("div");

  if (pending.recklessActive) {
    banner.style.cssText = BANNER_ACTIVE_STYLE;
    banner.innerHTML =
      `<h3 style="margin:0 0 4px;">⚔️ Reckless Attack Active</h3>` +
      `<p style="margin:0;">You have <strong>Advantage</strong> on this STR attack.</p>`;
  } else {
    banner.style.cssText = BANNER_REMINDER_STYLE;
    banner.innerHTML =
      `<h3 style="margin:0 0 4px;">⚔️ Reckless Attack</h3>` +
      `<p style="margin:0;">You can gain <strong>Advantage</strong> on this STR attack. ` +
      `Attacks against you will have advantage until your next turn.</p>`;
  }

  buttons.insertAdjacentElement("beforebegin", banner);
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
