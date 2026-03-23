/**
 * CUDDLY STRIXHAVEN MASCOT MACRO
 *
 * Injects a "Succeed on Save" button into ability saving throw messages
 * when the actor has an equipped Cuddly Strixhaven Mascot with uses remaining.
 * RAW: "If you fail a saving throw against being frightened, you can use your
 * reaction to choose to succeed instead." Once per long rest.
 *
 * The button appears on all ability saves — the player decides whether the
 * save is against a Frightened effect before clicking.
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
  if (prev.renderHookId != null) Hooks.off("renderChatMessage", prev.renderHookId);
  if (prev.clickHandler) document.removeEventListener("click", prev.clickHandler);
  const oldStyle = document.getElementById("strixhaven-mascot-style");
  if (oldStyle) oldStyle.remove();
}

function register() {
  ensureMascotStyles();
  const renderHookId = Hooks.on("renderChatMessage", onRenderChatMessage);
  const clickHandler = onDocumentClick;
  document.addEventListener("click", clickHandler);
  game[MASCOT_HOOK_FLAG] = { renderHookId, clickHandler };
}

// ─── Hook & Event Handlers ───────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  if (el.querySelector("[data-action='strixhaven-mascot-succeed']")) return;

  const ctx = analyzeForMascot(message);
  if (!ctx) return;

  const buttonHtml = createMascotButton(message, ctx);
  injectMascotButton(el, buttonHtml);
}

async function onDocumentClick(event) {
  const btn = event.target.closest("[data-action='strixhaven-mascot-succeed']");
  if (btn) await handleUseMascot(event, btn);
}

async function handleUseMascot(event, btn) {
  event.preventDefault();

  const intent = resolveMascotIntent(btn);
  if (!intent) return;

  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-shield-alt"></i> Using Mascot...`;

  await consumeMascotUse(intent.mascot);
  await flagMessageAsSucceeded(intent.message);
  await announceSuccess(intent.actor);
}

function resolveMascotIntent(btn) {
  const message = game.messages.get(btn.dataset.messageId);
  if (!message) return null;

  const actor = resolveActorFromMessage(message);
  if (!actor) {
    ui.notifications.error("Strixhaven Mascot: Unable to determine actor.");
    return null;
  }

  const mascot = getEquippedMascot(actor);
  if (!mascot) {
    ui.notifications.warn("Strixhaven Mascot: Item not found or not equipped.");
    return null;
  }

  if (getMascotUsesRemaining(mascot) <= 0) {
    ui.notifications.warn("Strixhaven Mascot: No uses remaining (resets on long rest).");
    return null;
  }

  if (message.flags?.world?.strixhavenMascotUsed) {
    ui.notifications.warn("Strixhaven Mascot: Already used on this save.");
    return null;
  }

  return { actor, message, mascot };
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function ensureMascotStyles() {
  if (document.getElementById("strixhaven-mascot-style")) return;

  const style = document.createElement("style");
  style.id = "strixhaven-mascot-style";
  style.innerHTML = `
    .strixhaven-mascot-btn {
      background-color: #2e4a6e;
      color: white;
      margin-top: 5px;
      width: 100%;
      border: none;
    }

    .strixhaven-mascot-btn:disabled {
      background-color: #777;
      color: white;
      cursor: default;
    }

    .strixhaven-mascot-used:disabled {
      background-color: #2e6b30;
      color: white;
    }
  `;
  document.head.appendChild(style);
}

// ─── Message Detection ───────────────────────────────────────────────────────

function analyzeForMascot(message) {
  const actor = resolveActorFromMessage(message);
  if (!actor) return null;
  if (!isAbilitySaveMessage(message)) return null;

  const mascot = getEquippedMascot(actor);
  if (!mascot) return null;

  const alreadyUsed = !!message.flags?.world?.strixhavenMascotUsed;
  const usesRemaining = getMascotUsesRemaining(mascot);

  return {
    alreadyUsed,
    available: !alreadyUsed && usesRemaining > 0,
  };
}

function resolveActorFromMessage(message) {
  return message.actor ||
    (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null) ||
    (message.speaker?.token ? canvas?.tokens?.get(message.speaker.token)?.actor : null) ||
    null;
}

function isAbilitySaveMessage(message) {
  if (message.flags?.dnd5e?.roll?.type === "save") return true;
  if (message.rolls?.some(r => r.options?.type === "save")) return true;
  const flavor = message.flavor ?? "";
  if (/saving throw/i.test(flavor)) return true;
  return false;
}

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
    return 1; // Assume available if uses aren't configured yet
  }
  return uses.value ?? 0;
}

// ─── HTML Builders ───────────────────────────────────────────────────────────

function createMascotButton(message, ctx) {
  const { alreadyUsed, available } = ctx;

  if (alreadyUsed) {
    return `<button type="button" class="btn btn-sm strixhaven-mascot-btn strixhaven-mascot-used" ` +
      `disabled data-action="strixhaven-mascot-succeed" data-message-id="${message.id}" ` +
      `title="Save succeeded via Cuddly Strixhaven Mascot.">` +
      `<i class="fas fa-shield-alt"></i> Save Succeeded (Mascot)</button>`;
  }

  const disabled = available ? "" : "disabled";
  const label = available
    ? "Succeed on Save (Strixhaven Mascot)"
    : "Mascot — No Uses Remaining";
  const title = available
    ? "If this save was against being frightened, use your reaction to succeed instead (once per long rest)."
    : "No uses remaining — resets on long rest.";

  return `<button type="button" class="btn btn-sm strixhaven-mascot-btn" ${disabled} ` +
    `data-action="strixhaven-mascot-succeed" data-message-id="${message.id}" title="${title}">` +
    `<i class="fas fa-shield-alt"></i> ${label}</button>`;
}

function injectMascotButton(el, buttonHtml) {
  const target =
    el.querySelector(".card-buttons") ??
    el.querySelector(".message-content .dice-roll") ??
    el;

  const position = target.matches?.(".card-buttons") ? "beforeend"
    : target === el ? "beforeend"
    : "afterend";

  target.insertAdjacentHTML(position, buttonHtml);
}

// ─── Item Use & Message Update ───────────────────────────────────────────────

async function consumeMascotUse(mascot) {
  const uses = mascot.system?.uses;
  if (!uses || uses.max == null || uses.max === 0) return;
  const current = uses.value ?? 0;
  if (current <= 0) return;
  await mascot.update({ "system.uses.value": current - 1 });
}

async function flagMessageAsSucceeded(message) {
  await message.update({
    flags: { world: { strixhavenMascotUsed: true } },
  });
}

async function announceSuccess(actor) {
  const speakerName = actor.name ?? "Unknown";
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content:
      `<p><strong>Cuddly Strixhaven Mascot</strong><br>` +
      `${speakerName} uses their reaction to succeed on the saving throw ` +
      `against being frightened.</p>`,
  });
}
