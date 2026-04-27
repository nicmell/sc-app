# SCSynth Oscilloscope & Recorder — Plan

A browser-first web app (running equally well in Tauri) that drives
SuperCollider's `scsynth` to render live oscilloscopes of one or more
audio buses, synchronised by a global server-side clock, with optional
sample-accurate WAV recording of the same buses. The clock doubles as
a Start/Stop switch for all audio via the parent group's `/n_run`
flag.

This document is a single working source of truth. Phases 0–15 are
shipped — captured here as a condensed historical record (goals,
what shipped, key decisions, gotchas). Phase 16+ is the upcoming
**Shared Buffer Layer** refactor, planned in detail at the end. The
ordering of phase 16+ is provisional; subphases may be merged or
re-sequenced as implementation reveals constraints.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architectural Principles](#architectural-principles)
3. [Audio Configuration Schema](#audio-configuration-schema)
4. [Workspace Packages](#workspace-packages)
5. [File Layout](#file-layout)
6. [Implemented Phases (0–15)](#implemented-phases-015)
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
7. [Phase 16+ — Shared Buffer Layer Refactor (pending)](#phase-16--shared-buffer-layer-refactor-pending)
8. [Open Points](#open-points)
9. [Future Improvements](#future-improvements)
10. [Milestone Summary](#milestone-summary)

---

## Project Overview

```
┌──────────────────── Browser (React, main thread) ────────────────────┐
│                                                                       │
│  ConnectScreen ─► AppShell ─► Dashboard {                             │
│                                  ClockController, GroupController,    │
│                                  SynthDefRegistry,                    │
│                                  SynthManager   (producers),          │
│                                  ScopeManager   (consumers),          │
│                                  RecordingManager (consumers),        │
│                                  WorkerClient                         │
│                              }                                        │
│                                       │                               │
│                                       ▼                               │
│                              ┌──────────────────┐                     │
│                              │  Scope Worker    │                     │
│                              │  - WS transport  │                     │
│                              │  - osc-js decode │                     │
│                              │  - clock /tr mux │                     │
│                              │  - subscription  │                     │
│                              │    table         │                     │
│                              │  - tick-driven   │                     │
│                              │    /b_getn       │                     │
│                              └────────┬─────────┘                     │
└───────────────────────────────────────┼───────────────────────────────┘
                                        │ binary WebSocket
                                        ▼
                  ┌─────────────────── src-tauri/ ──────────────────────┐
                  │  CLI (clap)                                         │
                  │   ├─ no args  → Tauri GUI shell                     │
                  │   └─ `serve`  → Hyper HTTP + /ws                    │
                  │  server/ws_bridge.rs   1 WS frame ↔ 1 UDP datagram  │
                  └────────────────────────┬────────────────────────────┘
                                           │ UDP
                                           ▼
                                      ┌────────┐
                                      │scsynth │
                                      └────────┘
```

`SynthManager` is the **producer** surface (auto-allocates a bus
block per synth, `/s_new`s a tone synth onto it). `ScopeManager` and
`RecordingManager` are the **consumer** surface (each takes a
user-typed bus number and taps whatever's flowing on it). The
typical user flow: add a synth in the Synths panel, copy its bus
number off the card, type that into the Scopes / Recordings panel.

Every OSC command flows: main thread (encode) → worker (forward
bytes) → WebSocket → bridge → UDP → scsynth. Replies flow the
inverse, with the worker decoding, demuxing clock `/tr`s into
`clockTick` events and intercepting subscribed `/b_setn`s into
zero-copy `scopeChunk` / `recordingChunkWritten` events.

The scope-data path is special. On each clock `/tr` the worker
fires `/b_getn` for every subscribed buffer (wrapped in an
`OSC.Bundle` with `timetag = Date.now() + READ_DELAY_MS` to absorb
kr-vs-ar slop between `Impulse.kr` and `Phasor.ar`). The matching
`/b_setn` replies are intercepted in the worker and posted to main
as `scopeChunk` events keyed by `scopeId`. `ScopeView` runs an RAF
loop that reads the latest chunk from a ref and draws — data rate
(48 Hz at chunkSize=1024 / sr=48 k) and render rate (60+ Hz) are
intentionally decoupled.

---

## Architectural Principles

1. **Worker owns the WebSocket.** Main thread never touches
   `new WebSocket(...)` directly. All OSC traffic flows through
   typed `postMessage`.
2. **Main thread encodes, worker forwards.** Main thread constructs
   `OSC.Message` / `OSC.Bundle` via `@sc-app/server-commands` and
   encodes to bytes locally; the worker only transports bytes and
   decodes inbound replies into plain `{ address, args }` POJOs.
3. **Global clock, single source of timing.** One `SendTrig` stream
   from a dedicated clock SynthDef. All scopes and recordings align
   to these ticks — no custom per-scope timing messages. The first
   tick establishes a main-thread `tick0Ms` anchor that
   `tickToTimetag(tickIndex)` uses to convert server-side tick
   coordinates into NTP timetags for scheduled bundles.
4. **Scheduling via OSC bundle timetags.** Any command that needs
   sample-accurate timing is wrapped in an `OSC.Bundle` with a
   future NTP timestamp; scsynth queues the bundle and fires it at
   that exact audio frame.
5. **Parent group as master switch.** Every synth (clock, scopes,
   recorders, audio sources) lives in one group. `/n_run 0/1` on
   that group pauses/resumes everything in lockstep. The group is
   created **paused** atomically (bundled `/g_new` + `/n_run 0`) so
   the clock doesn't fire any startup ticks before the user
   presses Resume.
6. **Alignment via shared phasor.** The clock publishes its phasor
   on an audio bus. Scope/recorder synths read it as their `BufWr`
   index → all consumers write in perfect sync → worker can derive
   chunk parity from `tickIndex` alone, no server-reported phase
   needed.
7. **Producer/Consumer split.** `SynthManager` is the only
   auto-allocator from `ids.bus`. Scopes and recordings consume
   user-typed bus numbers; bus collisions across consumer types are
   impossible by construction.
8. **Group-internal ordering.** Clock at the head; everything else
   (scopes, recorders, source synths) `AddToTail`. Within tail-adds,
   creation order = runtime order, so "add synth, then add scope"
   gets the right within-control-block alignment naturally.

---

## Audio Configuration Schema

The foundation every phase builds on. Two free parameters at
runtime; everything else is derived. Validated at startup.

```ts
// src/config/clockConfig.ts

export interface AudioEnvironment {
  sampleRate: number;     // captured from /status.reply at connect time
}

export interface ClockParams {
  chunkSize: number;      // global, mutable mid-session via the header dropdown
}

export interface ClockDerived {
  tickRate: number;            // sampleRate / chunkSize
  samplesPerTick: number;      // = chunkSize
  tickIntervalMs: number;      // 1000 / tickRate
}

export function deriveClock(env: AudioEnvironment, params: ClockParams): ClockDerived;
```

### Invariants

- `samplesPerTick = sampleRate / chunkSize`. Must be a positive
  integer (filtered by `practicalChunkSizes(sampleRate)`).
- `chunkSize` is power-of-2 in the supported set
  `{64, 128, 256, 512, 1024}`, filtered to those whose derived
  tickRate stays under `MAX_PRACTICAL_TICK_RATE = 250 Hz` for the
  active sample rate.
- `chunkSize` is global; it lives in `DEFAULT_PARAMS` + AppShell
  state and every scope/recorder reads it from
  `clock.params.chunkSize`. Cache keys for tap synthdefs include
  it (`(channels, chunkSize)`).
- `decimation` is fixed at 1 — the per-scope decimation knob was
  removed in Phase 13. The tap synth writes one frame per sample.

### chunkSize × sampleRate practical reference

| chunkSize | 44.1 kHz       | 48 kHz         | 96 kHz         | 192 kHz        |
|-----------|----------------|----------------|----------------|----------------|
| 1024      | 43 Hz / 23 ms  | 47 Hz / 21 ms  | 94 Hz / 11 ms  | 188 Hz / 5 ms  |
| 512       | 86 Hz / 12 ms  | 94 Hz / 11 ms  | 188 Hz / 5 ms  | 375 Hz ✗       |
| 256       | 172 Hz / 6 ms  | 188 Hz / 5 ms  | 375 Hz ✗       | 750 Hz ✗       |
| 128       | 345 Hz ✗       | 375 Hz ✗       | 750 Hz ✗       | 1500 Hz ✗      |
| 64        | 689 Hz ✗       | 750 Hz ✗       | 1500 Hz ✗      | 3000 Hz ✗      |

`✗` = filtered out (`tickRate > 250 Hz`). Buffer size
(`2 × chunkSize × channels × 4 bytes`) is sample-rate-agnostic;
only `chunkSize` determines memory. Total `/b_setn` traffic is also
sample-rate-agnostic per scope (`sampleRate × channels × 4`
bytes/sec regardless of which factor pair you pick).

---

## Workspace Packages

The app is a yarn-v4 workspace with two local TS packages under
`packages/`:

### `@sc-app/server-commands` (OSC layer)

Wraps [`osc-js`](https://github.com/adzialocha/osc-js). scsynth
honours NTP timetags on OSC bundles, queueing them and firing at
the exact audio frame; this package exposes that primitive via
`OSC.Bundle` + `tickToTimetag`.

Surface:
- **`OSC`** — `osc-js` re-exported. `new OSC.Message(...)` /
  `new OSC.Bundle(timetag, [...packets])`.
- **`encode(packet)` / `decode(bytes)`**.
- **Per-address command constructors** under
  `commands/{node,group,synthdef,buffer,control,misc}.ts` —
  `sNew`, `nFree`, `nSet`, `gNew`, `gFreeAll`, `dRecv`, `bAlloc`,
  `bGetn`, `bFree`, `notify`, `status`, `version`, …
- **Reply accessors** — `Tr`, `Synced`, `Fail`, `StatusReply`,
  `BSetnReply`, `NodeEvent`. `BSetnReply.samples` copies into a
  `Float32Array` once at decode time.
- **Timetag helpers** — `immediate()`, `atDate(ms)`,
  `inFuture(ms)`, `tickToTimetag(tick0Ms, tickIndex, tickRate)`.

Runs in both main thread and worker contexts (worker bootstrap
provides `window = globalThis` so osc-js loads).

### `@sc-app/synthdef-compiler`

Pure-TS compiler for the SCgf v2 SynthDef binary scsynth accepts.
Byte-identical output to sclang's compiler for every fixture in the
test suite. Three layers, all producing the same SCgf bytes:

- **`synthdef(name, fn)`** (sugar, recommended) — sclang-style
  callback with a `g` graph proxy:
  ```ts
  const def = synthdef('sine', (g, { freq = 440, amp = 0.5 }) => {
    g.Out.ar(0, g.mul(g.SinOsc.ar(freq, 0), amp));
  });
  ```
- **Typed chainable builders** — one class per UGen with
  arg-setters and `.build(def)`. 365 UGens shipped.
- **Low-level `SynthDef.addControl` / `addUgen`** — stringly-typed
  programmatic construction.

41 vitest tests + an optional sclang byte-diff parity harness in
`examples/node/sclang_parity.ts`.

---

## File Layout

```
packages/                              # yarn workspace
  server-commands/                     # OSC layer over osc-js
  synthdef-compiler/                   # SCgf v2 compiler

src-tauri/                             # Rust backend (transport only)
  src/
    main.rs / lib.rs / cli.rs
    server/
      mod.rs                           # Hyper HTTP + SPA fallback + /ws upgrade
      ws_bridge.rs                     # WebSocket ↔ UDP bridge

src/                                   # frontend (React)
  AppShell.tsx                         # connect ↔ dashboard orchestration
  main.tsx                             # React root
  config/clockConfig.ts                # ClockParams, deriveClock,
                                        # MAX_PRACTICAL_TICK_RATE,
                                        # READ_DELAY_MS, practicalChunkSizes()
  server/                              # scsynth transport + shared server state
    WorkerClient.ts                    # main-thread wrapper around Worker
    workerProtocol.ts                  # main ↔ worker message shapes
    GroupController.ts                 # parent group lifecycle (atomic /g_new + /n_run 0)
    SynthDefRegistry.ts                # tracks loaded SynthDefs (idempotent /d_recv)
    IdAllocator.ts                     # node / buffer / bus monotonic counters
    serverInfo.ts                      # /status snapshot store + heartbeat + /version
  clock/
    ClockController.ts                 # owns clock synth + tick0Ms anchor
  synth/                               # runtime tone-synth wrappers (producers)
    SynthController.ts                 # one tone synth
    SynthManager.ts                    # collection of synth controllers
  scope/                               # scope visualization (consumers)
    ScopeController.ts                 # one scope
    ScopeManager.ts                    # collection of scope controllers
  recording/                           # consumers
    RecordingController.ts
    RecordingManager.ts
    envelopeBuffer.ts                  # per-tick min/max envelope storage (Phase 14)
    download.ts                        # Blob → save-as (native dialog or <a download>)
  synthdefs/                           # SynthDef byte compilers (one per def)
    clockSynthDef.ts                   # globalClock
    scopeSynthDef.ts                   # scope tap (clockBus-driven writeIdx)
    recorderSynthDef.ts                # recorder tap (clockBus-driven writeIdx)
    toneSynthDef.ts                    # tone1ch / tone2ch (Phase 15)
  workers/
    oscWorker.ts                       # Vite ?worker entry — owns the WS,
                                        # decodes OSC, demuxes /tr, dispatches
                                        # /b_setn to scope/recording subs
    workerBootstrap.ts                 # window = globalThis shim + buffer pre-import
    workerConsoleBridge.ts             # forwards console.* to main as `log` events
    transport.ts                       # WS wrapper (worker-internal)
    wavWriter.ts                       # in-memory WAV encoder (worker-side)
  util/                                # cross-cutting helpers
    reactiveStore.ts                   # tiny createStore<T>() observable
    debugLog.ts                        # in-memory log ring for the DebugLog panel
    runtime.ts                         # IS_TAURI flag
  ui/                                  # React components
    ConnectScreen/
    SynthsPanel/                       # producer panel (Phase 15)
    ScopeList/ScopeView/               # scope cards + canvas
    RecordingPanel/                    # recording cards + waveform view
    ClockPanel/                        # Start/Resume/Pause + tick + elapsed + chunkSize dropdown
    Modal/                             # LoadingModal, ConfirmModal, ErrorModal
    Footer/                            # /status snapshot + /version
    DebugLog/                          # captured console output
```

Folder boundaries follow producer/consumer/transport semantics:
`src/synth/` is *runtime* tone-synth wrappers (controllers);
`src/synthdefs/` is the *compile-time* SynthDef byte builders that
load via `/d_recv`. The two are deliberately separate names so
imports are unambiguous (`@/synth/SynthController` vs
`@/synthdefs/toneSynthDef`).

---

## Implemented Phases (0–15)

What follows is a condensed historical record. For each phase: the
goal, what shipped (files + behaviours), key design decisions or
adaptations from the original spec, and gotchas worth carrying into
future work. Phase 13 consolidates what shipped across 13 / 13.5 /
13.6 — sub-phases were inserted as the work expanded; the
flattened version below is the cleaner read.

### Phase 0 — Tauri Backend + WS↔UDP Bridge + CLI

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

### Phase 1 — Worker Transport

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

### Phase 2 — Typed Command/Reply Proxy

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

### Phase 3 — SynthDef Compile & Load

**Goal.** Typed UGen surface; first SynthDef compiled in TS, sent
via `/d_recv`, acknowledged via `/done /d_recv`.

**What shipped.**
- `@sc-app/synthdef-compiler` integration via Vite alias.
- `SynthDefRegistry.ts` — idempotent `ensureLoaded(name, bytes)`
  tracker so re-uploads skip the round-trip after the first.
- `noopSynthDef.ts` (early dev) — later removed in Phase 13.
- `SynthDefPanel.tsx` (early dev) — later removed in Phase 13.

### Phase 4 — Parent Group & `/n_run`

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

### Phase 5 — Global Clock SynthDef

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

### Phase 6 — Shared Phasor on Clock Bus

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

### Phase 7 — Scope SynthDef, Manual Poke

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

### Phase 8 — Worker Tick-Driven Read Loop

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

### Phase 9 — Single-Channel Renderer

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

### Phase 10 — Multi-Channel

**Goal.** Render N-channel scopes (1 or 2 today) in stacked lanes.

**What shipped.**
- `ScopeView` lane layout: `lanes: [{y0, y1}, ...]` derived from
  `channels` and canvas height.
- Interleaved sample reading — `scopeChunk.data` is
  `chunkSize × channels` floats interleaved.

**Adaptation.** A "stacked vs overlay" layout knob was specced but
dropped — stacked-only is the default and there was no real demand
for overlay.

### Phase 11 — Multi-Scope

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

### Phase 12 — Recording Pipeline

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

### Phase 13 — UI Polish, Runtime sampleRate, Global chunkSize

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
  last-known state; user reloads manually. See Future Improvement
  #18.

**Gotchas.**
- `chunkSize` is mutable mid-session. SynthDef cache keys for
  `compileScopeSynthDef` and `compileRecorderSynthDef` must be
  `(channels, chunkSize)`, never `(channels)` alone.
- The reinit path runs over the same WS — re-issuing `notify(1)`
  would either be rejected or assign a fresh clientId.

### Phase 14 — Recording Waveform View

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

### Phase 15 — Source Synths Panel

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

---

## Phase 16+ — Shared Buffer Layer Refactor (pending)

Phases 0–15 shipped two parallel pipelines that each own their own
buffer, tap synth, and worker subscription:

- `ScopeController` → `/b_alloc` + `scopeSynthDef` /s_new +
  `subscribeScope` in the worker.
- `RecordingController` → `/b_alloc` + `recorderSynthDef` /s_new +
  `subscribeRecording` in the worker.

Two scopes on the same bus today double the bandwidth (two
`/b_getn` per tick, two tap synths writing identical data into two
buffers). A scope plus a recording on the same bus pay the same
cost twice. The worker subscription table is keyed per-consumer, so
even though the synthdefs are functionally identical, the worker
has no way to coalesce.

This refactor introduces a third, shared layer between consumers
and the OSC pipe: a **`BufferController`** that owns one tap synth
+ one buffer + one worker subscription, fanning chunks out to N
consumers, plus a **`BufferManager`** that ref-counts controllers
keyed by `(inputBus, channels, chunkSize)`. After the refactor:

- `ScopeController` owns no buffer, no tap synth, no `/s_new` —
  just a render canvas listening to a buffer's chunk stream.
- `RecordingController` owns no buffer, no tap synth — just a WAV
  writer pipeline listening to a buffer's chunk stream.
- `BufferManager` is the only thing that calls `/b_alloc` /
  `/s_new` for the tap synth.

The producer surface (synths) is unchanged. The consumer-facing
UIs (`ScopeList`, `RecordingPanel`) are visually identical; users
still type a bus number.

> **Phase ordering is provisional.** None of phases 16–21 has been
> implemented. As phase 17 lands the rest may be re-sequenced or
> merged — for example, the unified tap synthdef (currently 18) is
> a small enough change that it could ride along with phase 16's
> `BufferController` if the worker pivot in 17 doesn't need it
> beforehand.

### Goals & non-goals

**Goals.**
1. **De-duplicate bus reads.** Two consumers on the same bus
   produce one `/b_getn` per tick.
2. **Single source of truth for tap state.** One `nodeId` and one
   `bufnum` per `(inputBus, channels, chunkSize)` triple regardless
   of how many UI components observe it.
3. **Shrink consumer surface.** `ScopeController` and
   `RecordingController` shrink to "subscribe to a chunk stream,
   do your thing per chunk."
4. **Make multi-consumer features cheap.** Spectral scope (Future
   Improvement #16), tee-recording, level meters — all become "add
   another subscriber to an existing `BufferController`."
5. **Preserve every Phase-15 invariant.** Group ordering,
   clockBus-driven `writeIdx`, offset-keyed pending reads,
   tick-ordered delivery for recordings — relocated, not changed.

**Non-goals.** Producer-side changes (Phase 15 stays). Rust /
bridge changes. Render-loop changes (`ScopeView`'s
`useRef<ScopeChunk | null>` survives unchanged). Reconnection /
disconnected UX (still Future Improvement #18). Streaming-to-disk
recordings (still Future Improvement #17).

### Architecture: before vs after

**Before (Phase 15).**

```
SynthController ──► tone synth writing onto bus B
                                   ▲
ScopeController ───┬───────────────┘
                   │ - /b_alloc buf_S
                   │ - /s_new scope tap (reads B → buf_S)
                   │ - subscribeScope(scopeId, buf_S)

RecordingController ┬───────────────► same bus B
                    │ - /b_alloc buf_R
                    │ - /s_new recorder tap (reads B → buf_R)
                    │ - subscribeRecording(recordingId, buf_R)
```

Two scopes on B = two buffers, two tap synths, two `/b_getn`
streams.

**After.**

```
SynthController ──► tone synth writing onto bus B
                                   ▲
                   ┌───────────────┘
                   │
            BufferController  ◄── ref-counted by BufferManager,
            - /b_alloc buf            keyed (B, ch, chunkSize)
            - /s_new tap synth
              (reads B → buf)
            - subscribeBuffer
            - chunk fan-out (N callbacks)
                   ▲
        ┌──────────┼──────────┬──────────┐
        │          │          │          │
   ScopeCtrl 1  ScopeCtrl 2   RecCtrl   (future)
                                         spectral / level meter
```

`BufferManager` is a peer of `SynthManager` on
`DashboardResources`. `ScopeManager` and `RecordingManager`
shed buffer + tap concerns and become thin "create consumer that
wraps a `BufferController`" factories.

### Lifecycle

```
ScopeManager.add({inputBus, channels, label})
  ↓
  bufferManager.acquire({inputBus, channels, chunkSize})  // refcount 0 → 1
    ↓ (on first acquire)
    /b_alloc → /s_new tap synth → subscribeBuffer
  ↓
  ScopeController(bufferHandle, …)
    ↓
    bufferController.subscribe((chunk) => view.next(chunk))

ScopeManager.remove(scopeId)
  ↓
  scopeController.dispose()
    ↓
    bufferController.unsubscribe(cb)
  ↓
  bufferManager.release(handle)        // refcount → 0?
    ↓ (only on last release)
    unsubscribeBuffer → /n_free tap synth → /b_free
```

### Decisions locked in

1. **Sharing key: `(inputBus, channels, chunkSize)`.** Two
   consumers share iff all three match. After Phase 13 chunkSize is
   session-global, so the key collapses to `(inputBus, channels)`
   in practice — but we keep chunkSize in the key explicitly so the
   design survives a future where consumers can pick different
   chunk sizes.
2. **Channel-count discipline.** Every `BufferController` is
   allocated for the full channel count the consumer requested. No
   channel-slice sharing — a 1-channel consumer asking for channel
   0 of a 2-channel bus does *not* share the 2-channel consumer's
   buffer. Cost is one extra tap synth in the rare slice scenario;
   accepted.
3. **Chunk fan-out: shared `Float32Array`, read-only by contract.**
   `postMessage` without transfer; the `Float32Array` arrives
   shared. Every consumer treats it as read-only and must not
   retain past one tick. ScopeView already does this via `useRef`;
   recording's WAV writer copies samples out immediately. The
   fallback (per-consumer structured-clone copies) is a one-line
   change in the worker if a future mutating consumer needs it.
4. **Lifecycle: prompt teardown, no debounce.** Last release →
   immediate `/n_free` + `/b_free`. Toggle hot path is not
   documented as load-bearing; if it becomes one, add the grace
   period in `BufferManager.release`.
5. **Mid-stream join semantics.** A consumer that acquires
   mid-stream starts receiving chunks from the next tick. Already-
   delivered chunks are not replayed. Recordings stamp
   `acquireTickIndex` and gate the WAV writer on
   `tickIndex >= acquireTickIndex` to avoid join slop.
6. **Pending-read table: offset-keyed for all buffers.** The
   recording side already runs offset-keyed
   `pendingByOffset: Map<offset, PendingRead>` (capacity 2 — one
   per ring half) plus a `reorderBuffer: Map<tick, …>` for
   tick-ordered delivery. Adopt uniformly. Scopes don't need the
   ordering for correctness but don't suffer from it.
7. **Unify the tap synthdefs.** `scopeSynthDef` and
   `recorderSynthDef` are functionally identical (modulo synthdef
   name). Phase 18 replaces them with a single
   `bufferTapSynthDef(channels, chunkSize)`.
8. **Producer/consumer ordering invariant unchanged.** Tap synths
   stay `AddToTail`. The Phase 15 "add synth, then add consumer"
   UX flow keeps tap synths after producers naturally.

### Open questions to resolve before phase 16

These tune knobs; none change the phase structure.

1. **Push API vs pull store.** `ScopeView` reads via `useRef`
   (pull); recording needs every chunk in order (push). Probably
   both: `subscribe(cb)` for push consumers and
   `latestChunk: ReadonlyStore<...>` for pull consumers.
2. **`acquire` async vs sync-with-pending-store.** Easiest: keep
   async (mirrors `SynthManager.add`). First acquirer pays the
   round-trip; subsequent acquirers return a resolved Promise.
3. **`/n_go` failure handling.** Same shape as
   `SynthManager.add`'s try-stop-rethrow: if `/s_new` fails, clean
   up the partial buffer alloc and reject. Document that the
   buffer is *not* placed in the manager's map until `/sync`
   returns clean.
4. **`BufferManager.snapshot` debug surface?** A reactive store of
   `{key, refcount, bufnum, nodeId}[]` would make a future
   `BuffersPanel` cheap and would catch refcount leaks visibly.
   Add in phase 16 if cheap; otherwise file as a follow-up.

### File map

| File | Phase | Change |
|---|---|---|
| `src/buffer/BufferController.ts` | 16 | NEW. |
| `src/buffer/BufferManager.ts` | 16 | NEW. |
| `src/server/workerProtocol.ts` | 17 | Replace scope/recording subscription messages with `subscribeBuffer` / `unsubscribeBuffer`. `ScopeChunk` → `BufferChunk` keyed by `bufferId`. Recording-specific events removed (the WAV writer relocates in 20). |
| `src/workers/oscWorker.ts` | 17 | Subscription table keyed by `bufferId`; one `/b_getn` per tick per buffer; unified offset-keyed pending + reorder. WAV writer code deleted. |
| `src/workers/wavWriter.ts` | 20 | DELETE (moves to `src/recording/wavWriter.ts`). |
| `src/server/WorkerClient.ts` | 17 | Replace `subscribeScope` / `subscribeRecording` with `subscribeBuffer(spec, cb)`. Drop `startRecording` / `stopRecording`. |
| `src/synthdefs/bufferTapSynthDef.ts` | 18 | NEW. Replaces both old taps. Cache key `(channels, chunkSize)`. |
| `src/synthdefs/scopeSynthDef.ts` | 18 | DELETE. |
| `src/synthdefs/recorderSynthDef.ts` | 18 | DELETE. |
| `src/scope/ScopeController.ts` | 19 | Drop /b_alloc, /s_new, /b_free. Take a `BufferHandle` in opts; subscribe; expose `latestChunk` unchanged. |
| `src/scope/ScopeManager.ts` | 19 | `add()` calls `bufferManager.acquire(spec)`; `remove()` calls `release()`. |
| `src/recording/RecordingController.ts` | 20 | Drop /b_alloc, /s_new, /b_free. Take a `BufferHandle`. WAV writer + reorder buffer move here from worker. |
| `src/recording/RecordingManager.ts` | 20 | Acquires/releases via `BufferManager`. |
| `src/recording/wavWriter.ts` | 20 | NEW (moved from `src/workers/`). |
| `src/AppShell.tsx` | 21 | `bufferManager` on `DashboardResources`; constructed in `setupDashboard` after registry, before scope/recording managers. `teardownServerState` clears recordings → scopes → buffers → clock → group. |
| `CLAUDE.md` | 21 | Architecture diagram update + refcount-lifecycle gotcha + unified-tap note. |
| `plan.md` | 21 | Fill "as landed" subsections per phase. |

### Phase 16 — `BufferController` + `BufferManager` scaffolding

**Goal.** Land the new types + classes with zero integration. New
files compile against existing utilities; the running app does not
touch them.

**`BufferController`** owns one buffer + one tap synth + one
worker subscription. Keyed by `BufferSpec = {inputBus, channels:
1|2, chunkSize}`. Reactive: `bufnum`, `nodeId`,
`latestChunk: ReadonlyStore<BufferChunk | null>`. Push API:
`subscribe(cb): () => void`. Lifecycle: `start()` allocates +
/s_new + subscribe; `dispose()` unsubscribe + /n_free + /b_free.
Both idempotent. Owned exclusively by `BufferManager`; consumers
get a read-only handle.

**`BufferManager`** ref-counts controllers in a
`Map<keyOf(spec), {ctrl, refcount}>`. `acquire(spec): Promise<BufferHandle>`
— missing → construct + start + insert with refcount 1; hit →
increment refcount. `handle.release()` decrements; on zero, await
dispose, remove. `clear()` disposes all.

**Acceptance.** `yarn tsc --noEmit` clean. `yarn build` clean. New
files unreferenced (Vite tree-shakes them). No behavioural change
in the running app.

### Phase 17 — Worker subscription protocol pivot

**Goal.** Re-key the worker's subscription table on `bufferId`
instead of `scopeId` / `recordingId`. The protocol expresses
"subscribe to a buffer" once; N main-thread fan-out is a main-side
concern. The WAV writer leaves the worker (relocates in phase 20).

This is the highest-blast-radius phase. Land it independently of
phases 18–20 — `ScopeController` and `RecordingController`
continue to call the *new* protocol via a thin adapter for one
commit, then phases 19+20 strip the adapter.

**Protocol.** Replace `ScopeSubscription` / `RecordingSubscription`
with a single `BufferSubscription = {bufferId, bufnum, channels,
chunkSize}`. Replace `subscribeScope` / `unsubscribeScope` /
`startRecording` / `stopRecording` messages with `subscribeBuffer`
/ `unsubscribeBuffer`. `ScopeChunk` becomes `BufferChunk` keyed by
`bufferId`. Recording-specific events
(`recordingChunkWritten` / `recordingGap` / `recordingDone`) are
removed; their behaviour moves to main in phase 20.

**Worker.** `Map<bufferId, {subscription, pendingByOffset,
reorderBuffer, nextDeliverableTick}>`. Per-tick handler fires one
`/b_getn` per subscription (just-completed half offset). `/b_setn`
handler matches by bufnum, finds pending by offset, builds
`BufferChunk`, buffers in `reorderBuffer`, flushes in tick order,
posts `bufferChunk` to main per flushed chunk.

**`WorkerClient`.** `subscribeBuffer(sub, onChunk): {unsubscribe}`.
Internal `Map<bufferId, Set<onChunk>>` so multiple main-thread
listeners can attach to the same `bufferId`. The worker still
gets exactly one `subscribeBuffer` per buffer.

**Adapter shim (intermediate).** For the lifetime of phase 17 only,
`ScopeController` and `RecordingController` call `subscribeBuffer`
via a small inline adapter that allocates a per-controller
`bufferId` and wraps their existing `bufnum`. Throwaway code —
phases 19+20 delete it. Lets phase 17 ship green without
depending on `BufferManager`.

**Acceptance.** Manual smoke test indistinguishable from
pre-phase-17 behaviour. Worker debug log shows `subscribeBuffer` /
`unsubscribeBuffer` in place of the old subscription messages.

**Risks.**
- **Tick-ordering regression for recordings.** Mitigate: lift the
  existing recording-side reorder code verbatim; drop the
  per-recording keying. Add a 1-tick replay test (drop the first
  tick's reply, verify the next tick's chunk doesn't deliver until
  retry/gap).
- **Recording gap detection** moves from worker to main in phase
  20. Phase 17 *temporarily loses* it — recordings work, but gaps
  are silently silence with no sidecar JSON. Mark this in the
  phase 17 commit message; phase 20 restores it.

### Phase 18 — Unify scope + recorder tap synthdefs

**Goal.** Replace `scopeSynthDef` and `recorderSynthDef` with a
single `bufferTapSynthDef`.

**`bufferTapSynthDef.ts`.** `compileBufferTapSynthDef(channels: 1|2,
chunkSize: number)`. Cache key `(channels, chunkSize)`. Body
verbatim from `compileScopeSynthDef` — they're already byte-
identical to `recorderSynthDef`'s output (modulo synthdef name).
Inspect with `g_dumpTree` after to confirm one tap synthdef per
combo, not two.

**Risks.** Synthdef byte-identity is asserted but not load-bearing
— if the two predecessors had subtle drift this masks it. Cross-
check `bufferTapSynthDef` bytes against both before deletion.

### Phase 19 — Migrate `ScopeController` onto `BufferManager`

**Goal.** `ScopeController` no longer owns a buffer or tap synth.
Receives a `BufferHandle`; subscribes to its chunk stream.

**`ScopeControllerOptions = {buffer: BufferHandle, scopeId,
label?}`.** `dispose()` unsubscribes + releases. Latest-chunk store
still drives `ScopeView` via `useRef`.

**`ScopeManager.add({inputBus, channels, label})`.**
1. `const handle = await bufferManager.acquire({inputBus, channels,
   chunkSize: clock.params.chunkSize})`
2. `const ctrl = new ScopeController({buffer: handle, …})`
3. push to store, return.

`ScopeManager.remove(scopeId)` → `await ctrl.dispose()` (drops
subscription, releases handle).

**Acceptance.** Two scopes on the same bus + same channels: only
one `/b_alloc` and one `/s_new tap`. Remove one — tap stays alive.
Remove the second — `/n_free tap` + `/b_free` fire. The
"scope-before-synth" caveat from CLAUDE.md still applies.

### Phase 20 — Migrate `RecordingController` onto `BufferManager`

**Goal.** `RecordingController` becomes a pure consumer. WAV writer
+ gap detection move from worker to main.

**`RecordingControllerOptions = {buffer: BufferHandle,
recordingId, label?, sampleRate}`.** Internals: `writer:
WavMemoryWriter` (same impl, on main now); `acquireTickIndex` set
on `start()`; `nextExpectedTickIndex` drives gap detection;
chunk callback drops `tickIndex < acquireTickIndex` (mid-stream
join slop), emits a `RecordingGap` and zero-fills if a tick is
missing, appends samples to writer.

The retry policy currently on `RecordingSubscription` becomes a
`BufferSubscription` field. Every buffer gets retry-on-late by
default, with the worker emitting a *synthetic gap chunk* on retry
exhaustion — recordings materialise it, scopes ignore it.
Documented on `BufferChunk`.

**Acceptance.**
- Single recording on a bus with no scopes: same as today.
- Recording + scope on the same bus: one tap synth + one buffer;
  both consumers receive every chunk; WAV valid; scope renders.
- Stop scope first: recording continues uninterrupted (refcount
  2 → 1, no teardown). Stop recording: WAV finalises; refcount
  1 → 0, tap + buffer torn down.
- Forced gap → `RecordingGap` events fire; sidecar JSON contains
  them; WAV length matches `framesWritten`.

**Risks.** Off-thread → on-thread WAV writer is a slight CPU
shift. The writer is small (memcpy). Profile after landing;
streaming-to-disk (Future Improvement #17) is a localised follow-up
that bypasses any concern. Mid-stream-join semantics are new
behaviour — verify a recording added 5 s after a scope on the same
bus produces a WAV starting at the recording's start.

### Phase 21 — `AppShell` wiring, teardown, docs

**Goal.** Hook `BufferManager` into the dashboard lifecycle, update
documentation.

`setupDashboard` constructs `BufferManager` after `SynthDefRegistry`,
passes it to `ScopeManager` + `RecordingManager`.

`teardownServerState`:

```
recordingManager.clear()    // releases buffer handles
  → buffers used only by recordings hit refcount 0
  → tap synths /n_free, buffers /b_free
scopeManager.clear()        // releases remaining handles
  → remaining buffers hit refcount 0
bufferManager.clear()       // safety net — should be empty by now
                            // (logs a warn if not — refcount leak canary)
synthManager.clear()        // producer side
clock.stop()
group.free()
```

The `bufferManager.clear` safety log is the canary: if a phase
19/20 bug ever fails to release a handle, this catches it as a
warning rather than a leaked tap synth.

**Docs.**
- `CLAUDE.md`: replace architecture diagram with a version
  including `BufferManager`. Add gotchas for refcount lifecycle
  and the unified tap synthdef. Update the "scope-before-synth"
  caveat to "consumer-before-producer" (now applies symmetrically
  to recordings).
- `plan.md`: fill "as landed" subsections per phase.

**Acceptance (whole refactor).**
1. **Single tap per bus.** Two scopes on the same bus produce one
   `/s_new` and one `/b_alloc`. A recording on the same bus shares
   that tap. Verifiable via debug log + `g_dumpTree`.
2. **Refcount correctness.** Adding/removing N consumers in any
   order leaves `bufferManager` with the right count; last
   consumer's removal tears down the tap.
3. **Behavioural parity.** Scopes render identically. Recordings
   produce byte-identical WAVs (modulo header timestamp) for
   stationary tones.
4. **Phase-15 invariants preserved.** Synths still produce, scopes/
   recordings still consume user-typed bus numbers, chunkSize
   reinit still works, group teardown still cleans up.
5. **Codebase legibility.** `ScopeController` and
   `RecordingController` shorter than Phase 15 (no buffer alloc,
   no /s_new, no /b_free). New `BufferController` +
   `BufferManager` ~150–250 LOC each.

### Cross-cutting risks & gotchas

1. **Refcount correctness under partial failures.**
   `BufferManager.acquire` runs `await ctrl.start()` which can
   throw mid-flight. Either don't insert into the map, or clean up
   partial state. Mirror `SynthManager.add`'s try-stop-rethrow.
2. **Worker subscription dedup vs. main fan-out.** The worker has
   *one* subscription per `bufferId`; main has *N* listeners.
   Last main-side unsubscribe sends `unsubscribeBuffer`; earlier
   ones just remove from the local `Set`. A `bufferChunk` for an
   unknown `bufferId` is dropped silently — already correct.
3. **chunkSize global reinit.** When the user changes chunkSize,
   `teardownServerState` rebuilds. `BufferManager` is rebuilt
   fresh; consumers re-acquire on the new chunkSize. Tap synthdef
   cache key `(channels, chunkSize)` ensures fresh bytes.
4. **Group ordering.** Tap synths go `AddToTail`, after producers.
   Sharing buffers reduces the number of tap synths — fewer
   ordering considerations, not more.
5. **Recording vs. scope chunk semantics divergence.** Both consume
   the same `BufferChunk`. Scopes care about *liveness* (latest
   chunk); recording cares about *completeness* (every chunk in
   order, gaps explicit). The shared stream gives recording its
   in-order delivery for free. The synthetic gap chunk on retry
   exhaustion lets recording materialise gaps while scopes
   silently ignore them.
6. **Test coverage.** Future Improvement #20 is not in scope here,
   but this refactor is testable in isolation: `BufferManager`
   refcount, worker subscription dedup, recording gap detection.
   At minimum, fixture-style tests for `acquire` / `release` in
   phase 16.

### Future work this unlocks

Strictly out of scope for phase 16+ but the refactor enables:

1. **Spectral scope (FFT view)** (Future Improvement #16) — add an
   FFT analyzer that subscribes to a `BufferController`. No new
   tap synth or buffer needed.
2. **Level meters per bus** — another consumer subscribing to the
   same buffer.
3. **Tee-recording** — a single button on a scope card spawns a
   `RecordingController` on the same `BufferHandle`. Trivial
   after; awkward today.
4. **`BuffersPanel` debug UI** — live ref-count, bufnum, nodeId
   for every active tap. Diagnoses leaks visually.
5. **Streaming-to-disk recordings** (Future Improvement #17) — the
   WAV writer is already on main after phase 20; piping into a
   streaming sink is a localised change in `RecordingController`.
6. **Per-consumer chunk size** — already covered by the
   `(bus, channels, chunkSize)` key. No design change, just a
   configuration knob if a feature ever wants it.

---

## Open Points

1. **Reply correlation for `/b_getn`.** scsynth matches replies by
   bufnum, not by explicit request id. The "one read in flight per
   bufnum per offset" invariant is what makes it safe; the worker
   enforces it via `pendingByOffset`. Dev-only assertion
   recommended.
2. **Parent group ID derivation.** `clientId × 100`, falling back
   to `100` when scsynth assigns `clientId = 0`. The fallback
   warns in the debug log. Promotion to a configurable allocator
   has not been needed.
3. **Clock bus ID.** Allocated from `ids.bus` starting at 32 to
   skip hardware-reserved buses. Confirm against scsynth boot
   config if a deployment uses a non-default `numAudioBusChannels`.
4. **Phase boundary parity.** `completedHalf = tickIndex % 2` (see
   Phase 5 / 8 gotchas). The original plan had it inverted;
   verified empirically.
5. **`BufWr` is zero-order-hold.** The scope synth's `BufWr.ar`
   does not anti-alias on decimation. After Phase 13's revert to
   `decimation = 1` this is no longer an issue — every audio frame
   is written. If a future feature reintroduces decimation, plan
   for a proper anti-aliased path.
6. **Recording memory ceiling.** Float32 stereo at 48 kHz =
   ~23 MB/min. Practical comfortable ceiling ~10–15 min before RAM
   pressure. Streaming-to-disk (Future Improvement #17) addresses
   this.
7. **WAV 4 GB header limit.** Float32 stereo at 48 kHz → ~3h45m
   max file size in the WAV header. Above the RAM ceiling, so not
   binding in practice. RF64 deferred.
8. **Reconnection.** Out of scope. App expects manual reload on WS
   loss (the runtime error modal facilitates that). Future
   Improvement #18.
9. **Ordering constraints within parent group.** Clock at head;
   everything else `AddToTail`; producers must be created before
   consumers that read their buses. Documented in `CLAUDE.md`.

---

## Future Improvements

Suggested follow-on phases. Listed in rough order of value /
effort ratio; none are blocked by the buffer refactor (which is
itself the single biggest enabler).

### 1. Spectral scope (FFT view)

Add a `compileFFTScopeSynthDef` that runs `FFT.kr` on the input bus
into a 1024-bin buffer (one FFT every tick — natural cadence given
`samplesPerTick = 1024`). Worker reads the buffer the same way as a
time-domain scope; main thread renders log-magnitude bars or a
filled spectrogram. After phase 16+ this becomes "add a consumer
that subscribes to a `BufferController`" — no new synth or buffer.

**Cost:** ~1 day. Most of the work is the renderer.

### 2. Streaming-to-disk recordings

Today the WAV lives entirely in main memory until stop. Caps
practical session length at ~15 minutes stereo before RAM pressure.

- **Browser (serve mode):** File System Access API streams chunks
  directly to a user-chosen file.
- **Tauri:** `fs` plugin streaming via the bridge, or a small
  Tauri command that appends to a path.

WAV header still needs patching at finalise — easy with FS Access
API (`createWritable` + seek); trickier with append-only IPC, may
prefer RF64.

**Cost:** ~1.5 days, mostly because of the two backends.

### 3. Reconnection + disconnected UX

WS close currently surfaces as a runtime error modal; user
reloads. Smoother:

- Panels show a *disconnected* pill in place of their state pill;
  controllers stay mounted with last-known data (recording Blobs,
  scope envelopes still downloadable).
- A "Reconnect" button at the dashboard header retries the connect
  handshake and resyncs state.
- Optional: automatic reconnect with exponential backoff.

**Cost:** ~½ day manual; ~1 day with auto-reconnect + state
resync.

### 4. Tauri-managed scsynth lifecycle

Today scsynth must be running before the user connects. In Tauri
builds we could spawn it as a managed sidecar — Tauri sets the
binary path, audio device, sample rate; we read stdout for the
`SuperCollider 3 server ready` banner; we kill cleanly on exit.

**Cost:** ~½ day. Mostly Tauri-side glue (`tauri.conf.json`
sidecar config + a Rust command wrapper). Serve / browser builds
keep "bring your own scsynth" semantics.

### 5. Test coverage for `src/`

The two workspace packages have parity tests. The app itself has
zero. The pieces that absorbed real debugging cycles are the ones
worth pinning:

- `EnvelopeBuffer` — append a known signal, snapshot, verify
  min/max columns.
- `WavMemoryWriter` — append known frames, finalise, parse the
  resulting WAV header.
- Worker recording dispatch (post-buffer-refactor, on main) —
  mock the chunk stream, fire a sequence of tick events with a
  dropped reply, assert reorder + gap accounting.
- `BufferManager` — refcount semantics under interleaved
  acquire/release.

Vitest is already set up in workspace packages.

**Cost:** ~1 day.

### 6. Persistent UI settings

`localStorage` per-session: last-used scsynth address (already
done), preferred chunkSize, channel count, recording bus, window
size.

**Cost:** ~½ day.

### 7. Bus naming / labelling

A small label registry — "synth out", "FX return", "monitor mix" —
would let recordings + scopes show meaningful names instead of
ad-hoc memorisation. The bus number stays the source of truth;
the label is purely UI.

**Cost:** ~½ day.

### 8. Per-scope/recording independent pause

Today `/n_run 0` on the parent group freezes everything. Sometimes
you want to pause one scope while keeping the rest running.
Implementable as `/n_run 0 nodeId` on the specific synth, with
state tracked per-controller.

**Cost:** ~½ day.

### 9. Spectrogram waterfall

After #1, accumulate FFT magnitudes column-by-column into a 2-D
canvas — a scrolling waterfall. Particularly nice for visualising
drift, slow modulators, or transient content over time.

**Cost:** ~1 day, after #1.

---

## Milestone Summary

Both workspace packages (`@sc-app/server-commands`,
`@sc-app/synthdef-compiler`) shipped before phase 0 began,
eliminating the largest sources of risk the original spec budgeted
for (no encoder/decoder bring-up, no SynthDef wire-format
debugging).

| Phase | What ships | Status |
|---|---|---|
| 0 | Tauri skeleton + WS↔UDP bridge + `serve` CLI | shipped |
| 1 | Connect Screen + Worker transport + raw bytes | shipped |
| 2 | Typed command/reply proxy + `cmd.ts` helpers + `sendAndSync` | shipped |
| 3 | SynthDef compile + `/d_recv` correlation + registry | shipped |
| 4 | Parent group + `/n_run` + atomic paused-on-create | shipped |
| 5 | Global clock + tick stream + `tick0Ms` anchor | shipped |
| 6 | Shared phasor on clockBus | shipped |
| 7 | Scope SynthDef writing, manual poke verified | shipped |
| 8 | Tick-driven `/b_getn` loop + offset-keyed pending | shipped |
| 9 | Single-channel canvas renderer | shipped |
| 10 | Multi-channel stacked lanes | shipped |
| 11 | Multi-scope, add/remove | shipped |
| 12 | Recording pipeline (in-memory Blob, gap handling) | shipped |
| 13 | UI polish + runtime sampleRate + global chunkSize + paused-by-default + heartbeat + footer | shipped |
| 14 | Recording waveform view (envelope buffer + scrollable canvas) | shipped |
| 15 | Source Synths panel (producer/consumer split + waveform select + range sliders) | shipped |
| 16 | `BufferController` + `BufferManager` scaffolding | pending |
| 17 | Worker subscription protocol pivot | pending |
| 18 | Unify tap synthdefs | pending |
| 19 | Migrate `ScopeController` onto `BufferManager` | pending |
| 20 | Migrate `RecordingController` (WAV writer relocates to main) | pending |
| 21 | AppShell wiring + teardown + docs | pending |

The **critical spine** is Phase 0 through Phase 8 — everything
after that is rendering, UX, recording, and refactoring.
