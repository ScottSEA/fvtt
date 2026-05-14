/**
 * MACRO CLEANUP MACRO
 *
 * Deletes all Foundry macro documents owned by you, except the loader itself.
 * Useful for resetting synced manual macros before a fresh load.
 */

const MACRO_ICON = "fa-trash-can";

const loader = game.macros.find(m => m.command?.includes("BOOTSTRAP STUB") && m.author?.id === game.user.id);
const mine = game.macros.filter(m => m.author?.id === game.user.id && m.id !== loader?.id);

if (mine.length === 0) {
  ui.notifications.info("🗑️ No macros to delete.");
  return;
}

const confirmed = await Dialog.confirm({
  title: "🗑️ Delete My Macros",
  content: `<p>Delete <strong>${mine.length}</strong> macro${mine.length !== 1 ? "s" : ""}?</p>
    <ul style="max-height:200px;overflow:auto;font-size:12px">${mine.map(m => `<li>${m.name}</li>`).join("")}</ul>
    <p><em>The loader macro will be kept.</em></p>`,
});

if (!confirmed) return;

for (const m of mine) await m.delete();
ui.notifications.info(`🗑️ Deleted ${mine.length} macro${mine.length !== 1 ? "s" : ""}.`);
// END: MACRO CLEANUP MACRO
