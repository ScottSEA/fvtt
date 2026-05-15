# CHANGELOG

All notable changes to the FVTT Macro Library.

## [Unreleased]

---

## [2026-05-15] — Phase 2: Fighter Macros

### Added
- `action-surge-macro.js`: whispered reminder on combat turn start when uses remain
- `second-wind-macro.js`: reminder when below 50% HP with `1d10 + level` healing formula
- `indomitable-macro.js`: reroll button on failed saves with Fighter level bonus, use consumption
- Phase 2 SDD spec folder (plan, requirements, validation)
- Three new manifest entries with `class: fighter` prerequisites

---

## [2026-05-15] — Phase 1: Private Repo Hardening

### Added
- Plugin management dialog for subsequent dev-mode runs (add/remove/continue/skip)
- Specific HTTP error diagnostics (401 → invalid PAT, 403 → access/SSO/policy, 404 → not found or no visibility)
- Malformed manifest handling (bad JSON, missing macros array)
- Comprehensive dev-mode documentation in bootstrap stub header
- Phase 1 SDD spec folder (plan, requirements, validation)

### Changed
- All plugin/loader errors are non-fatal — loader always proceeds with public macros
- All console.error calls now log `err.message` instead of full error objects (prevents PAT leakage)
- Plugin logic fully owned by bootstrap stub; loader.js has zero plugin awareness

### Security
- PAT is session-only (game[] memory), never persisted to disk/DB/logs
- PAT input uses `type="password"` in all dialogs
- Private macro source IS persisted for manual macros (private for distribution, not secret)

---

## [2025-05-15] — Macro Generalization

### Changed
- All macros are now character-agnostic (no hardcoded names/IDs)
- `lucky-macro.js`: dynamic actor resolution instead of `LUCKY_CHARACTER_NAME = "Tusk"`
- `danger-sense-macro.js`: added Danger Sense feat prerequisite check
- `bloodshed-blade-rune-macro.js`: added equipped check, resolve activity by name not ID
- `relentless-rage-macro.js`: Relentless Endurance is now conditional on having the feature

### Fixed
- `gwm-hew-macro.js`: added `isOwner` guard to `analyzeForHew()`
- `brutal-strike-macro.js`: added `isOwner` guard before button injection
- `vitality-surge-macro.js`: added `isOwner` guard in all three hook paths

## [2025-05-14] — Loader Architecture

### Added
- Bootstrap stub + `loader.js` split (async IIFE for eval context)
- Pre-flight self-update — loader auto re-executes new version
- Ctrl+Shift dev mode for private repo plugins
- SHA-based caching via GitHub Trees API
- Manifest-driven prerequisite matching (class, subclass, feat, item, race, spell, minLevel)
- Dependency topological sort for install order
- FA icon auto-resolution from macro source

### Changed
- Removed authentication requirement for public repo
- Cleaned up personal data and legacy files for public release
