/**
 * CHAT CLEANUP MACRO
 *
 * Deletes your most recent chat messages, working backwards from the
 * newest until it hits a message that isn't yours. Useful for clearing
 * test spam without touching other players' messages.
 *
 * Run again to keep deleting further back.
 */

const MACRO_ICON = "fa-broom";

const myId = game.user.id;
const messages = game.messages.contents;
let deleted = 0;

for (let i = messages.length - 1; i >= 0; i--) {
  const m = messages[i];
  if (m.author?.id !== myId) break;
  await m.delete();
  deleted++;
}

if (deleted > 0) {
  ui.notifications.info(`🧹 Deleted ${deleted} message${deleted !== 1 ? "s" : ""}.`);
} else {
  ui.notifications.info("🧹 No messages to clean up.");
}
// END: CHAT CLEANUP MACRO
