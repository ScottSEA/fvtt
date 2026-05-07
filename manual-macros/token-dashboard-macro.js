/**
 * TOKEN DASHBOARD MACRO
 *
 * Floating translucent overlay showing all tokens on the active scene.
 * Displays name, HP, AC, position, visibility, disposition, and conditions.
 * Updates live via updateToken / updateActor hooks.
 *
 * Run again to close the dashboard.
 */

const MACRO_ICON = "fa-table-cells";
const DASH_FLAG = "_tokenDashboard";

// Toggle off if already open
if (game[DASH_FLAG]?.container) {
  game[DASH_FLAG].teardown();
  delete game[DASH_FLAG];
  return;
}

// ─── Build & Mount ───────────────────────────────────────────────────────────

const container = document.createElement("div");
container.id = "token-dashboard";
container.innerHTML = `
  <div class="td-header">
    <span>🗺️ Token Dashboard</span>
    <button class="td-close" title="Close">✕</button>
  </div>
  <div class="td-body"><table>
    <thead><tr>
      <th>Name</th><th>HP</th><th>AC</th><th>Disp</th>
      <th>Vis</th><th>Conditions</th>
    </tr></thead>
    <tbody id="td-rows"></tbody>
  </table></div>`;

ensureStyles();
document.body.appendChild(container);

// Drag support
let dragging = false, dx = 0, dy = 0;
const header = container.querySelector(".td-header");
header.addEventListener("mousedown", e => {
  dragging = true;
  dx = e.clientX - container.offsetLeft;
  dy = e.clientY - container.offsetTop;
});
document.addEventListener("mousemove", e => {
  if (!dragging) return;
  container.style.left = (e.clientX - dx) + "px";
  container.style.top = (e.clientY - dy) + "px";
});
document.addEventListener("mouseup", () => dragging = false);

// Close button
container.querySelector(".td-close").addEventListener("click", () => {
  game[DASH_FLAG]?.teardown();
  delete game[DASH_FLAG];
});

// ─── Rendering ───────────────────────────────────────────────────────────────

function refresh() {
  const tbody = document.getElementById("td-rows");
  if (!tbody) return;

  const tokens = canvas.tokens?.placeables ?? [];
  const dispMap = { [-1]: {icon:"👹",tip:"Hostile"}, [0]: {icon:"😐",tip:"Neutral"}, [1]: {icon:"🟢",tip:"Friendly"} };

  tbody.innerHTML = tokens
    .sort((a, b) => (b.document?.disposition ?? 0) - (a.document?.disposition ?? 0) || a.name.localeCompare(b.name))
    .map(t => {
      const a = t.actor;
      const hp = a?.system?.attributes?.hp;
      const ac = a?.system?.attributes?.ac?.value;
      const hpStr = hp ? `${hp.value}/${hp.max}` : "?";
      const hpPct = hp?.max ? hp.value / hp.max : 1;
      const hpColor = hpPct > 0.5 ? "#4a4" : hpPct > 0.25 ? "#da3" : "#d44";
      const disp = dispMap[t.document?.disposition] ?? {icon:"?",tip:"Unknown"};
      const vis = t.document?.hidden ? "👁️‍🗨️" : "👁️";
      const visTip = t.document?.hidden ? "Hidden" : "Visible";
      const conds = [...(a?.statuses ?? [])].join(", ") || "—";
      return `<tr>
        <td class="td-name">${t.name}</td>
        <td style="color:${hpColor}">${hpStr}</td>
        <td>${ac ?? "?"}</td>
        <td title="${disp.tip}">${disp.icon}</td>
        <td title="${visTip}">${vis}</td>
        <td class="td-conds">${conds}</td>
      </tr>`;
    }).join("");
}

refresh();

// ─── Live Updates ────────────────────────────────────────────────────────────

const h1 = Hooks.on("updateToken", refresh);
const h2 = Hooks.on("updateActor", refresh);
const h3 = Hooks.on("createToken", refresh);
const h4 = Hooks.on("deleteToken", refresh);
const h5 = Hooks.on("canvasReady", refresh);

function teardown() {
  Hooks.off("updateToken", h1);
  Hooks.off("updateActor", h2);
  Hooks.off("createToken", h3);
  Hooks.off("deleteToken", h4);
  Hooks.off("canvasReady", h5);
  container.remove();
}

game[DASH_FLAG] = { container, teardown };

// ─── Styles ──────────────────────────────────────────────────────────────────

function ensureStyles() {
  if (document.getElementById("token-dashboard-style")) return;
  const s = document.createElement("style");
  s.id = "token-dashboard-style";
  s.innerHTML = `
    #token-dashboard {
      position: fixed; top: 60px; left: calc(100vw - 540px); z-index: 9999;
      background: rgba(0,0,0,0.01); backdrop-filter: blur(2px);
      border: 1px solid rgba(255,255,255,0.15); border-radius: 8px;
      color: #eee; font-size: 12px; min-width: 500px; max-height: 80vh;
      display: flex; flex-direction: column; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    .td-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 6px 12px; cursor: move; user-select: none;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      font-weight: bold; font-size: 13px;
    }
    .td-close {
      background: none; border: none; color: #aaa; cursor: pointer;
      font-size: 14px; padding: 0 4px; line-height: 1; width: auto; height: auto;
    }
    .td-close:hover { color: #fff; }
    .td-body { overflow-y: auto; padding: 4px 8px 8px; }
    #token-dashboard table { width: 100%; border-collapse: collapse; }
    #token-dashboard th {
      text-align: left; padding: 3px 6px; font-size: 10px;
      text-transform: uppercase; color: #888;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    #token-dashboard td { padding: 3px 6px; white-space: nowrap; }
    #token-dashboard tr:hover { background: rgba(255,255,255,0.05); }
    .td-name { font-weight: 600; color: #fff; }
    .td-conds { font-size: 11px; color: #aaa; max-width: 150px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `;
  document.head.appendChild(s);
}
// END: TOKEN DASHBOARD MACRO
