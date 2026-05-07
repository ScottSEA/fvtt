/**
 * DASHBOARD DOUBLE-CLICK LAUNCHER
 *
 * Double-click empty canvas area to toggle the Token Dashboard macro.
 * Follows teardown/register lifecycle to prevent duplicate listeners.
 */

const FLAG = "_dashboardDblclick";
let DBLCLICK_DEBUG = false;

// ─── Teardown ────────────────────────────────────────────────────────────────
if (game[FLAG]) {
  const view = canvas?.app?.view;
  if (view && game[FLAG].handler) {
    view.removeEventListener("dblclick", game[FLAG].handler);
  }
  if (DBLCLICK_DEBUG) console.log("Dashboard dblclick | torn down");
  delete game[FLAG];
}

// ─── Handler ─────────────────────────────────────────────────────────────────
function onCanvasDblclick(event) {
  // Only fire on the canvas element itself (not UI overlays)
  if (event.target !== canvas.app.view) return;

  // Skip if a placeable (token, tile, etc.) is under the cursor
  if (canvas.activeLayer?.hover) return;

  if (DBLCLICK_DEBUG) console.log("Dashboard dblclick | firing on empty canvas");

  const macro = game.macros.find(m => m.name === "Token Dashboard");
  if (macro) {
    macro.execute();
  } else {
    console.warn("Dashboard dblclick | 'Token Dashboard' macro not found");
  }
}

// ─── Register ────────────────────────────────────────────────────────────────
const view = canvas?.app?.view;
if (view) {
  view.addEventListener("dblclick", onCanvasDblclick);
  game[FLAG] = { handler: onCanvasDblclick };
  if (DBLCLICK_DEBUG) console.log("Dashboard dblclick | registered");
} else {
  console.warn("Dashboard dblclick | canvas not ready, listener not registered");
}
