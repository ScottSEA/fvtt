/**
 * LOOT ROLLER MACRO
 *
 * Shows a dialog with CR range and treasure type selection. Rolls on
 * simplified treasure tables and posts results to chat.
 */

const MACRO_ICON = "fa-coins";

(async () => {
  const content = `
<div style="display:flex;flex-direction:column;gap:8px;padding:4px 0;">
  <div>
    <label style="font-weight:bold;color:#ddd;font-size:13px;">Challenge Rating</label>
    <select id="loot-cr" style="width:100%;padding:4px 6px;border:1px solid #555;border-radius:4px;background:#2a2a2a;color:#eee;">
      <option value="0-4">CR 0\u20134</option>
      <option value="5-10">CR 5\u201310</option>
      <option value="11-16">CR 11\u201316</option>
      <option value="17+">CR 17+</option>
    </select>
  </div>
  <div>
    <label style="font-weight:bold;color:#ddd;font-size:13px;">Treasure Type</label>
    <select id="loot-type" style="width:100%;padding:4px 6px;border:1px solid #555;border-radius:4px;background:#2a2a2a;color:#eee;">
      <option value="individual">Individual</option>
      <option value="hoard">Hoard</option>
    </select>
  </div>
</div>`;

  new Dialog({
    title: "Loot Roller",
    content,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice"></i>',
        label: "Roll Treasure",
        callback: (html) => {
          const cr = (html.find ? html.find("#loot-cr") : html[0]?.querySelector("#loot-cr")).value;
          const type = (html.find ? html.find("#loot-type") : html[0]?.querySelector("#loot-type")).value;
          rollTreasure(cr, type);
        },
      },
    },
    default: "roll",
  }).render(true);
})();

// ─── Treasure Tables ──────────────────────────────────────────────────────────

function rollDice(formula) {
  const match = formula.match(/^(\d+)d(\d+)(?:\s*[x*×]\s*(\d+))?$/i);
  if (!match) return parseInt(formula) || 0;
  const [, count, sides, mult] = match;
  let total = 0;
  for (let i = 0; i < parseInt(count); i++) {
    total += Math.floor(Math.random() * parseInt(sides)) + 1;
  }
  return total * (parseInt(mult) || 1);
}

function rollTreasure(cr, type) {
  const coins = rollCoins(cr, type);
  const extras = type === "hoard" ? rollExtras(cr) : [];

  let linesHtml = "";
  const coinEntries = [];
  if (coins.cp) coinEntries.push(`${coins.cp} cp`);
  if (coins.sp) coinEntries.push(`${coins.sp} sp`);
  if (coins.gp) coinEntries.push(`${coins.gp} gp`);
  if (coins.pp) coinEntries.push(`${coins.pp} pp`);

  if (coinEntries.length > 0) {
    linesHtml += `<li>💰 <strong>Coins:</strong> ${coinEntries.join(", ")}</li>`;
  }

  for (const extra of extras) {
    linesHtml += `<li>💎 <strong>${extra.type}:</strong> ${extra.description}</li>`;
  }

  if (!linesHtml) linesHtml = "<li>Nothing of value found.</li>";

  const label = type === "individual" ? "Individual Treasure" : "Treasure Hoard";
  const content = `
<div style="border:1px solid #4b4a44;border-radius:6px;padding:8px 10px;background:#1a1a1a;color:#ddd;font-size:13px;">
  <div style="font-size:15px;font-weight:bold;margin-bottom:6px;color:#f0c674;">
    <i class="fas fa-coins" style="margin-right:4px;"></i> ${label} (${formatCR(cr)})
  </div>
  <ul style="list-style:none;padding:0;margin:0;">${linesHtml}</ul>
</div>`;

  ChatMessage.create({
    content,
    speaker: { alias: "Loot Roller" },
  });
}

function formatCR(cr) {
  return cr === "17+" ? "CR 17+" : `CR ${cr}`;
}

function rollCoins(cr, type) {
  if (type === "individual") {
    switch (cr) {
      case "0-4":
        return { cp: rollDice("5d6"), sp: rollDice("3d6"), gp: 0, pp: 0 };
      case "5-10":
        return { cp: rollDice("4d6x100"), sp: rollDice("6d6x10"), gp: rollDice("2d6x10"), pp: 0 };
      case "11-16":
        return { cp: 0, sp: rollDice("4d6x100"), gp: rollDice("1d6x100"), pp: rollDice("1d6x10") };
      case "17+":
        return { cp: 0, sp: 0, gp: rollDice("2d6x1000"), pp: rollDice("8d6x100") };
    }
  } else {
    switch (cr) {
      case "0-4":
        return { cp: rollDice("6d6x100"), sp: rollDice("3d6x100"), gp: rollDice("2d6x10"), pp: 0 };
      case "5-10":
        return { cp: rollDice("2d6x100"), sp: rollDice("2d6x1000"), gp: rollDice("6d6x100"), pp: rollDice("3d6x10") };
      case "11-16":
        return { cp: 0, sp: 0, gp: rollDice("4d6x1000"), pp: rollDice("5d6x100") };
      case "17+":
        return { cp: 0, sp: 0, gp: rollDice("12d6x1000"), pp: rollDice("8d6x1000") };
    }
  }
  return { cp: 0, sp: 0, gp: 0, pp: 0 };
}

function rollExtras(cr) {
  const extras = [];
  const gems10 = ["Azurite", "Banded Agate", "Blue Quartz", "Eye Agate", "Hematite", "Lapis Lazuli", "Malachite", "Moss Agate", "Obsidian", "Tiger Eye"];
  const gems50 = ["Bloodstone", "Carnelian", "Chalcedony", "Chrysoprase", "Citrine", "Jasper", "Moonstone", "Onyx", "Quartz", "Sardonyx", "Star Rose Quartz", "Zircon"];
  const gems100 = ["Amber", "Amethyst", "Chrysoberyl", "Coral", "Garnet", "Jade", "Jet", "Pearl", "Spinel", "Tourmaline"];
  const gems500 = ["Alexandrite", "Aquamarine", "Black Pearl", "Blue Spinel", "Peridot", "Topaz"];
  const art25 = ["Silver ewer", "Carved bone statuette", "Small gold bracelet", "Cloth-of-gold vestments", "Black velvet mask"];
  const art250 = ["Gold ring with bloodstone", "Carved ivory statuette", "Gold and silver bracelet", "Bronze crown", "Silk robe with gold embroidery"];
  const art750 = ["Silver chalice with moonstones", "Gold and silver brooch", "Obsidian statuette with gold fittings", "Painted gold war mask"];
  const art2500 = ["Fine gold chain with fire opal", "Old masterpiece painting", "Embroidered silk and velvet mantle with moonstones", "Platinum bracelet with sapphire"];

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  switch (cr) {
    case "0-4": {
      const count = rollDice("2d6");
      extras.push({ type: "Gems (10 gp each)", description: `${count}× ${pick(gems10)}` });
      break;
    }
    case "5-10": {
      const count = rollDice("3d6");
      extras.push({ type: "Gems (50 gp each)", description: `${count}× ${pick(gems50)}` });
      const artCount = rollDice("2d4");
      extras.push({ type: "Art Objects (25 gp each)", description: `${artCount}× ${pick(art25)}` });
      break;
    }
    case "11-16": {
      const count = rollDice("3d6");
      extras.push({ type: "Gems (100 gp each)", description: `${count}× ${pick(gems100)}` });
      const artCount = rollDice("2d4");
      extras.push({ type: "Art Objects (250 gp each)", description: `${artCount}× ${pick(art250)}` });
      break;
    }
    case "17+": {
      const count = rollDice("3d6");
      extras.push({ type: "Gems (500 gp each)", description: `${count}× ${pick(gems500)}` });
      const artCount = rollDice("1d10");
      extras.push({ type: "Art Objects (750 gp each)", description: `${artCount}× ${pick(art750)}` });
      const art2Count = rollDice("1d4");
      extras.push({ type: "Art Objects (2500 gp each)", description: `${art2Count}× ${pick(art2500)}` });
      break;
    }
  }
  return extras;
}
// END: LOOT ROLLER MACRO
