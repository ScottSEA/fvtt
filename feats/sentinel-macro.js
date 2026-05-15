/**
 * SENTINEL FEAT MACRO
 *
 * Detects melee attack rolls from NON-owned actors (enemies) that target
 * someone OTHER than the Sentinel character. Injects a reaction prompt
 * banner so the Sentinel player can make an opportunity attack.
 *
 * RAW (2024 Sentinel): "Whenever a creature you can see hits a target
 * other than you that is within 5 feet of you with an attack, you can
 * use your Reaction to make a melee attack against the attacking creature."
 *
 * Hooks: dnd5e.renderChatMessage
 */

const MACRO_ICON = "fa-shield";
const SENTINEL_HOOK_FLAG = "sentinelFeatHookRegistered";
const SENTINEL_FEAT_NAME = "Sentinel";

teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[SENTINEL_HOOK_FLAG]) return;
  const prev = game[SENTINEL_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("dnd5e.renderChatMessage", prev.hookId);
  delete game[SENTINEL_HOOK_FLAG];
  console.log("Sentinel macro torn down.");
}

function register() {
  const hookId = Hooks.on("dnd5e.renderChatMessage", onRenderChatMessage);
  game[SENTINEL_HOOK_FLAG] = { hookId };
  console.log("Sentinel macro loaded.");
}

// ─── Chat Message Hook ──────────────────────────────────────────────────────

function onRenderChatMessage(message, html) {
  try {
    // Must be an attack roll
    const rollType = message.flags?.dnd5e?.roll?.type;
    if (rollType !== "attack") return;

    // Must be a melee attack
    if (!isMeleeAttack(message)) return;

    // Attacker must NOT be owned (it's an enemy)
    const attackerId = message.speaker?.actor;
    if (!attackerId) return;
    const attacker = game.actors.get(attackerId);
    if (!attacker || attacker.isOwner) return;

    // Check targets — must be targeting someone other than a Sentinel
    const targets = message.flags?.dnd5e?.targets ?? [];
    const sentinels = findSentinelCharacters();
    if (sentinels.length === 0) return;

    // Check if any target is NOT a Sentinel character
    const sentinelIds = new Set(sentinels.map(s => s.id));
    const targetsNonSentinel = targets.length === 0 ||
      targets.some(t => {
        const resolved = fromUuidSync(t.uuid);
        const targetActor = resolved?.actor ?? resolved;
        return targetActor && !sentinelIds.has(targetActor.id);
      });

    if (!targetsNonSentinel) return;

    // Dedup
    const el = html instanceof HTMLElement ? html : html[0] ?? html;
    if (el.querySelector("[data-action='sentinel-prompt']")) return;

    const sentinelList = sentinels
      .map(s => `<strong>${s.name}</strong>`)
      .join(", ");

    const banner = `
      <div data-action="sentinel-prompt" style="
        background: linear-gradient(135deg, #1a3322 0%, #2d5a3e 50%, #1a3322 100%);
        border: 2px solid #4caf50;
        border-radius: 8px;
        padding: 10px 14px;
        color: #c8e6c9;
        font-size: 13px;
        margin: 6px 0 2px;
        text-align: center;
      ">
        <div style="font-size: 16px; margin-bottom: 4px;">⚔️ Sentinel</div>
        <div style="font-size: 12px; color: #a5d6a7;">
          Use Reaction to make an opportunity attack against this attacker
        </div>
        <div style="margin-top: 6px; font-size: 11px; color: #81c784;">
          ${sentinelList}
        </div>
      </div>`;

    el.querySelector(".message-content")?.insertAdjacentHTML("beforeend", banner);
  } catch (err) {
    console.error("Sentinel macro error:", err.message);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isMeleeAttack(message) {
  const item = message.flags?.dnd5e?.roll?.itemId;
  if (!item) return true; // conservative: treat unknown as possibly melee
  const actorId = message.speaker?.actor;
  if (!actorId) return true;
  const actor = game.actors.get(actorId);
  if (!actor) return true;
  const weapon = actor.items.get(item);
  if (!weapon) return true;
  const actionType = weapon.system?.actionType ??
    weapon.system?.activities?.contents?.[0]?.actionType;
  if (actionType === "rwak") return false; // ranged weapon attack
  return true;
}

function findSentinelCharacters() {
  return game.actors.filter(a =>
    a.isOwner &&
    a.type === "character" &&
    a.items.some(i => i.name === SENTINEL_FEAT_NAME && i.type === "feat")
  );
}
// END: SENTINEL FEAT MACRO
