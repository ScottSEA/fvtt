/**
 * SECOND WIND REMINDER MACRO
 *
 * Posts a whispered chat reminder at the start of the Fighter's combat turn
 * when Second Wind has uses remaining AND the character is below 50% HP.
 *
 * RAW (2024 Fighter): "You have a limited well of physical stamina that you
 * can draw on. As a Bonus Action, you can use it to regain Hit Points equal
 * to 1d10 + your Fighter level. You can use this feature a number of times
 * equal to your proficiency bonus. You regain all expended uses when you
 * finish a Short or Long Rest."
 *
 * Hooks: updateCombat
 */

const MACRO_ICON = "fa-heart-pulse";

const SW_HOOK_FLAG = "secondWindHookRegistered";
const SW_FEAT_NAME = "Second Wind";
const SW_LAST_TURN_KEY = "_secondWindLastTurn";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[SW_HOOK_FLAG]) return;
  const prev = game[SW_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("updateCombat", prev.hookId);
  delete game[SW_HOOK_FLAG];
  console.log("Second Wind macro torn down.");
}

function register() {
  const hookId = Hooks.on("updateCombat", onUpdateCombat);
  game[SW_HOOK_FLAG] = { hookId };
  console.log("Second Wind macro loaded.");
}

// ─── Combat Hook ─────────────────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  if (!("turn" in changed || "round" in changed)) return;
  if (!combat?.started) return;

  const combatant = combat.combatant;
  if (!combatant?.isOwner || combatant.isDefeated) return;

  const actor = combatant.actor;
  if (!actor) return;

  // Per-turn dedup
  const turnKey = `${combat.id}-${combat.round}-${combat.turn}`;
  if (game[SW_LAST_TURN_KEY] === turnKey) return;
  game[SW_LAST_TURN_KEY] = turnKey;

  // Find Second Wind feature
  const feat = actor.items.find(
    i => i.name === SW_FEAT_NAME && i.type === "feat"
  );
  if (!feat) return;

  const remaining = getUsesRemaining(feat);
  if (remaining <= 0) return;

  // Only remind if below 50% HP
  const hp = actor.system?.attributes?.hp;
  if (!hp || hp.max === 0) return;
  const currentHp = hp.value + (hp.temp ?? 0);
  if (currentHp >= hp.max * 0.5) return;

  // Determine Fighter level for healing formula
  const fighterClass = actor.items.find(
    i => i.type === "class" && (i.system?.identifier === "fighter" || i.name?.toLowerCase() === "fighter")
  );
  const level = fighterClass?.system?.levels ?? fighterClass?.system?.level ?? "?";
  const max = feat.system?.uses?.max ?? 0;

  const content =
    `<div style="border:2px solid #cc4444; border-radius:8px; padding:8px; background:linear-gradient(135deg, #3a1010 0%, #5c2020 100%); text-align:center;">` +
    `<h2 style="margin:0 0 4px; font-size:15px; font-weight:bold; color:#ff6666;">` +
    `💨 Second Wind Available</h2>` +
    `<p style="margin:4px 0; color:#ffaaaa;">` +
    `<strong>${actor.name}</strong> is at ${currentHp}/${hp.max} HP (${Math.round(currentHp / hp.max * 100)}%)</p>` +
    `<p style="margin:4px 0; color:#ff8888; font-size:13px;">` +
    `Bonus Action to heal <strong>1d10 + ${level}</strong> HP</p>` +
    `<p style="margin:4px 0; color:#dd8888; font-size:12px;">` +
    `${remaining}/${max} use${max !== 1 ? "s" : ""} remaining</p>` +
    `</div>`;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    whisper: [game.user.id],
  });
}

// ─── Uses Helper ─────────────────────────────────────────────────────────────

function getUsesRemaining(item) {
  const uses = item.system?.uses;
  if (!uses || uses.max == null || uses.max === 0) return 0;
  return uses.max - (uses.spent ?? 0);
}
// END: SECOND WIND REMINDER MACRO
