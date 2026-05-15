# Plan: Embed Strudel REPL as a dashboard panel

## Context

The dashboard currently exposes a SuperDirt-driving step sequencer
(`SequencerPanel` + `SequencerController`) that emits `/dirt/play`
through our existing `DirtClient` → `WorkerClient.sendCommand()`
→ Rust bridge → UDP 57120 (SuperDirt/StrudelDirt). The user wants
a second sample-playback surface: a [Strudel](https://strudel.cc)
REPL embedded directly in the dashboard, with its pattern output
routed through **our existing bridge** rather than Strudel's
default Node.js OSC bridge on port 8080.

Strudel is a JS reimplementation of TidalCycles — a powerful
algorithmic pattern language with mini-notation. Embedding it
gives us a much more expressive live-coding surface than the
8-slot SequencerPanel while reusing the same SuperDirt backend.

**Decisions made during planning:**
- **Library mode** (`@strudel/web`) — not the pre-built
  `@strudel/repl` web component. Gives us clean OSC routing
  through `DirtClient` with no bridge changes and no
  transport-hijack hacks.
- **Full Strudel editor UX** via `@strudel/codemirror` — syntax
  highlighting, error markers, mini-notation niceties identical
  to strudel.cc.
- **AGPL-3.0** acknowledged; repo stays `"private": true` and
  unpublished, so the strong copyleft obligations don't bite in
  practice yet. We'll add a one-line license note to the README
  during implementation.

## Approach

### 1. Add Strudel packages (lazy-loaded)

```bash
yarn add @strudel/core @strudel/mini @strudel/transpiler \
         @strudel/web @strudel/codemirror @strudel/tonal
```

The whole `src/strudel/` + `src/ui/StrudelPanel/` subtree gets
lazy-loaded behind `React.lazy()` so the ~500–1500 KB gzipped
Strudel runtime doesn't bloat the main bundle. Users who never
open the panel never pay the cost.

### 2. New `StrudelController` at `src/strudel/StrudelController.ts`

Mirrors `SequencerController`'s shape (constructor takes
`{ client: WorkerClient, dirtClient: DirtClient, clock:
ClockController }`, exposes reactive `ReadonlyStore<T>` stores,
has explicit `start()` / `stop()` / `evaluate(code)` /
`dispose()` methods).

Responsibilities:

- Hold the Strudel runtime instance (lazy-initialised on first
  panel mount via `initStrudel(...)` from `@strudel/web`).
- **Intercept pattern output** — replace Strudel's default OSC
  backend with a custom sink that translates each pattern event
  (Hap) into a `dirtClient.playAtTimetag(event, timetag)` call.
- Compute timetags from Strudel's scheduler time + our clock's
  `tick0Ms` so OSC bundles align sample-accurately with the
  shared scsynth audio clock (same pattern the sequencer uses).
- Surface `currentCode`, `evalError`, `isPlaying` as reactive
  stores for the UI.
- Forward Strudel's editor-level error stream (transpile errors,
  pattern eval errors) to our existing `ToastContainer` /
  `ServerErrorBus` style surface.

### 3. New `strudelOscSink.ts` at `src/strudel/strudelOscSink.ts`

The OSC-interception adapter. Strudel patterns emit events
shaped roughly `{ s: 'bd', n: 0, gain: 1, ... }` with onset times
in Strudel's cycle space. This module:

- Registers itself as Strudel's OSC backend via the documented
  hook (`setOscBackend()` or via `initStrudel()` options — need
  to read `@strudel/web` source at impl time to pick the right
  one).
- Translates each Hap to the `/dirt/play` arg layout
  `DirtClient` already expects.
- Computes the OSC timetag from the Hap's onset time + our
  `clock.tick0Ms` anchor.

**Design risk to confirm during impl**: Strudel's scheduler
runs inside a Web Worker. The OSC dispatch may need to either
(a) be moved to the main thread (if Strudel allows), or
(b) postMessage back to main where `DirtClient` lives. The
sequencer already faces the analogous problem (its pump is in
the OSC worker but `DirtClient` is main-thread); reuse that
pattern. If neither approach works cleanly, the fallback is to
disable Strudel's worker scheduler entirely and run patterns
on the main thread — Strudel supports this via a config flag.

### 4. New `StrudelPanel` under `src/ui/StrudelPanel/`

```
src/ui/StrudelPanel/
├── StrudelPanel.tsx       — root component, lazy-loaded
├── StrudelEditor.tsx      — CodeMirror wrapper using @strudel/codemirror
├── StrudelPanel.css       — panel styling (reuses ui-foundation tokens)
└── index.ts               — `export { default as StrudelPanel } from './StrudelPanel';`
```

`StrudelPanel.tsx` mounts the editor + Run/Stop toolbar + a
small event log (recent N pattern events, like the existing
`DirtPanel.recentEvents` surface). Subscribes to the controller's
reactive stores via `useSyncExternalStore`. Uses the
`.panel[aria-disabled="true"]` foundation styling pattern when
the session isn't connected (gated via `useSessionContext()`,
same as `SequencerPanel`).

`StrudelEditor.tsx` wires up `@strudel/codemirror`'s `EditorView`
inside a `useRef` + `useEffect` mount, exposing a controlled
`value` + `onChange` interface to its parent. Wire Ctrl-Enter →
`controller.evaluate(code)`.

### 5. Lazy-load wire-up in `AppShell.tsx`

```tsx
const StrudelPanel = lazy(() => import('@/ui/StrudelPanel'));
```

Mount inside `DashboardPanels()` after `SequencerPanel`, wrapped
in `<Suspense fallback={<StrudelPanelSkeleton />}>`. Construct
`StrudelController` in `setupDashboard` alongside the existing
controllers, dispose in `teardownServerState`.

### 6. README + CLAUDE.md note

- **README.md**: one paragraph in the "Sample playback" section
  introducing the Strudel panel + a `> Note: includes
  AGPL-3.0-licensed code from @strudel/*` line.
- **CLAUDE.md**: extend the Architecture-at-a-glance diagram's
  frontend section with the new `StrudelController` +
  `StrudelPanel`, briefly noting it's an alternative driver for
  SuperDirt that piggybacks on `DirtClient`.

## Critical files

**New:**
- `src/strudel/StrudelController.ts` — controller, ~150–200 LOC
- `src/strudel/strudelOscSink.ts` — OSC-interception adapter, ~80 LOC
- `src/ui/StrudelPanel/StrudelPanel.tsx` — root component, ~100 LOC
- `src/ui/StrudelPanel/StrudelEditor.tsx` — CodeMirror wrapper, ~80 LOC
- `src/ui/StrudelPanel/StrudelPanel.css`
- `src/ui/StrudelPanel/index.ts` — one-line re-export

**Edited:**
- `package.json` — add the `@strudel/*` deps.
- `src/AppShell.tsx`:
  - `DashboardPanels()` (around line 240–260) — mount
    `<StrudelPanel controller={resources.strudel} />` in the
    sibling JSX list, wrapped in `<Suspense>`.
  - `setupDashboard()` — construct `StrudelController` after
    `dirtClient`; pass to `DashboardResources`.
  - `teardownServerState()` — call `strudel.dispose()` before
    `dirtClient.dispose()`.
- `README.md` — Sample-playback section.
- `CLAUDE.md` — architecture diagram entry.

**Unchanged (verified during research):**
- All Rust bridge code under `src-tauri/src/`. Strudel events
  emit `/dirt/play` via the SAME `DirtClient` the sequencer
  uses; the bridge's existing `/dirt/*` regex route handles
  them with no change.
- `DirtClient` itself — `playAtTimetag()` already exists and is
  the right entry point. No new methods needed.
- `WorkerClient`, `oscWorker.ts`, `sequencerPump.ts` — Strudel
  goes through `DirtClient`, which goes through `WorkerClient`;
  no new transport surface.

## Existing patterns to reuse

- **Controller + Panel pair** — `src/sequencer/SequencerController.ts`
  + `src/ui/SequencerPanel/SequencerPanel.tsx` is the canonical
  template. Match its constructor shape, store-based reactivity,
  and `dispose()` discipline.
- **`DirtClient.playAtTimetag(event, timetag)`** at
  `src/dirt/DirtClient.ts` (~line 110) — exactly the API the
  Strudel→OSC adapter needs. Already tick-aligned via the same
  `tickToTimetag()` math the sequencer worker uses.
- **`tickToTimetag(tick0Ms, targetTick, tickRate)`** in
  `packages/server-commands/src/commands/clock.ts` (or similar
  — sequencer's worker pump uses it) — same helper for
  computing sample-accurate timetags from Strudel's scheduler
  time.
- **Disabled-panel styling** — `.panel[aria-disabled="true"]`
  from `@sc-app/ui-foundation`. `SequencerPanel` shows how to
  conditionally apply this based on `useSessionContext()`.
- **Reactive stores** — `createStore<T>()` from `src/util/reactiveStore`
  + `useSyncExternalStore` in the React layer. Same shape as
  every other controller.
- **Lazy-load pattern** — `WorkerClient.ts` already uses
  `new Worker(new URL(...), { type: 'module' })` for code-split
  workers; Vite 6 handles `React.lazy(() => import(...))`
  natively.

## Verification

1. **Install + type-check**:
   ```
   yarn add @strudel/core @strudel/mini @strudel/transpiler \
            @strudel/web @strudel/codemirror @strudel/tonal
   yarn tsc --noEmit
   ```
   Expect clean type-check with the new packages and the new
   `src/strudel/` + `src/ui/StrudelPanel/` modules.

2. **Bundle inspection** (sanity check on lazy-load):
   ```
   yarn build
   ls -lh dist/assets/*.js
   ```
   The main bundle's size shouldn't grow by more than ~10 KB
   (just the dynamic-import stub). The Strudel chunk should
   land as a separate ~500 KB–1.5 MB gzipped file.

3. **Cargo regression check** (no Rust changes, but cheap):
   ```
   cargo test --manifest-path src-tauri/Cargo.toml
   ```
   Expect 50 tests passing.

4. **Manual smoke test (SuperDirt flavor)**:
   - `yarn osc --flavor superdirt` — boots scsynth + SuperDirt.
   - `yarn tauri dev` — open the app.
   - Verify the Strudel panel appears, disabled until session
     connects.
   - Once connected, type into the editor:
     ```
     s("bd hh*2 sd hh").osc()
     ```
     Click Run. Confirm SuperDirt plays the pattern audibly
     and a scope on bus 0 shows the waveform.

5. **Manual smoke test (StrudelDirt flavor)**:
   - Same flow with `yarn osc --flavor strudeldirt`.
   - Same pattern should play identically (both forks accept
     `/dirt/play` with the same arg layout).
   - This is the real reason we vendored StrudelDirt in the
     previous shipped phase — to make this REPL feel native
     to its target audio engine.

6. **Disconnection behavior**:
   - Click Disconnect in the dashboard header.
   - Strudel panel should grey out (`aria-disabled="true"`,
     pointer-events: none) — same as the sequencer panel.
   - Reconnect → panel re-enables without state loss in the
     editor.

7. **Error surface**:
   - Type intentionally broken Strudel code (e.g. `s("`).
   - Expect a CodeMirror error marker + a transient toast via
     `useToasts` — same surface other controllers use.

## Risks / gotchas to surface during implementation

1. **OSC backend hook in `@strudel/web`** — the Explore-agent
   research found the OSC pipeline at a high level but did NOT
   find a single canonical "setOscBackend(fn)" call. Need to
   read `@strudel/web`'s source at impl time to confirm the
   exact hook. Fallback paths if no clean hook exists:
   (a) replace the global `osc()` pattern method,
   (b) hook `Pattern.queryArc` and dispatch ourselves,
   (c) monkey-patch `@strudel/osc`'s WebSocket constructor.
   Document whichever lands.
2. **Worker boundary for OSC dispatch** — Strudel's scheduler
   is worker-based. Either move OSC dispatch to main, or wire
   a postMessage hop, or disable the worker scheduler. The
   first viable option wins; document the choice.
3. **Bundle bloat if lazy-load misfires** — Vite tree-shaking +
   chunking should keep main bundle clean, but verify with
   `yarn build` + the lighthouse `dist/` directory listing
   before declaring victory.
4. **CodeMirror theming** — Strudel's CodeMirror theme may
   clash with our dark theme tokens. v1 accepts whatever
   Strudel ships; cosmetic polish is a follow-up.
5. **AGPL license note** — must land in README before any
   distribution. Reminder in the impl checklist.
6. **Strudel CPU at high pattern density** — patterns like
   `s("bd*32")` can hammer the scheduler. If we see audio
   glitches, lower the lookahead or document the CPU limit.
7. **Two simultaneous drivers** — both the SequencerPanel AND
   Strudel can emit `/dirt/play` at once. Acceptable; SuperDirt
   handles overlapping orbits. But document that the user
   should typically use one at a time to avoid confusion.
