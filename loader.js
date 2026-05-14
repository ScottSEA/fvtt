/**
 * FVTT MACRO LOADER
 *
 * Manifest-driven selective installer for Foundry VTT macros.
 * Fetched and executed by the bootstrap stub (github-loader-macro.js).
 *
 * Inspects the user's actor and installs only macros whose
 * prerequisites match the character. No authentication required.
 * Ctrl+Shift activates dev mode for loading private repo macros.
 */

(async () => {

const REPO_OWNER = "ScottSEA";
const REPO_NAME = "fvtt";
const BRANCH = "main";
const MANIFEST_PATH = "manifest.json";

const LOADER_ICON = "fa-download";
const LOADER_FLAG = "_githubLoaderResults";
const SHA_CACHE_KEY = "_ghLoaderShaCache";
const ACTOR_KEY = "_ghLoaderActorId";
const PLUGIN_KEY = "_ghLoaderPlugins";
const FA_SVG_BASE = "https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid";

// Detect Ctrl+Shift at launch time for dev mode
const DEV_MODE = game.keyboard?.isModifierActive(KeyboardManager.MODIFIER_KEYS.CONTROL)
              && game.keyboard?.isModifierActive(KeyboardManager.MODIFIER_KEYS.SHIFT);

if (DEV_MODE) console.log("Macro Loader | Dev mode activated (Ctrl+Shift held).");

await runLoader();

async function runLoader() {
  const startTime = Date.now();

  // ── Step 1: Fetch the manifest ─────────────────────────────────────────────
  ui.notifications.info("📋 Fetching macro manifest from GitHub...");
  let manifest;
  try {
    const manifestUrl = buildApiUrl(MANIFEST_PATH);
    const raw = await fetchFileContent(manifestUrl);
    manifest = JSON.parse(raw);
  } catch (err) {
    ui.notifications.error(`Macro Loader: Failed to fetch manifest — ${err.message}`);
    console.error("Macro Loader | Manifest fetch failed:", err);
    return;
  }

  ui.notifications.info(`📋 Manifest loaded — ${manifest.macros.length} macros available.`);
  console.log(`Macro Loader | Manifest v${manifest.version} loaded with ${manifest.macros.length} macros.`);

  // ── Step 1a: Load plugin manifests (Ctrl+Shift only) ───────────────────────
  let plugins = [];
  if (DEV_MODE) {
    ui.notifications.info("🔧 Dev mode: loading plugin manifests...");
    plugins = await loadPluginManifests();
    if (plugins.length > 0) {
      let pluginMacroCount = 0;
      for (const plugin of plugins) {
        pluginMacroCount += plugin.manifest.macros.length;
        manifest.macros.push(...plugin.manifest.macros);
      }
      ui.notifications.info(`🔧 Loaded ${pluginMacroCount} dev macros from ${plugins.length} plugin(s).`);
      console.log(`Macro Loader | ${plugins.length} plugin(s) loaded with ${pluginMacroCount} additional macros.`);
    }
  }

  // ── Step 1b: Fetch the repo tree for SHA-based caching ─────────────────────
  ui.notifications.info("🌳 Checking file versions for changes...");
  let fileTree = {};
  try {
    fileTree = await fetchFileTree();
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
    ui.notifications.info(`🎭 Configuring macros for ${actor.name}.`);
    console.log(`Macro Loader | Actor: ${actor.name}`);
  } else {
    ui.notifications.info("🎭 No character found — installing utility macros only.");
    console.log("Macro Loader | No actor selected — installing only macros with no prerequisites.");
  }

  // ── Step 3: Build actor profile for prerequisite matching ──────────────────
  const profile = actor ? buildActorProfile(actor) : null;
  if (profile) {
    const classStr = profile.classes.map(c => `${c.name} ${c.level}`).join(", ") || "none";
    const featCount = profile.feats.length;
    const itemCount = profile.items.length;
    ui.notifications.info(`📊 ${actor.name}: ${classStr} | ${featCount} feats | ${itemCount} items`);
    console.log("Macro Loader | Actor profile:", profile);
  }

  // ── Step 4: Filter macros by prerequisites ─────────────────────────────────
  const matched = [];
  const skippedPrereqs = [];

  for (const entry of manifest.macros) {
    const reason = getUnmetPrerequisite(entry.requires, profile);
    if (!reason) {
      matched.push(entry);
    } else {
      skippedPrereqs.push({ name: entry.name, reason });
    }
  }

  const hookCount = matched.filter(m => m.autoExecute).length;
  const manualCount = matched.filter(m => !m.autoExecute).length;
  ui.notifications.info(`✅ ${matched.length} macros match (${hookCount} hooks, ${manualCount} clickable).`);
  if (skippedPrereqs.length > 0) {
    // Group skipped macros by reason for cleaner display
    const byReason = {};
    for (const s of skippedPrereqs) {
      (byReason[s.reason] ??= []).push(s.name);
    }
    for (const [reason, names] of Object.entries(byReason)) {
      ui.notifications.info(`⏭️ Skipped (${reason}): ${names.join(", ")}`);
    }
  }
  console.log(`Macro Loader | ${matched.length} macros match prerequisites, ${skippedPrereqs.length} skipped.`);

  // ── Step 5: Dependency-sort matched macros ─────────────────────────────────
  const sorted = topologicalSort(matched);

  // ── Step 6: Install and execute macros ─────────────────────────────────────
  ui.notifications.info("⚙️ Installing and activating macros...");
  const results = { installed: [], updated: [], cached: [], executed: [], failed: [] };
  const shaCache = game[SHA_CACHE_KEY] ?? {};

  for (const entry of sorted) {
    try {
      if (entry.autoExecute) {
        // Hook macros: eval directly, no Macro document (invisible)
        const result = await loadHookMacro(entry, shaCache, fileTree);
        if (result.fetched) {
          results.installed.push(entry.name);
        } else {
          results.cached.push(entry.name);
        }
        try {
          eval.call(globalThis, result.code);
          results.executed.push(entry.name);
        } catch (execErr) {
          console.error(`Macro Loader | ❌ Execute failed for ${entry.name}:`, execErr);
          results.failed.push(`${entry.name} (exec)`);
        }
      } else {
        // Manual macros: create/update Macro document (visible in macro list)
        const result = await installMacroDocument(entry, shaCache, fileTree);
        results[result.status].push(entry.name);
      }
    } catch (err) {
      results.failed.push(entry.name);
      console.error(`Macro Loader | ❌ ${entry.name} failed:`, err);
    }
  }

  game[SHA_CACHE_KEY] = shaCache;

  // ── Step 7: Report results ─────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const newCount = results.installed.length;
  const updCount = results.updated.length;
  const cachedCount = results.cached.length;
  const execCount = results.executed.length;
  const failCount = results.failed.length;

  // Detailed breakdown
  if (newCount > 0) ui.notifications.info(`📥 ${newCount} new: ${results.installed.join(", ")}`);
  if (updCount > 0) ui.notifications.info(`🔄 ${updCount} updated: ${results.updated.join(", ")}`);
  if (execCount > 0) ui.notifications.info(`⚡ ${execCount} hooks activated.`);
  if (failCount > 0) ui.notifications.warn(`❌ ${failCount} failed: ${results.failed.join(", ")}`);

  // Final summary
  const actorInfo = actor ? ` for ${actor.name}` : "";
  const parts = [];
  if (newCount > 0) parts.push(`${newCount} new`);
  if (updCount > 0) parts.push(`${updCount} updated`);
  if (cachedCount > 0) parts.push(`${cachedCount} cached`);
  if (execCount > 0) parts.push(`${execCount} hooks active`);
  if (failCount > 0) parts.push(`${failCount} failed`);

  ui.notifications.info(`🎲 Done! ${parts.join(" | ")}${actorInfo} (${elapsed}s)`);

  game[LOADER_FLAG] = { ...results, actorName: actor?.name, timestamp: Date.now() };

  // ── Set loader icon ────────────────────────────────────────────────────────
  try {
    const self = game.macros.find(m =>
      m.command?.includes("BOOTSTRAP STUB") && m.author?.id === game.user.id
    );
    if (self) {
      const img = await resolveIcon(LOADER_ICON);
      if (img && self.img !== img) await self.update({ img });
    }
  } catch (err) { /* non-critical */ }
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

// Returns null if all prerequisites met, or a human-readable reason string if not.
function getUnmetPrerequisite(requires, profile) {
  if (!requires || Object.keys(requires).length === 0) return null;
  if (!profile) return "no character";

  if (requires.class) {
    const target = requires.class.toLowerCase();
    const hasClass = profile.classes.some(c =>
      c.identifier === target || c.name === target
    );
    if (!hasClass) return `not a ${requires.class}`;
  }

  if (requires.subclass) {
    const target = requires.subclass.toLowerCase();
    const hasSub = profile.subclasses.some(s =>
      s.identifier === target
      || s.name === target
      || s.name?.includes(target)
    );
    if (!hasSub) return `no ${requires.subclass} subclass`;
  }

  if (requires.minLevel) {
    const target = requires.class?.toLowerCase();
    const classInfo = target
      ? profile.classes.find(c => c.identifier === target || c.name === target)
      : profile.classes[0];
    if (!classInfo || classInfo.level < requires.minLevel) return `level ${classInfo?.level ?? 0} < ${requires.minLevel}`;
  }

  if (requires.feat) {
    const hasFeat = profile.feats.some(f =>
      f.toLowerCase() === requires.feat.toLowerCase()
    );
    if (!hasFeat) return `no "${requires.feat}" feat`;
  }

  if (requires.item) {
    const target = requires.item.toLowerCase();
    const hasItem = profile.items.some(i =>
      i.toLowerCase().includes(target)
    );
    if (!hasItem) return `no "${requires.item}" item`;
  }

  if (requires.race) {
    if (!profile.race) return `no race data`;
    const hasRace = profile.race.toLowerCase().includes(requires.race.toLowerCase());
    if (!hasRace) return `not ${requires.race}`;
  }

  if (requires.spell) {
    const hasSpell = profile.spells.some(s =>
      s.toLowerCase() === requires.spell.toLowerCase()
    );
    if (!hasSpell) return `no "${requires.spell}" spell`;
  }

  return null;
}

function meetsPrerequisites(requires, profile) {
  return getUnmetPrerequisite(requires, profile) === null;
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

// Hook macros: eval'd directly, no Macro document created (invisible in macro list)
async function loadHookMacro(entry, shaCache, fileTree) {
  const cached = shaCache[entry.id];
  const currentSha = fileTree[entry.path];
  const token = entry._pluginToken ?? null;

  // SHA cache hit — reuse previously fetched code from cache
  if (cached?.sha && currentSha && cached.sha === currentSha && cached.code) {
    return { code: cached.code, fetched: false };
  }

  // Fetch the macro source from GitHub
  const apiUrl = entry._pluginApiBase
    ? `${entry._pluginApiBase}/contents/${entry.path}?ref=${entry._pluginBranch ?? "main"}`
    : buildApiUrl(entry.path);
  const code = await fetchFileContent(apiUrl, token);

  shaCache[entry.id] = { sha: currentSha ?? Date.now().toString(), code };
  console.log(`⚡ ${entry.name} fetched.`);
  return { code, fetched: true };
}

// Manual macros: created/updated as Foundry Macro documents (visible in macro list)
async function installMacroDocument(entry, shaCache, fileTree) {
  const cached = shaCache[entry.id];
  const currentSha = fileTree[entry.path];
  const token = entry._pluginToken ?? null;

  // SHA cache hit — check if Macro document already exists
  if (cached?.sha && currentSha && cached.sha === currentSha) {
    const existing = game.macros.find(m =>
      m.name === entry.name && m.author?.id === game.user.id
    );
    if (existing) {
      return { status: "cached" };
    }
  }

  // Fetch the macro source from GitHub
  const apiUrl = entry._pluginApiBase
    ? `${entry._pluginApiBase}/contents/${entry.path}?ref=${entry._pluginBranch ?? "main"}`
    : buildApiUrl(entry.path);
  const code = await fetchFileContent(apiUrl, token);

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
    return { status: "updated" };
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
  return { status: "installed" };
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

// ─── Plugin Manifests (Private Repos) ─────────────────────────────────────────

async function loadPluginManifests() {
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

  if (plugins.length === 0) return [];

  const loaded = [];
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

// ─── GitHub API ──────────────────────────────────────────────────────────────

function buildApiUrl(path) {
  return `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${BRANCH}`;
}

async function fetchFileTree(token) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/git/trees/${BRANCH}?recursive=1&_=${Date.now()}`;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { headers });
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
  const headers = { Accept: "application/vnd.github.v3.raw" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(apiUrl + cacheBust, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.text();
}

})(); // END: GITHUB MACRO LOADER