# Mission — FVTT Macro Library

## What
A manifest-driven macro library for Foundry VTT (v13+, dnd5e 5e 2024) that automatically installs and configures character-relevant macros via a single bootstrap stub.

## Why
Foundry VTT's macro system is powerful but manual — players must find, install, and maintain individual macros. This project provides a **zero-maintenance loader** that:
- Detects the player's character and installs only relevant macros
- Keeps macros up-to-date via GitHub (SHA-based caching, no re-fetch if unchanged)
- Supports private plugin repos for personal/dev macros (Ctrl+Shift dev mode)
- Handles dependencies and execution order automatically

## Goals
1. **Character-agnostic** — macros work for any character, not just specific builds
2. **Zero-config for players** — paste the bootstrap stub, run it, done
3. **Extensible** — adding a new macro = write the JS + add a manifest entry
4. **Non-intrusive** — hook macros are invisible (no Macro document); manual macros appear in the macro list
5. **Safe** — `isOwner` guards prevent cross-player interference; PATs are never logged

## Non-Goals
- Not a Foundry module — this is a macro-based system, no module packaging
- No server-side components — everything runs client-side via GitHub API
- No movement/proximity validation — player responsibility
- No automation of game mechanics (auto-rolling, auto-applying damage) — reminders and buttons only
