/**
 * DIVINE SMITE MACRO
 *
 * Injects a "Divine Smite?" banner with spell slot buttons into melee attack
 * hit messages for Paladin characters. Clicking a slot level rolls the extra
 * radiant damage and consumes the spell slot.
 *
 * RAW (2024 Paladin): "When you hit a target with a melee weapon attack, you
 * can expend one spell slot to deal extra Radiant damage to the target, in
 * addition to the weapon's damage. The extra damage is 2d8 for a 1st-level
 * spell slot, plus 1d8 for each slot level above 1st. The damage increases
 * by 1d8 if the target is an Undead or a Fiend, to a maximum of 6d8."
 *
 * Hooks: dnd5e.renderChatMessage, document click delegation
 */

const MACRO_ICON = "fa-sun";

const DS_HOOK_FLAG = "divineSmiteHookRegistered";
const DS_FEAT_NAME = "Divine Smite";
const DS_CLICK_FLAG = "_divineSmiteClickRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[DS_HOOK_FLAG]) return;
  const prev = game[DS_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  if (prev.clickHandler && game[DS_CLICK_FLAG]) {
    document.removeEventListener("click", prev.clickHandler);
    delete game[DS_CLICK_FLAG];
  }
  delete game[DS_HOOK_FLAG];
  console.log("Divine Smite macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);

  const clickHandler = onDocumentClick;
  if (!game[DS_CLICK_FLAG]) {
    document.addEventListener("click", clickHandler);
    game[DS_CLICK_FLAG] = true;
  }

  game[DS_HOOK_FLAG] = { hookId, clickHandler };
  console.log("Divine Smite macro loaded.");
}

// ─── Chat Message Hook ──────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  // Only process attack rolls
  const rollType = message.flags?.dnd5e?.roll?.type;
  if (rollType !== "attack") return;

  const el = html instanceof HTMLElement ? html : html[0] ?? html;

  // Skip if already injected
  if (el.querySelector("[data-action='divine-smite']")) return;

  // Resolve the actor who made the attack
  const actorId = message.speaker?.actor;
  if (!actorId) return;
  const actor = game.actors.get(actorId);
  if (!actor?.isOwner) return;

  // Must have Divine Smite feat
  const feat = actor.items.find(
    i => i.name === DS_FEAT_NAME && i.type === "feat"
  );
  if (!feat) return;

  // Must be a melee weapon attack
  if (!isMeleeAttack(message, actor)) return;

  // Build available spell slot buttons (levels 1–5 for smite, capped at 6d8)
  const slotButtons = buildSlotButtons(actor);
  if (!slotButtons) return;

  const container = el.querySelector(".message-content");
  if (!container) return;

  const bannerHtml =
    `<div style="border:2px solid #d4a017; border-radius:8px; padding:8px;
                 background:linear-gradient(135deg, #3a2a0a 0%, #5c4420 100%);
                 text-align:center; margin-top:8px;">
       <h3 style="margin:0 0 4px; color:#ffd700;">⚔️ Divine Smite?</h3>
       <p style="margin:4px 0; color:#e8c860; font-size:12px;">
         Expend a spell slot for extra radiant damage</p>
       <div style="display:flex; flex-wrap:wrap; gap:4px; justify-content:center; margin-top:6px;">
         ${slotButtons}
       </div>
     </div>`;

  container.insertAdjacentHTML("beforeend", bannerHtml);
}

// ─── Melee Attack Detection ─────────────────────────────────────────────────

function isMeleeAttack(message, actor) {
  // Check the item that made the attack
  const itemId = message.flags?.dnd5e?.roll?.itemId;
  if (!itemId) return false;

  const item = actor.items.get(itemId);
  if (!item) return false;

  const weaponType = item.system?.type?.value;
  if (!weaponType) return false;

  // Melee: simpleM, martialM, natural
  const isMelee = weaponType.endsWith("M") || weaponType === "natural";
  if (!isMelee) return false;

  // Exclude thrown attacks
  const attackMode = message.flags?.dnd5e?.roll?.attackMode;
  if (attackMode === "thrown") return false;

  return true;
}

// ─── Slot Button Builder ────────────────────────────────────────────────────

function buildSlotButtons(actor) {
  const buttons = [];
  // Smite can use slots 1–5; damage caps at 6d8 total (slot level 4 for non-undead,
  // slot level 5 adds the +1d8 undead/fiend bonus). Show all available slots up to 5.
  for (let level = 1; level <= 5; level++) {
    const slotKey = `spell${level}`;
    const slot = actor.system?.spells?.[slotKey];
    if (!slot || slot.max <= 0) continue;
    if (slot.value <= 0) continue;

    const dice = 1 + level; // 2d8 at level 1, 3d8 at level 2, etc.
    buttons.push(
      `<button data-action="divine-smite"
              data-actor-id="${actor.id}" data-slot-level="${level}"
              data-slot-key="${slotKey}" data-remaining="${slot.value}"
              style="background:#6b4c1a; color:#ffd700; border:1px solid #d4a017;
                     border-radius:4px; padding:4px 10px; cursor:pointer;
                     font-size:12px; font-weight:bold;">
         Lvl ${level} (${dice}d8) — ${slot.value} slot${slot.value !== 1 ? "s" : ""}
       </button>`
    );
  }

  return buttons.length > 0 ? buttons.join("") : null;
}

// ─── Click Delegation ────────────────────────────────────────────────────────

async function onDocumentClick(event) {
  const btn = event.target.closest("[data-action='divine-smite']");
  if (!btn) return;
  event.preventDefault();

  const actorId = btn.dataset.actorId;
  const slotLevel = parseInt(btn.dataset.slotLevel, 10);
  const slotKey = btn.dataset.slotKey;

  const actor = game.actors.get(actorId);
  if (!actor) {
    ui.notifications.error("⚔️ Divine Smite: Actor not found.");
    return;
  }

  // Verify slot still has charges
  const currentSlots = actor.system?.spells?.[slotKey]?.value ?? 0;
  if (currentSlots <= 0) {
    ui.notifications.warn("⚔️ No spell slots remaining at that level!");
    return;
  }

  // Consume the spell slot
  try {
    await actor.update({ [`system.spells.${slotKey}.value`]: currentSlots - 1 });
  } catch (err) {
    ui.notifications.error(`⚔️ Divine Smite: Failed to consume spell slot — ${err.message}`);
    return;
  }

  // Roll the smite damage: 2d8 base + 1d8 per slot level above 1st
  const baseDice = 1 + slotLevel; // e.g. level 1 = 2d8, level 2 = 3d8
  const roll = new Roll(`${baseDice}d8`);
  await roll.evaluate();

  // Also show the undead/fiend bonus roll info
  const undeadDice = baseDice + 1;
  const newRemaining = currentSlots - 1;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content:
      `<div style="border:2px solid #d4a017; border-radius:8px; padding:8px; background:linear-gradient(135deg, #3a2a0a 0%, #5c4420 100%); text-align:center;">` +
      `<h3 style="margin:0 0 4px; color:#ffd700;">⚔️ Divine Smite!</h3>` +
      `<p style="margin:4px 0; color:#e8c860;">` +
      `<strong>${actor.name}</strong> channels divine energy (Level ${slotLevel} slot)</p>` +
      `<p style="margin:4px 0; font-size:18px; color:#ffdd44;">` +
      `<strong>${roll.total}</strong> radiant damage (${baseDice}d8)</p>` +
      `<p style="margin:4px 0; color:#ccaa44; font-size:12px;">` +
      `+1d8 if target is Undead or Fiend (${undeadDice}d8 total)</p>` +
      `<p style="margin:2px 0 0; color:#aa8833; font-size:12px;">` +
      `Level ${slotLevel} slots remaining: ${newRemaining}</p>` +
      `</div>`,
    rolls: [roll],
  });

  // Disable the entire smite banner
  const banner = btn.closest("[style*='divine']") ?? btn.parentElement?.parentElement;
  if (banner) {
    banner.style.opacity = "0.5";
    banner.style.pointerEvents = "none";
    const title = banner.querySelector("h3");
    if (title) title.textContent = "⚔️ Divine Smite Used";
  }
}

// END: DIVINE SMITE MACRO
