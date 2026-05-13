/**
 * CHARGER CHARGE ATTACK MACRO
 *
 * When a character with the Charger feat makes a melee attack, injects a
 * "⚡ Invoke Charger" button into the attack roll chat message. If the
 * player confirms they Dashed and moved 10+ ft in a straight line, they
 * can choose to either:
 *   • Roll +1d8 bonus damage, or
 *   • Push the target 10 ft away.
 *
 * RAW (Charger feat, 2024 PHB): "When you use the Dash action, your Speed
 * increases by 10 feet for that action. If you then move at least 10 feet
 * in a straight line immediately before hitting with an attack using a
 * melee weapon or Unarmed Strike as part of the Attack action on the same
 * turn, choose one of the following effects: gain a +1d8 bonus to the
 * attack's damage roll, or push the target up to 10 feet away from you."
 *
 * NOTE: This macro does NOT track actual token movement — that is infeasible
 * to do reliably. The player is responsible for knowing whether they met the
 * straight-line movement requirement. The macro simply offers the option.
 *
 * Hooks: renderChatMessage, click delegation
 */

const MACRO_ICON = "fa-bolt";
let CHARGER_DEBUG = false;

const CHARGER_FEAT_NAME = "Charger";
const CHARGER_HOOK_FLAG = "chargerHookRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[CHARGER_HOOK_FLAG]) return;
  const prev = game[CHARGER_HOOK_FLAG];
  if (prev.renderHookId != null) Hooks.off("renderChatMessage", prev.renderHookId);
  if (prev.dialogHookId != null) Hooks.off("renderRollConfigurationDialog", prev.dialogHookId);
  if (prev.clickHandler) document.removeEventListener("click", prev.clickHandler);
  const oldStyle = document.getElementById("charger-macro-style");
  if (oldStyle) oldStyle.remove();
  console.log("Charger macro torn down.");
}

function register() {
  ensureChargerStyles();
  const renderHookId = Hooks.on("renderChatMessage", onRenderChatMessage);
  const dialogHookId = Hooks.on("renderRollConfigurationDialog", onRenderDialog);
  const clickHandler = onDocumentClick;
  document.addEventListener("click", clickHandler);
  game[CHARGER_HOOK_FLAG] = { renderHookId, dialogHookId, clickHandler };
  console.log("Charger macro loaded.");
}

// ─── Hook & Event Handlers ───────────────────────────────────────────────────

function onRenderDialog(app, html) {
  const config = app.config;
  if (!config) return;
  if (!config.hookNames?.includes("attack")) return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  if (el.querySelector("[data-charger-banner]")) return;

  const activity = config.subject;
  const item = activity?.item;
  const actor = activity?.actor ?? item?.actor ?? item?.parent;

  if (!actor?.isOwner) return;
  if (!actorHasChargerFeat(actor)) return;
  if (!isMeleeWeaponItem(item, config)) return;

  const buttons = el.querySelector(".dialog-buttons");
  if (!buttons) return;

  const banner = document.createElement("div");
  banner.setAttribute("data-charger-banner", "true");
  banner.style.cssText =
    `color:white; padding:6px 10px; border-radius:4px; ` +
    `margin:0 0 8px; text-align:center; font-size:12px; background:#2a5a1a; ` +
    `display:flex; flex-direction:column; align-items:center;`;
  banner.innerHTML =
    `<h3 style="margin:0 0 2px;">\u26A1 Charger</h3>` +
    `<p style=\"margin:0;\">Dash + move 10' straight line for <strong>+1d8 damage</strong><br>or push 10 ft</p>`;
  buttons.insertAdjacentElement("beforebegin", banner);
}

function onRenderChatMessage(message, html) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  if (el.querySelector("[data-action='charger-invoke']")) return;

  const ctx = analyzeForCharger(message, el);
  if (!ctx) return;

  if (CHARGER_DEBUG) console.log("Charger | Eligible melee attack detected:", message.id);

  const buttonHtml = createChargerButton(message, ctx);
  injectChargerButton(el, buttonHtml);
}

async function onDocumentClick(event) {
  const invokeBtn = event.target.closest("[data-action='charger-invoke']");
  if (invokeBtn) await handleChargerInvoke(event, invokeBtn);

  const damageBtn = event.target.closest("[data-action='charger-damage']");
  if (damageBtn) await handleChargerDamage(event, damageBtn);

  const pushBtn = event.target.closest("[data-action='charger-push']");
  if (pushBtn) await handleChargerPush(event, pushBtn);
}

// ─── Invoke: Show Choice Dialog ──────────────────────────────────────────────

async function handleChargerInvoke(event, btn) {
  event.preventDefault();

  const intent = resolveChargerIntent(btn);
  if (!intent) return;

  // Disable the button immediately to prevent double-clicks
  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-bolt"></i> Choosing...`;

  const choice = await showChargerChoiceDialog();

  if (!choice) {
    // Cancelled — re-enable button
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-bolt"></i> Invoke Charger`;
    return;
  }

  if (choice === "damage") {
    await rollChargerDamage(intent.actor);
    btn.innerHTML = `<i class="fas fa-bolt"></i> +1d8 Damage Applied`;
    btn.classList.add("charger-btn-used");
  } else if (choice === "push") {
    await sendPushReminder(intent.actor);
    btn.innerHTML = `<i class="fas fa-bolt"></i> Push 10 ft Applied`;
    btn.classList.add("charger-btn-used");
  }
}

function resolveChargerIntent(btn) {
  const message = game.messages.get(btn.dataset.messageId);
  if (!message) return null;

  const actor = resolveActorFromMessage(message);
  if (!actor) {
    ui.notifications.error("Charger: Unable to determine actor for this attack.");
    return null;
  }

  return { actor, message };
}

// ─── Choice Dialog ───────────────────────────────────────────────────────────

async function showChargerChoiceDialog() {
  return new Promise((resolve) => {
    new Dialog({
      title: "⚡ Charger — Choose Benefit",
      content: `
        <div style="padding:4px 0;">
          <p style="margin:0 0 8px; font-size:13px; color:#666;">
            You Dashed and moved 10+ ft in a straight line before this melee hit.
            Choose your Charger benefit:
          </p>
        </div>`,
      buttons: {
        damage: {
          icon: '<i class="fas fa-dice-d8"></i>',
          label: "+1d8 Damage",
          callback: () => resolve("damage"),
        },
        push: {
          icon: '<i class="fas fa-arrow-right"></i>',
          label: "Push 10 ft",
          callback: () => resolve("push"),
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: "Cancel",
          callback: () => resolve(null),
        },
      },
      default: "damage",
      close: () => resolve(null),
    }).render(true);
  });
}

// ─── Damage Roll ─────────────────────────────────────────────────────────────

async function rollChargerDamage(actor) {
  const roll = new Roll("1d8");
  await roll.evaluate();

  // Dice So Nice triggers automatically via toMessage
  const content = `
    <div class="charger-result-card">
      <h4 class="charger-result-title">⚡ Charger — Bonus Damage</h4>
      <p class="charger-result-desc">
        Dashed and charged 10+ ft in a straight line before hitting with a melee attack.
      </p>
      <p class="charger-result-total">+${roll.total} damage</p>
    </div>`;

  await roll.toMessage({
    author: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flavor: "Charger — Bonus Damage",
    style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER,
  });

  if (CHARGER_DEBUG) console.log("Charger | Bonus damage rolled:", roll.total);
}

async function handleChargerDamage(event, btn) {
  event.preventDefault();
  const actor = game.actors.get(btn.dataset.actorId);
  if (!actor) return;
  await rollChargerDamage(actor);
  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-dice-d8"></i> Rolled`;
}

// ─── Push Reminder ───────────────────────────────────────────────────────────

async function sendPushReminder(actor) {
  const content = `
    <div class="charger-result-card">
      <h4 class="charger-result-title">⚡ Charger — Push</h4>
      <p class="charger-result-desc">
        Push the target up to <strong>10 feet</strong> away from you.
      </p>
    </div>`;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER,
  });

  if (CHARGER_DEBUG) console.log("Charger | Push reminder sent.");
}

async function handleChargerPush(event, btn) {
  event.preventDefault();
  const actor = game.actors.get(btn.dataset.actorId);
  if (!actor) return;
  await sendPushReminder(actor);
  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-arrow-right"></i> Pushed`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function ensureChargerStyles() {
  if (document.getElementById("charger-macro-style")) return;

  const style = document.createElement("style");
  style.id = "charger-macro-style";
  style.innerHTML = `
    .charger-invoke-btn {
      background-color: #2a5a1a;
      color: white;
      margin-top: 5px;
      width: 100%;
      border: none;
    }

    .charger-invoke-btn:hover:not(:disabled) {
      background-color: #3a7a2a;
    }

    .charger-invoke-btn:disabled {
      background-color: #777;
      color: white;
      cursor: default;
    }

    .charger-btn-used:disabled {
      background-color: #2a5a1a;
      color: #aaddaa;
    }

    .charger-result-card {
      padding-left: 10px;
      margin: 10px 0;
      border-left: 4px solid #2a5a1a;
    }

    .charger-result-title {
      color: #2a5a1a;
      margin: 0 0 4px;
      font-size: 1.1em;
    }

    .charger-result-desc {
      margin: 0;
      font-size: 0.9em;
    }

    .charger-result-total {
      margin: 4px 0 0;
      font-size: 1.8em;
      font-weight: bold;
      color: #2a5a1a;
    }
  `;
  document.head.appendChild(style);
}

// ─── Message Detection ───────────────────────────────────────────────────────

function isMeleeWeaponItem(item, config) {
  if (!item) return false;
  const weaponType = item.system?.type?.value;
  if (!weaponType) return false;
  const isMelee = weaponType.endsWith("M") || weaponType === "natural";
  if (!isMelee) return false;
  const attackMode = config.attackMode ?? config.rolls?.[0]?.options?.attackMode;
  if (attackMode === "thrown") return false;
  return true;
}

function analyzeForCharger(message, el) {
  const actor = resolveActorFromMessage(message);
  if (!actor) return null;
  if (!actor.isOwner) return null;

  // Actor must have the Charger feat
  if (!actorHasChargerFeat(actor)) return null;

  // Must be a melee attack roll
  if (!isMeleeAttackMessage(message, actor, el)) return null;

  if (CHARGER_DEBUG) console.log("Charger | Actor has feat and made melee attack:", actor.name);

  return { actor };
}

function resolveActorFromMessage(message) {
  return message.actor ||
    (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null) ||
    (message.speaker?.token ? canvas?.tokens?.get(message.speaker.token)?.actor : null) ||
    null;
}

function actorHasChargerFeat(actor) {
  return actor.items?.some(i => i.name === CHARGER_FEAT_NAME && i.type === "feat") ?? false;
}

function isMeleeAttackMessage(message, actor, el) {
  // Must be an attack roll
  const isAttackRoll = message.rolls?.some(r => r.options?.type === "attack") ||
    message.flags?.dnd5e?.roll?.type === "attack";
  if (!isAttackRoll) return false;

  // Determine the item used — check flags and actor items
  const itemId = message.flags?.dnd5e?.item?.id;
  const itemName = message.flags?.dnd5e?.item?.name ?? message.flavor;

  let item = null;
  if (itemId && actor) item = actor.items.get(itemId);
  if (!item && itemName && actor) item = actor.items.getName(itemName);

  // Check if it's a melee weapon attack or unarmed strike
  if (item) {
    const actionType = item.system?.actionType;
    if (actionType === "mwak") return true;

    // Also match unarmed strikes (may have different action types)
    if (item.name?.toLowerCase().includes("unarmed")) return true;
  }

  // Fallback: check the activity type in flags
  const activityType = message.flags?.dnd5e?.activity?.type;
  if (activityType === "attack") {
    // Could be melee or ranged — check attackMode for clues
    const attackMode = message.flags?.dnd5e?.roll?.attackMode;
    if (attackMode && !["ranged", "thrown"].includes(attackMode)) return true;
  }

  // Fallback: check flavor text for melee indicators
  const flavor = (message.flavor || "").toLowerCase();
  if (flavor.includes("melee") || flavor.includes("unarmed")) return true;

  if (CHARGER_DEBUG) console.log("Charger | Attack not identified as melee. Item:", item?.name, "actionType:", item?.system?.actionType);

  return false;
}

// ─── HTML Builders ───────────────────────────────────────────────────────────

function createChargerButton(message, ctx) {
  const title = "Charger: If you Dashed and moved 10+ ft in a straight line, choose +1d8 damage or push 10 ft.";

  return `<button type="button" class="btn btn-sm charger-invoke-btn"
    data-action="charger-invoke"
    data-message-id="${message.id}"
    title="${title}">
    <i class="fas fa-bolt"></i> Invoke Charger
  </button>`;
}

function injectChargerButton(el, buttonHtml) {
  const target =
    el.querySelector(".card-buttons") ??
    el.querySelector(".message-content .dice-roll") ??
    el;

  const position = target.matches?.(".card-buttons") ? "beforeend"
    : target === el ? "beforeend"
    : "afterend";

  target.insertAdjacentHTML(position, buttonHtml);
}
// END: CHARGER CHARGE ATTACK MACRO
