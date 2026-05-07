/**
 * ICON BROWSER MACRO
 *
 * Crawls all Foundry icon directories and displays a visual grid.
 * Click any icon to copy its path to clipboard.
 * Run again to browse again.
 */

async function crawl(path = "icons", result = {}) {
  const r = await FilePicker.browse("public", path);
  const files = r.files.filter(f => /\.(svg|png|webp|jpg)$/i.test(f));
  if (files.length > 0) result[path] = files;
  for (const d of r.dirs) await crawl(d, result);
  return result;
}

ui.notifications.info("🔍 Crawling icons...");

crawl().then(groups => {
  const totalCount = Object.values(groups).reduce((n, f) => n + f.length, 0);
  const h = Object.entries(groups).map(([folder, files]) => {
    const imgs = files.map(f =>
      `<img src="${f}" title="${f}" style="width:36px;height:36px;margin:1px;cursor:pointer" onclick="navigator.clipboard.writeText('${f}');ui.notifications.info('Copied: ${f.replace(/'/g, "")}')">`
    ).join("");
    return `<h3 style="width:100%;margin:8px 0 2px;font-size:12px;color:#888;border-bottom:1px solid #444">${folder}</h3>${imgs}`;
  }).join("");

  new Dialog({
    title: `🎨 ${totalCount} Icons (click to copy path)`,
    content: `<div style="display:flex;flex-wrap:wrap;max-height:70vh;overflow:auto">${h}</div>`,
    buttons: { ok: { label: "Close" } },
    default: "ok",
  }, { width: 800 }).render(true);
});
// END: ICON BROWSER MACRO
