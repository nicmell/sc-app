# Phase History

Append-only record of phases shipped on this project. Each entry is a
condensed write-up of one phase: goal, what shipped (files +
behaviours), key design decisions or adaptations from the original
spec, and gotchas worth carrying into future work.

The phase-level forward-looking spec lives in [`plan.md`](./plan.md).
The Phase-discipline workflow (see `CLAUDE.md`) is: implement →
update plan.md's "Files (as landed) / Adaptations" subsection →
when the phase is fully done, **move that entry from `plan.md` to
this file** under a new section, and trim `plan.md` of the moved
content. That keeps `plan.md` small enough to re-read in full at the
start of each new phase, while preserving "why did we decide X" as
canonical lookup here.

Phase 13 below consolidates what shipped across 13 / 13.5 / 13.6 —
sub-phases were inserted as the work expanded; the flattened version
is the cleaner read.

---

## Table of Contents

- [Phase 0 — Tauri Backend + WS↔UDP Bridge + CLI](#phase-0--tauri-backend--wsudp-bridge--cli)
- [Phase 1 — Worker Transport](#phase-1--worker-transport)
- [Phase 2 — Typed Command/Reply Proxy](#phase-2--typed-commandreply-proxy)
- [Phase 3 — SynthDef Compile & Load](#phase-3--synthdef-compile--load)
- [Phase 4 — Parent Group & `/n_run`](#phase-4--parent-group--n_run)
- [Phase 5 — Global Clock SynthDef](#phase-5--global-clock-synthdef)
- [Phase 6 — Shared Phasor on Clock Bus](#phase-6--shared-phasor-on-clock-bus)
- [Phase 7 — Scope SynthDef, Manual Poke](#phase-7--scope-synthdef-manual-poke)
- [Phase 8 — Worker Tick-Driven Read Loop](#phase-8--worker-tick-driven-read-loop)
- [Phase 9 — Single-Channel Renderer](#phase-9--single-channel-renderer)
- [Phase 10 — Multi-Channel](#phase-10--multi-channel)
- [Phase 11 — Multi-Scope](#phase-11--multi-scope)
- [Phase 12 — Recording Pipeline](#phase-12--recording-pipeline)
- [Phase 13 — UI Polish, Runtime sampleRate, Global chunkSize](#phase-13--ui-polish-runtime-samplerate-global-chunksize)
- [Phase 14 — Recording Waveform View](#phase-14--recording-waveform-view)
- [Phase 15 — Source Synths Panel](#phase-15--source-synths-panel)
- [Phase 16–21 — Shared Buffer Layer Refactor](#phase-1621--shared-buffer-layer-refactor)
- [Phase 22 — Per-session Bridge State (Disconnect Cleanup)](#phase-22--per-session-bridge-state-disconnect-cleanup)
- [Phase 23 — Unified Logging Pipeline](#phase-23--unified-logging-pipeline)
- [Phase 24 — scsynth `/fail` Surface](#phase-24--scsynth-fail-surface)
- [Phase 25 — Bundle & Dev Workflow Refresh](#phase-25--bundle--dev-workflow-refresh)
- [Phase 26 — SuperDirt via Bridge-Internal OSC Router](#phase-26--superdirt-via-bridge-internal-osc-router)
- [Phase 27 — Step Sequencer for SuperDirt](#phase-27--step-sequencer-for-superdirt)
- [Phase 28 — Shared UI Foundation Package](#phase-28--shared-ui-foundation-package)
- [Phase 29 — Bridge-Managed Sessions + Auto-Connect](#phase-29--bridge-managed-sessions--auto-connect)

---

## Phase 0 — Tauri Backend + WS↔UDP Bridge + CLI

**Goal.** Tauri 2 project that boots in two modes — native GUI
shell or standalone HTTP server (`sc-oscilloscope serve`) — and
exposes a WebSocket endpoint that forwards each binary frame as a
UDP datagram to scsynth and relays datagrams back. Pure transport;
no audio logic.

**What shipped.**
- `src-tauri/Cargo.toml` (tauri 2, tokio, clap, hyper,
  hyper-tungstenite).
- `cli.rs` — clap derive CLI; no args → Tauri GUI; `serve` → HTTP.
- `server/mod.rs` — Hyper HTTP server, serves `dist/` from
  bundled bytes, SPA fallback, `/ws` upgrade.
- `server/ws_bridge.rs` — per-WS ephemeral UDP socket, scsynth
  address chosen via `?scsynth=HOST:PORT` query param so the
  Connect Screen can route per-session without restarting the
  backend.

**Gotchas.** scsynth replies to whichever socket the command came
from — one socket = one client session. Don't share UDP sockets
across WS connections.

## Phase 1 — Worker Transport

**Goal.** ConnectScreen + Worker transport (bytes only). User types
scsynth address, app opens a WebSocket, raw bytes round-trip, no
typed OSC layer yet.

**What shipped.**
- `ConnectScreen.tsx` — host:port form, persists last-used in
  localStorage.
- `workerProtocol.ts` — typed `MainToWorker` / `WorkerToMain`
  union shapes.
- `transport.ts` (worker-internal) — `new WebSocket(url, [])` with
  `binaryType = 'arraybuffer'`.
- `oscWorker.ts` — Vite `?worker` entry; receives
  `{type:'connect',url}`, opens WS, forwards bytes both ways.
- `WorkerClient.ts` (main thread) — wraps the Worker with typed
  promises.
- `AppShell.tsx` — gates the dashboard on a successful connect.

**Adaptations.** Originally planned an `OscConsole` panel; the
panel files were kept in `src/ui/OscConsole/` but unmounted from
AppShell during Phase 13 cleanup. A `?debug` flag could remount it.

## Phase 2 — Typed Command/Reply Proxy

**Goal.** Replace raw bytes with `OSC.Message` / `OSC.Bundle` on
main + worker. Add `WorkerClient.sendCommand` (encode locally, post
bytes), `WorkerClient.sendAndSync` (encode + `/sync` await),
`WorkerClient.sendAndAwaitReply(packet, addr)` (await a specific
reply address).

**What shipped.**
- `@sc-app/server-commands` integration into both threads.
  Worker decodes inbound, flattens bundles, posts plain
  `{address, args}` POJOs (structured-clone strips the OSC.Message
  prototype).
- `WorkerClient` adds `onReply`, `onError`, `onTick` (Phase 5),
  `subscribeScope` (Phase 8), `subscribeRecording` (Phase 12).
- `DebugLog` panel — captures `console.{log,info,warn,error}` via
  a Proxy + a worker→main `log` event channel.

**Gotchas.** osc-js needs `window` even in workers. The bootstrap
shim sets `globalThis.window = globalThis` *before* the first
osc-js import (`workerBootstrap.ts`). Whole-number floats are
encoded as `int32` per osc-js's `%1 === 0` test — matches sclang
and scsynth accepts it.

## Phase 3 — SynthDef Compile & Load

**Goal.** Typed UGen surface; first SynthDef compiled in TS, sent
via `/d_recv`, acknowledged via `/done /d_recv`.

**What shipped.**
- `@sc-app/synthdef-compiler` integration via Vite alias.
- `SynthDefRegistry.ts` — idempotent `ensureLoaded(name, bytes)`
  tracker so re-uploads skip the round-trip after the first.
- `noopSynthDef.ts` (early dev) — later removed in Phase 13.
- `SynthDefPanel.tsx` (early dev) — later removed in Phase 13.

## Phase 4 — Parent Group & `/n_run`

**Goal.** Allocate node + buffer + bus IDs from monotonic
counters; create a parent group; pause/resume the entire group via
`/n_run`.

**What shipped.**
- `IdAllocator.ts` — `IdAllocator(start)` with `.next()` and
  `.nextBlock(n)`. Defaults: nodes/buffers from 1000, buses from
  32 (skips hardware-reserved range).
- `GroupController.ts` — `ensureCreated()` bundles `/g_new
  groupId addAction targetGroupId` with `/n_run groupId 0`
  atomically, so the group materialises **paused**. `setPaused`,
  `free()`.
- Parent group ID derived from scsynth-assigned `clientId`
  (returned by `/done /notify`) as `clientId × 100`. Falls back to
  literal `100` when `clientId = 0` (would clash with root group).

**Gotchas.** Creating the group paused (atomic bundle) was a
later refinement: the first version of ClockController started the
clock synth then immediately paused, which produced 1–2 startup
ticks. Bundling group creation with `/n_run 0` removes the
race. The decision lives at `GroupController.ensureCreated`.

## Phase 5 — Global Clock SynthDef

**Goal.** A dedicated clock synth at the head of the parent group
that fires `SendTrig` at a known rate, demuxed into `clockTick`
events on main.

**What shipped.**
- `clockSynthDef.ts` — `compileClockSynthDef(tickRate)`. Cache key
  `tickRate`. Body: `Impulse.kr(tickRate)` → `PulseCount.kr` →
  `SendTrig.kr(impulse, CLOCK_TRIG_ID, count)`.
- Reserved `CLOCK_TRIG_ID = 1000`. Worker demuxes `/tr` matching
  this id into `clockTick` events; non-clock `/tr`s flow to
  `onReply` as normal.
- `ClockController.ts` — `start()` /s_news the clock at AddToHead;
  `stop()` /n_frees it; captures `tick0Ms` on the first tick;
  exposes a `tickIndex` reactive store + an extrapolated
  `nowTick(performance.now())`.

**Gotchas.** `Impulse.kr(freq, phase=0)` fires at t=0, not at
t=1/freq. So tick `N` corresponds to audio frame
`(N-1) × samplesPerTick`, *not* `N × samplesPerTick`. The
`completedHalf = tickIndex % 2` parity formula in the worker hangs
on this — cost a debug session in Phase 8 to discover.

## Phase 6 — Shared Phasor on Clock Bus

**Goal.** Make all consumers (scopes, recorders) advance their
ring-buffer write index in lockstep by reading a shared phasor off
an audio bus the clock writes to.

**What shipped.**
- Clock SynthDef extended to publish a `Phasor.ar` on
  `clockBus = ids.bus.next()`.
- `ClockController.probePhase(durationMs)` — early diagnostic
  that read clockBus values back via SendTrig at known points;
  removed in Phase 13.
- `phaseProbeSynthDef.ts` — dev only; removed in Phase 13.

**Group ordering invariant.** Clock at head; everything else
(scopes, recorders, sources) `AddToTail`. Documented in
`CLAUDE.md`. Violating this means consumers read the *previous*
control block's clockBus value — a constant ~1.3 ms lag.

**Sample-rate sanity check.** Compared scsynth's `/status` reported
sampleRate against `DEFAULT_ENV.sampleRate` (then 48 kHz hardcoded).
Replaced in Phase 13 with runtime sampleRate detection.

## Phase 7 — Scope SynthDef, Manual Poke

**Goal.** A tap synth that reads `inBus` and writes into a
double-buffer ring at the clockBus-derived `writeIdx`.

**What shipped.**
- `scopeSynthDef.ts` — `compileScopeSynthDef(channels, chunkSize)`.
  Cache key `(channels, chunkSize)`. Reads `In.ar(inBus, channels)`,
  derives `writeIdx = phase mod (chunkSize × 2)`, `BufWr.ar`s into
  the ring.
- `testToneSynthDef.ts` (later replaced by `toneSynthDef.ts` in
  Phase 15) — sine on a chosen bus, used to verify the tap.
- `BufferPoker.ts` (dev) — manual `/b_getn` button; removed in
  Phase 13.

**Gotcha (load-bearing).** Tap synths must read `clockBus`, not a
local `Phasor.ar`. The worker's `completedHalf = tickIndex % 2`
parity formula assumes the buffer's half boundaries align with
global tick parity — a clockBus-driven `writeIdx` inherits that
alignment for free; a local Phasor's start tick has its own zero
point. Cost a Phase 12 debug cycle.

## Phase 8 — Worker Tick-Driven Read Loop

**Goal.** On each clock tick, fire `/b_getn` for every subscribed
scope buffer and post the resulting `/b_setn` reply to main as a
`scopeChunk` event.

**What shipped.**
- `subscriptionTable.ts` (worker-side) — registry of active scope
  subscriptions keyed by `scopeId`.
- Tick handler — for each subscription, fire `/b_getn` for the
  just-completed half (offset = `(tickIndex - 1) % 2 × chunkSize ×
  channels`). Wrapped in `OSC.Bundle` with timetag
  `Date.now() + READ_DELAY_MS` (5 ms) to absorb kr-vs-ar slop
  between `Impulse.kr` and `Phasor.ar`.
- `/b_setn` interception — match by bufnum, build `scopeChunk`,
  `postMessage(..., [data.buffer])` zero-copy to main.

**Gotchas.**
- `READ_DELAY_MS = 5`. Smaller and tail samples can be clipped
  mid-write; larger eats into the next tick's budget at high
  rates.
- scsynth's OSC scheduling clock drifts 10–20 ms from `Date.now()`
  in practice; bundles whose timetag lands in the past per scsynth
  log a `late 0.0XX` message and run immediately. Harmless — the
  timetag is still useful as a *floor* on the scheduling delay.

## Phase 9 — Single-Channel Renderer

**Goal.** One scope card with a canvas that draws the latest
`scopeChunk` at 60 Hz.

**What shipped.**
- `ScopeView.tsx` — props `{controller, height, width}`. Internal
  RAF loop reads `controller.latestChunk` (a `useRef`, not React
  state — see below) and draws.
- `ScopeController.ts` — owns the buffer + tap synth + worker
  subscription; exposes `latestChunk` as a mutable ref written
  on every `scopeChunk` event.

**Why a ref, not state/store.** Chunks arrive at the tickRate
(47 Hz at 48 k / 1024). Putting them in React state forces a
re-render per chunk; using a ref lets the canvas RAF loop pull
"the latest" at 60 Hz without re-rendering React. The store
abstraction (`createStore<T>`) is reserved for *control* state
(gain, paused, label) where re-render-per-change is correct.

## Phase 10 — Multi-Channel

**Goal.** Render N-channel scopes (1 or 2 today) in stacked lanes.

**What shipped.**
- `ScopeView` lane layout: `lanes: [{y0, y1}, ...]` derived from
  `channels` and canvas height.
- Interleaved sample reading — `scopeChunk.data` is
  `chunkSize × channels` floats interleaved.

**Adaptation.** A "stacked vs overlay" layout knob was specced but
dropped — stacked-only is the default and there was no real demand
for overlay.

## Phase 11 — Multi-Scope

**Goal.** Multiple scope cards on the same dashboard, each with its
own bus + channels + label.

**What shipped.**
- `ScopeManager.ts` — reactive `scopes: Store<ScopeController[]>`,
  `add({inputBus, channels, label?})`, `remove(scopeId)`,
  `clear()`.
- `ScopeList.tsx` — toolbar `[bus][channels][label][Add]` plus
  per-scope cards. Initially the toolbar offered "auto-allocate
  bus + bundle a testTone source"; that was the bundled-source UX
  that Phase 15 dismantled.

## Phase 12 — Recording Pipeline

**Goal.** Mirror the scope path for recordings: a `recorderSynthDef`
tap, a per-recording subscription, an in-memory WAV writer in the
worker, gap accounting for missed `/b_setn` replies, finalisation
into a `Blob` on stop.

**What shipped.**
- `recorderSynthDef.ts` — same shape as `scopeSynthDef` (clockBus-
  driven `writeIdx`, ring-buffer of `2 × samplesPerTick × channels`
  frames). Cache key `(channels, samplesPerTick)`.
- `RecordingSubscription` — per-recording entry in the worker's
  subscription table. Keyed by `recordingId`. Carries
  `bufnum, channels, sampleRate, samplesPerTick, retry`.
- Worker dispatch: per tick, fire `/b_getn` for each recording
  subscription. Pending reads tracked in
  `pendingByOffset: Map<offset, PendingRead>` (capacity 2 — one
  per ring half) so a late reply at offset 0 can land while a
  fresh read at offset N is in flight.
- `reorderBuffer: Map<tickIndex, …>` — out-of-order replies are
  buffered and drained in tick order so the WAV stays linear.
- `wavWriter.ts` (worker) — in-memory WAV encoder. Float32, header
  patched at finalise.
- Gap detection: if `pendingByOffset` ages out past `retry.deadlineMs`,
  emit a `recordingGap` event and zero-fill `framesMissing × channels`
  in the WAV so time math stays linear.
- `RecordingController.ts` / `RecordingManager.ts` /
  `RecordingPanel.tsx` (the user-facing surface).
- `download.ts` — Blob → save (native dialog under Tauri, `<a
  download>` in browser).

**Gotchas / decisions.**
- Single-slot `pendingRead` (the scope's pattern) is **not**
  sufficient for recordings under load: scsynth's `/b_setn`
  sometimes round-trips longer than `tickIntervalMs`, and the next
  tick's read overwrites the previous tick's pending. Offset-keyed
  is mandatory.
- Gap sidecar JSON: a stringified list of
  `{tickIndex, framesMissing}` pairs, offered alongside the WAV
  download for forensics.

## Phase 13 — UI Polish, Runtime sampleRate, Global chunkSize

This phase consolidates what shipped across 13 / 13.5 / 13.6 —
sub-phases were inserted as the work expanded. The combined story:

**Goal (final).** Production-adjacent UX. Runtime sample-rate
detection (no hardcoded 48 kHz). A global, mutable chunkSize that
the user can change mid-session. `beforeunload` warning when there's
dirty recording state. Final styling pass.

**What shipped.**
- **Runtime sampleRate.** `AudioEnvironment.sampleRate` read from
  `/status.reply.args[7]` (nominal, rounded — `args[8]` is the
  `actualSampleRate` which is a fractional drift number that
  breaks the WAV writer's integer requirement). `DEFAULT_ENV` is
  gone.
- **Global chunkSize.** `ClockParams = {chunkSize}` only. `tickRate`
  is derived `sampleRate / chunkSize`. The header dropdown lets
  the user pick `chunkSize ∈ practicalChunkSizes(sampleRate)`,
  triggering an in-place reinit.
- **In-place reinit.** `setupDashboard(client, parentGroupId,
  sampleRate, chunkSize)` and `teardownServerState(resources)`
  extracted from `handleConnect` / `handleDisconnect`'s middle. The
  reinit reuses the same WS, **does not re-issue `notify(1)`** (it
  would either be rejected or hand back a different clientId,
  orphaning the existing parent group). `parentGroupId` is stashed
  on `DashboardResources` for that reason.
- **Modals.** Generic `LoadingModal`, `ConfirmModal`, `ErrorModal`
  (portal-rendered overlays in `src/ui/Modal/`). Loading shown
  during reinit. Confirm asks before reinit when there's dirty
  recording state. Error modal shows runtime errors (scsynth
  death, WS close) without redirecting to ConnectScreen.
- **scsynth liveness heartbeat.** A `/status` ping every 3 s with
  a 2 s timeout, since WS stays open when scsynth dies. Surfaces
  scsynth death as a runtime error modal.
- **`/status` snapshot + `/version` reply** stashed in a reactive
  store and rendered in a footer.
- **Group-level pause-by-default.** GroupController.ensureCreated
  bundles `/g_new` + `/n_run 0` atomically so the clock doesn't
  fire startup ticks. Resume button reads "Resume" until the user
  starts the group.
- **`beforeunload` handler.** Opt into the browser's "leave site?"
  prompt when any recording is in `recording / preparing /
  finalizing` state or has a `done`-state Blob the user hasn't
  downloaded.
- **Final styling pass.** Design-token palette in `src/styles.scss`
  (CSS variables); shared `.panel` class; per-panel SCSS files
  reference variables instead of duplicating chrome.
- **Dead-code cleanup.** Removed `OscConsole` (kept files,
  unmounted), `ScopeTestPanel`, `SynthDefPanel`,
  `phaseProbeSynthDef`, `BufferPoker`, `monitorSynthDef`,
  `noopSynthDef`, `GroupController.queryTree`,
  `ScopeView.defaultLayout`. TS strict `noUnusedLocals` /
  `noUnusedParameters` enforced.

**Adaptations from original spec.**
- **Per-scope `chunkSize` + `decimation`** shipped (post-13.5) and
  was **reverted** in 13.6. The user wanted a single global knob
  with `decimation = 1` (no aliasing). The aliasing problem with
  `decimation > 1` (zero-order-hold rather than proper
  anti-aliased decimation) was the deciding factor.
- **`?debug` flag with PhaseProbePanel / ScopePokerPanel** —
  dropped. Phases 11–14 superseded those dev panels with real UI.
- **QueryTree diagnostic button** — dropped. The OSC helper
  `queryTree(0)` is still exported for ad-hoc console use.
- **Disconnected-state UX** — deferred. WS close currently surfaces
  as a runtime error modal; panels stay mounted with their
  last-known state; user reloads manually. See Future Improvements
  in `plan.md`.

**Gotchas.**
- `chunkSize` is mutable mid-session. SynthDef cache keys for
  `compileScopeSynthDef` and `compileRecorderSynthDef` must be
  `(channels, chunkSize)`, never `(channels)` alone.
- The reinit path runs over the same WS — re-issuing `notify(1)`
  would either be rejected or assign a fresh clientId.

## Phase 14 — Recording Waveform View

**Goal.** Each recording card carries a horizontally-scrollable
canvas with a playhead, second-tick gridlines, and a per-card
window-size selector. Auto-advances while the clock is running and
the recording is in `recording` state; scrollable when paused or
done.

**What shipped.**
- `envelopeBuffer.ts` — typed-array storage for per-tick
  min/max columns per channel. Two `Float32Array`s per channel,
  doubling capacity. `append(tickIndex, chunk)` computes
  per-channel min/max in a single pass; `snapshot()` returns
  subarray views over the filled prefix.
- `RecordingController` composes an internal `ScopeController` on
  the recording's `inputBus` during `start()`. Per-tick chunks
  feed the envelope buffer. Internal scope teardown is
  fire-and-forget on `stop()`.
- `RecordingWaveformView.tsx` — canvas + RAF loop; reads the
  envelope snapshot fresh each frame; renders min/max polylines
  per channel as `fillRect` columns (cheaper than stroked paths
  at typical column counts), second-tick gridlines (skipped when
  columns < 16 px apart), playhead at the latest column. Wheel +
  pointer-drag scrolling when `canScroll` (clock paused or
  recording done). Snap-to-live on clock resume.
- Per-card window-size selector `[1s][5s][15s][60s]`, default 5 s.
  **Live** button visible only when scrolled away from the right
  edge.

**Memory cost.** 8 bytes / tick / channel; 47 ticks/sec at 48 k /
1024 → ~24 KB/min mono, ~48 KB/min stereo. A 30-minute stereo
recording holds ~1.4 MB, dwarfed by the WAV.

**Adaptations.**
- Internal scope subscription via `latestChunk.subscribe` (per-chunk
  callback) rather than the canvas-style `chunkRef` — the
  envelope-append step needs every chunk, synchronously.
- Internal scope teardown fire-and-forget on `stop()` — the
  envelope buffer survives without the scope, no benefit to
  awaiting `/n_free`.
- Snap-to-live on resume — scroll position is treated as a feature
  of the paused/stopped state, not a parallel timeline.

## Phase 15 — Source Synths Panel

**Goal.** Decouple tone synths from scopes. Until now the only way
to feed a recognisable signal into a scope was to let the scope
auto-create a bundled `testTone` / `testToneStereo` source on its
own auto-allocated bus — conflating *producer* and *consumer*. The
recording panel already got this right (user types a bus number);
Phase 15 brings scopes into the same model and lifts the producer
side into a dedicated **Synths** panel.

**What shipped.**
- **Producer surface (new).** `SynthManager` + `SynthController` +
  `SynthsPanel`. Toolbar: kind (mono/stereo), waveform, freq(s),
  amp, label, Add / Clear all. Cards: monospace meta line with
  `nodeId` + `bus` (so the user reads them by eye into Scope /
  Recording panels). Per-card live controls — range sliders for
  freq(s) + amp, waveform select, Start/Stop (gate toggle), Remove.
- **`toneSynthDef.ts`** — `compileToneSynthDef(channels)` emits
  `tone1ch` / `tone2ch`. Cache key `channels`. Args: `outBus`,
  `freq` (mono) or `freqL`/`freqR` (stereo), `amp`, `gate`,
  `waveform` (kr-rate, switchable at runtime via `Select.ar` over
  parallel `SinOsc` / `Pulse(0.5)` / `Saw`). `gate` wrapped in
  `Lag.kr(gate, 0.01)` to declick.
- **Consumer surfaces (modified).** `ScopeManager.add({ inputBus,
  channels, label? })` — no more bus auto-allocation, no more
  bundled source, no more `ScopeSourceSpec`. `ScopeList` toolbar
  pivots to `[bus][channels][label][Add]` (mirrors the recording
  panel).
- **Bus allocator scope.** `ids.bus` is now exclusively driven by
  `SynthManager`; scopes/recordings consume user-typed bus
  numbers. Cross-consumer collisions impossible by construction.
- **AppShell wiring.** `synthManager` on `DashboardResources`,
  constructed in `setupDashboard`, rendered above `<ScopeList>`.
  `teardownServerState` clears synths after scopes/recordings (so
  /n_free's land while the parent group is still alive).
- **Removed.** `testToneSynthDef.ts`, `testToneStereoSynthDef.ts`.

**Adaptations.**
- Range inputs (sliders) for freq + amp instead of number inputs,
  added in a follow-up commit. Waveform select on both toolbar
  (initial value) and per-card (live runtime switch).
- `Select.ar` runs all three oscillators in parallel and picks one
  — three sine/pulse/saw at full audio rate is negligible CPU; the
  trade-off is well worth runtime mutability vs. having to
  `/n_replace` the synth.

**Gotcha.** Synths must `/s_new` before scopes that read their
buses — same control-block ordering rule as the clock. Both use
`AddToTail`, so creation order = runtime order. The UX flow ("add
synth, then add scope") gets it right naturally; a scope created
first reads the previous control block's bus value (~1 ms lag)
until something forces a re-`/s_new`. Documented in `CLAUDE.md`.

## Post-Phase-15 Refactors

Two structural cleanups landed after Phase 15 but before Phase 16
work began. They aren't phases in their own right (no acceptance
criteria, no design doc up-front) but the project state depends on
them:

- **Folder reorganisation** — `src/scope/` was holding most of the
  controllers; carved into feature folders: `src/scope/` (scope
  visualization only), `src/synth/` (runtime tone-synth wrappers),
  `src/synthdefs/` (renamed from `src/synth/`, holds compile-time
  SynthDef byte builders), `src/clock/`, `src/server/` (transport:
  `WorkerClient`, `workerProtocol`, `GroupController`,
  `SynthDefRegistry`, `IdAllocator`, `serverInfo`), `src/util/`
  (`reactiveStore`, `debugLog`, `runtime`). `AppShell.tsx` moved to
  `src/`. The `synth`-vs-`synthdefs` split is deliberate so imports
  read unambiguously: `@/synth/SynthController` vs
  `@/synthdefs/toneSynthDef`.
- **Worker rename** — `src/workers/scopeWorker.ts` →
  `src/workers/oscWorker.ts`. The worker isn't scope-specific (it
  also handles recording subscriptions, the clock /tr mux, OSC
  encode/decode forwarding) — name follows function.

## Phase 16–21 — Shared Buffer Layer Refactor

**Goal.** Insert a shared `BufferController` + `BufferManager`
layer between consumers (scopes, recordings) and the OSC pipe so
two consumers on the same `(inputBus, channels, chunkSize)` triple
share one tap synth + one buffer + one worker subscription. After
the refactor, a recording + scope on the same bus pays one
`/b_alloc` and one `/s_new` instead of two; multi-consumer
features (spectral analyzers, level meters, tee-recordings)
become "add another subscriber to an existing
`BufferController`."

Six commits, one per sub-phase:

- **Phase 16 — scaffolding.** `src/buffer/BufferController.ts`
  and `BufferManager.ts` land as unreferenced new files. Full
  lifecycle (start/dispose, both idempotent + null-safe), push
  API + pull store, per-acquire handle wrapper with
  double-release guard, in-flight `Promise<BufferHandle>` cache
  to dedup parallel acquires on the same spec, reactive
  `snapshot` store of every active buffer for refcount-leak
  diagnosis.
- **Phase 17 — worker subscription protocol pivot.** The
  worker's subscription table re-keyed on `bufferId`. A single
  `BufferSubscription` and `BufferChunk` replace the per-kind
  `ScopeSubscription` / `RecordingSubscription` /
  `ScopeChunk` / recording-specific event types. The
  offset-keyed `pendingByOffset` + tick-ordered `reorderBuffer`
  + retry pipeline that used to be recording-only now applies
  uniformly. WAV writing relocated from worker to main —
  `RecordingController` owns a `WavMemoryWriter` and finalises
  synchronously in `stop()`, no round-trip wait. Each
  scope/recording controller still owned its own buffer + tap
  synth at this point; they used a per-controller adapter shim
  (`bufferId = scope-${scopeId}` / `rec-${recordingId}`) so the
  protocol pivot could ship without depending on the rest of
  the umbrella.
- **Phase 18 — unified tap synthdef.** `compileScopeSynthDef` +
  `compileRecorderSynthDef` (which produced byte-identical bytes
  modulo synthdef name) collapsed into one
  `compileBufferTapSynthDef(channels, chunkSize)`. Both
  predecessors deleted; importers updated.
- **Phase 19 — `ScopeController` migration.** Scopes become
  pure consumers: `ScopeControllerOptions = { buffer:
  BufferHandle, scopeId, label?, effectiveRate }`. No more
  `client`, `clock`, `group`, `registry`, `ids`. `start()`
  subscribes to `buffer.subscribe(cb)`; `stop()` unsubscribes +
  releases the handle. `ScopeManager.add` calls
  `bufferManager.acquire(spec)`. `BufferController.start` finally
  wired the real worker subscription (the Phase 16 TODO
  placeholder is gone).
- **Phase 20 — `RecordingController` migration.** Recordings
  follow the same shape: take a `BufferHandle`, subscribe once,
  run WAV append + envelope append + gap accumulation off the
  same chunk callback. The Phase 19 "internal envelope-tap
  scope" is gone — pre-Phase-19 the panel waveform display ran
  on a separate `ScopeController` with its own buffer + tap
  synth + worker subscription; now the `RecordingController`
  is the sole subscriber and fans out to both the WAV writer
  and the envelope buffer. `wavWriter.ts` physically moved from
  `src/workers/` to `src/recording/` (its semantic home
  post-Phase-17).
- **Phase 21 — docs.** `CLAUDE.md` architecture diagram updated
  with the new layer; gotchas section gained refcount-lifecycle
  and `bufferManager.clear()` warning-canary entries; the
  "synths-before-scopes" gotcha generalised to
  "producers-before-consumers" (applies to recordings on
  shared buffers too). The Phase 21 *code* work (constructing
  `BufferManager` in `setupDashboard`, updating teardown order
  to recordings → scopes → buffers → synths → clock → group)
  actually landed earlier in Phase 19 because `BufferManager`
  had to exist by then; Phase 21 is therefore docs-only.

**Decisions locked in (from the pre-implementation walkthrough).**

1. Sharing key is `(inputBus, channels, chunkSize)`. `chunkSize`
   stays in the key explicitly even though it's session-global
   today, so the design survives any future where consumers can
   pick different chunk sizes.
2. No channel-slice sharing. `channels` typed `number` (positive
   integer) throughout the buffer layer; multichannel buses
   (≥3 channels) are first-class. The producer-side
   `mono | stereo` UX in `SynthsPanel` is a Phase-15 convention
   only and does not propagate downstream.
3. Chunk fan-out via a shared `Float32Array` (read-only by
   contract; consumers don't retain past one tick).
4. Prompt teardown on last release (no debounce / grace period).
5. Mid-stream join: next-tick start, no replay.
6. Offset-keyed pending reads + tick-ordered reorder buffer
   uniformly across every subscription.
7. One unified `bufferTapSynthDef` replaces the byte-identical
   pair.
8. `AddToTail` placement unchanged; the consumer-before-producer
   failure mode is documented as a future-watch — not addressed
   in this refactor, candidate fixes outlined for when the
   UX-flow ordering guarantee no longer holds.

**Adaptations from spec.**

- **Gap detection NOT temporarily lost.** The Phase-17 spec
  called for gap detection to be dropped until Phase 20
  restored it. We shipped `BufferChunk.isGap: boolean` from
  day one — the worker still zero-fills on retry exhaustion
  and the flag rides on the chunk; recordings materialise gaps
  on receipt. Phase 20 became a smaller change (no
  gap-detection plumbing to add).
- **Phase 20 killed the recording's internal scope entirely.**
  The original spec had recording own a separate scope
  controller for the envelope display. Phase 20 collapsed it:
  recording subscribes once and the chunk callback fans out to
  WAV + envelope. Pre-refactor a recording on a bus with one
  scope used three buffers + three tap synths; post-refactor
  it uses one of each.
- **Sample-accurate /s_new dropped for recordings.**
  Pre-refactor, recordings scheduled `/s_new` in an
  `OSC.Bundle` at `lastTick + 2` so multi-bus recordings
  created in one JS turn shared a tick origin. The refactored
  path routes recordings through `BufferController.start`,
  which fires `/s_new` immediately. Two recordings on
  different buses can be tick-offset by ~21 ms. Audio is still
  phase-aligned via the shared `clockBus` phasor. If
  multi-bus alignment becomes a real concern, add
  `OSC.Bundle` scheduling to `BufferController.start`.
- **Per-recording retry policy dropped.** All subscriptions
  now use the worker's default
  `{ maxAttempts: 1, deadlineMs: 50 }`. With shared buffers,
  per-consumer retry doesn't fit (the buffer's already running
  by the time a second consumer attaches).
- **Phase 21 was docs-only.** The wiring landed early in
  Phase 19 because subsequent phases needed `BufferManager` to
  exist — so by Phase 21 there was nothing left to wire. The
  workflow position (final phase of the umbrella) is preserved
  via the docs commit.

**Gotchas worth carrying forward.**

- **Refcount discipline.** Every `acquire()` must be paired
  with exactly one `release()`. The per-acquire handle wrapper
  guards against double-release with an internal `released`
  flag, so redundant calls are silent no-ops and the refcount
  stays correct. `BufferManager.clear()` warns if the map is
  non-empty at teardown — refcount-leak canary.
- **Map-insert AFTER `start()` resolves.**
  `BufferManager.acquire` inserts the controller into its map
  only AFTER `start()` has resolved. Earlier insertion would
  let a parallel `acquire(sameSpec)` find a half-built entry
  and refcount against it. The in-flight
  `Promise<BufferHandle>` cache handles legitimate concurrent
  acquires by routing them to the same Promise; the
  post-`start` insert closes the failure race. Documented
  inline at the implementation site.
- **`dispose()` is null-safe across every partial state.**
  `BufferController.start()` runs `try { /b_alloc + /s_new +
  subscribe } catch { dispose(); rethrow }`. `dispose()`
  checks each piece of state independently (no nodeId, no
  bufnum, partial subscribe), so a failure at any step inside
  `start` unwinds through one cleanup function. Comment at the
  catch site explains why `dispose` can serve as the single
  cleanup path.
- **`BufferChunk.isGap`** carries the worker's
  retry-exhaustion signal. Recordings materialise it (sidecar
  JSON entry); scopes ignore it (zero-fill draws as silence).


## Phase 22 — Per-session Bridge State (Disconnect Cleanup)

**Goal.** Make the Rust bridge fire cleanup OSC to scsynth when a
WebSocket closes for any reason — clean disconnect, network drop,
browser crash, laptop lid. Before this, frontend-only cleanup
(`handleDisconnect`, `pagehide`) caught the happy paths but every
ungraceful close leaked a parent group, allocated buffers, and a
notify slot. With `maxLogins = 32` (sclang's hard cap), ~32 dirty
disconnects exhaust scsynth's slot pool until restart.

**What shipped.**
- `src-tauri/Cargo.toml` — `rosc = "0.10"` dependency added. Pure
  Rust OSC encoder/decoder; no transitive deps of note.
- `src-tauri/src/server/ws_bridge.rs` — gains a per-session
  `SessionState { client_id: Option<i32> }`, lives in the WS task
  via `Arc<tokio::sync::Mutex<…>>`. Two new behaviours:
  1. **Snoop `/done /notify`** on the inbound (UDP→WS) path.
     Cheap byte-prefix check (`/done\0\0\0`) before invoking
     `rosc::decoder::decode_udp` — sub-microsecond filter, only the
     rare `/done` replies pay the full decode cost. On match, stash
     `args[1]` as `clientId`.
  2. **Cleanup tail after WS close.** Compute `parentGroupId`
     (`clientId × 100`, fallback `100` when `clientId == 0` to
     mirror frontend), encode an OSC bundle of `/g_freeAll
     <gid>` + `/n_free <gid>` + `/notify 0`, send via the
     still-alive UDP socket, sleep 50 ms so datagrams flush, then
     drop the socket.

**Decisions.**
- **Approach A (bridge-side cleanup) over Approach B
  (heartbeat + reaper).** A is ~80 lines of Rust; B would have
  needed a side-channel HTTP endpoint, a reaper task with two
  Maps, and tuning knobs for heartbeat period + staleness.
  A's only weak spot — half-open TCP — is addressable later
  with WS-level Ping/Pong (Approach A'); B's heartbeat-miss
  latency was strictly worse for the common cases (tab close,
  browser crash, network drop with TCP signal). The full
  trade-off table is preserved in the original plan.md spec.
- **`tokio::sync::Mutex`, not `std::sync::Mutex`.** The notify
  snoop runs inside the recv task's async context; using
  std::Mutex would force a `block_in_place` to lock or risk
  panicking under tokio's runtime. async Mutex is fine here —
  contention is one update per session lifetime.
- **Idempotent against frontend cleanup.** If the frontend's
  `handleDisconnect` already freed the group, scsynth no-ops the
  redundant `/g_freeAll` + `/n_free` and returns
  `/fail /notify "Notification not registered"` for the second
  `/notify 0`. We don't read the reply — fire-and-forget over
  UDP, then the 50 ms flush window expires and we drop the
  socket. The `/fail` will surface in Phase 24 as a benign one-
  shot at disconnect time; documented there.
- **Pre-notify disconnects skip cleanup.** If the WS closes
  before `/done /notify` arrives, `client_id` is `None` and the
  cleanup tail logs "session closed pre-notify; no cleanup".
  The frontend never allocated anything in that window, so
  there's nothing to free.

**Gotchas.**
- **OSC "immediate" timetag is `(0, 1)`, not `(0, 0)`.** The
  cleanup bundle uses `OscTime { seconds: 0, fractional: 1 }`
  — `(0, 0)` is a sentinel meaning "no timetag", which scsynth
  treats as deferred-but-unschedulable. Documented in the OSC
  1.0 spec; easy to get wrong.
- **`recv_task.abort()` AFTER cleanup.** The recv task is
  `tokio::spawn`'d and lives until aborted or until the recv
  errors. Aborting it before sending cleanup would race the
  send: the abort is async and the task might still be in the
  middle of `tx.send` when the cleanup bytes hit the kernel.
  Order matters — send cleanup, sleep, then abort.
- **The 50 ms flush is generous.** Localhost UDP usually
  delivers in microseconds. On a Pi production deployment over
  a wired LAN, even 1 ms would be enough. Keeping 50 ms as
  insurance against scheduling jitter; revisit if it ever
  becomes load-bearing.


## Phase 24 — scsynth `/fail` Surface

**Goal.** scsynth replies with `/fail /<originatingCommand>
"<error>" [extras]` whenever it rejects a command. Pre-Phase-24,
only one matcher consumed these (`SynthDefRegistry`'s
`/fail /d_recv` await); every other `/fail` flowed through
`onReply` and got dropped. Closed the diagnostic hole by surfacing
unmatched `/fail` events through a centralized error bus, with a
DebugLog Errors section as the first UI surface.

**What shipped.**
- `src/server/workerProtocol.ts` — `OscError` type
  (`commandAddress`, `errorString`, `extras`, `receivedAt`) and
  `oscError` variant on `WorkerToMain`.
- `src/workers/oscWorker.ts` — `/fail` intercept inside
  `emitReply`. Emits `oscError` AND falls through to the normal
  reply path so existing matchers keep working.
- `src/server/WorkerClient.ts` — `onOscError(cb)` channel,
  `oscErrorListeners` Set, dispatch + cleanup in `dispose()`.
- `src/server/ServerErrorBus.ts` — new controller. Subscribes
  once on construction, exposes `entries` (ring of 100, newest
  first) and `total` (unbounded counter) as `ReadonlyStore`s.
  Mirrors each event to `console.error` with a compact summary
  so it also lands in the existing `debugLog` ring.
- `src/AppShell.tsx` — `errorBus: ServerErrorBus` added to
  `DashboardResources`, constructed in `setupDashboard`,
  disposed at the head of `teardownServerState`. Passed to
  `<DebugLog />`.
- `src/ui/DebugLog/DebugLog.tsx` — `ErrorsSection` sub-component
  rendered above the regular log scroller when `errors.length >
  0`. Header gains an `⚠ N` pill that's visible even when the
  panel is collapsed. SCSS for the new section + pill.

**Decisions.**
- **Both `oscError` and `reply` for the same `/fail`.** Plan
  considered routing /fail exclusively through the new channel.
  Rejected: SynthDefRegistry's `/fail /d_recv` matcher uses
  `onReply`, and adding it to oscError instead would force
  every awaiter that wants /fail context to subscribe through a
  second API. Emitting both is intentional — small dup, large
  decoupling win.
- **No suppression for "expected" /fails (yet).** Phase 22's
  cleanup tail produces a one-shot `/fail /notify "Notification
  not registered"` at every disconnect (the second `/notify 0`
  hits an already-cleared notify slot). Document as benign;
  don't filter. If real noise emerges, add `markExpected(predicate,
  ttlMs)` later — pattern punted to a follow-on.
- **Bus disposed at the head of `teardownServerState`.** Putting
  it first means any /fail replies *during* teardown
  (e.g. `/n_free` against a stale node) don't fire UI updates
  on a dashboard that's already coming down. Rare race; cheap
  insurance.
- **No toast, no separate ErrorsPanel, no header badge in the
  Dashboard chrome.** Plan's three-surface design (panel +
  toast + badge) was scope-trimmed: DebugLog Errors section
  + the inline pill on the DebugLog header gives persistent
  visibility from anywhere on the page (DebugLog is fixed-
  position bottom). Toast and Dashboard-header badge stay on
  the shelf for follow-on work.

**Gotchas.**
- **`useSyncExternalStore` needs stable subscribe/snapshot
  functions when the store is conditional.** Passing
  `errorBus ? (cb) => bus.subscribe(cb) : noop` creates a fresh
  closure each render and triggers a re-subscribe loop. Fix:
  module-level `noopSubscribe` / `noopSnapshot` constants used
  on the `null` branch. Documented inline in `DebugLog.tsx`.
- **`receivedAt` units differ between layers.** The worker
  stamps with `performance.now()` (worker-thread origin); the
  bus re-stamps with `Date.now()` at receive time on main so
  the UI's relative-time display can compare against the wall
  clock. Cross-thread `performance.now()` is not directly
  comparable — stamp on the consumer side.
- **`extras` is `args.slice(2)`, not parsed further.** scsynth
  occasionally puts a nodeId or bufnum past `args[1]`; we keep
  it raw in the bus and JSON-stringify in the UI. If a caller
  later wants typed extras (e.g. "this fail referenced node
  1004"), add a per-command-address parser at that site —
  the bus shouldn't grow heuristics.


## Phase 23 — Unified Logging Pipeline

**Goal.** Persist frontend logs in serve mode (pre-Phase-23 only
Tauri could write to disk via the `fs` plugin; serve-mode logs
were browser-only and lost on refresh) and add structured backend
logging tagged by source. End state: one log file per day per
serve / Tauri instance, containing both bridge events (sessions,
errors, scsynth I/O) and frontend ERROR / WARN events, all JSON
and grep-friendly.

**What shipped.**
- `src-tauri/Cargo.toml` — three new deps:
  - `tracing = "0.1"` (the macros + spans)
  - `tracing-subscriber = "0.3"` with `env-filter` + `json`
  - `tracing-appender = "0.2"` (daily rotation + non-blocking
    writer)
- `src-tauri/src/server/mod.rs` — `init_tracing(log_dir: Option<&Path>)`
  builds a registry with a stderr layer + (when `log_dir` is set)
  a JSON file layer pointing at `<dir>/sc-app.log.<YYYY-MM-DD>`.
  Returns the appender's `WorkerGuard`; callers must keep it alive
  for the process lifetime so background flushes don't drop on
  exit.
- `src-tauri/src/server/log_ingest.rs` (NEW) — `POST /api/logs`
  handler. Parses NDJSON one line at a time; bad lines are
  skipped, the whole batch isn't failed. Each entry re-emits as a
  tracing event at the matching level with `target = "frontend"`
  so file-side filters can distinguish frontend from bridge.
- `src-tauri/src/server/mod.rs` — registers `/api/logs` with a
  `DefaultBodyLimit` of 1 MB (generous for NDJSON batches). All
  the previous `eprintln!` calls in `serve()` and `ws_handler`
  switched to `tracing::info!` / `warn!`.
- `src-tauri/src/server/ws_bridge.rs` — every `eprintln!` →
  `tracing::info!`/`warn!`/`debug!` with structured fields where
  meaningful (`client_id`, `parent_group`, `error = %e`).
- `src-tauri/src/cli.rs` — `Serve { log_dir: Option<PathBuf> }`
  flag (env `SC_LOG_DIR`). `run_server_blocking` and `run_gui`
  both call `init_tracing` + bind the guard to the local stack so
  it lives until the process exits. `run_gui` reads `SC_LOG_DIR`
  from the environment since Tauri builds have no CLI.
- `src/util/logShipper.ts` (NEW) — frontend batcher. Hooks into
  `debugLog`'s push channel via `setLogShipper`. ERROR + WARN
  flush immediately; LOG + INFO are batched on a 5-second timer
  or up to 100 entries. POSTs NDJSON to `/api/logs` with
  `keepalive: true` so the last batch survives a tab close.
  Three consecutive failures → "dead" state, stops queueing
  silently (avoids unbounded growth on a server that's gone).
- `src/util/debugLog.ts` — `setLogShipper(fn)` setter; `push()`
  calls the shipper as a side effect of every entry.
- `src/main.tsx` — `installLogShipper()` after
  `installDebugLog()`.

**Decisions.**
- **HTTP, not WebSocket, for shipping.** Multiplexing onto the
  OSC WS would force a frame discriminator and break its `bytes
  ↔ datagram` simplicity. HTTP gives ack + retry for free,
  works even when the WS is dead (necessary for logging
  WS-close events themselves), and reuses axum's existing
  routing.
- **No IndexedDB persistence layer (yet).** Plan called for
  IndexedDB mirroring of the in-memory ring across reloads;
  scope-trimmed because (a) the shipper covers the persistence
  story server-side, which is the primary "find what happened"
  use case, and (b) the in-memory ring + Download button (which
  already existed) covers the "send me the log" flow. Worth
  revisiting if a deployment really needs F5-survivable browser
  history.
- **`target = "frontend"` field, not a separate file.** Frontend
  events get the same daily-rotated file as bridge events; the
  tracing event's `target` field disambiguates at grep / `jq`
  time. Single-file is simpler to operate (one log per session
  for the user to attach to a bug report) and the volume from
  the frontend is low (errors + warns mostly).
- **No structured per-session spans yet.** Plan mentioned
  Phase 22's session state as a "natural span carrier";
  deferred. Would require holding a `tracing::Span` in
  `SessionState` and `.in_scope`-ing the recv task. Useful if
  we ever want per-clientId log filtering, but for now the
  flat events with `client_id` as a structured field are
  enough.
- **Bound `WorkerGuard` to the call stack of `run_server_blocking`
  / `run_gui`.** Both functions block until process exit, so a
  `let _guard = …;` keeps the appender's flush thread alive
  through the entire program. Returning the guard out of
  `init_tracing` (vs. swallowing it) preserves operator control
  if a future entry point needs different semantics.

**Gotchas.**
- **Don't `console.*` from inside `logShipper`.** The
  monkey-patched console pushes into `debugLog`, which calls the
  shipper, which would recurse. The shipper drops on fetch
  failure silently — no logging from itself. If you debug it,
  use `debugger` breakpoints or temporary `originalConsole.error`
  via the saved reference in `debugLog.ts`.
- **`tracing::error!` / `warn!` macros need `target:` as a literal
  identifier, not a string variable.** `target: entry.target` in
  the call site won't compile — the value must be a string
  literal. We work around this in `log_ingest.rs::emit_tracing`
  by branching on the level inline rather than passing it.
- **`DefaultBodyLimit::max(N)` is per-route via `.layer(...)`.**
  Applied at the route registration site (`mod.rs`), not on the
  router globally — global limits would also cap WS upgrade body
  parsing, which can be larger.
- **`keepalive: true` on `fetch` has a 64 KB body cap on most
  browsers.** If a logShipper batch ever exceeds that during
  pagehide, the request will be rejected. Our 100-entry batches
  at ~200 bytes each = ~20 KB are comfortably under. Document
  for any future change to `MAX_BATCH`.
- **Dropping the WorkerGuard mid-program loses buffered entries.**
  The non-blocking writer batches IO on a background thread; the
  guard owns that thread. Keep it alive as long as anything
  might log. If a future refactor moves init_tracing into a
  function that returns early, the guard returns with it —
  callers must not let it drop.

---

## Phase 25 — Bundle & Dev Workflow Refresh

**Goal.** Clean up the deployment + dev story that had accreted
across Phases 0–24. Three pain points: (a) Phase 23's frontend
`logShipper` + `/api/logs` ingest was over-engineered for a tool
where operators care about server-side health and devs use
DevTools; (b) `tauri.conf.json` shipped `dist/` twice (once as
embedded `frontendDist` for `tauri://`, once as filesystem
`bundle.resources` after we collapsed the webview to HTTP); (c)
the `serve` mode required either a `--dist` flag or a built bundle
in dev, and the frontend's `VITE_OSC_WS_URL` env var papered over
the cross-origin gap between Vite and the bridge. End state: one
bundle path for assets, one origin for every web request, and a
binary that runs cleanly on a headless Pi without `xvfb`.

**What shipped.**

*Drop the frontend log shipper.*
- Deleted `src/util/logShipper.ts` and `src-tauri/src/server/log_ingest.rs`.
- Removed `setLogShipper` hook + `ShipperFn` from `debugLog.ts`;
  removed `installLogShipper()` call from `main.tsx`.
- Removed `/api/logs` route + `DefaultBodyLimit` middleware from
  `server::serve`. Kept `init_tracing` (daily-rotated file +
  stderr) intact — the bridge still logs to file, the frontend
  still surfaces in the in-memory `debugLog` ring + Download
  button.

*Modularise the server.*
- New `src-tauri/src/server/session.rs` (`Session` type) — owns
  the `clientId` snoop, parent-group fallback, Phase 22 cleanup
  bundle. `ws_bridge.rs` calls `session.snoop(payload).await` on
  every inbound datagram and `session.cleanup(&sock).await` on WS
  close, otherwise stays byte-level.
- New `src-tauri/src/server/static_assets.rs` — the SPA fallback
  + path-traversal guard + MIME map, lifted out of `mod.rs`.
- New `src-tauri/src/server/logging.rs` — `init_tracing`,
  re-exported as `server::init_tracing` for the two `cli.rs`
  callers.
- `mod.rs` collapsed to ~85 lines: module decls, `bind`,
  `serve_on`, `run_bridge`, `ws_handler`. The router setup is the
  centerpiece.

*Collapse the asset pipeline to one source.*
- Dropped `frontendDist` from `tauri.conf.json`. Added
  `bundle.resources: ["../dist"]`. Tauri's `tauri://` protocol is
  unused; the webview loads from the local axum like a regular
  browser.
- `tauri.conf.json -> app.windows[]` is empty; the main window is
  created programmatically in `cli.rs::run_gui::setup` so we can
  bind the listener first and navigate the webview at the actual
  port.
- `capabilities/default.json` adds `remote.urls: ["http://127.0.0.1:*", "http://localhost:*"]`
  so Tauri IPC (fs / dialog / opener) survives the move off
  `tauri://`.
- Webview URL is gated by `cfg!(debug_assertions)`:
  `WebviewUrl::default()` (resolves to `devUrl` in dev) vs.
  `WebviewUrl::External(http://127.0.0.1:<port>/)` in release.

*Decouple the bridge from `tauri::Builder`.*
- The `bridge` subcommand (renamed from `serve`) runs plain
  tokio + axum — no `tauri::Builder::run()`, no `gtk::init()` on
  Linux. Ships as a single binary that runs cleanly under
  systemd on a headless Pi.
- `dist/` resolution shared via the `DIST_SUBPATH` constant
  (`"_up_/dist"`):
  - GUI path: `app.path().resource_dir()?.join(DIST_SUBPATH)`
    (Tauri-runtime API).
  - Bridge path: `tauri::utils::platform::resource_dir(&pkg_info, &env)?.join(DIST_SUBPATH)`
    (library form, no AppHandle needed).
- `--dist` is now `Option<PathBuf>` and falls back to the bundled
  resource dir; if neither resolves, `serve_on` registers a
  `not_static_fallback` returning 404 for everything except
  `/ws`. The bridge runs cleanly with no static dir at all.

*Path env vars retired.*
- Both `SC_DIST_DIR` and `SC_LOG_DIR` env-var bindings dropped from
  `cli.rs`. Path config is now flag-only on the bridge subcommand
  and Tauri-default in GUI mode:
  - GUI log dir: `app.path().app_log_dir()` —
    `~/Library/Logs/<bundle-id>/` on macOS, `$XDG_DATA_HOME/<bundle-id>/logs/`
    on Linux, `%LOCALAPPDATA%\<bundle-id>\logs\` on Windows. No
    config; logs just appear in the platform-standard place.
  - Bridge log dir: stderr-only by default; `--log-dir` opts in to
    file logging. Headless deploys typically pin the path from a
    systemd unit anyway, so the env-var indirection added nothing.
- To wire `app_log_dir()` into the GUI path, `init_tracing` moves
  inside `Builder::setup()` and the returned `WorkerGuard` is held
  by Tauri's managed-state via `app.manage(TracingGuard(..))`.
  Pre-setup tracing events go to the default no-op subscriber and
  are lost; in practice this only affects a handful of Tauri
  startup messages.

*Final Rust layout pass.*
- Top-level files split by process-mode-of-being:
  - `cli.rs` (~95 LoC) — clap parsing + dispatch only.
  - `gui.rs` (~95 LoC) — Tauri Builder, `setup` block, `TracingGuard` newtype.
  - `bridge.rs` (~50 LoC) — `run_blocking` for the headless subcommand.
- `init_tracing` lifted out of `server/` into top-level `logging.rs`
  (it was never a server concern; the `pub use logging::init_tracing`
  re-export from `server/mod.rs` was the smell that gave it away).
- `DIST_SUBPATH` constant + `resolve_bundled_dist()` helper moved
  into `server/static_assets.rs` — same module that owns the
  serving side. Both `gui.rs` (with `AppHandle::path()`) and
  `bridge.rs` (via `resolve_bundled_dist`) reach in for the same
  layout knowledge.
- Each file is now under 200 LoC with a single clear concern. The
  `server/` submodule shrank from 5 files to 4 (logging gone).

*Same-origin WS via Vite proxy.*
- `vite.config.ts -> server.proxy['/ws']` forwards the WS
  upgrade to `http://127.0.0.1:3000` (override via
  `SC_BRIDGE_URL`). `wsUrlFor` in `AppShell.tsx` now builds from
  `window.location.origin` only — `VITE_OSC_WS_URL` and
  `.env.development` are gone.

*Dev workflow.*
- `yarn serve` → `yarn bridge` (cargo run -- bridge, no `--dist`).
- New `yarn dev:full` runs Vite + bridge concurrently via
  `concurrently` (added as a dev dep).
- `yarn tauri dev` is unchanged in behaviour but cleaner under
  the hood — webview hits Vite (`devUrl`), Vite proxies `/ws` to
  the bridge that the GUI mode itself spawns.

**Decisions.**
- **Tauri resources, not `rust-embed`.** `rust-embed` would have
  given a single self-contained binary but locked us into
  rebuilding the Rust binary every time the frontend changed. Tauri
  resources keeps the `tauri build` artifact as the deployment unit
  — one source for the assets, both webview and external browsers
  read the same files.
- **Library `resource_dir`, not a shared Builder.** The
  alternative was running `tauri::Builder::run()` for the bridge
  too and reusing `AppHandle::path().resource_dir()`. That would
  drag GTK init into headless deployments (`xvfb-run` wart on the
  Pi). Calling
  `tauri::utils::platform::resource_dir(&pkg_info, &env)`
  directly gives the same path-resolution logic as a library
  function with no runtime overhead, and Tauri 2 exposes it as
  public API.
- **Webview at `http://localhost:port`, not `tauri://`.** Removes
  the `frontendDist` / `bundle.resources` duplication
  (~few MB in the bundle) and means there's exactly one
  asset-serving code path to reason about. The cost is a CSP /
  capability tweak (`remote.urls`) and a small bind-then-create
  dance in `setup`. Worth it.
- **Rename `serve` → `bridge`.** The subcommand can run with no
  static fallback at all, so "serve" became misleading. "Bridge"
  reflects the primary purpose (WS↔UDP); static serving is now an
  optional layer on top. Yarn script renamed to match.
- **`yarn dev:full` over a unified `yarn dev`.** A single
  `yarn dev` that always spawned the bridge would make
  frontend-only iteration (no scsynth running) noisier — the
  bridge logs would clutter the terminal, port 3000 would refuse
  to bind on a second invocation, etc. Keeping `yarn dev` as
  Vite-only and `yarn dev:full` as the explicit "I want both"
  preserves the simpler loop.

**Gotchas.**
- **`tauri::generate_context!()` accepts a missing `frontendDist`
  silently.** The macro reads `tauri.conf.json` at compile time
  and is fine without `frontendDist`; we verified by `cargo build`
  + `tauri build`. If a future Tauri version regresses on this,
  the fix is to point `frontendDist` at an empty placeholder
  directory rather than re-add the duplication.
- **`debug_assertions` ≠ "running under `tauri dev`".** Release
  builds intentionally use `WebviewUrl::External(http://...)`;
  debug builds use `WebviewUrl::default()`. If anyone ever does a
  release-mode `cargo run` for profiling, they'll need a built
  bundle around the binary — same as the bridge subcommand. The
  dev loop is `yarn tauri dev` (debug) or `yarn dev:full`
  (browser-only debug); release builds go through `tauri build`.
- **`WebviewWindowBuilder::new` runs synchronously inside
  `.setup()`** but the webview's actual page load is async. By
  binding the listener via `tauri::async_runtime::block_on`
  *before* creating the window, we guarantee the URL responds the
  moment the webview navigates — no ECONNREFUSED race.
- **Capability `remote.urls` is required for IPC over `http://`
  origins**, not just for navigation. Tauri 2's default capability
  scope is "local" (tauri:// only); without `remote.urls` the fs
  / dialog / opener plugins reject calls from a webview loaded
  over HTTP with a generic permission error. Easy to debug if you
  remember the cause.
- **Vite's WS proxy needs `ws: true` explicitly.** Without it the
  `/ws` path forwards HTTP upgrade requests as plain HTTP and the
  WebSocket handshake never completes. The error surfaces as a
  silent connection close on the frontend, no helpful stderr.
- **`cargo run -- bridge` without `--dist` and outside a bundle**
  is *not* an error — the bridge runs `/ws`-only and logs the
  reason ("no bundled dist/ found"). The dev loop relies on this:
  `yarn dev:full` invokes `yarn bridge` and lets Vite serve the
  UI. The 404-with-help fallback (`no_static_fallback` in
  `server/mod.rs`) catches accidental hits to the bridge's HTTP
  root in dev.
- **Tauri resources re-base the leading `..`.** `bundle.resources: ["../dist"]`
  copies into `<resource_dir>/_up_/dist/`, not
  `<resource_dir>/dist/`. The `DIST_SUBPATH` constant in
  `cli.rs` captures this; if a future `bundle.resources` entry
  uses a different parent path, the resolver needs adjusting.

---

## Phase 26 — SuperDirt via Bridge-Internal OSC Router

**Goal.** Bring SuperDirt back online without a second WebSocket.
The frontend keeps exactly one `WorkerClient` / one `/ws`;
everything OSC — scsynth control, buffer reads, `/dirt/play`,
`/dirt/hello` — flows through it. Inside the bridge, a
config-driven prefix-match table demuxes each outbound packet to
the appropriate UDP target. The launch story collapses to two
supervised processes (scsynth + sclang+SuperDirt); the bridge
handles routing internally. Architecture **D-generic** chosen
over **A** (separate `sc-app proxy` subcommand) and **C**
(sclang as OSC front) — same extensibility as A without the
extra process; better hot-path latency than C.

### What shipped

*26a — Bridge router (commit 8a5d1e6).*
- `src-tauri/src/server/routing.rs` (NEW). `RoutingTable` (build,
  clone, set_default for `?scsynth=` per-WS override,
  unique_targets for socket binding). `peek_osc_address` walks
  `#bundle` envelopes to the first inner message. 6 unit tests
  cover prefix matching, bundle peek, deduplication.
- `src-tauri/src/config.rs` — adds `routes: Vec<Route>` field
  with `Route { prefix, target }`. `target` is `host:port`,
  resolved via `tokio::net::lookup_host` at boot.
- `src-tauri/src/server/mod.rs` — `AppState.routes:
  Arc<RoutingTable>`. `serve_on` / `run_bridge` signatures take
  `RoutingTable` instead of single `SocketAddr`. `ws_handler`
  clones the global table per-WS, applies `?scsynth=` to default
  only.
- `src-tauri/src/server/ws_bridge.rs` — per-WS opens N UDP
  sockets (one per unique target). N recv tasks fan replies into
  a shared `tokio::sync::Mutex<SplitSink>`. Phase 22 snoop +
  cleanup runs on the *default route's* socket only — non-default
  targets are pure forwarders. Recv-task abort happens BEFORE
  cleanup so `/fail` replies don't hit a closed WS sink.
- `src-tauri/src/cli/{bridge,gui}.rs` — both build a
  `RoutingTable` from config inside async context. Resolution
  failure is fatal in the bridge; returns a Tauri-friendly error
  in the GUI.

*Project-local config.json (commit 0e8ab0d).*
- Tracked `config.json` at repo root with port / scsynth /
  log_dir / routes for the dev workflow.
- `cli/mod.rs::resolve_bridge_config` adds `./config.json` to
  the auto-discovery list (between explicit `--config` and the
  system-wide `/etc/sc-app/config.json` fallback).
- `DEFAULT_PORT` and `DEFAULT_SCSYNTH` consolidated as `pub
  const` in `config.rs` (were duplicated in `cli/mod.rs` and
  `cli/gui.rs`).
- New `starter()` function returns `&'static Config` via
  `OnceLock` — replaces hand-written JSON literal in
  `Config::write_default_if_missing`. Serialised through serde
  so any future field additions land on disk automatically.
- Config fields gain `skip_serializing_if` so unset Options /
  empty Vecs don't appear as `null` / `[]` in starter JSON.

*26b — SuperDirt foundations (commit 2bb3e92).*
- `superdirt/` git submodule (codeberg.org/musikinformatik/SuperDirt).
- `scripts/setup-superdirt-deps.sh` (one-time fetch of
  Dirt-Samples + Vowel + sc3-plugins on macOS; Linux uses apt).
- `scripts/sc-app-superdirt-startup.scd` — sclang init that
  attaches to externally-running scsynth, mirrors scsynth's
  options into sclang allocator config, mounts SuperDirt on
  UDP 57120.
- `scripts/start-osc.sh` (NEW) — unified supervisor for
  scsynth + sclang+SuperDirt with trap-based cleanup and
  pre-flight port checks. The dev convenience.
- Renames per Q3: `start-scsynth.sh` → `start-scsynth-only.sh`,
  `start-superdirt.sh` → `start-superdirt-only.sh` (debug
  variants).
- `scripts/sc-app-scsynth.service` — Pi systemd template,
  flag-aligned with the dev script.
- `scripts/cleanup.sh` — wipe superdirt-deps/ + dist/ + target/.
- yarn scripts: `osc`, `scsynth-only`, `superdirt-only`,
  `superdirt-setup`, `cleanup`.
- `config.json` adds the `/dirt → 127.0.0.1:57120` route.

*26c — SuperDirt frontend rewire (commit 02c38db).*
- `src/dirt/dirtCommands.ts` (typed builders for `/dirt/play`,
  `/dirt/hello`, `/dirt/handshake`, `/dirt/setControlBus` +
  reply addresses), `replParser.ts` (Tidal-ish shorthand parser),
  `types.ts` brought from the `superdirt` branch.
- `DirtStatus` shrunk to three-state (`'probing' | 'alive' |
  'unreachable'`) per Q1.
- `DirtParseError` migrated from deleted `parseHostPort.ts` into
  `types.ts`.
- `src/dirt/DirtClient.ts` (REWRITE). Constructor takes a
  `WorkerClient`; subscribes to `/dirt/*` via
  `client.onReply` filtered by prefix; sends via
  `client.sendCommand`. `probe()` runs the hello round-trip
  once at mount (Q2 = i). `dispose()` unsubscribes. No socket
  to close because we don't own one.
- `src/ui/DirtPanel/*` (REWRITE) — connection-string input +
  Connect / Disconnect buttons gone. REPL + status pill +
  bounded event-log ring, all rendered unconditionally.
- `src/AppShell.tsx` — `DashboardResources.dirtClient`,
  fire-and-forget probe in `setupDashboard`, dispose in
  `teardownServerState`. `<DirtPanel />` slots after
  `<RecordingPanel />`.
- Deletes: `src-tauri/src/server/ws_dirt.rs` (and `/ws/dirt`
  route), `src/dirt/parseHostPort.ts`.

*Per-clientId IdAllocator scoping (commit 66893c9).*
- `DashboardResources.clientId: number` added.
- `setupDashboard` derives
  `idBase = clientId * 1_000_000 + 1000` for node + buffer
  allocators; bus allocator stays at 32. Without this, sc-app's
  clock `/s_new` at id 1000 collides with sclang's SuperDirt
  synths (also 1000+) — scsynth rejects the second `/s_new` with
  `FAILURE IN SERVER /s_new duplicate node ID`, the clock never
  starts, the timer hangs.
- 1M IDs per client is generous: scsynth's `-n 32768` caps
  concurrent nodes well below that. clientId=0 keeps the
  pre-Phase-26 base (1000) so single-client deployments are
  byte-identical.

*ServerErrorBus early construction + log noise (commit 1bcbbe4).*
- `errorBus = new ServerErrorBus(client)` moves to the TOP of
  `setupDashboard`, before `clock.start()`. Otherwise a `/fail`
  reply for the clock's `/s_new` (the very thing that breaks
  when IDs collide) arrives before the bus subscribes, and the
  error gets silently dropped — no UI signal of the failure.
- Removed per-packet `console.log` spam: `[sc:client] reply
  <addr>` (every OSC reply, including 3 Hz status heartbeats
  and 48 Hz buffer chunks) and `[sc:worker] main → worker
  <type>` (every send). Branch-specific logs (connect,
  disconnect, errors) stay.
- New diagnostic: `[sc:app] setupDashboard clientId=N
  parentGroupId=N00 idBase=...` so the per-client scoping is
  visible at each connect.

*OscConsole revival (commit e0dffd2).*
- `src/ui/OscConsole/*` files were intact since Phase 13's
  cleanup; rendering them in the dashboard makes them work
  again. Quick-action buttons: Status, DumpOSC on/off,
  QueryTree(0), sendAndAwaitReply Status. The `QueryTree(0)`
  button was load-bearing for resolving the bus-0 silence
  question (see AddToTail fix below) — without it we'd have
  needed an out-of-band sclang session to dump the node tree.

*AddToTail fix (commit 4beb518).*
- `GroupController` constructor's `addAction` parameter changes
  default from `AddToHead` to `AddToTail`. Pre-Phase-26 it
  didn't matter (sc-app was the only client at the root). With
  sclang+SuperDirt at clientID=0, the user's parent group at
  clientID=2 ended up at the *head* of the root, processing
  BEFORE sclang's defaultGroup. sc-app's tap synth therefore
  read its input bus before SuperDirt's orbits had written
  anything in the current control block — captured silence.
- Speakers worked because `dirtMonitor` (inside group 1, after
  orbits) DID see the writes; only sc-app's tap (in group 200)
  didn't. The /g_queryTree dump from OscConsole made this
  visible: `root → [group 200 (sc-app, FIRST), 7 empty default
  groups, group 1 (sclang+SuperDirt), group 2]`. AddToTail puts
  sc-app's group at the END instead.
- This fix solved the bus-0 recording problem. The earlier
  workaround (route SuperDirt to private bus 16 + dirtMonitor
  mirror to 0/1) was reverted in commit ac5be27 because direct
  bus 0 tapping now works.

*Final test/UX touches.*
- `cargo test --lib` suite now 8 tests (6 routing + 2 config),
  all green.
- DebugLog header gains `⚠ N` badge visible while the panel is
  collapsed (was Phase 24's design; reaffirmed during this
  session).

### Decisions

- **D-generic over A and C.** Same single-WS goal as A (separate
  proxy subcommand) but ~⅔ the LoC and zero new processes. C
  (sclang as the OSC front) was rejected on hot-path latency:
  sclang's single-threaded interpreter would contend with
  SuperDirt pattern parsing for the same loop, producing bursty
  jitter on the `/b_setn` reply path. The full A-vs-C-vs-D
  comparison table sat in `plan.md` while Phase 26 was in
  flight; it has now been moved here for posterity.
- **Config-driven route table over hardcoded `dirt:
  Option<SocketAddr>`.** Adding a future target (metronome, MIDI
  bridge, analyzer) is a config entry, not a code edit. The
  routing module lifts cleanly into a `proxy` subcommand if
  external observability ever becomes load-bearing.
- **AddToTail of root for parent group.** Necessary when
  sharing scsynth with sclang at clientID=0. Pre-Phase-26
  AddToHead was harmless because sc-app was the only client.
  Single-client deployments stay byte-identical (AddToTail of
  empty root puts the group at index 0 either way).
- **1M IDs per client (sc-app side), not scsynth's per-client
  range API.** scsynth divides 2^31 by `numClientIDs` for its
  per-client default group ranges, but doesn't enforce ID
  scoping for `/s_new`. Manually picking 1M-per-client on the
  frontend is simpler than negotiating maxLogins through the
  notify reply, and 1M is well above any realistic synth count.
- **ServerErrorBus from the start of setupDashboard.** The race
  between "first /s_new fires" and "bus subscribes" is small in
  wall time but exactly the wrong window to miss — the clock
  /s_new is the canary for ID-collision scenarios.
- **OscConsole revived rather than queried-out-of-band.** `/g_queryTree`
  in the dashboard saved a debug session; cheap to keep around
  for future "what's actually in the tree?" moments.
- **bus 0/1 IS tappable after AddToTail.** Future Improvement #9
  (InFeedback.ar variant) was scoped against a "hardware-bus
  read semantics" theory that turned out to be a tree-ordering
  symptom in disguise. FI #9 dropped from `plan.md` after the
  fix landed.

### Gotchas worth carrying forward

- **Parent group `AddToTail` is load-bearing when sharing
  scsynth with other clients.** The default in `GroupController`
  matters; the comment at the constructor explains why. If a
  future feature lets multiple sc-app instances connect to one
  scsynth (Future Improvement: multi-tenancy), each instance's
  group still adds at the tail of root and per-client ID scoping
  keeps them out of each other's way.
- **Per-client ID scoping = 1M IDs per clientID.** sc-app's
  IdAllocator(idBase) is `clientId * 1_000_000 + 1000`. If a
  third client ever appears (say, two browsers connect to one
  bridge), they'll be at 1M, 2M, … with no overlap. Don't shrink
  the multiplier without also shrinking SuperDirt's expected
  load.
- **ServerErrorBus must be wired BEFORE the first /s_new.** Any
  future `setupDashboard` reorganisation should keep
  `new ServerErrorBus(client)` at the top, before `clock.start()`
  / synth manager construction / etc. The race is invisible
  when nothing fails (most sessions); but exactly the sessions
  with /fails to surface are the ones we miss.
- **Frontend filters /dirt/* in the worker by NOT filtering it.**
  `oscWorker.ts` only intercepts `/tr` (clock), `/b_setn` (buffer
  chunk), `/fail`. Everything else — including `/dirt/hello/reply`
  — falls through to the generic `onReply` channel that DirtClient
  subscribes to. If a future feature wants to add per-prefix
  worker-side handling, `/dirt/*` follows the same "leave it
  alone" rule unless there's a perf reason.
- **SuperDirt orbit master fx live in defaultGroup (group 1),
  not in their own root-level group.** `dirt_monitor2`,
  `dirt_rms2`, `dirt_leslie2`, `dirt_reverb2`, `dirt_delay2` —
  five synths per orbit, 12 orbits = 60 master fx synths inside
  `defaultGroup`'s child container (`group 4` in the user's
  observed tree). sc-app's tap on bus 0 reads after all of them
  because group 200 (sc-app) sits AFTER group 1 in the root with
  AddToTail.
- **`/g_queryTree.reply` arg encoding is depth-first flattened.**
  Format: `[withControls=0, queriedGroupID, numChildren,
  nodeID, numChildren_or_-1, [synthName_if_synth, recurse_if_group]]`.
  When debugging tree issues, the OscConsole panel's
  `QueryTree(0)` button gives you this directly. Parse mentally
  by tracking the numChildren value of each group.

---

## Phase 27 — Step Sequencer for SuperDirt

**Goal.** Add a step-sequencer panel that drives the existing
`DirtClient`. Users build patterns by toggling cells in a grid;
transport plays the pattern at a configured BPM, sending
`/dirt/play` events at step boundaries. Anchored to
`ClockController.tick0Ms` + `tickRate` so playback stays
sample-accurate against the audio engine's clock; the JS scheduler
just keeps OSC bundles on the wire ahead of fire time. Shipped
across four sub-phases: 27a (MVP grid), 27b (per-step parameters),
27c (8-slot pattern bank + localStorage), 27d (chain mode).

### What shipped

*27a — MVP step sequencer (commit 1b0a226).*
- `src/sequencer/types.ts` (NEW). `Track`, `Pattern`,
  `TransportState`, `PatternLength` (8|16|32), `ClockLike`,
  `DirtClientLike`, helpers (`makeEmptyTrack`,
  `makeEmptyPattern`).
- `src/sequencer/scheduler.ts` (NEW). `pump()` walks from
  `state.nextStepTick` to `nowTick + LOOKAHEAD_HORIZON_TICKS` (5
  ticks ≈ 106 ms at chunkSize 1024 / 48 k), firing
  `dirtClient.playAtTimetag()` for each active step on each
  track. `tickToTimetag(tick0Ms, targetTick, tickRate)` produces
  the OSC bundle's timetag so SuperDirt schedules the event at a
  sample-accurate audio frame. Playhead callback fires from a
  delayed `setTimeout` aligned to the audible step boundary, so
  the UI matches the kick rather than the lookahead horizon.
- `src/sequencer/SequencerController.ts` (NEW). Pattern + transport
  reactive stores; mutation API (`addTrack`, `removeTrack`,
  `setTrackSample`, `setTrackGain`, `toggleStep`, `setBpm`,
  `setLength`); `play()` / `stop()` / `dispose()`. 25 ms wake
  loop via `setInterval`. Refuses `play()` when `clock.tick0Ms`
  is null.
- `src/dirt/DirtClient.ts` (EDIT). New `playAtTimetag(event,
  timetag)` for sample-accurate scheduling. New
  `listSamples(timeoutMs)` + `sampleBanks` reactive store backed
  by `/dirt/samples` reply (interleaved `[name, count, …]` args
  parsed by a `parseSampleBanks` helper).
- `src/dirt/dirtCommands.ts` (EDIT). `dirtListSamples()` builder
  + `DIRT_SAMPLES_REPLY` constant.
- `src/dirt/types.ts` (EDIT). `SampleBank` interface.
- `src/ui/SequencerPanel/{SequencerPanel,TransportBar,TrackRow,
  StepCell}.tsx` + `.scss` + `index.ts` (NEW). Top-level panel
  composes the others; `useSyncExternalStore` for pattern +
  transport + sampleBanks; `useId`-backed shared `<datalist>`
  used by every `TrackRow` for sample-name autocomplete.
- `scripts/sc-app-superdirt-startup.scd` (EDIT). Added a
  `/dirt/listSamples` OSCdef (registered after `~dirt.start`)
  that flattens `~dirt.buffers` (a `Symbol → Array<BufferProxy>`
  dict) into a `/dirt/samples bank1 count1 bank2 count2 …` reply.
  `addr.sendMsg(...)` replies on the same socket the request
  came in on; the bridge fans the reply back onto the originating
  WebSocket.
- `src/AppShell.tsx` (EDIT). Added `sequencer: SequencerController`
  to `DashboardResources`. Bank-less `setupDashboard` here:
  threaded an `initialPattern?: Pattern` parameter through so the
  user's tracks/steps survived chunkSize re-init; `runReinit`
  captured the current pattern before teardown and passed it in.
  After `dirtClient.probe()` resolves alive, fire-and-forget
  `dirtClient.listSamples()`. `clockReady` derived from
  `clock.effectiveState === 'running'`.
- ClockController exposes `tickRate` under `derived`, while the
  sequencer's `ClockLike` interface is flat for testability —
  AppShell passes a small adapter object.

*27b — Per-step + per-track parameters (commit b90f0d6).*
- `src/sequencer/types.ts` (EDIT). Migrated `Track.steps` from
  `boolean[]` to `Step[]` where `Step = { active; params? }`.
  Added `PARAM_NAMES = ['amp', 'cutoff', 'speed', 'pan']`,
  `ParamMap = Partial<Record<ParamName, number>>`,
  `PARAM_SPECS` (label + min/max/step/default for each param),
  `stepHasOverrides`, `resolveParam(track, step, name)`. `Track`
  gains `defaults: ParamMap` for track-level fall-throughs.
- `src/sequencer/SequencerController.ts` (EDIT). New mutations
  `setStepParam` / `clearStepParam` / `clearAllStepParams` /
  `setTrackDefault` / `clearTrackDefault`. The cell's `params`
  object is dropped entirely when the last override clears (a
  `paramsObjectToStep` helper enforces this), so
  `stepHasOverrides` stays cheap.
- `src/sequencer/scheduler.ts` (EDIT). `eventForTrack(track,
  step)` builds the OSC payload by iterating `PARAM_NAMES` and
  calling `resolveParam` — `step.params[k]` → `track.defaults[k]`
  → omit (let SuperDirt default).
- `src/ui/SequencerPanel/StepCell.tsx` (EDIT). Right-click
  `onContextMenu` and shift-click open the popover; corner
  override-dot (top-right) appears when `stepHasOverrides`.
- `src/ui/SequencerPanel/StepPopover.tsx` (NEW). Portal-rendered
  to `document.body`, viewport-clamped post-mount via
  `getBoundingClientRect` + flip-to-other-side fallback. Four
  sliders (one per param) + per-row clear (⊘) + header "reset"
  that wipes every override on the cell. Closes on Escape,
  outside `pointerdown` (capturing phase), scroll, or resize so
  a stale anchor never sits on screen.
- `src/ui/SequencerPanel/TrackDefaults.tsx` (NEW). Inline
  track-default editor; same four sliders + per-row clear.
- `src/ui/SequencerPanel/TrackRow.tsx` (EDIT). Added a chevron
  expander that toggles `TrackDefaults`; one popover slot per
  row (state co-located here so opening one cell's popover
  closes the previous); chevron lights up when the track has
  any default set.

*27c — Pattern bank + localStorage persistence (commit 0bf631a).*
- `src/sequencer/PatternBank.ts` (NEW). 8-slot reactive store:
  `_slots: Store<ReadonlyArray<Pattern>>`,
  `_activeIndex: Store<number>`, derived
  `_activePattern: Store<Pattern>` (kept in sync via internal
  subs). Mutations: `selectIndex`, `updateActivePattern(updater)`,
  `clearSlot`. Persistence: schema-versioned (V1) JSON in
  `localStorage['sc.sequencer.bank']`, debounced 500 ms via
  `setTimeout`; `flush()` runs synchronously on `dispose()` so a
  disconnect within the debounce window doesn't drop the
  in-flight write. Loads sanitise each pattern (pre-27b
  `boolean[]` steps coerce to `{active}`; malformed entries fall
  back to empty pattern).
- `src/sequencer/SequencerController.ts` (EDIT). Refactored from
  owning a private `_pattern` store to delegating reads/writes
  through `bank.activePattern` / `bank.updateActivePattern(...)`.
  All mutation methods are now thin wrappers. `pumpOnce` reads
  `bank.activePattern.get()` fresh, so switching slots mid-pump
  cuts to the new pattern's tracks at the next step.
- `src/ui/SequencerPanel/BankSelector.tsx` (NEW). Row of 8
  numbered buttons; active slot highlighted; filled slots get a
  small dot (the BankSelector reads `bank.slots` and counts
  `tracks.length > 0`).
- `src/ui/SequencerPanel/SequencerPanel.tsx` (EDIT). Now takes
  `bank` prop. Renders `BankSelector`. Document-level keydown
  listener maps 1..8 to `bank.selectIndex`, gated on editable
  focus (`INPUT`/`TEXTAREA`/`SELECT`/`contenteditable`) so the
  shortcut doesn't fight the BPM box.
- `src/AppShell.tsx` (EDIT). `bank: PatternBank` added to
  `DashboardResources`. Bank constructed fresh in
  `handleConnect` (loads from localStorage), reused across
  `chunkSize` re-init (long-lived — passed back into the
  rebuilt controller), disposed by `handleDisconnect` /
  `onError` / heartbeat-fail / reinit-fail (each path flushes
  a final save before drop). The `initialPattern?: Pattern`
  parameter from 27a was replaced with `bank: PatternBank`.

*27d — Pattern chain mode (commit pending).*
- `src/sequencer/types.ts` (EDIT). `ChainEntry`,
  `ChainState { enabled; loop; steps: ChainEntry[] }`,
  `makeEmptyChain()`. `ChainEntry.cycles` clamps 1..64.
- `src/sequencer/PatternBank.ts` (EDIT). New `_chain` store +
  mutations: `setChainEnabled`, `setChainLoop`,
  `appendChainEntry(slotIndex, cycles)`, `removeChainEntry`,
  `updateChainEntry(index, patch)`. Schema bumped V1 → V2;
  V1 saves still load (forward-migrated by attaching default
  empty chain). `sanitiseChain` coerces malformed entries.
- `src/sequencer/SequencerController.ts` (EDIT). New
  `chainPlayback: { currentEntryIndex; startedAtSchedulerStep }`
  internal state + reactive `chainPlaybackIndex: number | null`
  store for UI highlighting. `play()` engages chain mode if
  `bank.chain.enabled && steps.length > 0`, snapping
  `bank.activeIndex` to `chain[0].slotIndex`. `pumpOnce` calls
  `maybeAdvanceChain()` before each pump: when
  `(nextStepIndex - startedAtSchedulerStep) >=
  cycles × pattern.length`, advance to the next chain entry
  (loop to 0 if `chain.loop`, else `stop()` end-of-chain).
  Granularity = "next pump" — transitions can lag by up to
  LOOKAHEAD ticks (< 1 step at sane BPMs); acceptable.
- `src/ui/SequencerPanel/ChainEditor.tsx` (NEW). Compact
  horizontal strip: header carries Chain/Loop checkboxes + "+
  Step" button; entries are `[slot select × cycles input ⊘]`
  cells. Currently-playing entry highlighted via
  `controller.chainPlaybackIndex`.
- `src/ui/SequencerPanel/SequencerPanel.tsx` (EDIT). Renders
  `<ChainEditor />` between `<BankSelector />` and
  `<TransportBar />`.

### Decisions

- **Tick-anchored scheduling, not `performance.now()`** (Q
  during 27a design). The JS scheduler runs in real time, but
  bundle timetags use `tickToTimetag(tick0Ms, targetTick,
  tickRate)`, anchoring playback to the same audio clock as the
  scopes/recordings. Pattern: read pattern → compute target
  tick → derive timetag → bundle the `/dirt/play` →
  `client.sendCommand(bundle)`. The bridge forwards; SuperDirt
  scheduler honours the timetag at sample-accurate boundaries.
- **Sample enumeration via SuperDirt OSC**, not parsing
  `superdirt-deps/Dirt-Samples/`. The startup script's OSCdef
  reflects what SuperDirt actually loaded (some banks may fail
  to load; some may be added at runtime), and avoids embedding
  a directory walker in the frontend or asking the user to type
  paths. ~10 lines of sclang for a clean dynamic source.
- **Track-level + per-cell params (27b).** Two-tier resolution
  (cell → track → omit) means a track can have a pleasant
  default character (e.g., `cutoff: 600`) and individual cells
  can spike or drop without the user re-editing every cell.
- **Bank lives outside the controller (27c).** Started as
  on-the-controller in 27a's `_pattern`; refactored to
  external. Two wins: (1) bank persistence is decoupled from
  controller lifecycle, so chunkSize re-init (which rebuilds
  the controller) doesn't churn localStorage; (2) the bank's
  reactive surface (`slots`, `activeIndex`, `chain`) is shared
  by the panel UI and the controller, with a single source of
  truth.
- **Schema versioning, not migration code (27c/d).** V1 →
  V2 migration is a one-liner ("attach default empty chain").
  Future schema breaks have two paths: forward-migrate (write
  the migration in `loadFromStorage`) or drop saves (return
  `null`, user starts fresh). The version field gives us
  optionality without committing to N years of migration code
  upfront.
- **Mid-playback slot switching is seamless (27c/d).** The
  scheduler reads `bank.activePattern.get()` fresh on every
  pump; switching slots cuts to the new pattern at the next
  step. This is what makes chain mode work at all (chain
  transitions are just bank.selectIndex calls), AND what makes
  manual A/B'ing while playing feel right. Don't break this
  invariant.
- **Chain advances `bank.activeIndex` (27d).** Considered a
  separate "chain playhead" store but rejected — would mean
  two highlight concepts in the BankSelector (which slot are
  you editing? which is playing?). Single source of truth is
  cleaner. Manual click while chain is playing transiently
  overrides; next chain transition snaps back. Treated as
  feature, not bug.
- **Cycle granularity at "next pump" (27d).** A chain
  transition could in principle happen mid-pump (when the
  lookahead crosses the cycle boundary), but threading a
  boundary callback through `pump()` was complex for sub-step
  precision the user can't hear. Cap is < 1 step at sane BPMs.

### Gotchas worth carrying forward

- **`Track.steps` is `Step[]`, not `boolean[]`.** Pre-27b code
  read `track.steps[i]` as a boolean directly; post-27b, it's
  an object with `active` + optional `params`. Anything new
  that reads steps must use `step.active`.
- **Step `params` is dropped, not emptied.**
  `step.params === undefined` ⇔ no overrides. Don't write
  `step.params = {}`. The `paramsObjectToStep` helper in the
  controller enforces this on `clearStepParam`.
- **The bank is long-lived across chunkSize re-init.** Don't
  `dispose()` the bank in `teardownServerState` — that's the
  re-init path, and the bank survives. Disposal happens only at
  full-disconnect / WS-error / heartbeat-fail. If you add a new
  teardown path, decide explicitly: re-init (don't touch bank)
  vs. tear-down (dispose + flush).
- **Bank dispose() flushes synchronously.** A `handleDisconnect`
  immediately after a step toggle relies on this — the
  500 ms debounce is still in flight. If you ever switch the
  debounce mechanism (e.g., `requestIdleCallback`), keep the
  synchronous flush path intact.
- **Schema V1 saves are still accepted.** `loadFromStorage`
  accepts `version: 1 || version: 2`, attaches default chain
  on V1. Don't tighten the version check without a migration
  plan; users with bank data from 27c will hit it.
- **`/dirt/listSamples` is sc-app-specific, not stock SuperDirt.**
  The OSCdef lives in `scripts/sc-app-superdirt-startup.scd`. A
  vanilla SuperDirt instance won't reply, which is fine —
  `DirtClient.listSamples()` times out at 2 s and the panel's
  datalist stays empty (free-text input still works). If a
  future build wants stock-SuperDirt compatibility, this is
  where it'll need a fallback.
- **Keyboard 1..8 listener gates on editable focus.** Document-
  level `keydown` listener in `SequencerPanel`; checks
  `INPUT`/`TEXTAREA`/`SELECT`/`contenteditable` before acting,
  also rejects Ctrl/Meta/Alt modifiers. If you add another
  global shortcut, follow the same gate pattern — global
  hotkeys that fire while the user is typing are the worst.
- **Chain advancement reads `bank.activePattern.get().length`.**
  Different slots can have different lengths (8/16/32); the
  cycles-to-steps calculation (`cycles × length`) uses the
  current entry's pattern. If you add new slot lengths or a
  pattern-length-change-while-playing path, double-check
  `maybeAdvanceChain` still computes the right target.
- **ChainPlaybackIndex resets to null on stop.** UI consumers
  should treat `null` as "nothing playing" (stopped or chain
  mode off). The store fires on every transition during
  chain playback, so the highlighted entry tracks live —
  no UI-side debouncing needed.

---

## Phase 28 — Shared UI Foundation Package

**Goal.** Extract design tokens + base element styles + a small
set of semantic component classes from the React app into
`packages/ui-foundation/` (`@sc-app/ui-foundation`), a
framework-agnostic CSS-only package. Same stylesheet consumed by
the React host (today) and future runtime HTML plugins (light
DOM, inheriting via the global cascade) — plugins write plain
semantic HTML with `data-*` variants and pick up the host's
palette without bundling their own design system. Plain CSS, no
Sass, no Tailwind. Six sub-phases delivered the package + the
panel-by-panel migration; closes by deleting `src/styles.scss`
+ removing the `sass` devDep.

### What shipped

*28a — Scaffold + build pipeline (commit be38902).*
- `packages/ui-foundation/` workspace package. `package.json`
  exposes `.`, `./dist`, `./reset`, `./tokens`, `./themes/dark`,
  `./themes/light` exports.
- Open Props installed as the primitive token source
  (`open-props/open-props.min.css` — the package's `style`-key
  doesn't auto-resolve through `@import`, so the explicit path).
- PostCSS pipeline (`postcss-import` + `autoprefixer`) builds
  `dist/index.css`. `dist/` is gitignored; `yarn build` from
  the package dir regenerates.
- `src/index.css` with the @import cascade (tokens → theme →
  reset → base → components); each leaf shipped as a stub
  comment so the chain resolved cleanly.
- App-side wiring: workspace dep added to root `package.json`,
  Vite alias + `tsconfig.json` path, single
  `import '@sc-app/ui-foundation';` in `src/main.tsx` ordered
  BEFORE the legacy `styles.scss` so the dark theme could
  shadow the foundation during the gradual migration.

*28b — Tokens + reset + base elements (commit 9ce63f7).*
- `tokens/semantic.css` — non-colour vocabulary
  (theme-independent): `--space-3xs..2xl` (8 stops),
  `--radius-xs..pill` (5 stops), `--font-mono` / `--font-sans`,
  `--font-size-xs..xl`, `--line-height-{tight,normal}`,
  `--font-weight-*`, `--shadow-{sm,md,lg}` mapped to Open
  Props, `--layout-max-width`, `--transition-{fast,base}`.
- `themes/dark.css` — full `--color-*` palette ported from
  `src/styles.scss`. Promoted 9 hardcoded hexes that had
  escaped per-panel SCSS (OscConsole, DebugLog, ScopeView)
  into semantic tokens: `--color-tx`, `--color-rx`,
  `--color-log-{info,warn,error}`, `--color-overlay`.
- `themes/light.css` — placeholder; ships dark only.
- `reset.css` — minimal: box-sizing border-box + form elements
  inherit font/colour. html/body live in `base/elements.css`.
- `base/typography.css` — html font defaults, h1-h6, code/pre,
  links.
- `base/elements.css` — body, button (with
  `data-variant="secondary|ghost|danger"` + `data-size="sm"`),
  input/select/textarea/range, checkbox/radio with
  accent-color, number-input spinner suppression, label,
  details/summary.
- `demo.html` — self-contained validation page rendering every
  base element + variant against `./dist/index.css`. README
  documents this as the regression gate.

*28c — Reference component (commit deb9aa4).*
- ConnectScreen submit button refactored to plain
  `<button type="submit">…</button>` (no className), picking up
  styling from the foundation. Local button rule deleted from
  ConnectScreen.scss.
- Footer was named alongside ConnectScreen in the original plan
  but has no buttons (pure status display) — reference test
  runs through ConnectScreen alone.

*28d — Primitive component classes (commit dd2d696).*
- Filled `components/{panel,cluster,stack,status-pill,badge,
  range-field,empty-state,error-alert,modal}.css`.
- `.panel` + `.panel > header` (replaces global `.panel` chrome
  in `src/styles.scss`).
- `.cluster` + `.stack` flex layout primitives with
  `data-gap="sm|md|lg"`.
- `.status-pill[data-variant="ok|warn|error|info|muted"]`
  consolidates the per-panel `.pill` / `.status-pill` /
  `.state-pill` variants.
- `.badge[data-variant="ok|warn|error"]` for the
  dashboard-shell connection indicator.
- `.range-field` + `.range-field-value` for label + slider +
  monospace value layout.
- `.empty` / `.error` placeholders.
- `.modal-backdrop` + `.modal` + `.modal-{title,body,actions,
  progress}` with the `@keyframes modal-progress-slide`
  shipped in the same file.
- demo.html extended with sections for each primitive.

*28e — Per-panel migration (commits 5cc0766 → 34a122e, one
panel per commit, smallest-first).*
- 28e/1 Footer → tokens, drop dead `status` className.
- 28e/2 dashboard-shell header → `.cluster` + `.badge` +
  `<button data-variant="ghost">` Disconnect; the entire
  `.dashboard-shell > header` block deleted from
  `src/styles.scss`.
- 28e/3 ScopeList → `.cluster` toolbar, button data-variants;
  ~80 → 50 lines.
- 28e/4 ScopeView → zoom buttons become
  `data-variant="secondary" data-size="sm"`, overlay text
  uses `--color-overlay`, `rgba(21,23,27,0.8)` becomes
  `color-mix(in srgb, --color-surface-2 80%, transparent)`.
- 28e/5 ClockPanel → status pill becomes
  `<span className="status-pill" data-variant={…}>` (running
  → ok, paused → warn, stopped → muted); Reset button gets
  `data-variant="secondary"`; tick-flash dot uses
  `color-mix()` for the green halo.
- 28e/6 SynthsPanel → first production use of
  foundation .range-field; `<span className="range-value">`
  renamed to `range-field-value` to match the foundation's
  child contract.
- 28e/7 Modal → Modal.scss deleted entirely; foundation has
  identical class names. Cancel = `data-variant="secondary"`,
  Confirm = `data-variant={variant === 'danger' ? 'danger' :
  undefined}`.
- 28e/8 DebugLog → log-level colours flushed to
  `--color-log-{info,warn,error}`; rgba backdrop +
  errors-section bg use `color-mix()`.
- 28e/9 OscConsole → `--color-tx` / `--color-rx`; quick-action
  buttons become `data-variant="secondary" data-size="sm"`.
- 28e/10 RecordingPanel → StatePill maps state →
  `.status-pill[data-variant=…]` (recording=ok, preparing/
  finalizing=warn, done=info, error=error, idle=muted);
  `.window-selector` segmented button group kept local;
  live-button overlay uses `color-mix()` against
  `--color-primary`.
- 28e/11 DirtPanel → status-pill via `data-variant`;
  `dirt-pulse` keyframe renamed `dirt-panel-dot-pulse` and
  scoped to `.status-pill .dot.pulse`; class set when
  `status === 'probing'`.
- 28e/12 SequencerPanel (largest) → 672 → 370 lines, all
  bespoke layouts (.bank-slot, .step-cell, .chain-entry,
  .step-popover-clear, etc.) keep their local styling but
  consume foundation tokens. Hover rules add `:not(:disabled)`
  for specificity parity (class+:hover:not = (0,3,0) beats
  foundation `button:hover:not(:disabled)` = (0,2,1)).
  Stop/Play toggle becomes
  `<button data-variant={isPlaying ? 'danger' : undefined}>`.

*28f — Cleanup + parent close (this commit).*
- `src/styles.scss` deleted entirely.
- Two app-level layout rules (`.dashboard-shell`,
  `.chunk-size-picker`) moved to a new `src/app.css` —
  imported once at `src/main.tsx` after the foundation.
- `sass` removed from devDependencies; yarn lockfile
  regenerated.
- ConnectScreen.scss → ConnectScreen.css (the file 28c
  trimmed but didn't fully migrate; this commit finishes it).
- CLAUDE.md "Current phase progress" updated; arch diagram
  + "Workspace layout" + "Styling" convention bullet were
  added in earlier 28d-era doc commit (4166a39).
- This entry written; `plan.md` Phase 28 section trimmed to
  zero.

### Decisions

- **Open Props as the primitive source, not Tailwind.** A
  Tailwind config could mirror the same vocabulary, but
  Tailwind locks consumers into JS toolchain semantics
  (`@apply`, content scanning, etc.). The plugin scenario
  loads CSS at runtime — Open Props' pure-CSS variables
  cascade naturally into plugin HTML without a build step.
  Future plugin authors get the full primitive vocabulary
  (`--gray-N`, `--size-N`, etc.) for free even if they
  prefer to bypass our semantic layer.
- **Semantic tokens are the public API; primitives are not.**
  The README documents `--color-*` / `--space-*` /
  `--radius-*` etc. as stable contracts; Open Props is the
  current backing source but replaceable. Renaming a
  semantic token is a breaking change.
- **`data-*` for variants over class composition.** A
  plugin's HTML reads `<button data-variant="danger">` more
  naturally than `<button class="btn btn--danger">`. Easier
  for plugins not using a CSS-in-JS toolchain. Also matches
  modern web-component conventions.
- **Light DOM cascade, not shadow DOM.** Plugins are
  trusted; sandbox isn't a goal. The cascade reach is the
  whole point. Constraints that follow: avoid overly-specific
  selectors (`body .panel input` chains), prefer single-class
  selectors, document `data-*` contracts in the README.
- **One commit per panel migration in 28e.** A 12-panel
  big-bang would have produced one ungreppable diff. Per-panel
  commits make `git bisect` useful if a regression turns up
  in a specific panel; each commit's CSS delta is small enough
  to read end-to-end.
- **Bespoke buttons keep their local class instead of moving
  to data-variant.** Some panel buttons (.bank-slot,
  .step-cell, .step-popover-clear, .chain-entry-remove) are
  visually distinct enough that wrapping them in a foundation
  variant + N overrides would be more code than just keeping
  the local class. Local class + foundation tokens for colours
  was the right cut.
- **Specificity dance with `:not(:disabled)`.** Foundation's
  `button:hover:not(:disabled)` has specificity (0, 2, 1)
  which beats local `.foo:hover` at (0, 2, 0). Local rules
  add `:not(:disabled)` to bump to (0, 3, 0) and win. The
  alternative (lift specificity via `button.foo:hover` or
  attribute selectors) was uglier; the not-disabled
  qualifier is also semantically correct (the local hover
  shouldn't fire on disabled buttons anyway).

### Gotchas worth carrying forward

- **`open-props/open-props.min.css` is the right import
  path.** Open Props' `package.json` has a `style: "open-
  props.min.css"` field but `postcss-import` doesn't
  consult it — `@import "open-props/style"` fails. Always
  use the explicit `open-props/open-props.min.css`.
- **`color-mix(in srgb, var(--token) X%, transparent)` over
  rgba() literals.** Where the alpha needs to come from a
  themed colour, `color-mix()` keeps the source-of-truth
  in tokens. Lightning CSS in Vite handles it natively.
- **Foundation rules apply globally; per-panel CSS shadows.**
  A bare `<button>` anywhere in the app picks up the
  foundation's primary styling. Panels with bespoke button
  classes still need to override (or accept) — no
  surprise-reset by default. New panels should use foundation
  defaults + data-* attributes wherever possible.
- **`textarea` defaults to sans, every other input to mono.**
  Foundation's `base/elements.css` makes this choice. If a
  textarea needs mono (debug log entry, code editor),
  override locally. Most current uses are happy with the
  default.
- **`yarn build` in the package only matters for plugin
  runtime.** App dev / build go through Vite's @import
  resolution against `src/index.css`; `dist/index.css` is
  only needed when a future plugin loader reaches for a
  single bundled file. CI doesn't need to build the package
  unless we add a plugin runtime test.
- **Modal action buttons use `data-variant`, not local
  className overrides.** The previous Modal.scss had its
  own `.modal-actions button.primary` / `.danger` rules.
  Now ConfirmModal renders `<button data-variant="danger">`
  and the foundation handles it. If a future modal needs a
  visually-distinct button (e.g. a "destructive" stripe
  along the top of the card), prefer adding a
  `data-variant` to `.modal` itself rather than reaching
  back into per-button styling.
- **Sass is gone from devDependencies.** Don't reintroduce
  it for a single panel that "would be more readable with
  nesting". Modern CSS nesting (Lightning CSS in Vite)
  supports `&` natively if you really want it; otherwise
  flat selectors are fine and grep cleanly.

## Phase 29 — Bridge-Managed Sessions + Auto-Connect

**Goal.** Move the scsynth handshake (open UDP socket,
`/notify 1`, capture `clientId`, `/status`, capture
`sampleRate`) off the frontend and onto the Rust bridge,
materialised as a per-tab **Session** keyed by a
`sessionStorage`-persisted UUID. The frontend's first action
on boot becomes a `GET`/`POST /api/session/...` round-trip;
the response carries everything the dashboard needs
(`clientId`, `scsynth`, `sampleRate`, `parentGroupId`),
and the WebSocket attaches to the existing session via
`?session=<uuid>`. The ConnectScreen disappears entirely
in favour of an always-rendered dashboard with a
Connect/Disconnect toggle in the header.

The new wins:
- **Auto-connect on launch** — happy-path users never see
  a connect form again.
- **scsynth-side state survives a page reload (F5)** within
  the session's TTL — the bridge keeps the UDP socket and
  `/notify` subscription alive across WS reconnects, so the
  clock keeps ticking, in-flight recordings keep writing,
  the sequencer keeps emitting `/dirt/play`.
- **Multi-tab on the same browser** works for free —
  `sessionStorage` is per-tab, each tab mints its own
  Session, each Session opens its own UDP socket → its own
  scsynth `clientId` → its own per-clientId `IdAllocator`
  range (Phase 26's `clientId × 1_000_000 + 1000` already
  scopes IDs cleanly).

### What shipped

Four sub-phases, four commits, plus three small fixes
along the way.

*29a — Rust: Session module + HTTP endpoints, no WS cutover
(commit 70b83ee).*
- `src-tauri/src/server/session.rs` — `Session` owns one
  UDP socket per unique route target (default scsynth +
  every distinct `routes[i].target`), runs `/notify 1` →
  `/done /notify <cid>` and `/status` → `/status.reply`
  on the default-route socket at creation, captures
  `clientId` + `sampleRate`, derives `parentGroupId =
  clientId * 100` (with the `clientId == 0 ⇒ 100` fallback
  preserved from the pre-29 frontend). `SessionStore` is
  an `Arc<RwLock<HashMap<Uuid, Arc<Session>>>>` — async
  RwLock because we acquire `last_active` via async, but
  contention is light (HTTP handlers + once-a-minute TTL).
- `src-tauri/src/server/api.rs` — three handlers:
  `POST /api/session` (create), `GET /api/session/:id`
  (read-back, bumps `last_active`), `DELETE /api/session/:id`
  (run cleanup bundle + drop sockets). Errors render as
  `{ "error": "..." }` with appropriate HTTP statuses
  (503 for create-time scsynth-not-responding, 404 for
  missing/expired session).
- `mod.rs` got `AppState { routes, sessions }`,
  `WsQuery { session: Option<Uuid> }`, mounted the API
  routes. Old per-WS sockets stayed in place — 29a
  shipped the Session model in parallel with the legacy
  path so we could test via curl + integration tests
  before cutover.
- `Cargo.toml` — added `uuid = { version = "1", features =
  ["v4", "serde"] }`.

*29b — Rust: WS bridge cutover (commit 5306dfa).*
- `ws_bridge.rs` collapsed to one entry point —
  `handle_ws_session(ws, Arc<Session>)`. Per attached WS:
  subscribe to each `session.broadcast_senders[target]`
  channel, spawn a forwarder task per target that pushes
  bytes onto the WS sink. WS→UDP routes via
  `session.routes.route_for(addr)` →
  `session.target_sockets[target]`. Forwarder tasks are
  aborted on WS close (don't tear down the Session itself).
- `Session::create` spawns one recv-broadcast task per
  socket AFTER the handshake completes — otherwise the
  broadcast task would eat the handshake replies. Each
  task reads `sock.recv()` and `tx.send()`s onto the
  per-target `broadcast::Sender` (capacity 4096 — at the
  steady ~48 Hz tick rate, that's ~85 s of buffer, which
  is enough margin for any realistic WS-attach gap).
- `Session::cleanup` aborts the recv tasks BEFORE sending
  the teardown bundle so any `/fail` replies it provokes
  (e.g. `/n_free` against a stale node) don't get fanned
  out to attached WS connections.
- Per-WS UDP sockets are gone. Per-WS `/notify 1` /
  `WsCleanup` are gone. The pre-29 `ws_cleanup.rs` was
  deleted in 29d.

*29c — Frontend: bootstrap + skip per-WS handshake
(commit 043df8f).*
- `src/session/sessionBootstrap.ts` — `bootstrapSession()`
  reads `sessionStorage["sc.session"]`, hits
  `GET /api/session/:id` → on 404 / network error,
  `POST /api/session`. Persists the resulting id and
  returns the `SessionInfo`. `deleteSession(id)` is the
  best-effort fire-and-forget for tab-close + Disconnect;
  `clearStoredSession()` drops the stored id without
  contacting the bridge (used after Disconnect to force a
  fresh session next bootstrap).
- `src/session/SessionContext.tsx` — `ConnectionStatus`
  enum (`connected | connecting | disconnected`) +
  `SessionProvider` + `useSessionContext()` so any
  component can read app-wide connection state without
  prop-drilling from `AppShell`.
- `AppShell.tsx` — `bootstrapState` machine
  (`pending | ready | disconnected`) drives the
  bootstrap effect; on `ready`, `handleConnect(info)`
  fires next render. The pre-29 `handleConnect` chain
  (`/status` probe → `/notify 1` → `setupDashboard`) is
  collapsed: the WS just opens at
  `/ws?session=<uuid>` and `setupDashboard` is invoked
  directly with the session-supplied
  `clientId / parentGroupId / sampleRate / chunkSize`.
- `vite.config.ts` — added `/api` proxy alongside `/ws`
  (commit d2f7fbc) so dev mode forwards both to the bridge.

*29d — TTL eviction + drop legacy + UI rework (commits
e68efbd, c963c2a, 6b21358, 6655508).*
- `Session::evict_idle(ttl)` (two-pass: read-lock to
  collect stale ids, write-lock to remove + run cleanup
  on detached `Arc<Session>`s without holding the map
  lock). `serve_on()` spawns a once-a-minute background
  task scanning the store; first tick is skipped so
  freshly-bootstrapped sessions aren't racing eviction.
  `config.session_ttl_seconds` (default 1800 = 30 min)
  drives the TTL.
- `WsQuery` lost the legacy `?scsynth=` field — the WS
  upgrade now requires `?session=<uuid>` and 400s
  without it. `ws_cleanup.rs` deleted entirely.
- ConnectScreen deleted; `src/ui/ConnectScreen/` removed.
  The `dashboard-shell` is the only top-level UI now.
- Header chrome refactored: `<span class="badge"
  data-variant={…}>` shows `connected | connecting | disconnected`,
  and the action button toggles between Disconnect (when
  connected) and Connect (when disconnected). The
  chunk-size picker is disabled while disconnected /
  re-initing.
- Disconnected state shows the same dashboard layout as
  connected but with disabled-state placeholder cards
  (`<DisabledPanels>` — one `.panel[aria-disabled="true"]`
  per upcoming live panel, in the same order). Layout
  never reflows on connect/disconnect.
- `useToasts()` + `<ToastContainer>` replace the runtime
  AlertModal flow. Connection errors, heartbeat failures,
  and re-init failures show as bottom-right toasts:
  `success` (4 s auto-dismiss), `info` (5 s), `warn` (7 s),
  `error` (sticky until manual dismiss). The error
  variant uses `role="alert"` + `aria-live="assertive"`;
  the rest are polite + `role="status"`.
- `@sc-app/ui-foundation` — new `components/toast.css`
  (`.toast-stack` fixed bottom-right + `.toast` cards
  with per-variant left-border accent stripes
  + `@keyframes toast-slide-in`), and `panel.css` got a
  `.panel[aria-disabled="true"]` rule (opacity 0.55,
  pointer-events: none, user-select: none).
- `tab close` / pagehide handler now sends `DELETE
  /api/session/:id` with `keepalive: true` instead of
  the pre-29 fire-and-forget `/g_freeAll` + `/notify 0`
  bundle. The bridge runs the cleanup bundle on receipt.
  The TTL job catches whatever the keepalive request
  doesn't (hard SIGKILL, browsers without keepalive).
- Disconnect button: `teardownServerState` (recordings →
  scopes → buffers → synths → clock → group, each
  try/caught) → `client.dispose()` → `deleteSession(id)`
  → `clearStoredSession()`. Reconnect from the same
  state mints a fresh session next bootstrap.

*Mid-phase fixes (not their own sub-phase).*
- `e68efbd` (`feat(ui-foundation): add .toast component`)
  shipped the foundation toast styles ahead of the UI
  rework so 29d/3 could consume them.
- `36d75cc` (`fix(config): pre-populate /dirt route in
  starter config`) — first-launch `tauri dev` writes
  `app_config_dir/config.json` from the starter struct;
  pre-29d that file had empty `routes`, so SuperDirt
  traffic hit scsynth's port 57110 and surfaced as
  `/fail /dirt/hello: Command not found` in the debug
  log. The starter now seeds `/dirt → 127.0.0.1:57120`
  so a virgin install routes SuperDirt correctly. Users
  with a stale `config.json` still need to add the
  route manually (or delete the file to regenerate it).

### Decisions

- **Session ID storage = `sessionStorage`, not cookies, not URL.**
  Cookies would be shared across tabs of the same browser
  profile, collapsing two tabs onto the same scsynth
  `clientId` and stepping on each other's IdAllocator
  ranges. URL routing is over-engineering for our use
  (no bookmarking, no session sharing). `sessionStorage`
  is per-tab, survives F5, dies on tab close — exactly
  the boundary we want.
- **Sessions are in-memory only.** `RwLock<HashMap<Uuid,
  Arc<Session>>>` on the bridge. Bridge restart = all
  sessions die = next `GET /api/session/:id` returns
  404 → frontend bootstraps fresh. No Postgres / sqlite
  — scsynth restarts already lose their state, so adding
  storage to persist the bridge's half doesn't buy
  anything.
- **Reply routing within a session: broadcast to all
  attached WS, frontend filters.** Typically there's one
  WS per session. Multiple WS per session is rare (would
  need someone deliberately copying `sc.session` across
  windows) and `tokio::sync::broadcast` handles it for
  free. Frontend already correlates by sync-id / bufnum /
  nodeId, so broadcast doesn't add bookkeeping.
- **TTL cleanup, not explicit DELETE on close.** Tab
  close runs `DELETE /api/session/:id` with `keepalive:
  true` opportunistically, but the browser doesn't
  guarantee delivery (especially on hard SIGKILL).
  The 30-minute TTL is the canonical cleanup path —
  the DELETE just shortens the window. Brief
  no-WS-attached spans during F5 are well below TTL,
  so reload doesn't trigger eviction.
- **Cleanup ordering: abort recv tasks BEFORE the
  teardown bundle.** Same rationale as the pre-29
  `WsCleanup`: the `/g_freeAll` + `/n_free` bundle
  provokes `/fail` replies if scsynth's state is
  already inconsistent, and we don't want those
  fanned out to a (now-detached) WS that could
  surface them as user-visible errors.
- **Recv-broadcast tasks spawn AFTER the handshake.**
  In `Session::create`, the `/notify` and `/status`
  round-trips own the socket exclusively; once both
  complete, the per-target broadcast task takes over.
  Spawning earlier would race the handshake replies
  against the broadcast channel.
- **No "Reset Session" button.** Originally planned in
  29d as a separate UI affordance for forcing a fresh
  session. Cut: Disconnect already clears
  `sessionStorage` + DELETEs the session, and clicking
  Connect again mints a fresh one. One button covers
  both ergonomics.
- **Always-render dashboard, not a connect screen.**
  Originally 29d/3 rendered ConnectScreen on
  disconnect; switched to disabled-panel placeholders
  during review. The dashboard layout doesn't reflow
  on connect/disconnect — header status badge + button
  carry all the state the user needs to see, and the
  panel chrome stays put. Less jarring, and matches the
  "auto-connect by default" UX promise.
- **Toasts over modals for runtime errors.** Pre-29 used
  `AlertModal` for WS death / heartbeat failure / re-init
  failure — modal-blocking is wrong here, the user can
  still inspect the existing dashboard state. Toasts
  let the existing UI stay interactive while surfacing
  the error. Errors stick (no auto-dismiss); warnings
  and successes auto-dismiss.

### Gotchas worth carrying forward

- **The bridge's session UDP socket holds a `/notify`
  slot for the session's TTL — not just for a WS
  lifetime.** scsynth's default `maxLogins=8` is the
  hard ceiling on simultaneous sessions per scsynth.
  The SuperDirt startup script + the systemd unit +
  `start-scsynth-only.sh` all need bumping together if
  more sessions are anticipated. 8 simultaneous sc-app
  tabs is well above realistic use, but worth flagging.
- **`?scsynth=` query param is GONE.** Pre-29 every WS
  upgrade carried `?scsynth=HOST:PORT` so the per-WS
  bridge knew where to send UDP. 29d dropped this
  entirely — sessions are bound to the bridge's
  configured default scsynth (from `config.json -> scsynth`)
  at creation time and can't override. To point a
  session at a different scsynth, edit `config.json`
  and restart the bridge. (Single-server-per-bridge
  was always the realistic deployment shape; the
  per-WS override was a holdover from Phase 0.)
- **Tab close is best-effort, not guaranteed.** The
  `pagehide` listener fires `DELETE /api/session/:id`
  with `keepalive: true`, but browsers don't promise
  delivery. The 30-minute TTL is the actual cleanup
  guarantee. Hard SIGKILL of the bridge skips both
  paths; sessions just die with the process.
- **`sessionStorage` is wiped by Incognito / Private
  mode** (per-tab on close, no cross-tab). Means
  private browsing always generates a fresh session.
  Not a problem; document.
- **`Vite dev proxy must forward both `/ws` and `/api`.**
  Pre-29 only `/ws` needed proxying. Forgetting `/api`
  was the gotcha that surfaced as a "404 Not Found"
  on the (no-longer-existing) ConnectScreen during
  29c testing — `vite.config.ts` now lists both.
- **`tauri dev` reads from `app_config_dir/config.json`,
  NOT the project's `./config.json`.** Specifically on
  macOS: `~/Library/Application Support/com.sc-app.dev/`.
  A stale `config.json` written by an older sc-app build
  may have empty routes, breaking SuperDirt routing
  silently. Symptom: `/fail /dirt/hello: Command not
  found` in the debug log even though the project's
  on-disk `./config.json` looks fine. Fix: delete the
  app-config-dir file (let starter regenerate) or
  manually add the `/dirt` route. Browser / `yarn dev:full`
  picks up the project-root `./config.json` instead and
  doesn't hit this.
- **`SessionInfo.parentGroupId` flows through the API,
  not derived on the frontend.** Pre-29 the frontend
  computed `clientId * 100` with the `clientId == 0
  ⇒ 100` fallback. Post-29 the bridge computes it once
  at `Session::create` and the frontend just consumes
  the value. The fallback logic still lives in
  `Session::create`; if the frontend ever needs to
  derive it again (say, for an offline mode), keep
  the same shape.
- **Heartbeat still detects scsynth-gone.** The
  `setInterval(/status, 3 s, timeout 2 s)` heartbeat in
  AppShell is unchanged; on timeout it disposes the
  WorkerClient and drops to `disconnected` (showing a
  toast). The bridge keeps the session alive — its UDP
  socket is still happy to send/recv even though no
  one's listening — until TTL or the next user action.
  A user clicking Connect again after scsynth comes
  back will reuse the still-live session and inherit
  whatever scsynth state survived (typically nothing,
  since scsynth restarted; the dashboard re-init
  effectively starts fresh).
- **`ConnectionStatus` derives from the bootstrap state +
  resources, not its own store.** `bootstrapState.phase
  === 'pending' || 'ready'` ⇒ `connecting`; `resources
  !== null` ⇒ `connected`; otherwise `disconnected`.
  Don't add a separate connection-state machine — the
  derivation rules are simple enough.
- **Don't shadow the `status` OSC builder import with a
  local `status: ConnectionStatus`.** Cost a TypeScript
  error during 29d wiring (`'status' is callable. No
  constituent of type 'ConnectionStatus' is callable`).
  The local connection-state variable in AppShell is
  `connectionStatus` for this reason; the OSC builder
  stays `status`.
- **Config field rename caveat: `?scsynth=` removal is
  one-way.** The `config.json` `scsynth` field still
  exists (it's the bridge's default route target), but
  the per-WS query parameter does not. Don't add it
  back without first re-introducing the per-WS UDP
  socket model — they were one feature.


## Phase 30 — Shared Audio Clock (sclang-Owned)

**Goal.** Move the clock from per-session frontend synths to a
single sclang-owned `\scAppClock` running at scsynth's root group.
All sc-app sessions become passive observers of the same `/tr`
stream and read the same `clockBus`, enabling sample-accurate
cross-client sync. The clock cannot be killed by any client's
`/g_freeAll` or `/n_free` because it lives outside their parent
groups. `chunkSize` becomes a server-side config knob
(`SC_APP_CLOCK_CHUNK_SIZE` env var); the frontend has no UI
for it anymore — every connected session re-attaches via
`/clock/hello` after a sclang restart.

The new wins:
- **Cross-client sync.** Two tabs running sequencers can land
  steps on the same audio frame, modulo delivery jitter (~1 ms
  intra-machine). Pre-30 each tab anchored its own `tick0Ms`
  from its own `/tr` arrival and drifted independently.
- **Clock survives session churn.** A client's reload doesn't
  blink the clock; F5 inside a tab while another tab is open
  has zero observable effect on the second tab.
- **Removes the "any client can break everyone" footgun.** The
  shared `\scAppClock` is at scsynth root, off-limits to any
  client's `/g_freeAll` (which only reaches their own parent
  group's children).
- **chunkSize source-of-truth consolidates.** Was a per-session
  dropdown that triggered a full in-place re-init; now a single
  env var read by sclang at startup.

### What shipped

Three sub-phases (30d collapsed into 30c).

*30a — sclang clock + `/clock/hello` responder
(part of commit ab32ee4).*
- `scripts/sc-app-superdirt-startup.scd` — extends the
  `s.doWhenBooted` block:
  - `SynthDef(\scAppClock)` mirrors the pre-30 frontend
    `compileClockSynthDef` shape: `Impulse.kr` → `SendTrig
    1000` + `PulseCount` count, `Phasor.ar` wraps every `2 ×
    chunkSize` samples writing to `clockBus`. Tick rate is
    `s.sampleRate / clockChunkSize`, baked in as a literal Hz
    at definition time. (Post-shipping cleanup migrated this
    to `SendReply.kr(tick, '/clock/tick', count)` — see the
    bottom of this entry.)
  - `~scAppClockBus = Bus.audio(s, 1)` — sclang's allocator
    picks the index (typically 4 right after hw-reserved buses;
    way below the frontend's `IdAllocator(32)` start point).
  - `s.sendMsg('/s_new', 'scAppClock', 999, 0, 0, 'clockBus',
    ~scAppClockBus.index)` — pinned `nodeId = 999` (one below
    any frontend `IdAllocator(node)` range), `addAction = 0`
    (\addToHead), `target = 0` (root group).
  - `OSCdef(\scAppClockHello)` on `/clock/hello` replies on
    `/clock/info` with `[tickRate, value, chunkSize, value, …]`
    — same interleaved key/value wire shape as
    `/dirt/samples`.
  - chunkSize from `SC_APP_CLOCK_CHUNK_SIZE` env var (default
    1024). Validation falls back to 1024 with a `.warn` if the
    value is non-integer or < 1.
- `scripts/start-superdirt-only.sh` — exports
  `SC_APP_CLOCK_CHUNK_SIZE` defaulting to `1024`. Inherited
  by `start-osc.sh` which spawns `start-superdirt-only.sh`.
- `config.json` (project) + `Config::starter()` — add
  `{ "prefix": "/clock", "target": "127.0.0.1:57120" }`
  alongside the Phase-26 `/dirt` route. Bridge's existing
  prefix-match demux handles new prefixes — zero Rust code
  change.

*30b — Frontend ClockController as observer
(part of commit ab32ee4).*
- `src/clock/clockClient.ts` (new) — typed `clockHello()`
  builder + `parseClockInfo(args)` that walks the interleaved
  reply into `{ tickRate, chunkSize, sampleRate, clockBus,
  clockNodeId }` (the `trigId` field shipped initially and was
  dropped in the SendTrig → SendReply post-cleanup at the
  bottom of this entry). Throws on missing keys so a sclang ↔
  frontend protocol mismatch fails loudly.
- `src/clock/ClockController.ts` — major rewrite from owner to
  observer. New `attach(timeoutMs = 3000)` round-trips
  `/clock/hello` via `WorkerClient.sendAndAwaitReply`, parses
  the reply, derives `ClockDerived`, registers the trig
  listener, starts the freshness watchdog. New `detach()` is
  sync (no `/n_free` to await — we don't own the synth).
  Removed `start/stop/resume/reset/dispose`'s synth-owning
  paths. `effectiveState` semantics preserved (`'stopped'` /
  `'paused'` / `'running'`) by combining attached-state with
  `GroupController.state`. Back-compat `env: AudioEnvironment`
  getter so `RecordingManager` / `ScopeManager` call sites
  stayed unchanged. Better error message when `/clock/hello`
  times out — points the user at sclang + the `/clock` route.
- `src/AppShell.tsx` — `setupDashboard` calls
  `group.ensureCreated()` + `clock.attach()` instead of the
  pre-30 `clock.start()`. Re-init confirmation modal drove
  `clock.stop/resume`; now drives `group.pause/resume`. The
  `chunkSize` state followed `clock.info.chunkSize` post-attach
  in 30b (removed entirely in 30c).
- `src/ui/ClockPanel/ClockPanel.tsx` — Pause/Resume buttons
  drive the parent `GroupController` via a new `group` prop.
  Reset button removed (the shared clock can't be reset by a
  client). Status pill semantics unchanged.
- `src/sequencer/SequencerController.ts` — new `isGroupPaused`
  callback option. When the parent group is paused, `pumpOnce`
  early-returns without emitting `/dirt/play` (option (b) from
  the plan; the user's Pause silences sequencer output even
  though the shared clock keeps ticking). On the first
  un-paused pump, `nextStepTick` is re-anchored to
  `nowTick + INITIAL_LOOKAHEAD_TICKS` so resume doesn't fire
  every step the pause window contained in a catch-up burst.

*30c — chunkSize dropdown removal + cleanup.*
- `src/AppShell.tsx` — removed:
  - The `<select>` chunk-size-picker from `DashboardHeader`.
  - The `chunkSize`, `reiniting`, `pendingChunkSize` `useState`
    declarations.
  - `runReinit` / `onChunkSizeChange` / `onConfirmReinit` /
    `onCancelReinit` callbacks.
  - The `<ConfirmModal>` reinit confirmation render.
  - The `<LoadingModal>`'s reinit message branch (still
    renders during initial bootstrap with a single
    "Connecting…" message).
  - The `chunkSize` parameter from `setupDashboard`'s
    signature.
  - Imports: `ConfirmModal`, `practicalChunkSizes`,
    `DEFAULT_PARAMS`.
- `src/synthdefs/clockSynthDef.ts` — **deleted**. The SynthDef
  lives in sclang now.
- `packages/server-commands/src/index.ts` — sample doc-comment
  example updated from `'globalClock'` to `'myDef'`.
- `CLAUDE.md` — architecture diagram, group-ordering invariant,
  reserved IDs, connect handshake description, disconnect
  cleanup, gotchas, and the chunkSize × sampleRate table all
  reflect the Phase 30 reality. New "Shared clock (Phase 30)"
  bullet under "Where scsynth conventions matter".

### Decisions worth carrying forward

- **chunkSize is now sclang-side, full stop.** No
  `/clock/setChunkSize` route — discussed, rejected for 30c.
  Restarting sclang is the only way to change it. The plan
  flags this as a possible Future Improvement if the UX
  regression bites.
- **Permission filtering via convention, not a Rust filter.**
  A misbehaving client could `/n_free 999` and kill the shared
  clock. Documented as off-limits; relied on by everyone.
  Bridge-side filtering is a one-line addition in
  `routing.rs` if it ever becomes a real problem.
- **Pause = local to the parent group.** The shared clock keeps
  ticking; only this client's tap synths + sequencer freeze.
  Other clients are unaffected, by design — pause is a
  per-client UX concern, not a global one.
- **Sequencer pause re-anchors `nextStepTick`** instead of
  freezing it. On resume, playback continues from "now" rather
  than firing every step it would have fired during the pause
  in a catch-up burst.

### Gotchas

- **Stale `config.json` from before Phase 30** doesn't have the
  `/clock` route. `clock.attach()` times out with the message
  "Could not attach to the shared clock (/clock/hello)…". Fix:
  delete the file (regenerates from `Config::starter()`) or
  hand-edit the route in. Same shape as the pre-Phase-26
  `/dirt` route migration caveat.
- **`SC_APP_CLOCK_CHUNK_SIZE` is sclang-side, not bridge-side.**
  The bridge has no awareness of the value; it's read only by
  the .scd. To change: edit the env var, restart sclang. Every
  attached session sees the new value on next `/clock/hello`
  round-trip (which happens on reconnect / page reload).
- **The frontend's `IdAllocator(bus)` starts at 32, sclang's
  `Bus.audio` allocator starts at `numIns + numOuts = 4`.** The
  ranges don't overlap in practice, but if you ever bump
  `numInputBusChannels` or `numOutputBusChannels` past 32 —
  or change `IdAllocator(32)` — re-verify.
- **sclang as single point of failure.** Pre-30 a sclang crash
  killed SuperDirt but the per-session clocks survived.
  Post-30 it kills the clock too — every attached session's
  watchdog flips `effectiveState` to `'stopped'`. Restart
  sclang, refresh tabs, you're back. Bridge could surface a
  "clock detached" toast if `/clock/tick` silence exceeds a
  threshold; punted to a Phase 30+ follow-up.

### Post-shipping cleanup: SendTrig → SendReply

Right after Phase 30c shipped, we noticed the `\scAppClock`
SynthDef still used `SendTrig.kr(tick, 1000, count)` — leftover
from the per-session clocks pre-30, where `CLOCK_TRIG_ID = 1000`
was an app-wide reservation. Migrated to
`SendReply.kr(tick, '/clock/tick', count)`:

- The clock's wire address is now `/clock/tick` instead of `/tr`,
  matching the rest of the bridge's address-prefix routing
  conventions (`/dirt/*`, `/clock/*`).
- The "no synth may use trigID 1000" reservation is GONE —
  `SendTrig` is safe for any synth across any client to use
  without colliding with the clock.
- Worker-side decoding collapses into one path: address-match
  `/clock/tick` and emit a `clockTick` event, identical in shape
  to before. No more trigID demuxing or
  `registerClock`/`unregisterClock` protocol messages.
- `ClockInfo` drops the `trigId` field.
- `WorkerClient` drops `registerClock(trigId)` and
  `unregisterClock()`.

Wire payload shape unchanged in practice: SendReply emits
`/clock/tick nodeID replyID count`, same `args[2] === count`
indexing as the pre-cleanup `/tr nodeID trigID count`. No audio,
performance, or UX delta — purely a code cleanliness +
namespacing improvement.

---

## Phase 31 — SHM Buffer Ingestion (scopes + recordings)

**Goal.** Replace the OSC `/b_getn` data path entirely with a
shared-memory transport. Tap SynthDefs write audio via `ScopeOut2`
into scsynth's SHM scope-buffer pool; the Rust bridge mmaps that
segment and reads slots non-mutating; frames stream to the frontend
over a per-scope WebSocket. Scopes and recordings unify onto one
transport (SHM); the consumer-facing API (`BufferHandle.subscribe`
/ `latestChunk` / `release`) is bit-identical, so neither
`ScopeView` nor `RecordingController` had to change.

The new wins:
- **Zero `late 0.0XX` warnings on scsynth's console.** The
  `/b_getn` request + `/b_setn` reply OSC traffic for buffer
  ingestion is gone. Recording's drift-induced lateness goes
  away alongside the scope's, since they share the SHM transport.
- **Buffer-overwrite gap concern is gone.** No ring buffer to
  outpace; ScopeOut2 manages its own triple-buffer slot timing.
- **Code reduction.** Worker dropped ~300 lines of OSC
  retry/reorder/gap-synthesis machinery. Net Phase-31 worker
  diff: −500 LoC vs +200 LoC across all sub-phases.
- **Per-scope WS.** Each `BufferController.start()` opens a
  dedicated `/ws/scope` connection; main OSC WS goes back to
  pure OSC. Subscription lifecycle = WS lifecycle (auto-cleanup
  when WS closes); each subscription shows up as a separate
  connection in browser DevTools.

### What shipped

Four sub-phases, plus a post-shipping refactor.

*31a — sclang `/scope` OSC handler (commit `acd8a8f`).*
- `scripts/sc-app-superdirt-startup.scd` — extends the
  `s.doWhenBooted` block with three responders:
  - `OSCdef(\scAppScopeHello)` on `/scope/hello` → `/scope/info
    [numScopeBuffers, 128]`. Wire shape mirrors `/clock/info`'s
    interleaved key/value tuples.
  - `OSCdef(\scAppScopeAllocate)` on `/scope/allocate` →
    `/scope/allocated <idx>` from `s.scopeBufferAllocator`. On
    exhaustion replies `/scope/allocateFailed <reason>`.
  - `OSCdef(\scAppScopeFree)` on `/scope/free <idx>` — returns
    the index to the allocator; no reply (fire-and-forget).
  - Posts `[sc-app] /scope/* responders installed` on startup.
- `config.json` (project) + `Config::starter()` — adds
  `{ "prefix": "/scope", "target": "127.0.0.1:57120" }`,
  routing alongside the existing `/dirt` and `/clock` prefixes.

*31b — Rust SHM reader (commit `acd8a8f`).*
- `src-tauri/src/scope_shm.rs` (new, ~1000 lines):
  - `MmapRegion` RAII wrapper + cross-platform path discovery:
    macOS uses `/tmp/boost_interprocess/SuperColliderServer_<port>`;
    Linux uses `/dev/shm/SuperColliderServer_<port>` (best-guess
    pending real Pi verification — flagged in the gotchas below).
  - Layout reference for `scope_buffer` and
    `server_shared_memory` cross-referenced against SC source
    (`common/scope_buffer.hpp`, `common/server_shm.hpp`); inline
    docstrings document the triple-buffer pull semantics so
    future-us doesn't have to re-derive.
  - `find_scope_buffer_array`: locates the 128 `scope_buffer`
    instances by:
    1. Scanning the segment for scope_buffer-shaped structures
       (status field ∈ {0,1}; stage/in/out a permutation of
       {0,1,2}).
    2. Walking the segment 8 bytes at a time looking for a
       contiguous run of 128 `offset_ptr`s that each resolve
       to a known scope_buffer offset — that run *is* the
       `bi::vector<offset_ptr<scope_buffer>>` payload.
  - `read_scope_slot(idx)` reads a slot non-mutating (does NOT
    advance `_in/_out`; only the writer does). Reports
    `_stage` to the caller for frame-completed detection.
  - `GET /api/scope/{probe,layout,headers,debug}` endpoints
    for one-shot diagnostics (used during 31b
    reverse-engineering; useful even post-shipping for
    inspecting an arbitrary running scsynth's segment).

*31c — Bridge SHM polling (commit `b23f3bf`, later refactored).*
- Originally: bridge multiplexed scope chunks onto the main OSC
  WebSocket via 0x01/0x02/0x03 op tags (subscribe / unsubscribe
  / chunk). OSC frames start with `/` or `#` so the op tags
  were unambiguous against OSC.
- Per-WS `ScopeContext` held subscriptions + lazily-opened SHM
  mmap; `forward_broadcast` peeked each broadcast OSC reply
  for `/clock/tick`, then on hit polled `read_scope_slot` for
  every active subscription and pushed 0x03 chunk frames for
  any whose `_stage` advanced.
- **This was reworked the same day** — see "Per-scope WS
  refactor" below.

*31d — Frontend ScopeOut2 path (commit `b23f3bf`).*
- `src/scope/scopeClient.ts` (new) — typed builders for
  `/scope/{hello, allocate, free}`, reply parsers,
  `probeScopeShm()` HTTP wrapper (calls `GET /api/scope/probe`
  on first `BufferManager.acquire()` to validate SHM is
  reachable). Mirrors `clockClient.ts` shape.
- `src/synthdefs/bufferTapSynthDef.ts` — substantial
  simplification:
  - Drop `bufnum` and `clockBus` synth controls.
  - Drop `BufWr.ar` and the `clockBus`-driven `writeIdx` math.
  - Add `scopeNum` control + a single `ScopeOut2.ar(sigs,
    scopeNum, chunkSize, chunkSize)` UGen.
  - Cache key drops the `(channels, chunkSize, ringHalves)`
    tuple to just `(channels, chunkSize)` since the SynthDef
    is structurally identical regardless of `scopeNum` (it's
    a /s_new control, not a SynthDef constant).
  - **`ScopeOut2.ar`, not `.kr` — load-bearing.** kr-rate
    writes one sample per control block, filling a
    1024-frame slot in ~1.4 s (push rate ~0.7 Hz) → scopes
    appear "very unresponsive". `.ar` matches the tick
    cadence (~47 Hz at default chunkSize/sampleRate).
- `src/buffer/BufferController.ts` — Phase 31 lifecycle:
  1. `/scope/allocate` round-trip → `scopeNum`.
  2. `/s_new bufferTap … scopeNum`.
  3. Worker `subscribeBuffer` (which opens the per-scope WS
     post-refactor; pre-refactor sent the 0x01 op tag on the
     main WS).
  4. On dispose: worker `unsubscribeBuffer` → `/n_free` tap →
     fire-and-forget `/scope/free <idx>`.
  - Drops `/b_alloc` / `/b_free` and the buffer-id
    IdAllocator entirely.
- `src/buffer/BufferManager.ts` — drops the `bufferIds`
  IdAllocator dependency; drops `clock` from constructor
  options (no more clockBus reading in the tap). Lazy SHM
  probe on first `acquire()` rejects with a clear error if
  `probeScopeShm()` says the segment isn't reachable
  ("scsynth must be running locally").
  Snapshot reports `scopeNum` instead of `bufnum`.
- `src/server/workerProtocol.ts` — `BufferSubscription.bufnum`
  → `scopeNum`; dropped `skipFirstTick` and `retry` fields
  (gone with the worker's retry/reorder machinery).
  `BufferChunk` shape unchanged so `ScopeView` and
  `RecordingController` need zero edits.
- `src/AppShell.tsx` — buffer ID allocator removed.
  `setupDashboard`'s resource type narrowed.
- `src/workers/oscWorker.ts` — `/b_getn`-tick-driven loop
  (`pendingByOffset`, `reorderBuffer`, retry policy, gap
  synthesis, `fireReads`, `/b_setn` intercept,
  `skipFirstTick` handling) all deleted. Replaced by a
  one-byte peek-and-route on inbound WS frames (0x03 → decode
  chunk → post `bufferChunk` to main; otherwise OSC).

### Per-scope WS refactor (commit `dfeb924`)

Same day as 31c/d: replaced the in-band op-tag mux with one
WebSocket per scope subscription.

- `src-tauri/src/server/ws_scope.rs` (new) — `GET /ws/scope?
  session=<uuid>&scope=<idx>&channels=<n>&chunkSize=<m>&bufferId=<id>`.
  Handler validates the session, ensures the per-Session SHM
  mmap is open, subscribes to the session's default-route
  broadcast, polls SHM on every observed `/clock/tick`, and
  sends a 10-byte-header binary frame:
  `[tickIndex u32_le | isGap u8 | channels u8 | frameCount u32_le |
   float32_le payload]`. `bufferId` is implicit in the connection
  (URL-borne, both ends already know it) — no need to repeat in
  every chunk header.
- `src-tauri/src/server/session.rs` — Session gains
  `scope_shm: tokio::sync::OnceCell<Arc<ScopeShm>>` so multiple
  scope WSs on the same session share one mmap. New
  `Session::ensure_scope_shm()` does the lazy init (mmap +
  layout scan once per session lifetime).
- `src-tauri/src/server/ws_bridge.rs` — main WS handler reverts
  to pure OSC. Dropped: `ScopeContext`,
  `handle_scope_subscribe`, `handle_scope_unsubscribe`,
  `poll_scope_subs`, `/clock/tick` peek in `forward_broadcast`.
  ~250 lines deleted.
- `src-tauri/src/scope_shm.rs` — dropped the `encode_chunk` /
  `decode_subscribe` / `decode_unsubscribe` / `SCOPE_OP_*`
  helpers (the in-band wire format, no longer used). The
  mmap reader + `find_scope_buffer_array` + `read_scope_slot`
  remain.
- `src/workers/oscWorker.ts` — captures the main WS URL on
  connect; `subscribeBuffer` opens a dedicated WebSocket to
  `/ws/scope` with the same query params; `unsubscribeBuffer`
  closes the matching WS; disconnect closes all of them.
  Main WS recv path is back to pure OSC (no first-byte
  op-tag peek).
- `src/workers/scopeWire.ts` — rewritten as a single
  `decodeScopeFrame` for the per-scope-WS header.

Net diff for the refactor: −585 / +213. Naturally
self-cleaning (subscription lifecycle = WS lifecycle); each
subscription is a separate visible connection in DevTools;
main OSC WS stays protocol-pure.

### Decisions worth carrying forward

- **No `/b_getn` fallback.** Recommendation (a) from Open
  Question 4 in the plan won out: SHM-only. If scsynth isn't
  local, `BufferManager.acquire` rejects with a clear error
  ("scsynth must be running locally"). All current sc-app
  deployments colocate scsynth (Tauri, Pi systemd, `yarn
  dev:full`); a remote-scsynth use case can revisit later.
- **Heuristic vector finder over Boost segment-manager parser.**
  31b uses a "find a contiguous run of 128 offset_ptrs that
  resolve to scope_buffer-shaped structures" scan rather than
  parsing Boost.Interprocess' segment-manager metadata
  directly. Works because Boost's TLSF allocator places
  sequential `segment.allocate()` calls contiguously in
  practice and 128 unused scope_buffers all share the
  default-ctor signature. The "proper" parser is **FI #12** in
  `plan.md` — promote when the heuristic fails (e.g., Boost
  upgrade reorders the allocator).
- **`ScopeOut2.ar`, not `.kr`.** Documented in the gotchas;
  cost a debug session before shipping.
- **`scopeFrames = chunkSize`** (slot size = chunk size)
  preserves the chunk-per-tick cadence bit-for-bit. Each
  completed slot maps to exactly one `bufferChunk` event;
  consumers don't see any change in shape.
- **Per-scope WS over op-tag mux.** Cleaner lifecycle (close
  the WS = unsubscribe; no orphan subscriptions if the worker
  forgets to send 0x02), better DevTools visibility, main OSC
  WS stays pure. Cost: N WebSockets per session instead of 1
  — well under any practical browser/server limit (~6 per
  origin in pre-HTTP/2 browsers, effectively unlimited under
  HTTP/2).

### Gotchas

- **Linux SHM path is best-guess.** `/dev/shm/SuperColliderServer_<port>`
  was inferred from POSIX `shm_open` semantics; not
  empirically verified on a Pi target as of phase shipping.
  If the path differs, `MmapRegion::open_for_port` returns
  `NotFound` — the error message names what was probed.
  Verify once a Pi deployment exists; document and patch
  the constant.
- **`ScopeOut2.ar` vs `.kr`.** `.kr` writes one sample per
  control block (~0.7 Hz push rate at default config →
  scopes appear frozen / very laggy). `.ar` writes one
  sample per audio frame, completing a slot per tick. The
  fix is one character; the symptom looks like "the bridge
  is broken". Documented in the SynthDef source.
- **`scopeBufferAllocator` exhaustion (128 slots).**
  `s.scopeBufferAllocator` is a `StackNumberAllocator(0,
  127)`. With dedup-per-spec via `BufferManager`, 128 slots
  is plenty for typical use. On exhaustion sclang replies
  `/scope/allocateFailed <reason>` and the frontend rejects
  the acquire — surface via `ServerErrorBus` toast. No
  current consumer guard against pathological N-distinct-
  spec churn; if it ever becomes real, add a soft cap in
  `BufferManager`.
- **scope_buffer triple-buffer is non-mutating from the
  reader's perspective.** `read_scope_slot` reads `_stage` +
  the data slot at `_state[_stage]._data`; it does NOT
  advance `_in`/`_out`. Doing so would race the writer.
  Phase-completed detection is "stage advanced since last
  poll"; this is what the per-scope WS handler tracks
  per subscription.
- **scsynth must be local.** No fallback to OSC `/b_getn`
  shipped. If a remote-scsynth use case ever appears it'd
  bring back most of the worker's deleted machinery — punted
  to "decide if it actually shows up".
- **Fan-out per shared spec preserved.** `BufferManager`
  ref-counts by `(inputBus, channels, chunkSize)` so two
  consumers on the same spec share one tap synth + one
  scope_buffer index + one per-scope WS. Each consumer's
  `subscribe(cb)` callback is invoked locally on the same
  bufferChunk. Pre-31 fan-out semantics intact.


---

## Phase 32 — Worker-Side Sequencer Pump

**Goal.** Move the step sequencer's wake loop off the main
thread (where Chromium clamps `setInterval` to ~1 Hz on
backgrounded tabs) into the existing OSC worker, where timers
are not throttled. `SequencerController` keeps its full public
API and reactive stores; the timing-critical work hops behind
`postMessage` into a new `sequencerWorker.ts` module folded
into the existing worker context. Same `WorkerClient` ↔
`oscWorker` shape — adding another responsibility behind its
own message namespace, no second worker.

The user-visible payoff:
- **No audio dropouts when the tab is backgrounded.** The
  sequencer keeps emitting future-timetagged `/dirt/play`
  bundles to scsynth at the right moments regardless of
  whether the browser tab is focused. Pre-32 a backgrounded
  tab caused bundles to fall behind their target ticks; some
  arrived in scsynth's audio past (logged `late 0.0XX`),
  others were dropped.
- **No new abstraction.** Considered (then rejected) a generic
  worker-scheduler primitive or a `SchedulerController` +
  manager. The sequencer is the only consumer that needs
  sample-accurate emission through a wall-clock timer; if a
  second consumer ever appears, we extract the abstraction
  from two real cases rather than guessing the shape now.

### What shipped

Four sub-phases, plus a vitest bootstrap.

*32a — Worker protocol + stub handler (commit `58cd203`).*
- `src/server/workerProtocol.ts` — new types:
  - `SequencerBankSnapshot { slots, activeIndex, chain }` —
    structured-clone-friendly bank shape posted to the
    worker. Bank state is small (~few KB); diffing is
    premature optimization, full snapshots replace on every
    fire.
  - `SequencerClockSnapshot { tick0Ms, tickRate, chunkSize,
    sampleRate }` — what the worker pump needs for
    `tickToTimetag` math. The pump itself only uses `tick0Ms`
    + `tickRate`; `chunkSize` / `sampleRate` are forward-
    looking metadata.
  - `StepFired { stepIndex, tick, firedAtMs }` — emitted by
    the worker on each scheduled step; drives the playhead UI
    on main.
  - `CycleBoundary { fromIndex, toIndex }` — defined in 32a
    but ultimately unused: chain-mode advancement was simpler
    to keep on main, driven by `stepFired` events.
- 5 new `MainToWorker`: `sequencerStart`, `sequencerStop`,
  `sequencerBankUpdate`, `sequencerClockUpdate`,
  `sequencerPauseUpdate`.
- 2 new `WorkerToMain`: `stepFired`, `cycleBoundary`.
- `src/workers/sequencerWorker.ts` (new, stub) — receives
  messages, holds module-scoped state, logs each event. No
  emission yet.
- `src/workers/oscWorker.ts` — dispatches the 5 new sequencer
  messages to the stub handlers; calls
  `handleSequencerDisconnect()` on the disconnect path so
  worker state doesn't survive a WS close.
- `src/server/WorkerClient.ts` — typed wrappers added:
  `startSequencer`, `stopSequencer`, `updateSequencerBank`,
  `updateSequencerClock`, `setSequencerPaused`,
  `onStepFired`, `onCycleBoundary`. Listener sets cleared on
  `dispose()`.
- `SequencerController` deliberately untouched in 32a —
  stayed on main-thread `setInterval`. Verified the protocol
  end-to-end via a DevTools-console call.

*32b — Move pump logic into worker (commit `fdc35ad`).*
- `src/workers/sequencerWorker.ts` — replaced stub with the
  real pump. Verbatim port of `pump()` + `tickToTimetag` +
  `SUPERDIRT_SAFETY_LOOKAHEAD_MS` (200 ms) shift from
  `src/sequencer/scheduler.ts`. Runs an unthrottled
  `setInterval(25 ms)` inside the worker context. New
  `setSequencerSender(sender)` lets the host (oscWorker)
  inject a direct `transport.send` callback; the pump uses it
  to ship bytes without a second `postMessage` hop. Posts
  `stepFired` events at the audible step time (a `setTimeout`
  with the same `SUPERDIRT_SAFETY_LOOKAHEAD_MS` shift the OSC
  bundle uses, so UI ↔ audio stay in lockstep).
- `src/workers/oscWorker.ts` — registers the sender once the
  WS transport opens (in the connect path, after
  `transport.ready`); clears it on disconnect.
- `src/sequencer/SequencerController.ts` — replaced the
  main-thread `setInterval`/`pumpOnce` with worker delegation.
  `play()` snapshots bank + clock and posts
  `client.startSequencer(...)`; subscriptions to
  `bank.slots` / `bank.activeIndex` / `bank.chain` post fresh
  snapshots on every reactive fire. `group.state`
  subscription forwards pause changes via
  `client.setSequencerPaused()`. Constructor signature swap:
  drop `dirtClient` (worker emits OSC now), drop
  `isGroupPaused` callback (replaced by `groupState`
  ReadonlyStore so we subscribe rather than poll), add
  `client`.
- `src/sequencer/types.ts` — `ClockLike` extended with
  `chunkSize` + `sampleRate` so the controller can build a
  complete `SequencerClockSnapshot`.
- `src/AppShell.tsx` — passes `client` + `groupState`; the
  clock adapter gains `chunkSize` / `sampleRate` getters off
  `ClockController.info`.
- 32b shipped audio-only: playhead and chain-mode auto-advance
  were knowingly broken in this commit, restored in 32c.

*32c — Wire `stepFired` to UI + chain advance (commit
`acebeb3`).*
- `src/sequencer/SequencerController.ts` — new
  `handleStepFired(step)` private method, subscribed in
  `play()` via `client.onStepFired`. Updates
  `_transport.currentStep` so the playhead matches the
  audible step. Increments a local `chainElapsedSteps`
  counter; when it crosses `entry.cycles × pattern.length`,
  advances the chain entry (or stops on end-of-chain with
  `loop=false`). The existing `bank.activeIndex` subscription
  posts the new bank snapshot to the worker — no separate
  selectIndex-side coupling.
- No manual debouncing for refocus bursts. React 18 batches
  state updates and `Object.is` short-circuits unchanged
  `currentStep` writes; a 60 s background burst (~480 events
  at 8 steps/sec) collapses to one render on refocus. Inline
  comment documents the choice.
- `src/sequencer/scheduler.ts` — **deleted.** Pump logic +
  lookahead constants + `tickToTimetag` math all moved into
  the worker in 32b. Zero remaining importers.
- `src/sequencer/types.ts` — dropped the now-orphan
  `DirtClientLike` interface (only consumer was scheduler.ts)
  + the unused `Timetag` import.
- Net diff: −211 / +66 across the three files.

*32d — Vitest + worker pump tests (commit `d55b2be`).*
- Vitest 2.1.9 lifted to a root devDep (was scoped to
  `packages/synthdef-compiler`). New `yarn test` /
  `yarn test:watch` scripts.
- `vitest.config.ts` (new) — mirrors `vite.config.ts`'s `@/`
  + workspace-package aliases. Explicit `include:
  ['src/**/*.test.ts', 'tests/**/*.test.ts']` so the
  synthdef-compiler tests under `packages/` keep running
  independently from inside their own folder.
- `tests/setup.ts` (new) — polyfills `globalThis.self =
  globalThis` and `globalThis.window = globalThis` so the
  worker module under test can reach `self.postMessage` and
  osc-js can find `window` (same shim the runtime uses via
  `workerBootstrap.ts`).
- `src/workers/sequencerWorker.test.ts` (new) — 8 tests, all
  passing:
  - emits one /dirt/play bundle per active step on start
  - emits multiple bundles as the wake loop advances
  - skips emission while paused; resumes without catch-up
    burst (re-anchor invariant)
  - stops on `handleSequencerStop`
  - `handleSequencerDisconnect` clears the wake timer
    (idempotent)
  - refuses to pump when started with null `tick0Ms`
  - posts `stepFired` events to main with the right
    `stepIndex`
  - picks up bank updates without restart (sample changes
    take effect within ~one wake cycle)
- The 60-second backgrounded-tab manual validation passed
  on the user's machine — backgrounding the browser tab no
  longer produces audible gaps in sequencer output.

### Decisions worth carrying forward

- **No generic scheduler abstraction.** Sequencer is currently
  the only consumer that needs an unthrottled timing loop in
  a worker. When a second consumer (arpeggiator, transport,
  high-level music construct) appears, extract the
  abstraction from two real cases. YAGNI for now.
- **Chain advance lives on main, not in the worker.** The
  worker pumps the active pattern in a loop forever; main
  counts `stepFired` events, decides when to advance entries,
  calls `bank.selectIndex`. The existing `bank.activeIndex`
  subscription posts the new snapshot to the worker. Keeps
  the chain state machine in one place; the cross-thread
  round-trip is not audio-critical (worker has ~5 ticks of
  lookahead buffered when the new bank arrives).
- **No bundle/snapshot diff.** Bank snapshot replaces wholesale
  on every change. Bank shape is small (slots × patterns ×
  tracks ~ a few KB total); structured clone is cheap.
  Skipping diff logic is a net simplification.
- **`CycleBoundary` protocol message defined but unused.**
  Defined in 32a as a hedge against the chain-on-worker
  design. Kept in the protocol enum after 32c because removing
  it would churn imports for zero benefit; left as a
  no-op message handler. If a future need emerges (e.g.
  worker-driven cycle metering), the wire is already there.
- **No manual refocus-burst debounce.** React 18 batching +
  `Object.is` store short-circuit handle it. Validated by the
  60 s tab-switch test.

### Gotchas

- **Worker `setInterval` is unthrottled, but the message
  channel still backs up under throttling.** When the tab is
  backgrounded the WORKER keeps pumping (audio is correct).
  But `postMessage`s queued by the worker wait for main to
  drain — main is throttled to ~1 Hz. On refocus, hundreds of
  `stepFired` events flush at once. We rely on React 18 to
  batch them; if a future React change removes batching the
  playhead could thrash.
- **Bank snapshot must be structured-clone-friendly.** Pattern
  / Track / Step are POJOs; PatternBank's reactive store
  returns those POJOs unchanged; chain is a POJO too. No
  class instances slip through. If a future bank field gains
  a class instance (e.g. a Date, Set, Map), the worker side
  will receive a stripped object and break silently — audit
  on every bank-shape change.
- **`SequencerController` constructor signature changed.** Lost
  `dirtClient`; the worker emits OSC now. Lost the
  `isGroupPaused` callback; replaced by `groupState`
  ReadonlyStore. Gained `client`. Any future caller writing a
  fake controller for tests must match the new shape.
- **Mid-session `tickRate` change is unsupported.** Worker
  caches `tickRate` in its clock snapshot. If sclang restarts
  with a different `chunkSize`, the WS severs and the
  frontend reconnects from scratch — the worker's snapshot is
  rebuilt at that point. We don't try to handle a
  mid-session rate change; the inline comment in the worker
  pump notes the unsupported scenario.
- **Test pattern density matters.** A "single kick" pattern
  (only step 0 active, 16-step pattern) makes the sender fire
  every `pattern.length × stepInterval = 2 s`, which is too
  sparse for short-window timing assertions. The test helper
  `densePattern` uses all-active steps so the sender fires
  every ~125 ms (8/sec at BPM 120). Cost a debugging cycle in
  32d to figure out.


---

## Phase 33 — Tab Throttling Resilience

**Goal.** Plug the two main-thread holes Phase 32 didn't fix.
Both involved timers Chromium clamps on backgrounded tabs (~1 Hz
initially, dropping to once-per-minute after ~5 min of "intensive
throttling"); one caused real session teardowns, the other
caused a cosmetic UI flicker.

### What shipped

Two sub-phases, separate commits.

*33a — Heartbeat visibility gating (commit `f1d3751`).*

The bug. `AppShell.tsx`'s `/status` heartbeat (`setInterval(3000)`
+ per-tick `sendAndAwaitReply` with `timeoutMs = 2000`) ran
unconditionally on main. Under intensive throttling both timers
fired at most once per minute while `/status.reply` postMessages
piled up in the worker→main queue. On the next main-thread flush
the timer could fire before the matching reply landed; the
heartbeat then concluded "scsynth stopped responding" and ran
the full session teardown (`bank.dispose()` + `client.dispose()`
→ `'disconnected'`) against a perfectly healthy server.

Failure mode: leave a healthy session open in a backgrounded
tab for 5+ min, refocus, find yourself disconnected with a
toast claiming scsynth died.

The fix.
- Early-return inside `tick()` when
  `document.visibilityState !== 'visible'`. The setInterval still
  fires; the heavy work just skips. Bridge TTL (default 30 min,
  scans every minute) is the ground-truth aliveness check during
  background — we don't need a per-tab heartbeat for that.
- Add a `visibilitychange` listener that fires one tick on tab
  return so the footer status doesn't sit stale until the next
  3 s interval boundary.
- Bracketed the setInterval and listener cleanup in the existing
  useEffect teardown.

Minimal diff. No new state, no protocol change, just a guard +
a listener.

*33b — Clock watchdog into the worker (commit `fe85852`).*

The bug. `ClockController.startWatchdog` ran a `setInterval` at
~`tickInterval / 2` (~10 ms at default config) on main, calling
`recompute()` which read freshness via
`performance.now() - lastSignalAt`. `lastSignalAt` only updated
when a `clockTick` event drained from the worker→main postMessage
queue. Under throttling the watchdog fired late and saw a stale
`lastSignalAt`, falsely flipping `effectiveState` to `'paused'`.

Cosmetic only (audio was correct), but the symptom was wrong —
sclang never stopped — and the watchdog had the truth in the
wrong thread.

The fix.
- New `src/workers/clockWatchdog.ts` module: module-scoped state
  with `startClockWatchdog(tickIntervalMs)` /
  `stopClockWatchdog` / `recordClockTick` /
  `disconnectClockWatchdog`. Anchors `lastTickAt = Date.now()` on
  start; runs an unthrottled `setInterval` at
  `max(20, tickIntervalMs / 2)`; on each check, compares against
  `STARTUP_GRACE_MS = 500` (pre-first-tick) or
  `tickIntervalMs × 2` (post). Only emits `clockFreshness` events
  on fresh ↔ stale transitions, so a steady stream of ticks
  doesn't flood the message channel.
- `oscWorker.ts` calls `recordClockTick()` in the existing
  `/clock/tick` branch of `emitReply`, just before the existing
  `clockTick` post. Wires dispatch for the new
  `clockWatchdogStart` / `clockWatchdogStop` messages.
  `disconnectClockWatchdog` on the disconnect path.
- `WorkerClient` typed wrappers: `startClockWatchdog`,
  `stopClockWatchdog`, `onClockFreshness`.
- `ClockController` drops `startWatchdog` / `stopWatchdog` /
  `isTickFresh` / `TICK_STARTUP_GRACE_MS` / `lastSignalAt` /
  `watchdog` field. Adds private `freshTickObserved: boolean`
  populated by `handleFreshness`. `attach()` subscribes BEFORE
  calling `client.startClockWatchdog` so it doesn't miss the
  initial `fresh: true` event the worker posts on start.
  `detach()` stops the watchdog, unsubscribes, resets state.
  `recompute()` now reads `freshTickObserved` instead of calling
  `isTickFresh()`. `handleTick` no longer triggers `recompute` —
  that's redundant with the worker-driven freshness path.

Tests. New `src/workers/clockWatchdog.test.ts` — 9 tests:
initial fresh emission, stale transition past startup grace,
fresh re-transition on `recordClockTick`, deduplication of
repeated fresh events, post-first-tick allowance switching to
`tickIntervalMs × 2`, stop + disconnect lifecycle, pre-start
`recordClockTick` gracefully ignored, restart resets state.

### Decisions worth carrying forward

- **`Date.now()` over `performance.now()` for the watchdog
  window.** Vitest's fake timers advance `Date.now` deterministically
  but leave `performance.now` running on real wall-clock time —
  using `Date.now` keeps the tests deterministic. The freshness
  window is short (~40 ms at default config) so any NTP-adjustment
  drift between measurements is irrelevant in practice.
- **Bridge TTL is the ground-truth aliveness check during
  background.** A per-tab heartbeat is a UX nicety for the active
  user; the bridge TTL job (default 30 min) is the only reliable
  long-window detector. Don't try to keep the tab heartbeat
  running on hidden tabs — the trade-off is bad and the safety
  net already exists.
- **Worker emits only on transitions.** A steady stream of
  `/clock/tick`s should not produce a stream of `clockFreshness`
  events; consumers only need to know *when* state flips. The
  module-scoped `lastSentFresh` deduplicator is small enough that
  any future watchdog-style worker module should copy the
  pattern.
- **Subscribe BEFORE `startClockWatchdog`.** Order matters:
  worker emits `fresh: true` synchronously inside
  `startClockWatchdog`, so a listener attached after the call
  misses the initial state. `ClockController.attach` documents
  the order in a code comment.

### Gotchas

- **Heartbeat visibility check uses `document.visibilityState`,
  not `document.hidden`.** Both work, but `visibilityState` is
  the modern API and clearer at the call site
  (`!== 'visible'` reads as "not visible" for any reason —
  hidden tab, prerender, minimized window).
- **`recordClockTick` called pre-`startClockWatchdog` is a
  silent no-op.** A few `/clock/tick` events can decode in the
  worker between WS open and `ClockController.attach`'s
  `startClockWatchdog` call. Pre-start ticks update `lastTickAt`
  but don't emit (the start emit will).
- **Refresh-on-tab-return is one-shot.** `visibilitychange` →
  `visible` fires `tick()` once; the regular `setInterval`
  handles the rest. If the tab is visible for less than 3 s
  before being backgrounded again, that one tick may be the
  only refresh — fine for a footer status read.


---

## Phase 34 — Loopback Identity Hardening

**Goal.** Plug two attack vectors the Phase 25 webview-on-HTTP
shift opened. The bridge binds to 127.0.0.1, but loopback-binding
alone doesn't defend against (1) DNS rebinding — a hostile site
rebinding its DNS to 127.0.0.1 mid-session and using the still-
`attacker.com`-origin page to talk to the bridge — or (2) hostile
cross-origin WebSocket upgrades, since WS handshakes aren't
subject to the Same-Origin Policy in the way `fetch` is.

The fix in both cases is identity validation: reject any HTTP
request whose `Host` header doesn't name a loopback hostname,
and reject any WS upgrade whose `Origin` header (when present)
doesn't either.

### What shipped

Single-commit phase (`68c196c`) — both checks share the same
helper module so splitting them would have been artificial.

`src-tauri/src/server/security.rs` (new):
  - `host_is_allowed(host: &str) -> bool` — strips port, allows
    hostname ∈ `{127.0.0.1, localhost, ::1}`. Port is intentionally
    ignored: the bridge is loopback-bound so any port that
    reaches us is by definition a loopback port.
  - `origin_is_allowed(origin: &str) -> bool` — strips scheme
    + path, allows `http(s)://` loopback origins plus
    `tauri://localhost` (legacy Tauri builds, harmless).
  - `enforce_host` — axum middleware. Rejects **421 Misdirected
    Request** on mismatch (OWASP-recommended status code for
    DNS-rebinding rejection: "I am not the host you think you
    reached"). Rejects 400 on missing Host (HTTP/1.1 mandates
    it).
  - `check_ws_origin` — helper called from `ws_handler` and
    `ws_scope_handler`. Rejects 403 on present-and-mismatched.
    **Missing Origin is allowed** — browsers always send it on
    WS upgrade and the WebSocket JS API can't suppress it, so
    allowing missing-Origin doesn't weaken the browser-attack
    defense; it just lets curl-style debug clients connect.
  - Inline `#[cfg(test)]` module: 9 tests covering loopback-
    accepted (v4 / localhost / v6 forms), external-rejected,
    port-agnostic acceptance, scheme handling, path-stripping
    leniency, and the `tauri://localhost` legacy origin. All
    passing.

`src-tauri/src/server/mod.rs`:
  - Added `pub mod security;` (private to the `server` module —
    sibling-accessible only).
  - `serve_on()` layers
    `middleware::from_fn(security::enforce_host)` before
    `with_state` so every route — `/ws`, `/ws/scope`, `/api/*`,
    the static fallback — goes through the host check.
  - `ws_handler` gained a `headers: HeaderMap` extractor and
    calls `security::check_ws_origin(&headers)?` before the
    existing session lookup.

`src-tauri/src/server/ws_scope.rs`:
  - `ws_scope_handler` gained the same `HeaderMap` extractor.
    Since this handler returns `Response` directly (not
    `Result<Response, _>`), the rejection branch hand-converts
    via `(status, msg).into_response()`.

### Verification

Live smoke test against a running bridge on a free port:
  - `POST /api/session` with default `Host: 127.0.0.1:3457` —
    reaches handler (503 because scsynth wasn't running, but
    the request got through).
  - `POST /api/session` with `Host: attacker.com` — **421
    Misdirected Request**, middleware logs the rejection.
  - WS upgrade with `Host: 127.0.0.1:<port>` and
    `Origin: http://attacker.com` — **403 Forbidden**,
    middleware logs it.
  - WS upgrade with no Origin header (curl-style) — reaches
    handler, gets the expected "missing session UUID" 400.

`cargo build`, `cargo test` (Rust), `yarn test` (vitest),
`yarn tsc --noEmit` all green. No frontend changes — the
webview's Host and Origin already match the loopback allowlist
(`127.0.0.1:<port>` in Tauri release; `localhost:1420` via Vite
dev proxy).

### Decisions worth carrying forward

- **421 over 403 for the Host rejection.** OWASP's recommendation
  for DNS-rebinding rejection. Communicates "you've hit the
  wrong server" semantics; tools that retry on 5xx/4xx can
  branch on it. 403 would also work and is more familiar; the
  difference is mostly cosmetic.
- **Missing Origin on WS allowed.** The threat model is
  "hostile browser-side script", not "any non-browser
  connection". A native CLI tool on the same machine can talk
  TCP to 127.0.0.1 directly anyway; rejecting it at the WS
  layer adds friction without security benefit. Documented in
  the helper's docstring.
- **`tauri://localhost` allowed.** Pre-Phase-25 Tauri builds
  used the custom protocol; allowing the origin is cheap
  defensive coding for any hypothetical mixed-fleet scenario
  (a phase-25 bundle still served by a phase-34 bridge, etc.).
- **Port not validated.** The bridge binds loopback-only, so
  any port that reaches us IS a loopback port. Validating port
  would require config plumbing for the dev port (1420), the
  prod port (config-driven), and any sidecar ports — net
  complexity for zero security benefit.
- **TLS rejected as primary fix.** Considered: TLS would also
  defeat DNS rebinding (cert won't match `attacker.com` after
  rebinding). But: cert provisioning per install (mkcert helps,
  still adds setup), browser warnings on self-signed certs,
  doesn't compose cleanly with `yarn dev:full` (external
  browser), and doesn't help against same-machine non-browser
  callers anyway. Header validation is cheaper and more
  effective for the actual threat model.

### Gotchas

- **Vite dev proxy sets `Host: localhost:1420`, not
  `127.0.0.1:3000`.** Vite's `server.proxy` defaults to
  `changeOrigin: false`, so the original Host is forwarded.
  This is fine — `localhost:1420` passes the loopback check.
  But if a future change sets `changeOrigin: true`, the Host
  header would become the target's `127.0.0.1:3000`, which
  also passes. Either way works; just note that the Host the
  bridge sees in dev is NOT the bridge's own port.
- **Origin extractor must run before `WebSocketUpgrade`'s
  upgrade step.** The check_ws_origin helper reads HeaderMap
  in the handler signature, before `ws.on_upgrade(...)`, so
  rejection happens at the HTTP layer (browsers see a 403)
  rather than after the upgrade succeeds. Important: a 403
  upgrade-rejection reads as a clean failure to the JS
  WebSocket API; an upgrade-then-close reads as a connection
  drop and triggers reconnect logic.
- **Router layering order.** `enforce_host` is layered BEFORE
  `with_state(state)` in `serve_on`. This is correct in
  axum 0.8 — middleware doesn't care about state — but if a
  future refactor reorders things, the host check must stay
  outermost so it sees every route.
- **Bridge-only feature.** No frontend changes shipped; the
  validators live in src-tauri. The webview's Host (in
  release: `127.0.0.1:<port>` from the navigated URL) and
  Origin (same) already match the allowlist. If a future
  Tauri config were to navigate the webview to a non-loopback
  URL, that would break the validator — at which point the
  validator caught a real misconfiguration, which is the
  point.


---

## Phase 35 — In-Band Scope Chunks

**Goal.** Retire the per-scope `/ws/scope` WebSocket adopted in
Phase 31's post-shipping refactor (commit `dfeb924`) and put
scope chunk delivery back on the main `/ws` connection,
multiplexed by a one-byte op tag. Fundamentally a revert of
`dfeb924` (which itself reverted `b23f3bf`'s in-band design),
with one improvement: integer subscription IDs instead of
length-prefixed string `bufferId`s.

The per-scope WS gave us "subscription = WS lifecycle"
auto-cleanup at the cost of N WebSockets per session, separate
URL building, separate handshakes, separate Origin checks, and
a bigger worker-side state machine (per-`bufferId` WS map,
`mainWsUrl` capture, URL builder). For typical 1–4 active
subscriptions the trade-off was bad — the auto-cleanup property
isn't worth the protocol surface.

### What shipped

Single implementation commit (`469af08`); plan + close commits
bracket it as usual.

#### Wire format on the main `/ws`

Multiplexed by **first byte**:

| Byte | Direction | Meaning |
|---|---|---|
| `/` (0x2F) | both | OSC message |
| `#` (0x23) | both | OSC bundle (`#bundle\0`) |
| 0x01 | main → bridge | Subscribe |
| 0x02 | main → bridge | Unsubscribe |
| 0x03 | bridge → main | Chunk |

OSC frames always start with `/` or `#`, so 0x01..0x03 are
unambiguous discriminators. Frame layouts (all little-endian,
packed):

```
0x01 subscribe    [op:u8 | sub_id:u32 | scope:u32 | channels:u32 | chunk:u32]
0x02 unsubscribe  [op:u8 | sub_id:u32]
0x03 chunk        [op:u8 | sub_id:u32 | tick:u32 | is_gap:u8 |
                   channels:u8 | frames:u32 | float32 payload…]
```

`sub_id` is minted by the worker on subscribe — a monotonic
`u32` counter local to the worker. The bridge never interprets
it (just echoes it back on chunk frames). The worker keeps a
small `Map<sub_id, bufferId>` to dispatch incoming chunks back
to main-thread listeners.

#### Bridge side

`src-tauri/src/server/ws_bridge.rs` (~250 lines re-added):
  - Per-WS `ScopeContext` struct: lazily-populated `Arc<ScopeShm>`
    (shared with the session's `scope_shm` `OnceCell`) +
    `HashMap<u32, ScopeSubscription>` keyed by `sub_id`.
  - WS recv loop now peeks the first byte of each binary frame
    and dispatches: 0x01 → `handle_scope_subscribe` (decodes
    sub_id/scope_idx/channels/chunk_size, ensures the
    session-level mmap on first call, inserts into the per-WS
    map); 0x02 → `handle_scope_unsubscribe` (removes from the
    map); otherwise → existing OSC forward path.
  - The default-route forwarder is now
    `forward_default_route`, a specialization of
    `forward_broadcast` that additionally peeks each broadcast
    payload for `/clock/tick`. On hit, polls
    `read_scope_slot(scope_idx)` for every active subscription
    on this WS via `poll_scope_chunks`, and emits 0x03 chunk
    frames for those whose `_stage` advanced. Non-default-route
    forwarders (e.g. for `/dirt → :57120`) keep using the
    plain `forward_broadcast`.
  - **WS-close cleanup is explicit.** `ScopeContext` is owned
    by `handle_ws_session`'s scope (not on the `Session`); it
    drops when the function returns. `forwarder_tasks.abort()`
    at end-of-function stops the polling/forwarding tasks.
    A `tracing::debug` line at the cleanup point names
    `session_id` + count of subscriptions dropped, so the
    cleanup is visible in logs. The session-level
    `scope_shm: OnceCell` stays alive across the WS close —
    other WSs on the same session keep using it.

`src-tauri/src/server/ws_scope.rs` — deleted. `mod.rs` drops
`pub mod ws_scope;` and the `/ws/scope` route from the axum
router.

`src-tauri/src/server/session.rs` — unchanged. `scope_shm:
OnceCell<Arc<ScopeShm>>` stays as the per-session lazy mmap.

`src-tauri/src/scope_shm.rs` — unchanged. `read_scope_slot`,
`MmapRegion`, `find_scope_buffer_array` all reused.

#### Worker side

`src/workers/scopeWire.ts` rewritten:
  - `SCOPE_OP_{SUBSCRIBE, UNSUBSCRIBE, CHUNK}` constants.
  - `isScopeFrame(bytes)` peek helper — used by `oscWorker` to
    discriminate at the WS recv boundary.
  - `encodeSubscribe(subId, params)` / `encodeUnsubscribe(subId)` —
    the worker's outbound encoders.
  - `decodeChunk(bytes) → DecodedScopeChunk` — inbound decoder
    with format validation. Pre-35's `decodeScopeFrame` (per-WS
    layout) is gone.

`src/workers/oscWorker.ts`:
  - Dropped `scopeWebSockets` map, `mainWsUrl` capture (no
    longer needed — no per-scope WS to build URLs for),
    `buildScopeWsUrl`, `openScopeWs`, `closeScopeWs`,
    `closeAllScopeWs`.
  - Added `subIdByBufferId: Map<string, number>` and
    `bufferIdBySubId: Map<number, string>` plus a `nextSubId`
    u32 counter.
  - `handleInboundBytes(bytes)`: peek first byte; if scope
    frame, `decodeChunk` + post `bufferChunk` to main with the
    Float32Array transferred. Otherwise OSC decode path.
  - On `subscribeBuffer`: assign sub_id, encode 0x01 frame,
    `transport.send`. If a stale sub_id exists for the same
    bufferId (consumer restarted), send a 0x02 first to keep
    the bridge's state consistent.
  - On `unsubscribeBuffer`: encode 0x02, drop both maps.
  - On `disconnect`: `clearScopeSubscriptions()` resets the
    maps + counter.

`src/server/workerProtocol.ts` — unchanged. `BufferSubscription`
and `BufferChunk` shapes stay (the wire change is below the
worker→main API).

#### Tests

3 new Rust unit tests in `ws_bridge::tests`:
  - `chunk_frame_layout` — round-trips a known chunk through
    `encode_chunk` and asserts header byte positions match the
    spec the worker decodes from. Catches accidental drift
    between bridge and worker layouts.
  - `chunk_frame_is_gap_flag` — verifies the gap byte position.
  - `first_byte_dispatch_unambiguous_with_osc` — asserts
    SCOPE_OP_{SUBSCRIBE, UNSUBSCRIBE, CHUNK} all differ from
    `/` and `#`. Locks in the dispatch invariant.

22/22 Rust tests pass; 17/17 frontend tests pass.

#### Live verification

Smoke-tested against a started bridge:
  - `/api/scope/probe` still 200 with the mmap details.
  - `/ws/scope` route is gone; falls through to the SPA static
    fallback (200 with `index.html` — clean 404-equivalent for
    a removed route in an SPA-fallback router).
  - Main `/ws` still 400s without `?session=<uuid>`.

### Decisions worth carrying forward

- **Integer `sub_id` over string `bufferId` in the wire.** The
  worker mints; the bridge echoes. ~30+ bytes saved per chunk
  frame (and millions of chunks per session). Cleaner protocol
  shape — bridge never has to interpret an opaque consumer-side
  identifier. The string `bufferId` stays at the worker→main
  API boundary, where it identifies the consumer-facing handle.
- **Default-route forwarder owns SHM polling.** All scope state
  lives next to the broadcast subscription that observes
  `/clock/tick`. One task per WS handles both
  forward-OSC-replies and emit-scope-chunks; the SHM poll is
  driven by the same channel that already wakes us up on each
  tick.
- **No 35a/b/c sub-phasing.** Bridge changes, worker changes,
  and `scopeWire.ts` rewrite are tightly coupled — a partial
  commit would break the wire. One implementation commit, full
  green at every boundary.
- **Idempotent subscribe/unsubscribe.** Replacing an existing
  `sub_id` logs a warning + replaces (the worker shouldn't ever
  send duplicates, but defensive coding is cheap). Removing an
  unknown `sub_id` is a debug-level no-op.

### Gotchas

- **WS-close cleanup is no longer automatic.** The per-scope WS
  gave us "WS lifetime = subscription lifetime" for free. Phase
  35 needs the explicit `ScopeContext` drop at end-of-`handle_ws_session`
  to release the per-WS subscription state. That works because
  the context is owned by the function's stack frame; if a
  future refactor moves it onto the `Session` (shared across
  WSs), audit the cleanup story carefully.
- **Forward-OSC-then-poll-SHM ordering.** The default-route
  forwarder sends the OSC reply to the WS first, THEN polls
  SHM. This means the worker observes `/clock/tick` slightly
  before the chunk frame for that tick — convenient for the
  worker's clock-watchdog, which records the tick on the OSC
  decode path before any chunk arrives. Reversing the order
  (chunk first, OSC second) would be wire-correct but would
  invert the clock-watchdog's freshness anchoring by ~one
  network hop's worth of latency.
- **Lock granularity.** `ScopeContext` is `Arc<TokioMutex>`;
  `poll_scope_chunks` holds the lock across the entire SHM-poll
  loop. At ~47 Hz with O(1) work per subscription this is
  comfortable, but if subscription counts ever grow into the
  hundreds it'd be worth profiling for lock contention vs the
  recv-loop's subscribe/unsubscribe path.
- **Chunk frames interleave with broadcast OSC payloads on the
  same WS sink.** The forwarder takes the WS-sink mutex twice
  per `/clock/tick` cycle (once for the OSC reply, once for the
  chunk batch). Worst case is N scope subscriptions all on the
  same WS, all advancing at the same tick — that's still one
  mutex acquisition for the whole batch, not N separate
  acquisitions.

## Phase 36 — OSC Fallback for Scope Data

**Goal.** Restore a `/b_getn`-based fallback path for scope and
recording data when SHM isn't accessible — remote scsynth on a
different machine, scsynth booted with SHM disabled, exotic
deployment. Pre-Phase-31 the OSC scope-data path lived in the
TS worker; per the post-35 design discussion, the new fallback
lives in the Rust bridge so the worker stays uniform across
modes.

The frontend can't be entirely mode-blind — the SC side has to
write data somewhere the bridge can read it, and SHM-write
(`ScopeOut2.ar`) vs OSC-fallback-write (`BufWr.ar`) are
different UGens, hence different SynthDefs. The frontend
branches at the SynthDef + buffer-allocation step in
`BufferController.start()`. The wire format on `/ws`
(0x01/0x02/0x03) and the worker stay uniform; the bridge picks
SHM or OSC poll under the hood based on a per-session
`ScopeMode`.

### What shipped

Four sub-phases (`fe6aa62`, `510088f`, `fffbacf`, plus this
closer); plan + close commits bracket as usual.

#### Architecture (dual-mode)

```
At session create:
  Bridge probes /tmp/boost_interprocess/SuperColliderServer_<port>
  → Session.scope_mode = ScopeMode::Shm | ScopeMode::Osc
  /api/scope/probe response includes a `mode` field
  --no-shm CLI flag forces ScopeMode::Osc regardless of probe

At BufferManager.acquire():
  Frontend reads probe.mode (cached at bootstrap)
  if Shm:
    /scope/allocate → /s_new bufferTap (ScopeOut2.ar) → 0x01 subscribe
    bridge polls SHM on /clock/tick                    → 0x03 chunks
  if Osc:
    /b_alloc → /s_new bufferTapOsc (BufWr.ar)          → 0x01 subscribe
    bridge polls /b_getn on /clock/tick (intercepts
    /b_setn replies, parses, encodes)                   → 0x03 chunks
```

The 0x01 subscribe frame's `scope:u32` field is reused: it's a
scope-buffer index in SHM mode and a bufnum in OSC mode. The
bridge interprets it per `Session::scope_mode`. The worker
never knows the difference.

#### Bridge changes (36a + 36b)

`src-tauri/src/server/session.rs`:
  - New `ScopeMode` enum (`Shm | Osc`), `Serialize` via
    `#[serde(rename_all = "lowercase")]`.
  - `Session` struct gains `scope_mode: ScopeMode`. Frozen at
    create time — never changes for the session's lifetime.
  - `Session::create` takes `force_osc_mode: bool`. Probes
    `scope_shm::probe(default_addr.port())` when not forced;
    picks `Shm` if available, `Osc` otherwise. Logs the chosen
    mode.
  - `SessionInfo` gains `scope_mode` field (camelCase JSON:
    `scopeMode`).

`src-tauri/src/server/api.rs`:
  - `post_session` passes `state.force_osc_mode` through.
  - `/api/scope/probe` envelope extends with `mode: 'shm' |
    'osc'`. Separate from `available` so frontend can
    distinguish "SHM works but bridge was told to use OSC"
    from "SHM doesn't work, fallback".

`src-tauri/src/server/mod.rs` + `cli/{bridge,gui,mod}.rs`:
  - `AppState` gains `force_osc_mode: bool`.
  - `serve_on` / `run_bridge` propagate it.
  - `bridge` subcommand learns `--no-shm` flag. Forces OSC mode
    regardless of probe. Boot log line names the flag when set.
  - GUI mode hardcodes `force_osc_mode = false` (same machine;
    SHM always reachable).

`src-tauri/src/scope_osc.rs` (new, ~530 lines, 11 unit tests) —
the OSC poll engine:
  - `OscScopeSubscription { sub_id, bufnum, channels,
    chunk_size, tick_index, pending_offset, last_was_gap }`.
    `pending_offset` enforces "one outstanding read per
    subscription" — late `/b_setn` replies for stale offsets
    drop silently; the next tick fires fresh.
  - `compute_read_window(tick_index, chunk_size)`: derives
    `(offset, count)` via the `((N-2) % 2)` parity formula.
    "Impulse.kr fires at t=0; tick N corresponds to audio frame
    `(N-1)*chunkSize`; the just-completed half is
    `((N-2) % 2)`". First two ticks return `None` — no half
    written yet.
  - `encode_bgetn_bundle(bufnum, offset, count, now_ms)`:
    hand-rolls an OSC bundle with `timetag = now +
    READ_DELAY_MS (5 ms)`. Strict OSC 1.0 big-endian wire
    layout: `"#bundle\0"` + `ntp_timetag:u64` + `inner_size:u32`
    + bare `/b_getn` message (`"/b_getn\0"` + `",iii\0\0\0\0"` +
    `bufnum:i32` + `offset:i32` + `count:i32`). NTP epoch
    offset (1900 → 1970 = `2_208_988_800` sec) + 32-bit
    fraction in the lower half of the timetag word.
  - `parse_bsetn(bytes)`: validates address starts with
    `"/b_setn\0"`, walks the `",iii"`-prefixed type tag,
    extracts `bufnum + offset + count`, returns a slice over
    the float payload. **Strict OSC alignment** — no
    over-padding tolerance, since that breaks integer payloads
    with leading zero bytes.
  - `decode_bsetn_floats(bytes)`: chunks the raw float bytes
    4-by-4, big-endian to f32.
  - `encode_chunk(sub_id, tick, is_gap, channels, frames,
    floats)`: produces 0x03 chunk frames identical byte-for-byte
    to the SHM path's `encode_chunk` in `ws_bridge`. The worker
    decoder doesn't distinguish.
  - `parse_clock_tick_index(payload)`: extracts the
    `PulseCount` value from a `/clock/tick` payload. Tolerates
    either `",iii"` or `",iif"` type tag — `PulseCount` can
    serialize as int OR float depending on the UGen graph
    type.
  - `OscPollState`: per-WS subscription map;
    `find_by_bufnum_mut` for `/b_setn` dispatch.

`src-tauri/src/server/ws_bridge.rs`:
  - `ScopeContext` gains a dual-mode shape: `shm_subs:
    HashMap<u32, ShmScopeSubscription>` (renamed from the
    Phase-35 single-mode `ScopeSubscription`) +
    `osc: OscPollState`. `total_subs()` sums both for the
    WS-close cleanup log.
  - `handle_scope_subscribe` / `handle_scope_unsubscribe`
    branch on `session.scope_mode`. The 0x01 frame's `scope`
    field is the scope_idx (SHM) or bufnum (OSC) — frontend
    chooses.
  - `forward_default_route` gains a `/b_setn` intercept arm
    (`try_intercept_bsetn`): in OSC mode, a `/b_setn` whose
    bufnum matches a subscribed bufnum is decoded into a 0x03
    chunk frame and **suppressed** from the WS forward path.
    Non-matching `/b_setn` forwards as a normal OSC reply
    (worker discards).
  - On `/clock/tick`, dispatches by mode: SHM →
    `poll_scope_chunks` (existing); OSC →
    `issue_bgetn_for_subs` (new) which fires `/b_getn` bundles
    for each subscription whose previous read has settled.
    In-flight reads at tick boundary are dropped + marked
    `is_gap=true` on the next chunk.
  - `issue_bgetn_for_subs` collects work under the lock then
    sends UDP after release, so a slow socket doesn't block
    the recv loop.

`src-tauri/src/lib.rs` registers `pub mod scope_osc`.

#### sclang startup script (36a)

`scripts/lib/clock.scd`:
  - Brings back `Bus.audio(s, 1)` allocation.
  - SynthDef regains the `Phasor.ar` wrapping every
    `2 × chunkSize` samples and the `Out.ar(clockBus,
    samplePhase)`.
  - `clockBus` is a SynthDef arg passed at `/s_new`.
  - `/clock/info` reply carries the `clockBus` index again.
  - Boot-log line includes the bus index.
  - Cost on scsynth: one extra `Out.ar` per audio block —
    negligible. SHM mode ignores it; OSC mode reads it.

The post-34 tidy that retired `clockBus` was correct at the
time (no consumer); Phase 36's OSC fallback brings the
consumer back. Documented as a clean revival rather than a
rewrite of the cleanup story.

#### Frontend changes (36a + 36c)

`src/clock/clockClient.ts` + `src/clock/ClockController.ts`:
  - `ClockInfo` regains `clockBus: number`. Parser entry +
    getter restored. `AppShell.tsx`'s clock-attach debug log
    includes `clockBus` again.

`src/scope/scopeClient.ts`:
  - `ScopeMode` type alias.
  - `ScopeShmProbe` gains `mode: ScopeMode`.
  - `probeScopeShm()` back-compat default for older bridges
    (mode missing → derive from `available`).

`src/synthdefs/bufferTapOscSynthDef.ts` (new, ~100 lines):
  - Sibling of `bufferTapSynthDef`. Same `(channels,
    chunkSize)` cache key.
  - Reads `In.ar(clockBus, 1)` to get the global
    sample-counting Phasor; computes `writeIdx = clockPhase
    % (2 × chunkSize)` via `g.mod(…)` (BinaryOpUGen `\mod`),
    wrapping `clockPhase` into a 2-half ring index.
  - `BufWr.ar(sigs, bufnum, writeIdx)` writes interleaved
    channel frames into the half. The bridge polls the
    *opposite* half (the just-completed one) via `/b_getn`.
  - SynthDef controls: `inBus`, `bufnum`, `clockBus`.

`src/buffer/BufferController.ts`:
  - `BufferControllerOptions` gains `mode: ScopeMode`,
    `clock: ClockController`, `ids.buffer: IdAllocator`. Both
    modes are valid acquire targets now.
  - `start()` splits into `startShm()` and `startOsc()`.
    - `startShm`: existing path, no behavior change.
    - `startOsc`: `/b_alloc bufnum (chunkSize × 2) channels`
      → `compileBufferTapOscSynthDef` + `ensureLoaded` →
      `/s_new bufferTapOsc { inBus, bufnum, clockBus }` →
      `client.subscribeBuffer({ scopeNum: bufnum, … })` —
      the wire 0x01 frame's `scope` field carries `bufnum` in
      OSC mode.
  - `dispose()` branches the buffer-free step: SHM →
    `/scope/free` (fire-and-forget, no reply); OSC → `/b_free`
    (fire-and-forget; `/done /b_free` unawaited since we're
    tearing down).
  - `scopeNumStore` comment notes its dual meaning
    (`scope_idx` in SHM, `bufnum` in OSC) — same store,
    `BufferManager.snapshot` reads it identically.

`src/buffer/BufferManager.ts`:
  - `BufferManagerOptions` gains `ids.buffer: IdAllocator` and
    `clock: ClockController`.
  - `acquire()` drops the "reject if SHM unavailable" gate.
    Both modes are valid; the controller picks based on cached
    `probe.mode`. The probe still runs at first acquire (HTTP
    breakage surfaces here); the gate just no longer rejects.
  - `spinUp` passes `mode = this.shmProbe?.mode ?? 'osc'` (the
    back-compat default for missing-mode fields from
    pre-Phase-36 bridges).

`src/AppShell.tsx`:
  - Resurrects `IdAllocator(buffer)`: one per session, base
    `clientId * 1_000_000 + 5000`. Offset above the node
    range to avoid intra-allocator confusion in the debug
    log; scsynth doesn't enforce per-client bufnum ranges so
    any base works, but per-clientId scoping prevents
    collisions with SuperDirt's own buffer usage in
    shared-server deployments.
  - `DashboardResources.ids` gains `buffer: IdAllocator`.
  - `BufferManager` construction passes `ids.buffer + clock`.

#### Tests

11 new Rust unit tests in `scope_osc::tests`:
  - Read-window first-tick skip (returns None for tick<2).
  - Parity formula correctness across multiple tick indices.
  - `/b_getn` message + bundle layout round-trip (encode →
    parse → equal bytes; locks in big-endian + NTP timetag).
  - `/b_setn` parse round-trip.
  - `/b_setn` rejects other addresses (strict prefix match).
  - Clock tick index parses with both `",iii"` and `",iif"`
    type tags.
  - `osc_align(n)` — pads to next multiple of 4.
  - `find_by_bufnum_mut` returns the right entry under
    multi-subscription state.
  - Chunk frame layout matches SHM path's `encode_chunk` byte
    layout — catches drift between modes.

Plus 2 existing `ws_bridge::tests` (chunk frame layout / gap
flag / dispatch unambiguous) gain coverage for the renamed
`ShmScopeSubscription`.

`cargo test --lib`: 35 passed (was 22; +11 from `scope_osc`,
+2 from existing).

Frontend: `yarn tsc --noEmit` clean; `yarn test` 17/17;
`yarn build` clean.

#### Live verification

- `bridge --no-shm` boots, logs `--no-shm: forcing OSC
  /b_getn fallback mode for all sessions`.
- `/api/scope/probe` returns `{"available":true,"error":null,
  "mode":"osc","path":"/tmp/..."}` with the flag set,
  `mode:"shm"` without.
- End-to-end OSC mode (scope a synth bus with `--no-shm`,
  observe waveform) requires a running scsynth + frontend
  smoke test; compile-time wiring is verified by the unit
  tests + tsc + cargo build.

### Decisions worth carrying forward

- **Per-session mode, not per-WS or per-subscription.** Probed
  once at `Session::create` and frozen for the session's
  lifetime. Mid-session mode change is unsupported — if SHM
  availability changes (rare), the user has to refresh, which
  mints a new session. Simplifies the bridge state machine
  enormously: no mode-transition logic, no in-flight migration
  from one tap-synth shape to the other.
- **Reuse the 0x01 wire frame's `scope:u32` field.** No new
  frame variant. The bridge interprets it as scope_idx (SHM)
  or bufnum (OSC) per session mode. The frontend chose the
  right value at the controller layer; the worker is
  mode-blind.
- **`bridge --no-shm` CLI flag.** Forces OSC mode regardless
  of probe. Useful for testing OSC fallback locally without
  disabling SHM at the OS layer (or rebooting scsynth).
  GUI mode hardcodes `force_osc_mode = false` (same machine,
  SHM always reachable).
- **clockBus revival is unconditional.** Sclang's clock
  SynthDef publishes `Out.ar(clockBus, …)` whether anyone
  reads it or not. SHM mode ignores it; OSC mode reads it.
  Cost is one `Out.ar` per audio block — negligible. Avoids
  a "two clock SynthDefs" or "feature-flag the clockBus
  publish" branching mess.
- **Hand-rolled OSC encoding in `scope_osc.rs`** rather than
  pulling rosc into the hot path. The bundle shape is tiny
  and fixed (`#bundle\0` + 8-byte timetag + 4-byte inner
  size + ~32-byte `/b_getn` message); rosc encode would
  allocate twice and we'd still need the strict-alignment
  parser for `/b_setn`. Bytes-on-wire are easier to match
  in tests anyway.
- **Strict OSC alignment in `parse_bsetn`.** OSC 1.0 spec
  requires every datum to be padded to a 4-byte boundary; my
  initial implementation tried to be lenient by skipping
  leading zeros, which broke integer payloads like `0` or
  `256`. Reverted to strict alignment + the test data was
  fixed (it had over-padding from a misreading of the spec).
- **Sub-phasing.** 36a (probe + advertise mode, no behavior
  change) sets up the surface area; 36b (OSC poll engine
  in Rust) is dead code until 36c flips the frontend; 36c
  flips the frontend; 36d closes. Each commit is testable
  in isolation: 36a = probe returns `mode`; 36b = `cargo
  test --lib` covers the protocol primitives; 36c = OSC
  mode actually exercises end-to-end.

### Gotchas

- **Mode is frozen at session create.** No mid-session
  transitions. If SHM probe failed (e.g. permission timing
  glitch) the session is locked into OSC mode for its TTL
  window. User-visible: refreshing the tab mints a new
  session and probes fresh. TTL eviction (default 30 min)
  catches abandoned wrong-mode sessions.
- **OSC fallback caps at ~250 Hz tick rate.**
  `READ_DELAY_MS = 5 ms` (the `/b_getn` bundle timetag shift,
  matches pre-31) needs to fit inside `tickInterval`. At tick
  rates above 200 Hz the budget shrinks; above 250 Hz scsynth
  starts logging `late 0.0XX` warnings and chunks may arrive
  after the writer has overwritten their ring half. SHM mode
  has no equivalent ceiling. The chunkSize × sampleRate table
  in `CLAUDE.md` marks the affected cells with ⚠OSC.
- **The 0x01 subscribe frame's `scope:u32` field is
  mode-overloaded.** Bridge interprets it as scope_idx (SHM)
  or bufnum (OSC) based on `Session::scope_mode`. If a future
  refactor adds a third mode, this field will need
  disambiguation (e.g. via a per-mode subscribe frame variant)
  rather than further overloading.
- **`/b_setn` interception is per-WS, by bufnum.** The
  `forward_default_route` task inspects each broadcast OSC
  reply for `/b_setn`, decodes bufnum, and looks it up in the
  WS's `OscPollState`. Match → suppress + emit chunk. No match
  → forward as normal OSC reply. Cost is one address peek per
  broadcast payload per WS — same shape as the `/clock/tick`
  peek, so cheap.
- **`pending_offset` is "at most one outstanding read per
  subscription".** Late `/b_setn` replies for stale offsets
  drop silently; the next tick fires fresh and marks
  `is_gap=true` on the resulting chunk. If we ever needed
  to recover the dropped data, we'd need a `HashMap<offset,
  PendingRead>` shape like the pre-31 worker had — but
  in-flight reads at tick boundary are rare (only happen
  under load) and a single dropped chunk is acceptable.
- **`PulseCount` type tag varies (`",iii"` vs `",iif"`).**
  Depending on the UGen graph type at the SendReply boundary,
  scsynth serializes the count as int OR float.
  `parse_clock_tick_index` tolerates both. Tested.
- **Hand-rolled NTP timetag.** `seconds = unix + 2_208_988_800`
  (1900 → 1970 epoch shift); `fraction =
  (millis_remainder / 1000) × 2^32`. Test
  `bgetn_bundle_round_trip` locks in the byte layout against
  regression.
- **clockBus is back unconditionally.** `scripts/lib/clock.scd`
  now allocates `Bus.audio(s, 1)`, runs `Phasor.ar` + `Out.ar`,
  and publishes the bus index in `/clock/info`. SHM mode
  ignores it; OSC mode requires it. The post-34 tidy that
  retired it was correct at the time (no consumer); Phase 36
  re-adds the consumer.
- **`IdAllocator(buffer)` is back.** Base `clientId *
  1_000_000 + 5000`. Used only in OSC mode for `/b_alloc`,
  but constructed unconditionally — cheap. SHM mode never
  touches it.

## Phase 37 — Regex Routing + Address-Keyed Middlewares

**Goal.** Replace the prefix-based routing table + implicit
catch-all with a regex-based routing table that explicitly
enumerates scsynth's command surface. Add an address-keyed
middleware dispatch layer that runs *before* routing on both
directions (WS → bridge → UDP and UDP → bridge → WS). Middlewares
can claim addresses that aren't in the routes table (e.g.,
`/scope/subscribe`) or observe addresses that pass through
(e.g., side-effect on `/clock/tick`). Sets the infrastructure
for Phase 38, where the scope wire format goes pure OSC.

Wire format on `/ws` is unchanged in 37 — the binary
0x01/0x02/0x03 scope frames still flow byte-for-byte identically
to pre-37. The change is internal architecture only.

### What shipped

Three sub-phases (`d70df46`, `ad500bd`, `067f25c`); plan + close
commits bracket as usual.

#### Routing config

`Route { prefix: String }` → `Route { pattern: String }` in
`src-tauri/src/config.rs`. The `pattern` is compiled with the
`regex` crate at `RoutingTable::build` time; a malformed pattern
is a startup error.

The starter config seeds **two regex entries**, no `.*`
catch-all:

```jsonc
{
  "routes": [
    { "pattern": "^/(dirt|clock|scope)(/|$)", "target": "127.0.0.1:57120" },
    { "pattern": "^/([sngbcdpu]_|notify|status|sync|cmd|dumpOSC|clearSched|error|quit)",
      "target": "127.0.0.1:57110" }
  ]
}
```

The first entry routes the SuperDirt-process responders
(`/dirt`, `/clock`, `/scope` subtrees, anchored with `(/|$)` to
avoid over-matching `/dirts/extra`). The second covers scsynth's
command surface — the `[sngbcdpu]_` alternation matches the
`/s_*`, `/n_*`, `/g_*`, `/b_*`, `/c_*`, `/d_*`, `/p_*`, `/u_*`
families plus the named global commands (`/notify`, `/status`,
`/sync`, etc.).

If a packet's address matches no `routes` entry **and** no
middleware claims it, the bridge drops it with a `warn!` log
naming the address — no implicit fallback to scsynth. Pre-Phase-37
configs with the legacy `prefix` field fail loudly at load via
`deny_unknown_fields`; the user gets an explicit error, not a
silent migration.

`RoutingTable::route_for` returns `Option<SocketAddr>` — the
no-match case is now in the type. `default_target()` and
`set_default()` are gone.

#### Middleware dispatch

Two registries — outbound and inbound — each
`Vec<(Regex, Middleware)>` walked top-down. Dispatch order on
each direction:

```
Outbound (WS → bridge → UDP):
  1. peek_osc_address(payload)
  2. for (regex, mw) in outbound_middlewares:
       if regex.matches(address): outcome = mw.handle(ctx, ...)
         Consumed              → stop
         ConsumedAndSend(b)    → route `b`; stop
         PassThrough           → break, fall through
  3. routes.route_for(address):
       Some(target) → UDP send
       None         → drop + warn

Inbound (UDP → bridge → WS):
  1. peek_osc_address(payload)
  2. for (regex, mw) in inbound_middlewares: ...same shape...
  3. ws_sink.send(payload)  (default: forward as-is)
```

`MiddlewareOutcome::PassThrough` IS the "call next()" semantics —
the user's Express-style "callback accepting a next function"
intent is honored via the return-value enum, dodging async + dyn
+ mutable-borrow gymnastics.

The `MiddlewareRegistry` is generic over the variant enum
(`OutboundMiddleware` / `InboundMiddleware`). The dispatcher's
`invoke_*` functions match on the variant and call the body
directly — function pointers, no boxing.

`WsCtx<'_>` is the per-call context. Built by the dispatcher
from already-acquired locks/borrows; the handler holds it for
one packet only. Fields:
- `session: &Arc<Session>`
- `scope: &mut ScopeContext` (per-WS, locked at the dispatch site)
- `direction: Direction` (Outbound | Inbound; currently unused
  by handlers, kept for future)
- `source_target: Option<SocketAddr>` (inbound only)
- `ws_extras: Vec<Vec<u8>>` — side-channel: bytes the dispatcher
  should send to the WS sink AFTER the middleware returns. Used
  by middlewares that emit multiple frames per call (e.g.
  one-chunk-per-active-sub on `/clock/tick`).
- `udp_extras: Vec<(SocketAddr, Vec<u8>)>` — side-channel: UDP
  packets to send AFTER the middleware returns. Used by
  middlewares that fire UDP as a side effect (e.g. `/b_getn`
  issuance on `/clock/tick`).

The dispatcher drains both side-channels post-dispatch. The
broadcast forwarder skips the lock acquisition entirely when
`registry.iter_matching(address).next().is_none()` — most
addresses (e.g. `/done`, `/dirt/listSamples.reply`) don't match
any middleware regex and pass through without touching the scope
context.

#### Scope middleware bodies (37c)

Pre-37 the scope dispatch logic lived inline in
`server/ws_bridge.rs` (~440 lines: `ScopeContext`,
`ShmScopeSubscription`, `handle_scope_subscribe`,
`handle_scope_unsubscribe`, `forward_default_route`,
`try_intercept_bsetn`, `issue_bgetn_for_subs`,
`poll_scope_chunks`, `encode_chunk`). Phase 37c relocates the
bodies into `src-tauri/src/scope/middleware.rs`.

| Middleware variant | Direction | Address regex | Behavior |
|---|---|---|---|
| `ScopeChunkEmitOnTick` | inbound | `^/clock/tick$` | SHM mode only. Polls SHM for active subs; pushes 0x03 chunk frames to `ws_extras`. Returns `PassThrough` so the tick still reaches the WS. |
| `ScopeBgetnIssueOnTick` | inbound | `^/clock/tick$` | OSC mode only. Pushes `/b_getn` bundles to `udp_extras`. Returns `PassThrough`. |
| `ScopeInterceptBsetn` | inbound | `^/b_setn` | OSC mode only. Bufnum match → `ConsumedAndSend(chunk_bytes)`. No match → `PassThrough` (forwards as a normal OSC reply). Stale offsets → `Consumed` (drop). |

The 0x01 / 0x02 binary subscribe/unsubscribe frames bypass the
OSC-address-keyed middleware system (they're not OSC). The recv
loop's first-byte branch calls into
`scope::middleware::ws_scope_{subscribe,unsubscribe}_binary`
directly — same handler bodies that Phase 38 will dispatch to
via outbound middleware once they become OSC messages.

`OutboundMiddleware` enum stays at the `_Phantom` placeholder in
37c. Phase 38 adds `Scope` variants for `/scope/subscribe` and
`/scope/unsubscribe`.

#### scsynth_addr plumbing

`Session::create` no longer derives the handshake socket from
`routes.default_target()` (the routing table has no default).
Instead it takes `scsynth_addr: SocketAddr` as a parameter.
`AppState` gains a `scsynth_addr` field; `serve_on` /
`run_bridge` plumb it through; `cli/bridge.rs` and `cli/gui.rs`
read from `cfg.scsynth` (or the `SC_SCSYNTH_ADDR` env / built-in
default). The address gets added to `unique_targets` if not
already there so a UDP socket exists for the handshake.

`/api/scope/{probe,layout,debug,headers}` previously read the
SHM port from `state.routes.default_target().port()`; now they
read from `state.scsynth_addr.port()`.

#### ws_bridge.rs shape

From ~800 lines down to ~370. The remaining content is pure WS
plumbing:
- `handle_ws_session`: split + lock the WS, build the per-WS
  middleware registries (calling `scope::middleware::
  register_inbound_middlewares` for the scope-mode-appropriate
  inbound entries), spawn one forwarder per broadcast target,
  run the recv loop.
- `handle_outbound_osc`: peek address, dispatch outbound (skips
  the lock if registry is empty), default-route via
  `routes.route_for`, send UDP. Orphan addresses drop+warn.
- `forward_with_dispatch` / `forward_one_payload`: per-target
  broadcast forwarder. Dispatches inbound (locks only if a
  matching middleware exists), drains `ws_extras` to the WS
  sink, drains `udp_extras` to the right per-target socket.

The pre-37 split between `forward_default_route` (scsynth
forwarder, peeked for `/clock/tick` and `/b_setn`) and
`forward_broadcast` (everything else, pass-through) collapses
into the unified `forward_with_dispatch` — every forwarder runs
the dispatcher uniformly.

#### Tests

- `routing::tests` rewritten for regex semantics. 7 tests:
  - `peek_address_bare_message`, `peek_address_in_bundle`,
    `peek_address_truncated_bundle_returns_none` (carried over).
  - `route_for_basic_match`, `route_for_no_match_returns_none`,
    `route_first_match_wins`,
    `route_anchored_prefix_doesnt_overmatch` (regex-specific).
  - `route_scsynth_command_surface_matches` (locks in the
    starter scsynth regex's coverage).
  - `unique_targets_deduplicates`.
- `config::tests` gains
  `pre_phase_37_prefix_field_rejected_by_deny_unknown_fields`.
- `middleware::tests`: 4 new tests for the registry —
  `iter_matching_first_match_wins`, `no_match_yields_empty`,
  `empty_is_empty`, `panics_on_invalid_regex`.
- The 3 binary chunk-frame layout tests
  (`chunk_frame_layout`, `chunk_frame_is_gap_flag`,
  `first_byte_dispatch_unambiguous_with_osc`) moved from
  `server::ws_bridge::tests` to `scope::middleware::tests`
  alongside the relocated `encode_chunk`.

`cargo test --lib`: 43/43 (was 35; +8 from the new routing /
middleware / config tests).

### Decisions worth carrying forward

- **Regex over prefix-trie for routing.** The user explicitly
  asked for regex; the trade-off (more flexibility, slightly
  higher per-packet cost) was acceptable. Compile once at
  `build()`; per-packet cost is `Regex::is_match` per entry
  until a hit, ~5 routes max in practice. Negligible.
- **No implicit catch-all.** Pre-37 a stale starter config
  routed `/dirt/hello` to scsynth and surfaced as `/fail` —
  silent failure mode. Now an unmatched address is loud
  (`warn!`). Forces the routes table to be complete; loud is
  better than silent.
- **Middleware-first, routing-second.** This shape lets
  middlewares claim addresses that don't correspond to any
  routing target (e.g. `/scope/subscribe` is consumed by the
  bridge, not forwarded anywhere). Pre-37 we'd have had to add
  `/scope/subscribe` to the routes table pointing at... what?
  Middleware-first dodges the question.
- **Side-channel `ws_extras` / `udp_extras` on `WsCtx`.**
  `MiddlewareOutcome::ConsumedAndSend(Vec<u8>)` handles "swap
  one byte buffer for another". The on-tick middlewares need
  "emit N frames as a side effect, also keep the original
  flowing" — that's where the side-channels come in. The
  dispatcher drains them post-call.
- **Lock-skip when registry is empty.** The forwarder's hot
  path calls `iter_matching(address).next().is_some()` BEFORE
  acquiring the scope lock. Most inbound payloads don't match
  any middleware; skipping the lock keeps the per-packet cost
  at one regex sweep + WS send.
- **Enum dispatch over `dyn Trait`.** Five middlewares is a
  fixed in-tree set. Enum + match avoids `Pin<Box<dyn Future>>`
  on the hot path. If a third-party plugin surface ever
  emerges, the enum can be promoted to a trait.
- **`Scope(InboundScopeMiddleware)` enum nesting.** The server
  middleware module (`server/middleware.rs`) is pure dispatch
  infrastructure; it doesn't know about scope concerns. The
  scope module (`scope/middleware.rs`) owns
  `InboundScopeMiddleware` and the handler bodies; the bridge
  hooks them in via the `InboundMiddleware::Scope(...)`
  wrapper. Future modules adding their own middlewares would
  add `InboundMiddleware::OtherDomain(...)` variants
  similarly.
- **Bypassing middleware for the binary 0x01/0x02 frames.**
  These don't have OSC addresses, so the address-keyed
  registry can't match them. The recv loop's first-byte
  branch calls into the scope module's binary-decode entry
  points directly — `ws_scope_{subscribe,unsubscribe}_binary`.
  Phase 38 will turn the same handler bodies into outbound
  middlewares once the wire format flips to OSC.

### Gotchas

- **Routes table now has no implicit default.** Pre-37 the
  `scsynth` config field was both the handshake target AND
  the implicit catch-all route. Phase 37 split these: the
  field stays as the handshake hint (read by `Session::create`
  for the `/notify` + `/status` round-trips), but routing is
  driven by the explicit regex table. A starter config from
  before Phase 37 (`prefix` field shape) fails loudly at load.
  Migration: delete the file to regenerate, or rewrite
  `prefix` → `pattern` with the appropriate regex shape.
- **Middleware variants are scope-mode-conditional.**
  `register_inbound_middlewares(reg, scope_mode)` registers
  different middlewares per mode: SHM mode gets only
  `ChunkEmitOnTick`; OSC mode gets `BgetnIssueOnTick` +
  `InterceptBsetn`. The variant enums *contain* both modes'
  variants, but the registry only ever holds the right ones
  for the session's mode. Mid-session mode change isn't
  supported (Session::scope_mode is frozen at create — Phase
  36 invariant).
- **Lock acquisition ordering.** The recv loop and the
  broadcast forwarder both lock `scope_ctx` (per-WS). Within
  one task the lock is held for the duration of the dispatch
  call; across tasks they serialize on the mutex. Per-packet
  contention is low (one task locks → one task waits → one
  task locks). Don't hold the lock across an `.await` that
  could take more than a few µs.
- **`InboundScopeMiddleware::ChunkEmitOnTick` + `BgetnIssueOnTick`
  share the same address regex (`^/clock/tick$`).** They're
  distinguished by which one gets registered (mode-conditional).
  If a future refactor accidentally registers BOTH for the
  same WS, the dispatcher would invoke the first one, get
  `PassThrough`, then invoke the second one, also get
  `PassThrough`, then forward — both side-effects firing once.
  Both are idempotent under `PassThrough` so this would silently
  work but waste cycles. Keep `register_inbound_middlewares`
  exclusive in the match arms.
- **`/clock/tick` peek now matches a regex (`^/clock/tick$`)
  instead of a string compare.** The regex is anchored, so
  `/clock/ticks` (hypothetical) wouldn't match. The cost is
  one `Regex::is_match` per inbound payload — same order of
  magnitude as the pre-37 `address == Some("/clock/tick")`
  check. Don't worry about it.
- **`udp_extras` flushes via `session.target_sockets[target]`.**
  The middleware passes `(SocketAddr, Vec<u8>)` pairs. If the
  target isn't in `unique_targets`, `target_sockets[target]`
  returns `None` and the bytes are dropped with a warn. The
  scope middleware uses `session.scsynth_addr` for `/b_getn`
  bundles — that address is guaranteed present (Session::create
  adds it explicitly).
- **Outbound dispatch returns PassThrough always in 37c.** The
  outbound registry has no variants populated. The dispatcher
  early-exits via `is_empty()` check — zero overhead vs the
  pre-37 path. Phase 38 will populate the variants when scope
  ops become OSC; the dispatcher's lock-skip fast path stays
  intact (most outbound packets won't match the new regexes
  either).
- **`session` module visibility.** Promoted from `mod session`
  to `pub(crate) mod session` so `scope::middleware` can reach
  the `Session` and `ScopeShm` types. Crate-scoped only;
  external crates still don't see the type.
- **`axum::middleware` import collides with our new module.**
  In `server/mod.rs` the import was `use axum::middleware;`,
  used as `middleware::from_fn`. Renamed to
  `use axum::middleware::from_fn as axum_middleware_from_fn;`
  so our new `pub(crate) mod middleware;` doesn't shadow.

### Phase 38 preview (not yet drafted)

Phase 38 will:
- Replace `encode_chunk` (binary 0x03) with `encode_scope_chunk`
  (rosc-encoded `/scope/chunk` OSC message; blob arg, big-
  endian floats).
- Flip outbound regexes from binary peek to `^/scope/subscribe$`
  / `^/scope/unsubscribe$`. Add `OutboundMiddleware::Scope(...)`
  variants. Drop the first-byte peek in `ws_bridge.rs` recv
  loop; every WS message becomes pure OSC.
- Drop `scopeWire.ts` on the worker; add `parseScopeChunkReply` +
  builders to `packages/server-commands/src/commands/scope.ts`.
- Replace the worker's `handleInboundBytes` first-byte peek
  with a regular OSC reply pump entry for `/scope/chunk`.



