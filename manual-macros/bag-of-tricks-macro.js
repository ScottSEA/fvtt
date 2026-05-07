/**
 * BAG OF TRICKS THREE-FER MACRO
 *
 * Rolls all available creatures from the Tan Bag of Tricks at once and
 * posts a stat card for each as a GM-only whisper message. A public
 * summary with the creature names is also posted.
 *
 * Not hook-based — run manually from the macro hotbar.
 * If the Bag of Tricks item is found on the actor, uses are consumed
 * automatically. Otherwise rolls 3 creatures with a warning.
 *
 * Tan Bag of Tricks (2024 DMG): pull a fuzzy object, throw within 20 ft,
 * becomes a Tiny Beast creature for 10 minutes or until reduced to 0 HP.
 * 3 uses per dawn.
 */

// ─── Creature Table (Tan Bag — SRD Monsters) ─────────────────────────────────

const TAN_BAG_CREATURES = [
  {
    roll: 1,
    name: "Jackal",
    cr: "0",
    ac: 12,
    hp: "3 (1d6)",
    speed: "40 ft.",
    abilities: { str: 8, dex: 15, con: 11, int: 3, wis: 12, cha: 6 },
    skills: "Perception +3",
    senses: "Passive Perception 13",
    attacks: [
      { name: "Bite", toHit: "+1", damage: "1d4 − 1 piercing" }
    ],
    traits: ["<b>Pack Tactics.</b> Advantage on attack rolls if an un-incapacitated ally is within 5 ft of the target."]
  },
  {
    roll: 2,
    name: "Ape",
    cr: "1/2",
    ac: 12,
    hp: "19 (3d8 + 6)",
    speed: "30 ft., climb 30 ft.",
    abilities: { str: 16, dex: 14, con: 14, int: 6, wis: 12, cha: 7 },
    skills: "Athletics +5, Perception +3",
    senses: "Passive Perception 13",
    attacks: [
      { name: "Fist", toHit: "+5", damage: "1d6 + 3 bludgeoning" },
      { name: "Rock (25/50 ft.)", toHit: "+5", damage: "1d6 + 3 bludgeoning" }
    ],
    traits: ["<b>Multiattack.</b> Two Fist attacks."]
  },
  {
    roll: 3,
    name: "Baboon",
    cr: "0",
    ac: 12,
    hp: "3 (1d6)",
    speed: "30 ft., climb 30 ft.",
    abilities: { str: 8, dex: 14, con: 11, int: 4, wis: 12, cha: 5 },
    skills: "",
    senses: "Passive Perception 11",
    attacks: [
      { name: "Bite", toHit: "+1", damage: "1d4 − 1 piercing" }
    ],
    traits: ["<b>Pack Tactics.</b> Advantage on attack rolls if an un-incapacitated ally is within 5 ft of the target."]
  },
  {
    roll: 4,
    name: "Axe Beak",
    cr: "1/4",
    ac: 11,
    hp: "19 (3d10 + 3)",
    speed: "50 ft.",
    abilities: { str: 14, dex: 12, con: 12, int: 2, wis: 10, cha: 5 },
    skills: "",
    senses: "Passive Perception 10",
    attacks: [
      { name: "Beak", toHit: "+4", damage: "1d8 + 2 slashing" }
    ],
    traits: []
  },
  {
    roll: 5,
    name: "Black Bear",
    cr: "1/2",
    ac: 11,
    hp: "19 (3d8 + 6)",
    speed: "40 ft., climb 30 ft.",
    abilities: { str: 15, dex: 10, con: 14, int: 2, wis: 12, cha: 7 },
    skills: "Perception +3",
    senses: "Passive Perception 13",
    attacks: [
      { name: "Bite", toHit: "+4", damage: "1d6 + 2 piercing" },
      { name: "Claws", toHit: "+4", damage: "2d4 + 2 slashing" }
    ],
    traits: ["<b>Multiattack.</b> One Bite attack and one Claws attack."]
  },
  {
    roll: 6,
    name: "Giant Weasel",
    cr: "1/8",
    ac: 13,
    hp: "9 (2d8)",
    speed: "40 ft.",
    abilities: { str: 11, dex: 16, con: 10, int: 4, wis: 12, cha: 5 },
    skills: "Perception +3, Stealth +5",
    senses: "Darkvision 60 ft., Passive Perception 13",
    attacks: [
      { name: "Bite", toHit: "+5", damage: "1d4 + 3 piercing" }
    ],
    traits: []
  },
  {
    roll: 7,
    name: "Giant Hyena",
    cr: "1",
    ac: 12,
    hp: "45 (6d10 + 12)",
    speed: "50 ft.",
    abilities: { str: 16, dex: 14, con: 14, int: 2, wis: 12, cha: 7 },
    skills: "Perception +3",
    senses: "Passive Perception 13",
    attacks: [
      { name: "Bite", toHit: "+5", damage: "2d6 + 3 piercing" }
    ],
    traits: ["<b>Rampage.</b> When reducing a creature to 0 HP with a melee attack, bonus action to move half speed and make a Bite attack."]
  },
  {
    roll: 8,
    name: "Tiger",
    cr: "1",
    ac: 12,
    hp: "37 (5d10 + 10)",
    speed: "40 ft.",
    abilities: { str: 17, dex: 15, con: 14, int: 3, wis: 12, cha: 8 },
    skills: "Perception +3, Stealth +6",
    senses: "Darkvision 60 ft., Passive Perception 13",
    attacks: [
      { name: "Bite", toHit: "+5", damage: "1d10 + 3 piercing" },
      { name: "Claw", toHit: "+5", damage: "1d8 + 3 slashing" }
    ],
    traits: [
      "<b>Pounce.</b> If the tiger moves 20+ ft straight toward a creature then hits with a Claw attack, the target must succeed on a DC 13 STR save or be knocked prone. If prone, the tiger can make one Bite attack as a bonus action."
    ]
  }
];

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  ensureBagStyles();

  // Resolve actor
  const actor = canvas.tokens.controlled[0]?.actor
    ?? game.user.character
    ?? null;

  if (!actor) {
    ui.notifications.warn("Bag of Tricks: Select a token or assign a default character.");
    return;
  }

  // Find the Bag of Tricks item
  const bag = actor.items.find(i =>
    i.name.toLowerCase().includes("bag of tricks")
    && (i.type === "equipment" || i.type === "loot" || i.type === "consumable" || i.type === "tool")
  );

  let pullCount = 3;

  if (bag) {
    const uses = bag.system?.uses;
    const available = typeof uses?.value === "number"
      ? uses.value
      : Math.max(0, (uses?.max ?? 3) - (uses?.spent ?? 0));

    if (available <= 0) {
      ui.notifications.warn("Bag of Tricks: No uses remaining!");
      return;
    }
    pullCount = Math.min(available, 3);

    // Consume uses
    try {
      if (typeof uses?.spent === "number") {
        await bag.update({ "system.uses.spent": uses.spent + pullCount });
      } else {
        await bag.update({ "system.uses.value": available - pullCount });
      }
    } catch (err) {
      console.warn("Bag of Tricks: Could not consume uses — update manually.", err);
    }
  } else {
    ui.notifications.info("Bag of Tricks: Item not found on actor — rolling 3 creatures anyway.");
  }

  // Roll creatures
  const results = [];
  for (let i = 0; i < pullCount; i++) {
    const roll = new Roll("1d8");
    await roll.evaluate();
    if (game.dice3d) await game.dice3d.showForRoll(roll, game.user, true);
    results.push({ roll, creature: TAN_BAG_CREATURES[roll.total - 1] });
  }

  // Post public summary
  const summaryLines = results.map((r, i) =>
    `<span class="bot-summary-line"><strong>${i + 1}.</strong> ${r.creature.name} <span class="bot-roll-num">(d8 → ${r.roll.total})</span></span>`
  ).join("");

  await ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="bot-summary-card">
        <h3 class="bot-summary-title">🎲 Bag of Tricks — Three-fer!</h3>
        <p class="bot-summary-subtitle">Pulled ${pullCount} fuzzy object${pullCount !== 1 ? "s" : ""} from the Tan Bag of Tricks:</p>
        <div class="bot-summary-list">${summaryLines}</div>
        <p class="bot-summary-note">Stat cards whispered to GM.</p>
      </div>`,
    style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER,
  });

  // Post individual stat cards as GM-only whispers
  const gmIds = game.users.filter(u => u.isGM).map(u => u.id);

  for (const { creature } of results) {
    const card = buildStatCard(creature);

    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: card,
      whisper: gmIds,
      style: (CONST.CHAT_MESSAGE_STYLES ?? CONST.CHAT_MESSAGE_TYPES).OTHER,
    });
  }

  ui.notifications.info(`🎲 Bag of Tricks: Summoned ${pullCount} creature${pullCount !== 1 ? "s" : ""}!`);
})();

// ─── Stat Card Builder ────────────────────────────────────────────────────────

function buildStatCard(c) {
  const abilityRow = ["str", "dex", "con", "int", "wis", "cha"].map(key => {
    const val = c.abilities[key];
    const mod = Math.floor((val - 10) / 2);
    const sign = mod >= 0 ? "+" : "";
    return `<td class="bot-ability-cell"><div class="bot-ability-label">${key.toUpperCase()}</div><div class="bot-ability-val">${val}</div><div class="bot-ability-mod">(${sign}${mod})</div></td>`;
  }).join("");

  const attacks = c.attacks.map(a =>
    `<li><strong>${a.name}:</strong> ${a.toHit} to hit, ${a.damage}</li>`
  ).join("");

  const traits = c.traits.length > 0
    ? `<div class="bot-section bot-traits">${c.traits.join("<br>")}</div>`
    : "";

  return `
    <div class="bot-stat-card">
      <div class="bot-header">
        <span class="bot-name">${c.name}</span>
        <span class="bot-cr">CR ${c.cr}</span>
      </div>
      <div class="bot-section bot-core-stats">
        <span><strong>AC</strong> ${c.ac}</span>
        <span><strong>HP</strong> ${c.hp}</span>
        <span><strong>Speed</strong> ${c.speed}</span>
      </div>
      <table class="bot-ability-table"><tr>${abilityRow}</tr></table>
      ${c.skills ? `<div class="bot-section"><strong>Skills:</strong> ${c.skills}</div>` : ""}
      <div class="bot-section"><strong>Senses:</strong> ${c.senses}</div>
      ${traits}
      <div class="bot-section bot-attacks"><strong>Attacks:</strong><ul>${attacks}</ul></div>
    </div>`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function ensureBagStyles() {
  if (document.getElementById("bag-of-tricks-macro-style")) return;

  const style = document.createElement("style");
  style.id = "bag-of-tricks-macro-style";
  style.innerHTML = `
    /* ── Summary Card ── */
    .bot-summary-card {
      background: linear-gradient(135deg, #2a1f14 0%, #3d2e1f 100%);
      color: #f0e6d8;
      padding: 10px 14px;
      border-radius: 6px;
      border: 2px solid #c9a44a;
      box-shadow: 0 2px 8px rgba(201, 164, 74, 0.3);
    }
    .bot-summary-title {
      margin: 0 0 4px;
      font-size: 1.15em;
      color: #ffd700;
    }
    .bot-summary-subtitle {
      margin: 0 0 6px;
      font-size: 0.9em;
      color: #c9a44a;
    }
    .bot-summary-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-bottom: 6px;
    }
    .bot-summary-line {
      font-size: 0.95em;
    }
    .bot-roll-num {
      color: #aaa;
      font-size: 0.85em;
    }
    .bot-summary-note {
      margin: 0;
      font-size: 0.8em;
      font-style: italic;
      color: #999;
    }

    /* ── Stat Card ── */
    .bot-stat-card {
      background: #fdf5e6;
      color: #1a1a1a;
      border: 2px solid #8b4513;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 0.88em;
      line-height: 1.5;
    }
    .bot-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 2px solid #8b4513;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }
    .bot-name {
      font-size: 1.2em;
      font-weight: bold;
      color: #8b4513;
    }
    .bot-cr {
      font-size: 0.85em;
      color: #666;
      font-weight: 600;
    }
    .bot-section {
      margin: 4px 0;
    }
    .bot-core-stats {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .bot-ability-table {
      width: 100%;
      text-align: center;
      margin: 6px 0;
      border-collapse: collapse;
    }
    .bot-ability-cell {
      padding: 2px 4px;
      border: 1px solid #d4c4a0;
      background: #faf0d8;
    }
    .bot-ability-label {
      font-weight: bold;
      font-size: 0.8em;
      color: #8b4513;
    }
    .bot-ability-val {
      font-size: 1em;
      font-weight: 600;
    }
    .bot-ability-mod {
      font-size: 0.8em;
      color: #666;
    }
    .bot-traits {
      background: #f5ead0;
      padding: 4px 8px;
      border-left: 3px solid #8b4513;
      border-radius: 2px;
      font-size: 0.9em;
    }
    .bot-attacks ul {
      margin: 2px 0 0 16px;
      padding: 0;
    }
    .bot-attacks li {
      margin-bottom: 2px;
    }
  `;
  document.head.appendChild(style);
}
// END: BAG OF TRICKS THREE-FER MACRO
