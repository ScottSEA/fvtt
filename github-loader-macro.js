/**
 * FVTT MACRO LOADER — BOOTSTRAP STUB
 *
 * This is the only macro users need to create in Foundry.
 * It fetches the real loader from GitHub and executes it.
 * Always runs the latest version — no manual updates needed.
 *
 * ─── Dev Mode (Ctrl+Shift) ───────────────────────────────────────────────────
 *
 * Hold Ctrl+Shift while clicking/running this macro to activate dev mode.
 * Dev mode loads additional macros from a private GitHub repository.
 *
 * On first dev-mode run:   prompts for repo owner/name, PAT, and branch.
 * On subsequent runs:      shows a management dialog to add, remove, or
 *                          skip plugins for the current session.
 *
 * PAT Requirements:
 *   - Fine-grained PAT with "Contents: Read-only" on the target repo, or
 *   - Classic PAT with `repo` scope.
 *
 * Security Model:
 *   - PAT is stored only in browser memory (game[] object) for the session.
 *   - PAT is NEVER persisted to disk, localStorage, Foundry DB, or logs.
 *   - PAT is NEVER written to Macro document command fields.
 *   - Private macro source code IS persisted in Foundry for manual (non-hook)
 *     macros — treat plugin macros as "private for distribution, not secret."
 *   - On page reload, all plugin configs are lost and must be re-entered.
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
        console.error("Macro Loader | Plugin loading failed:", err.message);
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
    console.error("Macro Loader | Bootstrap error:", err.message);
  }
})();

// ─── Plugin System (Dev Mode Only) ────────────────────────────────────────────

async function loadPlugins() {
  // First dev-mode run: prompt for a single plugin
  // Subsequent runs: show management dialog
  if (!game[PLUGIN_KEY]) {
    game[PLUGIN_KEY] = [];
    const plugin = await promptPluginSetup();
    if (plugin) game[PLUGIN_KEY].push(plugin);
  } else {
    const action = await promptPluginManagement();
    if (action === "skip") return null;
  }

  const plugins = game[PLUGIN_KEY];
  if (plugins.length === 0) return null;

  const extraMacros = [];
  const extraFileTree = {};

  for (const plugin of plugins) {
    const label = `${plugin.owner}/${plugin.repo}`;
    try {
      const token = plugin.token;
      if (!token) {
        console.warn(`Macro Loader | Plugin ${label} has no PAT, skipping.`);
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

      if (!res.ok) {
        const msg = res.status === 401 ? "PAT is invalid or expired"
                  : res.status === 403 ? "PAT lacks access (check scope, SSO, or org policy)"
                  : res.status === 404 ? "Repo, branch, or manifest not found (or PAT lacks visibility)"
                  : `HTTP ${res.status}: ${res.statusText}`;
        ui.notifications.warn(`Plugin ${label}: ${msg}`);
        console.warn(`Macro Loader | Plugin ${label} failed: ${msg}`);
        continue;
      }

      let pluginManifest;
      try {
        pluginManifest = JSON.parse(await res.text());
      } catch (parseErr) {
        ui.notifications.warn(`Plugin ${label}: Manifest is not valid JSON.`);
        console.warn(`Macro Loader | Plugin ${label} manifest parse error:`, parseErr.message);
        continue;
      }

      if (!Array.isArray(pluginManifest.macros)) {
        ui.notifications.warn(`Plugin ${label}: Manifest missing "macros" array.`);
        console.warn(`Macro Loader | Plugin ${label} manifest has no macros array.`);
        continue;
      }

      // Pre-resolve each macro entry with its fetch URL and token
      for (const entry of pluginManifest.macros) {
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
      } catch (treeErr) {
        console.warn(`Macro Loader | Plugin ${label} tree fetch failed:`, treeErr.message);
      }

      console.log(`Macro Loader | Plugin ${label} loaded (${pluginManifest.macros.length} macros).`);
    } catch (err) {
      console.warn(`Macro Loader | Plugin ${label} failed:`, err.message);
      ui.notifications.warn(`Plugin ${label} failed to load.`);
    }
  }

  return extraMacros.length > 0 ? { macros: extraMacros, fileTree: extraFileTree } : null;
}

// ─── Plugin Dialogs ──────────────────────────────────────────────────────────

function promptPluginSetup() {
  return Dialog.prompt({
    title: "🔧 Dev Mode — Add Plugin Repo",
    content: `
      <p style="margin-bottom:8px;">Enter a private GitHub repo and PAT for dev macros.
      Leave blank to skip.</p>
      <div style="display:grid; gap:6px;">
        <label style="font-size:12px;">Repo owner/name (e.g. <code>MyUser/fvtt-dev</code>)
          <input type="text" name="plugin-repo" style="width:100%" placeholder="owner/repo">
        </label>
        <label style="font-size:12px;">PAT with read access
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

async function promptPluginManagement() {
  const plugins = game[PLUGIN_KEY];

  const listHtml = plugins.length > 0
    ? plugins.map((p, i) =>
        `<div style="display:flex; align-items:center; gap:6px; padding:4px 0;">
          <input type="checkbox" name="remove-${i}" id="remove-${i}">
          <label for="remove-${i}" style="font-size:12px; margin:0;">
            <code>${p.owner}/${p.repo}</code> (${p.branch ?? "main"})
          </label>
        </div>`
      ).join("")
    : `<p style="color:#888; font-size:12px;">No plugins configured.</p>`;

  return new Promise(resolve => {
    new Dialog({
      title: "🔧 Dev Mode — Manage Plugins",
      content: `
        <p style="margin-bottom:6px;"><strong>Current plugins:</strong></p>
        ${listHtml}
        <hr style="margin:8px 0;">
        <p style="font-size:11px; color:#888;">
          Check plugins to remove. Use buttons below to add, continue, or skip.
        </p>`,
      buttons: {
        add: {
          icon: '<i class="fas fa-plus"></i>',
          label: "Add",
          callback: async html => {
            removeCheckedPlugins(html);
            const plugin = await promptPluginSetup();
            if (plugin) game[PLUGIN_KEY].push(plugin);
            resolve(await promptPluginManagement());
          },
        },
        remove: {
          icon: '<i class="fas fa-trash"></i>',
          label: "Remove Checked",
          callback: async html => {
            removeCheckedPlugins(html);
            resolve(await promptPluginManagement());
          },
        },
        cont: {
          icon: '<i class="fas fa-play"></i>',
          label: "Continue",
          callback: html => {
            removeCheckedPlugins(html);
            resolve("continue");
          },
        },
        skip: {
          icon: '<i class="fas fa-forward"></i>',
          label: "Skip This Run",
          callback: () => resolve("skip"),
        },
      },
      default: "cont",
      close: () => resolve("continue"),
    }).render(true);
  });
}

function removeCheckedPlugins(html) {
  const plugins = game[PLUGIN_KEY];
  const toRemove = [];
  for (let i = plugins.length - 1; i >= 0; i--) {
    if (html.find(`[name=remove-${i}]`).is(":checked")) {
      toRemove.push(i);
    }
  }
  for (const i of toRemove) plugins.splice(i, 1);
}