/**
 * INDOMITABLE MACRO
 *
 * Injects a reroll button into saving throw chat messages when the save
 * fails and the Fighter has Indomitable uses remaining.
 *
 * RAW (2024 Fighter): "If you fail a saving throw, you can reroll it with
 * a bonus equal to your Fighter level. You must use the new roll. You can
 * use this feature a number of times equal to your proficiency bonus.
 * You regain all expended uses when you finish a Long Rest."
 *
 * Detection: renderChatMessage for saving throw results. Checks the roll
 * total against the DC from message flags. Injects a clickable banner.
 *
 * Hooks: dnd5e.renderChatMessage, document click delegation
 */

const MACRO_ICON = "fa-shield-halved";

const ID_HOOK_FLAG = "indomitableHookRegistered";
const ID_FEAT_NAME = "Indomitable";
const ID_CLICK_FLAG = "_indomitableClickRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[ID_HOOK_FLAG]) return;
  const prev = game[ID_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  if (prev.clickHandler && game[ID_CLICK_FLAG]) {
    document.removeEventListener("click", prev.clickHandler);
    delete game[ID_CLICK_FLAG];
  }
  delete game[ID_HOOK_FLAG];
  console.log("Indomitable macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);

  // Document-level click delegation for reroll buttons
  const clickHandler = onDocumentClick;
  if (!game[ID_CLICK_FLAG]) {
    document.addEventListener("click", clickHandler);
    game[ID_CLICK_FLAG] = true;
  }

  game[ID_HOOK_FLAG] = { hookId, clickHandler };
  console.log("Indomitable macro loaded.");
}

// ─── Chat Message Hook ──────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  // Only process saving throw rolls
  const rollType = message.flags?.dnd5e?.roll?.type;
  if (rollType !== "save") return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;

  // Skip if already injected
  if (el.querySelector("[data-action='indomitable-reroll']")) return;

  // Resolve the actor who made the save
  const actorId = message.speaker?.actor;
  if (!actorId) return;
  const actor = game.actors.get(actorId);
  if (!actor?.isOwner) return;

  // Check if actor has Indomitable
  const feat = actor.items.find(
    i => i.name === ID_FEAT_NAME && i.type === "feat"
  );
  if (!feat) return;

  const remaining = getUsesRemaining(feat);
  if (remaining <= 0) return;

  // Determine if the save failed (roll total < DC)
  const dc = message.flags?.dnd5e?.roll?.dc;
  const rollTotal = message.rolls?.[0]?.total;
  if (dc == null || rollTotal == null) return;
  if (rollTotal >= dc) return; // save succeeded

  // Determine Fighter level for the reroll bonus
  const fighterClass = actor.items.find(
    i => i.type === "class" && (i.system?.identifier === "fighter" || i.name?.toLowerCase() === "fighter")
  );
  const level = fighterClass?.system?.levels ?? fighterClass?.system?.level ?? 0;
  const ability = message.flags?.dnd5e?.roll?.ability ?? "?";
  const abilityLabel = CONFIG.DND5E?.abilities?.[ability]?.label ?? ability.toUpperCase();
  const max = feat.system?.uses?.max ?? 0;

  const container = el.querySelector(".message-content");
  if (!container) return;

  const buttonHtml =
    `<div data-action="indomitable-reroll"
         data-actor-id="${actor.id}" data-item-id="${feat.id}"
         data-ability="${ability}" data-dc="${dc}" data-level="${level}"
         style="border:2px solid #8888cc; border-radius:8px; padding:8px;
                background:linear-gradient(135deg, #1a1a40 0%, #2a2a60 100%);
                text-align:center; cursor:pointer; margin-top:8px;"
         title="Spend 1 Indomitable use to reroll this save">
      <h3 style="margin:0 0 4px; color:#aaaaff;">🛡️ Invoke Indomitable?</h3>
      <p style="margin:0; color:#ccccff;">
        Reroll this ${abilityLabel} save with <strong>+${level}</strong> bonus
      </p>
      <p style="margin:2px 0 0; color:#9999cc; font-size:12px;">
        ${remaining}/${max} use${max !== 1 ? "s" : ""} remaining
      </p>
    </div>`;

  container.insertAdjacentHTML("beforeend", buttonHtml);
}

// ─── Click Delegation ────────────────────────────────────────────────────────

async function onDocumentClick(event) {
  const btn = event.target.closest("[data-action='indomitable-reroll']");
  if (!btn) return;
  event.preventDefault();

  const actorId = btn.dataset.actorId;
  const itemId = btn.dataset.itemId;
  const ability = btn.dataset.ability;
  const dc = parseInt(btn.dataset.dc, 10);
  const level = parseInt(btn.dataset.level, 10);

  const actor = game.actors.get(actorId);
  const feat = actor?.items?.get(itemId);
  if (!feat) {
    ui.notifications.error("🛡️ Indomitable: Unable to find feature.");
    return;
  }

  const remaining = getUsesRemaining(feat);
  if (remaining <= 0) {
    ui.notifications.warn("🛡️ No Indomitable uses remaining!");
    return;
  }

  // Consume one use
  const spent = feat.system?.uses?.spent ?? 0;
  await feat.update({ "system.uses.spent": spent + 1 });
  const newRemaining = remaining - 1;

  // Roll the new save with Fighter level bonus
  const abilityLabel = CONFIG.DND5E?.abilities?.[ability]?.label ?? ability.toUpperCase();
  const roll = new Roll(`1d20 + @mod + @prof + ${level}`, actor.getRollData());
  await roll.evaluate();

  const success = roll.total >= dc;
  const resultColor = success ? "#66ff66" : "#ff6666";
  const resultText = success ? "SUCCESS" : "STILL FAILED";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content:
      `<div style="border:2px solid #8888cc; border-radius:8px; padding:8px; background:linear-gradient(135deg, #1a1a40 0%, #2a2a60 100%); text-align:center;">` +
      `<h3 style="margin:0 0 4px; color:#aaaaff;">🛡️ Indomitable Reroll</h3>` +
      `<p style="margin:4px 0; color:#ccccff;">` +
      `<strong>${actor.name}</strong> rerolls ${abilityLabel} save (DC ${dc}) with +${level} bonus</p>` +
      `<p style="margin:4px 0; font-size:18px; color:${resultColor};">` +
      `<strong>${roll.total}</strong> — ${resultText}</p>` +
      `<p style="margin:2px 0 0; color:#9999cc; font-size:12px;">` +
      `${newRemaining} use${newRemaining !== 1 ? "s" : ""} remaining</p>` +
      `</div>`,
    rolls: [roll],
  });

  // Disable the button
  btn.style.opacity = "0.5";
  btn.style.pointerEvents = "none";
  const btnTitle = btn.querySelector("h3");
  if (btnTitle) btnTitle.textContent = `🛡️ Indomitable Used (${resultText})`;
}

// ─── Uses Helper ─────────────────────────────────────────────────────────────

function getUsesRemaining(item) {
  const uses = item.system?.uses;
  if (!uses || uses.max == null || uses.max === 0) return 0;
  return uses.max - (uses.spent ?? 0);
}
// END: INDOMITABLE MACRO
