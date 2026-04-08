/**
 * PRIMAL KNOWLEDGE MACRO
 *
 * When making an ability check for Acrobatics, Intimidation, Perception,
 * Stealth, or Survival while Raging with the Primal Knowledge feature,
 * automatically switches the Abilities dropdown to Strength and injects
 * a banner into the roll dialog.
 *
 * RAW: "While your Rage is active, whenever you make an ability check
 * using one of the following skills, you can make it as a Strength check
 * even if it normally uses a different ability: Acrobatics, Intimidation,
 * Perception, Stealth, or Survival."
 */

let PK_DEBUG = false;
const PK_HOOK_FLAG = "primalKnowledgeHookRegistered";
const PK_PENDING_KEY = "_primalKnowledgePending";

const PRIMAL_KNOWLEDGE_NAME = "Primal Knowledge";

// dnd5e skill identifiers that Primal Knowledge applies to
const PRIMAL_SKILLS = new Set(["acr", "itm", "prc", "ste", "sur"]);
const PRIMAL_SKILL_NAMES = {
  acr: "Acrobatics", itm: "Intimidation",
  prc: "Perception", ste: "Stealth", sur: "Survival",
};

const HOOK_PRE_ROLL = "dnd5e.preRollSkill";
const HOOK_RENDER_DIALOG = "renderRollConfigurationDialog";

// --- Entry point: tear down previous registration, then re-register ---
teardown();
register();

// ─── Lifecycle ────────────────────────────────────────────────────────────────

function teardown() {
  if (!game[PK_HOOK_FLAG]) return;
  const prev = game[PK_HOOK_FLAG];
  if (prev.preRollHookId != null) Hooks.off(HOOK_PRE_ROLL, prev.preRollHookId);
  if (prev.renderHookId != null) Hooks.off(HOOK_RENDER_DIALOG, prev.renderHookId);
  console.log("Primal Knowledge macro torn down.");
}

function register() {
  const preRollHookId = Hooks.on(HOOK_PRE_ROLL, onPreRollSkill);
  const renderHookId = Hooks.on(HOOK_RENDER_DIALOG, onRenderDialog);
  game[PK_HOOK_FLAG] = { preRollHookId, renderHookId };
  console.log("Primal Knowledge macro loaded.");
}

// ─── Pre-Roll Hook ───────────────────────────────────────────────────────────

function onPreRollSkill(config, dialog, message) {
  if (PK_DEBUG) console.log("Primal Knowledge | preRollSkill fired:", {
    skill: config.skill, ability: config.ability, subject: config.subject?.name, config
  });

  const actor = config.subject;
  if (!actor?.isOwner) return;

  // Identify which skill is being rolled
  const skillId = config.skill;
  if (!PRIMAL_SKILLS.has(skillId)) return;

  // Already Strength? Nothing to do.
  if (config.ability === "str") return;

  // Must be raging
  if (!isActorRaging(actor)) return;

  // Must have Primal Knowledge feature
  if (!hasPrimalKnowledge(actor)) return;

  const skillName = PRIMAL_SKILL_NAMES[skillId] ?? skillId;
  console.log(`Primal Knowledge | Switching ${skillName} from ${config.ability} → str`);

  // Swap the ability to Strength
  config.ability = "str";

  // Flag for the dialog banner
  game[PK_PENDING_KEY] = skillName;
}

// ─── Dialog Banner ───────────────────────────────────────────────────────────

const BANNER_STYLE =
  `color:white; padding:6px 10px; border-radius:4px; ` +
  `margin:0 0 8px; text-align:center; font-size:12px; background:#5c1a1a;`;

function onRenderDialog(app, html) {
  const skillName = game[PK_PENDING_KEY];
  if (!skillName) return;
  delete game[PK_PENDING_KEY];

  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  const buttons = el.querySelector(".dialog-buttons");
  if (!buttons) return;

  const banner = document.createElement("div");
  banner.style.cssText = BANNER_STYLE;
  banner.innerHTML =
    `<h3 style="margin:0 0 4px;">🔥 Primal Knowledge</h3>` +
    `<p style="margin:0;"><strong>${skillName}</strong> switched to ` +
    `<strong>Strength</strong> (Raging)</p>`;
  buttons.insertAdjacentElement("beforebegin", banner);

  // Also try to update the Abilities dropdown to show Strength
  const abilitySelect = el.querySelector("select[name='ability']")
    ?? el.querySelector("[name='ability']");
  if (abilitySelect) {
    abilitySelect.value = "str";
    abilitySelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

// ─── Rage Detection ──────────────────────────────────────────────────────────

function isActorRaging(actor) {
  if (!actor) return false;
  if (actor.statuses?.has("raging")) return true;
  const effects = actor.appliedEffects ?? actor.effects;
  return effects?.some(e => e.name === "Rage" && !e.disabled) ?? false;
}

// ─── Feature Detection ───────────────────────────────────────────────────────

function hasPrimalKnowledge(actor) {
  return actor.items?.some(
    i => i.name === PRIMAL_KNOWLEDGE_NAME && i.type === "feat"
  ) ?? false;
}
// END: PRIMAL KNOWLEDGE MACRO
