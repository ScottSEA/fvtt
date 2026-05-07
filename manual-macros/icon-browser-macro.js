/**
 * ICON BROWSER MACRO
 *
 * Crawls all Foundry icon directories and displays a visual grid.
 * Click any icon to copy its path to clipboard.
 * Run again to browse again.
 */

async function crawl(path = "icons", imgs = []) {
  const r = await FilePicker.browse("public", path);
  imgs.push(...r.files.filter(f => /\.(svg|png|webp|jpg)$/i.test(f)));
  for (const d of r.dirs) await crawl(d, imgs);
  return imgs;
}

ui.notifications.info("🔍 Crawling icons...");

crawl().then(imgs => {
  const h = imgs.map(f =>
    `<img src="${f}" title="${f}" style="width:36px;height:36px;margin:1px;cursor:pointer" onclick="navigator.clipboard.writeText('${f}');ui.notifications.info('Copied: ${f.replace(/'/g, '')}')">`
  ).join("");

  new Dialog({
    title: `🎨 ${imgs.length} Icons (click to copy path)`,
    content: `<div style="display:flex;flex-wrap:wrap;max-height:70vh;overflow:auto">${h}</div>`,
    buttons: { ok: { label: "Close" } },
    default: "ok",
  }, { width: 800 }).render(true);
});
// END: ICON BROWSER MACRO
