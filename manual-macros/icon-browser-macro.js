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
    `<details class="ib-section">
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
  </style>`;

  const d = new Dialog({
    title: `🎨 Icon Browser (${dirs.length} folders)`,
    content: `${style}<div style="max-height:70vh;overflow:auto">${sections}</div>`,
    buttons: { ok: { label: "Close" } },
    default: "ok",
    close: () => { delete game[ICON_BROWSER_FLAG]; },
  }, { width: 800 });
  d.render(true);

  // Lazy-load icons when a section is expanded
  Hooks.once("renderDialog", (app, html) => {
    if (app !== d) return;
    const el = html instanceof HTMLElement ? html : html[0] ?? html;
    el.querySelectorAll("details.ib-section").forEach(det => {
      det.addEventListener("toggle", async () => {
        if (!det.open) return;
        const grid = det.querySelector(".ib-grid");
        if (grid.children.length > 0) return;
        const folder = grid.dataset.folder;
        const r = await FilePicker.browse("public", folder);
        const files = r.files.filter(f => /\.(svg|png|webp|jpg)$/i.test(f));
        grid.innerHTML = files.map(f =>
          `<img src="${f}" title="${f}" loading="lazy" onclick="navigator.clipboard.writeText('${f}');ui.notifications.info('Copied: ${f.replace(/'/g, "")}')">`
        ).join("") || "<em style='color:#666;padding:4px'>No icons</em>";
        det.querySelector(".ib-folder").classList.add("ib-loaded");
      });
    });
  });
});
// END: ICON BROWSER MACRO
