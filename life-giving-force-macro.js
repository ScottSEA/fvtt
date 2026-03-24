/**
 * LIFE-GIVING FORCE MACRO
 *
 * Displays a notification when it becomes your turn in combat.
 * If Rage is active and the actor has the Vitality of the Tree feature,
 * offers a dialog to use Life-Giving Force: roll Xd6 (X = Rage Damage bonus)
 * and apply the result as Temporary HP to a targeted creature.
 */

const LGF_HOOK_FLAG = "lifeGivingForceHookRegistered";
const LIFE_GIVING_FORCE_NAME = "Vitality of the Tree";

const LGF_CHAT_FLAG = "lgf-temp-hp";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  // Clean up legacy hook from old flag name
  const legacyFlag = "turnNotifyHookRegistered";
  if (game[legacyFlag]) {
    const legacy = game[legacyFlag];
    if (legacy.hookId != null) Hooks.off("updateCombat", legacy.hookId);
    delete game[legacyFlag];
  }

  if (!game[LGF_HOOK_FLAG]) return;
  const prev = game[LGF_HOOK_FLAG];
  if (prev.combatHookId != null) Hooks.off("updateCombat", prev.combatHookId);
  if (prev.chatHookId != null) Hooks.off("renderChatMessage", prev.chatHookId);
  console.log("Life-Giving Force macro torn down.");
}

function register() {
  const combatHookId = Hooks.on("updateCombat", onUpdateCombat);
  const chatHookId = Hooks.on("renderChatMessage", onRenderChatMessage);
  game[LGF_HOOK_FLAG] = { combatHookId, chatHookId };
  console.log("Life-Giving Force macro loaded.");
}

// ─── Combat Hook ─────────────────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  if (!("turn" in changed || "round" in changed)) return;

  const combatant = combat.combatant;
  if (!combatant?.isOwner) return;
  if (combatant.isDefeated) return;

  const actor = combatant.actor;
  const name = actor.name ?? "Unknown";

  ui.notifications.info(`⚔️ It's ${name}'s turn!`);

  const isRaging = isActorRaging(actor);
  const hasLifeGiving = actor?.items?.find(
    i => i.name === LIFE_GIVING_FORCE_NAME && i.type === "feat"
  );

  console.log(`Life-Giving Force | Raging: ${isRaging}, Has Feature: ${!!hasLifeGiving}`);

  if (isRaging && hasLifeGiving) {
    showLifeGivingForceDialog(actor, name);
  }
}

// ─── Rage Detection ──────────────────────────────────────────────────────────

function isActorRaging(actor) {
  if (!actor) return false;
  // Check for "raging" status (set by Rage active effect)
  if (actor.statuses?.has("raging")) return true;
  // Fallback: look for an enabled effect named "Rage"
  return actor.effects?.some(e => e.name === "Rage" && !e.disabled) ?? false;
}

// ─── Rage Damage Bonus ───────────────────────────────────────────────────────

function getRageDamageBonus(actor) {
  return actor.system?.scale?.barbarian?.["rage-damage"]?.value ?? 0;
}

// ─── Life-Giving Force ───────────────────────────────────────────────────────

async function showLifeGivingForceDialog(actor, name) {
  const rageDmg = getRageDamageBonus(actor);
  if (rageDmg <= 0) return;

  const confirmed = await Dialog.confirm({
    title: "🌳 Life-Giving Force",
    content:
      `<p><strong>${name}</strong> is Raging with Vitality of the Tree!</p>` +
      `<p>Use <strong>Life-Giving Force</strong> to grant <strong>${rageDmg}d6</strong> ` +
      `Temporary HP to a creature within 10 feet?</p>` +
      `<p><em>Target a token before clicking Yes.</em></p>`,
    yes: () => true,
    no: () => false,
    defaultYes: true,
  });

  if (!confirmed) return;

  const targets = game.user.targets;
  if (targets.size === 0) {
    ui.notifications.warn("🌳 No target selected — select a token and try again.");
    return;
  }

  const target = targets.first();
  const targetActor = target.actor;
  if (!targetActor) {
    ui.notifications.warn("🌳 Target has no actor data.");
    return;
  }

  const formula = `${rageDmg}d6`;
  const roll = await new Roll(formula).evaluate();
  const tempHP = roll.total;

  // Post a chat message with the roll and an "Apply" button for the target
  const buttonStyle = "background:#4a8a3f; color:white; border:none; padding:6px 16px; " +
    "border-radius:4px; cursor:pointer; font-size:14px; margin-top:6px;";
  const content =
    `<div style="text-align:center;">` +
    `<h3 style="margin:0 0 4px;">🌳 Life-Giving Force</h3>` +
    `<p style="margin:4px 0;"><strong>${name}</strong> grants <strong>${tempHP}</strong> ` +
    `Temporary HP to <strong>${targetActor.name}</strong>!</p>` +
    `<p style="margin:4px 0; font-size:12px; color:#666;">` +
    `(${roll.formula} = ${roll.result})</p>` +
    `<button class="${LGF_CHAT_FLAG}" ` +
    `data-temp-hp="${tempHP}" ` +
    `data-target-actor-id="${targetActor.id}" ` +
    `data-target-name="${targetActor.name}" ` +
    `style="${buttonStyle}">` +
    `Apply ${tempHP} Temp HP to ${targetActor.name}</button>` +
    `</div>`;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
  });
}

// ─── Chat Button Handler ─────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  const btn = html[0]?.querySelector?.(`.${LGF_CHAT_FLAG}`)
    ?? html.find?.(`.${LGF_CHAT_FLAG}`)?.[0];
  if (!btn) return;

  btn.addEventListener("click", async (event) => {
    event.preventDefault();

    const tempHP = Number(event.currentTarget.dataset.tempHp);
    const targetActorId = event.currentTarget.dataset.targetActorId;
    const targetName = event.currentTarget.dataset.targetName;
    if (!tempHP || tempHP <= 0 || !targetActorId) return;

    // Look up the target actor and check ownership
    const targetActor = game.actors.get(targetActorId);
    if (!targetActor) {
      ui.notifications.warn(`🌳 Target actor not found.`);
      return;
    }
    if (!targetActor.isOwner) {
      ui.notifications.warn(`🌳 You don't have permission to update ${targetName}.`);
      return;
    }

    const currentTemp = targetActor.system.attributes.hp.temp ?? 0;
    if (tempHP > currentTemp) {
      await targetActor.update({ "system.attributes.hp.temp": tempHP });
      ui.notifications.info(
        `🌳 ${targetActor.name} gains ${tempHP} Temporary HP from Life-Giving Force!`
      );
    } else {
      ui.notifications.info(
        `🌳 ${targetActor.name} already has ${currentTemp} Temp HP (rolled ${tempHP}). No change.`
      );
    }
  });
}
