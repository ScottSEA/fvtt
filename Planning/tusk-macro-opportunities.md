# Tusk — Macro Opportunity Analysis

## Character Summary

| Attribute | Value |
|-----------|-------|
| **Name** | Tusk |
| **Race** | Orc (2024 rules) |
| **Class** | Barbarian 13 (Path of the World Tree) |
| **Stats** | STR 18, DEX 15, CON 20, INT 9, WIS 15, CHA 12 |
| **HP** | 210 |
| **Save Proficiencies** | STR, CON |
| **Skill Proficiencies** | Animal Handling, Athletics, Intimidation, Nature, Perception, Stealth, Survival |
| **Tool Proficiencies** | Cook's Utensils, Carpenter's Tools |
| **Languages** | Common, Orc, Draconic |
| **Weapon Masteries** | Greatsword, Greataxe, Longbow, Warhammer |

## Feats

- **Lucky** (Origin) — 5 Luck Points (= proficiency bonus). Spend 1 for advantage on any d20, or impose disadvantage on attack against you. Resets on long rest.
- **Charger** (ASI 4) — +10 speed on Dash; after 10 ft straight-line move before melee hit: +1d8 damage or push 10 ft. 1/turn.
- **Great Weapon Master** (ASI 8) — +proficiency bonus damage with Heavy weapons; **Hew**: after a crit or reducing to 0 HP with melee, bonus action attack.
- **Speedy** (ASI 12) — +10 speed, Dash ignores difficult terrain, opportunity attacks have disadvantage against you.
- **Tough** (Farmer background) — +2 HP per level.

## Class Features

| Level | Feature | Notes |
|-------|---------|-------|
| 1 | Rage | 5 uses, +3 rage damage, BPS resistance |
| 1 | Unarmored Defense | 10 + DEX + CON (not used — wearing armor) |
| 1 | Weapon Mastery | 4 masteries known |
| 2 | Danger Sense | Advantage on DEX saves (unless incapacitated) |
| 2 | Reckless Attack | Advantage on STR attacks; attacks against you also have advantage |
| 3 | Primal Knowledge | Eligible skills use STR while raging |
| 5 | Extra Attack | 2 attacks per Attack action |
| 5 | Fast Movement | +10 speed (no heavy armor) |
| 7 | Feral Instinct | Advantage on initiative |
| 7 | Instinctive Pounce | Move half speed as part of Rage activation |
| 9 | Brutal Strike | Forgo Reckless advantage for +1d10 damage + Forceful/Hamstring Blow |
| 11 | Relentless Rage | CON save (DC 10, +5 each use) to not drop to 0 HP while raging |
| 13 | Improved Brutal Strike | Adds Staggering Blow & Sundering Blow options |

## World Tree Subclass Features

| Level | Feature | Notes |
|-------|---------|-------|
| 3 | Vitality of the Tree | Vitality Surge (temp HP = barb level on rage) + Life-Giving Force (Xd6 temp HP to ally each turn) |
| 6 | Branches of the Tree | Reaction: teleport creature within 30 ft to adjacent, reduce speed to 0 |
| 10 | Battering Roots | +10 reach with Heavy/Versatile weapons; activate Push or Topple mastery on hit |

## Racial Abilities (Orc)

- **Adrenaline Rush** — Dash as bonus action + temp HP = proficiency bonus. Prof bonus uses, resets on short rest.
- **Relentless Endurance** — Drop to 1 HP instead of 0. 1/long rest.

## Equipment

| Item | Type | Key Properties |
|------|------|----------------|
| Bloodshed Blade | Very Rare Greatsword | 2d6 + CON slashing, Graze mastery, Rune invocation (spend Hit Die to boost attack/damage) |
| Butcher's Bib | Rare Wondrous | Crit on 19-20 (slashing), reroll melee damage 1/turn |
| Belt of Fire Giant Strength | Very Rare | Sets STR to 25 |
| +1 Adamantine Half Plate | Rare Armor | Crits against Tusk become normal hits |
| Cuddly Strixhaven Mascot | Common Wondrous | Advantage on WIS saves vs Frightened (1/long rest) |
| Bag of Holding | Uncommon | Extradimensional storage |
| Tan Bag of Tricks | Uncommon | Pull fuzzy object, throw to summon random creature |
| Immovable Rod | Uncommon | Fix in place, DC 30 to move |

---

## Existing Macros (Already Automated)

| Macro | Feature | Hooks |
|-------|---------|-------|
| `bloodshed-blade-rune` | Invoke Rune buttons on Bloodshed Blade attacks; spend Hit Dice to boost rolls | `renderChatMessage`, click delegation |
| `butchers-bib-reroll` | "Reroll Damage" button on melee damage msgs; 1/turn | `renderChatMessage`, click delegation |
| `danger-sense` | DEX save advantage banner reminder | `dnd5e.preRollSavingThrowV2`, `renderRollConfigurationDialog` |
| `life-giving-force` | On combat turn: offer dialog to grant temp HP to target while raging | `updateCombat`, `renderChatMessage` |
| `primal-knowledge` | Swap eligible skill checks to STR while raging | `dnd5e.preRollSkill`, `renderRollConfigurationDialog` |
| `strixhaven-mascot` | WIS save vs Frightened: button to consume mascot use for advantage | `dnd5e.preRollSavingThrowV2`, `renderRollConfigurationDialog` |
| `vitality-surge` | Auto-grant temp HP = Barbarian level on Rage activation | `dnd5e.postUseActivity`, `createActiveEffect`, `updateActiveEffect` |

---

## New Macro Opportunities

### Priority 1 — High-Value (frequently triggered, easy to forget)

#### 1. Relentless Rage + Relentless Endurance
> When Tusk drops to 0 HP while raging, CON save (DC 10 + 5 per prior use). On success, HP = 2× Barbarian level (26). DC resets on short/long rest. Orc's Relentless Endurance (drop to 1 HP, no save) should be offered first.

- **Why automate:** Life-or-death feature with an escalating DC that's easy to miscalculate. Forgetting it means an unnecessary death.
- **Trigger:** `dnd5e.preApplyDamage` or `dnd5e.damageActor` — detect when resulting HP would be ≤ 0 while Rage is active.
- **Behavior:** First offer Relentless Endurance (no save, 1/long rest). If declined or used, then prompt CON save with correct DC for Relentless Rage. Track uses/DC escalation. Auto-set HP on success. Post chat message.
- **Pattern:** Damage hook interception + dialog prompt + chat message.
- **Effort:** Medium

#### 2. Great Weapon Master — Hew
> After a critical hit or reducing a creature to 0 HP with a melee weapon, Tusk gets a bonus action attack.

- **Why automate:** Crits are exciting and Hew is easy to overlook. The "reduce to 0 HP" trigger is even harder to catch.
- **Trigger:** `renderChatMessage` — detect attack messages with critical hits from melee weapons. For "reduce to 0 HP": `dnd5e.applyDamage` to detect when a target drops.
- **Behavior:** Inject a prominent chat button: "⚔️ Hew! Make a Bonus Action attack with this weapon."
- **Pattern:** Chat button injection (like Bloodshed Blade).
- **Effort:** Low-Medium

#### 3. Reckless Attack Reminder
> On first attack of turn, Tusk can attack recklessly (advantage on STR attacks, but attacks against him have advantage too).

- **Why automate:** Easy to forget at the start of a turn; pairs with the Brutal Strike decision tree.
- **Trigger:** Pre-attack hook — detect first STR-based attack of the turn.
- **Behavior:** Inject banner in attack roll dialog: "Reckless Attack available — Advantage on STR attacks this turn."
- **Pattern:** Two-hook dialog pattern (like Danger Sense).
- **Effort:** Low

#### 4. Lucky Reminder
> 5 Luck Points per long rest. Spend 1 for advantage on any d20 test, or impose disadvantage on an incoming attack.

- **Why automate:** Universal applicability; tracking remaining uses is tedious.
- **Trigger:** `renderRollConfigurationDialog` — inject button on any d20 roll dialog. For defensive use: `renderChatMessage` on incoming attack rolls against Tusk.
- **Behavior:** Display remaining Luck Points; clicking consumes a use and grants advantage (or imposes disadvantage).
- **Pattern:** Two-hook dialog pattern + chat button injection.
- **Effort:** Medium

---

### Priority 2 — Medium-Value (situational but impactful)

#### 5. Brutal Strike Decision Helper
> When Reckless Attack is active, forgo advantage on one STR attack for +1d10 damage + choice of four effects.

- **Why automate:** Four options to choose from is a lot to track. A streamlined dialog after a Reckless hit would save time.
- **Trigger:** After Reckless Attack hit confirmed — detect via chat message.
- **Behavior:** Inject buttons for each option: Forceful Blow, Hamstring Blow, Staggering Blow, Sundering Blow. Roll extra 1d10.
- **Effort:** High

#### 6. Branches of the Tree Reminder
> While raging, when a creature starts its turn within 30 ft, Tusk can react to teleport it adjacent and reduce its speed to 0.

- **Why automate:** Triggers on enemy turns — easy for the player to miss.
- **Trigger:** `updateCombat` — detect non-friendly combatant turn start while Tusk is raging.
- **Behavior:** Post chat reminder with reaction prompt.
- **Pattern:** Similar to Life-Giving Force turn trigger.
- **Effort:** Low

#### 7. Charger — Charge Attack
> After moving 10+ ft in a straight line before a melee hit: +1d8 damage OR push 10 ft.

- **Why automate:** Hard to detect movement distance programmatically in FVTT.
- **Recommendation:** Low priority. A manual-trigger reminder or simple banner on melee attacks may be sufficient.
- **Effort:** High (movement tracking)

---

### No Macro Needed (Already Automated or Passive)

| Feature | Reason |
|---------|--------|
| Feral Instinct | Advantage on initiative via ActiveEffect |
| Adrenaline Rush | Built-in heal activity in the system |
| Battering Roots | Passive mastery bonus via ActiveEffect |
| Fast Movement | ActiveEffect adds +10 speed |
| Unarmored Defense | ActiveEffect (Tusk wears armor anyway) |
| Speedy | ActiveEffect adds +10 speed |
| Tough | HP bonus baked into max HP |

---

## Implementation Priority Summary

| Priority | Macro | Effort | Impact |
|----------|-------|--------|--------|
| 🔴 1 | Relentless Rage + Relentless Endurance | Medium | **Critical** — prevents character death |
| 🟠 2 | Great Weapon Master — Hew | Low-Medium | **High** — free bonus action attack on crits |
| 🟡 3 | Reckless Attack Reminder | Low | **Medium** — quality of life |
| 🟡 4 | Lucky Reminder | Medium | **Medium** — universal, tracking value |
| 🔵 5 | Brutal Strike Decision Helper | High | **Medium** — streamlines complex choice |
| 🔵 6 | Branches of the Tree Reminder | Low | **Medium** — simple turn reminder |
| ⚪ 7 | Charger Charge Attack | High | **Low** — hard to detect movement |
