/**
 * RELENTLESS RAGE + RELENTLESS ENDURANCE MACRO
 *
 * When the character drops to 0 HP while raging, offers a two-step recovery:
 *
 * 1. Relentless Endurance (Orc racial): Drop to 1 HP instead of 0.
 *    No save required. 1/long rest. Only offered if uses remain.
 *
 * 2. Relentless Rage (Barbarian 11): CON save DC 10 (+5 per prior attempt).
 *    On success, HP = 2× Barbarian level (26 at level 13). DC resets on
 *    short or long rest.
 *
 * Hooks:
 *   - dnd5e.damageActor    — detect lethal damage while raging
 *   - dnd5e.restCompleted  — reset Relentless Rage DC on short/long rest
 *
 * Set RELENTLESS_DEBUG = true in the console to log hook traffic.
 */

let RELENTLESS_DEBUG = false;
const RELENTLESS_HOOK_FLAG = "relentlessRageHookRegistered";
const RELENTLESS_STATE_KEY = "_relentlessRageState";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[RELENTLESS_HOOK_FLAG]) return;
  const prev = game[RELENTLESS_HOOK_FLAG];
  if (prev.damageHookId != null) Hooks.off("dnd5e.damageActor", prev.damageHookId);
  if (prev.restHookId != null) Hooks.off("dnd5e.restCompleted", prev.restHookId);
  console.log("Relentless Rage macro torn down.");
}

function register() {
  // Initialize DC tracking state if not present
  if (!game[RELENTLESS_STATE_KEY]) {
    game[RELENTLESS_STATE_KEY] = { dc: 10 };
  }

  const damageHookId = Hooks.on("dnd5e.damageActor", onDamageActor);
  const restHookId = Hooks.on("dnd5e.restCompleted", onRestCompleted);
  game[RELENTLESS_HOOK_FLAG] = { damageHookId, restHookId };
  console.log("Relentless Rage macro loaded.");
}

// ─── Damage Hook ─────────────────────────────────────────────────────────────

function onDamageActor(actor, changes, update, userId) {
  if (RELENTLESS_DEBUG) console.log("Relentless | dnd5e.damageActor fired:",
    { name: actor.name, changes, update, userId });

  // Only process for actors this client owns
  if (!actor.isOwner) return;

  // Must have actually lost HP (not just temp HP)
  if ((changes.hp ?? 0) <= 0) return;

  // Check if HP dropped to 0
  const currentHP = actor.system.attributes?.hp?.value ?? 0;
  if (currentHP > 0) return;

  // Must be raging
  if (!isActorRaging(actor)) {
    if (RELENTLESS_DEBUG) console.log("Relentless | Not raging, skipping.");
    return;
  }

  // Note: Outright death (excess damage >= max HP) cannot be reliably detected
  // from this hook's clamped damage values. The DM should adjudicate outright
  // death before the player attempts the Relentless Rage save.

  // Guard against re-entrancy (dialog already showing)
  const state = game[RELENTLESS_STATE_KEY];
  if (state?._processing) return;
  state._processing = true;

  // Fire the async dialog chain (can't await in a hook callback)
  handleLethalDamage(actor)
    .catch(err => console.error("Relentless Rage error:", err))
    .finally(() => {
      state._processing = false;
    });
}

// ─── Main Logic: Two-Step Recovery ───────────────────────────────────────────

async function handleLethalDamage(actor) {
  const name = actor.name;

  // ── Step 1: Relentless Endurance ──────────────────────────────────────────

  const enduranceItem = actor.items?.find(
    i => i.name === "Relentless Endurance"
  );

  if (enduranceItem) {
    const spent = enduranceItem.system?.uses?.spent ?? 0;
    const max = enduranceItem.system?.uses?.max ?? 1;
    const available = max - spent;

    if (available > 0) {
      const useEndurance = await Dialog.confirm({
        title: "🛡️ Relentless Endurance",
        content:
          `<p><strong>${name}</strong> has dropped to 0 HP while raging!</p>` +
          `<hr>` +
          `<p>Use <strong>Relentless Endurance</strong> to drop to ` +
          `<strong>1 HP</strong> instead of 0?</p>` +
          `<p style="font-size:12px; color:#888;">(Orc racial — no save needed — ` +
          `${available}/${max} use${max > 1 ? "s" : ""} remaining, ` +
          `recharges on long rest)</p>`,
        yes: () => true,
        no: () => false,
        defaultYes: true,
      });

      if (useEndurance) {
        // Spend the use
        await enduranceItem.update({ "system.uses.spent": spent + 1 });
        // Set HP to 1
        await actor.update({ "system.attributes.hp.value": 1 });

        await ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor }),
          content:
            `<div style="text-align:center;">` +
            `<h3 style="margin:0 0 4px;">🛡️ Relentless Endurance</h3>` +
            `<p style="margin:4px 0;"><strong>${name}</strong> refuses to fall!</p>` +
            `<p style="margin:4px 0;">Through sheer orcish tenacity, ` +
            `${name} drops to <strong>1 HP</strong> instead of 0.</p>` +
            `<p style="margin:4px 0; font-size:12px; color:#888;">` +
            `(Relentless Endurance expended)</p>` +
            `</div>`,
        });

        ui.notifications.info(`🛡️ ${name} uses Relentless Endurance! HP set to 1.`);
        return; // Recovery complete — Relentless Rage not needed
      }
    }
  }

  // ── Step 2: Relentless Rage ───────────────────────────────────────────────

  const barbLevel = getBarbarianLevel(actor);
  if (barbLevel < 11) {
    if (RELENTLESS_DEBUG) console.log("Relentless | Barbarian level", barbLevel,
      "< 11, no Relentless Rage available.");
    return;
  }

  const state = game[RELENTLESS_STATE_KEY];
  const dc = state.dc;
  const hpOnSuccess = 2 * barbLevel;

  const attemptSave = await Dialog.confirm({
    title: "💀 Relentless Rage",
    content:
      `<p><strong>${name}</strong> has dropped to 0 HP while raging!</p>` +
      `<hr>` +
      `<p>Attempt a <strong>Relentless Rage</strong> CON saving throw?</p>` +
      `<div style="background:#5c1a1a; color:white; padding:8px; ` +
      `border-radius:4px; margin:8px 0; text-align:center; font-size:14px;">` +
      `<strong>DC ${dc}</strong> Constitution Saving Throw</div>` +
      `<p style="font-size:12px; color:#888;">On success: HP → ` +
      `<strong>${hpOnSuccess}</strong> (2 × Barbarian level ${barbLevel})<br>` +
      `On failure: ${name} falls unconscious at 0 HP.</p>`,
    yes: () => true,
    no: () => false,
    defaultYes: true,
  });

  if (!attemptSave) return;

  // Compute CON save bonus
  const saveBonus = getConSaveBonus(actor);
  const bonusStr = actor.system.abilities?.con?.bonuses?.save ?? "";
  let formula = `1d20 + ${saveBonus}`;
  if (bonusStr) formula += ` + ${bonusStr}`;

  const roll = new Roll(formula);
  await roll.evaluate();

  // Dice So Nice triggers automatically via ChatMessage.create with rolls
  const success = roll.total >= dc;

  // Increase DC for next attempt regardless of outcome
  state.dc += 5;

  if (success) {
    await actor.update({ "system.attributes.hp.value": hpOnSuccess });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content:
        `<div style="text-align:center;">` +
        `<h3 style="margin:0 0 4px;">💀 Relentless Rage — Success!</h3>` +
        `<p style="margin:4px 0;"><strong>${name}</strong> roars with primal fury, ` +
        `refusing to go down!</p>` +
        `<p style="margin:4px 0;">CON Save: <strong>${roll.total}</strong> vs ` +
        `DC <strong>${dc}</strong> ✅</p>` +
        `<p style="margin:4px 0;">HP set to <strong>${hpOnSuccess}</strong></p>` +
        `<p style="margin:4px 0; font-size:12px; color:#888;">` +
        `(Next Relentless Rage DC: ${state.dc})</p>` +
        `</div>`,
      rolls: [roll],
    });

    ui.notifications.info(
      `💀 ${name} passes Relentless Rage! HP → ${hpOnSuccess}.`
    );
  } else {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content:
        `<div style="text-align:center;">` +
        `<h3 style="margin:0 0 4px;">💀 Relentless Rage — Failed</h3>` +
        `<p style="margin:4px 0;"><strong>${name}</strong> staggers… ` +
        `the rage cannot sustain them.</p>` +
        `<p style="margin:4px 0;">CON Save: <strong>${roll.total}</strong> vs ` +
        `DC <strong>${dc}</strong> ❌</p>` +
        `<p style="margin:4px 0; font-size:12px; color:#888;">` +
        `${name} falls unconscious at 0 HP. ` +
        `(Next Relentless Rage DC: ${state.dc})</p>` +
        `</div>`,
      rolls: [roll],
    });

    ui.notifications.warn(`💀 ${name} fails Relentless Rage. Still at 0 HP.`);
  }
}

// ─── Rest Hook: Reset DC ─────────────────────────────────────────────────────

function onRestCompleted(actor, result, config) {
  if (!actor.isOwner) return;

  const state = game[RELENTLESS_STATE_KEY];
  if (!state || state.dc <= 10) return;

  state.dc = 10;
  if (RELENTLESS_DEBUG) console.log("Relentless | DC reset to 10 after rest.");
  ui.notifications.info("💀 Relentless Rage DC reset to 10.");
}

// ─── Rage Detection ──────────────────────────────────────────────────────────

function isActorRaging(actor) {
  if (!actor) return false;
  if (actor.statuses?.has("raging")) return true;
  const effects = actor.appliedEffects ?? actor.effects;
  return effects?.some(e => e.name === "Rage" && !e.disabled) ?? false;
}

// ─── Barbarian Level ─────────────────────────────────────────────────────────

function getBarbarianLevel(actor) {
  const barbarianClass = actor.classes?.barbarian;
  if (barbarianClass) return barbarianClass.system?.levels ?? 0;

  // Fallback: search items for a class named "Barbarian"
  const cls = actor.items?.find(
    i => i.type === "class" && i.name === "Barbarian"
  );
  return cls?.system?.levels ?? 0;
}

// ─── CON Save Bonus ──────────────────────────────────────────────────────────

function getConSaveBonus(actor) {
  const conScore = actor.system.abilities?.con?.value ?? 10;
  const conMod = Math.floor((conScore - 10) / 2);
  const isProficient = actor.system.abilities?.con?.proficient ?? 0;
  const profBonus = actor.system.attributes?.prof ?? 0;
  return conMod + (isProficient ? profBonus : 0);
}
