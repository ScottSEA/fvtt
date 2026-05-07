/**
 * GITHUB LOADER MACRO
 *
 * Scans the hook-macros/ directory in the GitHub repo and auto-loads
 * every *-macro.js file. Run once at session start to register all
 * hook-based macros — no local macro documents needed.
 *
 * New macros added to hook-macros/ are picked up automatically.
 */

const REPO_OWNER = "ScottSEA";
const REPO_NAME = "fvtt";
const BRANCH = "main";
const HOOK_DIR = "hook-macros";
const MANUAL_DIR = "manual-macros";
const FILE_PATTERN = /-macro\.js$/;

const LOADER_FLAG = "_githubLoaderResults";
const TOKEN_KEY = "_ghLoaderToken";

// ─── Token Prompt ────────────────────────────────────────────────────────────

async function getToken() {
  if (game[TOKEN_KEY]) return game[TOKEN_KEY];
  const token = await Dialog.prompt({
    title: "🔑",
    content: `<input type="password" name="token" style="width:100%">`,
    callback: html => html.find("[name=token]").val()?.trim(),
    rejectClose: false,
  });
  if (!token) return null;
  game[TOKEN_KEY] = token;
  return token;
}

// ─── Main ────────────────────────────────────────────────────────────────────

await loadFromGitHub();

async function loadFromGitHub() {
  const GH_TOKEN = await getToken();
  if (!GH_TOKEN) {
    ui.notifications.warn("GitHub Loader: No token provided — cancelled.");
    return;
  }

  const startTime = Date.now();

  ui.notifications.info("🔄 Fetching macros from GitHub...");

  let files;
  try {
    files = await listMacroFiles(GH_TOKEN);
  } catch (err) {
    ui.notifications.error(`GitHub Loader: Failed to list files — ${err.message}`);
    console.error("GitHub Loader | Directory listing failed:", err);
    return;
  }

  if (files.length === 0) {
    ui.notifications.warn("GitHub Loader: No macro files found in hook-macros/");
    return;
  }

  console.log(`GitHub Loader | Found ${files.length} macro files. Loading...`);

  const results = { loaded: [], failed: [] };

  for (const file of files) {
    try {
      const code = await fetchFileContent(file.url, GH_TOKEN);
      eval.call(globalThis, code);
      results.loaded.push(file.name);
      console.log(`✅ ${file.name} loaded.`);
    } catch (err) {
      results.failed.push({ name: file.name, error: err.message });
      console.error(`❌ ${file.name} failed:`, err);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const summary = `🎲 GitHub Loader: ${results.loaded.length}/${files.length} macros loaded (${elapsed}s)`;

  if (results.failed.length > 0) {
    const failNames = results.failed.map(f => f.name).join(", ");
    ui.notifications.warn(`${summary} — Failed: ${failNames}`);
  } else {
    ui.notifications.info(summary);
  }

  game[LOADER_FLAG] = results;

  // ── Sync manual macros (create/update Foundry macro documents) ───────────
  await syncManualMacros(GH_TOKEN);

  // ── Self-update the loader macro from GitHub ───────────────────────────────
  await selfUpdate(GH_TOKEN);
}

// ─── Manual Macro Sync ───────────────────────────────────────────────────────

async function syncManualMacros(token) {
  let files;
  try {
    files = await listDirectory(MANUAL_DIR, token);
  } catch (err) {
    console.log("GitHub Loader | No manual-macros/ directory found, skipping.");
    return;
  }

  if (files.length === 0) return;

  let synced = 0;
  for (const file of files) {
    try {
      const code = await fetchFileContent(file.url, token);
      const macroName = file.name.replace(/-macro\.js$/, "").replace(/-/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());

      const existing = game.macros.find(m => m.name === macroName && m.author?.id === game.user.id);
      if (existing) {
        await existing.update({ command: code });
        console.log(`📋 ${macroName} updated.`);
      } else {
        await Macro.create({ name: macroName, type: "script", scope: "global", command: code });
        console.log(`📋 ${macroName} created.`);
      }
      synced++;
    } catch (err) {
      console.error(`❌ Manual macro ${file.name} failed:`, err);
    }
  }

  if (synced > 0) ui.notifications.info(`📋 ${synced} manual macro${synced !== 1 ? "s" : ""} synced.`);
}

// ─── Self-Update ─────────────────────────────────────────────────────────────

async function selfUpdate(token) {
  try {
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/github-loader-macro.js?ref=${BRANCH}`;
    const latest = await fetchFileContent(apiUrl, token);
    const self = game.macros.find(m => m.command?.includes(LOADER_FLAG) && m.author?.id === game.user.id);
    if (!self) return;
    if (self.command.trim() === latest.trim()) {
      console.log("GitHub Loader | Self-update: already up to date.");
      return;
    }
    await self.update({ command: latest });
    ui.notifications.info("🔄 Loader macro updated — changes take effect next run.");
  } catch (err) {
    console.warn("GitHub Loader | Self-update failed:", err.message);
  }
}

// ─── GitHub API ──────────────────────────────────────────────────────────────

async function listMacroFiles(token) {
  return listDirectory(HOOK_DIR, token);
}

async function listDirectory(dir, token) {
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${dir}?ref=${BRANCH}`;
  const cacheBust = `&_=${Date.now()}`;

  const response = await fetch(apiUrl + cacheBust, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
  }

  const entries = await response.json();

  return entries
    .filter(e => e.type === "file" && FILE_PATTERN.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchFileContent(apiUrl, token) {
  const cacheBust = apiUrl.includes("?") ? `&_=${Date.now()}` : `?_=${Date.now()}`;
  const response = await fetch(apiUrl + cacheBust, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3.raw",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.text();
}
// END: GITHUB LOADER MACRO
