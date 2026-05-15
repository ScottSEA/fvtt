# Phase 1: Private Repo Hardening — Requirements

## Scope
Make the Ctrl+Shift dev-mode plugin system robust and safe. The bootstrap stub already handles dev mode detection, plugin prompting, manifest fetching, and pre-resolving macro entries. This phase hardens that flow.

## Key Decisions

### Security
- **PAT is never persisted** — re-prompted every dev-mode run. Stored only in `game[]` for the session.
- **PAT must never appear in** `console.log`, `console.warn`, Foundry notifications, or Macro document `command` fields.
- Plugin configs (repo owner/name, branch) may be stored in `game[]` for the session but are also re-prompted.

### Manage Plugins
- On subsequent dev-mode runs within the same session, the user should see their currently loaded plugins and be able to:
  - **Add** another plugin repo
  - **Remove** an existing plugin
  - **Continue** with current plugins
  - **Skip** plugins entirely
- First run: show the current single-repo prompt (already implemented)
- Subsequent runs: show management dialog

### Error Handling
- Invalid PAT (401/403): clear error message, skip that plugin, continue with others
- Unreachable repo (network error, 404): skip with warning, continue
- Malformed manifest (bad JSON, missing `macros` array): skip with warning, continue
- All errors must be non-fatal — the loader should still run with whatever macros it has

### Documentation
- Add a "Dev Mode" section to a README or inline comment block explaining:
  - How to activate (Ctrl+Shift while clicking the loader macro)
  - What it does (loads macros from a private GitHub repo)
  - PAT requirements (needs `repo` read scope)
  - Security model (PAT never persisted, session-only)

## Out of Scope
- Persisting plugin configs across browser reloads (explicitly rejected for security)
- Obfuscation of the bootstrap stub
- Multiple plugin repos on first run (add one, then use manage dialog for more)
