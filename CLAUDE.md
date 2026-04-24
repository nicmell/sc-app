# CLAUDE.md

Project-specific guidance for Claude Code working in this repo.

## What this is

**sc-app** — a browser-first oscilloscope + WAV recorder for
[SuperCollider's](https://supercollider.github.io/) `scsynth`. Runs
as a Tauri desktop app or a standalone HTTP server (`yarn serve`).
Everything renders in the browser; the Rust side is a thin
WS↔UDP bridge between the frontend worker and scsynth.

**scsynth is not managed by this app** — it's expected to be already
running at `127.0.0.1:57110` (or wherever the Connect screen points).

Full design doc lives in `plan.md`. Phase-by-phase acceptance
criteria are in there too.

## Architecture at a glance

```
Browser (React, main thread)
  ├── AppShell                  connect ↔ dashboard orchestration
  ├── ClockController           global /tr-driven clock; tick0Ms anchor;
  │                             clockBus phasor; probePhase() diagnostic
  ├── GroupController           parent group lifecycle (/g_new /n_run)
  ├── SynthDefRegistry          idempotent /d_recv tracker
  ├── BufferPoker               manual /b_getn → /b_setn helper (Phase 7)
  └── WorkerClient              postMessage wrapper around…
      │   - sendCommand / onReply / onError / onTick
      │   - subscribeScope(sub, cb) — tick-driven /b_getn pipeline
      ▼
Scope Worker (module worker)
  ├── workerBootstrap.ts        sync message buffer + osc-js window shim
  ├── transport.ts              raw binary WebSocket
  └── scopeWorker.ts            decode inbound + forward outbound bytes
                                + clock /tr mux + scope subscription
                                table + tick-driven /b_getn dispatch
      │
      ▼
src-tauri backend (Rust)
  ├── server/ws_bridge.rs       WS ↔ UDP datagram bridge → scsynth
  └── tauri-plugin-{dialog,fs,opener}  native save-as / file IO / etc.
```

Every OSC command flows: main thread (encode) → worker (forward bytes)
→ WebSocket → bridge → UDP → scsynth.
Every reply flows the inverse: scsynth → UDP → bridge → WS → worker
(decode, mux clock `/tr`, intercept subscribed `/b_setn`) → main
thread (plain `{ address, args }` POJOs via structured clone, or
`scopeChunk` events with zero-copy `Float32Array`).

The scope-data path is special: on each clock `/tr` the worker
fires `/b_getn` for every subscribed buffer (wrapped in an
`OSC.Bundle` with `timetag = Date.now() + READ_DELAY_MS` so
scsynth's scheduler holds the read past the kr-vs-ar slop
between `Impulse.kr` and `Phasor.ar`); the matching `/b_setn`
replies are intercepted in the worker and posted to main as
`scopeChunk` events keyed by `scopeId`. `ScopeView` runs an RAF
loop that reads the latest chunk from a ref and draws the
waveform — data rate (48 Hz) and render rate (60+ Hz) are
intentionally decoupled.

## Workspace layout

This is a yarn (v4) workspace. Two local packages under `packages/`
are referenced from the app via `workspace:*`:

- **`packages/server-commands/`** (`@sc-app/server-commands`) — OSC
  layer over [`osc-js`](https://github.com/adzialocha/osc-js).
  Command constructors per OSC address, `encode` / `decode`,
  bundle + timetag helpers, typed reply accessors. The runtime is
  pure JS and works in both main thread and worker contexts (with
  a `window = globalThis` shim in the worker — see
  `src/workers/workerBootstrap.ts`).

- **`packages/synthdef-compiler/`** (`@sc-app/synthdef-compiler`) —
  pure-TS SynthDef (SCgf v2) compiler. Three API layers:
  - `synthdef(name, (g, { controls }) => …)` — sclang-style
    callback (what `src/synth/*.ts` uses).
  - Typed chainable builders (`@sc-app/synthdef-compiler/builders`)
    — one class per bundled UGen (365 shipped).
  - Low-level `SynthDef.addControl` / `addUgen` for stringly-typed
    programmatic construction.

Both packages have their own README with usage details. The
`src-tauri/` Rust crate is the desktop/CLI backend — nothing audio
happens there, it just forwards bytes.

## Common commands

```bash
yarn install                   # yarn 4 workspaces
yarn dev                       # Vite dev server (port 1420)
yarn tauri dev                 # Tauri desktop app in dev mode
yarn serve                     # standalone HTTP+WS server via Rust CLI
yarn build                     # type-check + Vite production build
yarn tsc --noEmit              # type-check only (fast)

# Inside packages/synthdef-compiler/
yarn test                      # vitest suite (41 tests)
yarn parity                    # optional sclang byte-diff harness
```

There is no wasm build step anymore — both TS packages resolve to
their sources via Vite aliases; tsc handles types.

## Code conventions

- **React in `src/ui/` only.** Controllers (`src/scope/`) are plain
  TypeScript classes exposing `ReadonlyStore<T>` observables. UI
  subscribes via `useSyncExternalStore`.
- **`@/…` alias** → `src/…`. `@sc-app/…` → workspace packages.
- **OSC**: construct `OSC.Message` / `OSC.Bundle` on the main
  thread using `@sc-app/server-commands` helpers. Pass to
  `WorkerClient.sendCommand(packet)` — it encodes locally and
  posts bytes to the worker.
- **Replies**: `client.onReply(({ address, args }) => …)`. Match
  on `address`; read args positionally or via the typed accessors
  (`Tr`, `Synced`, `Fail`, `StatusReply`, `BSetnReply`, `NodeEvent`).
- **Scheduling**: wrap latency-sensitive commands in
  `new OSC.Bundle([msg], inFuture(200))` or
  `tickToTimetag(clock.tick0Ms, targetTick, params.tickRate)` for
  sample-accurate tick-aligned commands. *Note*: scsynth's OSC
  scheduler is calibrated against the audio callback and can drift
  10–20 ms from `Date.now()`; bundles whose timetag is "in the
  past" per scsynth log a `late 0.0XX` message and run
  immediately. Harmless — the timetag is still useful as a
  *minimum* delay against kr-quantization slop.
- **SynthDefs**: `src/synth/*.ts`, one file per SynthDef, each
  exporting a `compile*SynthDef(…)` that caches at module scope
  and uses the `synthdef(name, fn)` sugar API.
- **Scope rendering**: don't put per-chunk data in React state —
  data arrives at 48 Hz and would force 48 panel re-renders/sec.
  Write incoming chunks to a `useRef<ScopeChunk | null>(null)`;
  `ScopeView` runs an internal RAF loop that reads the ref and
  draws. React state is reserved for *control* changes
  (Subscribe/Unsubscribe, gain, etc.).
- **Tauri vs serve dispatch**: import `IS_TAURI` from
  `@/scope/runtime` and gate platform-specific behaviour on it.
  Inside the Tauri branch, use dynamic `import('@tauri-apps/...')`
  so Vite code-splits the plugin chunks — serve users don't pay
  the bundle cost. Pattern: native save-as via
  `dialog.save() + fs.writeTextFile()` falling back to
  `<a href={blobUrl} download={…}>` in the browser.
- **Tests / parity harnesses live inside packages**, not in `src/`.

## Phase discipline (working through plan.md)

Plan follows phases 0–13. When working on a phase:

1. Re-read the phase in `plan.md` before implementing.
2. Propose any improvements; ask before making substantive
   deviations from the plan.
3. After landing, update `plan.md` under the phase's
   "Files (as landed)" / "Adaptations" subsection to reflect
   what actually shipped.
4. Commit per phase (or per natural break within a phase).

Current phase progress: **Phase 9 shipped**. `plan.md` is updated
through Phase 9 inclusive. ScopeController is intentionally
deferred to Phase 11 (multi-scope) — Phase 8/9 use
`WorkerClient.subscribeScope` directly from the panel, no
per-scope class yet.

## Where scsynth conventions matter

- **IDs**: `IdAllocator(1000)` for nodes and buffers,
  `IdAllocator(32)` for buses (skip hardware-reserved buses).
- **Parent group**: derived from the scsynth-assigned clientId
  returned by `/done /notify`, as `clientId × 100`. Falls back to
  the literal `100` when scsynth returns `clientId = 0` (the
  default single-client case, where `0 × 100 = 0` would clash
  with the root group). The fallback path warns in the debug log.
- **Group ordering invariant** (documented at the top of
  `ClockController.ts`): the clock synth lives at the *head* of
  the parent group; **everything else** (scopes, recorders, the
  monitor, the dev probe) MUST be `/s_new`'d with `AddToTail` so
  scsynth processes them after the clock on every control block.
  Otherwise consumers read the *previous* control block's
  `clockBus` value — a constant ~1.3 ms lag that breaks
  alignment.
- **Reserved trigIds**:
  - `CLOCK_TRIG_ID = 1000` — global clock's `SendTrig`. The
    worker demuxes these into `clockTick` events, suppressing
    them from the generic `onReply` channel.
  - `PHASE_PROBE_TRIG_ID = 9001` — the dev `phaseProbe` synth.
    Flows through `onReply` like any other `/tr`.
  No other synth may reuse these ids.
- **Connect handshake** (in order, all in `AppShell.handleConnect`):
  1. `/status` probe — verifies the chain is alive; reads
     `actualSampleRate` from `args[8]` and rejects the connect
     if it differs from `DEFAULT_ENV.sampleRate` by more than
     0.5 Hz (Phase 6+ alignment math goes wrong silently
     otherwise).
  2. `/notify 1` via `sendAndAwaitReply` matching `/done /notify`,
     captures the assigned `clientId` for parent-group
     derivation. Required — scsynth doesn't broadcast async
     replies (`/tr`, `/n_go`, `/done`) to un-notified clients.
  3. `bringUpDashboard` — constructs `GroupController`,
     `ClockController` (allocates `clockBus = ids.bus.next()`),
     calls `clock.start()`.
- **Disconnect cleanup** (best-effort; covers serve mode + Tauri):
  - **`handleDisconnect`** (button click): `clock.dispose()` →
    `group.free()` → `client.sendAndSync(notify(0))` →
    `client.dispose()`. Each step independently try/caught.
  - **`pagehide` listener** (tab/window close): fire-and-forget
    `gFreeAll(parentGroupId) + nFree(parentGroupId) + notify(0)`.
    Best-effort — worker postMessage + WS send usually flush
    before the browser reaps the tab; if not, the leaked group
    survives until next reconnect's defensive cleanup. Hard
    SIGKILL of `serve` still leaks; not currently addressed.
- **Timing**: the server's audio clock is the truth.
  `ClockController` captures a `tick0Ms` anchor on the first
  `/tr`, extrapolates forward. The main-thread clock is only used
  for freshness watchdogs, never as the truth. For sample-accurate
  scheduling, use `tickToTimetag(clock.tick0Ms!, targetTick,
  params.tickRate)` in an `OSC.Bundle`.

## Gotchas to not relearn

- **`performance.now()` differs between the main thread and the
  worker** — worker `timeOrigin` ≥ window `timeOrigin`. Stamp
  freshness timestamps on whichever thread reads them.
- **`OSC.Message` instances don't survive `postMessage`** —
  structured clone strips the prototype. The worker decodes,
  flattens bundles, and posts plain `{ address, args }` POJOs.
- **osc-js needs `window`** in any context where it might be
  loaded — workers get it via the bootstrap shim
  (`globalThis.window = globalThis` in `workerBootstrap.ts`,
  before any `osc-js` import).
- **SC's OSC int/float inference**: osc-js uses `%1 === 0` to
  pick between `int32` and `float32` tags. Whole-number floats
  go as int; that matches sclang and scsynth accepts it.
- **`Impulse.kr(freq, phase=0)` fires at t=0**, not at
  `t = 1/freq`. So tick `N` corresponds to audio frame
  `(N-1) × samplesPerTick`, *not* `N × samplesPerTick`. The
  `completedHalf` parity in `scopeWorker.fireReads` is therefore
  `tickIndex % 2` — cost us a debugging session in Phase 8 to
  realise the original derivation was off by one. If you see
  half-cycle phase jumps in the scope, check this first.
- **kr/ar timing slop between `Impulse.kr` and `Phasor.ar`** —
  the tick fires kr-quantised (≤ 64 ar samples = ~1.3 ms of
  jitter at sr 48 k); the scope's `writeIdx` advances against an
  exactly-aligned `Phasor.ar` wrap. Bare `/b_getn` at tick time
  can clip the tail of the half mid-write. Mitigated by wrapping
  every `/b_getn` in an `OSC.Bundle` with `timetag = Date.now() +
  READ_DELAY_MS` (5 ms) — see `src/config/clockConfig.ts` for the
  constant.
- **scsynth's OSC clock vs. wall clock** — scsynth calibrates
  its OSC scheduling clock against the audio callback, which
  drifts 10–20 ms from `Date.now()` in practice. Bundles whose
  `Date.now()`-derived timetag lands "in the past" per scsynth
  log a `late 0.0XX` message in the scsynth console and run as
  soon as possible. Not a bug — the timetag is still useful as a
  *floor* on the scheduling delay (see kr/ar slop above).
- **Subscribed bufnums vs. `BufferPoker`** — once a scopeId is
  subscribed via `subscribeScope`, the worker intercepts every
  `/b_setn` for that bufnum and routes it to `scopeChunk`
  listeners. A `BufferPoker.poke()` against the same bufnum will
  hang because its expected `onReply` callback never fires.
  `ScopeTestPanel` disables the **Poke** button while
  subscribed for this reason.
- **Tauri vs serve build deltas**: `src-tauri/capabilities/default.json`
  scopes `fs:allow-write-{file,text-file}` to `$DOCUMENT`,
  `$DOWNLOAD`, `$AUDIO`, `$DESKTOP`, `$HOME`. If a save target
  outside those roots starts failing in Tauri, extend the scope
  list there — not by removing the gate altogether.
