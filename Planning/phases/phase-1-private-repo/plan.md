# Phase 1: Private Repo Hardening — Plan

## Task Groups

### 1. PAT Audit
- [ ] Grep for `console.log`/`console.warn`/`console.error` calls that could leak `token` or PAT values
- [ ] Verify plugin macros don't carry `_token` into Macro document `command` fields
- [ ] Ensure `promptPluginSetup()` uses `type="password"` (already does)

### 2. Error Handling
- [ ] Wrap plugin manifest fetch with specific HTTP status handling (401/403 → "Invalid PAT", 404 → "Repo not found")
- [ ] Handle malformed manifest JSON (try/catch with descriptive message)
- [ ] Ensure all plugin errors are non-fatal — loader proceeds with public macros

### 3. Manage Plugins Dialog
- [ ] On subsequent dev-mode runs (when `game[PLUGIN_KEY]` already exists), show management dialog instead of single-repo prompt
- [ ] Management dialog shows: list of current plugins, Add/Remove/Continue/Skip buttons
- [ ] "Add" opens the existing single-repo prompt, appends to list
- [ ] "Remove" removes selected plugin from `game[PLUGIN_KEY]`
- [ ] "Skip" clears plugin data for this run (but keeps `game[PLUGIN_KEY]` for next run)

### 4. Documentation
- [ ] Add dev-mode documentation as a comment block at the top of `github-loader-macro.js`
- [ ] Cover: activation, PAT scope, security model, plugin manifest format

## Status
- [ ] Task Group 1: PAT Audit
- [ ] Task Group 2: Error Handling
- [ ] Task Group 3: Manage Plugins Dialog
- [ ] Task Group 4: Documentation
