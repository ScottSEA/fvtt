/**
 * RAGE END SUMMARY MACRO
 *
 * When Rage ends (effect deleted or disabled), posts a whispered chat summary
 * listing all rage-dependent features that deactivate — dynamically checking
 * which features the actor actually has.
 *
 * Hooks:
 *   - deleteActiveEffect  — Rage effect removed
 *   - updateActiveEffect  — Rage effect disabled
 *
 * Set RES_DEBUG = true in the console to log hook traffic.
 */

let RES_DEBUG = false;

const RES_HOOK_FLAG = "rageEndSummaryHookRegistered";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[RES_HOOK_FLAG]) return;
  const prev = game[RES_HOOK_FLAG];
  if (prev.deleteHookId != null) Hooks.off("deleteActiveEffect", prev.deleteHookId);
  if (prev.updateHookId != null) Hooks.off("updateActiveEffect", prev.updateHookId);
  console.log("Rage End Summary macro torn down.");
}

function register() {
  const deleteHookId = Hooks.on("deleteActiveEffect", onDeleteActiveEffect);
  const updateHookId = Hooks.on("updateActiveEffect", onUpdateActiveEffect);
  game[RES_HOOK_FLAG] = { deleteHookId, updateHookId };
  console.log("Rage End Summary macro loaded.");
}

// ─── Rage Detection ──────────────────────────────────────────────────────────

function isRageEffect(effect) {
  if (effect.name === "Rage") return true;
  if (effect.statuses?.has("raging")) return true;
  return false;
}

// ─── Hook Handlers ───────────────────────────────────────────────────────────

function onDeleteActiveEffect(effect, options, userId) {
  if (game.user.id !== userId) return;
  if (!isRageEffect(effect)) return;
  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;
  if (RES_DEBUG) console.log("Rage End Summary | deleteActiveEffect — Rage removed for", actor.name);
  postRageEndSummary(actor);
}

function onUpdateActiveEffect(effect, changes, options, userId) {
  if (game.user.id !== userId) return;
  if (!isRageEffect(effect)) return;
  if (changes.disabled !== true) return;
  const actor = effect.parent;
  if (!actor || actor.documentName !== "Actor") return;
  if (RES_DEBUG) console.log("Rage End Summary | updateActiveEffect — Rage disabled for", actor.name);
  postRageEndSummary(actor);
}

// ─── Feature Detection ───────────────────────────────────────────────────────

function hasFeat(actor, name) {
  return actor.items?.some(i => i.name === name && i.type === "feat") ?? false;
}

function hasItem(actor, name) {
  return actor.items?.some(i => i.name === name) ?? false;
}

function getRageDamageBonus(actor) {
  return actor.system?.scale?.barbarian?.["rage-damage"]?.value ?? 0;
}

function isRecklessActive(actor) {
  if (actor.statuses?.has("reckless")) return true;
  return actor.effects?.some(
    e => (e.name === "Reckless Attack" || e.name === "Reckless") && !e.disabled
  ) ?? false;
}

// ─── Summary Builder ─────────────────────────────────────────────────────────

function buildSummaryItems(actor) {
  const items = [];

  // Rage Damage Bonus — all barbarians have this
  const rageDmg = getRageDamageBonus(actor);
  if (rageDmg > 0) {
    items.push({ icon: "⚔️", text: `Rage Damage Bonus (+${rageDmg})`, active: false });
  }

  // BPS Resistance — all raging barbarians have this
  items.push({ icon: "🛡️", text: "Bludgeoning/Piercing/Slashing Resistance", active: false });

  // Reckless Attack (only note if it was active)
  if (hasFeat(actor, "Reckless Attack") && isRecklessActive(actor)) {
    items.push({ icon: "🎯", text: "Reckless Attack advantage (enemies still have advantage on you until your next turn)", active: false });
  }

  // Primal Knowledge — STR swaps for skills
  if (hasFeat(actor, "Primal Knowledge")) {
    items.push({ icon: "🧠", text: "Primal Knowledge STR-based skill swaps", active: false });
  }

  // Life-Giving Force (Vitality of the Tree subclass)
  if (hasItem(actor, "Vitality of the Tree")) {
    items.push({ icon: "🌿", text: "Life-Giving Force (temp HP to allies)", active: false });
  }

  // Branches of the Tree
  if (hasFeat(actor, "Branches of the Tree")) {
    items.push({ icon: "🌳", text: "Branches of the Tree (reaction teleport)", active: false });
  }

  // Battering Roots
  if (hasFeat(actor, "Battering Roots")) {
    items.push({ icon: "🌱", text: "Battering Roots (extra reach + mastery)", active: false });
  }

  // Danger Sense — NOT rage-dependent, note as still active
  if (hasFeat(actor, "Danger Sense")) {
    items.push({ icon: "✅", text: "Danger Sense (still active — not rage-dependent)", active: true });
  }

  return items;
}

// ─── Chat Message ────────────────────────────────────────────────────────────

function postRageEndSummary(actor) {
  const items = buildSummaryItems(actor);
  if (items.length === 0) return;

  const listHtml = items.map(item => {
    const color = item.active ? "#8fdf6f" : "#f0c0b0";
    const strikeStyle = item.active ? "" : "text-decoration: line-through; opacity: 0.85;";
    return `<li style="margin:3px 0; color:${color}; ${strikeStyle}">${item.icon} ${item.text}</li>`;
  }).join("");

  const content =
    `<div style="border:2px solid #8b1a1a; border-radius:8px; padding:8px; background:linear-gradient(135deg, #2a0a0a 0%, #5c1a1a 100%);">` +
    `<h2 style="margin:0 0 6px; font-size:15px; font-weight:bold; color:#ff6b6b; text-align:center;">` +
    `💀 Rage Ended 💀</h2>` +
    `<p style="margin:4px 0 8px; color:#e0a0a0; text-align:center; font-size:12px;">` +
    `<strong>${actor.name}</strong>'s Rage has ended. The following features deactivate:</p>` +
    `<ul style="list-style:none; padding:0; margin:0 8px;">` +
    listHtml +
    `</ul>` +
    `</div>`;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    whisper: [game.user.id],
  });

  if (RES_DEBUG) console.log("Rage End Summary | Posted summary for", actor.name);
}
