/**
 * GRAZE MASTERY MACRO
 *
 * When a melee attack with a weapon that has the Graze mastery does not
 * confirm as a hit, injects a "Graze" button into the attack chat message
 * to deal ability-modifier damage to the target.
 *
 * On a confirmed miss the button is prominent. If hit/miss state cannot
 * be determined (no target selected), a subtler "(if missed)" button is
 * shown so the player can still fire it when they know the attack missed.
 *
 * RAW (Weapon Mastery — Graze, 2024 PHB): "If your attack roll with this
 * weapon misses a creature, you can deal damage to that creature equal to
 * the ability modifier you used to make the attack roll. This damage is the
 * same type dealt by the weapon, and the damage can be increased only by
 * increasing the ability modifier."
 *
 * Hooks: dnd5e.renderChatMessage, click delegation
 */

const MACRO_ICON = "fa-slash";
let GRAZE_DEBUG = false;

const GRAZE_HOOK_FLAG = "grazeMasteryHookRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[GRAZE_HOOK_FLAG]) return;
  const prev = game[GRAZE_HOOK_FLAG];
  if (prev.renderHookId != null) Hooks.off("dnd5e.renderChatMessage", prev.renderHookId);
  if (prev.clickHandler) document.removeEventListener("click", prev.clickHandler);
  const oldStyle = document.getElementById("graze-mastery-macro-style");
  if (oldStyle) oldStyle.remove();
  delete game[GRAZE_HOOK_FLAG];
  console.log("Graze Mastery macro torn down.");
}

function register() {
  ensureGrazeStyles();
  const renderHookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  const clickHandler = onDocumentClick;
  document.addEventListener("click", clickHandler);
  game[GRAZE_HOOK_FLAG] = { renderHookId, clickHandler };
  console.log("Graze Mastery macro loaded.");
}

// ─── Hook & Event Handlers ───────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  if (el.querySelector("[data-action='graze-apply']")) return;

  const ctx = analyzeForGraze(message, el);
  if (!ctx) return;

  if (GRAZE_DEBUG) console.log("Graze | Eligible attack detected:", message.id, ctx);

  const buttonHtml = createGrazeButton(message, ctx);
  injectGrazeButton(el, buttonHtml);
}

function onDocumentClick(event) {
  const btn = event.target.closest("[data-action='graze-apply']");
  if (!btn) return;
  handleGrazeApply(event, btn);
}

// ─── Message Analysis ────────────────────────────────────────────────────────

function analyzeForGraze(message, el) {
  // Must be an attack roll
  const rollType = message.flags?.dnd5e?.roll?.type;
  if (rollType !== "attack") return null;

  const actor = resolveActorFromMessage(message);
  if (!actor || !actor.isOwner) return null;

  const weapon = resolveWeaponFromMessage(message, actor);
  if (!weapon) return null;

  if (!isMeleeWeapon(weapon, message)) return null;

  // Weapon must have Graze mastery assigned
  if (weapon.system?.mastery !== "graze") return null;

  // Determine hit / miss / unknown
  const missState = detectMissState(message, el);
  if (missState === "hit") return null;

  const abilityMod = getAttackAbilityMod(actor, weapon);
  if (abilityMod <= 0) return null; // 0 damage Graze is pointless

  const damageType = getWeaponDamageType(weapon);
  const isConfirmedMiss = missState === "miss";

  return { actor, weapon, abilityMod, damageType, isConfirmedMiss };
}

// ─── Miss Detection ──────────────────────────────────────────────────────────

function detectMissState(message, el) {
  // Critical hits always hit
  if (detectCritical(message, el)) return "hit";

  const roll = message.rolls?.[0];
  const rollTotal = roll?.total;
  if (rollTotal == null) return "unknown";

  // Natural 1 always misses (2024 rules)
  const d20Result = roll?.terms?.[0]?.results?.[0]?.result;
  if (d20Result === 1) return "miss";

  // Check message flags for target AC data
  const targets = message.flags?.dnd5e?.targets ?? [];
  if (targets.length > 0) {
    const anyMiss = targets.some(t => {
      const ac = typeof t.ac === "number" ? t.ac : null;
      return ac != null && rollTotal < ac;
    });
    return anyMiss ? "miss" : "hit";
  }

  // Check HTML for target evaluation indicators (dnd5e v5 renders these)
  const hitEls = el.querySelectorAll(
    '.target.hit, .target [data-state="hit"], .evaluation .hit'
  );
  const missEls = el.querySelectorAll(
    '.target.miss, .target [data-state="miss"], .evaluation .miss'
  );
  if (missEls.length > 0) return "miss";
  if (hitEls.length > 0 && missEls.length === 0) return "hit";

  return "unknown";
}

function detectCritical(message, el) {
  if (el.querySelector(".dice-total.critical")) return true;
  if (message.rolls?.some(r => r.isCritical)) return true;
  if (message.flags?.dnd5e?.roll?.isCritical) return true;

  const roll = message.rolls?.[0];
  if (roll) {
    const d20Term = roll.terms?.find(t => t.faces === 20);
    if (d20Term) {
      const threshold = roll.options?.criticalSuccess ?? roll.options?.critical ?? 20;
      const result = d20Term.results?.[0]?.result;
      if (result != null && result >= threshold) return true;
    }
  }
  return false;
}

// ─── Actor & Item Resolution ─────────────────────────────────────────────────

function resolveActorFromMessage(message) {
  return message.actor
    || (message.speaker?.actor ? game.actors.get(message.speaker.actor) : null)
    || (message.speaker?.token ? canvas?.tokens?.get(message.speaker.token)?.actor : null)
    || null;
}

function resolveWeaponFromMessage(message, actor) {
  if (!actor) return null;

  const itemId = message.flags?.dnd5e?.item?.id;
  if (itemId) {
    const item = actor.items.get(itemId);
    if (item?.type === "weapon") return item;
  }

  const itemName = message.flags?.dnd5e?.item?.name;
  if (itemName) {
    const item = actor.items.getName(itemName);
    if (item?.type === "weapon") return item;
  }

  // Fallback: match weapon name from flavor text
  const flavor = message.flavor ?? "";
  if (flavor) {
    for (const item of actor.items) {
      if (item.type === "weapon" && flavor.includes(item.name)) return item;
    }
  }
  return null;
}

function isMeleeWeapon(item, message) {
  if (!item) return false;
  if (item.system?.actionType === "mwak") return true;

  // Exclude ranged/thrown attacks
  const attackMode = message?.flags?.dnd5e?.roll?.attackMode;
  if (attackMode && ["ranged", "thrown"].includes(attackMode)) return false;

  // Weapon type classification (simpleM, martialM = melee)
  const weaponType = item.system?.type?.value ?? "";
  if (weaponType.endsWith("M")) return true;

  // Attack mode confirms melee
  if (attackMode === "twoHanded" || attackMode === "oneHanded") return true;

  return false;
}

// ─── Damage Calculation ──────────────────────────────────────────────────────

function getAttackAbilityMod(actor, weapon) {
  const props = weapon.system?.properties;
  const isFinesse = props?.has?.("fin")
    || (Array.isArray(props) && props.includes("fin"));

  const strMod = actor.system?.abilities?.str?.mod ?? 0;
  const dexMod = actor.system?.abilities?.dex?.mod ?? 0;
  return isFinesse ? Math.max(strMod, dexMod) : strMod;
}

function getWeaponDamageType(weapon) {
  // dnd5e v5: base damage types (Set)
  const baseTypes = weapon.system?.damage?.base?.types;
  if (baseTypes?.size > 0) return baseTypes.values().next().value;

  // v5/v4: base damage type string
  const baseType = weapon.system?.damage?.base?.type;
  if (baseType) return baseType;

  // Legacy: damage parts
  const parts = weapon.system?.damage?.parts;
  if (parts?.length > 0) return parts[0][1] || "slashing";

  return "slashing";
}

// ─── Button Handling ─────────────────────────────────────────────────────────

async function handleGrazeApply(event, btn) {
  event.preventDefault();

  const messageId = btn.dataset.messageId;
  const message = game.messages.get(messageId);
  if (!message) return;

  const actor = resolveActorFromMessage(message);
  if (!actor) {
    ui.notifications.error("Graze: Unable to determine actor.");
    return;
  }

  const abilityMod = Number(btn.dataset.damage);
  const damageType = btn.dataset.damageType || "slashing";
  const weaponName = btn.dataset.weaponName || "weapon";

  // Disable button immediately
  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-check"></i> Graze Applied`;
  btn.classList.add("graze-btn-used");

  // Post damage with roll attached (for dnd5e Apply Damage) but suppress sound
  const roll = new Roll(`${abilityMod}`);
  await roll.evaluate();

  const content = `
    <div class="graze-result-card">
      <h4 class="graze-result-title">🗡️ Graze — ${weaponName}</h4>
      <p class="graze-result-desc">
        Attack missed, but Graze deals <strong>${abilityMod} ${damageType}</strong> damage.
      </p>
    </div>`;

  await ChatMessage.create({
    author: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    rolls: [roll],
    sound: null,
    style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER,
    "flags.dnd5e.roll": { type: "damage" },
  });

  if (GRAZE_DEBUG) console.log(`Graze | Applied ${abilityMod} ${damageType} damage.`);
}

// ─── HTML Builders ───────────────────────────────────────────────────────────

function createGrazeButton(message, ctx) {
  const label = ctx.isConfirmedMiss
    ? `🗡️ Graze: Deal ${ctx.abilityMod} ${ctx.damageType}`
    : `🗡️ Graze: Deal ${ctx.abilityMod} ${ctx.damageType} (if missed)`;

  return `
    <div class="graze-btn-container ${ctx.isConfirmedMiss ? "graze-confirmed-miss" : "graze-unknown-miss"}">
      <button type="button" class="btn btn-sm graze-btn"
        data-action="graze-apply"
        data-message-id="${message.id}"
        data-damage="${ctx.abilityMod}"
        data-damage-type="${ctx.damageType}"
        data-weapon-name="${ctx.weapon.name}"
        title="Graze Mastery: deal ability modifier damage on a miss">
        ${label}
      </button>
    </div>`;
}

function injectGrazeButton(el, buttonHtml) {
  const target =
    el.querySelector(".card-buttons")
    ?? el.querySelector(".message-content .dice-roll")
    ?? el.querySelector(".message-content")
    ?? el;

  const position = target.matches?.(".card-buttons") ? "beforebegin"
    : target === el ? "beforeend"
    : "afterend";

  target.insertAdjacentHTML(position, buttonHtml);
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function ensureGrazeStyles() {
  if (document.getElementById("graze-mastery-macro-style")) return;

  const style = document.createElement("style");
  style.id = "graze-mastery-macro-style";
  style.innerHTML = `
    .graze-btn-container {
      margin: 6px 0;
    }

    .graze-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      padding: 6px 10px;
      background: linear-gradient(135deg, #4a3728 0%, #6b4c3b 100%);
      color: #f0e6d8;
      border: 1px solid #8b6914;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85em;
      font-weight: 600;
      transition: all 0.2s ease;
    }

    .graze-confirmed-miss .graze-btn {
      background: linear-gradient(135deg, #5c3a1a 0%, #8b5e2b 100%);
      border-color: #d4a017;
      box-shadow: 0 1px 4px rgba(212, 160, 23, 0.3);
    }

    .graze-unknown-miss .graze-btn {
      opacity: 0.7;
      font-style: italic;
    }

    .graze-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #6b4c3b 0%, #8b6914 100%);
      border-color: #d4a017;
      box-shadow: 0 2px 6px rgba(212, 160, 23, 0.4);
      transform: translateY(-1px);
    }

    .graze-btn:disabled, .graze-btn-used {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }

    .graze-result-card {
      background: linear-gradient(135deg, #4a3728 0%, #6b4c3b 100%);
      color: #f0e6d8;
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #8b6914;
      margin: 4px 0;
    }

    .graze-result-title {
      margin: 0 0 4px;
      font-size: 1em;
      color: #d4a017;
    }

    .graze-result-desc {
      margin: 0;
      font-size: 0.9em;
      line-height: 1.4;
    }
  `;
  document.head.appendChild(style);
}
// END: GRAZE MASTERY MACRO
