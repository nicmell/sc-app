# SCSynth Oscilloscope & Recorder PoC — Full Implementation Plan

A browser-first web app (running equally well in Tauri) that drives SuperCollider's `scsynth` to render live oscilloscopes of one or more audio buses, synchronized by a global server-side clock, with optional sample-accurate WAV recording of the same buses. The clock doubles as a Start/Stop switch for all audio via the parent group's `/n_run` flag.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Configuration Schema](#core-configuration-schema)
3. [Assumptions & Dependencies](#assumptions--dependencies)
4. [File Layout](#file-layout)
5. [Phase 1 — Worker Transport (bytes only)](#phase-1--worker-transport-bytes-only)
6. [Phase 2 — Typed Command/Reply Proxy](#phase-2--typed-commandreply-proxy)
7. [Phase 3 — SynthDef Compile & Load](#phase-3--synthdef-compile--load)
8. [Phase 4 — Parent Group & `/n_run`](#phase-4--parent-group--n_run-plumbing)
9. [Phase 5 — Global Clock SynthDef (ticks only)](#phase-5--global-clock-synthdef-ticks-only)
10. [Phase 6 — Shared Phasor on Clock Bus](#phase-6--shared-phasor-on-clock-bus)
11. [Phase 7 — Scope SynthDef, Manual Poke](#phase-7--scope-synthdef-manual-poke)
12. [Phase 8 — Worker Tick-Driven Read Loop](#phase-8--worker-tick-driven-read-loop)
13. [Phase 9 — Single-Channel Renderer](#phase-9--single-channel-renderer)
14. [Phase 10 — Multi-Channel](#phase-10--multi-channel)
15. [Phase 11 — Multi-Scope](#phase-11--multi-scope)
16. [Phase 12 — Recording Pipeline](#phase-12--recording-pipeline)
17. [Phase 13 — UI Polish & Teardown](#phase-13--ui-polish--teardown)
18. [Open Points](#open-points)

---

## Architecture Overview

```
┌──────────────────────── Browser (Vite app) ────────────────────────┐
│                                                                      │
│  ┌────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │ Canvas × N │◄─┤ ScopeRenderer×N │◄─┤                         │   │
│  └────────────┘  └─────────────────┘  │                         │   │
│                                       │                         │   │
│  ┌────────────┐  ┌─────────────────┐  │    Scope Worker         │   │
│  │ WAV files  │◄─┤RecordingMgr     │◄─┤    - owns WebSocket     │   │
│  └────────────┘  └─────────────────┘  │    - scserver-commands  │   │
│                                       │      (encode + decode)  │   │
│  ┌────────────┐  ┌─────────────────┐  │    - clock tick router  │   │
│  │ Clock UI   │◄─┤ ClockController │◄─┤    - subscription table │   │
│  └────────────┘  └─────────────────┘  │    - recording writers  │   │
│                          ▲            └───────────┬─────────────┘   │
│                          │ typed cmds             │                 │
│                          └────────────────────────┼─────────────    │
│                                                   │                 │
│                                         ┌─────────▼────────────┐    │
│                                         │ WebSocket (binary)   │    │
│                                         └─────────┬────────────┘    │
└───────────────────────────────────────────────────┼─────────────────┘
                                                    │
                                           ┌────────▼────────┐
                                           │  WS ↔ UDP bridge│  (out of scope)
                                           └────────┬────────┘
                                                    │ UDP :57110
                                                    ▼
                                              ┌──────────┐
                                              │  scsynth │
                                              └──────────┘
```

**Key architectural principles:**

1. **Worker owns the WebSocket.** Main thread never touches `new WebSocket(...)` directly. All OSC traffic flows through typed `postMessage`.
2. **Typed proxy.** Main ↔ worker messages use typed structs from `scserver-commands`; raw bytes are confined to the worker.
3. **Global clock, single source of timing.** One `SendTrig` stream from a dedicated clock SynthDef. All scopes and recordings align to these ticks — no custom per-scope timing messages.
4. **Parent group as master switch.** Every synth (clock, scopes, recorders, audio sources) lives in one group. `/n_run 0/1` on that group pauses/resumes everything in lockstep.
5. **Alignment via shared phasor.** The clock publishes its phasor on an audio bus. Scope synths read it as their `BufWr` index → all scopes write in perfect sync → worker can derive chunk parity from `tickIndex` alone, no server-reported phase needed.
6. **Recordings reuse the tick stream.** Recorder synths run their own full-rate phasor (local, not from the clock bus) sized to `sampleRate / tickRate`. Each tick = one completed half-buffer. Same worker dispatch path as scopes; different downstream sink.

---

## Core Configuration Schema

The foundation every phase builds on. Three free parameters; everything else is derived. Validated at startup.

```ts
// src/config/clockConfig.ts

export interface AudioEnvironment {
  sampleRate: number;                  // 48000 — fixed by scsynth boot
}

export interface ClockParams {
  tickRate: number;                    // 48 Hz
  scopeChunkSize: number;              // 250 samples per scope frame (per channel)
  decimation: number;                  // 4 — scope-only downsampling factor
}

export interface ClockDerived {
  samplesPerTick: number;              // 1000 — recording chunk half, scope alignment
  scopeRingSize: number;                // 500 — scopeChunkSize * 2
  recordRingSize: number;               // 2000 — samplesPerTick * 2
  scopeWindowSeconds: number;           // 0.0208... — visible time window
  scopeEffectiveRate: number;           // 12000 — visual sample rate
  tickIntervalMs: number;               // 20.833... — for UI watchdogs
}

export function deriveClock(env: AudioEnvironment, params: ClockParams): ClockDerived {
  const samplesPerTick = env.sampleRate / params.tickRate;
  if (!Number.isInteger(samplesPerTick)) {
    throw new Error(
      `sampleRate (${env.sampleRate}) / tickRate (${params.tickRate}) must be integer`
    );
  }
  if (params.scopeChunkSize * params.decimation !== samplesPerTick) {
    throw new Error(
      `scopeChunkSize (${params.scopeChunkSize}) × decimation (${params.decimation}) ` +
      `must equal samplesPerTick (${samplesPerTick})`
    );
  }
  return {
    samplesPerTick,
    scopeRingSize: params.scopeChunkSize * 2,
    recordRingSize: samplesPerTick * 2,
    scopeWindowSeconds: params.scopeChunkSize * params.decimation / env.sampleRate,
    scopeEffectiveRate: env.sampleRate / params.decimation,
    tickIntervalMs: 1000 / params.tickRate,
  };
}

// App-wide defaults — the ONLY place these numbers appear.
export const DEFAULT_ENV: AudioEnvironment = { sampleRate: 48000 };
export const DEFAULT_PARAMS: ClockParams = {
  tickRate: 48,
  scopeChunkSize: 250,
  decimation: 4,
};
```

**Invariants no code may violate:**
- `samplesPerTick = sampleRate / tickRate` (integer).
- `scopeChunkSize × decimation = samplesPerTick`.
- `ringSize = chunkSize × 2` (double-buffering for both scope and recording).

---

## Assumptions & Dependencies

- **scsynth** running on UDP `127.0.0.1:57110` at 48 kHz. Not booted or managed by this app.
- **WS↔UDP bridge** running; endpoint at `VITE_OSC_WS_URL` (default `ws://127.0.0.1:8080`). 1 WS binary frame ↔ 1 UDP datagram. Out of scope here; can be a dev Node script, a Tauri Rust sidecar, etc.
- **`scsynthdef-compiler`** and **`scserver-commands`** are TS/wasm crates exposing:
  - SynthDef compilation via a UGen graph API.
  - OSC command encoding (typed structs → bytes) and reply decoding (bytes → tagged union).
  - Exact type surfaces TBD — see Open Points.
- **Vite** + TypeScript strict mode.
- **Framework-agnostic UI** in this plan. Code uses plain DOM helpers; porting to React/Solid/Svelte is a wrapper exercise.
- **File System Access API** for WAV writing (Phase 12). Works in Chromium-based browsers and Tauri webviews. Fallback: in-memory accumulation.

---

## File Layout

Final structure after all phases:

```
src/
  config/
    clockConfig.ts                   # ClockParams, deriveClock, defaults
  workers/
    scopeWorker.ts                   # Vite ?worker entry
    transport.ts                     # WS wrapper (worker-internal)
    subscriptionTable.ts             # scope + recording subscription registry
    wavWriter.ts                     # streaming WAV encoder (worker-side)
  scope/
    workerProtocol.ts                # typed main ↔ worker messages
    WorkerClient.ts                  # main-thread wrapper around Worker
    IdAllocator.ts                   # node / buffer / bus ID counters
    SynthDefRegistry.ts              # tracks loaded SynthDefs
    GroupController.ts               # parent group lifecycle
    ClockController.ts               # extends GroupController; owns clock synth
    ScopeController.ts               # one per scope
    ScopeManager.ts                  # collection of scopes
    ScopeRenderer.ts                 # canvas RAF loop
    reactiveStore.ts                 # tiny observable helper
  recording/
    RecordingController.ts           # one per recording
    RecordingManager.ts              # collection of recordings
  synth/
    clockSynthDef.ts                 # globalClock
    scopeSynthDef.ts                 # scopeTap
    recorderSynthDef.ts              # recorderTap
    testToneSynthDef.ts              # dev: sine on a bus
    testToneStereoSynthDef.ts        # dev: asymmetric stereo
    phaseProbeSynthDef.ts            # dev: reads clockBus via SendTrig
    silentTestSynthDef.ts            # dev: heartbeat via SendTrig
  ui/
    OscConsole.ts                    # dev: raw byte / typed command console
    SynthDefPanel.ts                 # dev: load synthdefs button
    PhaseProbePanel.ts               # dev: clockBus readout
    ScopePokerPanel.ts               # dev: manual /b_getn
    ScopeDebugPanel.ts               # dev: chunk numeric readout
    ClockPanel.ts                    # Start/Stop + tick + elapsed
    ScopeView.ts                     # one canvas + header
    ScopeList.ts                     # add/remove scopes
    RecordingPanel.ts                # recording controls + progress
    styles.css
  main.ts                            # boots everything, mounts UI
```

Files prefixed `dev:` should be gated behind a `?debug` URL flag or a `VITE_DEBUG=1` env flag.

---

## Phase 1 — Worker Transport (bytes only)

**Goal.** WebSocket lives inside a dedicated Web Worker. Main thread talks to the worker via `postMessage` with raw byte payloads. Validates worker plumbing in isolation from OSC typing.

### Files

- `src/workers/scopeWorker.ts` — worker entry
- `src/workers/transport.ts` — WS wrapper, worker-internal
- `src/scope/workerProtocol.ts` — shared types (bytes-only version)
- `src/scope/WorkerClient.ts` — main-thread handle
- `src/scope/reactiveStore.ts` — minimal observable
- `src/ui/OscConsole.ts` — dev console

### `workerProtocol.ts`

```ts
export type MainToWorker =
  | { type: 'connect'; url: string }
  | { type: 'disconnect' }
  | { type: 'send'; bytes: Uint8Array };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'recv'; bytes: Uint8Array };
```

### `reactiveStore.ts`

A 20-line observable helper used throughout. Exposes `get()`, `set()`, `subscribe(cb): unsubscribe`. Plain callbacks, no framework dependency.

### `transport.ts` (worker-internal)

```ts
export interface OscTransport {
  send(bytes: Uint8Array): void;
  onMessage(cb: (bytes: Uint8Array) => void): () => void;
  close(): Promise<void>;
  readonly ready: Promise<void>;
}
export function createOscTransport(url: string): OscTransport;
```

- `new WebSocket(url)`; `binaryType = 'arraybuffer'`.
- `ready` resolves on `open`, rejects on immediate error.
- `send(bytes)` calls `ws.send(bytes)` — one frame per call.
- `onMessage(cb)` registers; returns unsubscribe.
- No reconnection.
- `close()` awaits close event.

### `scopeWorker.ts`

On `connect`: create transport, await ready, post `ready`. On incoming WS frame: `postMessage({ type: 'recv', bytes }, [bytes.buffer])` — transfer buffer. On `send`: forward. On `disconnect` or any error: post `error` with message, close transport.

### `WorkerClient.ts` (main thread)

```ts
export class WorkerClient {
  constructor(url: string);
  readonly ready: Promise<void>;
  send(bytes: Uint8Array): void;
  onRecv(cb: (bytes: Uint8Array) => void): () => void;
  onError(cb: (err: string) => void): () => void;
  dispose(): void;
}
```

- Constructs `new Worker(new URL('../workers/scopeWorker', import.meta.url), { type: 'module' })`.
- Posts `connect`; `ready` resolves on `ready` event.
- `send` posts `{ type: 'send', bytes }` with buffer transferred.
- `dispose` posts `disconnect`, then `worker.terminate()`.

### `OscConsole.ts`

- Textarea for hex input.
- Send button.
- Log panel showing direction, timestamp, length, first 32 bytes in hex.

### Acceptance

1. Page loads, DevTools → Application → Workers shows `scopeWorker`; Network shows WS on worker thread.
2. Paste hex for `/status`, click Send → `recv` log entry within ~100 ms.
3. Call `client.dispose()` via console → WS closes; new `WorkerClient` works from scratch.
4. Kill the bridge mid-session → `error` event logged; sends fail cleanly.

---

## Phase 2 — Typed Command/Reply Proxy

**Goal.** Replace raw bytes with typed structs at the worker boundary.

### Files touched

- `src/scope/workerProtocol.ts` — typed version
- `src/workers/scopeWorker.ts` — encode/decode
- `src/scope/WorkerClient.ts` — typed API
- `src/ui/OscConsole.ts` — structured form UI

### `workerProtocol.ts` (typed)

```ts
import type { ScsynthCommand, ScsynthReply } from 'scserver-commands';

export type MainToWorker =
  | { type: 'connect'; url: string }
  | { type: 'disconnect' }
  | { type: 'command'; command: ScsynthCommand };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'error'; message: string; cause?: unknown }
  | { type: 'reply'; reply: ScsynthReply };
```

### Worker changes

On `command`: `transport.send(encode(command))`. On incoming bytes: try `decode(bytes)` → `reply`; on failure post `error`, don't crash.

### `WorkerClient` changes

```ts
sendCommand(cmd: ScsynthCommand): void;
onReply(cb: (reply: ScsynthReply) => void): () => void;

// Correlation helper used throughout the app
async sendAndSync(cmd: ScsynthCommand, timeoutMs = 2000): Promise<void>;
```

`sendAndSync` sends `cmd`, then a `/sync` with a unique id, and resolves when the matching `/synced` reply arrives. Timeout rejects. This is the primary way SynthDefs and buffers get created reliably — `/d_recv` and similar have no built-in correlation.

### `OscConsole.ts` upgraded

- Dropdown of commands: `Status`, `QueryTree`, `DumpOSC`, `Sync`.
- Per-command form fields for args.
- Log panel pretty-prints decoded replies as JSON.

### Acceptance

1. Select `Status`, Send → `StatusReply` variant logged with populated fields.
2. `DumpOSC(1)` → subsequent replies still decode; no stream corruption.
3. Bad command object (forced in code) → `error` event; worker survives.
4. Random garbage injected into WS → `error` per frame; worker survives.
5. `sendAndSync(Status)` resolves within ~50 ms.

---

## Phase 3 — SynthDef Compile & Load

**Goal.** Validate the compile-and-upload path end-to-end with a trivial SynthDef.

### Files

- `src/synth/noopSynthDef.ts`
- `src/scope/SynthDefRegistry.ts`
- `src/ui/SynthDefPanel.ts`

### `noopSynthDef.ts`

Trivial graph: `Out.ar(0, DC.ar(0))`. Compiled once, result cached.

```ts
export function compileNoopSynthDef(): Uint8Array;
```

### `SynthDefRegistry.ts`

```ts
export class SynthDefRegistry {
  constructor(private client: WorkerClient);
  isLoaded(name: string): boolean;
  async ensureLoaded(name: string, bytes: Uint8Array): Promise<void>;
}
```

`ensureLoaded`: if already tracked, no-op. Otherwise `client.sendAndSync(DRecv(bytes))`. On success, mark loaded. On `/fail`, reject with the failure message.

### `SynthDefPanel.ts`

One button "Load noop SynthDef". Status label. On click: `registry.ensureLoaded('noop', compileNoopSynthDef())`. Shows spinner → ✓ or error.

### Acceptance

1. Click → ✓ within ~50 ms.
2. Second click → no OSC traffic (observable in the Phase 1 byte log if re-enabled).
3. Corrupt bytes (force-flip) → `Fail` reply → UI error; registry does not mark loaded.
4. Kill scsynth, reload page → click works again.

---

## Phase 4 — Parent Group & `/n_run` Plumbing

**Goal.** Prove group create/pause/resume/free. First visual state indicator in the UI.

### Files

- `src/scope/IdAllocator.ts`
- `src/scope/GroupController.ts`
- `src/synth/silentTestSynthDef.ts` (dev)
- `src/ui/ClockPanel.ts` (first version)
- `src/ui/styles.css`

### `IdAllocator.ts`

```ts
export class IdAllocator {
  constructor(base: number);
  next(): number;
}
```

Three instances in `main.ts`:
```ts
const ids = {
  node: new IdAllocator(1000),
  buffer: new IdAllocator(1000),
  bus: new IdAllocator(32),   // skip hardware-reserved buses
};
```

### `silentTestSynthDef.ts`

Heartbeat synth: `SendTrig.kr(Impulse.kr(5), 9999, PulseCount.kr(Impulse.kr(5)))`. Used only in this phase to visually prove `/n_run` affects its children.

### `GroupController.ts`

```ts
export type GroupState = 'stopped' | 'running' | 'paused' | 'disconnected';

export class GroupController {
  constructor(
    protected client: WorkerClient,
    protected parentGroupId: number,
  );
  readonly state: ReadonlyStore<GroupState>;

  async ensureCreated(): Promise<void>;   // idempotent; creates group as running
  async pause(): Promise<void>;           // NRun(parentGroupId, 0); state → 'paused'
  async resume(): Promise<void>;          // NRun(parentGroupId, 1); state → 'running'
  async free(): Promise<void>;            // GFreeAll + NFree; state → 'stopped'
  async queryTree(): Promise<ScsynthReply>;
}
```

Convention: group is created as running. "Start/Stop" toggles `/n_run`. Disconnection is tracked by listening to `WorkerClient.onError` → state → `'disconnected'`.

### `ClockPanel.ts` — v1

Renders:
- **State pill.** `● Running` / `⏸ Paused` / `○ Stopped` / `⚠ Disconnected`. Colored.
- **Start/Stop button.** Label and action depend on state. Disabled when `disconnected`.
- **Heartbeat readout** (dev only). Count of `/tr` with `trigId === 9999` in the last second.

Fixed position, top-right. CSS in `styles.css`.

### `main.ts` wiring (Phase 4 state)

```ts
const client = new WorkerClient(import.meta.env.VITE_OSC_WS_URL);
await client.ready;
const registry = new SynthDefRegistry(client);
const group = new GroupController(client, 100);  // group 100, placeholder

await registry.ensureLoaded('silentTest', compileSilentTestSynthDef());
await group.ensureCreated();
await client.sendAndSync(SNew('silentTest', ids.node.next(), /* addToHead */ 0, 100));

const panel = new ClockPanel(group, client);
document.body.append(panel.el);
```

### Acceptance

1. First Start → state → `Running`; heartbeat ~5 Hz.
2. Stop → state → `Paused`; heartbeat → 0 within ~200 ms.
3. Start again → heartbeat resumes at ~5 Hz; underlying counter continues (visible in logs if displayed).
4. `QueryTree` button → confirms group 100 contains the heartbeat synth.
5. Kill bridge → state → `Disconnected` within ~1 s; buttons disabled.

---

## Phase 5 — Global Clock SynthDef (ticks only)

**Goal.** Replace the sacrificial heartbeat with the real clock. UI shows `tickIndex` and elapsed time.

### Files

- `src/config/clockConfig.ts` — imported now
- `src/synth/clockSynthDef.ts` — v1 (ticks only)
- `src/scope/ClockController.ts`
- `src/ui/ClockPanel.ts` — extended

### `clockSynthDef.ts` v1

```
SynthDef("globalClock", {
    arg tickRate = 48, trigId = 1000;
    var tick    = Impulse.kr(tickRate);
    var counter = PulseCount.kr(tick);
    SendTrig.kr(tick, trigId, counter);
}).add;
```

`tickRate = 48` per config. `trigId = 1000` — reserved; no other synth may use it.

### `workerProtocol.ts` additions

```ts
export interface ClockTick {
  tickIndex: number;
  receivedAt: number;   // performance.now() in worker
}

// MainToWorker:
| { type: 'registerClock'; trigId: number }
| { type: 'unregisterClock' }

// WorkerToMain:
| { type: 'clockTick'; tick: ClockTick }
```

### Worker changes

On `registerClock`: remember `trigId`. On decoded `Trigger` reply with matching `trigId`: emit `clockTick`, **suppress** the generic `reply` for that message. Other trigger IDs pass through normally.

### `ClockController.ts`

Extends `GroupController`:

```ts
export class ClockController extends GroupController {
  constructor(
    client: WorkerClient,
    parentGroupId: number,
    private registry: SynthDefRegistry,
    private ids: IdAllocators,
    readonly env: AudioEnvironment,
    readonly params: ClockParams,
  );

  readonly derived: ClockDerived;         // deriveClock(env, params)
  readonly lastTick: ReadonlyStore<ClockTick | null>;

  async start(): Promise<void>;            // ensureSynthDef; ensureCreated; SNew clock at head; register
  async stop(): Promise<void>;             // pause (inherits GroupController)
  async resume(): Promise<void>;           // resume
  async reset(): Promise<void>;            // free clock synth, re-create → tickIndex back to 0

  onTick(cb: (tick: ClockTick) => void): () => void;
}
```

Watchdog for tick freshness: `setInterval` every `tickIntervalMs / 2` ms; if no tick in `2 × tickIntervalMs` ms while state is `running`, temporarily surface as `paused` until either a tick arrives or WS closes. Prevents a "running but silent" lie.

### `ClockPanel.ts` v2

```
┌────────────────────────────────────────────────────────┐
│  ● Running   00:12.417   tick 596   [● Stop]  [Reset] │
└────────────────────────────────────────────────────────┘
```

- State pill (same).
- **Elapsed time.** Computed purely from ticks: `tickIndex / tickRate` → `mm:ss.mmm`. No wall clock.
- **Tick counter.** Raw `tickIndex`, monospaced.
- **Pulse dot.** Brief CSS flash on every tick arrival.
- **Start/Stop.** Toggles resume/pause.
- **Reset.** Calls `reset()` → tick back to 0.

### Acceptance

1. Start → tick increments at 48 Hz (verify: 480 ticks in 10 s ±1); elapsed time tracks real time; pulse dot flashes.
2. Stop → tick freezes; elapsed freezes.
3. Start → resumes from frozen tick (not from 0).
4. Reset → tick → 0.
5. 5-minute stress: drift < 1 tick.
6. Kill bridge → pill → `Disconnected`; watchdog may first show `Paused`, acceptable.
7. Register wrong `trigId` → no ticks reach UI; other replies unaffected.

---

## Phase 6 — Shared Phasor on Clock Bus

**Goal.** Extend clock with a shared audio-rate phasor on a bus. Verify via a diagnostic synth.

### Files

- `src/synth/clockSynthDef.ts` — v2 (adds phasor)
- `src/synth/phaseProbeSynthDef.ts` (dev)
- `src/scope/ClockController.ts` — now allocates clock bus
- `src/ui/PhaseProbePanel.ts` (dev)

### `clockSynthDef.ts` v2

```
SynthDef("globalClock", {
    arg clockBus = 0, tickRate = 48, scopeChunkSize = 250, decimation = 4, trigId = 1000;

    var tick, counter, sampleTick, phase;

    // Tick path — unchanged from v1
    tick    = Impulse.kr(tickRate);
    counter = PulseCount.kr(tick);
    SendTrig.kr(tick, trigId, counter);

    // Shared phasor path
    sampleTick = Impulse.ar(SampleRate.ir / decimation);
    phase      = Phasor.ar(0, sampleTick, 0, scopeChunkSize * 2);
    Out.ar(clockBus, phase);
}).add;
```

**Alignment:** at `sampleRate=48000, decimation=4, scopeChunkSize=250`, `phase` advances once every 4 audio samples, wraps at 500. `tickRate=48` → 1000 audio samples between ticks → phase advances 250 → exactly one half completed per tick. ✓

### `ClockController` changes

On `start`: allocate `clockBus = ids.bus.next()`; pass to SynthDef args.

### `phaseProbeSynthDef.ts`

```
SynthDef("phaseProbe", {
    arg clockBus = 0, replyRate = 10, trigId = 9001;
    var phase = In.ar(clockBus, 1);
    var tick  = Impulse.kr(replyRate);
    SendTrig.kr(tick, trigId, A2K.kr(phase));
}).add;
```

Placed at tail of parent group so it reads after the clock writes on the same control block.

### `PhaseProbePanel.ts` (dev)

- "Start probe" / "Stop probe" toggle.
- Monospace readout of current phase value.
- Optional mini sparkline of last N values.
- Hidden unless `?debug` flag.

### Acceptance

1. Start clock, start probe → phase values saw 0 → 499 → 0 at ~12 kHz (sampled at 10 Hz, so you see the saw "striped").
2. `QueryTree` shows clock first, probe after, in the same group.
3. Stop → probe freezes. Start → resumes from frozen value.
4. At each clock tick, probe's subsequent samples cluster near 0 or 250 (the half boundaries).
5. Probe with `clockBus` pointed at a wrong bus → reads zeros.

---

## Phase 7 — Scope SynthDef, Manual Poke

**Goal.** Scope synth writes its buffer correctly. Verify with manual `/b_getn`.

### Files

- `src/synth/scopeSynthDef.ts`
- `src/synth/testToneSynthDef.ts`
- `src/scope/BufferPoker.ts`
- `src/ui/ScopePokerPanel.ts`

### `scopeSynthDef.ts`

```
SynthDef("scopeTap", {
    arg in = 0, bufnum = 0, clockBus = 0, channels = 1;
    var sig   = In.ar(in, channels);
    var phase = In.ar(clockBus, 1);
    BufWr.ar(sig, bufnum, phase);
}).add;
```

No `SendReply`, no trigger output. Timing comes exclusively from the global clock's `SendTrig`.

**Behavior note.** `BufWr.ar` writes every audio sample, using `phase` as the index. `phase` advances once every `decimation` samples (from the clock), so each buffer slot is overwritten `decimation` times per advance. The net effect: each slot holds the *last* of those `decimation` samples (a zero-order-hold decimation). For a scope, this is fine and visually indistinguishable from proper sinc-decimated data above the alias frequency. Accept as the PoC behavior; document; revisit only if aliasing artifacts are visible.

### `testToneSynthDef.ts`

```
SynthDef("testTone", {
    arg out = 0, freq = 440, amp = 0.2;
    Out.ar(out, SinOsc.ar(freq) * amp);
}).add;
```

Placed on a private bus (bus 16+) so it doesn't go to hardware.

### `BufferPoker.ts`

```ts
export class BufferPoker {
  constructor(private client: WorkerClient);
  async poke(bufnum: number, offset: number, count: number): Promise<Float32Array>;
}
```

Sends `BGetN(bufnum, offset, count)`; awaits `/b_setn` with matching `bufnum`. Serializes pokes per bufnum (simple queue).

### `ScopePokerPanel.ts`

Controls: input bus, scope channels, create/destroy scope buttons, Poke button. Log shows returned array: length, min/max, first 8 values.

### Acceptance

1. Test tone on bus 16 (440 Hz, amp 0.2), scope on bus 16 into bufnum 1000 (`scopeRingSize=500`, channels=1). Poke → min ≈ -0.2, max ≈ 0.2, values look sinusoidal.
2. Stop clock → poke returns same array repeatedly (buffer frozen).
3. Start → poke returns updated values.
4. Scope pointed at empty bus 17 → poke returns all zeros.
5. NFree + BFree → poke returns `/fail`.

---

## Phase 8 — Worker Tick-Driven Read Loop

**Goal.** Worker automatically reads completed chunks on every tick. Emits typed `scopeChunk` events. No rendering yet.

### Files

- `src/workers/scopeWorker.ts` — extended
- `src/workers/subscriptionTable.ts`
- `src/scope/workerProtocol.ts` — scope events
- `src/scope/WorkerClient.ts` — scope API
- `src/scope/ScopeController.ts`
- `src/ui/ScopeDebugPanel.ts`

### Protocol additions

```ts
export type ScopeId = string;

export interface ScopeSubscription {
  scopeId: ScopeId;
  bufnum: number;
  channels: number;
  // chunkSize comes from registerClock — not repeated here
}

export interface ScopeChunk {
  scopeId: ScopeId;
  data: Float32Array;     // length = chunkSize * channels, interleaved
  channels: number;
  tickIndex: number;
}

// MainToWorker:
| { type: 'subscribeScope'; subscription: ScopeSubscription }
| { type: 'unsubscribeScope'; scopeId: ScopeId }

// WorkerToMain:
| { type: 'scopeChunk'; chunk: ScopeChunk }
```

`registerClock` expands:

```ts
| { type: 'registerClock'; trigId: number; scopeChunkSize: number; samplesPerTick: number }
```

### `subscriptionTable.ts`

```ts
interface ScopeEntry {
  kind: 'scope';
  scopeId: ScopeId;
  bufnum: number;
  channels: number;
  parity: 0 | 1;
  pendingRead: { tickIndex: number } | null;
}

// (Phase 12 adds RecordingEntry with the same shape + extras.)

export class SubscriptionTable {
  addScope(entry: ScopeEntry): void;
  removeScope(scopeId: ScopeId): void;
  byBufnum(bufnum: number): ScopeEntry | RecordingEntry | null;
  allEntries(): Iterable<ScopeEntry | RecordingEntry>;
  seedParity(currentTickIndex: number): void;  // called on add mid-run
}
```

### Worker tick handler

On clock `/tr` matching registered `trigId`:

```
emit clockTick to main
for each subscription:
    completedHalf = (tickIndex % 2 === 1) ? 0 : 1    // see parity note below
    offset = completedHalf * chunkSize * channels
    count  = chunkSize * channels
    send BGetN(bufnum, offset, count)
    subscription.pendingRead = { tickIndex }
    subscription.parity ^= 1
```

**Parity.** Clock starts at `phase = 0`. First tick fires at phase crossing `chunkSize` → first half `[0, chunkSize)` just completed → read first half. So `tickIndex === 1` → read half 0. `tickIndex === 2` → read half 1. → `completedHalf = 1 - (tickIndex % 2)`. Verify empirically in acceptance test; flip bit if off.

**chunkSize** per subscription: scopes use `scopeChunkSize` from `registerClock`; recordings (Phase 12) use `samplesPerTick`.

### On incoming `/b_setn`

```
entry = table.byBufnum(bufnum)
if no entry: forward as generic reply
if no pendingRead: log warning, drop
tickIndex = entry.pendingRead.tickIndex
entry.pendingRead = null
data = Float32Array from reply
if entry.kind === 'scope':
    postMessage({ type: 'scopeChunk', chunk: { scopeId, data, channels, tickIndex } }, [data.buffer])
```

### Mid-run subscribe

On `subscribeScope` while clock is running, seed `parity` from current `tickIndex`:
```
parity = (tickIndex % 2)   // so the next tick flips it to the correct first half
```
First tick after subscribe → reads the half that just completed, exactly as a new clock-start subscription would.

### `WorkerClient` additions

```ts
registerClock(trigId: number, chunkSize: number, samplesPerTick: number): void;
subscribeScope(sub: ScopeSubscription): void;
unsubscribeScope(scopeId: ScopeId): void;
onScopeChunk(scopeId: ScopeId, cb: (chunk: ScopeChunk) => void): () => void;
onTick(cb: (tick: ClockTick) => void): () => void;
```

Internal dispatch: the client keeps a `Map<ScopeId, Set<cb>>` for per-scope chunk callbacks.

### `ScopeController.ts`

```ts
export class ScopeController {
  constructor(
    private client: WorkerClient,
    private clock: ClockController,
    private registry: SynthDefRegistry,
    private ids: IdAllocators,
    readonly scopeId: ScopeId = crypto.randomUUID(),
  );

  readonly latestChunk: ReadonlyStore<ScopeChunk | null>;

  async start(opts: { inputBus: number; channels: number }): Promise<void>;
  async stop(): Promise<void>;
}
```

`start`:
1. `registry.ensureLoaded('scopeTap', ...)`.
2. `bufnum = ids.buffer.next()`; `nodeId = ids.node.next()`.
3. `client.sendAndSync(BAlloc(bufnum, clock.derived.scopeRingSize, channels))`.
4. `client.send(SNew('scopeTap', nodeId, /* addToTail */ 1, clock.parentGroupId, { in: inputBus, bufnum, clockBus: clock.clockBus, channels }))`.
5. `client.subscribeScope({ scopeId, bufnum, channels })`.
6. `client.onScopeChunk(scopeId, chunk => latestChunk.set(chunk))`.

`stop`: unsubscribe; `NFree`; `BFree`. Idempotent.

### `ScopeDebugPanel.ts`

Line per update: `scope-1 | bufnum 1000 | tick 373 | len 250 | min -0.19 max 0.20 | [0.12, 0.15, 0.18, ...]`. Plus rolling chunks/sec counter.

### Acceptance

1. Tone on bus 16, scope running → chunks arrive at ~48 Hz; `tickIndex` monotonic, contiguous.
2. **Waveform continuity.** Log last 4 samples of chunk N and first 4 of chunk N+1 → visually/numerically continuous. If discontinuous at every other boundary, parity is flipped; fix and retest.
3. Stop → chunks stop. Start → resume, `tickIndex` continues.
4. Fault injection (drop 1-in-20 `/tr` in the worker) → missing ticks logged; next chunk correct. No cascading failure.
5. Stop scope → QueryTree clean.
6. Subscribe mid-run after 10 s → first chunk's waveform is coherent, no glitch visible.

---

## Phase 9 — Single-Channel Renderer

**Goal.** Draw live waveform. Decouple data rate (48 Hz) from render rate (60 Hz).

### Files

- `src/scope/ScopeRenderer.ts`
- `src/ui/ScopeView.ts`

### `ScopeRenderer.ts`

```ts
export interface ScopeRendererOpts {
  gain?: number;
  strokeStyle?: string;
  background?: string;
}

export class ScopeRenderer {
  constructor(
    private canvas: HTMLCanvasElement,
    private scope: ScopeController,
    opts?: ScopeRendererOpts,
  );
  start(): void;
  stop(): void;
}
```

RAF loop:
1. Get `chunk = scope.latestChunk.get()`; if null, just clear background and return.
2. Handle DPR: `canvas.width = cssWidth * dpr`; `canvas.height = cssHeight * dpr`; `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)`.
3. Clear.
4. `ctx.beginPath()`; for `i` in `[0, chunkSize)`, `x = i / (chunkSize - 1) * cssWidth`, `y = (0.5 - data[i] * 0.5 * gain) * cssHeight`; `lineTo`.
5. `ctx.stroke()`.

### `ScopeView.ts`

Wraps renderer + header:
- Label: "scope-1 · bus 16".
- Tick stamp (small, corner): `t=596`.
- Remove button (placeholder wired in Phase 11).

200px tall by default; resizable via CSS.

### Acceptance

1. 440 Hz tone → 440 × 0.0208 ≈ 9.17 cycles visible per frame. Count cycles on screen, match ±1.
2. 880 Hz → 18 cycles.
3. Stop → waveform frozen on last chunk.
4. Retina display → crisp lines.
5. `gain: 5` → amplitude 5×.
6. 10-minute run → stable memory (no Float32Array retention beyond current chunk).

---

## Phase 10 — Multi-Channel

**Goal.** Interleaved multi-channel scope; stacked lanes.

### Files

- `src/synth/testToneStereoSynthDef.ts`
- `src/scope/ScopeRenderer.ts` — extended

### `testToneStereoSynthDef.ts`

```
SynthDef("testToneStereo", {
    arg out = 0, freqL = 440, freqR = 660, ampL = 0.2, ampR = 0.2;
    Out.ar(out, [SinOsc.ar(freqL) * ampL, SinOsc.ar(freqR) * ampR]);
}).add;
```

### `ScopeRenderer` extended

```ts
interface ScopeRendererOpts {
  // ...previous...
  layout?: 'stacked' | 'overlay';
  channelColors?: string[];
}
```

Stacked layout: divide canvas vertically into `channels` lanes. For channel `c`, lane top = `c * laneHeight`, zero line at `laneTop + laneHeight/2`; draw polyline using `data[i * channels + c]`.

Pipeline changes: none — `BufWr.ar` of a multi-channel signal into a `channels`-channel buffer writes interleaved natively; worker's `/b_setn` extract is already a flat `Float32Array` of length `chunkSize * channels`.

### Acceptance

1. Stereo `[440, 660]` → two visibly distinct lanes.
2. Swap L/R → lanes swap.
3. Interleaving check: log first 6 samples, expect `[L0, R0, L1, R1, L2, R2]`.
4. Mono regression still works.
5. 4-channel `[220, 330, 440, 550]` → 4 stacked lanes.

---

## Phase 11 — Multi-Scope

**Goal.** N concurrent scopes on N buses, sharing one clock + worker. Independent lifecycles, mid-run add/remove.

### Files

- `src/scope/ScopeManager.ts`
- `src/ui/ScopeList.ts`

### `ScopeManager.ts`

```ts
export class ScopeManager {
  constructor(
    private client: WorkerClient,
    private clock: ClockController,
    private registry: SynthDefRegistry,
    private ids: IdAllocators,
  );
  readonly scopes: ReadonlyStore<ScopeController[]>;
  async add(opts: { inputBus: number; channels: number; label?: string }): Promise<ScopeController>;
  async remove(scopeId: ScopeId): Promise<void>;
  async clear(): Promise<void>;
}
```

No worker-side changes — Phase 8's subscription table already handles N.

### `ScopeList.ts`

Toolbar: bus input, channels input, label input, Add button. Body: vertical list of `ScopeView` per scope, each with a working Remove. Footer: scope count; total chunks/sec.

### Acceptance

1. Two scopes, two buses, two different tones → two independent waveforms. Tick stamps match across scopes.
2. Stop → both freeze in sync. Start → both resume in sync.
3. Remove one → other unaffected.
4. Mid-run add (after 10 s) → new scope's first chunk coherent; parity seeding works.
5. 8 scopes (some sharing buses) → ~384 chunks/sec combined; no queue buildup.
6. Clear → only clock synth remains in parent group.

---

## Phase 12 — Recording Pipeline

**Goal.** Record one or more buses to sample-accurate, gap-reported WAV files. Fully synchronized with global clock — same tick drives every recording and scope.

### Files

- `src/synth/recorderSynthDef.ts`
- `src/workers/wavWriter.ts`
- `src/recording/RecordingController.ts`
- `src/recording/RecordingManager.ts`
- `src/ui/RecordingPanel.ts`
- Extensions to `workerProtocol.ts`, `scopeWorker.ts`, `WorkerClient.ts`, `subscriptionTable.ts`

### `recorderSynthDef.ts`

```
SynthDef("recorderTap", {
    arg in = 0, bufnum = 0, channels = 1, recChunkSize = 1000;
    var sig   = In.ar(in, channels);
    var phase = Phasor.ar(0, 1, 0, recChunkSize * 2);   // full audio-rate, local
    BufWr.ar(sig, bufnum, phase);
}).add;
```

`recChunkSize = samplesPerTick` (1000 here). The clock's tick fires every `samplesPerTick` audio samples. Recorder's phasor advances every audio sample, wraps at `2 × samplesPerTick`. Alignment: as long as the tick fires *after* the phasor crosses a half boundary, the tick marks a completed half.

**Mid-run start alignment.** When the recorder synth is added mid-run, its phasor starts at 0 at that instant. The next tick is up to `samplesPerTick` samples later. The first tick's "completed half" contains the initial portion of the recording — which may be a full half or less. Safer approach: on the first tick after a recording subscribes, **skip** the read. The second tick's read is a full, clean half. Record sample 0 of the WAV file as the sample at the start of that second-tick half. Tiny startup delay (≤ ~42 ms), but guarantees clean alignment.

### Protocol additions

```ts
export interface RecordingSubscription {
  recordingId: string;
  bufnum: number;
  channels: number;
  retry: { maxAttempts: number; deadlineMs: number };   // e.g. { 2, 12 }
}

export interface RecordingChunkWritten {
  recordingId: string;
  tickIndex: number;
  framesWritten: number;     // cumulative
}

export interface RecordingGap {
  recordingId: string;
  tickIndex: number;
  framesMissing: number;
}

export interface RecordingDone {
  recordingId: string;
  totalFrames: number;
  gaps: Array<{ tickIndex: number; framesMissing: number }>;
}

// MainToWorker:
| { type: 'startRecording'; subscription: RecordingSubscription; fileHandle: FileSystemFileHandle }
| { type: 'stopRecording'; recordingId: string }

// WorkerToMain:
| { type: 'recordingChunkWritten'; info: RecordingChunkWritten }
| { type: 'recordingGap'; gap: RecordingGap }
| { type: 'recordingDone'; done: RecordingDone }
```

### `subscriptionTable.ts` extended

```ts
interface RecordingEntry {
  kind: 'recording';
  recordingId: string;
  bufnum: number;
  channels: number;
  parity: 0 | 1;
  pendingRead: {
    tickIndex: number;
    seq: number;              // 0, 1, 2, ...
    attempts: number;
    timeoutHandle: ReturnType<typeof setTimeout>;
  } | null;
  nextSeqToWrite: number;     // for in-order WAV append
  reorderBuffer: Map<number, Float32Array>;
  retry: { maxAttempts: number; deadlineMs: number };
  writer: WavStreamWriter;
  skipFirstTick: boolean;     // true on subscribe, false after first tick observed
  gaps: Array<{ tickIndex: number; framesMissing: number }>;
  totalFrames: number;
}
```

### Worker dispatch updates

On tick, for each recording entry:

```
if entry.skipFirstTick:
    entry.skipFirstTick = false
    (do nothing this tick — let the recorder fill a full half)
else:
    issue BGetN for completed half
    entry.pendingRead = { tickIndex, seq: assign, attempts: 1, timeoutHandle: setTimeout(retry, deadlineMs) }
```

Retry callback:
```
if attempts < maxAttempts:
    re-send BGetN
    attempts++
    reschedule timeout
else:
    record gap: { tickIndex, framesMissing: samplesPerTick }
    write zeros of length samplesPerTick * channels
    pendingRead = null
    advance nextSeqToWrite
```

On `/b_setn` for a recording bufnum:
- Clear timeout, clear pendingRead.
- If `seq === nextSeqToWrite`: append to WAV, advance, drain reorder buffer if any successors waiting.
- If `seq > nextSeqToWrite`: store in reorder buffer.
- If `seq < nextSeqToWrite`: duplicate from retry, discard.

### `wavWriter.ts`

Streaming WAV encoder. Uses File System Access API when available, else accumulates in memory.

```ts
export class WavStreamWriter {
  constructor(
    fileHandle: FileSystemFileHandle,
    opts: { sampleRate: number; channels: number; bitDepth: 32 },  // float32
  );
  async open(): Promise<void>;         // writes placeholder header
  async append(frames: Float32Array): Promise<void>;  // interleaved
  async close(info: { gaps: RecordingGap[] }): Promise<void>;  // patches header sizes; writes sidecar .gaps.json
}
```

WAV format details:
- RIFF + WAVE chunks.
- `fmt ` subchunk: format code 3 (`WAVE_FORMAT_IEEE_FLOAT`), not 1 (PCM). Bit depth 32.
- `data` subchunk: raw Float32 little-endian interleaved samples.
- Header written with placeholder `RIFF size` and `data size` (zeros); patched on close. Total file size must fit in 32 bits — at 48 kHz stereo float32, that's ~3 hours 45 minutes. For longer, use RF64 (out of scope here; document the limit).
- Sidecar `.gaps.json` written alongside the `.wav` listing dropped tick ranges.

### `RecordingController.ts`

```ts
export class RecordingController {
  constructor(
    private client: WorkerClient,
    private clock: ClockController,
    private registry: SynthDefRegistry,
    private ids: IdAllocators,
    readonly recordingId: string = crypto.randomUUID(),
  );
  readonly state: ReadonlyStore<'idle' | 'preparing' | 'recording' | 'finalizing' | 'done' | 'error'>;
  readonly framesWritten: ReadonlyStore<number>;
  readonly gaps: ReadonlyStore<Array<{ tickIndex: number; framesMissing: number }>>;

  async start(opts: { inputBus: number; channels: number; fileHandle: FileSystemFileHandle }): Promise<void>;
  async stop(): Promise<void>;
}
```

`start`:
1. `registry.ensureLoaded('recorderTap', ...)`.
2. `bufnum = ids.buffer.next()`; `nodeId = ids.node.next()`.
3. `BAlloc(bufnum, recordRingSize, channels)` with sync.
4. `SNew('recorderTap', nodeId, /* addToTail */ 1, parentGroup, { in: inputBus, bufnum, channels, recChunkSize: samplesPerTick })`.
5. `client.startRecording({ subscription, fileHandle })`.
6. Subscribe to `recordingChunkWritten`, `recordingGap`, `recordingDone` for this `recordingId`; update reactive stores.

`stop`:
1. `client.stopRecording({ recordingId })` → worker finalizes the WAV (patches header, writes sidecar, closes file).
2. Await `recordingDone`.
3. `NFree`, `BFree`.

### `RecordingManager.ts`

```ts
export class RecordingManager {
  constructor(/* ... */);
  readonly recordings: ReadonlyStore<RecordingController[]>;
  async add(opts: { inputBus: number; channels: number }): Promise<RecordingController>;  // prompts for file location
  async remove(recordingId: string): Promise<void>;
  async stopAll(): Promise<void>;
}
```

`add` calls `window.showSaveFilePicker({ suggestedName: 'recording.wav', types: [...] })` to get the `FileSystemFileHandle`.

### `RecordingPanel.ts`

Per recording:
- Status pill: Idle / Recording / Finalizing / Done / Error.
- Elapsed: `framesWritten / sampleRate`, formatted as `mm:ss.mmm`.
- Frame count.
- Gap count (with tooltip listing them).
- Stop button.

Global: "New recording" button (prompts for bus + file location).

### Pause-recording behavior

`/n_run 0` on parent group pauses the recorder synth. No new samples are written to the buffer. The worker's tick stream also halts (clock is in the same group). So: during pause, no ticks → no reads → no new WAV writes. On resume, ticks start again, reads resume, WAV appends contiguously. The WAV represents *running audio time*, not wall time — this is almost always what you want.

### Acceptance

1. **Single mono recording.** 440 Hz tone on bus 16, 5 s recording → WAV file ~960 KB (5 × 48000 × 4 bytes). Open in Audacity → sine wave, no gaps. Sample count = 240000 ± `samplesPerTick` (startup skip).
2. **Simultaneous stereo recording + scope on same bus.** Two subscriptions, one bufnum each. Scope updates live; WAV captures fully. WAV content matches what was visible on scope (modulo scope decimation).
3. **Pause/resume.** Record 3 s → Stop → wait 2 s wall time → Start → record 3 s → Stop. WAV is 6 s, contiguous sine, no discontinuity at the pause point.
4. **Multi-bus sample alignment.** Record bus 16 (440 Hz) and bus 17 (660 Hz) simultaneously into two separate WAVs. Open both in a DAW aligned at t=0 → both start and end at the same tick; relative phase is preserved.
5. **Gap handling.** Fault-inject: drop every 50th `/b_setn` → retry succeeds → no gaps in output. Then drop every 50th twice in a row → gap logged; WAV contains zero-fill; sidecar `.gaps.json` lists it.
6. **Long-run sanity.** 30-minute recording → file size matches expected bytes; no drift.
7. **File handle robustness.** User cancels file picker → `RecordingController.start` rejects cleanly; no server-side leak.
8. **Teardown.** `stopAll` during recording → WAVs finalize (header patched, sidecar written); server clean.

---

## Phase 13 — UI Polish & Teardown

**Goal.** Production-adjacent UX and resource hygiene.

### Deliverables

- **Unified Clock Panel.** State pill covers both scope and recording states. Clear labels for disconnected state.
- **Connection resilience for PoC.** On WS close, all panels show disconnected state; reload button visible. No automatic reconnect.
- **`beforeunload` handler.** Stops all recordings (finalizes WAVs), clears all scopes, frees parent group.
- **Dev-mode toggle.** `?debug` flag shows `OscConsole`, `PhaseProbePanel`, `ScopePokerPanel`, `ScopeDebugPanel`. Off by default.
- **QueryTree diagnostic.** Button in a dev corner. Logs a parsed view of `/g_queryTree.reply` to console — verifies no leaks.
- **Final styling pass.** Coherent spacing, colors, monospace for numbers.

### Acceptance

1. Full session: clock on, 3 scopes, 2 recordings, all running. Close tab → WAVs exist on disk with correct headers + sidecars; `scsynth` has no residual nodes/buffers (verify from a separate OSC client).
2. 5-minute idle with clock running → no memory growth; tick UI still accurate.
3. Kill bridge mid-session → UI goes disconnected; recordings finalize with last-known frame count + gap entry covering the outage.
4. `?debug` URL shows dev panels; default URL hides them.

---

## Open Points

1. **Exact type surfaces** of `scserver-commands` (commands, replies, especially the `Trigger` variant shape and `Synced` reply) and `scsynthdef-compiler` (UGen API surface: `Impulse`, `PulseCount`, `SendTrig`, `Phasor`, `BufWr`, `In`, `Out`, `SinOsc`, `SampleRate`, `A2K`, `DC`; structural commands: `DRecv`, `SNew`, `GNew`, `NRun`, `NFree`, `GFreeAll`, `BAlloc`, `BFree`, `BGetN`, `Sync`, `Status`, `QueryTree`, `DumpOSC`). Protocol types in this plan will be tightened against actual exports.
2. **`/b_setn` decoding** — confirm the reply exposes the sample payload as a typed `Float32Array` view (not a generic number array), to avoid copy overhead in the worker.
3. **Reply correlation for `BGetN`** — scsynth matches replies by bufnum, not by explicit request id. The "one read in flight per bufnum" invariant is what makes this safe; the worker enforces it. Dev-only assertion recommended.
4. **Parent group ID.** Hardcoded 100 in examples; promote to `IdAllocator` allocation (e.g. base 100, one group per app instance).
5. **Clock bus ID.** Allocated from `ids.bus`; starts at 32 to skip hardware-reserved buses. Confirm against scsynth boot config.
6. **Phase boundary parity derivation.** The `completedHalf = 1 - (tickIndex % 2)` formula is an educated guess; verify empirically and flip if wrong.
7. **`BufWr` decimation behavior.** The scope synth relies on `BufWr.ar` at a slow-advancing phase to effectively decimate; this is zero-order-hold, not a proper anti-aliased decimation. Fine for visual scope; revisit if aliasing becomes visible.
8. **File System Access API availability.** Works in Chromium + Tauri. For Firefox support, fall back to in-memory accumulation + `URL.createObjectURL` download. Detect at runtime.
9. **WAV 4 GB limit.** Float32 stereo at 48 kHz → ~3h45m max file. Document. RF64 deferred.
10. **Reconnection.** Out of scope. App expects a manual reload on WS loss.
11. **Ordering constraints within parent group.** Clock must be at head; scopes and recorders at tail; sources (testTone, or real audio synths added later) must be placed before scopes that read them. Caller responsibility; document clearly.
12. **Future: FFT / spectral scopes.** The 250-sample chunk isn't power-of-2. For spectral features, accumulate 4 consecutive chunks into 1000 samples and zero-pad/truncate to 1024. Separate component, no impact on this plan.

---

## Milestone Summary

| Phase | What ships | Duration |
|---|---|---|
| 1 | OSC console routing raw bytes through a Worker | ½ day |
| 2 | Typed command/reply at the Worker boundary | ½ day |
| 3 | Trivial SynthDef load, `/sync` correlation, registry | ½ day |
| 4 | Parent group + pause/resume + first state pill | 1 day |
| 5 | Global clock, live tick/elapsed UI | 1 day |
| 6 | Shared phasor on clock bus, verified by probe | 1 day |
| 7 | Scope synth writing, verified by manual poke | 1 day |
| 8 | Automatic tick-driven chunk stream, numeric readout | 1.5 days |
| 9 | Single-channel waveform on canvas | 1 day |
| 10 | Multi-channel interleaved stacked lanes | ½ day |
| 11 | Multi-scope, shared clock, add/remove | 1 day |
| 12 | Recording pipeline with gap handling and sidecars | 2 days |
| 13 | UI polish, teardown, dev-flag gating | ½ day |

**Total: ~11.5 days** of focused development for a complete, clock-synchronized, multi-scope + multi-recorder PoC.

The **critical spine** is Phases 1–8: everything after that is rendering, UX, and recording. If time is tight, a bare-minimum demo (one scope, numeric readout, no recording) is reachable in ~5 days through Phase 8.
