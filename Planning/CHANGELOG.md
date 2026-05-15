# CHANGELOG

All notable changes to the FVTT Macro Library.

## [Unreleased]

### Added
- SDD constitution: `mission.md`, `tech-stack.md`, `roadmap.md`
- Expansion plan for new classes, feats, items, and utilities

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
