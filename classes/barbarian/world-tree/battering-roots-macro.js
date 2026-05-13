/**
 * BATTERING ROOTS MACRO
 *
 * World Tree Barbarian 10 feature. While raging, when you hit with a melee
 * weapon that has the Heavy or Versatile property, you can activate one of
 * the weapon mastery properties Push or Topple (regardless of the weapon's
 * actual mastery) as part of the Battering Roots feature.
 *
 * Injects "🌳 Push 10 ft" and "🌳 Topple (STR Save)" buttons on eligible
 * attack hit messages. Once per turn while in combat.
 *
 * Push: Push the target 10 ft straight away.
 * Topple: Target must succeed on a STR save (DC = 8 + prof + STR mod)
 *         or be knocked prone.
 *
 * Hooks: dnd5e.renderChatMessage, click delegation
 */

const MACRO_ICON = "fa-tree";
let BR_DEBUG = false;

const BR_HOOK_FLAG = "batteringRootsHookRegistered";
const BR_FEAT_NAME = "Battering Roots";

const BR_ICON_SVG = `<svg fill="#FFF" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg" stroke="#FFF"><g stroke-width="0"></g><g stroke-linecap="round" stroke-linejoin="round"></g><g><path d="m 6.1427162,4.9876024 0,-1.967082 c 0,-0.0675 -0.054502,-0.122005 -0.122005,-0.122505 -0.068503,5e-4 -0.1225051,0.055 -0.1225051,0.122505 0.0035,1.262053 -0.4955204,2.473103 -1.3875573,3.36614 l -2.8191164,2.828616 c -0.038002,0.038 -0.047502,0.097 -0.022501,0.145006 0.1310054,0.253511 0.2795115,0.497521 0.4445183,0.7300296 0.020501,0.0295 0.053002,0.048 0.089004,0.0515 l 0.0105,0 c 0.032501,0 0.064003,-0.013 0.086504,-0.0365 L 5.2571796,7.1361904 c 0.5690236,-0.569523 0.8880367,-1.343055 0.8855366,-2.148588 z m 3.8566593,-3.598149 c -0.038002,-0.0215 -0.084503,-0.0215 -0.121505,0 -0.038002,0.0225 -0.061502,0.0625 -0.061502,0.106504 l 0,5.459226 c 0,0.811033 0.3150135,1.574065 0.8870365,2.148089 l 0.997541,1.0035406 c 0.023,0.023 0.054,0.0365 0.0875,0.0365 l 0.0105,-0.0015 c 0.035,-0.003 0.0685,-0.022 0.0895,-0.0505 0.72403,-1.0190426 1.113046,-2.2380926 1.111546,-3.4881446 -0.0035,-2.147588 -1.146548,-4.13117 -3.0006245,-5.213215 l 0,-5e-4 z m -5.8157402,1.631067 0,-1.524563 c 0,-0.043 -0.022501,-0.084 -0.059503,-0.106504 -0.038002,-0.0225 -0.085004,-0.0225 -0.123005,0 -1.8550762,1.082045 -2.9971233,3.066127 -3.0011235,5.213215 0,0.171007 0.009,0.354515 0.028501,0.560024 0.005,0.0475 0.036002,0.0885 0.080003,0.105004 0.013501,0.005 0.028501,0.007 0.042002,0.0075 0.032001,-5e-4 0.063003,-0.0135 0.086004,-0.0365 l 2.0615849,-2.069087 c 0.5695236,-0.570023 0.8875367,-1.342555 0.8855366,-2.148088 l 0,-0.001 z M 9.4908545,10.320822 C 8.5988177,9.4287854 8.098797,8.2172354 8.1017972,6.9556834 l 0,-1.968081 c 5e-4,-0.068 -0.054502,-0.123505 -0.1220051,-0.124005 -0.068003,0.001 -0.122505,0.056 -0.122505,0.124005 0,1.271552 -0.4930204,2.467602 -1.3880574,3.366139 L 3.5121076,11.322363 c -0.048502,0.048 -0.049002,0.126006 -0.001,0.174508 0.005,0.0055 0.01,0.01 0.015501,0.013 1.0115417,0.72753 2.227592,1.119046 3.4736434,1.117546 1.2460515,0.0015 2.4616017,-0.390016 3.473644,-1.117546 0.0295,-0.021 0.0475,-0.053 0.049,-0.09 0.0045,-0.035 -0.008,-0.072 -0.0335,-0.0975 L 9.4908545,10.320822 Z"></path></g></svg>`;
const BR_ICON_URI = `data:image/svg+xml;base64,${btoa(BR_ICON_SVG)}`;

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();
setMacroIcon();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[BR_HOOK_FLAG]) return;
  const prev = game[BR_HOOK_FLAG];
  if (prev.renderHookId != null) Hooks.off("dnd5e.renderChatMessage", prev.renderHookId);
  if (prev.clickHandler) document.removeEventListener("click", prev.clickHandler);
  const oldStyle = document.getElementById("battering-roots-macro-style");
  if (oldStyle) oldStyle.remove();
  delete game[BR_HOOK_FLAG];
  console.log("Battering Roots macro torn down.");
}

function register() {
  ensureBRStyles();
  const renderHookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  const clickHandler = onDocumentClick;
  document.addEventListener("click", clickHandler);
  game[BR_HOOK_FLAG] = { renderHookId, clickHandler, usedThisTurn: null };
  console.log("Battering Roots macro loaded.");
}

// ─── Hook & Event Handlers ───────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  if (el.querySelector("[data-action='br-push']")) return; // already injected

  const ctx = analyzeForBatteringRoots(message);
  if (!ctx) return;

  if (BR_DEBUG) console.log("Battering Roots | Eligible melee hit detected:", message.id);

  const buttonHtml = createBRButtons(message, ctx);
  injectBRButtons(el, buttonHtml);
}

function onDocumentClick(event) {
  const pushBtn = event.target.closest("[data-action='br-push']");
  if (pushBtn) { handlePush(event, pushBtn); return; }

  const toppleBtn = event.target.closest("[data-action='br-topple']");
  if (toppleBtn) { handleTopple(event, toppleBtn); return; }
}

// ─── Message Analysis ────────────────────────────────────────────────────────

function analyzeForBatteringRoots(message) {
  // Must be an attack roll
  const rollType = message.flags?.dnd5e?.roll?.type;
  if (rollType !== "attack") return null;

  const actor = resolveActorFromMessage(message);
  if (!actor || !actor.isOwner) return null;

  // Must be raging
  if (!isActorRaging(actor)) {
    if (BR_DEBUG) console.log("Battering Roots | Actor not raging.");
    return null;
  }

  // Must have the Battering Roots feat
  if (!hasFeature(actor, BR_FEAT_NAME)) {
    if (BR_DEBUG) console.log("Battering Roots | Actor lacks feat.");
    return null;
  }

  // Must be a melee attack with a Heavy or Versatile weapon
  const item = resolveItemFromMessage(message, actor);
  if (!item) {
    if (BR_DEBUG) console.log("Battering Roots | Could not resolve item.");
    return null;
  }

  if (!isMeleeWeapon(item, message)) {
    if (BR_DEBUG) console.log("Battering Roots | Not a melee weapon attack.");
    return null;
  }

  if (!isHeavyOrVersatile(item)) {
    if (BR_DEBUG) console.log("Battering Roots | Weapon is not Heavy or Versatile:", item.name);
    return null;
  }

  return { actor, item };
}

// ─── Actor & Item Resolution ─────────────────────────────────────────────────

function resolveActorFromMessage(message) {
  return message.actor
    || (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null)
    || (message.speaker?.token ? canvas?.tokens?.get(message.speaker.token)?.actor : null)
    || null;
}

function resolveItemFromMessage(message, actor) {
  const itemId = message.flags?.dnd5e?.item?.id;
  if (itemId && actor) {
    const item = actor.items.get(itemId);
    if (item) return item;
  }
  const itemName = message.flags?.dnd5e?.item?.name;
  if (itemName && actor) return actor.items.getName(itemName);
  return null;
}

// ─── Condition Checks ────────────────────────────────────────────────────────

function isActorRaging(actor) {
  if (!actor) return false;
  if (actor.statuses?.has("raging")) return true;
  const effects = actor.appliedEffects ?? actor.effects;
  return effects?.some(e => e.name === "Rage" && !e.disabled) ?? false;
}

function hasFeature(actor, name) {
  return actor.items?.some(i => i.name === name && i.type === "feat") ?? false;
}

function isMeleeWeapon(item, message) {
  if (item.system?.actionType === "mwak") return true;
  // Check attackMode from flags — exclude ranged/thrown
  const attackMode = message.flags?.dnd5e?.roll?.attackMode;
  if (attackMode && ["ranged", "thrown"].includes(attackMode)) return false;
  // Weapon type check
  if (item.type === "weapon" && item.system?.type?.value === "simpleM") return true;
  if (item.type === "weapon" && item.system?.type?.value === "martialM") return true;
  return false;
}

function isHeavyOrVersatile(item) {
  const props = item.system?.properties;
  if (!props) return false;
  // properties is a Set in dnd5e v5
  if (typeof props.has === "function") {
    return props.has("hvy") || props.has("ver");
  }
  // Fallback: array or iterable
  if (Array.isArray(props)) {
    return props.includes("hvy") || props.includes("ver");
  }
  return false;
}

// ─── Per-Turn Tracking ───────────────────────────────────────────────────────

function hasUsedThisTurn() {
  const combat = game.combat;
  if (!combat?.started) return false;
  const last = game[BR_HOOK_FLAG]?.usedThisTurn;
  if (!last) return false;
  return last.combatId === combat.id
    && last.round === combat.round
    && last.turn === combat.turn;
}

function markUsedThisTurn() {
  const combat = game.combat;
  if (!game[BR_HOOK_FLAG]) return;
  game[BR_HOOK_FLAG].usedThisTurn = {
    combatId: combat?.id,
    round: combat?.round,
    turn: combat?.turn,
  };
}

// ─── Button Handlers ─────────────────────────────────────────────────────────

async function handlePush(event, btn) {
  event.preventDefault();

  if (hasUsedThisTurn()) {
    ui.notifications.warn("Battering Roots: Already used this turn.");
    return;
  }

  const actor = resolveActorFromBtn(btn);
  if (!actor) return;

  // Disable both buttons on this message
  disableSiblingButtons(btn);
  markUsedThisTurn();

  const content = `
    <div class="br-result-card">
      <h4 class="br-result-title">🌳 Battering Roots — Push</h4>
      <p class="br-result-desc">
        Push the target up to <strong>10 feet</strong> straight away from you.
      </p>
    </div>`;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER,
  });

  if (BR_DEBUG) console.log("Battering Roots | Push activated.");
}

async function handleTopple(event, btn) {
  event.preventDefault();

  if (hasUsedThisTurn()) {
    ui.notifications.warn("Battering Roots: Already used this turn.");
    return;
  }

  const actor = resolveActorFromBtn(btn);
  if (!actor) return;

  // Disable both buttons on this message
  disableSiblingButtons(btn);
  markUsedThisTurn();

  const prof = actor.system?.attributes?.prof ?? 0;
  const strMod = actor.system?.abilities?.str?.mod ?? 0;
  const saveDC = 8 + prof + strMod;

  const content = `
    <div class="br-result-card">
      <h4 class="br-result-title">🌳 Battering Roots — Topple</h4>
      <p class="br-result-desc">
        The target must make a <strong>STR Save (DC ${saveDC})</strong>
        or be knocked <strong>prone</strong>.
      </p>
      <p class="br-dc-breakdown">DC = 8 + ${prof} (prof) + ${strMod} (STR mod)</p>
    </div>`;

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER,
  });

  if (BR_DEBUG) console.log(`Battering Roots | Topple activated. DC ${saveDC}`);
}

// ─── Button Utilities ────────────────────────────────────────────────────────

function resolveActorFromBtn(btn) {
  const actorUuid = btn.dataset.actorUuid;
  if (actorUuid) {
    const actor = fromUuidSync(actorUuid);
    if (actor) return actor;
  }
  const messageId = btn.dataset.messageId;
  const message = game.messages.get(messageId);
  if (message) return resolveActorFromMessage(message);
  return null;
}

function disableSiblingButtons(btn) {
  const container = btn.closest(".br-btn-container");
  if (!container) { btn.disabled = true; return; }
  container.querySelectorAll("button").forEach(b => {
    b.disabled = true;
    b.classList.add("br-btn-used");
  });
}

// ─── HTML Builders ───────────────────────────────────────────────────────────

function createBRButtons(message, ctx) {
  const actorUuid = ctx.actor.uuid;
  return `
    <div class="br-btn-container">
      <button type="button" class="btn btn-sm br-btn br-push-btn"
        data-action="br-push"
        data-message-id="${message.id}"
        data-actor-uuid="${actorUuid}"
        title="Battering Roots: Push the target 10 ft away">
        🌳 Push 10 ft
      </button>
      <button type="button" class="btn btn-sm br-btn br-topple-btn"
        data-action="br-topple"
        data-message-id="${message.id}"
        data-actor-uuid="${actorUuid}"
        title="Battering Roots: Target makes STR save or falls prone">
        🌳 Topple (STR Save)
      </button>
    </div>`;
}

function injectBRButtons(el, buttonHtml) {
  const target =
    el.querySelector(".card-buttons")
    ?? el.querySelector(".message-content .dice-roll")
    ?? el;

  const position = target.matches?.(".card-buttons") ? "beforeend"
    : target === el ? "beforeend"
    : "afterend";

  target.insertAdjacentHTML(position, buttonHtml);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function ensureBRStyles() {
  if (document.getElementById("battering-roots-macro-style")) return;

  const style = document.createElement("style");
  style.id = "battering-roots-macro-style";
  style.innerHTML = `
    .br-btn-container {
      display: flex;
      gap: 4px;
      margin-top: 5px;
    }

    .br-btn {
      color: white;
      border: none;
      flex: 1;
      font-size: 12px;
      padding: 4px 8px;
      cursor: pointer;
    }

    .br-push-btn {
      background-color: #2d5a1d;
    }

    .br-push-btn:hover:not(:disabled) {
      background-color: #3a7a2a;
    }

    .br-topple-btn {
      background-color: #1a3a0a;
    }

    .br-topple-btn:hover:not(:disabled) {
      background-color: #2d5a1d;
    }

    .br-btn:disabled {
      background-color: #777;
      color: #ccc;
      cursor: default;
    }

    .br-btn-used:disabled {
      background-color: #2d5a1d;
      color: #aaddaa;
    }

    .br-result-card {
      padding-left: 10px;
      margin: 10px 0;
      border-left: 4px solid #2d5a1d;
    }

    .br-result-title {
      color: #2d5a1d;
      margin: 0 0 4px;
      font-size: 1.1em;
    }

    .br-result-desc {
      margin: 0;
      font-size: 0.9em;
    }

    .br-dc-breakdown {
      margin: 4px 0 0;
      font-size: 0.8em;
      color: #888;
      font-style: italic;
    }
  `;
  document.head.appendChild(style);
}

// ─── Self-Setting Icon ───────────────────────────────────────────────────────

function setMacroIcon() {
  const self = game.macros.find(m => m.name.startsWith("scottb") && m.name.toLowerCase().includes("battering"));
  if (self && self.img !== BR_ICON_URI) {
    self.update({ img: BR_ICON_URI });
    if (BR_DEBUG) console.log("Battering Roots | Macro icon updated.");
  }
}
// END: BATTERING ROOTS MACRO
