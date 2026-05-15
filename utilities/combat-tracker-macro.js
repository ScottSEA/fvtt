/**
 * COMBAT TRACKER ENHANCEMENT MACRO
 *
 * On every turn change, posts a whispered chat summary showing the current
 * round, whose turn it is, and the next 3 combatants with HP status and
 * active conditions.
 *
 * Hooks: updateCombat
 */

const MACRO_ICON = "fa-list-ol";
const HOOK_FLAG = "combatTrackerEnhancementHook";
const DEDUP_KEY = "combatTrackerLastTurn";

teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[HOOK_FLAG]) return;
  const prev = game[HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("updateCombat", prev.hookId);
  delete game[HOOK_FLAG];
  delete game[DEDUP_KEY];
  console.log("Combat Tracker Enhancement macro torn down.");
}

function register() {
  const hookId = Hooks.on("updateCombat", onUpdateCombat);
  game[HOOK_FLAG] = { hookId };
  console.log("Combat Tracker Enhancement macro loaded.");
}

// ─── Combat Update Handler ───────────────────────────────────────────────────

function onUpdateCombat(combat, changed) {
  if (!("turn" in changed || "round" in changed)) return;

  // Only fire for GM or current combatant's owner
  const current = combat.combatant;
  if (!current) return;
  const isGM = game.user.isGM;
  const isOwner = current.actor?.isOwner ?? false;
  if (!isGM && !isOwner) return;

  // Per-turn dedup
  const dedupToken = `${combat.id}-${combat.round}-${combat.turn}`;
  if (game[DEDUP_KEY] === dedupToken) return;
  game[DEDUP_KEY] = dedupToken;

  // Build summary
  const round = combat.round;
  const turnIndex = combat.turn;
  const turns = combat.turns;

  const currentName = current.name || "Unknown";
  const currentStatus = getHpStatus(current.actor);
  const currentConditions = getConditions(current.actor);

  // Next 3 combatants
  const upcoming = [];
  for (let i = 1; i <= 3; i++) {
    const idx = (turnIndex + i) % turns.length;
    const c = turns[idx];
    if (!c) continue;
    upcoming.push({
      name: c.name || "Unknown",
      hp: getHpStatus(c.actor),
      conditions: getConditions(c.actor),
    });
  }

  const upcomingHtml = upcoming
    .map(
      (u) =>
        `<li style="margin:3px 0;"><strong>${u.name}</strong> — ${u.hp}${u.conditions ? ` <span style="color:#b08d57;">[${u.conditions}]</span>` : ""}</li>`
    )
    .join("");

  const content = `
<div style="border:1px solid #4b4a44;border-radius:6px;padding:8px 10px;background:#1a1a1a;color:#ddd;font-size:13px;">
  <div style="font-size:15px;font-weight:bold;margin-bottom:6px;color:#f0c674;">
    <i class="fas fa-list-ol" style="margin-right:4px;"></i> Round ${round}
  </div>
  <div style="margin-bottom:6px;">
    <strong style="color:#8abeb7;">Now:</strong> ${currentName} — ${currentStatus}${currentConditions ? ` <span style="color:#b08d57;">[${currentConditions}]</span>` : ""}
  </div>
  <div style="font-weight:bold;color:#aaa;margin-bottom:3px;">Up Next:</div>
  <ul style="list-style:none;padding:0;margin:0;">${upcomingHtml}</ul>
</div>`;

  ChatMessage.create({
    content,
    whisper: [game.user.id],
    speaker: { alias: "Combat Tracker" },
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHpStatus(actor) {
  if (!actor) return "❓ unknown";
  const hp = actor.system?.attributes?.hp;
  if (!hp || !hp.max) return "❓ unknown";
  const ratio = hp.value / hp.max;
  if (ratio > 0.5) return `💚 healthy`;
  if (ratio >= 0.25) return `🟡 bloodied`;
  return `🔴 critical`;
}

function getConditions(actor) {
  if (!actor) return "";
  const statuses = actor.statuses;
  if (!statuses || statuses.size === 0) return "";
  return [...statuses].join(", ");
}
// END: COMBAT TRACKER ENHANCEMENT MACRO
