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
running at `127.0.0.1:57110` (or whatever the bridge's
`config.json -> scsynth` points to).

Forward-looking design lives in `plan.md` (pending phases, open
questions, acceptance criteria); the historical record of shipped
phases — what landed and why — is in [`docs/history.md`](./docs/history.md).

## Architecture at a glance

```
Browser (React, main thread)
  ├── AppShell                  bootstrap ↔ dashboard orchestration;
  │                             always-rendered dashboard with header
  │                             Connect/Disconnect toggle
  ├── sessionBootstrap +        per-tab session id in sessionStorage;
  │   SessionContext             GET/POST /api/session on mount;
  │                              SessionProvider exposes ConnectionStatus
  │                              (connected/connecting/disconnected) +
  │                              sessionId via React context
  ├── ClockController           Phase 30: passive observer of the
  │                             sclang-owned shared clock. attach()
  │                             round-trips /clock/hello → /clock/info
  │                             (tickRate, chunkSize, sampleRate,
  │                             clockNodeId). tick0Ms anchored on the
  │                             first /clock/tick arrival. detach() is
  │                             sync (no /n_free — don't own the synth).
  ├── GroupController           parent group lifecycle (/g_new /n_run).
  │                             Pause/resume on this group is what the
  │                             "Pause" button drives now (Phase 30).
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
  │   SequencerPanel             owns transport + bank-mutation API;
  │                              the timing-critical pump runs in
  │                              the OSC worker (Phase 32). Subscribes
  │                              to bank/clock/group changes and
  │                              forwards snapshots; `stepFired` events
  │                              from the worker drive playhead UI +
  │                              chain auto-advance at cycle boundaries.
  ├── ServerErrorBus            decoded /fail ring, surfaced via
  │                              DebugLog header badge.
  ├── ToastContainer +          bottom-right toast stack for runtime
  │   useToasts                  errors / warnings / successes
  │                              (success/info/warn/error variants;
  │                              error sticks until manual dismiss).
  └── WorkerClient              postMessage wrapper around…
      │   - sendCommand / onReply / onError / onTick
      │   - subscribeBuffer(sub, cb) — Phase 35: encodes a 0x01
      │     scope-subscribe frame on the main /ws; chunk frames
      │     (0x03) come back in-band and fan out to listeners
      │   - startSequencer / stopSequencer / updateSequencerBank /
      │     updateSequencerClock / setSequencerPaused / onStepFired
      │     — Phase 32 worker-side pump control
      ▼
OSC Worker (module worker)
  ├── workerBootstrap.ts        sync message buffer + osc-js window shim
  ├── transport.ts              raw binary WebSocket (the only WS;
  │                              Phase 35 retired /ws/scope)
  ├── scopeWire.ts              Phase 35: in-band wire format on the
  │                              main /ws — encodeSubscribe (0x01),
  │                              encodeUnsubscribe (0x02), decodeChunk
  │                              (0x03), isScopeFrame peek helper.
  │                              Integer sub_id minted by the worker;
  │                              bridge echoes back on chunks.
  ├── sequencerPump.ts          Phase 32 worker-side pump
  │                              (renamed post-32 from
  │                              sequencerWorker.ts — module, not
  │                              a separate Worker):
  │                              setInterval(25ms) (unthrottled when
  │                              tab backgrounded), ports pump() +
  │                              tickToTimetag math + /dirt/play
  │                              encoding from the deleted
  │                              src/sequencer/scheduler.ts; emits
  │                              OSC bytes via transport.send,
  │                              posts stepFired back to main
  └── oscWorker.ts              the actual Worker entry point.
                                decode inbound + forward outbound
                                bytes + /clock/tick mux. Inbound
                                handler peeks first byte: 0x03 →
                                scope chunk decode (post bufferChunk
                                with Float32Array transferred);
                                otherwise OSC decode. Maintains
                                subIdByBufferId/bufferIdBySubId maps
                                for chunk dispatch. Registers a
                                transport.send sender into
                                sequencerPump on connect.
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
  ├── scope/                    scope-data ingestion (dual-mode)
  │   ├── mod.rs                 ScopeMode enum (Shm | Osc)
  │   ├── shm.rs                 Phase 31: mmap RAII +
  │   │                           find_scope_buffer_array (heuristic
  │   │                           vector finder, see history.md) +
  │   │                           read_scope_slot (non-mutating
  │   │                           triple-buffer pull from scsynth's
  │   │                           shared memory)
  │   └── osc.rs                 Phase 36: OSC /b_getn fallback —
  │                               per-WS subscription map, bundle
  │                               encode (NTP timetag), /b_setn parse,
  │                               chunk encode (matches SHM byte layout)
  ├── server/
  │   ├── mod.rs                axum router, bind/serve_on/run_bridge,
  │   │                          /ws + /api/session* + /api/scope/*
  │   │                          routes, TTL task
  │   ├── session.rs            bridge-managed Session — owns one UDP
  │   │                          socket per route target + a lazy
  │   │                          ScopeShm OnceCell shared across all
  │   │                          WSs on this session; runs
  │   │                          /notify+/status at create, fans inbound
  │   │                          replies via tokio broadcast channels;
  │   │                          SessionStore
  │   │                          (Arc<RwLock<HashMap<Uuid,Session>>>)
  │   │                          + evict_idle for the TTL job
  │   ├── api.rs                POST/GET/DELETE /api/session[/:id] +
  │   │                          GET /api/scope/{probe,layout,headers,
  │   │                          debug}; { error } JSON envelope
  │   ├── ws_bridge.rs          main WS ↔ Session bridge. Per-target
  │   │                          broadcast forwarders + Phase 35 in-band
  │   │                          scope multiplex: per-WS ScopeContext
  │   │                          owns the subscription map keyed by
  │   │                          sub_id; default-route forwarder peeks
  │   │                          /clock/tick and emits 0x03 chunk
  │   │                          frames for advanced slots; recv loop
  │   │                          peeks first byte to dispatch
  │   │                          0x01/0x02/OSC. ScopeContext drops
  │   │                          when the WS closes (explicit cleanup
  │   │                          point — see history.md Phase 35).
  │   ├── routing.rs            RoutingTable + peek_osc_address —
  │   │                          config.json `routes` ⟹ N targets
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

Every OSC command flows: main thread (encode) → worker (forward
bytes via the main `/ws`) → bridge → **route table prefix-match**
→ UDP → scsynth or sclang+SuperDirt. Every reply flows the
inverse: target → UDP → bridge → WS → worker (decode, mux
`/clock/tick`) → main thread as plain `{ address, args }` POJOs
via structured clone. The bridge picks the route socket by
peeking the OSC address against `config.json -> routes`
(`/dirt → 57120` is the SuperDirt route; `/clock`, `/scope` →
57120 too; everything else falls through to the default target
= `scsynth` config field).

The buffer-data path uses SHM but rides the same WS as OSC.
Phase 31 retired `/b_getn` entirely: tap SynthDefs write via
`ScopeOut2.ar(sigs, scopeNum, chunkSize, chunkSize)` into one
of scsynth's 128 SHM scope buffers (allocated by sclang via
`s.scopeBufferAllocator`). The bridge mmaps scsynth's shared
memory once per session (`Session::ensure_scope_shm`). Phase 35
moved chunk delivery back onto the main `/ws` (after a brief
detour through per-scope `/ws/scope` connections in 31's
post-shipping refactor) — multiplexed by a one-byte op tag
(0x01 subscribe / 0x02 unsubscribe / 0x03 chunk; OSC's `/` and
`#` first bytes keep the dispatch unambiguous). On every
observed `/clock/tick`, the WS's default-route forwarder polls
`read_scope_slot(scopeNum)` for every active subscription on
this WS and emits 0x03 chunk frames for advanced slots. The
worker's recv handler peeks the first byte, decodes 0x03 →
posts a zero-copy `Float32Array` `bufferChunk` event to main.
`ScopeView` runs an RAF loop that reads the latest chunk from
a ref and draws — data rate (~47 Hz at default config) and
render rate (60+ Hz) are intentionally decoupled.

The sequencer-emission path is also separate. Phase 32 moved
the pump from a main-thread `setInterval` (clamped to ~1 Hz on
backgrounded tabs) into the worker. `SequencerController` posts
`sequencerStart` + bank/clock snapshots; the worker runs an
unthrottled `setInterval(25 ms)`, encodes `/dirt/play` bundles
with `tickToTimetag`-derived timetags, and ships them through
`transport.send()` directly (no postMessage hop for OSC bytes).
`stepFired` events go back to main for the playhead UI +
chain-mode auto-advance.

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

Both modes consult an optional `config.json`. Schema lives in
`src-tauri/src/config.rs` (`Config` struct, `deny_unknown_fields`
so typos error out). All fields are `Option<…>`; missing fields
fall through. Fields:

- `port` — HTTP port to bind for the bridge.
- `scsynth` — default scsynth address (host:port). The implicit
  catch-all route target — packets whose OSC address doesn't
  match any prefix in `routes` are sent here.
- `log_dir` — directory for daily-rotated NDJSON logs.
- `routes` — OSC address-prefix routes (`[{ prefix, target }]`).
  Walked top-to-bottom; first `starts_with` match wins. The
  starter config seeds `/dirt → 127.0.0.1:57120` so a
  first-launch session routes SuperDirt traffic correctly
  without the user editing the file.
- `session_ttl_seconds` — how long an idle bridge-managed
  session lingers before TTL eviction runs `Session::cleanup`
  (`/g_freeAll` + `/n_free` + `/notify 0`). Default 1800
  (30 min). Background scan fires once per minute.

Discovery:

- **GUI mode** reads `app.path().app_config_dir()/config.json` and
  writes a starter file (port + scsynth + `/dirt → 57120` and
  `/clock → 57120` routes) on first launch via
  `Config::write_default_if_missing`. Subsequent launches never
  overwrite the user's edits — even when `Config` gains new
  fields, an old user-written file just keeps its existing
  shape and the bridge defaults the missing fields. (Caveat:
  if a user has a stale starter config from before the `/dirt`
  route was seeded, SuperDirt routing breaks silently with
  `/fail /dirt/hello: Command not found`. Same shape post-Phase-30
  for `/clock`: a stale config without the `/clock` route makes
  `clock.attach()` time out with the message "Could not attach to
  the shared clock (/clock/hello)". Fix: delete the config-dir
  file to regenerate or hand-edit the route in.)
- **Bridge mode** uses `--config <path>` if explicitly passed (must
  exist; fails loudly otherwise), else auto-discovers
  `./config.json` (CWD-relative, for `yarn bridge` / `yarn
  dev:full`) then `/etc/sc-app/config.json` (silent if absent).

Precedence (highest → lowest):

1. CLI flag (bridge only — `--port`, `--scsynth`, `--log-dir`)
2. Env var (`SC_PORT`, `SC_SCSYNTH_ADDR`)
3. `config.json` value
4. Built-in default (3000 / `127.0.0.1:57110` / stderr-only /
   1800 s TTL / no routes)

`dist` is intentionally *not* in the config schema — it has its own
resolution path (resource_dir auto-resolves in bundle, `--dist`
overrides) and adding it would just create a duplicate knob. Same
reasoning kept it out of the env-var surface earlier.

Frontend asset URLs are always same-origin: `wsUrlFor` in
`AppShell.tsx` builds from `window.location.origin` and adds
`?session=<uuid>`. In dev (`yarn dev` / `yarn tauri dev`) the
origin is Vite's `:1420`; Vite's `/ws` and `/api` proxy entries
forward both the WebSocket upgrade and the session HTTP traffic
to the bridge. In production (Tauri webview pointed at axum, or
a remote browser hitting a deployed bundle) the origin already
*is* the bridge.

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
  `.modal*`, `.toast*`). Plain CSS, no Sass. Variants via `data-*`
  attributes (`<button data-variant="danger">`, `<span class=
  "status-pill" data-variant="ok">`). The disabled-panel
  treatment (Phase 29d) is a foundation-level
  `.panel[aria-disabled="true"]` rule — opacity dimming +
  `pointer-events: none` — so a card stays visible during
  disconnected state without reflowing the layout. Hardcoded
  hex colours outside `themes/{dark,light}.css` are a
  regression — open the PR with a token name instead.
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

Current phase progress: **No phase currently in flight.** The
last seven landed (most recent first):

**Phase 36 shipped — OSC Fallback for Scope Data.** Restored a
`/b_getn`-based scope-data path as a fallback for when SHM
isn't accessible (remote scsynth, exotic deployment, scsynth
booted with SHM disabled, or `bridge --no-shm` test flag). Pre-
Phase-31 lived in the TS worker; Phase 36 puts it in the Rust
bridge so the worker's wire format stays uniform. Bridge
probes SHM at `Session::create`, commits to `ScopeMode::Shm`
or `ScopeMode::Osc` per-session. Frontend reads
`/api/scope/probe`'s `mode` field and branches at the SynthDef
+ buffer-allocation step in `BufferController.start()`. The
0x01/0x02/0x03 wire format on `/ws` and the worker stay
unchanged — bridge interprets the 0x01 frame's `scope` field
as either a scope-buffer index (SHM) or a bufnum (OSC) based
on session mode. clockBus revival in sclang's clock SynthDef
provides the sample-counting Phasor the OSC fallback's
`bufferTapOscSynthDef` reads to derive a sample-aligned
`writeIdx`. New `src-tauri/src/scope_osc.rs` (~330 lines, 11
unit tests) hand-rolls OSC bundle encoding for `/b_getn`
(big-endian, NTP timetag with `READ_DELAY_MS = 5 ms` shift),
parses `/b_setn` replies, and dispatches by bufnum match.
`bridge --no-shm` CLI flag forces OSC mode for testing without
disabling SHM at the OS layer. See `docs/history.md` Phase 36.

**Phase 35 shipped — In-Band Scope Chunks.** Retired the
per-scope `/ws/scope` WebSocket adopted in Phase 31's
post-shipping refactor (commit `dfeb924`). Scope subscribe /
unsubscribe / chunk frames now travel as binary messages on the
main `/ws`, multiplexed by a one-byte op tag (0x01 subscribe /
0x02 unsubscribe / 0x03 chunk). OSC frames always start with
`/` (0x2F) or `#` (0x23), so the op-tag space is unambiguous.
Wire format gains an integer `sub_id` (u32) instead of the
length-prefixed string `bufferId` we had pre-`dfeb924` —
~30+ bytes saved per chunk; bridge never has to interpret it,
just echoes back. Worker keeps a small
`Map<sub_id, bufferId>` for chunk dispatch to main-thread
listeners; main-thread API (`BufferHandle.subscribe`,
`latestChunk`, `release`) bit-identical. Bridge gains a per-WS
`ScopeContext` with explicit drop-on-WS-close cleanup logging
(no more "subscription = WS lifecycle" auto-cleanup, but the
context is owned by `handle_ws_session`'s scope so it drops
naturally; debug log names the count of subscriptions
released). 3 new Rust tests for the chunk frame layout
round-trip + the first-byte dispatch invariant. See
`docs/history.md` Phase 35.

**Phase 34 shipped — Loopback Identity Hardening.** Validates
the `Host` header on every HTTP request and the `Origin` header
on every WS upgrade against a loopback allowlist
(`127.0.0.1` / `localhost` / `::1` / `tauri://localhost`).
Closes two attack vectors the Phase 25 webview-on-HTTP shift
exposed: DNS rebinding (a hostile site rebinds DNS to 127.0.0.1
mid-session and uses the still-`attacker.com`-origin page to
talk to the bridge — Host check now rejects with 421 Misdirected
Request) and cross-origin WebSocket upgrades (any page could
`new WebSocket('ws://127.0.0.1:3000/ws')` — Origin check now
rejects with 403 Forbidden). All in
`src-tauri/src/server/security.rs`; layered as an axum middleware
+ a per-handler helper for WS upgrades. Missing Origin is allowed
(browsers always send it on WS, so missing means non-browser CLI
clients which can talk TCP directly anyway). 9 Rust unit tests.
TLS was considered as an alternative but rejected: cert-
provisioning friction, dev-vs-prod composability problems,
doesn't help against same-machine non-browser callers. See
`docs/history.md` Phase 34.

**Phase 33 shipped — Tab Throttling Resilience.** Plugged the
two main-thread timers Phase 32 didn't catch. 33a gated
`AppShell`'s `/status` heartbeat on `document.visibilityState` —
under intensive throttling the 2 s reject-timer could race
against the queued `/status.reply` postMessage and falsely tear
down a healthy session after ~5 min hidden; the visibility
gate skips ticks while hidden, with a `visibilitychange` listener
firing one immediate refresh on tab return. 33b moved the clock
freshness watchdog from a main-thread `setInterval` into a new
`src/workers/clockWatchdog.ts`. Pre-33 the watchdog read a stale
`lastSignalAt` while throttled and falsely flipped
`effectiveState` to `'paused'` on refocus; post-33 the worker
runs the freshness check against unqueued ticks and emits
`clockFreshness` events to main only on transitions, so the
"amber clock" flicker is gone. `ClockController` no longer owns
a watchdog timer or `lastSignalAt` field. 9 new unit tests cover
the watchdog state machine. See `docs/history.md` Phase 33 for
the full write-up.

**Phase 32 shipped — Worker-Side Sequencer Pump.** Moved the
sequencer's `setInterval(25 ms)` pump off the main thread
(where Chromium clamps it to ~1 Hz on backgrounded tabs) into
the existing OSC worker. `SequencerController` keeps its full
public API and reactive stores; the timing-critical work hops
behind `postMessage` into a new `src/workers/sequencerPump.ts`
module (originally `sequencerWorker.ts` — renamed post-32
since it's a module that runs IN the worker, not a separate
Worker) folded into the existing worker context, so it can call
`transport.send()` directly without a second postMessage hop.
32a added the protocol surface (`sequencerStart`/`Stop`/
`BankUpdate`/`ClockUpdate`/`PauseUpdate` MainToWorker;
`stepFired`/`cycleBoundary` WorkerToMain) + a stub handler.
32b ported `pump()` + `tickToTimetag` math + `/dirt/play`
encoding from `src/sequencer/scheduler.ts` into the worker;
`SequencerController.play()` switched from `setInterval` to
`client.startSequencer(bankSnapshot, clockSnapshot,
isGroupPaused)` + bank/clock/group store subscriptions that
post fresh snapshots on every reactive fire. 32c wired
`stepFired` events back to drive the playhead store + chain-
mode auto-advance on main (no manual debouncing — React 18
batching + `Object.is` short-circuit handle the refocus
burst); deleted `src/sequencer/scheduler.ts` (zero remaining
importers) + the now-orphan `DirtClientLike` interface. 32d
bootstrapped vitest at the root + 8 unit tests for the worker
pump; 60-second backgrounded-tab manual validation passed.
See `docs/history.md` Phase 32 for the full write-up.

**Phase 31 shipped — SHM Buffer Ingestion (scopes +
recordings).** Replaced the OSC `/b_getn` data path with a
shared-memory transport. Tap SynthDefs write via
`ScopeOut2.ar(sigs, scopeNum, chunkSize, chunkSize)` into
scsynth's SHM scope-buffer pool; the Rust bridge mmaps the
segment and reads slots non-mutating; frames stream to the
frontend over a per-scope WebSocket (`/ws/scope?session=…&
scope=…&channels=…&chunkSize=…&bufferId=…`). 31a added the
sclang `/scope/{hello,allocate,free}` responders backed by
`s.scopeBufferAllocator` (StackNumberAllocator(0, 127), 128
slots). 31b added `src-tauri/src/scope_shm.rs` — mmap RAII +
`find_scope_buffer_array` heuristic that walks the segment for
a contiguous run of 128 offset_ptrs resolving to scope_buffer-
shaped structures, plus `read_scope_slot` doing non-mutating
slot reads with `_stage`-advanced detection. 31c/d cut the
frontend over: `BufferController` does
`/scope/allocate → /s_new tap with scopeNum →
subscribeBuffer → /n_free → /scope/free` instead of the old
`/b_alloc → /s_new tap → tick-driven /b_getn → /b_free`.
Worker dropped ~300 lines of OSC retry/reorder/gap-synthesis
machinery. Same-day post-shipping refactor moved scope chunk
delivery from in-band 0x01/0x02/0x03 op-tag mux on the main WS
to per-subscription `/ws/scope` connections — main OSC WS is
back to pure OSC; subscription lifecycle = WS lifecycle. See
`docs/history.md` Phase 31 for the full write-up.

**Phase 30 shipped — Shared sclang-owned clock.** Three
sub-phases moved clock ownership from per-session frontend
synths to a single `\scAppClock` running at scsynth's root
group, owned by sclang. All clients become passive observers
of the same `/clock/tick` stream. chunkSize is now a
server-side env var (`SC_APP_CLOCK_CHUNK_SIZE`); the frontend
has no UI for it. (Originally Phase 30 also published a
`clockBus` carrying a sample-counting Phasor — read by tap
synths' ring-buffer math. Phase 31 retired the ring math, and
the bus was removed in a post-34 tidy commit; see Phase 30 in
`docs/history.md` for the full clock-ownership write-up.)

Earlier landings still in effect:
- **Phase 29** — Bridge-managed sessions + auto-connect.
  Per-tab `Session` UUID in `sessionStorage`; bridge owns the
  `/notify 1` + `/status` handshake; WS attaches via
  `?session=<uuid>`; TTL eviction at 30 min default.
  ConnectScreen replaced by always-rendered dashboard chrome.
- **Phase 28** — `@sc-app/ui-foundation` CSS package
  (Open Props primitives + semantic tokens + base element
  styles + component classes; `data-variant`/`data-size`
  attributes for button + status-pill variants; disabled-panel
  styling via `.panel[aria-disabled="true"]`).
- **Phase 27** — step sequencer for SuperDirt (PatternBank
  with localStorage persistence, chain mode advances at
  cycle boundaries).
- **Phase 26** — SuperDirt via bridge-internal OSC router:
  one `WorkerClient` / one `/ws`; the bridge's
  `RoutingTable` demuxes outbound packets by OSC-address
  prefix, with `/dirt → 127.0.0.1:57120` as the first
  non-default target. `GroupController` defaults to
  `AddToTail` so sc-app's parent group sits after sclang's
  defaultGroup. Node + buffer `IdAllocator` scoped
  per-clientId (`idBase = clientId * 1_000_000 + 1000`).
- **Phases 16–21** — Shared Buffer Layer:
  `BufferController` + `BufferManager` ref-count
  `(inputBus, channels, chunkSize)`-keyed taps.
- **Phase 15** — producer/consumer split: `SynthManager` +
  `SynthsPanel` are producers; scopes and recordings are
  pure consumers of user-typed bus numbers.
- **Phase 25** — bundle & dev workflow: `dist/` ships once
  via `bundle.resources`, same-origin `/ws` + `/api`,
  daily-rotated tracing, `yarn dev:full` / `yarn bridge` /
  `yarn osc` script trio.

`setupDashboard` / `teardownServerState` run on initial connect /
disconnect respectively. Phase 30c removed the in-place re-init
path (chunkSize is sclang-owned now); changing it requires a
sclang restart, which all attached sessions then re-attach to via
`/clock/hello` on next page load.

## Where scsynth conventions matter

- **IDs**: `IdAllocator(1000)` for nodes and buffers,
  `IdAllocator(32)` for buses (skip hardware-reserved buses).
- **Parent group**: derived from the scsynth-assigned clientId
  returned by `/done /notify`, as `clientId × 100`. Falls back to
  the literal `100` when scsynth returns `clientId = 0` (the
  default single-client case, where `0 × 100 = 0` would clash
  with the root group). The fallback path warns in the debug log.
- **Group ordering invariant** (Phase 30): the shared clock lives
  at the **root group's head** (added by sclang at startup, see
  `scripts/sc-app-superdirt-startup.scd`). Every sc-app session's
  parent group sits at the root's tail (`AddToTail`, so it lands
  AFTER sclang's defaultGroup); **inside** the parent group, every
  tap synth (scopes, recorders, the dev probe) MUST be `/s_new`'d
  with `AddToTail`. The historical reason was that pre-Phase-31
  taps read the clock-driven `clockBus` and would otherwise see
  the previous control block's value (~1.3 ms lag). Post-Phase-31
  taps don't read clockBus, but the AddToTail invariant still
  matters for any future producer→consumer chain inside the
  parent group.
- **Reserved IDs (Phase 30 — globally-owned by sclang's clock)**:
  - `/clock/tick` — shared clock's `SendReply` address. The worker
    demuxes these into `clockTick` events, suppressing them from
    the generic `onReply` channel. No other synth should emit on
    this address (would produce double-ticks). The pre-cleanup
    `CLOCK_TRIG_ID = 1000` reservation is gone — `SendTrig` is
    now safe for any synth to use without colliding.
  - `clockNodeId = 999` — sclang's `\scAppClock` synth. Reserved
    by convention; clients' `IdAllocator(node)` start at
    `clientId * 1_000_000 + 1000`, well above 999.
  - (Pre-cleanup the clock also published a `clockBus` carrying
    a sample-counter Phasor for tap-synth ring-buffer math.
    Phase 31 retired the ring math; the bus was a no-op
    producer→nobody from then on, removed in a post-34 tidy.)
- **Session bootstrap + connect handshake** (Phase 29):
  the scsynth handshake (`/status`, `/notify 1`) is owned by
  the bridge, run once at session creation. The frontend's
  job on boot is a session GET-or-POST round-trip; the
  response carries everything `setupDashboard` needs.
  1. `bootstrapSession()` reads
     `sessionStorage["sc.session"]`. If present, `GET
     /api/session/:id` — on 404 / network error, fall through
     to `POST /api/session`. POST asks the bridge to mint a
     fresh session: open one UDP socket per unique route
     target, run `/notify 1` → `/done /notify <cid>` and
     `/status` → `/status.reply` against scsynth on the
     default-route socket, capture `clientId` + nominal
     `sampleRate`, derive `parentGroupId = clientId × 100`
     (with the `clientId == 0 ⇒ 100` fallback). On success
     the new id is stored in `sessionStorage`.
  2. `handleConnect(info)` opens the WS at `/ws?session=<uuid>`.
     The bridge attaches the WS to the existing Session — no
     per-WS UDP socket, no per-WS handshake. Outbound bytes
     forward through the session's pre-bound sockets
     (route-prefix-demuxed); inbound replies fan out to all
     attached WS via `tokio::sync::broadcast`.
  3. `setupDashboard(client, sessionId, clientId, parentGroupId,
     sampleRate, bank)` — constructs `GroupController`,
     `ClockController`, calls `group.ensureCreated()` (atomic
     `/g_new + /n_run 0`), then `clock.attach()` which round-trips
     `/clock/hello → /clock/info` to read the shared clock's
     `tickRate / chunkSize / sampleRate / clockNodeId` (Phase 30).
     Then constructs `SynthManager` (producer side), `BufferManager`
     (shared tap layer), `ScopeManager` + `RecordingManager`
     (consumers, both pointed at `BufferManager` for handle
     acquisition). Phase 30c removed the in-place chunkSize re-init
     flow — chunkSize is sclang-owned now and changing it requires
     restarting sclang.

  Disconnected/connecting/connected state lives on a
  React context (`SessionProvider`) so any component (panel
  guards, header chrome, future inspectors) can read it via
  `useSessionContext()`.
- **Disconnect cleanup** (Phase 29; the bridge runs the
  scsynth-side teardown bundle now, frontend just signals):
  - **`handleDisconnect`** (button click): `teardownServerState`
    (recordings → scopes → buffers → synths → clock → group, each
    try/caught) → `bank.dispose()` (flushes a final pattern
    save) → `client.dispose()` → `deleteSession(sessionId)`
    (fire-and-forget `DELETE /api/session/:id`) →
    `clearStoredSession()`. The bridge's DELETE handler runs
    `Session::cleanup` — `/g_freeAll(parentGroupId)` +
    `/n_free(parentGroupId)` + `/notify 0` — against the
    session's pre-bound scsynth socket, then drops the sockets.
    The recording / scope managers release their
    `BufferHandle`s; `bufferManager.clear()` then runs as a
    safety net — by that point its map should be empty, and a
    non-empty one logs a warning ("refcount leak suspected").
    `clock.detach()` (Phase 30) is sync and just drops the trig
    listener — the shared clock keeps running on sclang's side,
    untouched.
  - **`pagehide` listener** (tab/window close): `fetch(DELETE
    /api/session/:id, { keepalive: true })`. Best-effort — the
    keepalive flag lets the request outlive the page begin
    unloading. Hard SIGKILL of the browser / Tauri webview
    skips this; the bridge's TTL task (default 30 min, scans
    every minute) is the safety net.
  - **TTL eviction** (bridge side, Phase 29d): once a minute
    the bridge scans `SessionStore` and runs
    `Session::cleanup` on entries whose `last_active` is older
    than `config.session_ttl_seconds` (default 1800 / 30 min).
    `last_active` is bumped on every `GET /api/session/:id`
    and on every WS attach via `get_and_touch`. Reload (F5)
    well within TTL doesn't trigger eviction.
- **Timing**: the server's audio clock is the truth.
  `ClockController` captures a `tick0Ms` anchor on the first
  `/clock/tick`, extrapolates forward. The main-thread clock is
  only used for freshness watchdogs, never as the truth. For
  sample-accurate scheduling, use
  `tickToTimetag(clock.tick0Ms!, targetTick,
  clock.derived.tickRate)` in an `OSC.Bundle`.
- **Shared clock (Phase 30)**: one `\scAppClock` synth runs at
  scsynth's root group, owned by sclang
  (`scripts/sc-app-superdirt-startup.scd`). Every sc-app session
  is a passive observer: `clock.attach()` round-trips
  `/clock/hello → /clock/info` to read `tickRate / chunkSize /
  sampleRate / clockNodeId` from the running clock;
  the `/clock/tick` stream (emitted via `SendReply.kr`) fans to
  all `/notify`'d sessions for free (no per-session synth
  `/s_new`). Pause/resume drives the
  parent group; the shared clock keeps ticking unaffected by any
  client's pause. **chunkSize is server-side**: configured via
  `SC_APP_CLOCK_CHUNK_SIZE` env var (default 1024) at sclang
  startup. Changing it requires restarting sclang. The frontend
  has no UI for it — every connected session re-attaches via
  `/clock/hello` after the restart.

### chunkSize × sampleRate practical reference

`tickRate = sampleRate / chunkSize`. `Impulse.kr` accepts any
positive Hz; the practical tick-rate ceiling depends on which
scope-data path the bridge is using (Phase 36):

| chunkSize | 44.1 kHz       | 48 kHz         | 96 kHz         | 192 kHz        |
|-----------|----------------|----------------|----------------|----------------|
| 1024      | 43 Hz / 23 ms  | 47 Hz / 21 ms  | 94 Hz / 11 ms  | 188 Hz / 5 ms  |
| 512       | 86 Hz / 12 ms  | 94 Hz / 11 ms  | 188 Hz / 5 ms  | 375 Hz ⚠OSC    |
| 256       | 172 Hz / 6 ms  | 188 Hz / 5 ms  | 375 Hz ⚠OSC    | 750 Hz ⚠OSC    |
| 128       | 345 Hz ⚠OSC    | 375 Hz ⚠OSC    | 750 Hz ⚠OSC    | 1500 Hz ⚠OSC   |
| 64        | 689 Hz ⚠OSC    | 750 Hz ⚠OSC    | 1500 Hz ⚠OSC   | 3000 Hz ⚠OSC   |

⚠OSC = the OSC `/b_getn` fallback (Phase 36) struggles at
these tick rates because `READ_DELAY_MS = 5 ms` no longer fits
inside `tickInterval = 1000/tickRate`. scsynth's console fills
with `late 0.0XX` warnings; chunks may arrive after the writer
has already overwritten their ring half. **In SHM mode (Phase
31, the default) all cells are fine.**

The bridge picks SHM mode automatically when SHM is reachable
(local scsynth on the same host) and OSC mode otherwise (remote
scsynth, exotic deployment, `--no-shm` test flag). The 250 Hz
soft ceiling is inherent to OSC fallback; SHM has no practical
ceiling until ~1–2 kHz where postMessage/main-thread cost
becomes the bottleneck. See `docs/history.md` Phase 36 for the
full mode comparison.

Phase 30 moved chunkSize ownership to sclang
(`SC_APP_CLOCK_CHUNK_SIZE` env var); pick a power-of-2 value
that stays comfortable for your deployment. The frontend's
`practicalChunkSizes(sampleRate)` filter still exists but is no
longer wired to any UI.

Observations:

- The numbers shift inversely with sampleRate — at 192 kHz only
  `chunkSize ≥ 512` keeps OSC fallback stable.
- The buffer size (`2 × chunkSize × channels × 4 bytes`) is
  sampleRate-agnostic; only `chunkSize` determines memory.
- Total scope-data traffic per scope is also sampleRate-agnostic:
  `chunkSize × channels × 4 bytes` per tick at `sampleRate /
  chunkSize` ticks per second is `sampleRate × channels × 4`
  bytes/sec regardless of which factor pair you pick. SHM mode
  is in-process mmap reads; OSC mode is `/b_setn` UDP packets
  (intercepted by the bridge, never reaching the worker).
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
  `t = 1/freq`. Pre-31 this drove a `completedHalf` parity
  formula in the worker's `/b_getn` loop. Phase 31 retired
  `/b_getn` entirely and Phase 30 moved the clock to sclang,
  so the parity formula is gone — but the `Impulse.kr` t=0
  semantics still apply if you write a new clock-adjacent
  SynthDef. Tick `N` corresponds to audio frame
  `(N-1) × samplesPerTick`, not `N × samplesPerTick`.
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
- **`ScopeOut2.ar`, not `.kr`, in the tap SynthDef.** Phase 31's
  `bufferTapSynthDef` writes via
  `ScopeOut2.ar(sigs, scopeNum, chunkSize, chunkSize)`. `.kr`
  writes one sample per control block — at chunkSize 1024 / sr
  48 k that's a push rate of ~0.7 Hz, so a slot fills every ~1.4 s
  and scopes appear frozen. `.ar` writes one sample per audio
  frame, completing a slot per tick. Cost a debug cycle in
  Phase 31; the SynthDef source has an inline reminder.
- **`chunkSize` is fixed for the session (Phase 30) but tap-synth
  SynthDef cache keys still must include it.** Phase 31's
  `bufferTapSynthDef` bakes `chunkSize` into ScopeOut2's
  `maxFrames` / `scopeFrames` parameters. Cache key
  `(channels, chunkSize)` — sclang restarts with a different
  chunkSize would otherwise reuse stale bytes from a previous
  browser session if HMR keeps the module live. Old SynthDefs
  sit on scsynth until the parent group is freed; harmless, just
  wasted slots.
- **The frontend never issues `/notify` (Phase 29).** Moved to
  `Session::create` on the bridge. `setupDashboard` consumes the
  supplied `clientId` / `parentGroupId` / `sampleRate` from
  `SessionInfo` and never touches `/notify` itself.
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
- **Buffer refcount lifecycle (Phase 31 SHM + Phase 35 in-band).**
  `BufferManager.acquire(spec)` is ref-counted by
  `(inputBus, channels, chunkSize)`. First acquire triggers
  `/scope/allocate` (sclang returns a free scope-buffer index
  0..127) + `/s_new bufferTap … scopeNum=<idx>` + worker
  `subscribeBuffer` (which encodes a 0x01 frame on the main /ws;
  bridge installs the subscription in its per-WS `ScopeContext`).
  Subsequent acquires on the same spec just bump the count.
  Each consumer must call `handle.release()` exactly once —
  the per-acquire handle wrapper guards against double-release
  with an internal `released` flag, so calling more than once
  is a silent no-op. Last release → `unsubscribeBuffer`
  (encodes a 0x02 frame; bridge removes from its `ScopeContext`)
  → `/n_free` the tap → fire-and-forget `/scope/free <idx>` (no
  reply expected). The `BufferManager.snapshot` reactive store
  reflects the live `{key, spec, refcount, scopeNum, nodeId,
  bufferId}` set on every acquire/release; tap into it from a
  future `BuffersPanel` or inspect via the dev-mode `__sc*`
  globals to diagnose leaks.
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
  `/s_new`.** Phase 30 moved the clock out of `setupDashboard`'s
  `/s_new` path, but the principle still holds: the FIRST `/s_new`
  the frontend issues post-attach is a tap synth or tone synth in
  the parent group, and either could `/fail` on an ID collision.
  If `ServerErrorBus` subscribes after the first `/s_new`, the
  `/fail` reply lands in the listener-less window and is silently
  dropped — no UI surface, no debug-log entry. The bus stays the
  FIRST thing constructed in `setupDashboard` (before
  `GroupController` and `ClockController`). Don't reorder.
- **OSC routing in the bridge happens BY OSC ADDRESS PREFIX.**
  `config.json -> routes: [{prefix, target}]` is walked
  top-to-bottom, first `starts_with` match wins. A bundle is
  routed by the address of its first inner message
  (mixed-target bundles are unsupported). Default route =
  `scsynth` field. Hot path: `peek_osc_address` decodes only
  enough bytes to extract the address (no full rosc decode).
  Adding a future target (metronome, MIDI, analyzer) is a
  config entry, not a code edit.
- **`?scsynth=HOST:PORT` query parameter is GONE (Phase 29d).**
  Pre-29 every WS upgrade carried a per-connection scsynth
  override. Sessions are now bound to `config.json -> scsynth`
  at creation time and don't accept overrides. To point a
  session at a different scsynth, edit `config.json` and
  restart the bridge. The WS upgrade requires
  `?session=<uuid>` and 400s without it.
- **Bridge owns scsynth-side cleanup (Phase 29d).** Pre-29 the
  frontend fired `/g_freeAll` + `/notify 0` from a `pagehide`
  listener. Now the frontend just sends `DELETE
  /api/session/:id` (with `keepalive: true` from `pagehide`)
  and the bridge runs `Session::cleanup` on receipt. The TTL
  task (default 30 min, scans every minute) catches whatever
  the keepalive doesn't (hard SIGKILL of the browser, etc.).
  Hard SIGKILL of the bridge skips both paths; sessions die
  with the process.
- **scsynth `maxLogins=8` is the per-bridge session ceiling.**
  Each session holds one `/notify` slot for its TTL window
  (not just for a WS lifetime). `scripts/sc-app-superdirt-startup.scd`
  + the systemd unit + `start-scsynth-only.sh` all set it to
  8; bumping requires editing all three together. 8
  simultaneous sc-app tabs is well above realistic use.
- **The sclang startup is split across `scripts/lib/`.** The main
  `sc-app-superdirt-startup.scd` is a thin orchestrator (~110
  lines): it sets `s.options.*`, runs `s.newAllocators`, kicks
  off the alive thread, and inside `s.doWhenBooted` calls
  `~scAppInstallClock.()`, `~scAppInstallSuperDirt.()`,
  `~scAppInstallDirtListSamples.()`, `~scAppInstallScopeResponders.()`
  in order. Each function lives in its own file under
  `scripts/lib/` (clock.scd, superdirt.scd, dirt-list-samples.scd,
  scope.scd), loaded at pre-boot via `.load`. When adding a new
  responder family, drop a new `lib/<name>.scd` defining
  `~scAppInstallX = { ... }`, then add the filename to the
  orchestrator's load array AND a call inside doWhenBooted.
- **`tauri dev` reads `app_config_dir/config.json`, NOT the
  project's `./config.json`.** On macOS that's
  `~/Library/Application Support/com.sc-app.dev/`. A stale
  starter file written by an older sc-app build (without the
  `/dirt` route seeded) breaks SuperDirt routing silently
  with `/fail /dirt/hello: Command not found` — the bridge
  has no `/dirt` route so the message goes to scsynth. Fix:
  delete the file (let starter regenerate) or hand-edit the
  route in. `yarn dev:full` reads the project-root
  `./config.json` instead and doesn't hit this.
- **Session UUID lives in `sessionStorage`, not
  `localStorage`.** `sessionStorage` is per-tab and dies on
  tab close — exactly the boundary we want. `localStorage`
  would share the id across tabs and collapse them onto the
  same scsynth `clientId` → `IdAllocator` collisions →
  `/s_new duplicate node ID`. The storage key is
  `sc.session`; `sessionBootstrap.ts` is the only writer.
  Incognito / Private mode wipes `sessionStorage` per tab
  on close, which means private browsing always generates
  a fresh session — fine, just document.
- **Vite dev proxy must forward both `/ws` and `/api`.** Phase
  29 added the HTTP API surface; `vite.config.ts` lists both.
  Forgetting the `/api` entry surfaces as a 404 in the
  browser DevTools network tab when the frontend tries to
  bootstrap — the Vite dev server returns its own 404 page
  for unproxied paths.
- **Don't shadow the `status` OSC builder import with a
  local `status: ConnectionStatus` variable.** AppShell
  imports `status` from `@sc-app/server-commands` for the
  heartbeat tick AND has a local connection-state
  enum (`'connected' | 'connecting' | 'disconnected'`).
  Name the local variable `connectionStatus`; calling the
  enum `status` triggers a TS error
  (`'status' is callable. No constituent of type
  'ConnectionStatus' is callable`).
- **Worker `setInterval` is unthrottled, but the worker→main
  message channel still backs up under tab throttling
  (Phase 32).** When the tab is backgrounded the worker keeps
  pumping (audio is correct), but every `stepFired` posted
  back to main waits in the queue until main is unthrottled.
  On refocus, hundreds of events flush at once. We rely on
  React 18 batching + `Object.is` short-circuit on the
  `currentStep` store; if a future React change drops
  batching for postMessage events the playhead could thrash.
  No manual debounce in the controller — keep it that way
  unless it becomes a real problem.
- **Bank snapshot must be structured-clone-friendly
  (Phase 32).** `SequencerController` posts the bank shape
  `{ slots: Pattern[], activeIndex, chain }` to the worker
  on every reactive fire. All current fields are POJOs.
  Adding a class instance (Date, Set, Map, anything with a
  prototype carrying methods) would have its prototype
  stripped by structured clone — the worker would see a
  bare data object and break silently. Audit the bank
  shape on every change.
- **`SequencerController` constructor signature changed in
  Phase 32.** Lost `dirtClient` (the worker emits OSC now)
  + the `isGroupPaused: () => boolean` callback (replaced by
  `groupState: ReadonlyStore<GroupState>` so the controller
  subscribes rather than polls). Gained `client:
  WorkerClient`. Any future fake controller written for
  tests must match the new shape.
- **`src/sequencer/scheduler.ts` is gone (Phase 32c).** The
  pump function, `tickToTimetag` math, lookahead constants
  (`INITIAL_LOOKAHEAD_TICKS`, `LOOKAHEAD_HORIZON_TICKS`,
  `SUPERDIRT_SAFETY_LOOKAHEAD_MS = 200`) all live in
  `src/workers/sequencerPump.ts` now. If you need to read
  the canonical pump implementation, look there. The 200 ms
  SuperDirt safety shift is the load-bearing piece — it keeps
  `bundle_timetag - sclang_now` positive so SuperDirt's
  `playFunc` schedules `/s_new` bundles in scsynth's audio
  future, clear of audio-clock drift.
- **`/status` heartbeat is gated on `document.visibilityState`
  (Phase 33a).** Pre-33 the 3 s heartbeat ran unconditionally;
  Chromium's intensive throttling (after ~5 min hidden) clamps
  both `setInterval` and the 2 s reject-timer to 1/min, racing
  against queued `/status.reply` postMessages. The race could
  fire the timer first and falsely tear down a healthy session.
  Now `tick()` early-returns when hidden, with a
  `visibilitychange → visible` listener firing one immediate
  tick on return. Bridge TTL (default 30 min) is the
  ground-truth aliveness check during background.
- **Clock freshness watchdog lives in the worker (Phase 33b).**
  `src/workers/clockWatchdog.ts` runs the freshness check on
  an unthrottled worker `setInterval`, since `clockTick`
  postMessages from the worker queue under main-thread
  throttling and a main-thread watchdog would read stale
  `lastSignalAt`. Worker only emits `clockFreshness` events on
  fresh ↔ stale transitions (the dedup is in
  `emitFreshness`); `ClockController` consumes them as the
  source of truth for the freshness component of
  `effectiveState`. Subscribe BEFORE calling
  `client.startClockWatchdog` — the worker emits the initial
  `fresh: true` synchronously inside that call, so a listener
  registered after misses it.
- **`clockWatchdog` uses `Date.now()`, not `performance.now()`.**
  Vitest's fake timers advance `Date.now` deterministically
  but leave `performance.now` running on real wall-clock —
  `Date.now()` keeps the watchdog test runs deterministic. The
  freshness window is short (~40 ms at default config) so any
  NTP-adjustment drift between measurements is irrelevant in
  practice. If you copy the pattern for another worker-side
  watchdog, do the same.
- **Bridge enforces loopback `Host` and `Origin` headers
  (Phase 34).** `src-tauri/src/server/security.rs` has the
  validators + an axum `enforce_host` middleware layered before
  `with_state` in `serve_on`. The single WS handler
  (`ws_handler` — Phase 35 retired the separate
  `ws_scope_handler`) calls `check_ws_origin` before upgrade.
  Allowlist: hostname ∈ `{127.0.0.1, localhost, ::1}` for Host;
  `http(s)://<loopback>` plus `tauri://localhost` for Origin.
  Port is intentionally not validated — bridge is loopback-bound
  so any port reaching us is a loopback port. Missing Origin
  on WS is allowed (browsers always send it; missing means
  non-browser CLI which bypasses any browser-side defense
  anyway). 421 Misdirected Request for Host rejection (OWASP-
  recommended for DNS-rebinding); 403 Forbidden for Origin.
- **Vite dev forwards `Host: localhost:1420`, not the bridge's
  port.** `server.proxy` defaults to `changeOrigin: false`, so
  the original Host passes through. Both `localhost:1420`
  (dev) and `127.0.0.1:<port>` (Tauri release / bridge mode)
  pass the loopback check, so it Just Works. If a future
  config change sets `changeOrigin: true`, the Host becomes
  the target's address, which also passes — but be aware the
  Host the bridge sees in dev is NOT necessarily its own port.
- **Origin rejection happens BEFORE `ws.on_upgrade(...)`.** A
  pre-upgrade 403 reads as a clean failure to the browser's
  WebSocket API; an upgrade-then-close reads as a connection
  drop and triggers reconnect logic. The handler signature
  takes `headers: HeaderMap` so the check can run synchronously
  before the WebSocket extractor's upgrade step.
- **Scope chunks travel in-band on the main /ws (Phase 35).**
  First-byte dispatch: 0x01 subscribe / 0x02 unsubscribe /
  0x03 chunk; OSC's `/` (0x2F) and `#` (0x23) keep the op-tag
  space unambiguous. Wire is in `src/workers/scopeWire.ts` +
  `src-tauri/src/server/ws_bridge.rs`'s `encode_chunk` /
  scope handlers — change one, change the other. Subscription
  ID is an integer minted by the worker; bridge never
  interprets it. The pre-35 `/ws/scope` endpoint is gone.
- **WS-close cleans up scope subscriptions explicitly
  (Phase 35).** `ScopeContext` is owned by
  `handle_ws_session`'s scope, so it drops when the function
  returns — taking the per-WS subscription map with it.
  `forwarder_tasks.abort()` at end-of-function stops the
  polling/forwarding tasks. A `tracing::debug` line names the
  count of subscriptions dropped, so the cleanup is visible in
  traces. The session-level `scope_shm: OnceCell` survives
  WS close — other WSs on the same session reuse it; it drops
  only when the `Session` itself drops (TTL eviction or
  DELETE). If a future refactor moves `ScopeContext` onto the
  `Session` (shared across WSs), audit the cleanup story
  carefully.
- **Default-route forwarder owns SHM polling (Phase 35).** The
  forwarder for `session.scsynth_addr` is a specialization of
  `forward_broadcast` (`forward_default_route`) that peeks each
  broadcast payload for `/clock/tick` and, on hit, polls SHM
  for every active subscription on this WS via
  `poll_scope_chunks`. The forward-OSC-then-poll-SHM ordering
  is intentional: the worker's clock-watchdog records the tick
  on the OSC decode path BEFORE any chunk arrives. Reversing
  the order would invert the watchdog's freshness anchoring
  by ~one network hop's worth of latency.
- **Scope path mode is per-session, frozen at create
  (Phase 36).** `Session::scope_mode` (`ScopeMode::Shm |
  ScopeMode::Osc`) is probed once in `Session::create` (or
  forced via `--no-shm`) and never changes for that session's
  lifetime. The frontend reads it from `/api/scope/probe`'s
  `mode` field at session bootstrap and picks the matching
  SynthDef + buffer-allocation in `BufferController.start()`.
  Mid-session mode change is unsupported — if SHM availability
  changes (rare), the user has to refresh, which mints a new
  session.
- **OSC fallback wire-format reuse (Phase 36).** The 0x01
  subscribe frame's `scope:u32` field is interpreted as either
  a scope-buffer index (SHM mode) or a bufnum (OSC mode) by
  the bridge based on `Session::scope_mode`. Frontend picks
  the right value at the controller layer; worker is
  mode-blind. `OscScopeSubscription::bufnum` mirrors what
  pre-31's worker tracked but lives on the bridge now.
- **OSC fallback caps at ~250 Hz tick rate (Phase 36).**
  `READ_DELAY_MS = 5 ms` (the `/b_getn` bundle timetag shift,
  matches pre-31) needs to fit inside `tickInterval`. At tick
  rates above 200 Hz the budget shrinks; above 250 Hz scsynth
  starts logging `late 0.0XX` warnings and chunks may arrive
  after the writer has overwritten their ring half. SHM mode
  has no equivalent ceiling. See the chunkSize × sampleRate
  table above for the practical cells (⚠OSC marker).
- **clockBus is back (Phase 36) for the OSC tap synth.** We
  retired it in a post-34 tidy because nothing read it
  post-Phase-31. Phase 36's `bufferTapOscSynthDef` reads
  `In.ar(clockBus, 1)` to derive a sample-aligned ring
  writeIdx via `writeIdx = clockPhase % (2 × chunkSize)`. SHM
  mode ignores `clockBus`; OSC mode requires it. sclang's
  clock SynthDef publishes the Phasor + `Out.ar(clockBus, …)`
  unconditionally; cost is one `Out.ar` per audio block,
  ~zero. `ClockController.clockBus` getter is back for
  consumers.
- **`IdAllocator(buffer)` is back (Phase 36).** Base offset
  `clientId * 1_000_000 + 5000` (room above for nodes; well
  separated from SuperDirt's buffers in shared-server
  deployments). Used only in OSC mode for `/b_alloc`, but
  constructed unconditionally — cheap. SHM mode never touches
  it.
- **`bridge --no-shm` forces OSC mode (Phase 36).** Useful for
  testing the OSC code path without disabling SHM at the OS
  layer. Sets `AppState.force_osc_mode = true`; every new
  session unconditionally picks `ScopeMode::Osc` regardless of
  probe result. Boot log line names the flag when set. GUI
  mode hardcodes `force_osc_mode = false` (same machine, SHM
  always reachable).
