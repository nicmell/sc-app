# SCSynth Oscilloscope & Recorder — Plan

A browser-first web app (running equally well in Tauri) that drives
SuperCollider's `scsynth` to render live oscilloscopes of one or more
audio buses, synchronised by a global server-side clock, with optional
sample-accurate WAV recording of the same buses. The clock doubles as
a Start/Stop switch for all audio via the parent group's `/n_run`
flag.

This document is the **forward-looking** spec — project overview
plus pending and in-flight phases planned in detail (with open
questions, file maps, acceptance criteria, cross-cutting risks).
The historical record of shipped phases lives in
[`history.md`](./history.md); the Phase-discipline workflow (see
`CLAUDE.md`) moves each phase from this file to that one when it
ships, keeping `plan.md` small enough to re-read in full at the
start of each new phase.

No phase is currently in flight. The Shared Buffer Layer Refactor
(Phases 16–21) shipped and now lives in `history.md`. Future work
is captured in the Open Points and Future Improvements sections
below.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architectural Principles](#architectural-principles)
3. [Audio Configuration Schema](#audio-configuration-schema)
4. [Workspace Packages](#workspace-packages)
5. [File Layout](#file-layout)
6. [Open Points](#open-points)
7. [Future Improvements](#future-improvements)
8. [Milestone Summary](#milestone-summary)

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
   pressure. Streaming-to-disk (Future Improvement #2) addresses
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

Phases 0–21 are shipped; their write-ups live in
[`history.md`](./history.md). The critical spine of the project
(Phase 0 through Phase 8) is fully in place; everything since has
been rendering, UX, recording, refactoring, and the Phase 16–21
shared-buffer rework that turned the app into a one-tap-per-bus
multi-consumer pipeline.

No pending phases at the moment. See **Future Improvements**
above for follow-on candidates (spectral scope, streaming-to-disk
recordings, Tauri-managed scsynth lifecycle, etc.) and **Open
Points** for the still-relevant cross-cutting concerns that
weren't tied to a specific phase.
