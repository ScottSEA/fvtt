# Tech Stack — FVTT Macro Library

## Runtime Environment
- **Foundry VTT** v13+ (client-side JavaScript, `eval`'d in browser context)
- **dnd5e System** v5+ (2024 rules edition)
- No build tools, no bundler, no npm — raw ES2020+ JS executed via `eval.call(globalThis, code)`

## Architecture

### Bootstrap Stub (`github-loader-macro.js`)
- The only macro users create manually in Foundry
- Fetches `loader.js` from GitHub via unauthenticated API call
- Always runs latest version — no manual updates

### Loader (`loader.js`)
- Manifest-driven installer fetched by the bootstrap stub
- Steps: fetch manifest → detect actor → build profile → filter by prerequisites → dependency-sort → install/execute
- **Hook macros** (`autoExecute: true`): `eval`'d directly, no Macro document created (invisible)
- **Manual macros** (`autoExecute: false`): created as Foundry `Macro` documents (visible in macro list)
- SHA-based caching via GitHub Trees API — skips re-fetch if file unchanged

### Manifest (`manifest.json`)
- Single source of truth for all macros: id, name, path, description, category, requires, dependsOn, autoExecute
- `requires` conditions are AND'd: class, subclass, feat, item, race, spell, minLevel
- Empty `requires` = always installed (utilities)
- Loader handles prerequisite matching via `buildActorProfile()` + `meetsPrerequisites()`

### Plugin System (Dev Mode)
- Activated by holding Ctrl+Shift when running the loader
- Prompts for private repo owner/name, PAT, and branch
- Merges plugin manifest macros into main manifest
- Plugin macros tagged with `_pluginApiBase`, `_pluginBranch`, `_pluginToken` for fetch routing
- PAT stored only in `game[]` runtime memory — never persisted to disk or logged

## Macro Conventions

### Lifecycle (autoExecute macros)
Every hook macro MUST follow the **teardown/register** pattern:
1. Tear down any previously registered hooks (idempotent re-execution)
2. Register new hooks
3. Log registration to console

### Safety
- All hook macros MUST include `actor?.isOwner` guards
- No hardcoded character names, actor IDs, or activity IDs
- Feature name matching (e.g., `"Danger Sense"`) is acceptable — dnd5e has no stable feature IDs

### Icons
- Macros declare `const MACRO_ICON = "fa-icon-name"` for automatic FA icon resolution
- Loader fetches SVG from Font Awesome CDN, white-fills, and base64-encodes

## Folder Structure
```
├── github-loader-macro.js     # Bootstrap stub (user pastes this)
├── loader.js                  # Main loader (fetched by stub)
├── manifest.json              # Macro registry
├── Planning/                  # SDD constitution & specs
├── classes/                   # Class-specific macros
│   └── barbarian/             # Barbarian core
│       └── world-tree/        # Path of the World Tree subclass
├── feats/                     # General feat macros
├── items/                     # Item-specific macros
└── utilities/                 # QoL / DM tools (no prerequisites)
```

## Deployment
- Push to `main` branch on GitHub → players get updates on next loader run
- No CI/CD, no releases — `main` is always deployable
- Public repo requires no authentication; private plugin repos require a GitHub PAT with `repo` read scope
