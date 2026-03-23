# Functional Flow Refactor Proposal

## Current State

The macro is organized into named functions grouped by concern (Lifecycle, Handlers, Styles, Detection, HTML Builders, Roll Building, Queries, Mutations). SRP is solid at the function level. But the **flow** is still imperative — handlers reach into globals, pull data, branch on conditions, and interleave side effects with computation.

## What "Functional Flow" Means Here

We can't go full FP (Foundry's API is inherently stateful), but we *can* push toward:

1. **Pure data pipelines** — compute everything, then execute side effects at the end
2. **Eliminate null/undefined branching** — use early-return "gate" functions that produce result-or-nothing
3. **Compose small transforms** — chain data through stages instead of mutating in place
4. **Separate "decide" from "do"** — build a description of what should happen, then execute it

---

## Specific Changes

### 1. Replace scattered early returns with a pipeline gate

**Current:** `onRenderChatMessage` has 5 bail-out checks interleaved with data extraction.

**Proposed:** Extract a pure `analyzeMessage(message, el)` that returns a complete context object or `null`.

```js
function analyzeMessage(message, el) {
  const actor = resolveActorFromMessage(message);
  const isRoll = message.isRoll || !!message.rolls?.length || !!message.flags?.dnd5e?.roll;
  if (!actor || !isRoll) return null;
  if (!isBloodshedBladeAttackMessage(message, el)) return null;

  const attackData = extractAttackRollData(message);
  if (!attackData) return null;

  return {
    actor,
    attackTotal: attackData.total,
    formula: attackData.formula,
    rollId: attackData.rollId,
    isCritical: detectCritical(message, el),
    hdData: getAvailableHitDice(actor),
    runeExpended: isRuneExpended(actor),
  };
}
```

Then `onRenderChatMessage` becomes:

```js
function onRenderChatMessage(message, html) {
  const el = html instanceof HTMLElement ? html : html[0] ?? html;
  if (el.querySelector("[data-action='bloodshed-spend-hd']")) return;

  const ctx = analyzeMessage(message, el);
  if (!ctx) return;

  const buttonHtml = buildButtonGroup(message, ctx);
  injectButtons(el, buttonHtml);
}
```

**Why:** The hook handler is now 4 lines of orchestration. All the "should we act?" logic is in one testable pure function.

---

### 2. Extract button-state decisions into a pure function

**Current:** `onRenderChatMessage` has inline ternary logic deciding button text and disabled state.

**Proposed:**

```js
function resolveButtonState(hdData, runeExpended) {
  if (hdData.available <= 0) return { disabled: true, label: "No Hit Dice" };
  if (runeExpended)          return { disabled: true, label: "Rune Expended" };
  return                            { disabled: false, label: "Invoke Rune" };
}
```

---

### 3. Make `buildGustoRollData` return an immutable result (no Roll mutation)

**Current:** `applyMaxCriticals` mutates `roll._total` and `term._total` in place — classic imperative side effect buried in the pipeline.

**Proposed:** Have `applyMaxCriticals` return a new totals object instead of mutating:

```js
function computeMaxCriticalTotals(roll) {
  const diceTerms = roll.terms.filter(t => t.faces && t.results);
  let adjustedTotal = roll.total;
  const maxedTerms = [];

  for (let i = 0; i < diceTerms.length; i += 2) {
    const term = diceTerms[i];
    const originalTotal = term.total;
    const maxTotal = term.results
      .filter(r => r.active)
      .reduce((sum, r) => sum + term.faces, 0);
    adjustedTotal += maxTotal - originalTotal;
    maxedTerms.push({ index: i, maxTotal, faces: term.faces, number: term.number });
  }

  return { adjustedTotal, maxedTerms, diceTerms };
}
```

> **Caveat:** `roll.toMessage()` reads `roll._total` to display the Foundry dice tray result correctly. We'd still need to patch the Roll object before sending it to chat. So this becomes a "compute, then apply once" pattern rather than pure-through-and-through. Worth noting — Foundry forces the mutation.

---

### 4. Separate "what to do" from "doing it" in handlers

**Current:** `handleInvokeRune` validates, updates UI, rolls, marks rune, marks HD — all in one function.

**Proposed:** Split into a decision phase and an execution phase:

```js
async function handleInvokeRune(event, btn) {
  event.preventDefault();

  const intent = resolveInvokeIntent(btn);
  if (!intent) return;

  updateInvokeUI(btn);
  await executeInvoke(intent);
}

function resolveInvokeIntent(btn) {
  const message = game.messages.get(btn.dataset.messageId);
  if (!message) return null;

  const actor = resolveActorFromMessage(message);
  if (!actor) {
    ui.notifications.error("Bloodshed Blade: Unable to determine actor for this attack.");
    return null;
  }

  const hdData = getAvailableHitDice(actor);
  if (hdData.available <= 0) {
    ui.notifications.warn("No Hit Dice available to spend!");
    return null;
  }

  return {
    actor,
    message,
    hdType: hdData.largestType,
    attackTotal: Number(btn.dataset.attackTotal),
    isCritical: btn.dataset.isCritical === "true",
  };
}

async function executeInvoke({ actor, message, hdType, attackTotal, isCritical }) {
  await rollHitDie(actor, message, hdType, attackTotal, isCritical);
}
```

Same pattern for `handleUndoRune` and `handleDamageRoll`:

```js
function resolveUndoIntent(btn)   → { actor, message } | null
function resolveDamageIntent(btn) → { actor, blade, isCritical } | null
```

---

### 5. Compose the damage pipeline explicitly

**Current:** `handleDamageRoll` → `buildGustoRollData` → scattered helpers.

**Proposed:** Make the pipeline visible in a single read:

```js
async function handleDamageRoll(event, btn) {
  event.preventDefault();

  const intent = resolveDamageIntent(btn);
  if (!intent) return;

  const rollResult = await buildDamageRoll(intent);
  if (!rollResult) return;

  const content = formatDamageResult(rollResult);
  await sendRollMessage(intent.actor, rollResult.roll, content);
}
```

Where:
- `resolveDamageIntent` — pure validation, returns `{ actor, blade, isCritical }` or `null`  
- `buildDamageRoll` — builds formula, evaluates roll, applies max crits, computes display formula  
- `formatDamageResult` — pure HTML from data  
- `sendRollMessage` — the one side-effectful call  

---

### 6. Consolidate `mark`/`unmark` into a single `updateRuneState` with direction

**Current:** 4 separate functions: `markRuneAsExpended`, `unmarkRuneAsExpended`, `markHitDieExpended`, `unmarkHitDieExpended`.

**Proposed:**

```js
async function updateRuneState(actor, direction, hdType = null) {
  const delta = direction === "expend" ? 1 : -1;
  await updateRuneUses(actor, delta);
  await updateHitDieSpent(actor, delta, hdType);
}
```

Called as:
```js
await updateRuneState(actor, "expend", hdType);   // invoke
await updateRuneState(actor, "restore");           // undo
```

**Why:** The mark/unmark pairs are always called together and are symmetric. One function with a direction parameter removes duplication and makes the intent clearer.

---

### 7. Extract `injectButtons` to isolate DOM mutation

**Current:** `onRenderChatMessage` has a 3-way cascade for where to inject (`card-buttons`, `.dice-roll`, or fallback).

**Proposed:**

```js
function injectButtons(el, buttonHtml) {
  const target =
    el.querySelector(".card-buttons") ??
    el.querySelector(".message-content .dice-roll") ??
    el;

  const position = target === el ? "beforeend" : 
    target.matches(".card-buttons") ? "beforeend" : "afterend";

  target.insertAdjacentHTML(position, buttonHtml);
}
```

---

## Summary of New Flow Shape

```
onRenderChatMessage
  └─ analyzeMessage (pure)  →  ctx | null
  └─ resolveButtonState (pure)  →  { disabled, label }
  └─ buildButtonGroup (pure)  →  HTML string
  └─ injectButtons (DOM write)

handleInvokeRune
  └─ resolveInvokeIntent (validation)  →  intent | null
  └─ updateInvokeUI (DOM write)
  └─ executeInvoke
       └─ rollHitDie  →  roll + chat message
       └─ updateRuneState("expend")

handleUndoRune
  └─ resolveUndoIntent (validation)  →  intent | null
  └─ updateRuneState("restore")
  └─ updateUndoUI (DOM write)

handleDamageRoll
  └─ resolveDamageIntent (validation)  →  intent | null
  └─ buildDamageRoll (compute)  →  { roll, displayFormula, damageTotal }
  └─ formatDamageResult (pure HTML)
  └─ sendRollMessage (side effect)
```

Each handler reads top-to-bottom as: **validate → compute → render → execute**. Side effects are pushed to the leaves. Pure functions dominate the middle.

---

## What I Wouldn't Change

- **`teardown` / `register`** — Already clean lifecycle management. No benefit from functionalizing.
- **`ensureBloodshedBladeStyles`** — Idempotent DOM setup. It's fine as-is.
- **`detectCritical`** — Already a pure function with short-circuit returns. Textbook functional style.
- **`resolveActorFromMessage`** — Already a pure chain of fallbacks.

---

## Effort Estimate

This is mostly shuffling code into new named functions and adjusting call sites. No logic changes, no new features. The macro's behavior stays identical — just the *shape* changes.

| Change | Functions Touched |
|--------|-------------------|
| `analyzeMessage` + `resolveButtonState` + `injectButtons` | replaces body of `onRenderChatMessage` |
| `resolveInvokeIntent` / `resolveUndoIntent` / `resolveDamageIntent` | extracts from 3 handlers |
| `updateRuneState` consolidation | replaces 4 mark/unmark functions |
| `computeMaxCriticalTotals` | replaces `applyMaxCriticals` (still needs Roll mutation at the end) |
| Rename `buildGustoRollData` → `buildDamageRoll` | clarity |
| Rename `createGustoButtonForOutput` → `createDamageButton` | clarity |

Net: ~5 new extraction functions, 4 functions consolidated into 2, 2 renames.
