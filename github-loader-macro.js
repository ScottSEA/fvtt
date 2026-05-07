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
const FILE_PATTERN = /-macro\.js$/;

const LOADER_FLAG = "_githubLoaderResults";

// ─── Main ────────────────────────────────────────────────────────────────────

await loadFromGitHub();

async function loadFromGitHub() {
  const startTime = Date.now();

  ui.notifications.info("🔄 Fetching macros from GitHub...");

  let files;
  try {
    files = await listMacroFiles();
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
      const code = await fetchFileContent(file.download_url);
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
}

// ─── GitHub API ──────────────────────────────────────────────────────────────

async function listMacroFiles() {
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${HOOK_DIR}?ref=${BRANCH}`;
  const cacheBust = `&_=${Date.now()}`;

  const response = await fetch(apiUrl + cacheBust);
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}: ${response.statusText}`);
  }

  const entries = await response.json();

  return entries
    .filter(e => e.type === "file" && FILE_PATTERN.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchFileContent(downloadUrl) {
  const cacheBust = downloadUrl.includes("?") ? `&_=${Date.now()}` : `?_=${Date.now()}`;
  const response = await fetch(downloadUrl + cacheBust);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.text();
}
// END: GITHUB LOADER MACRO
