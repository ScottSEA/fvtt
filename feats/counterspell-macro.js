/**
 * COUNTERSPELL REACTION PROMPT MACRO
 *
 * Detects when a NON-owned actor casts a spell and checks if any owned
 * character has Counterspell prepared with a 3rd+ level slot available.
 * Injects a reaction prompt banner into the spell chat message.
 *
 * RAW (2024 PHB, Counterspell): "You attempt to interrupt a creature in
 * the process of casting a spell. The creature must make a Constitution
 * saving throw. On a failed save, the spell fails and has no effect."
 *
 * Hooks: dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-ban";
const COUNTERSPELL_HOOK_FLAG = "counterspellHookRegistered";

teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[COUNTERSPELL_HOOK_FLAG]) return;
  const prev = game[COUNTERSPELL_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  delete game[COUNTERSPELL_HOOK_FLAG];
  console.log("Counterspell macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[COUNTERSPELL_HOOK_FLAG] = { hookId };
  console.log("Counterspell macro loaded.");
}

// ─── Chat Message Hook ──────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  try {
    // Detect spell usage via dnd5e flags
    const useType = message.flags?.dnd5e?.use?.type;
    if (useType !== "spell") return;

    // The caster must NOT be owned (it's an enemy spell)
    const casterId = message.speaker?.actor;
    if (!casterId) return;
    const caster = game.actors.get(casterId);
    if (!caster || caster.isOwner) return;

    // Find owned characters who have Counterspell + available 3rd+ level slots
    const reactors = findCounterspellReactors();
    if (reactors.length === 0) return;

    // Dedup: don't inject twice
    const el = html instanceof HTMLElement ? html : html[0] ?? html;
    if (el.querySelector("[data-action='counterspell-prompt']")) return;

    // Build reactor list
    const reactorList = reactors
      .map(r => `<strong>${r.name}</strong>`)
      .join(", ");

    const banner = `
      <div data-action="counterspell-prompt" style="
        background: linear-gradient(135deg, #0d1b3e 0%, #1a2d6b 50%, #0d1b3e 100%);
        border: 2px solid #4a7af7;
        border-radius: 8px;
        padding: 10px 14px;
        color: #d0daf0;
        font-size: 13px;
        margin: 6px 0 2px;
        text-align: center;
      ">
        <div style="font-size: 18px; margin-bottom: 4px;">🚫 Counterspell?</div>
        <div style="font-size: 12px; color: #a0b4e0;">
          Use Reaction to attempt to counter this spell
        </div>
        <div style="
          margin-top: 6px;
          font-size: 12px;
          color: #8899cc;
        ">
          Available: ${reactorList}
        </div>
      </div>`;

    el.querySelector(".message-content")?.insertAdjacentHTML("beforeend", banner);
  } catch (err) {
    console.error("Counterspell macro error:", err.message);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findCounterspellReactors() {
  return game.actors.filter(a => {
    if (!a.isOwner || a.type !== "character") return false;

    // Must have Counterspell spell
    const hasSpell = a.items.some(
      i => i.name === "Counterspell" && i.type === "spell"
    );
    if (!hasSpell) return false;

    // Must have a 3rd+ level spell slot remaining
    return hasAvailableSlot(a, 3);
  });
}

function hasAvailableSlot(actor, minLevel) {
  const spells = actor.system?.spells;
  if (!spells) return false;

  for (let lvl = minLevel; lvl <= 9; lvl++) {
    const slot = spells[`spell${lvl}`];
    if (slot && (slot.value ?? 0) > 0) return true;
  }

  // Check pact slots as well
  const pact = spells.pact;
  if (pact && (pact.level ?? 0) >= minLevel && (pact.value ?? 0) > 0) return true;

  return false;
}

// END: COUNTERSPELL REACTION PROMPT MACRO
