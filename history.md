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
