/**
 * FVTT MACRO LOADER — BOOTSTRAP STUB
 *
 * This is the only macro users need to create in Foundry.
 * It fetches the real loader from GitHub and executes it.
 * Always runs the latest version — no manual updates needed.
 *
 * To install: create a new Script macro in Foundry, paste this code, and run it.
 */

const REPO_OWNER = "ScottSEA";
const REPO_NAME = "fvtt";
const BRANCH = "main";
const LOADER_FILE = "loader.js";

(async () => {
  try {
    // Detect Ctrl+Shift at launch time for dev mode (must be checked here,
    // before the async fetch clears the modifier key state)
    game._ghLoaderDevMode = game.keyboard?.isModifierActive(KeyboardManager.MODIFIER_KEYS.CONTROL)
                         && game.keyboard?.isModifierActive(KeyboardManager.MODIFIER_KEYS.SHIFT);

    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${LOADER_FILE}?ref=${BRANCH}&_=${Date.now()}`;
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.github.v3.raw" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const code = await response.text();
    eval.call(globalThis, code);
  } catch (err) {
    ui.notifications.error(`Macro Loader failed: ${err.message}`);
    console.error("Macro Loader | Bootstrap error:", err);
  }
})();