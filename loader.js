/**
 * FVTT MACRO LOADER
 *
 * Manifest-driven selective installer for Foundry VTT macros.
 * Fetched and executed by the bootstrap stub (github-loader-macro.js).
 *
 * Inspects the user's actor and installs only macros whose
 * prerequisites match the character. No authentication required.
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
const FA_SVG_BASE = "https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid";

await runLoader();

async function runLoader() {
  const startTime = Date.now();
  ui.notifications.info("🔄 Fetching macro manifest from GitHub...");

  // ── Step 1: Fetch the manifest ─────────────────────────────────────────────
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

  console.log(`Macro Loader | Manifest v${manifest.version} loaded with ${manifest.macros.length} macros.`);

  // ── Step 1a: Merge plugin macros (pre-loaded by bootstrap stub) ────────────
  const pluginData = game._ghLoaderPluginData;
  if (pluginData?.macros?.length) {
    manifest.macros.push(...pluginData.macros);
    console.log(`Macro Loader | ${pluginData.macros.length} plugin macro(s) merged.`);
  }

  // ── Step 1b: Fetch the repo tree for SHA-based caching ─────────────────────
  let fileTree = {};
  try {
    fileTree = await fetchFileTree();
    console.log(`Macro Loader | File tree loaded (${Object.keys(fileTree).length} files).`);
  } catch (err) {
    console.warn("Macro Loader | Tree fetch failed, all files will be re-fetched:", err.message);
  }

  // Merge plugin file tree
  if (pluginData?.fileTree) {
    Object.assign(fileTree, pluginData.fileTree);
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

// Hook macros: eval'd directly, no Macro document created (invisible in macro list)
async function loadHookMacro(entry, shaCache, fileTree) {
  const cached = shaCache[entry.id];
  const currentSha = fileTree[entry.path];
  const token = entry._token ?? null;

  // SHA cache hit — reuse previously fetched code from cache
  if (cached?.sha && currentSha && cached.sha === currentSha && cached.code) {
    return { code: cached.code, fetched: false };
  }

  // Fetch the macro source from GitHub
  const apiUrl = entry._apiUrl ?? buildApiUrl(entry.path);
  const code = await fetchFileContent(apiUrl, token);

  shaCache[entry.id] = { sha: currentSha ?? Date.now().toString(), code };
  console.log(`⚡ ${entry.name} fetched.`);
  return { code, fetched: true };
}

// Manual macros: created/updated as Foundry Macro documents (visible in macro list)
async function installMacroDocument(entry, shaCache, fileTree) {
  const cached = shaCache[entry.id];
  const currentSha = fileTree[entry.path];
  const token = entry._token ?? null;

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
  const apiUrl = entry._apiUrl ?? buildApiUrl(entry.path);
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