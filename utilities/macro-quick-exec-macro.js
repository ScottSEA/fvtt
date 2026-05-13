/**
 * MACRO QUICK-EXECUTE MACRO
 *
 * Shift+click a macro in the Macros Directory to execute it immediately
 * instead of opening the edit sheet.
 *
 * Hooks: renderMacroDirectory (click delegation)
 */

const MACRO_ICON = "fa-play";
const MQE_HOOK_FLAG = "_macroQuickExecRegistered";

teardown();
register();

function teardown() {
  if (!game[MQE_HOOK_FLAG]) return;
  const prev = game[MQE_HOOK_FLAG];
  if (prev.hookId != null) Hooks.off("renderMacroDirectory", prev.hookId);
  if (prev.clickHandler) document.removeEventListener("click", prev.clickHandler, true);
  console.log("Macro Quick-Execute torn down.");
}

function register() {
  const clickHandler = (event) => {
    if (!event.shiftKey) return;
    const entry = event.target.closest(".macro.document, .directory-item");
    if (!entry) return;
    const macroId = entry.dataset?.documentId ?? entry.dataset?.entityId;
    if (!macroId) return;
    const macro = game.macros.get(macroId);
    if (!macro) return;

    event.preventDefault();
    event.stopPropagation();
    macro.execute();
    ui.notifications.info(`▶ Executed: ${macro.name}`);
  };

  document.addEventListener("click", clickHandler, true);
  game[MQE_HOOK_FLAG] = { clickHandler };
  console.log("Macro Quick-Execute loaded. Shift+click macros in directory to run.");
}
// END: MACRO QUICK-EXECUTE MACRO
