/**
 * ICON BROWSER MACRO
 *
 * Crawls all Foundry icon directories and displays a visual grid.
 * Sections are collapsible and load icons asynchronously.
 * Click any icon to copy its path to clipboard.
 * Run again to browse again.
 */

const ICON_BROWSER_FLAG = "_iconBrowserOpen";

if (game[ICON_BROWSER_FLAG]) {
  ui.notifications.info("Icon Browser already running.");
  return;
}
game[ICON_BROWSER_FLAG] = true;

ui.notifications.info("🔍 Scanning icon folders...");

// First pass: get all directories
async function getDirs(path = "icons", dirs = []) {
  const r = await FilePicker.browse("public", path);
  for (const d of r.dirs) {
    dirs.push(d);
    await getDirs(d, dirs);
  }
  return dirs;
}

getDirs().then(dirs => {
  const sections = dirs.map(d =>
    `<details class="ib-section" open>
      <summary class="ib-folder">${d} <span class="ib-spinner">⏳</span></summary>
      <div class="ib-grid" data-folder="${d}"></div>
    </details>`
  ).join("");

  const style = `<style>
    .ib-section { margin: 2px 0; }
    .ib-folder { cursor: pointer; font-size: 12px; color: #888; padding: 2px 0;
      border-bottom: 1px solid #444; user-select: none; }
    .ib-folder:hover { color: #fff; }
    .ib-grid { display: flex; flex-wrap: wrap; padding: 4px 0; }
    .ib-grid img { width: 36px; height: 36px; margin: 1px; cursor: pointer; }
    .ib-grid img:hover { outline: 2px solid #ff0; }
    .ib-spinner { font-size: 10px; }
    .ib-loaded .ib-spinner { display: none; }
    .ib-search-wrap { margin-bottom: 6px; }
    .ib-search { width: 100%; padding: 4px 8px; font-size: 12px; box-sizing: border-box; }
  </style>`;

  const d = new Dialog({
    title: `🎨 Icon Browser (${dirs.length} folders)`,
    content: `${style}
      <div class="ib-search-wrap">
        <input type="text" class="ib-search" placeholder="Filter icons... (ESC to clear)">
      </div>
      <div class="ib-results" style="display:none;max-height:60vh;overflow:auto"></div>
      <div class="ib-browse" style="max-height:70vh;overflow:auto">${sections}</div>`,
    buttons: {},
    default: "ok",
    close: () => { delete game[ICON_BROWSER_FLAG]; },
  }, { width: 800 });
  d.render(true);

  // Lazy-load icons when a section is expanded
  Hooks.once("renderDialog", (app, html) => {
    if (app !== d) return;
    const el = html instanceof HTMLElement ? html : html[0] ?? html;

    // Toggle handler for lazy loading
    el.querySelectorAll("details.ib-section").forEach(det => {
      det.addEventListener("toggle", async () => {
        if (!det.open) return;
        await loadFolder(det);
      });
    });

    // Search handler
    let searchTimer;
    const searchInput = el.querySelector(".ib-search");
    const browseDiv = el.querySelector(".ib-browse");
    const resultsDiv = el.querySelector(".ib-results");

    function clearSearch() {
      searchInput.value = "";
      browseDiv.style.display = "";
      resultsDiv.style.display = "none";
      searchInput.focus();
    }

    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runSearch(searchInput.value.trim().toLowerCase(), el, browseDiv, resultsDiv), 300);
    });

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); clearSearch(); }
    });
  });

  async function loadFolder(det) {
    const grid = det.querySelector(".ib-grid");
    if (grid.dataset.loaded) return;
    const folder = grid.dataset.folder;
    const r = await FilePicker.browse("public", folder);
    const files = r.files.filter(f => /\.(svg|png|webp|jpg)$/i.test(f));
    grid.innerHTML = files.map(f =>
      `<img src="${f}" title="${f}" data-path="${f}" loading="lazy" onclick="navigator.clipboard.writeText('${f}');ui.notifications.info('Copied: ${f.replace(/'/g, "")}')">`
    ).join("") || "<em style='color:#666;padding:4px'>No icons</em>";
    grid.dataset.loaded = "true";
    det.querySelector(".ib-folder").classList.add("ib-loaded");
  }

  async function runSearch(query, el, browseDiv, resultsDiv) {
    if (!query) {
      browseDiv.style.display = "";
      resultsDiv.style.display = "none";
      return;
    }

    browseDiv.style.display = "none";
    resultsDiv.style.display = "";
    resultsDiv.innerHTML = "<em style='color:#888'>Searching...</em>";

    // Load all unloaded folders that match the query by folder name
    const allSections = el.querySelectorAll("details.ib-section");
    for (const det of allSections) {
      const grid = det.querySelector(".ib-grid");
      if (!grid.dataset.loaded) await loadFolder(det);
    }

    // Search all loaded images, group by folder
    const grouped = {};
    el.querySelectorAll(".ib-grid img").forEach(img => {
      const path = img.dataset.path || img.title || "";
      if (!path.toLowerCase().includes(query)) return;
      const folder = path.substring(0, path.lastIndexOf("/"));
      if (!grouped[folder]) grouped[folder] = [];
      grouped[folder].push(path);
    });

    const totalMatches = Object.values(grouped).reduce((n, arr) => n + arr.length, 0);

    resultsDiv.innerHTML = totalMatches > 0
      ? `<p style="color:#888;font-size:11px;margin:0 0 4px">${totalMatches} results for "${query}"</p>` +
        Object.entries(grouped).map(([folder, files]) =>
          `<details class="ib-section" open>
            <summary class="ib-folder ib-loaded">${folder} (${files.length})</summary>
            <div class="ib-grid">${files.map(f =>
              `<img src="${f}" title="${f}" loading="lazy" style="width:36px;height:36px;margin:1px;cursor:pointer" onclick="navigator.clipboard.writeText('${f}');ui.notifications.info('Copied: ${f.replace(/'/g, "")}')">`
            ).join("")}</div>
          </details>`
        ).join("")
      : `<em style="color:#666">No matches for "${query}"</em>`;
  }
});
// END: ICON BROWSER MACRO
