# FVTT Macro Library

A manifest-driven macro library for **Foundry VTT v13+** (dnd5e 2024 rules) that automatically installs and configures character-relevant macros via a single bootstrap stub.

## Quick Start

1. In Foundry VTT, create a new **Script** macro
2. Paste the contents of [`github-loader-macro.js`](github-loader-macro.js)
3. Run it — the loader detects your character and installs only the macros that apply

That's it. On subsequent runs, macros are SHA-cached and only re-fetched when changed.

## How It Works

- **Bootstrap stub** — the only code you paste into Foundry. Fetches the loader from GitHub.
- **Loader** — reads `manifest.json`, builds your character's profile (class, feats, items, spells), and installs matching macros.
- **Hook macros** (`autoExecute: true`) — eval'd directly, invisible in the macro list. Register Foundry hooks for automatic triggers.
- **Manual macros** (`autoExecute: false`) — created as Macro documents you can click in the macro bar.

## Macro Catalog (59 macros)

### Class — Barbarian (13)

| Macro | Description | Type |
|-------|-------------|------|
| Rage Maintenance | Warns when Rage may end due to no attack or damage | Hook |
| Reckless Attack | Banner reminder on STR melee attacks | Hook |
| Brutal Strike | Option buttons (Forceful, Hamstring, Staggering, Sundering) | Hook |
| Danger Sense | DEX save advantage banner | Hook |
| Primal Knowledge | Swap skill checks to STR while raging | Hook |
| Relentless Rage | CON save at 0 HP while raging + Relentless Endurance | Hook |
| Raging Effects | STR save/check advantage reminder | Hook |
| Instinctive Pounce | Move half speed on Rage activation | Hook |
| Battering Roots | Push/Topple buttons on Heavy/Versatile hits | Hook |
| Branches of the Tree | Alert when hostile within 30ft while raging | Hook |
| Life-Giving Force | Offer temp HP to ally on combat turn | Hook |
| Vitality Surge | Auto temp HP on Rage activation | Hook |
| Travel Along the Tree | Teleport self + companions on Rage | Hook |

### Class — Fighter (3)

| Macro | Description | Type |
|-------|-------------|------|
| Action Surge | Turn-start reminder when uses remain | Hook |
| Second Wind | Healing reminder when below 50% HP | Hook |
| Indomitable | Reroll button on failed saves with +level bonus | Hook |

### Class — Rogue (3)

| Macro | Description | Type |
|-------|-------------|------|
| Sneak Attack | Banner on finesse/ranged attacks with dice scaling | Hook |
| Uncanny Dodge | Reaction reminder on incoming hits | Hook |
| Evasion | DEX save damage modifier banner | Hook |

### Class — Paladin (3)

| Macro | Description | Type |
|-------|-------------|------|
| Divine Smite | Spell slot buttons on melee hits, rolls radiant damage | Hook |
| Lay on Hands | Healing pool reminder on turn start | Hook |
| Aura of Protection | Save bonus reminder with CHA mod for all owned characters | Hook |

### Class — Ranger (2)

| Macro | Description | Type |
|-------|-------------|------|
| Hunter's Mark | Damage reminder when concentrating | Hook |
| Favored Foe | Per-turn marking reminder with uses | Hook |

### Feats (13)

| Macro | Description | Type |
|-------|-------------|------|
| Lucky | d20 reroll reminders + Luck Point tracking | Hook |
| Charger | +1d8 damage or push on melee attacks | Hook |
| Great Weapon Master — Hew | Bonus Action on crits or kills | Hook |
| Graze Mastery | Graze button on missed melee attacks | Hook |
| Sentinel | Reaction prompt on enemy attacks near allies | Hook |
| Polearm Master | Bonus Action opposite-end attack reminder | Hook |
| Shield Master | Bonus Action shove after attacking | Hook |
| War Caster | Spell-as-OA reminder | Hook |
| Savage Attacker | Damage reroll reminder (once/turn) | Hook |
| Resilient | Save proficiency reminder | Hook |
| Alert | Initiative bonus + surprise immunity note | Hook |
| Tough | Bonus HP reminder | Hook |
| Counterspell | Reaction prompt on enemy spellcasting | Hook |

### Items (10)

| Macro | Description | Type |
|-------|-------------|------|
| Adamantine Armor | Crit negation reminder | Hook |
| Bloodshed Blade Rune | Spend Hit Dice for bonus damage | Hook |
| Butcher's Bib Reroll | Damage reroll (1/turn) | Hook |
| Strixhaven Mascot | WIS save advantage | Hook |
| Bag of Tricks | Roll creatures and post stat cards | Manual |
| Cloak of Displacement | Disadvantage on attacks reminder | Hook |
| Ring of Spell Storing | Stored spells reminder | Hook |
| Winged Boots | Flight speed reminder | Hook |
| Magic Shield | AC bonus note | Hook |
| Flame Tongue | +2d6 fire damage reminder | Hook |

### Utilities (12)

| Macro | Description | Type |
|-------|-------------|------|
| Concentration Check | CON save DC reminder on damage | Hook |
| Token Dashboard | Floating HUD with HP, AC, conditions | Manual |
| Dashboard Double-Click | Toggle dashboard on empty canvas | Hook |
| Combat Tracker | Turn summary with HP status and conditions | Hook |
| Macro Quick-Execute | Shift+click to run macros immediately | Hook |
| Chat Cleanup | Delete your recent chat messages | Manual |
| Icon Browser | Visual grid of all Foundry icons | Manual |
| Macro Cleanup | Delete all macro documents except loader | Manual |
| Test Crit Attack | Post fake crit for testing | Manual |
| Rest Manager | Short/Long Rest dialog | Manual |
| Condition Reference | Searchable 5e condition lookup | Manual |
| Loot Roller | Treasure table roller by CR | Manual |

## Dev Mode (Private Repos)

Hold **Ctrl+Shift** while running the loader to activate dev mode. This lets you load additional macros from a private GitHub repository.

- First run: prompts for repo owner/name, PAT, and branch
- Subsequent runs: management dialog to add/remove/skip plugins
- **PAT is session-only** — never persisted to disk, localStorage, or Foundry DB
- Private macro source IS persisted for manual macros (treat as private for distribution, not secret)

**PAT requirements:** Fine-grained PAT with "Contents: Read-only" on the target repo, or a classic PAT with `repo` scope.

## Architecture

```
├── github-loader-macro.js     # Bootstrap stub (paste this into Foundry)
├── loader.js                  # Manifest-driven installer
├── manifest.json              # Macro registry (59 entries)
├── classes/                   # Class-specific macros
│   ├── barbarian/             # + world-tree/ subclass
│   ├── fighter/
│   ├── paladin/
│   ├── ranger/
│   └── rogue/
├── feats/                     # General feat macros
├── items/                     # Item-specific macros
├── utilities/                 # QoL tools (no prerequisites)
└── Planning/                  # SDD specs and roadmap
```

## Requirements

- Foundry VTT v13+
- dnd5e system v5+ (2024 rules)
- No modules required

## License

MIT
