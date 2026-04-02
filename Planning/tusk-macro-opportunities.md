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

### Priority 3 — New Opportunities

#### 8. Rage Maintenance Warning
> Rage ends early if you don't attack or take damage by end of your turn.

- **Why automate:** Losing Rage cascades through half the character's kit — rage damage, resistance, Primal Knowledge, Life-Giving Force, Branches, Battering Roots all stop working. Easy to lose track in complex fights.
- **Trigger:** `updateCombat` — detect when Tusk's turn ends without having attacked or taken damage.
- **Behavior:** Post a warning in chat: "⚠️ You haven't attacked or taken damage — Rage will end!" Could track attack/damage via `renderChatMessage` and `dnd5e.damageActor` during the turn.
- **Pattern:** Turn tracking (like Life-Giving Force).
- **Effort:** Medium

#### 9. Instinctive Pounce Reminder
> When Rage activates, you can move up to half your speed as part of the bonus action.

- **Why automate:** Easy to forget the free movement. Nearly free to implement since `vitality-surge` already hooks Rage activation.
- **Trigger:** Piggyback on `dnd5e.postUseActivity` in vitality-surge, or separate macro using same hook.
- **Behavior:** Append reminder to Vitality Surge chat message or post separate: "🏃 Instinctive Pounce — move up to [half speed] ft."
- **Pattern:** Simple chat message on activity use.
- **Effort:** Trivial

#### 10. Battering Roots — Push/Topple Mastery Choice
> At level 10: on a hit with Heavy/Versatile weapon while raging, activate Push (10 ft) or Topple (prone, STR save).

- **Why automate:** Two-choice mastery override is easy to forget is available while raging. Needs opponent STR save for Topple.
- **Trigger:** `renderChatMessage` — detect melee hit with Heavy/Versatile weapon while raging.
- **Behavior:** Inject buttons: "🌳 Push 10 ft" / "🌳 Topple (STR save)". Topple button could prompt target STR save.
- **Pattern:** Chat button injection (like Charger).
- **Effort:** Medium
- **Note:** Verify whether dnd5e ActiveEffect already handles this via weapon mastery system before building.

#### 11. Adamantine Armor Crit Negation Reminder
> +1 Adamantine Half Plate reduces critical hits against Tusk to normal hits.

- **Why automate:** Forgetting means taking double damage dice unnecessarily.
- **Trigger:** `renderChatMessage` — detect incoming attack crits against Tusk.
- **Behavior:** Post reminder: "🛡️ Adamantine Armor — that crit becomes a normal hit!"
- **Pattern:** Chat message inspection.
- **Effort:** Low
- **Note:** Check if dnd5e already handles this via item ActiveEffect. If so, skip.

#### 12. Rage End Cleanup Summary
> When Rage ends, post a summary of everything that turns off.

- **Why automate:** Purely informational — helps the table remember what changes when Rage drops.
- **Trigger:** `deleteActiveEffect` — detect Rage effect removal (rage-ring already hooks this).
- **Behavior:** Post chat message listing deactivated features: rage damage bonus, BPS resistance, Primal Knowledge STR swaps, Life-Giving Force, Branches reactions, Battering Roots reach.
- **Pattern:** Effect lifecycle hook (extend rage-ring).
- **Effort:** Low

#### 13. Travel Along the Tree (Level 14 — Future)
> Bonus action while raging: teleport self + up to 6 willing creatures within 10 ft to unoccupied spaces within 60 ft of you.

- **Why automate:** Multi-target selection and teleport positioning is complex to manage manually.
- **Trigger:** Manual activation or `dnd5e.postUseActivity` when the feature is used.
- **Behavior:** Multi-target selection dialog, then teleport tokens to chosen positions.
- **Pattern:** Custom activity automation with token movement.
- **Effort:** High
- **Note:** Pre-plan now; implement when Tusk hits level 14.

---

### No Macro Needed (Already Automated or Passive)

| Feature | Reason |
|---------|--------|
| Feral Instinct | Advantage on initiative via ActiveEffect |
| Adrenaline Rush | Built-in activity with uses tracked by system |
| Fast Movement | ActiveEffect adds +10 speed |
| Unarmored Defense | ActiveEffect (Tusk wears armor anyway) |
| Speedy | ActiveEffect adds +10 speed |
| Tough | HP bonus baked into max HP |
| Belt of Fire Giant STR | STR override via ActiveEffect |

---

## Implementation Priority Summary

| Priority | Macro | Effort | Impact | Status |
|----------|-------|--------|--------|--------|
| ✅ 1 | Relentless Rage + Relentless Endurance | Medium | **Critical** — prevents character death | ✅ Done |
| ✅ 2 | Great Weapon Master — Hew | Low-Medium | **High** — free bonus action attack on crits | ✅ Done |
| ✅ 3 | Reckless Attack Reminder | Low | **Medium** — quality of life | ✅ Done |
| ✅ 4 | Lucky Reminder | Medium | **Medium** — universal, tracking value | ✅ Done |
| ✅ 5 | Brutal Strike Decision Helper | High | **Medium** — streamlines complex choice | ✅ Done |
| ✅ 6 | Branches of the Tree Reminder | Low | **Medium** — simple turn reminder | ✅ Done |
| ✅ 7 | Charger Charge Attack | High | **Low** — hard to detect movement | ✅ Done |
| 🟠 8 | Rage Maintenance Warning | Medium | **High** — losing Rage cascades through entire kit | |
| ⚪ 9 | Instinctive Pounce Reminder | Trivial | **Low** — simple chat reminder | |
| 🟡 10 | Battering Roots Push/Topple | Medium | **Medium** — mastery choice on melee hits | |
| ⚪ 11 | Adamantine Crit Negation | Low | **Low-Medium** — may already be handled by system | |
| ⚪ 12 | Rage End Cleanup Summary | Low | **Low** — informational only | |
| 🔵 13 | Travel Along the Tree (Lvl 14) | High | **Medium** — future, multi-target teleport | |
