/**
 * CONCENTRATION CHECK REMINDER MACRO
 *
 * When a concentrating character takes damage, posts a whispered chat
 * reminder with the required CON save DC.
 *
 * RAW (2024 PHB): "Whenever you take damage while you are concentrating,
 * you must make a Constitution saving throw to maintain your Concentration.
 * The DC equals 10 or half the damage you take (round down), whichever
 * number is higher."
 *
 * Hooks: dnd5e.damageActor
 */

const MACRO_ICON = "fa-head-side-brain";
const CONC_HOOK_FLAG = "concentrationCheckHookRegistered";

teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[CONC_HOOK_FLAG]) return;
  const prev = game[CONC_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.damageActor", prev.hookId);
  delete game[CONC_HOOK_FLAG];
  console.log("Concentration Check macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.damageActor", onDamageActor);
  game[CONC_HOOK_FLAG] = { hookId };
  console.log("Concentration Check macro loaded.");
}

// ─── Damage Hook ─────────────────────────────────────────────────────────────

function onDamageActor(actor, changes, update, userId) {
  if (!actor?.isOwner) return;

  // Must be concentrating
  if (!isConcentrating(actor)) return;

  // Extract damage taken from changes
  const damageTaken = changes.hp ?? 0;
  if (damageTaken <= 0) return;

  const dc = Math.max(10, Math.floor(damageTaken / 2));

  postConcentrationReminder(actor, damageTaken, dc);
}

// ─── Concentration Detection ─────────────────────────────────────────────────

function isConcentrating(actor) {
  // Check the statuses set (preferred in dnd5e v5+)
  if (actor.statuses?.has("concentrating")) return true;

  // Fallback: check effects
  return actor.effects?.some(
    e => e.name === "Concentrating" && !e.disabled
  ) ?? false;
}

// ─── Chat Reminder ───────────────────────────────────────────────────────────

function postConcentrationReminder(actor, damage, dc) {
  const html = `
    <div style="
      background: linear-gradient(135deg, #1a0533 0%, #2d1b69 50%, #1a0533 100%);
      border: 2px solid #7b68ee;
      border-radius: 8px;
      padding: 10px 14px;
      color: #e8e0f0;
      font-size: 13px;
      margin: 4px 0;
      text-align: center;
    ">
      <div style="font-size: 18px; margin-bottom: 4px;">🔮 Concentration Check Required</div>
      <div style="font-size: 12px; color: #c4b5e0;">
        <strong>${actor.name}</strong> took <strong>${damage}</strong> damage while concentrating
      </div>
      <div style="
        margin-top: 6px;
        font-size: 15px;
        color: #ffd700;
        font-weight: bold;
      ">
        CON Save DC ${dc}
      </div>
      <div style="font-size: 11px; color: #9988bb; margin-top: 4px;">
        DC = max(10, ⌊${damage} ÷ 2⌋)
      </div>
    </div>`;

  ChatMessage.create({
    content: html,
    whisper: [game.user.id],
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

// END: CONCENTRATION CHECK REMINDER MACRO
