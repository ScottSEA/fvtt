/**
 * CONDITION REFERENCE MACRO
 *
 * Shows a searchable dialog with all standard 5e conditions and their
 * effects. Type to filter conditions in real time.
 */

const MACRO_ICON = "fa-book-medical";

(async () => {
  const conditions = [
    { name: "Blinded", effect: "Can't see. Auto-fail sight checks. Attacks have disadvantage. Attacks against have advantage." },
    { name: "Charmed", effect: "Can't attack charmer. Charmer has advantage on social checks." },
    { name: "Deafened", effect: "Can't hear. Auto-fail hearing checks." },
    { name: "Exhaustion", effect: "Levels 1\u20136 with increasing penalties. Level 6 = death." },
    { name: "Frightened", effect: "Disadvantage on checks/attacks while source is in sight. Can't willingly move closer." },
    { name: "Grappled", effect: "Speed becomes 0. Ends if grappler is incapacitated or moved out of reach." },
    { name: "Incapacitated", effect: "Can't take actions or reactions." },
    { name: "Invisible", effect: "Impossible to see without magic. Attacks have advantage. Attacks against have disadvantage." },
    { name: "Paralyzed", effect: "Incapacitated, can't move or speak. Auto-fail STR/DEX saves. Attacks have advantage. Hits within 5ft are crits." },
    { name: "Petrified", effect: "Turned to stone. Weight \u00d710. Immune to poison/disease. Resistance to all damage." },
    { name: "Poisoned", effect: "Disadvantage on attack rolls and ability checks." },
    { name: "Prone", effect: "Disadvantage on attacks. Attacks within 5ft have advantage, beyond have disadvantage. Must use half movement to stand." },
    { name: "Restrained", effect: "Speed 0. Attacks have disadvantage. Attacks against have advantage. Disadvantage on DEX saves." },
    { name: "Stunned", effect: "Incapacitated, can't move, can only speak falteringly. Auto-fail STR/DEX saves. Attacks have advantage." },
    { name: "Unconscious", effect: "Incapacitated, can't move or speak. Drop what you're holding, fall prone. Auto-fail STR/DEX saves. Attacks have advantage. Hits within 5ft are crits." },
  ];

  const conditionListHtml = conditions
    .map(
      (c) =>
        `<div class="cond-item" data-name="${c.name.toLowerCase()}" style="border-bottom:1px solid #3a3a3a;padding:6px 4px;">
          <strong style="color:#f0c674;font-size:13px;">${c.name}</strong>
          <div style="color:#bbb;font-size:12px;margin-top:2px;">${c.effect}</div>
        </div>`
    )
    .join("");

  const content = `
<div style="display:flex;flex-direction:column;gap:6px;">
  <input type="text" id="cond-search" placeholder="Search conditions\u2026"
    style="width:100%;padding:6px 8px;border:1px solid #555;border-radius:4px;
           background:#2a2a2a;color:#eee;font-size:13px;box-sizing:border-box;" />
  <div id="cond-list" style="max-height:360px;overflow-y:auto;border:1px solid #4b4a44;
       border-radius:4px;background:#1a1a1a;padding:4px;">
    ${conditionListHtml}
  </div>
</div>`;

  const d = new Dialog({
    title: "Condition Reference",
    content,
    buttons: {
      close: { icon: '<i class="fas fa-times"></i>', label: "Close" },
    },
    default: "close",
    render: (html) => {
      const searchInput = html.find("#cond-search")[0] || html[0]?.querySelector("#cond-search");
      if (!searchInput) return;
      searchInput.focus();
      searchInput.addEventListener("input", () => {
        const filter = searchInput.value.toLowerCase();
        const container = html.find ? html.find("#cond-list")[0] : html[0]?.querySelector("#cond-list");
        if (!container) return;
        for (const item of container.querySelectorAll(".cond-item")) {
          const name = item.dataset.name;
          item.style.display = name.includes(filter) ? "" : "none";
        }
      });
    },
  },
  { width: 420 }).render(true);
})();
// END: CONDITION REFERENCE MACRO
