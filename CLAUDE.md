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
  ├── ClockController           global /tr-driven clock + timetag anchor
  ├── GroupController           parent group lifecycle (/g_new /n_run)
  ├── SynthDefRegistry          idempotent /d_recv tracker
  └── WorkerClient              postMessage wrapper around…
      │
      ▼
Scope Worker (module worker)
  ├── workerBootstrap.ts        sync message buffer + osc-js window shim
  ├── transport.ts              raw binary WebSocket
  └── scopeWorker.ts            decode inbound + forward outbound bytes
      │
      ▼
src-tauri backend (Rust)
  └── server/ws_bridge.rs       WS ↔ UDP datagram bridge → scsynth
```

Every OSC command flows: main thread (encode) → worker (forward bytes)
→ WebSocket → bridge → UDP → scsynth.
Every reply flows the inverse: scsynth → UDP → bridge → WS → worker
(decode, mux clock `/tr`) → main thread (plain `{ address, args }`
POJOs via structured clone).

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
  sample-accurate tick-aligned commands.
- **SynthDefs**: `src/synth/*.ts`, one file per SynthDef, each
  exporting a `compile*SynthDef(…)` that caches at module scope
  and uses the `synthdef(name, fn)` sugar API.
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

Current phase progress: Phase 5 shipped. `plan.md` has been
updated through this point.

## Where scsynth conventions matter

- **IDs**: `IdAllocator(1000)` for nodes and buffers,
  `IdAllocator(32)` for buses (skip hardware-reserved buses).
  Parent group is `100` by convention.
- **Reserved trigIds**: `CLOCK_TRIG_ID = 1000` is reserved for the
  global clock synth's `SendTrig`; the worker muxes on that id.
  Any other `/tr` flows through `onReply`.
- **`/notify 1`** is sent on connect — scsynth only broadcasts
  async messages (`/tr`, `/n_go`, `/done`, …) to notified clients.
- **Timing**: the server's audio clock is the truth.
  `ClockController` captures a `tick0Ms` anchor on the first
  `/tr`, extrapolates forward. The main-thread clock is only used
  for freshness watchdogs, never as the truth.

## Gotchas to not relearn

- **`performance.now()` differs between the main thread and the
  worker** — worker `timeOrigin` ≥ window `timeOrigin`. Stamp
  freshness timestamps on whichever thread reads them.
- **`OSC.Message` instances don't survive `postMessage`** —
  structured clone strips the prototype. The worker decodes,
  flattens bundles, and posts plain `{ address, args }` POJOs.
- **osc-js needs `window`** in any context where it might be
  loaded — workers get it via the bootstrap shim.
- **SC's OSC int/float inference**: osc-js uses `%1 === 0` to
  pick between `int32` and `float32` tags. Whole-number floats
  go as int; that matches sclang and scsynth accepts it.
