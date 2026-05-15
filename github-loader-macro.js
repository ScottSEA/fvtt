/**
 * FVTT MACRO LOADER — BOOTSTRAP STUB
 *
 * This is the only macro users need to create in Foundry.
 * It fetches the real loader from GitHub and executes it.
 * Always runs the latest version — no manual updates needed.
 *
 * Ctrl+Shift activates dev mode: prompts for a private plugin repo,
 * fetches its manifest, and passes the extra macros to the loader
 * via game._ghLoaderPluginData.
 *
 * To install: create a new Script macro in Foundry, paste this code, and run it.
 */

const REPO_OWNER = "ScottSEA";
const REPO_NAME = "fvtt";
const BRANCH = "main";
const LOADER_FILE = "loader.js";
const PLUGIN_KEY = "_ghLoaderPlugins";

(async () => {
  try {
    // ── Dev mode detection (must happen synchronously before any await) ───────
    const DEV_MODE = game.keyboard?.isModifierActive(KeyboardManager.MODIFIER_KEYS.CONTROL)
                  && game.keyboard?.isModifierActive(KeyboardManager.MODIFIER_KEYS.SHIFT);

    // ── Load plugin data if dev mode ─────────────────────────────────────────
    game._ghLoaderPluginData = null;
    if (DEV_MODE) {
      console.log("Macro Loader | Dev mode activated (Ctrl+Shift held).");
      try {
        const pluginData = await loadPlugins();
        if (pluginData) game._ghLoaderPluginData = pluginData;
      } catch (err) {
        console.error("Macro Loader | Plugin loading failed:", err);
        ui.notifications.warn(`Dev plugin loading failed: ${err.message}`);
      }
    }

    // ── Fetch and execute the loader ─────────────────────────────────────────
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

// ─── Plugin System (Dev Mode Only) ────────────────────────────────────────────

async function loadPlugins() {
  const plugins = game[PLUGIN_KEY] ?? [];

  // On first dev-mode run, prompt to add a plugin
  if (!game[PLUGIN_KEY]) {
    game[PLUGIN_KEY] = [];
    const plugin = await promptPluginSetup();
    if (plugin) {
      game[PLUGIN_KEY].push(plugin);
      plugins.push(plugin);
    }
  }

  if (plugins.length === 0) return null;

  const extraMacros = [];
  const extraFileTree = {};

  for (const plugin of plugins) {
    try {
      const token = plugin.token;
      if (!token) {
        console.warn(`Macro Loader | Plugin ${plugin.owner}/${plugin.repo} has no PAT, skipping.`);
        continue;
      }
      const apiBase = `https://api.github.com/repos/${plugin.owner}/${plugin.repo}`;
      const branch = plugin.branch ?? "main";
      const manifestPath = plugin.manifestPath ?? "manifest.json";

      // Fetch plugin manifest
      const manifestUrl = `${apiBase}/contents/${manifestPath}?ref=${branch}&_=${Date.now()}`;
      const res = await fetch(manifestUrl, {
        headers: { Accept: "application/vnd.github.v3.raw", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const pluginManifest = JSON.parse(await res.text());

      // Pre-resolve each macro entry with its fetch URL and token
      for (const entry of pluginManifest.macros ?? []) {
        entry._apiUrl = `${apiBase}/contents/${entry.path}?ref=${branch}`;
        entry._token = token;
        entry.id = `${plugin.owner}/${plugin.repo}:${entry.id}`;
        extraMacros.push(entry);
      }

      // Fetch plugin file tree for SHA caching
      try {
        const treeUrl = `${apiBase}/git/trees/${branch}?recursive=1&_=${Date.now()}`;
        const treeRes = await fetch(treeUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (treeRes.ok) {
          const treeData = await treeRes.json();
          for (const e of treeData.tree ?? []) {
            if (e.type === "blob") extraFileTree[e.path] = e.sha;
          }
        }
      } catch (err) {
        console.warn(`Macro Loader | Plugin tree fetch failed for ${plugin.owner}/${plugin.repo}:`, err.message);
      }

      console.log(`Macro Loader | Plugin ${plugin.owner}/${plugin.repo} loaded (${pluginManifest.macros?.length ?? 0} macros).`);
    } catch (err) {
      console.error(`Macro Loader | Plugin ${plugin.owner}/${plugin.repo} failed:`, err);
      ui.notifications.warn(`Plugin ${plugin.owner}/${plugin.repo} failed to load.`);
    }
  }

  return extraMacros.length > 0 ? { macros: extraMacros, fileTree: extraFileTree } : null;
}

function promptPluginSetup() {
  return Dialog.prompt({
    title: "🔧 Dev Macros — Private Repo",
    content: `
      <p style="margin-bottom:8px;">Enter the private repo and PAT for dev macros.
      Leave blank to skip.</p>
      <div style="display:grid; gap:6px;">
        <label style="font-size:12px;">Repo owner/name (e.g. <code>MyUser/fvtt-dev</code>)
          <input type="text" name="plugin-repo" style="width:100%" placeholder="owner/repo">
        </label>
        <label style="font-size:12px;">PAT with read access to this repo
          <input type="password" name="plugin-token" style="width:100%" placeholder="ghp_...">
        </label>
        <label style="font-size:12px;">Branch (default: main)
          <input type="text" name="plugin-branch" style="width:100%" placeholder="main">
        </label>
      </div>`,
    callback: html => {
      const repoStr = html.find("[name=plugin-repo]").val()?.trim();
      if (!repoStr || !repoStr.includes("/")) return null;
      const [owner, repo] = repoStr.split("/", 2);
      const token = html.find("[name=plugin-token]").val()?.trim();
      if (!token) return null;
      const branch = html.find("[name=plugin-branch]").val()?.trim() || "main";
      return { owner, repo, token, branch };
    },
    rejectClose: false,
  });
}