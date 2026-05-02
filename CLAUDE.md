# CLAUDE.md

Project-specific guidance for Claude Code working in this repo.

## What this is

**sc-app** — a browser-first oscilloscope + WAV recorder for
[SuperCollider's](https://supercollider.github.io/) `scsynth`. Runs
as a Tauri desktop app or a standalone HTTP+WS bridge (`yarn bridge`).
Everything renders in the browser; the Rust side is a thin
WS↔UDP bridge between the frontend worker and scsynth, optionally
also serving the bundled `dist/` over HTTP.

**scsynth is not managed by this app** — it's expected to be already
running at `127.0.0.1:57110` (or wherever the Connect screen points).

Forward-looking design lives in `plan.md` (pending phases, open
questions, acceptance criteria); the historical record of shipped
phases — what landed and why — is in [`docs/history.md`](./docs/history.md).

## Architecture at a glance

```
Browser (React, main thread)
  ├── AppShell                  connect ↔ dashboard orchestration
  ├── ClockController           global /tr-driven clock; tick0Ms anchor;
  │                             clockBus phasor
  ├── GroupController           parent group lifecycle (/g_new /n_run)
  ├── SynthDefRegistry          idempotent /d_recv tracker
  ├── SynthManager + Synth-     producers: tone synths writing sines
  │   Controller                 onto auto-allocated bus blocks; live
  │                              freq / amp / gate controls
  ├── BufferManager + Buffer-   shared layer: ref-counted (inputBus,
  │   Controller                 channels, chunkSize)-keyed taps. ONE
  │                              tap synth + buffer + worker sub per
  │                              spec, fanned out to N consumers.
  ├── ScopeManager + Scope-     consumers: take a user-typed bus,
  │   Controller                 acquire a BufferHandle, subscribe to
  │                              its chunk stream, render via ScopeView.
  ├── RecordingManager + Re-    consumers: take a user-typed bus,
  │   cordingController          acquire a BufferHandle, run the WAV
  │                              writer + envelope buffer + gap log
  │                              off the same chunk stream.
  ├── DirtClient                SuperDirt OSC client over the SAME
  │                              WorkerClient — encodes /dirt/play +
  │                              /dirt/hello + /dirt/listSamples,
  │                              filters /dirt/* replies from the
  │                              shared onReply pump; `sampleBanks`
  │                              reactive store for autocomplete.
  ├── PatternBank +             8-slot reactive store + debounced
  │   SequencerController +      localStorage. SequencerController
  │   SequencerPanel             reads bank.activePattern, drives
  │                              SuperDirt via dirtClient.playAtTimetag
  │                              with tick-anchored OSC bundles. Chain
  │                              mode advances bank.activeIndex at
  │                              cycle boundaries.
  ├── ServerErrorBus            decoded /fail ring, surfaced via
  │                              DebugLog header badge.
  └── WorkerClient              postMessage wrapper around…
      │   - sendCommand / onReply / onError / onTick
      │   - subscribeBuffer(sub, cb) — tick-driven /b_getn pipeline
      ▼
OSC Worker (module worker)
  ├── workerBootstrap.ts        sync message buffer + osc-js window shim
  ├── transport.ts              raw binary WebSocket
  └── oscWorker.ts              decode inbound + forward outbound bytes
                                + clock /tr mux + bufferId-keyed
                                subscription table with offset-keyed
                                pending + tick-ordered reorder buffer
      │
      ▼
src-tauri backend (Rust)
  ├── cli/
  │   ├── mod.rs                clap parsing + dispatch + precedence
  │   ├── gui.rs                Tauri Builder + window for desktop mode
  │   └── bridge.rs             headless `bridge` subcommand entry
  ├── config.rs                 `config.json` schema + load helpers +
  │                              starter-config OnceLock
  ├── logging.rs                tracing init (stderr + daily-rotated file)
  ├── server/
  │   ├── mod.rs                axum router, bind/serve_on/run_bridge
  │   ├── ws_bridge.rs          WS ↔ UDP bridge with N+1 sockets per
  │   │                          session (one per route target),
  │   │                          outbound prefix demux + reply fan-in
  │   ├── routing.rs            RoutingTable + peek_osc_address —
  │   │                          config.json `routes` ⟹ N targets
  │   ├── session.rs            per-WS state (clientId snoop + cleanup)
  │   └── static_assets.rs      SPA fallback + dist resolution
  └── tauri-plugin-{dialog,fs,opener}  native save-as / file IO / etc.

External services (config-driven, addressable via `routes`):
  scsynth                       127.0.0.1:57110  (default route target)
  sclang+SuperDirt              127.0.0.1:57120  (/dirt/* prefix)
```

`SynthManager` is the producer surface — it auto-allocates bus
blocks via `IdAllocator.nextBlock(channels)` and `/s_new`s tone
synths writing sines onto them. `ScopeManager` /
`RecordingManager` are the consumer surface — they take a
user-typed bus number, acquire a shared `BufferHandle` from
`BufferManager`, and subscribe to its chunk stream. Two consumers
on the same `(inputBus, channels, chunkSize)` triple share one
tap synth + one buffer + one worker subscription; the manager
ref-counts and tears down on last release. The typical flow: add
a synth in the Synths panel, read its bus off the card, type that
bus into the Scopes / Recordings panel.

Every OSC command flows: main thread (encode) → worker (forward bytes)
→ WebSocket → bridge → **route table prefix-match** → UDP → scsynth
or sclang+SuperDirt. Every reply flows the inverse: target → UDP →
bridge → WS → worker (decode, mux clock `/tr`, intercept subscribed
`/b_setn`) → main thread (plain `{ address, args }` POJOs via
structured clone, or `bufferChunk` events with zero-copy
`Float32Array`). The bridge picks the route socket by peeking the
OSC address against `config.json -> routes` (`/dirt → 57120` is the
SuperDirt route; everything else falls through to the default
target = `scsynth` config field).

The buffer-data path is special: on each clock `/tr` the worker
fires `/b_getn` for every subscribed bufferId (wrapped in an
`OSC.Bundle` with `timetag = Date.now() + READ_DELAY_MS` so
scsynth's scheduler holds the read past the kr-vs-ar slop
between `Impulse.kr` and `Phasor.ar`); the matching `/b_setn`
replies are intercepted in the worker, slotted into the per-
buffer `reorderBuffer`, and emitted in tick order as `bufferChunk`
events. `ScopeView` runs an RAF loop that reads the latest chunk
from a ref and draws the waveform — data rate (48 Hz) and render
rate (60+ Hz) are intentionally decoupled.

## Workspace layout

This is a yarn (v4) workspace. Three local packages under
`packages/` are referenced from the app via `workspace:*`:

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
    callback (what `src/synthdefs/*.ts` uses).
  - Typed chainable builders (`@sc-app/synthdef-compiler/builders`)
    — one class per bundled UGen (365 shipped).
  - Low-level `SynthDef.addControl` / `addUgen` for stringly-typed
    programmatic construction.

- **`packages/ui-foundation/`** (`@sc-app/ui-foundation`) —
  framework-agnostic CSS package (Phase 28). Open Props
  primitives + semantic tokens (`--color-*`, `--space-*`,
  `--radius-*`, `--font-*`) + reset + base element styles
  (button / input / select / textarea with `data-variant` /
  `data-size` variants) + a small set of semantic component
  classes (`.panel`, `.cluster`, `.stack`, `.status-pill`,
  `.badge`, `.range-field`, `.empty`, `.error`, `.modal*`).
  Loaded by `src/main.tsx` via `import '@sc-app/ui-foundation';`.
  PostCSS produces `dist/index.css` for future runtime HTML
  plugins to load via `<link rel="stylesheet">` and inherit the
  host palette via the global cascade. Contract: every `--color-*`
  / `--space-*` token name is public API, renaming is breaking.

Each package has its own README with usage details. The
`src-tauri/` Rust crate is the desktop/CLI backend — nothing audio
happens there, it just forwards bytes.

## Common commands

```bash
yarn install                   # yarn 4 workspaces
yarn dev                       # Vite dev server (port 1420), frontend only
yarn dev:full                  # Vite + bridge concurrently (browser-only dev)
yarn bridge                    # standalone WS↔UDP bridge via Rust CLI (port 3000)
yarn tauri dev                 # Tauri desktop app in dev mode (Vite + bridge auto)
yarn build                     # type-check + Vite production build
yarn tsc --noEmit              # type-check only (fast)
yarn tauri build               # produce platform bundle (.app/.dmg/.deb/AppImage)

# Inside packages/synthdef-compiler/
yarn test                      # vitest suite (41 tests)
yarn parity                    # optional sclang byte-diff harness
```

`yarn dev:full` is the browser-only dev loop: Vite serves the SPA on
:1420 with HMR, the Rust bridge runs on :3000, and Vite's
`server.proxy` forwards `/ws` to the bridge so the frontend uses
same-origin WS without env-var indirection. `yarn tauri dev` is the
desktop dev loop — same Vite + same proxy, but Tauri's webview
loads :1420 instead of an external browser.

There is no wasm build step anymore — both TS packages resolve to
their sources via Vite aliases; tsc handles types.

## Asset bundling and the dist/ contract

The Rust binary has two modes: GUI (default, no subcommand) and
`bridge` subcommand. They share the same axum server; the
difference is whether a `tauri::Builder` runs around it:

- **GUI** (`tauri build` artifact, `tauri dev`, plain `cargo run`):
  goes through `Builder::run()`, opens a webview window. The window
  navigates to `http://127.0.0.1:<port>/` in release builds (axum
  serves `dist/` from the bundle's resource dir) or to
  `devUrl: http://localhost:1420` in debug builds (Vite). The
  cfg-gate is `cfg!(debug_assertions)`.
- **Bridge** (`sc-app bridge` subcommand): plain tokio + axum, no
  `tauri::Builder`. On Linux this means **no GTK init** — the
  binary runs cleanly under systemd on a headless host. The
  `dist/` directory is resolved via
  `tauri::utils::platform::resource_dir(&pkg_info, &env)` (the
  library form of `AppHandle::path().resource_dir()`), or via
  `--dist` override, or skipped entirely (in which case axum
  answers only `/ws`).

`dist/` ships exactly once via `bundle.resources: ["../dist"]` in
`tauri.conf.json`. There is **no `frontendDist`** — the Tauri
`tauri://` protocol is unused. Both the webview (production) and
external browsers hit the same axum static fallback. Inside the
bundle the files land at `<resource_dir>/_up_/dist/` because Tauri
re-bases the leading `..` to `_up_` when copying resources; the
constant `DIST_SUBPATH` in `server/static_assets.rs` captures this,
alongside the `resolve_bundled_dist()` helper used by the bridge
subcommand.

## Runtime config (`config.json`)

Both modes consult an optional `config.json` for `port`, `scsynth`,
and `log_dir`. Schema lives in `src-tauri/src/config.rs` (`Config`
struct, `deny_unknown_fields` so typos error out). All fields are
`Option<…>`; missing fields fall through.

Discovery:

- **GUI mode** reads `app.path().app_config_dir()/config.json` and
  writes a starter file (`port` + `scsynth` defaults) on first
  launch via `Config::write_default_if_missing`. Subsequent
  launches never overwrite the user's edits.
- **Bridge mode** uses `--config <path>` if explicitly passed (must
  exist; fails loudly otherwise), else auto-discovers
  `/etc/sc-app/config.json` (silent if absent).

Precedence (highest → lowest):

1. CLI flag (bridge only — `--port`, `--scsynth`, `--log-dir`)
2. Env var (`SC_PORT`, `SC_SCSYNTH_ADDR`)
3. `config.json` value
4. Built-in default (3000 / `127.0.0.1:57110` / stderr-only)

`dist` is intentionally *not* in the config schema — it has its own
resolution path (resource_dir auto-resolves in bundle, `--dist`
overrides) and adding it would just create a duplicate knob. Same
reasoning kept it out of the env-var surface earlier.

Frontend asset URLs are always same-origin: `wsUrlFor` in
`AppShell.tsx` builds from `window.location.origin`, no env-var
indirection. In dev (`yarn dev` / `yarn tauri dev`) the origin is
Vite's `:1420`; Vite's `/ws` proxy forwards the WebSocket upgrade
to the bridge. In production (Tauri webview pointed at axum, or a
remote browser hitting a deployed bundle) the origin already *is*
the bridge.

## Code conventions

- **React in `src/ui/` only.** Controllers are plain TypeScript
  classes exposing `ReadonlyStore<T>` observables; UI subscribes
  via `useSyncExternalStore`. Controllers live in feature folders:
  `src/buffer/` (shared `BufferController` + `BufferManager` for
  ref-counted tap synths), `src/scope/` (scope visualization),
  `src/synth/` (runtime tone synths), `src/recording/` (recordings
  + WAV writer), `src/clock/` (`ClockController`). The
  scsynth-transport layer is in `src/server/` (`WorkerClient`,
  `workerProtocol`, `GroupController`, `SynthDefRegistry`,
  `IdAllocator`, `serverInfo`). Cross-cutting utilities are in
  `src/util/` (`reactiveStore`, `debugLog`, `runtime`).
  `AppShell.tsx` is at `src/`. SynthDef byte compilers (one file
  per SynthDef) live in `src/synthdefs/` — distinct from the
  runtime synth controllers in `src/synth/`.
- **`@/…` alias** → `src/…`. `@sc-app/…` → workspace packages.
- **Styling (Phase 28+).** `@sc-app/ui-foundation` owns design
  tokens (`--color-*`, `--space-*`, `--radius-*`, `--font-*`,
  `--shadow-*`), base element styles, and a small set of
  semantic component classes (`.panel`, `.cluster`, `.stack`,
  `.status-pill`, `.badge`, `.range-field`, `.empty`, `.error`,
  `.modal*`). Plain CSS, no Sass. Variants via `data-*`
  attributes (`<button data-variant="danger">`, `<span class=
  "status-pill" data-variant="ok">`). Per-panel styles in
  `src/ui/*/*.scss` are deprecated and migrate to the
  foundation's vocabulary panel-by-panel during Phase 28e;
  during the transition the per-panel SCSS shadows the
  foundation rules (later cascade order). Hardcoded hex colours
  outside `themes/{dark,light}.css` are a regression — open the
  PR with a token name instead.
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
- **SynthDefs**: `src/synthdefs/*.ts`, one file per SynthDef, each
  exporting a `compile*SynthDef(…)` that caches at module scope
  and uses the `synthdef(name, fn)` sugar API. The folder is
  deliberately named `synthdefs` (not `synth`) to disambiguate
  from `src/synth/` which holds the *runtime* tone-synth wrappers
  (`SynthController`, `SynthManager`).
- **Scope rendering**: don't put per-chunk data in React state —
  data arrives at 48 Hz and would force 48 panel re-renders/sec.
  Write incoming chunks to a `useRef<BufferChunk | null>(null)`;
  `ScopeView` runs an internal RAF loop that reads the ref and
  draws. React state is reserved for *control* changes
  (Subscribe/Unsubscribe, gain, etc.).
- **Tauri vs serve dispatch**: import `IS_TAURI` from
  `@/util/runtime` and gate platform-specific behaviour on it.
  Inside the Tauri branch, use dynamic `import('@tauri-apps/...')`
  so Vite code-splits the plugin chunks — serve users don't pay
  the bundle cost. Pattern: native save-as via
  `dialog.save() + fs.writeTextFile()` falling back to
  `<a href={blobUrl} download={…}>` in the browser.
- **Tests / parity harnesses live inside packages**, not in `src/`.

## Phase discipline (working through plan.md / history.md)

The project plan is split:

- **`plan.md`** is the *forward-looking* spec — project overview,
  pending phases planned in detail (open questions, file maps,
  acceptance criteria, cross-cutting risks). Small enough to
  re-read in full at the start of each new phase.
- **`docs/history.md`** is the *append-only* historical record —
  one entry per shipped phase (goal, what shipped, decisions,
  gotchas). Canonical lookup for "why did we decide X".

When working on a phase:

1. Re-read the phase in `plan.md` before implementing.
2. Propose any improvements; ask before making substantive
   deviations from the plan.
3. While the phase is in flight, update `plan.md` under that
   phase's "Files (as landed)" / "Adaptations" subsection to
   reflect what actually shipped.
4. Commit per phase (or per natural break within a phase).
5. **When the phase is fully done**, *move* its entry from
   `plan.md` to `docs/history.md` under a new section, trim
   `plan.md` of the moved content, and (if relevant) update
   the "Current phase progress" line below.

Current phase progress: **Phase 28 in flight (28a–d shipped,
28e–f pending) — Shared UI foundation package.** Goal: pull
design tokens + base element styles + semantic component
classes out of the React app into `@sc-app/ui-foundation`, a
framework-agnostic CSS package shared between the React host
(today) and future runtime HTML plugins (light DOM, inheriting
via the global cascade). 28a scaffolded the package + PostCSS
build pipeline (`dist/index.css` for plugin runtime). 28b
filled `tokens/semantic.css` + `themes/dark.css` (full
`--color-*` / `--space-*` / `--radius-*` / `--font-*` /
`--shadow-*` vocabulary, including the 9 hardcoded hexes
promoted to `--color-tx`, `--color-rx`, `--color-log-*`,
`--color-overlay`) plus `reset.css` + `base/elements.css` +
`base/typography.css`, with `demo.html` as the regression
gate. 28c proved the reference Button via ConnectScreen —
its submit button is now plain `<button type="submit">…</button>`
picking up styling from the foundation. 28d filled the
component primitive classes (`.panel`, `.cluster`, `.stack`,
`.status-pill[data-variant=…]`, `.badge`, `.range-field`,
`.empty`, `.error`, `.modal*`). Per-panel SCSS still shadows
the foundation in the running app — 28e migrates each panel
one commit at a time (12 panels in priority order, smallest
first); 28f closes Phase 28 by deleting `src/styles.scss`,
removing `sass` from devDependencies, and moving the
consolidated entry to `docs/history.md`. See `plan.md` for
the panel order + acceptance criteria.

Phase 27 shipped — Step Sequencer for SuperDirt. Four
sub-phases delivered the panel end-to-end (27a MVP grid, 27b
per-step/per-track parameter overrides, 27c PatternBank +
localStorage persistence, 27d chain mode). See
`docs/history.md` Phase 27 for the consolidated write-up.

Earlier landings still in effect: SuperDirt via bridge-internal
OSC router (Phase 26) — frontend keeps exactly one
`WorkerClient` / one `/ws`; the bridge's `RoutingTable`
demuxes outbound packets by OSC-address prefix, with
`/dirt → 127.0.0.1:57120` as the first non-default target.
GroupController defaults to `AddToTail` so sc-app's parent group
sits after sclang's defaultGroup; node + buffer `IdAllocator`
scoped per-clientId (`idBase = clientId * 1_000_000 + 1000`).
Producer/consumer split (Phase 15) — `SynthManager` +
`SynthsPanel` are producers; scopes and recordings are pure
consumers of user-typed bus numbers. Shared Buffer Layer
(Phase 16–21) — `BufferController` + `BufferManager` ref-count
`(inputBus, channels, chunkSize)`-keyed taps. Bundle & Dev
Workflow Refresh (Phase 25) — `dist/` ships once via
`bundle.resources`, single `/ws` origin, daily-rotated tracing,
`yarn dev:full` / `yarn bridge` / `yarn osc` script trio.
`setupDashboard` / `teardownServerState` are shared between
initial connect, disconnect, and the chunkSize-driven re-init.

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
  No other synth may reuse this id.
- **Connect handshake** (in order, all in `AppShell.handleConnect`):
  1. `/status` probe — verifies the chain is alive; reads
     `actualSampleRate` from `args[8]` and rejects only if it's
     non-finite or `<= 0`. The captured value flows forward as
     the session's `AudioEnvironment.sampleRate` — there's no
     compile-time `DEFAULT_ENV` anymore.
  2. `/notify 1` via `sendAndAwaitReply` matching `/done /notify`,
     captures the assigned `clientId` for parent-group
     derivation. Required — scsynth doesn't broadcast async
     replies (`/tr`, `/n_go`, `/done`) to un-notified clients.
  3. `setupDashboard(client, parentGroupId, sampleRate, chunkSize)`
     — constructs `GroupController`, `ClockController` (allocates
     `clockBus = ids.bus.next()`, derives `tickRate = sampleRate /
     chunkSize`), calls `clock.start()`. Then constructs
     `SynthManager` (producer side), `BufferManager` (shared tap
     layer), `ScopeManager` + `RecordingManager` (consumers, both
     pointed at `BufferManager` for handle acquisition). Reused by
     the in-place re-init flow when the user changes chunkSize
     from the header.
- **Disconnect cleanup** (best-effort; covers serve mode + Tauri):
  - **`handleDisconnect`** (button click): `teardownServerState`
    (recordings → scopes → buffers → synths → clock → group, each
    try/caught) → `client.sendAndSync(notify(0))` →
    `client.dispose()`. The recording / scope managers release
    their `BufferHandle`s; `bufferManager.clear()` then runs as a
    safety net — by that point its map should be empty, and a
    non-empty one logs a warning ("refcount leak suspected") and
    disposes the stragglers before `group.free()` does the
    coarser /g_freeAll. The `teardownServerState` helper is
    shared with the in-place chunkSize re-init path, which runs
    the same teardown but *without* the notify(0) +
    client.dispose tail.
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
  clock.derived.tickRate)` in an `OSC.Bundle`.

### chunkSize × sampleRate practical reference

`tickRate = sampleRate / chunkSize`. `Impulse.kr` accepts any
positive Hz; the practical ceiling on tick rate is ~250 Hz before
the worker's setTimeout retries crowd the next tick boundary
(Phase 12 gap-bug pattern). The header dropdown filters options
whose tick rate would exceed `MAX_PRACTICAL_TICK_RATE = 250`, via
`practicalChunkSizes(sampleRate)`.

| chunkSize | 44.1 kHz       | 48 kHz         | 96 kHz         | 192 kHz        |
|-----------|----------------|----------------|----------------|----------------|
| 1024      | 43 Hz / 23 ms  | 47 Hz / 21 ms  | 94 Hz / 11 ms  | 188 Hz / 5 ms  |
| 512       | 86 Hz / 12 ms  | 94 Hz / 11 ms  | 188 Hz / 5 ms  | 375 Hz ✗       |
| 256       | 172 Hz / 6 ms  | 188 Hz / 5 ms  | 375 Hz ✗       | 750 Hz ✗       |
| 128       | 345 Hz ✗       | 375 Hz ✗       | 750 Hz ✗       | 1500 Hz ✗      |
| 64        | 689 Hz ✗       | 750 Hz ✗       | 1500 Hz ✗      | 3000 Hz ✗      |

Observations:

- ✗ means filtered out by `practicalChunkSizes()`. Above 250 Hz
  the kr-quantisation slop and the bridge round-trip stop fitting
  inside one tick.
- The numbers shift inversely with sampleRate — at 192 kHz only
  `chunkSize = 1024` survives the filter.
- The buffer size (`2 × chunkSize × channels × 4 bytes`) is
  sampleRate-agnostic; only `chunkSize` determines memory.
- Total `/b_setn` traffic is also sampleRate-agnostic per scope —
  `chunkSize × channels × 4 bytes` per tick at `sampleRate /
  chunkSize` ticks per second is `sampleRate × channels × 4`
  bytes/sec regardless of which factor pair you pick.
- Power-of-2 `chunkSize` keeps recording reads page-aligned
  (`1024 × 4 = 4096 bytes = 1 page`) and FFT-ready at any
  sampleRate (Future Improvement #1). The defaults (`64, 128,
  256, 512, 1024`) are all powers of 2.
- Time meaning of a given `chunkSize` value is *not* invariant
  across sample rates — `1024` gives a 21 ms window at 48 k but
  only 5 ms at 192 k. The user picks chunkSize as a sample count;
  the resulting window depends on whatever scsynth is running.

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
  `completedHalf` parity in `oscWorker.fireReads` is therefore
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
- **Tauri vs serve build deltas**: `src-tauri/capabilities/default.json`
  scopes `fs:allow-write-{file,text-file}` to `$DOCUMENT`,
  `$DOWNLOAD`, `$AUDIO`, `$DESKTOP`, `$HOME`. If a save target
  outside those roots starts failing in Tauri, extend the scope
  list there — not by removing the gate altogether.
- **Tap synths must read `clockBus`, not a local `Phasor.ar`** —
  the worker's `completedHalf = tickIndex % 2` parity formula is
  only valid when the buffer's half boundaries align with global
  tick parity. A clockBus-driven `writeIdx` inherits that
  alignment for free (clockBus has been advancing since session
  start). A local `Phasor.ar` started by `/s_new` has its own zero
  point — depending on whether the start tick happened to be even
  or odd, every read lands on the wrong half and `/b_setn` replies
  echo back with offsets that don't match `pendingRead`. Cost us
  a Phase 12 debug cycle. The unified `bufferTapSynthDef` follows
  the clockBus-divide-mod pattern; any new tap synth should too.
- **Tick-driven `/b_getn` needs offset-keyed pending tracking, not
  a single slot** — scsynth's `/b_setn` sometimes round-trips in
  >`tickIntervalMs`, especially under load. With a single
  `pendingRead` slot, the next tick's read overwrites the
  previous tick's pending and the late reply mismatches the
  current offset. The Phase 17 worker keeps
  `pendingByOffset: Map<offset, PendingRead>` (max two entries —
  one per ring half) so a late reply at offset 0 can land while a
  fresh read at offset N is in flight. A `reorderBuffer:
  Map<tickIndex, ...>` then drains chunks in tick order so
  delivery stays linear regardless of arrival order. Applies
  uniformly to every `BufferSubscription` after Phase 17 — scopes
  and recordings, plus any future analyzers.
- **`chunkSize` is mutable at runtime; SynthDef cache keys must
  include it.** The header dropdown lets the user change
  `chunkSize` mid-session. Re-init compiles a fresh clock SynthDef
  with the new derived `tickRate` (`sampleRate / chunkSize`), and
  any new tap synths use the new `chunkSize` for their ring +
  name. `compileBufferTapSynthDef`'s cache key is
  `(channels, chunkSize)` — never `(channels)` alone, or you get
  stale bytes after a re-init. Old SynthDefs sit on scsynth until
  the parent group is freed; harmless, just wasted slots.
- **In-place re-init runs over the same WS — DO NOT re-issue
  `notify(1)`.** The `parentGroupId` and the notify subscription
  are captured once at initial `handleConnect` and stashed on
  `DashboardResources`. Re-issuing `notify(1)` over the same WS
  either gets rejected by scsynth or hands back a different
  `clientId`, orphaning the existing parent group. The reinit
  path calls `teardownServerState` (which doesn't touch notify)
  and then `setupDashboard` with the stashed `parentGroupId`.
- **Producers must be `/s_new`'d before consumers that read their
  buses — same control-block ordering rule as the clock.** Tone
  synths (producers), scope/recording tap synths (consumers via
  `BufferController`), and the clock all live in the same parent
  group. The clock is at head; everything else uses `AddToTail`,
  so creation order determines runtime order. A consumer created
  before any producer is writing on its bus reads the previous
  control block's value (~1 ms lag) until something forces a
  re-/s_new — not technically broken, just stale by one block.
  The UX flow ("Add a synth, then add a scope on its bus") gets
  the order right naturally. Symmetric to the clock-at-head
  invariant.
- **`SynthManager` is the only auto-allocator from `ids.bus`.**
  Scopes and recordings consume user-typed bus numbers — they
  never touch the bus allocator. So the allocator is effectively
  synth-exclusive, and bus collisions across consumer types are
  impossible by construction.
- **Buffer refcount lifecycle.** `BufferManager.acquire(spec)` is
  ref-counted by `(inputBus, channels, chunkSize)`. First acquire
  triggers `/b_alloc` + `/s_new` + worker subscribe; subsequent
  acquires on the same spec just bump the count. Each consumer
  must call `handle.release()` exactly once when done — the
  per-acquire handle wrapper guards against double-release with
  an internal `released` flag, so calling `release()` more than
  once is a silent no-op (refcount stays correct). Last release
  → `unsubscribeBuffer` → `/n_free` + `/b_free`. The
  `BufferManager.snapshot` reactive store reflects the live
  `{key, spec, refcount, bufnum, nodeId, bufferId}` set on every
  acquire/release; tap into it from a future `BuffersPanel` or
  inspect via the dev-mode `__sc*` globals to diagnose leaks.
- **`bufferManager.clear()` warns on a non-empty map** —
  refcount-leak canary. By the time `teardownServerState` runs
  it, every consumer-side manager (`recordingManager`,
  `scopeManager`) should already have released its handles. A
  non-empty map at clear time means a controller failed to
  release — the safety log surfaces the regression with a
  console warning rather than letting it ship as a leaked tap
  synth.
- **Parent group `/g_new` MUST use `AddToTail` of root, not
  `AddToHead`.** Pre-Phase-26, AddToHead was the default and
  worked because sc-app was the only client at the root. With
  Phase-26 deployments hosting sclang+SuperDirt at clientId=0,
  AddToHead would put sc-app's parent group BEFORE sclang's
  defaultGroup (group 1), and sc-app's tap synths would process
  before SuperDirt's orbits had written to their output buses —
  taps read silence. `GroupController`'s constructor default is
  now `AddToTail` and the comment block there documents why.
- **Node + buffer ID allocators scope per-clientId.**
  `setupDashboard` derives
  `idBase = clientId * 1_000_000 + 1000` and passes it to both
  `IdAllocator(node)` and `IdAllocator(buffer)`. scsynth doesn't
  enforce per-client ID ranges but rejects duplicate `/s_new`
  with `FAILURE IN SERVER /s_new duplicate node ID`. clientId=0
  (single-client) is byte-identical to pre-Phase-26 (base 1000);
  clientId=N (sharing scsynth with sclang+SuperDirt) starts at
  N×1M+1000, well beyond any practical SuperDirt synth count.
- **`ServerErrorBus` must be constructed BEFORE the first
  `/s_new`.** The first `/s_new` from `setupDashboard` is the
  clock — and the clock is exactly the synth that fails when
  ID-collision-with-SuperDirt strikes. If `ServerErrorBus`
  subscribes after `clock.start()` resolves, the `/fail` reply
  arrives in the listener-less window and is silently dropped —
  no UI surface, no debug-log entry. The bus is now the FIRST
  thing constructed in `setupDashboard`. Don't reorder.
- **OSC routing in the bridge happens BY OSC ADDRESS PREFIX.**
  `config.json -> routes: [{prefix, target}]` is walked
  top-to-bottom, first `starts_with` match wins. A bundle is
  routed by the address of its first inner message
  (mixed-target bundles are unsupported). Default route =
  `scsynth` field. Hot path: `peek_osc_address` decodes only
  enough bytes to extract the address (no full rosc decode).
  Adding a future target (metronome, MIDI, analyzer) is a
  config entry, not a code edit.
