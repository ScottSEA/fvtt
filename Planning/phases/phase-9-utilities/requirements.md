# Phase 9: Utility Macros — Requirements

## Overview
Four general-purpose utility macros that enhance gameplay for any character.

## Macros

### 1. Combat Tracker Enhancement (`combat-tracker-macro.js`)
- **Trigger:** `updateCombat` hook (autoExecute)
- **Behavior:** Whispered chat summary on turn change: round, current combatant, next 3 combatants with HP status (healthy/bloodied/critical) and active conditions
- **Gating:** GM or current combatant owner; per-turn dedup
- **HP thresholds:** healthy >50%, bloodied 25–50%, critical <25%
- **Icon:** `fa-list-ol`

### 2. Rest Manager (`rest-manager-macro.js`)
- **Trigger:** Manual execution (dialog)
- **Behavior:** Dialog with Short Rest / Long Rest buttons; calls `actor.shortRest()` / `actor.longRest()`; posts recovery summary
- **Gating:** Requires selected/owned actor
- **Icon:** `fa-bed`

### 3. Condition Reference (`condition-reference-macro.js`)
- **Trigger:** Manual execution (dialog)
- **Behavior:** Searchable dialog listing all 15 standard 5e conditions with effects; real-time filter
- **Icon:** `fa-book-medical`

### 4. Loot Roller (`loot-roller-macro.js`)
- **Trigger:** Manual execution (dialog)
- **Behavior:** CR range (0–4, 5–10, 11–16, 17+) and treasure type (Individual/Hoard) selection; rolls simplified treasure tables; posts results to chat
- **Icon:** `fa-coins`

## Common Requirements
- All macros: `requires: {}` (character-agnostic)
- Follow project teardown/register lifecycle for autoExecute macros
- Follow async IIFE pattern for manual macros
- Inline CSS styling, console error logging with `err.message`
