/**
 * GITHUB MACRO LOADER
 *
 * Manifest-driven selective installer for Foundry VTT macros.
 * Fetches manifest.json from GitHub, inspects the user's actor,
 * and installs only macros whose prerequisites match the character.
 *
 * All macros are installed as visible Foundry Macro documents.
 * Hook-based macros (autoExecute: true) are executed immediately
 * to register their hooks.
 *
 * Run once at session start to install and activate all applicable macros.
 */

const REPO_OWNER = "ScottSEA";
const REPO_NAME = "fvtt";
const BRANCH = "main";
const MANIFEST_PATH = "manifest.json";

const LOADER_ICON = "fa-download";

const LOADER_FLAG = "_githubLoaderResults";
const TOKEN_KEY = "_ghLoaderToken";
const SHA_CACHE_KEY = "_ghLoaderShaCache";
const ACTOR_KEY = "_ghLoaderActorId";
const PLUGIN_KEY = "_ghLoaderPlugins";
const FA_SVG_BASE = "https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid";

// ─── Token Prompt ────────────────────────────────────────────────────────────

async function getToken() {
  if (game[TOKEN_KEY]) return game[TOKEN_KEY];
  const token = await Dialog.prompt({
    title: "🔑 GitHub Token",
    content: `<p style="margin-bottom:8px;">Enter a GitHub Personal Access Token with read access to <code>${REPO_OWNER}/${REPO_NAME}</code>:</p>
      <input type="password" name="token" style="width:100%" placeholder="ghp_...">`,
    callback: html => html.find("[name=token]").val()?.trim(),
    rejectClose: false,
  });
  if (!token) return null;
  game[TOKEN_KEY] = token;
  return token;
}

// ─── Main ────────────────────────────────────────────────────────────────────

await runLoader();

async function runLoader() {
  const GH_TOKEN = await getToken();
  if (!GH_TOKEN) {
    ui.notifications.warn("Macro Loader: No token provided — cancelled.");
    return;
  }

  const startTime = Date.now();
  ui.notifications.info("🔄 Fetching macro manifest from GitHub...");

  // ── Step 1: Fetch the manifest ─────────────────────────────────────────────
  let manifest;
  try {
    const manifestUrl = buildApiUrl(MANIFEST_PATH);
    const raw = await fetchFileContent(manifestUrl, GH_TOKEN);
    manifest = JSON.parse(raw);
  } catch (err) {
    ui.notifications.error(`Macro Loader: Failed to fetch manifest — ${err.message}`);
    console.error("Macro Loader | Manifest fetch failed:", err);
    return;
  }

  console.log(`Macro Loader | Manifest v${manifest.version} loaded with ${manifest.macros.length} macros.`);

  // ── Step 1a: Load plugin manifests (private repos, dev macros, etc.) ────────
  const plugins = await loadPluginManifests(GH_TOKEN);
  if (plugins.length > 0) {
    let pluginMacroCount = 0;
    for (const plugin of plugins) {
      pluginMacroCount += plugin.manifest.macros.length;
      manifest.macros.push(...plugin.manifest.macros);
    }
    console.log(`Macro Loader | ${plugins.length} plugin(s) loaded with ${pluginMacroCount} additional macros.`);
  }

  // ── Step 1b: Fetch the repo tree for SHA-based caching ─────────────────────
  let fileTree = {};
  try {
    fileTree = await fetchFileTree(GH_TOKEN);
    console.log(`Macro Loader | File tree loaded (${Object.keys(fileTree).length} files).`);
  } catch (err) {
    console.warn("Macro Loader | Tree fetch failed, all files will be re-fetched:", err.message);
  }

  // Merge plugin file trees
  for (const plugin of plugins) {
    if (plugin.fileTree) Object.assign(fileTree, plugin.fileTree);
  }

  // ── Step 2: Detect the user's actor ────────────────────────────────────────
  const actor = await resolveActor();
  if (actor) {
    console.log(`Macro Loader | Actor: ${actor.name}`);
  } else {
    console.log("Macro Loader | No actor selected — installing only macros with no prerequisites.");
  }

  // ── Step 3: Build actor profile for prerequisite matching ──────────────────
  const profile = actor ? buildActorProfile(actor) : null;
  if (profile) {
    console.log("Macro Loader | Actor profile:", profile);
  }

  // ── Step 4: Filter macros by prerequisites ─────────────────────────────────
  const matched = [];
  const skippedPrereqs = [];

  for (const entry of manifest.macros) {
    if (meetsPrerequisites(entry.requires, profile)) {
      matched.push(entry);
    } else {
      skippedPrereqs.push(entry.id);
    }
  }

  console.log(`Macro Loader | ${matched.length} macros match prerequisites, ${skippedPrereqs.length} skipped.`);

  // ── Step 5: Dependency-sort matched macros ─────────────────────────────────
  const sorted = topologicalSort(matched);

  // ── Step 6: Install and execute macros ─────────────────────────────────────
  const results = { installed: [], updated: [], cached: [], executed: [], failed: [] };
  const shaCache = game[SHA_CACHE_KEY] ?? {};

  for (const entry of sorted) {
    try {
      const result = await installMacro(entry, GH_TOKEN, shaCache, fileTree);
      results[result.status].push(entry.name);

      if (entry.autoExecute && result.code) {
        try {
          eval.call(globalThis, result.code);
          results.executed.push(entry.name);
        } catch (execErr) {
          console.error(`Macro Loader | ❌ Execute failed for ${entry.name}:`, execErr);
          results.failed.push(`${entry.name} (exec)`);
        }
      }
    } catch (err) {
      results.failed.push(entry.name);
      console.error(`Macro Loader | ❌ ${entry.name} failed:`, err);
    }
  }

  game[SHA_CACHE_KEY] = shaCache;

  // ── Step 7: Report results ─────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const parts = [];
  const newCount = results.installed.length;
  const updCount = results.updated.length;
  const cachedCount = results.cached.length;
  const execCount = results.executed.length;
  const failCount = results.failed.length;

  if (newCount > 0) parts.push(`${newCount} new`);
  if (updCount > 0) parts.push(`${updCount} updated`);
  if (cachedCount > 0) parts.push(`${cachedCount} cached`);
  if (execCount > 0) parts.push(`${execCount} hooks`);
  if (failCount > 0) parts.push(`${failCount} failed`);

  const summary = `🎲 Macro Loader: ${parts.join(", ")} (${elapsed}s)`;
  const actorInfo = actor ? ` for ${actor.name}` : "";

  if (failCount > 0) {
    ui.notifications.warn(`${summary}${actorInfo} — Failed: ${results.failed.join(", ")}`);
  } else {
    ui.notifications.info(`${summary}${actorInfo}`);
  }

  game[LOADER_FLAG] = { ...results, actorName: actor?.name, timestamp: Date.now() };

  // ── Step 8: Self-update ────────────────────────────────────────────────────
  await selfUpdate(GH_TOKEN);
}

// ─── Actor Detection ─────────────────────────────────────────────────────────

async function resolveActor() {
  // If we remembered an actor from a previous run this session, use it
  if (game[ACTOR_KEY]) {
    const prev = game.actors.get(game[ACTOR_KEY]);
    if (prev?.isOwner) return prev;
  }

  // Find all owned character actors
  const owned = game.actors.filter(a => a.isOwner && a.type === "character");

  if (owned.length === 0) return null;
  if (owned.length === 1) {
    game[ACTOR_KEY] = owned[0].id;
    return owned[0];
  }

  // Multiple characters — prompt the user to choose
  const selected = await promptActorSelection(owned);
  if (selected) game[ACTOR_KEY] = selected.id;
  return selected;
}

async function promptActorSelection(actors) {
  const options = actors.map(a =>
    `<option value="${a.id}">${a.name} (${getActorClassSummary(a)})</option>`
  ).join("");

  return Dialog.prompt({
    title: "🎭 Select Character",
    content: `
      <p>Which character should the macro loader configure for?</p>
      <select name="actor-id" style="width:100%; margin-top:6px;">
        ${options}
      </select>`,
    callback: html => {
      const id = html.find("[name=actor-id]").val();
      return game.actors.get(id) ?? null;
    },
    rejectClose: false,
  });
}

function getActorClassSummary(actor) {
  const classes = actor.items.filter(i => i.type === "class");
  if (classes.length === 0) return "No class";
  return classes.map(c => {
    const lvl = c.system?.levels ?? c.system?.level ?? "?";
    return `${c.name} ${lvl}`;
  }).join(" / ");
}

// ─── Actor Profile Builder ───────────────────────────────────────────────────

function buildActorProfile(actor) {
  const classes = actor.items.filter(i => i.type === "class");
  const subclasses = actor.items.filter(i => i.type === "subclass");
  const feats = actor.items.filter(i => i.type === "feat");
  const race = actor.items.find(i => i.type === "race");
  const spells = actor.items.filter(i => i.type === "spell");
  const allItems = actor.items.filter(i =>
    ["weapon", "equipment", "consumable", "tool", "loot"].includes(i.type)
  );

  return {
    classes: classes.map(c => ({
      name: c.name?.toLowerCase(),
      identifier: c.system?.identifier?.toLowerCase(),
      level: c.system?.levels ?? c.system?.level ?? 0,
    })),
    subclasses: subclasses.map(s => ({
      name: s.name?.toLowerCase(),
      identifier: s.system?.identifier?.toLowerCase(),
    })),
    feats: feats.map(f => f.name),
    race: race?.name ?? null,
    items: allItems.map(i => i.name),
    spells: spells.map(s => s.name),
  };
}

// ─── Prerequisite Matching ───────────────────────────────────────────────────

function meetsPrerequisites(requires, profile) {
  if (!requires || Object.keys(requires).length === 0) return true;
  if (!profile) return false;

  // Class check: identifier or name match
  if (requires.class) {
    const target = requires.class.toLowerCase();
    const hasClass = profile.classes.some(c =>
      c.identifier === target || c.name === target
    );
    if (!hasClass) return false;
  }

  // Subclass check: identifier or name (partial) match
  if (requires.subclass) {
    const target = requires.subclass.toLowerCase();
    const hasSub = profile.subclasses.some(s =>
      s.identifier === target
      || s.name === target
      || s.name?.includes(target)
    );
    if (!hasSub) return false;
  }

  // Minimum level check (on the required class)
  if (requires.minLevel) {
    const target = requires.class?.toLowerCase();
    const classInfo = target
      ? profile.classes.find(c => c.identifier === target || c.name === target)
      : profile.classes[0];
    if (!classInfo || classInfo.level < requires.minLevel) return false;
  }

  // Feat check: exact name match
  if (requires.feat) {
    const hasFeat = profile.feats.some(f =>
      f.toLowerCase() === requires.feat.toLowerCase()
    );
    if (!hasFeat) return false;
  }

  // Item check: partial name match (substring)
  if (requires.item) {
    const target = requires.item.toLowerCase();
    const hasItem = profile.items.some(i =>
      i.toLowerCase().includes(target)
    );
    if (!hasItem) return false;
  }

  // Race check: partial name match
  if (requires.race) {
    if (!profile.race) return false;
    const hasRace = profile.race.toLowerCase().includes(requires.race.toLowerCase());
    if (!hasRace) return false;
  }

  // Spell check: exact name match
  if (requires.spell) {
    const hasSpell = profile.spells.some(s =>
      s.toLowerCase() === requires.spell.toLowerCase()
    );
    if (!hasSpell) return false;
  }

  return true;
}

// ─── Dependency Sorting ──────────────────────────────────────────────────────

function topologicalSort(macros) {
  const byId = new Map(macros.map(m => [m.id, m]));
  const visited = new Set();
  const result = [];

  function visit(entry) {
    if (visited.has(entry.id)) return;
    visited.add(entry.id);
    for (const depId of entry.dependsOn ?? []) {
      const dep = byId.get(depId);
      if (dep) visit(dep);
    }
    result.push(entry);
  }

  for (const entry of macros) visit(entry);
  return result;
}

// ─── Macro Installation ──────────────────────────────────────────────────────

async function installMacro(entry, token, shaCache, fileTree) {
  const cached = shaCache[entry.id];
  const currentSha = fileTree[entry.path];
  const repoToken = entry._pluginToken ?? token;

  // Check SHA cache — if file unchanged and Macro document exists, skip fetch
  if (cached?.sha && currentSha && cached.sha === currentSha) {
    const existing = game.macros.find(m =>
      m.name === entry.name && m.author?.id === game.user.id
    );
    if (existing) {
      // Re-execute autoExecute macros even if cached (hooks need re-registration)
      if (entry.autoExecute) {
        return { status: "cached", code: existing.command };
      }
      return { status: "cached", code: null };
    }
  }

  // Fetch the macro source from GitHub (use plugin repo URL if available)
  const apiUrl = entry._pluginApiBase
    ? `${entry._pluginApiBase}/contents/${entry.path}?ref=${entry._pluginBranch ?? "main"}`
    : buildApiUrl(entry.path);
  const code = await fetchFileContent(apiUrl, repoToken);

  // Resolve icon from the macro source
  const iconValue = extractMacroIcon(code);
  const img = await resolveIcon(iconValue);

  // Find existing Macro document (by name + author)
  const existing = game.macros.find(m =>
    m.name === entry.name && m.author?.id === game.user.id
  );

  if (existing) {
    const updates = { command: code };
    if (img) updates.img = img;
    await existing.update(updates);
    console.log(`📋 ${entry.name} updated.`);
    shaCache[entry.id] = { sha: currentSha ?? Date.now().toString() };
    return { status: "updated", code };
  }

  // Create new Macro document
  const data = {
    name: entry.name,
    type: "script",
    scope: "global",
    command: code,
  };
  if (img) data.img = img;
  await Macro.create(data);
  console.log(`📋 ${entry.name} created.`);
  shaCache[entry.id] = { sha: currentSha ?? Date.now().toString() };
  return { status: "installed", code };
}

// ─── Macro Icon Resolution ───────────────────────────────────────────────────

function extractMacroIcon(code) {
  const match = code.match(/const\s+MACRO_ICON\s*=\s*"([^"]+)"/);
  return match ? match[1] : null;
}

function isFaIcon(icon) {
  return icon && icon.startsWith("fa-");
}

async function resolveIcon(iconValue) {
  if (!iconValue) return null;
  if (!isFaIcon(iconValue)) return iconValue;

  const name = iconValue.replace(/^fa-/, "");
  try {
    const url = `${FA_SVG_BASE}/${name}.svg`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let svg = await res.text();
    svg = svg.replace(/<!--[\s\S]*?-->/g, "");
    svg = svg.replace(/<path /g, '<path fill="#fff" ');
    svg = svg.replace(/viewBox="([^"]+)"/, (_, vb) => {
      const [x, y, w, h] = vb.split(" ").map(Number);
      const pad = Math.max(w, h) * 0.3;
      return `viewBox="${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}"`;
    });
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  } catch (err) {
    console.warn(`Macro Loader | Failed to fetch FA icon "${name}":`, err.message);
    return null;
  }
}

// ─── Self-Update ─────────────────────────────────────────────────────────────

async function selfUpdate(token) {
  try {
    const self = game.macros.find(m =>
      m.command?.includes(LOADER_FLAG) && m.author?.id === game.user.id
    );
    if (!self) return;

    const loaderImg = await resolveIcon(LOADER_ICON);
    if (loaderImg && self.img !== loaderImg) {
      await self.update({ img: loaderImg });
    }

    const apiUrl = buildApiUrl("github-loader-macro.js");
    const latest = await fetchFileContent(apiUrl, token);
    if (self.command.trim() === latest.trim()) {
      console.log("Macro Loader | Self-update: already up to date.");
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
    console.warn("Macro Loader | Self-update failed:", err.message);
  }
}

// ─── Plugin Manifests (Private Repos) ─────────────────────────────────────────

async function loadPluginManifests(mainToken) {
  const plugins = game[PLUGIN_KEY] ?? [];

  // On first run, offer to add a plugin
  if (!game[PLUGIN_KEY]) {
    game[PLUGIN_KEY] = [];
    const plugin = await promptPluginSetup();
    if (plugin) {
      game[PLUGIN_KEY].push(plugin);
      plugins.push(plugin);
    }
  }

  if (plugins.length === 0) return [];

  const loaded = [];
  for (const plugin of plugins) {
    try {
      const token = plugin.token ?? mainToken;
      const apiBase = `https://api.github.com/repos/${plugin.owner}/${plugin.repo}`;
      const branch = plugin.branch ?? "main";
      const manifestPath = plugin.manifestPath ?? "manifest.json";

      // Fetch plugin manifest
      const manifestUrl = `${apiBase}/contents/${manifestPath}?ref=${branch}`;
      const raw = await fetchFileContent(manifestUrl, token);
      const pluginManifest = JSON.parse(raw);

      // Tag each macro entry with plugin repo context for fetchFileContent
      for (const entry of pluginManifest.macros ?? []) {
        entry._pluginApiBase = apiBase;
        entry._pluginBranch = branch;
        entry._pluginToken = token;
        entry.id = `${plugin.owner}/${plugin.repo}:${entry.id}`;
      }

      // Fetch plugin file tree for SHA caching
      let pluginTree = null;
      try {
        const treeUrl = `${apiBase}/git/trees/${branch}?recursive=1&_=${Date.now()}`;
        const treeRes = await fetch(treeUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (treeRes.ok) {
          const treeData = await treeRes.json();
          pluginTree = {};
          for (const e of treeData.tree ?? []) {
            if (e.type === "blob") pluginTree[e.path] = e.sha;
          }
        }
      } catch (err) {
        console.warn(`Macro Loader | Plugin tree fetch failed for ${plugin.owner}/${plugin.repo}:`, err.message);
      }

      loaded.push({ manifest: pluginManifest, fileTree: pluginTree });
      console.log(`Macro Loader | Plugin ${plugin.owner}/${plugin.repo} loaded (${pluginManifest.macros?.length ?? 0} macros).`);
    } catch (err) {
      console.error(`Macro Loader | Plugin ${plugin.owner}/${plugin.repo} failed:`, err);
      ui.notifications.warn(`Plugin ${plugin.owner}/${plugin.repo} failed to load.`);
    }
  }

  return loaded;
}

async function promptPluginSetup() {
  return Dialog.prompt({
    title: "🔌 Plugin Macros (Optional)",
    content: `
      <p style="margin-bottom:8px;">Load macros from an additional private repo?
      Leave blank to skip.</p>
      <div style="display:grid; gap:6px;">
        <label style="font-size:12px;">Repo owner/name (e.g. <code>MyUser/fvtt-dev</code>)
          <input type="text" name="plugin-repo" style="width:100%" placeholder="owner/repo">
        </label>
        <label style="font-size:12px;">PAT for this repo (if different from main token)
          <input type="password" name="plugin-token" style="width:100%" placeholder="ghp_... (leave blank to reuse main token)">
        </label>
        <label style="font-size:12px;">Branch (default: main)
          <input type="text" name="plugin-branch" style="width:100%" placeholder="main">
        </label>
      </div>`,
    callback: html => {
      const repoStr = html.find("[name=plugin-repo]").val()?.trim();
      if (!repoStr || !repoStr.includes("/")) return null;
      const [owner, repo] = repoStr.split("/", 2);
      const token = html.find("[name=plugin-token]").val()?.trim() || null;
      const branch = html.find("[name=plugin-branch]").val()?.trim() || "main";
      return { owner, repo, token, branch };
    },
    rejectClose: false,
  });
}

// ─── GitHub API ──────────────────────────────────────────────────────────────

function buildApiUrl(path) {
  return `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`;
}

async function fetchFileTree(token) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1&_=${Date.now()}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  const tree = {};
  for (const entry of data.tree ?? []) {
    if (entry.type === "blob") tree[entry.path] = entry.sha;
  }
  return tree;
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
// END: GITHUB MACRO LOADER
