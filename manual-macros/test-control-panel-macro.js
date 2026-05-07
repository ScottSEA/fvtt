/**
 * TEST CONTROL PANEL MACRO
 *
 * Toggle test flags for macros that support them. All flags default
 * to off — macros behave normally unless you explicitly enable flags.
 * Close the panel or toggle off to return to normal behavior.
 *
 * Currently supports: Bloodshed Blade Rune
 */

const MACRO_ICON = "fa-flask-vial";
const TCP_FLAG = "_testControlPanel";

// Initialize test objects if missing
if (!game._bloodshedTest) game._bloodshedTest = {};

const flags = [
  { obj: "_bloodshedTest", key: "allFlags",      label: "🔓 All Flags (master override)", group: "Bloodshed Blade" },
  { obj: "_bloodshedTest", key: "forceCrit",      label: "💥 Force Critical Hit",          group: "Bloodshed Blade" },
  { obj: "_bloodshedTest", key: "skipRuneCheck",  label: "🔮 Skip Rune Expended Check",   group: "Bloodshed Blade" },
  { obj: "_bloodshedTest", key: "skipHdCheck",    label: "🎲 Skip Hit Dice Check",         group: "Bloodshed Blade" },
];

function buildContent() {
  const groups = {};
  for (const f of flags) {
    if (!groups[f.group]) groups[f.group] = [];
    groups[f.group].push(f);
  }

  let html = `<style>
    .tcp-group { margin: 0 0 8px; }
    .tcp-group-title { font-weight: bold; font-size: 13px; margin: 0 0 4px; color: #cc6600; border-bottom: 1px solid #444; padding-bottom: 2px; }
    .tcp-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
    .tcp-row label { cursor: pointer; flex: 1; font-size: 12px; }
    .tcp-status { font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 3px; }
    .tcp-on { background: #2e6b30; color: #fff; }
    .tcp-off { background: #444; color: #aaa; }
  </style>`;

  for (const [group, items] of Object.entries(groups)) {
    html += `<div class="tcp-group"><div class="tcp-group-title">${group}</div>`;
    for (const f of items) {
      const val = !!game[f.obj]?.[f.key];
      const statusClass = val ? "tcp-on" : "tcp-off";
      const statusText = val ? "ON" : "OFF";
      html += `<div class="tcp-row">
        <input type="checkbox" name="${f.obj}.${f.key}" ${val ? "checked" : ""}>
        <label>${f.label}</label>
        <span class="tcp-status ${statusClass}">${statusText}</span>
      </div>`;
    }
    html += `</div>`;
  }
  return html;
}

function applyFlags(html) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  for (const f of flags) {
    const input = el.querySelector(`[name="${f.obj}.${f.key}"]`);
    if (!input) continue;
    if (!game[f.obj]) game[f.obj] = {};
    game[f.obj][f.key] = input.checked;
  }
}

function resetAll() {
  for (const f of flags) {
    if (game[f.obj]) game[f.obj][f.key] = false;
  }
}

const d = new Dialog({
  title: "🧪 Test Control Panel",
  content: buildContent(),
  buttons: {
    apply: {
      icon: '<i class="fas fa-check"></i>',
      label: "Apply",
      callback: (html) => {
        applyFlags(html);
        const active = flags.filter(f => game[f.obj]?.[f.key]);
        if (active.length > 0) {
          ui.notifications.warn(`🧪 Testing: ${active.length} flag${active.length !== 1 ? "s" : ""} active`);
        } else {
          ui.notifications.info("🧪 All test flags off — normal behavior.");
        }
      },
    },
    reset: {
      icon: '<i class="fas fa-undo"></i>',
      label: "Reset All",
      callback: () => {
        resetAll();
        ui.notifications.info("🧪 All test flags reset — normal behavior.");
      },
    },
  },
  default: "apply",
}, { width: 400 });
d.render(true);
// END: TEST CONTROL PANEL MACRO
