/**
 * TRAVEL ALONG THE TREE MACRO
 *
 * World Tree Barbarian 14 feature.
 * While raging, use bonus action to teleport yourself and up to 6 willing
 * creatures within 10 ft to an unoccupied space you can see within 60 ft.
 *
 * NOTE: This is a FUTURE feature — Tusk is currently level 13.
 *       Scaffold is ready; activate when level 14 is reached.
 *
 * Trigger: dnd5e.postUseActivity (detect "Travel Along the Tree" usage)
 * Conditions: Owner, raging, has feature
 */

const TATT_HOOK_FLAG = "travelAlongTreeHookRegistered";
const TATT_FEATURE_NAME = "Travel Along the Tree";
const TATT_GATHER_RANGE_FT = 10;
const TATT_TELEPORT_RANGE_FT = 60;
const TATT_MAX_COMPANIONS = 6;
const MACRO_ICON = "fa-portal-enter";
let TATT_DEBUG = false;

// --- Entry point ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[TATT_HOOK_FLAG]) return;
  const prev = game[TATT_HOOK_FLAG];
  if (prev.activityHookId != null) Hooks.off("dnd5e.postUseActivity", prev.activityHookId);
  delete game[TATT_HOOK_FLAG];
  console.log("Travel Along the Tree macro torn down.");
}

function register() {
  const activityHookId = Hooks.on("dnd5e.postUseActivity", onPostUseActivity);
  game[TATT_HOOK_FLAG] = { activityHookId };
  console.log("Travel Along the Tree macro loaded.");
}

// ─── Activity Hook ───────────────────────────────────────────────────────────

function onPostUseActivity(activity, usageConfig, results) {
  const item = activity?.item;
  const actor = item?.actor ?? item?.parent;

  if (TATT_DEBUG) console.log("TATT | postUseActivity fired:", item?.name, activity?.name);

  if (
    !isFeatureActivity(item, activity)
    || !isOwner(actor)
    || !meetsLevelRequirement(actor, 14)
    || !isActorRaging(actor)
    || !hasFeature(actor, TATT_FEATURE_NAME)
  ) return;

  if (TATT_DEBUG) console.log("TATT | All guards passed, showing companion picker.");
  showCompanionPicker(actor);
}

// ─── Guard Functions ─────────────────────────────────────────────────────────

function isFeatureActivity(item, activity) {
  // Match by item name or activity name
  const match = item?.name === TATT_FEATURE_NAME || activity?.name === TATT_FEATURE_NAME;
  if (!match && TATT_DEBUG) console.log("TATT | Activity/item name mismatch, skipping.");
  return match;
}

function isOwner(actor) {
  const owned = actor?.isOwner ?? false;
  if (!owned && TATT_DEBUG) console.log("TATT | Not owner, skipping.");
  return owned;
}

// ─── Actor Checks ────────────────────────────────────────────────────────────

function isActorRaging(actor) {
  if (!actor) return false;
  if (actor.statuses?.has("raging")) return true;
  const effects = actor.appliedEffects ?? actor.effects;
  return effects?.some(e => e.name === "Rage" && !e.disabled) ?? false;
}

function hasFeature(actor, name) {
  return actor.items?.some(i => i.name === name && i.type === "feat") ?? false;
}

function meetsLevelRequirement(actor, requiredLevel) {
  const barbLevel = actor.classes?.barbarian?.system?.levels ?? 0;
  if (barbLevel < requiredLevel) {
    if (TATT_DEBUG) console.log(`TATT | Barbarian level ${barbLevel} < ${requiredLevel}, skipping.`);
    return false;
  }
  return true;
}

// ─── Distance Measurement ────────────────────────────────────────────────────

function measureTokenDistance(tokenA, tokenB) {
  if (!tokenA || !tokenB) return null;
  try {
    return canvas.grid.measurePath([tokenA.center, tokenB.center]).distance;
  } catch {
    try {
      return canvas.grid.measureDistance(tokenA.center, tokenB.center);
    } catch {
      console.error("TATT | Could not measure distance.");
      return null;
    }
  }
}

// ─── Companion Picker ────────────────────────────────────────────────────────

function showCompanionPicker(actor) {
  const ownToken = findActorToken(actor);
  if (!ownToken) {
    ui.notifications.warn("Travel Along the Tree: No token found on canvas for this actor.");
    return;
  }

  const nearbyFriendlies = findFriendlyTokensInRange(ownToken);

  if (nearbyFriendlies.length === 0) {
    // No companions nearby — just teleport self
    postTeleportMessage(actor, []);
    return;
  }

  const checkboxes = nearbyFriendlies
    .map((t, i) => `<div><label><input type="checkbox" name="companion-${i}" value="${t.id}" /> ${t.name} (${Math.round(measureTokenDistance(ownToken.object ?? ownToken, t.object ?? t) ?? 0)} ft)</label></div>`)
    .join("");

  new Dialog({
    title: "Travel Along the Tree — Select Companions",
    content:
      `<div style="margin-bottom:8px;">` +
      `<p style="font-style:italic; color:#8fdf6f;">Select up to ${TATT_MAX_COMPANIONS} willing creatures within ${TATT_GATHER_RANGE_FT} ft to teleport with you (within ${TATT_TELEPORT_RANGE_FT} ft).</p>` +
      `${checkboxes}` +
      `</div>`,
    buttons: {
      teleport: {
        icon: '<i class="fas fa-tree"></i>',
        label: "Teleport",
        callback: (html) => {
          const selected = [];
          html.find("input:checked").each(function () {
            selected.push(this.value);
          });
          if (selected.length > TATT_MAX_COMPANIONS) {
            ui.notifications.warn(`Travel Along the Tree: You can bring at most ${TATT_MAX_COMPANIONS} creatures.`);
            return;
          }
          const companionNames = selected.map(id => {
            const tok = canvas.tokens.get(id);
            return tok?.name ?? "Unknown";
          });
          postTeleportMessage(actor, companionNames);
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel",
      },
    },
    default: "teleport",
  }).render(true);
}

// ─── Token Lookup ────────────────────────────────────────────────────────────

function findActorToken(actor) {
  if (!canvas?.tokens?.placeables) return null;
  return canvas.tokens.placeables.find(t => t.actor?.id === actor.id) ?? null;
}

function findFriendlyTokensInRange(ownToken) {
  if (!canvas?.tokens?.placeables) return [];
  const results = [];
  for (const t of canvas.tokens.placeables) {
    if (t.id === ownToken.id) continue;
    if (t.document?.disposition !== CONST.TOKEN_DISPOSITIONS.FRIENDLY) continue;
    const dist = measureTokenDistance(ownToken.object ?? ownToken, t.object ?? t);
    if (dist != null && dist <= TATT_GATHER_RANGE_FT) {
      results.push(t);
    }
  }
  if (TATT_DEBUG) console.log(`TATT | Found ${results.length} friendly tokens within ${TATT_GATHER_RANGE_FT} ft.`);
  return results;
}

// ─── Chat Message ────────────────────────────────────────────────────────────

function postTeleportMessage(actor, companionNames) {
  const companionText = companionNames.length > 0
    ? `<p style="color:#d4ecc8;">Teleporting with: <strong style="color:#b8f0a0;">${companionNames.join(", ")}</strong></p>`
    : `<p style="color:#d4ecc8;">Teleporting alone.</p>`;

  const content =
    `<div style="text-align:center; border:2px solid #2d5a1d; border-radius:8px; padding:8px; background:linear-gradient(135deg, #1a3a0a 0%, #2d5a1d 100%);">` +
    `<h2 style="margin:0 0 4px; font-size:15px; font-weight:bold; color:#8fdf6f;">` +
    `🌳 Travel Along the Tree 🌳</h2>` +
    `<p style="margin:4px 0; color:#d4ecc8;">Bonus action teleport up to <strong>${TATT_TELEPORT_RANGE_FT} ft</strong>.</p>` +
    companionText +
    // TODO: Implement actual token movement — use canvas.tokens.get(id).document.update({x, y})
    // with a targeting reticle or click-to-place workflow for destination selection.
    // This is non-trivial because of collision detection and occupied-space validation.
    `<p style="margin:4px 0; font-size:11px; color:#a0c890; font-style:italic;">` +
    `(Move tokens manually to destination.)</p>` +
    `</div>`;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
  });
}
// END: TRAVEL ALONG THE TREE MACRO
