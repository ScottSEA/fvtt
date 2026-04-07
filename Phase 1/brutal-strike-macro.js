/**
 * BRUTAL STRIKE DECISION HELPER MACRO
 *
 * When Reckless Attack is active (or an attack is rolled with advantage),
 * injects Brutal Strike option buttons into weapon attack roll messages.
 * Clicking an option rolls the extra Brutal Strike damage dice (scaling
 * with barbarian level) and posts the chosen effect description to chat.
 *
 * Available at Barbarian 9+ (Forceful Blow, Hamstring Blow).
 * Improved at Barbarian 13+ (adds Staggering Blow, Sundering Blow).
 * Once per turn.
 */

let BRUTAL_DEBUG = false;

const BRUTAL_HOOK_FLAG = "brutalStrikeHookRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[BRUTAL_HOOK_FLAG]) return;
  const prev = game[BRUTAL_HOOK_FLAG];
  if (prev.renderHookId != null) Hooks.off("renderChatMessage", prev.renderHookId);
  if (prev.clickHandler) document.removeEventListener("click", prev.clickHandler);
  const oldStyle = document.getElementById("brutal-strike-macro-style");
  if (oldStyle) oldStyle.remove();
  console.log("Brutal Strike macro torn down.");
}

function register() {
  ensureBrutalStrikeStyles();
  const renderHookId = Hooks.on("renderChatMessage", onRenderChatMessage);
  const clickHandler = onDocumentClick;
  document.addEventListener("click", clickHandler);
  game[BRUTAL_HOOK_FLAG] = { renderHookId, clickHandler };
  console.log("Brutal Strike macro loaded.");
}

// ─── Hook & Event Handlers ───────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  if (el.querySelector("[data-action='brutal-strike-use']")) return;

  const ctx = analyzeForBrutalStrike(message);
  if (!ctx) return;

  if (BRUTAL_DEBUG) console.log("Brutal Strike: eligible attack detected", ctx);

  const buttonHtml = buildBrutalStrikeButtons(message, ctx);
  injectButtons(el, buttonHtml);
}

async function onDocumentClick(event) {
  const btn = event.target.closest("[data-action='brutal-strike-use']");
  if (!btn) return;
  await handleBrutalStrike(event, btn);
}

// ─── Detection ───────────────────────────────────────────────────────────────

function analyzeForBrutalStrike(message) {
  const actor = resolveActorFromMessage(message);
  if (!actor) return null;
  if (!actor.isOwner) return null;

  // Must be a weapon attack roll
  if (!isWeaponAttackMessage(message)) return null;

  // Actor must have Brutal Strike feat
  if (!hasBrutalStrike(actor)) return null;

  const barbLevel = getBarbarianLevel(actor);
  if (barbLevel < 9) return null;

  // Actor must have Reckless Attack active (effect or confirmed this turn)
  if (!isRecklessThisTurn(actor)) return null;

  const usedThisTurn = hasUsedBrutalStrikeThisTurn();

  return { actor, barbLevel, usedThisTurn };
}

function resolveActorFromMessage(message) {
  return message.actor
    || (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null)
    || (message.speaker?.token ? canvas?.tokens?.get(message.speaker.token)?.actor : null)
    || null;
}

function isWeaponAttackMessage(message) {
  const isAttack = message.rolls?.some(r => r.options?.type === "attack")
    || message.flags?.dnd5e?.roll?.type === "attack"
    || message.flags?.dnd5e?.activity?.type === "attack";
  if (!isAttack) return false;

  const isWeapon = message.flags?.dnd5e?.item?.type === "weapon";
  return isWeapon;
}

function isRecklessThisTurn(actor) {
  // Check 1: Reckless effect active on actor (covers subsequent attacks if effect applied)
  if (isRecklessActive(actor)) return true;

  // Check 2: Reckless was confirmed via button this turn
  const confirmed = game._recklessAttackConfirmed;
  if (!confirmed) return false;
  const combat = game.combat;
  if (combat?.started) {
    return confirmed.combatId === combat.id
      && confirmed.round === combat.round
      && confirmed.turn === combat.turn;
  }
  return confirmed.timestamp && (Date.now() - confirmed.timestamp < 60000);
}

function isRecklessActive(actor) {
  return actor.effects?.some(e =>
    (e.name === "Reckless" || e.name === "Reckless Attack") && !e.disabled
  ) ?? false;
}

function hasBrutalStrike(actor) {
  return actor.items?.some(i =>
    i.type === "feat" && (
      i.system?.identifier === "brutal-strike" || i.name === "Brutal Strike"
    )
  ) ?? false;
}

function getBarbarianLevel(actor) {
  return actor.classes?.barbarian?.system?.levels ?? 0;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function ensureBrutalStrikeStyles() {
  if (document.getElementById("brutal-strike-macro-style")) return;

  const style = document.createElement("style");
  style.id = "brutal-strike-macro-style";
  style.innerHTML = `
    .brutal-strike-container {
      margin-top: 6px;
      border-left: 4px solid #8b0000;
      padding: 4px 0 4px 8px;
    }

    .brutal-strike-header {
      color: #8b0000;
      font-weight: bold;
      font-size: 11px;
      margin-bottom: 4px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .brutal-strike-btn-group {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
    }

    .brutal-strike-btn {
      background-color: #5c1a1a;
      color: white;
      border: none;
      padding: 4px 8px;
      font-size: 11px;
      cursor: pointer;
      flex: 1 1 auto;
      min-width: 80px;
      text-align: center;
    }

    .brutal-strike-btn:hover:not(:disabled) {
      background-color: #8b0000;
    }

    .brutal-strike-btn:disabled {
      background-color: #555;
      color: #aaa;
      cursor: default;
    }

    .brutal-strike-btn.brutal-strike-selected {
      background-color: #2e6b30;
      color: white;
    }

    .brutal-strike-card {
      border-left: 4px solid #8b0000;
      padding-left: 10px;
      margin: 10px 0;
    }

    .brutal-strike-card-title {
      color: #8b0000;
      font-weight: bold;
      font-size: 13px;
    }

    .brutal-strike-card-total {
      font-size: 2em;
      font-weight: bold;
      color: #8b0000;
    }

    .brutal-strike-card-effect {
      font-style: italic;
      margin-top: 4px;
      font-size: 12px;
      color: #333;
    }
  `;
  document.head.appendChild(style);
}

// ─── Effect Definitions ──────────────────────────────────────────────────────

const BRUTAL_EFFECTS = {
  forceful: {
    label: "Forceful Blow",
    brief: "Push 15 ft, advance half speed",
    icon: "fa-hand-fist",
    description: "The target is pushed 15 feet straight away from you. You can then move up to half your Speed straight toward the target without provoking Opportunity Attacks.",
    minLevel: 9,
  },
  hamstring: {
    label: "Hamstring Blow",
    brief: "Target speed −15 ft",
    icon: "fa-person-falling",
    description: "The target's Speed is reduced by 15 feet until the start of your next turn. A target can be affected by only one Hamstring Blow at a time.",
    minLevel: 9,
  },
  staggering: {
    label: "Staggering Blow",
    brief: "Disadv. next save, no OAs",
    icon: "fa-bolt",
    description: "The target has Disadvantage on the next saving throw it makes, and it can't make Opportunity Attacks until the start of your next turn.",
    minLevel: 13,
  },
  sundering: {
    label: "Sundering Blow",
    brief: "Next ally attack gets +5",
    icon: "fa-shield-halved",
    description: "Before the start of your next turn, the next attack roll made by another creature against the target gains a +5 bonus to the roll.",
    minLevel: 13,
  },
};

// ─── HTML Builders ───────────────────────────────────────────────────────────

function buildBrutalStrikeButtons(message, ctx) {
  const { barbLevel, usedThisTurn } = ctx;
  const disabled = usedThisTurn ? "disabled" : "";

  let buttons = "";
  for (const [key, effect] of Object.entries(BRUTAL_EFFECTS)) {
    if (barbLevel < effect.minLevel) continue;
    const title = usedThisTurn
      ? "Already used Brutal Strike this turn"
      : effect.description;
    buttons += `<button type="button" class="brutal-strike-btn" ${disabled} `
      + `data-action="brutal-strike-use" data-effect="${key}" `
      + `data-message-id="${message.id}" `
      + `title="${title}">`
      + `<i class="fas ${effect.icon}"></i> ${effect.label}</button>`;
  }

  return `<div class="brutal-strike-container">`
    + `<div class="brutal-strike-header">\u2694\uFE0F Brutal Strike</div>`
    + `<div class="brutal-strike-btn-group">${buttons}</div>`
    + `</div>`;
}

function injectButtons(el, buttonHtml) {
  const target =
    el.querySelector(".card-buttons")
    ?? el.querySelector(".message-content .dice-roll")
    ?? el;

  const position = target.matches?.(".card-buttons") ? "beforeend"
    : target === el ? "beforeend"
    : "afterend";

  target.insertAdjacentHTML(position, buttonHtml);
}

// ─── Click Handler ───────────────────────────────────────────────────────────

async function handleBrutalStrike(event, btn) {
  event.preventDefault();

  const effectKey = btn.dataset.effect;
  const effect = BRUTAL_EFFECTS[effectKey];
  if (!effect) return;

  const message = game.messages.get(btn.dataset.messageId);
  if (!message) return;

  const actor = resolveActorFromMessage(message);
  if (!actor) {
    ui.notifications.error("Brutal Strike: Unable to determine actor.");
    return;
  }

  if (hasUsedBrutalStrikeThisTurn()) {
    ui.notifications.warn("Brutal Strike: Already used this turn!");
    return;
  }

  // Disable all Brutal Strike buttons in this message, highlight selected
  const container = btn.closest(".brutal-strike-container");
  if (container) {
    container.querySelectorAll(".brutal-strike-btn").forEach(b => {
      b.disabled = true;
    });
    btn.classList.add("brutal-strike-selected");
    btn.innerHTML = `<i class="fas ${effect.icon}"></i> ${effect.label} \u2714`;
  }

  // Roll the extra damage
  const brutalDice = getBrutalStrikeDice(actor);
  const roll = new Roll(brutalDice);
  await roll.evaluate();

  if (BRUTAL_DEBUG) console.log("Brutal Strike roll:", roll.formula, "=", roll.total);

  // Build and send the result chat message (Dice So Nice triggers automatically via toMessage)
  const content = buildResultCard(effect, roll, brutalDice);
  await roll.toMessage({
    author: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flavor: `Brutal Strike \u2014 ${effect.label}`,
    style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER,
  });

  markBrutalStrikeUsed();

  if (BRUTAL_DEBUG) console.log(`Brutal Strike: ${effect.label} used, rolled ${roll.total}`);
}

// ─── Roll Helpers ────────────────────────────────────────────────────────────

function getBrutalStrikeDice(actor) {
  // Try to read the scale value from the actor
  const scale = actor.system?.scale?.barbarian?.["brutal-strike"];
  if (scale) {
    if (scale.formula) return scale.formula;
    if (scale.number && scale.faces) return `${scale.number}d${scale.faces}`;
    if (scale.die) return scale.die;
  }

  // Fallback: compute from barbarian level
  const barbLevel = getBarbarianLevel(actor);
  return barbLevel >= 17 ? "2d10" : "1d10";
}

function buildResultCard(effect, roll, formula) {
  return `<div class="brutal-strike-card">`
    + `<p><strong class="brutal-strike-card-title">\u2694\uFE0F ${effect.label}</strong></p>`
    + `<p>Extra damage: <strong>${formula}</strong></p>`
    + `<p class="brutal-strike-card-total">${roll.total}</p>`
    + `<p class="brutal-strike-card-effect">${effect.description}</p>`
    + `</div>`;
}

// ─── Turn Tracking ───────────────────────────────────────────────────────────

function hasUsedBrutalStrikeThisTurn() {
  const combat = game.combat;
  if (!combat?.started) return false;
  const last = game._brutalStrikeLastUsed;
  if (!last) return false;
  return last.combatId === combat.id
    && last.round === combat.round
    && last.turn === combat.turn;
}

function markBrutalStrikeUsed() {
  const combat = game.combat;
  if (!combat?.started) return;
  game._brutalStrikeLastUsed = {
    combatId: combat.id,
    round: combat.round,
    turn: combat.turn,
  };
}
