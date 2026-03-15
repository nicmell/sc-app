# Runtime Entry Refactor — Status & Next Steps

## What was done (commit 73992b5 on ugen-experiments-2)

Mutable runtime state extracted from element tree nodes into a flat `RuntimeEntry[]` on each `BoxItem`. Nodes hold string entry IDs instead of numeric values. Shared entries eliminate the old sync functions (`syncInputValues`, `syncIsRunning`, `syncRunValues`). Components read values via pure functions (`getRuntimeValue`, `resolveControl`) from `elementTree.ts` + `layoutApi` directly — no more read methods on `NodeContext` or `ScNode`.

**Why:** Two inputs bound to the same control share one entry — automatic reactivity, no sync needed. Group fan-out is the only remaining explicit propagation (in `SET_CONTROL` reducer).

## Key files

- `src/lib/parsers/parser.d.ts` — `RuntimeEntry`, reshaped `NodeRuntime`/`InputRuntime`
- `src/lib/parsers/PluginParser.ts` — entry creation, hydration
- `src/lib/parsers/elementTree.ts` — pure read/write functions (`getRuntimeValue`, `resolveControl`, `setControls`)
- `src/lib/stores/layout/slice.ts` — `SET_CONTROL`/`SET_RUNNING` reducers
- `src/sc-elements/internal/sc-node.ts` — `getControls()`, `onChange`, `onRun`
- `src/sc-elements/context.ts` — slimmed `NodeContext` (only boxId, nodeId, register, onChange, onRun)

## 7 improvement suggestions (ranked by impact)

### 1. O(n) entry lookups → use Map (performance)

`runtime.find(e => e.id === entryId)` is called on every render of every input, every `resolveControl`, every `setControls`, and in the reducers. Replace `RuntimeEntry[]` with `Record<string, RuntimeEntry>`. Runtime is never serialized so the array form is unnecessary.

### 2. Hydration broken on app relaunch (correctness bug)

`runtime` is stripped from persistence, `elements` are stripped of runtime refs via `stripRuntime`. On relaunch `box.runtime` is `undefined` → hydration skipped → all control values reset to defaults. Fix: either persist the runtime array alongside elements, or rebuild entries from the persisted tree's static defaults (`controls`, `isRunning`) during the merge phase in `persist.ts`.

### 3. processElement offset coupling is fragile (maintainability)

Handlers in `PluginParser` reach back into `ctx.saved[ctx.offset - 1]` to find the "just matched" saved node. This depends on the offset having been incremented before the handler runs. Pass the matched saved node (or `undefined`) directly into handlers instead of having them index back into the array.

### 4. SET_CONTROL double-writes group entry (minor redundancy)

In the `SET_CONTROL` reducer (`slice.ts:64-77`): the entry is updated at line 67, then `setControls(target, ...)` is called at line 76. If the target is a group, `setControls` writes to the group's own control entry again (same value), then fans out to children. Skip the explicit entry write when the target is a group, or have `setControls` skip self for groups.

### 5. Flat scope leaks across sibling groups (correctness risk)

`ctx.scope` in `PluginParser` is flat — it accumulates every node processed so far. A synth inside group A is visible to an input inside group B at the same depth. Bind validation could pass for paths that shouldn't resolve across sibling groups. Scope should be hierarchical: push on group entry, pop on group exit. Children should only see ancestors and siblings within their group.

### 6. Static defaults redundant with RuntimeEntry (cleanup)

`ScSynthNode.controls` holds parsed default values, `ScSynthNode.isRunning` holds the parsed default boolean, input `.value` holds the parsed default. These are only used during parsing (for entry default values) and in `propsMatch` (for hydration comparison). After parsing, they're dead weight in memory and the store. Consider moving parsed defaults into a separate structure or into entries themselves as a `defaultValue` field.

### 7. NodeContext could shrink further (architecture)

After removing `getRuntimeValue` and `resolveBind`, `NodeContext` only carries: `nodeId`, `boxId()`, `registerElement`, `unregisterElement`, `onChange`, `onRun`. The read path is fully decoupled. The write path (`onChange`/`onRun`) still goes through context because it needs `resolveNodeId` (which walks the Lit element tree via `registeredElements`). If `resolveNodeId` were moved to use the store's element tree instead of the DOM, `NodeContext` could be reduced to just `boxId` + `nodeId`, with all operations going through pure functions + `layoutApi`.

## Priority

Items 1-2 are highest priority (performance + correctness). Item 5 is a latent bug. Items 3-4-6-7 are cleanup/architecture.
