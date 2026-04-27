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

Phase 16+ is the upcoming **Shared Buffer Layer** refactor. Phase
ordering is provisional; subphases may be merged or re-sequenced
as implementation reveals constraints.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architectural Principles](#architectural-principles)
3. [Audio Configuration Schema](#audio-configuration-schema)
4. [Workspace Packages](#workspace-packages)
5. [File Layout](#file-layout)
6. [Phase 16+ — Shared Buffer Layer Refactor (pending)](#phase-16--shared-buffer-layer-refactor-pending)
7. [Open Points](#open-points)
8. [Future Improvements](#future-improvements)
9. [Milestone Summary](#milestone-summary)

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
disconnected UX (still Future Improvement #3). Streaming-to-disk
recordings (still Future Improvement #2).

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
   accepted. **`channels` is typed as `number` (positive integer),
   not `1 | 2`** — the buffer / tap layer must not bake in a
   mono-or-stereo assumption. The `SynthsPanel`'s `mono | stereo`
   UX is a Phase-15 producer-side convention only and does not
   propagate downstream. Multichannel buses (≥3 channels — surround
   mixes, ambisonic, level-meter banks) are first-class.
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

### Open questions — resolved before phase 16

Originally tuning-knob open questions; resolved during the
pre-implementation walkthrough. Captured here so the rationale
survives the move to `history.md`.

1. **Push API vs pull store → ship both.** `BufferController`
   exposes `subscribe(cb): () => void` for push consumers
   (recording — needs every chunk, in order) and
   `latestChunk: ReadonlyStore<BufferChunk | null>` for pull
   consumers (scope — RAF reads "whatever's current"). Cost is
   negligible (one update + one fan-out loop on the hot path);
   forcing one shape on both would create real pain on whichever
   side it doesn't fit.
2. **`acquire` async → yes, with in-flight Promise cache.**
   `acquire(spec): Promise<BufferHandle>`. First acquirer awaits
   the `/b_alloc` + `/s_new` + `/sync` round-trip (~5–10 ms);
   subsequent acquirers on the same spec return a resolved
   Promise immediately. Race fix: cache the *in-flight*
   `Promise<BufferHandle>`, so two near-simultaneous `acquire`
   calls on the same spec await the same Promise rather than
   double-allocating. Mirrors `SynthManager.add`'s shape.
3. **Partial-failure handling → try-stop-rethrow inside
   `BufferController.start()`, map-insert AFTER `start()`
   resolves in `BufferManager.acquire()`.** `dispose()` is the
   single cleanup path (null-safe across every partial state).
   The post-`start()` insert prevents a parallel `acquire` from
   refcounting against a half-built entry. **Both invariants
   must be inline-commented** at the implementation site —
   listed in the Phase 16 "Required inline comments" subsection.
4. **`BufferManager.snapshot` debug surface → ship in phase 16.**
   `snapshot: ReadonlyStore<BufferSnapshot[]>` where
   `BufferSnapshot = {key, spec, refcount, bufnum, nodeId}`.
   Refreshed after every `acquire`/`release`/`dispose`. ~5
   lines, no consumer reads it yet — it lays the foundation for
   a future `BuffersPanel` (Future work) and catches refcount
   leaks visibly during normal operation, not just at teardown
   (which the Phase 21 safety log handles).

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
number, chunkSize}` where `channels` is a positive integer (no
mono / stereo lock-in — see Decision 2). Reactive: `bufnum`,
`nodeId`,
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

**Required inline comments.** Two invariants in this phase are
non-obvious from the code alone and MUST be documented in
comments at the implementation site:

1. **`BufferController.start()` try-stop-rethrow.** A failure
   between `/b_alloc` and `/s_new` (or between `/s_new` and
   `subscribeBuffer`) leaves partial server-side state. The
   catch block calls `await this.dispose()` to clean up
   uniformly — `dispose()` is null-safe across every partial
   state (no nodeId set, no bufnum set, etc.) precisely so this
   one path handles them all. Comment must explain *why
   `dispose()` is the single cleanup path*.
2. **`BufferManager.acquire()` map-insert AFTER `start()`
   resolves.** Inserting before `start()` would let a parallel
   `acquire(sameSpec)` find the half-built entry and refcount
   against it, giving consumers a handle to a buffer that may
   never come up. The post-`start()` insert closes that race;
   the in-flight Promise cache (Open Question 2's wrinkle)
   handles legitimate parallel `acquire` calls. Comment must
   explain *why the order matters*.

**Acceptance.** `yarn tsc --noEmit` clean. `yarn build` clean. New
files unreferenced (Vite tree-shakes them). No behavioural change
in the running app.

#### Files (as landed)

| File | Change |
|---|---|
| `src/buffer/BufferController.ts` | NEW. `BufferSpec`, `BufferChunk`, `BufferHandle`, `BufferControllerOptions`, `BufferController`. Full lifecycle: `start()` does `ensureLoaded` + `/b_alloc` + `/s_new` + `/sync`, `dispose()` does `/n_free` + `/b_free`, both idempotent + null-safe. Push/pull APIs (`subscribe(cb)` + `latestChunk` store). Tap synthdef = `compileScopeSynthDef` for now (Phase 18 swaps to `bufferTapSynthDef`). |
| `src/buffer/BufferManager.ts` | NEW. `BufferManagerOptions`, `BufferSnapshot`, `BufferManager`. Ref-counted `Map<key, {ctrl, refcount}>` plus in-flight `Map<key, Promise<BufferHandle>>` for parallel-acquire dedup. `acquire`/`release`/`clear`. `snapshot: ReadonlyStore<BufferSnapshot[]>` reactive store, refreshed on every state change. Per-acquire `BufferHandle` wrapper with double-release guard. `clear()` warns if non-empty (refcount-leak canary). |

**Adaptations from spec.**

- `BufferHandle` does **not** expose `bufnum` / `nodeId` stores —
  those are on `BufferController` itself (used by
  `BufferManager.refreshSnapshot`). Consumers don't need them; the
  `BuffersPanel` (future) reads them from the snapshot. Slimmer
  consumer surface.
- `BufferSnapshot` includes `bufferId` alongside `key/spec/refcount/
  bufnum/nodeId`, so a future `BuffersPanel` can render a stable
  identifier independent of the spec key.
- `BufferController.deliverChunk` is **public** (not private as the
  spec implied). Phase 17's worker dispatch needs to call it from
  outside the class to route chunks. Documented as the "integration
  seam for Phase 17."
- `BufferController` uses `compileScopeSynthDef` /
  `scopeSynthDefName` directly in Phase 16. Phase 18 will swap to
  `compileBufferTapSynthDef` — a one-line change in two import
  statements.
- `BufferManager.clear()` includes the refcount-leak warning the
  spec puts in Phase 21 — included now since the manager already
  has the surface; Phase 21 only needs to wire setup/teardown
  order.
- Worker subscription is a `// TODO Phase 17` placeholder in
  `start()` and `dispose()`. The chunk-delivery push/pull API
  exists but never fires until Phase 17 wires the worker dispatch.

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

#### Files (as landed)

| File | Change |
|---|---|
| `src/server/workerProtocol.ts` | REWRITTEN. `BufferSubscription` + `BufferChunk` replace `ScopeSubscription` / `ScopeChunk` / `RecordingSubscription` / `RecordingChunkWritten` / `RecordingGap` / `RecordingDone`. `MainToWorker` uses `subscribeBuffer` / `unsubscribeBuffer`; `WorkerToMain` emits `bufferChunk`. `BufferChunk` carries an `isGap: boolean` flag for retry-exhaustion zero-fills. |
| `src/workers/oscWorker.ts` | REWRITTEN. Single `Map<bufferId, BufferEntry>` with offset-keyed `pendingByOffset`, tick-ordered `reorderBuffer`, `nextDeliverableTick`. Lifted from the recording-side worker code, dropped the per-kind discriminator. WAV writer + recording-specific events removed. `OSC.Bundle(.. fireAt)` wrapping now applied uniformly to every read (recordings used to skip it — bonus alignment fix). |
| `src/workers/wavWriter.ts` | UNCHANGED. Worker no longer imports it; main thread does. Physical move to `src/recording/` deferred to Phase 20. |
| `src/server/WorkerClient.ts` | REWRITTEN. `subscribeBuffer(sub, cb): { unsubscribe }`. `Map<bufferId, Set<BufferChunkListener>>` for main-side fan-out. The worker only sees one `subscribeBuffer` per `bufferId` — `WorkerClient` posts on the first listener, `unsubscribeBuffer` on the last unsubscribe. Recording-specific listener registries removed. |
| `src/scope/ScopeController.ts` | Adapter shim: derives `bufferId = scope-${scopeId}`, calls `subscribeBuffer` with channels + chunkSize. Removed main-side `skipNext` flag — worker's default `skipFirstTick: true` does the same job upstream. `chunkRef` and `latestChunkStore` typed `BufferChunk`. |
| `src/recording/RecordingController.ts` | Substantial rewrite. Adapter shim: `bufferId = rec-${recordingId}`, retry policy passed through. Owns a main-side `WavMemoryWriter` (constructed in `start`, finalised synchronously in `stop`). `handleChunk` appends every chunk in arrival order (tick-ordered by the worker), stamps `gapList` entries when `chunk.isGap`. `stop()` now resolves directly from the finalised WAV — no round-trip wait on the (gone) `recordingDone` event. |
| `src/buffer/BufferController.ts` | Imports `BufferChunk` from `workerProtocol` (single source of truth). Local `BufferChunk` definition removed; `BufferChunk` re-exported for downstream convenience. |
| `src/ui/ScopeView/ScopeView.tsx` | `chunkRef: RefObject<BufferChunk \| null>`. ScopeView only reads `chunk.data` + `chunk.channels`, so the rename is purely type-level. |

**Adaptations from spec.**

- **Gap detection NOT temporarily lost.** The spec called for
  Phase 17 to drop gap detection until Phase 20 restored it. We
  shipped `BufferChunk.isGap: boolean` from day one — the worker
  still zero-fills on retry exhaustion (as it did) and the flag
  rides on the chunk; `RecordingController` materialises gaps
  on receipt. Sidecar JSON works, no parity regression. Phase 20
  is now a smaller change (no gap-detection plumbing to add).
- **No internal "adapter" data type.** The spec described the
  adapter shim as a per-controller `bufferId` allocator wrapping
  the existing `bufnum`. Nothing more was needed — the
  controllers each derive `bufferId` from their own stable id
  (`scope-${scopeId}`, `rec-${recordingId}`) at the call site,
  no separate adapter module.
- **Scope `skipNext` removed entirely.** Worker `skipFirstTick:
  true` (default on `BufferSubscription`) now drops the first
  /b_getn for every subscription, including scopes. Net effect:
  scopes save one OSC round-trip on subscribe (the read that was
  fired and discarded on main is no longer fired at all); behaviour
  identical from the user's seat.
- **Bundle-wrapped reads now uniform.** Scopes always wrapped
  `/b_getn` in an `OSC.Bundle` with `timetag = Date.now() +
  READ_DELAY_MS` to absorb kr-vs-ar slop; recordings used to
  send unbundled. The unified worker bundles every read — fixes
  a latent recording alignment quirk for free.
- **Bundle size shift.** Worker chunk shrunk from 38.58 KB →
  34.50 KB (lost the WAV writer + recording-specific dispatch
  branches). Main bundle grew from 537.48 KB → 538.27 KB
  (`WavMemoryWriter` now linked into main).
- **`RecordingController.gaps` getter retained.** The natural rename
  to avoid colliding with the private gap accumulator was
  `gapsList` for the getter, but `RecordingPanel` already binds
  to `rec.gaps`. Kept the public getter as `gaps`; renamed the
  private array to `gapList`.

### Phase 18 — Unify scope + recorder tap synthdefs

**Goal.** Replace `scopeSynthDef` and `recorderSynthDef` with a
single `bufferTapSynthDef`.

**`bufferTapSynthDef.ts`.** `compileBufferTapSynthDef(channels:
number, chunkSize: number)`. `channels` is a positive integer; the
compiler validates `Number.isInteger(channels) && channels >= 1`.
Cache key `(channels, chunkSize)`. Body verbatim from
`compileScopeSynthDef` — they're already byte-identical to
`recorderSynthDef`'s output (modulo synthdef name). Inspect with
`g_dumpTree` after to confirm one tap synthdef per combo, not two.

**Risks.** Synthdef byte-identity is asserted but not load-bearing
— if the two predecessors had subtle drift this masks it. Cross-
check `bufferTapSynthDef` bytes against both before deletion.

#### Files (as landed)

| File | Change |
|---|---|
| `src/synthdefs/bufferTapSynthDef.ts` | NEW. `compileBufferTapSynthDef(channels: number, chunkSize: number)` + `bufferTapSynthDefName`. Body lifted verbatim from the (byte-identical) predecessors. Synthdef name pattern: `bufferTap${channels}ch_${chunkSize}`. |
| `src/synthdefs/scopeSynthDef.ts` | DELETED. |
| `src/synthdefs/recorderSynthDef.ts` | DELETED. |
| `src/buffer/BufferController.ts` | Imports updated. |
| `src/scope/ScopeController.ts` | Imports updated. |
| `src/recording/RecordingController.ts` | Imports updated. |

**Adaptations.** Byte-identity confirmed by inspection of both
predecessors before deletion: same UGen graph (`In.ar(inBus,
channels)` → fan-out → `In.ar(clockBus, 1)` → `mod(phase, ring)` →
`BufWr.ar(sigs, bufnum, writeIdx)`), same default arg values
(`inBus = 0`, `bufnum = 0`, `clockBus = 0`), same control set.
Only the SynthDef name differed. Manual `g_dumpTree` verification
deferred to user smoke-testing.

Main bundle: 538.27 KB → 537.61 KB (one synthdef compiler instead
of two).

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
streaming-to-disk (Future Improvement #2) is a localised follow-up
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
   ordering considerations, not more. **Future-watch: the
   "consumer-before-producer" failure mode is not fixed here.** A
   consumer (scope / recording) added before any synth is
   producing on its bus reads stale bus values for ~1 control
   block until the producer is `/s_new`d. Today this is a
   non-issue because the UX flow ("read the bus number off a
   Synths card, then add a scope on it") naturally puts producers
   first. Scenarios that could bypass the natural ordering and
   resurface the bug: automated session restore, programmatic
   panel creation from external triggers, undo/redo across panels,
   a future "tee a recording from this scope" button that fires
   before the producer is confirmed alive. **Not addressed in
   Phase 16+.** When it lands, candidate fixes: (a) explicit
   `/g_head` placement of the tap after the producing synth's
   nodeId, requiring the buffer layer to learn which producer
   feeds each bus; (b) a "wait one tick after the producer's
   `/n_go` before delivering the first chunk" handshake;
   (c) an explicit silence-first-swap-in pattern at consumer add
   time. The invariant "a consumer must never run before its
   producer in the same control block" stays the rule even if the
   enforcement mechanism evolves.
5. **Recording vs. scope chunk semantics divergence.** Both consume
   the same `BufferChunk`. Scopes care about *liveness* (latest
   chunk); recording cares about *completeness* (every chunk in
   order, gaps explicit). The shared stream gives recording its
   in-order delivery for free. The synthetic gap chunk on retry
   exhaustion lets recording materialise gaps while scopes
   silently ignore them.
6. **Test coverage.** Future Improvement #5 is not in scope here,
   but this refactor is testable in isolation: `BufferManager`
   refcount, worker subscription dedup, recording gap detection.
   At minimum, fixture-style tests for `acquire` / `release` in
   phase 16.

### Future work this unlocks

Strictly out of scope for phase 16+ but the refactor enables:

1. **Spectral scope (FFT view)** (Future Improvement #1) — add an
   FFT analyzer that subscribes to a `BufferController`. No new
   tap synth or buffer needed.
2. **Level meters per bus** — another consumer subscribing to the
   same buffer.
3. **Tee-recording** — a single button on a scope card spawns a
   `RecordingController` on the same `BufferHandle`. Trivial
   after; awkward today.
4. **`BuffersPanel` debug UI** — live ref-count, bufnum, nodeId
   for every active tap. Diagnoses leaks visually.
5. **Streaming-to-disk recordings** (Future Improvement #2) — the
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

Phases 0–15 are shipped; their write-ups live in
[`history.md`](./history.md). The critical spine of the project
(Phase 0 through Phase 8) is fully in place; everything since has
been rendering, UX, recording, and refactoring.

Pending phases:

| Phase | What ships | Status |
|---|---|---|
| 16 | `BufferController` + `BufferManager` scaffolding | pending |
| 17 | Worker subscription protocol pivot | pending |
| 18 | Unify tap synthdefs | pending |
| 19 | Migrate `ScopeController` onto `BufferManager` | pending |
| 20 | Migrate `RecordingController` (WAV writer relocates to main) | pending |
| 21 | AppShell wiring + teardown + docs | pending |
