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
const SHA_CACHE_KEY = "_ghLoaderShaCache";

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

  // ── Sync manual macros first (create/update Foundry macro documents) ─────
  await syncManualMacros(GH_TOKEN);

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

  console.log(`GitHub Loader | Found ${files.length} macro files. Checking for changes...`);

  const results = { loaded: [], skipped: [], failed: [] };
  const shaCache = game[SHA_CACHE_KEY] ?? {};

  for (const file of files) {
    try {
      if (shaCache[file.name] === file.sha) {
        results.skipped.push(file.name);
        continue;
      }
      const code = await fetchFileContent(file.url, GH_TOKEN);
      eval.call(globalThis, code);
      shaCache[file.name] = file.sha;
      results.loaded.push(file.name);
      console.log(`✅ ${file.name} loaded.`);
    } catch (err) {
      results.failed.push({ name: file.name, error: err.message });
      console.error(`❌ ${file.name} failed:`, err);
    }
  }

  game[SHA_CACHE_KEY] = shaCache;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const parts = [`${results.loaded.length} loaded`];
  if (results.skipped.length > 0) parts.push(`${results.skipped.length} cached`);
  if (results.failed.length > 0) parts.push(`${results.failed.length} failed`);
  const summary = `🎲 GitHub Loader: ${parts.join(", ")} (${elapsed}s)`;

  if (results.failed.length > 0) {
    const failNames = results.failed.map(f => f.name).join(", ");
    ui.notifications.warn(`${summary} — Failed: ${failNames}`);
  } else {
    ui.notifications.info(summary);
  }

  game[LOADER_FLAG] = results;

  // ── Self-update the loader macro from GitHub ───────────────────────────────
  await selfUpdate(GH_TOKEN);
}

// ─── Font Awesome to Data URI ────────────────────────────────────────────────

function faToDataUri(iconClass, color = "#fff", size = 64) {
  const i = document.createElement("i");
  i.className = iconClass;
  i.style.cssText = `font-size:${size}px;position:absolute;visibility:hidden`;
  document.body.appendChild(i);
  const s = getComputedStyle(i, ":before");
  const char = s.content.replace(/"/g, "");
  const family = s.fontFamily.split(",")[0].replace(/"/g, "").trim();
  const weight = s.fontWeight || "900";
  i.remove();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-family="${family}" font-weight="${weight}" font-size="${size * 0.75}px" fill="${color}">${char}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function extractMacroIcon(code) {
  const match = code.match(/const\s+MACRO_ICON_FA\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
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
  const shaCache = game[SHA_CACHE_KEY] ?? {};

  for (const file of files) {
    try {
      if (shaCache[file.name] === file.sha) {
        console.log(`📋 ${file.name} unchanged, skipping.`);
        continue;
      }
      const code = await fetchFileContent(file.url, token);
      const macroName = file.name.replace(/-macro\.js$/, "").replace(/-/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase());

      const existing = game.macros.find(m => m.name === macroName && m.author?.id === game.user.id);
      const faIcon = extractMacroIcon(code);
      const img = faIcon ? faToDataUri(faIcon) : undefined;

      if (existing) {
        const updates = { command: code };
        if (img) updates.img = img;
        await existing.update(updates);
        console.log(`📋 ${macroName} updated.`);
      } else {
        const data = { name: macroName, type: "script", scope: "global", command: code };
        if (img) data.img = img;
        await Macro.create(data);
        console.log(`📋 ${macroName} created.`);
      }
      shaCache[file.name] = file.sha;
      synced++;
    } catch (err) {
      console.error(`❌ Manual macro ${file.name} failed:`, err);
    }
  }

  game[SHA_CACHE_KEY] = shaCache;

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
    ui.notifications.warn("🔄 Loader updated! Click it again to run the new version.");
    Dialog.prompt({
      title: "🔄 Loader Updated",
      content: "<p>The loader macro was updated from GitHub.<br><strong>Run it again</strong> to use the new version.</p>",
      callback: () => {},
    });
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
