/**
 * LUCKY FEAT REMINDER MACRO
 *
 * Injects Lucky reminders into d20 roll dialogs (offensive) and on incoming
 * enemy attack chat messages (defensive).
 *
 * OFFENSIVE (any d20 roll by the Lucky character):
 *   Banner in the roll configuration dialog showing remaining Luck Points
 *   with a button to spend 1 for advantage.
 *
 * DEFENSIVE (incoming attacks against the Lucky character):
 *   Banner on enemy attack roll chat messages with a button to spend 1
 *   Luck Point, post a chat notification, and remind the DM to impose
 *   disadvantage on the roll.
 *
 * RAW (2024 Lucky): "You have a number of Luck Points equal to your
 * Proficiency Bonus… Spend 1 Luck Point (no action required) to give
 * yourself Advantage on a d20 Test you make… or to impose Disadvantage on
 * an attack roll made against you."  Points replenish on a Long Rest.
 *
 * Uses are tracked via the Lucky feat item's system.uses (max = proficiency
 * bonus, recovery on Long Rest).
 */

const MACRO_ICON = "fa-clover";
let LUCKY_DEBUG = false;

const LUCKY_FEAT_NAME = "Lucky";
const LUCKY_HOOK_FLAG = "luckyFeatHookRegistered";
const LUCKY_PENDING_KEY = "_luckyFeatPending";

const HOOK_PRE_ROLL_ATTACK = "dnd5e.preRollAttack";
const HOOK_PRE_ROLL_SAVE = "dnd5e.preRollSavingThrowV2";
const HOOK_PRE_ROLL_ABILITY = "dnd5e.preRollAbilityCheck";
const HOOK_PRE_ROLL_SKILL = "dnd5e.preRollSkill";
const HOOK_PRE_ROLL_TOOL = "dnd5e.preRollToolV2";
const HOOK_RENDER_DIALOG = "renderRollConfigurationDialog";
const HOOK_RENDER_CHAT = "dnd5e.renderChatMessage";

const SEL_BUTTONS = ".dialog-buttons";
const SEL_ADVANTAGE = "[data-action='advantage']";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[LUCKY_HOOK_FLAG]) return;
  const prev = game[LUCKY_HOOK_FLAG];
  for (const { hook, id } of prev.hookEntries ?? []) {
    Hooks.off(hook, id);
  }
  if (prev.clickHandler) document.removeEventListener("click", prev.clickHandler);
  console.log("Lucky macro torn down.");
}

function register() {
  const hookEntries = [
    { hook: HOOK_PRE_ROLL_ATTACK, id: Hooks.on(HOOK_PRE_ROLL_ATTACK, onPreRollD20) },
    { hook: HOOK_PRE_ROLL_SAVE, id: Hooks.on(HOOK_PRE_ROLL_SAVE, onPreRollD20) },
    { hook: HOOK_PRE_ROLL_ABILITY, id: Hooks.on(HOOK_PRE_ROLL_ABILITY, onPreRollD20) },
    { hook: HOOK_PRE_ROLL_SKILL, id: Hooks.on(HOOK_PRE_ROLL_SKILL, onPreRollD20) },
    { hook: HOOK_PRE_ROLL_TOOL, id: Hooks.on(HOOK_PRE_ROLL_TOOL, onPreRollD20) },
    { hook: HOOK_RENDER_DIALOG, id: Hooks.on(HOOK_RENDER_DIALOG, onRenderDialog) },
    { hook: HOOK_RENDER_CHAT, id: Hooks.on(HOOK_RENDER_CHAT, onRenderChatMessage) },
  ];
  const clickHandler = onDocumentClick;
  document.addEventListener("click", clickHandler);
  game[LUCKY_HOOK_FLAG] = { hookEntries, clickHandler };
  console.log("Lucky macro loaded.");
}

// ─── Pre-Roll Hook (all d20 rolls) ──────────────────────────────────────────

function onPreRollD20(config, dialog, message) {
  // For skill/save/check hooks, config.subject is the Actor directly.
  // For attack hooks, config.subject is the AttackActivity — navigate to actor.
  let actor = config.subject;
  if (actor && !actor.items) {
    actor = actor.actor ?? actor.item?.actor ?? actor.item?.parent;
  }
  if (!actor?.isOwner) return;

  const luckyItem = getLuckyFeat(actor);
  if (!luckyItem) return;

  const remaining = getLuckPointsRemaining(luckyItem);
  if (LUCKY_DEBUG) console.log(`Lucky | pre-roll fired, ${remaining} points remaining`);

  game[LUCKY_PENDING_KEY] = { luckyItem, remaining };
}

// ─── Dialog Injection (offensive) ────────────────────────────────────────────

const BASE_BANNER_STYLE =
  `color:white; padding:6px 10px; border-radius:4px; ` +
  `margin:0 0 8px; text-align:center; font-size:12px;`;

function onRenderDialog(app, html) {
  let pending = game[LUCKY_PENDING_KEY];

  // Fallback: if preRoll hook didn't set the key (timing issues, or
  // unhooked roll types like tools), resolve from app.config directly
  if (!pending && app.config) {
    let actor = app.config.subject;
    // For attack rolls, subject is an Activity — navigate to actor
    if (actor && !actor.items) {
      actor = actor.actor ?? actor.item?.actor ?? actor.item?.parent;
    }
    if (actor?.isOwner) {
      const luckyItem = getLuckyFeat(actor);
      if (luckyItem) {
        const remaining = getLuckPointsRemaining(luckyItem);
        pending = { luckyItem, remaining };
        if (LUCKY_DEBUG) console.log("Lucky | resolved from dialog config fallback");
      }
    }
  }

  if (!pending) return;
  delete game[LUCKY_PENDING_KEY];

  const el = html instanceof HTMLElement ? html : html[0] ?? html;

  // Re-render guard
  if (el.querySelector("[data-lucky-banner]")) return;

  // Skip if this is a STR check/save/skill while raging — Raging Effects already grants advantage
  const hookNames = app.config?.hookNames ?? [];
  if (!hookNames.includes("attack") && app.config?.ability === "str") {
    const rollActor = app.config?.subject;
    if (rollActor?.items && isActorRagingForLucky(rollActor)) {
      if (LUCKY_DEBUG) console.log("Lucky | skipping — raging STR advantage already applies");
      return;
    }
  }

  // Skip if this is a DEX save with Danger Sense — already has advantage
  if (!hookNames.includes("attack") && app.config?.ability === "dex"
      && hookNames.includes("SavingThrow")) {
    const rollActor = app.config?.subject;
    if (rollActor?.items?.some(i => i.name === "Danger Sense" && i.type === "feat")) {
      if (LUCKY_DEBUG) console.log("Lucky | skipping — Danger Sense advantage already applies");
      return;
    }
  }

  const buttons = el.querySelector(SEL_BUTTONS);
  if (!buttons) return;

  const advButton = buttons.querySelector(SEL_ADVANTAGE);
  if (!advButton) return;

  const banner = pending.remaining > 0
    ? buildLuckyButton(pending.luckyItem, pending.remaining, advButton)
    : buildNoPointsNotice();
  buttons.insertAdjacentElement("beforebegin", banner);
}

function buildLuckyButton(luckyItem, remaining, advButton) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.style.cssText =
    `${BASE_BANNER_STYLE} background:#2e5c1a; width:100%; ` +
    `border:1px solid #4a9; cursor:pointer; display:flex; ` +
    `flex-direction:column; align-items:center;`;
  btn.innerHTML =
    `<h3 style="margin:0 0 2px;">🍀 Lucky</h3>` +
    `<p style="margin:0;">Click to spend 1 for <strong>Advantage</strong> <span style="font-size:10px; opacity:0.7;">(${remaining} remaining)</span></p>`;
  btn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await consumeLuckPoint(luckyItem);
    const newRemaining = remaining - 1;
    ui.notifications.info(
      `🍀 Luck Point spent! ${newRemaining} remaining.`
    );
    advButton.click();
  });
  return btn;
}

function buildNoPointsNotice() {
  const notice = document.createElement("div");
  notice.style.cssText = `${BASE_BANNER_STYLE} background:#6b3a2e;`;
  notice.innerHTML =
    `<h3 style="margin:0 0 4px;">🍀 Lucky</h3>` +
    `<p style="margin:0;">No Luck Points remaining (resets on Long Rest)</p>`;
  return notice;
}

// ─── Chat Message Injection (defensive) ──────────────────────────────────────

function onRenderChatMessage(message, html) {
  // Only process attack rolls
  if (message.flags?.dnd5e?.roll?.type !== "attack") return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;

  // Skip if already injected
  if (el.querySelector("[data-action='lucky-defensive']")) return;

  // Find all owned actors with the Lucky feat
  const luckyActors = findOwnedLuckyActors();
  if (luckyActors.length === 0) return;

  const attackerActorId = message.speaker?.actor;
  const targets = message.flags?.dnd5e?.targets ?? [];

  for (const { actor, luckyItem } of luckyActors) {
    // Don't show on our own attacks
    if (attackerActorId === actor.id) continue;

    // Target detection: only show if this actor is a plausible target
    if (targets.length > 0 && !isActorAmongTargets(targets, actor)) continue;

    const remaining = getLuckPointsRemaining(luckyItem);
    const container = el.querySelector(".message-content");
    if (!container) return;

    if (LUCKY_DEBUG) console.log("Lucky | defensive banner injected", {
      actor: actor.name, remaining, targets: targets.length,
    });

    const buttonHtml = remaining > 0
      ? buildDefensiveButton(actor, luckyItem, remaining, targets.length === 0)
      : buildDefensiveNoUses();
    container.insertAdjacentHTML("beforeend", buttonHtml);
    break; // One banner per message
  }
}

/**
 * Find all actors owned by the current user that have the Lucky feat.
 */
function findOwnedLuckyActors() {
  const results = [];
  for (const actor of game.actors) {
    if (!actor.isOwner) continue;
    if (actor.type !== "character") continue;
    const luckyItem = getLuckyFeat(actor);
    if (luckyItem) results.push({ actor, luckyItem });
  }
  return results;
}

/**
 * Check whether an actor appears among the message's recorded targets.
 * Targets are stored as { uuid: "Scene.x.Token.y", ac: N }.
 */
function isActorAmongTargets(targets, actor) {
  return targets.some(t => {
    try {
      const doc = fromUuidSync(t.uuid);
      if (!doc) return false;
      const actorId = doc.actorId ?? doc.actor?.id;
      return actorId === actor.id;
    } catch {
      return false;
    }
  });
}

function buildDefensiveButton(actor, luckyItem, remaining, noTargetInfo) {
  const opacity = noTargetInfo ? "0.85" : "1";
  return `<div data-action="lucky-defensive"
       data-actor-id="${actor.id}" data-item-id="${luckyItem.id}"
       style="${BASE_BANNER_STYLE} background:#2e5c1a; cursor:pointer;
              margin-top:8px; opacity:${opacity};"
       title="Spend 1 Luck Point to impose disadvantage on this attack">
    <h3 style="margin:0 0 4px;">🍀 Use Lucky? (${remaining} remaining)</h3>
    <p style="margin:0;">Spend 1 to impose <strong>Disadvantage</strong> on this attack</p>
  </div>`;
}

function buildDefensiveNoUses() {
  return `<div style="${BASE_BANNER_STYLE} background:#6b3a2e; margin-top:8px;">
    <h3 style="margin:0 0 4px;">🍀 Lucky</h3>
    <p style="margin:0;">No Luck Points remaining</p>
  </div>`;
}

// ─── Click Delegation (defensive) ────────────────────────────────────────────

async function onDocumentClick(event) {
  const btn = event.target.closest("[data-action='lucky-defensive']");
  if (!btn) return;
  event.preventDefault();

  const actorId = btn.dataset.actorId;
  const itemId = btn.dataset.itemId;
  const actor = game.actors.get(actorId);
  const luckyItem = actor?.items?.get(itemId);
  if (!luckyItem) {
    ui.notifications.error("🍀 Lucky: Unable to find Lucky feat item.");
    return;
  }

  const remaining = getLuckPointsRemaining(luckyItem);
  if (remaining <= 0) {
    ui.notifications.warn("🍀 No Luck Points remaining!");
    return;
  }

  await consumeLuckPoint(luckyItem);
  const newRemaining = remaining - 1;

  // Post a chat message notifying the table
  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content:
      `<p>🍀 <strong>${actor.name}</strong> spends a Luck Point! ` +
      `The attack should be rerolled with <strong>Disadvantage</strong>.</p>` +
      `<p><em>${newRemaining} Luck Point${newRemaining !== 1 ? "s" : ""} ` +
      `remaining.</em></p>`,
  });

  // Disable the button visually
  btn.style.opacity = "0.5";
  btn.style.pointerEvents = "none";
  const btnText = btn.querySelector("p");
  if (btnText) btnText.textContent =
    `Luck Point spent! ${newRemaining} remaining.`;

  ui.notifications.info(
    `🍀 Luck Point spent! ${newRemaining} remaining. ` +
    `Ask DM to reroll with disadvantage.`
  );
}

// ─── Lucky Feat Detection ────────────────────────────────────────────────────

function getLuckyFeat(actor) {
  return actor.items?.find(
    i => i.name === LUCKY_FEAT_NAME && i.type === "feat"
  ) ?? null;
}

function getLuckPointsRemaining(luckyItem) {
  const uses = luckyItem.system?.uses;
  if (!uses || uses.max == null || uses.max === 0) {
    if (LUCKY_DEBUG) {
      console.warn(
        "Lucky: Item uses not configured. Set max uses to proficiency " +
        "bonus with 'Long Rest' recovery for automatic tracking."
      );
    }
    return 0;
  }
  return uses.max - (uses.spent ?? 0);
}

// ─── Luck Point Consumption ──────────────────────────────────────────────────

async function consumeLuckPoint(luckyItem) {
  const uses = luckyItem.system?.uses;
  if (!uses || uses.max == null || uses.max === 0) return;
  const spent = uses.spent ?? 0;
  if (spent >= uses.max) return;
  await luckyItem.update({ "system.uses.spent": spent + 1 });
  if (LUCKY_DEBUG) {
    console.log(
      `Lucky | Consumed 1 point. Now ${spent + 1}/${uses.max} spent.`
    );
  }
}

// ─── Rage Detection (for suppressing Lucky on STR rolls) ─────────────────────

function isActorRagingForLucky(actor) {
  if (!actor) return false;
  if (actor.statuses?.has("raging")) return true;
  const effects = actor.appliedEffects ?? actor.effects;
  return effects?.some(e => e.name === "Rage" && !e.disabled) ?? false;
}
// END: LUCKY FEAT REMINDER MACRO
