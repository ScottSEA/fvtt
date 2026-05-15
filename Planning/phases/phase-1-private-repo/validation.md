# Phase 1: Private Repo Hardening — Validation

## Success Criteria

### PAT Security
- [ ] `grep -i "token\|pat\|ghp_"` across console.log/warn/error calls → no token values leaked
- [ ] Plugin macro entries passed to loader have `_token` but it never ends up in a Macro document's `command` field
- [ ] PAT input field is `type="password"` in all dialogs

### Error Handling
- [ ] Invalid PAT → warning notification + plugin skipped + loader continues
- [ ] Unreachable repo → warning notification + plugin skipped + loader continues
- [ ] Malformed manifest → warning notification + plugin skipped + loader continues
- [ ] No plugins configured → loader runs normally with public macros only

### Manage Plugins
- [ ] First dev-mode run → single-repo prompt appears
- [ ] Second dev-mode run (same session) → management dialog appears with previously added plugin listed
- [ ] "Add" in management dialog → prompts for new repo, adds to list
- [ ] "Remove" in management dialog → removes selected plugin
- [ ] "Continue" → proceeds with current plugin list
- [ ] "Skip" → runs loader without any plugins

### Documentation
- [ ] Dev mode activation instructions present in bootstrap stub comments
- [ ] PAT scope requirements documented
- [ ] Security model (no persistence) documented

## Manual Testing
- [ ] Run loader normally (no Ctrl+Shift) → no plugin prompt, normal behavior
- [ ] Run loader with Ctrl+Shift → plugin prompt appears
- [ ] Enter valid plugin → plugin macros load alongside public macros
- [ ] Enter invalid PAT → graceful error, public macros still load
- [ ] Run loader with Ctrl+Shift again (same session) → management dialog appears
