# sc-app — Architecture

A current-state architectural reference for the codebase as of
Phase 34. Companion docs:

- [`history.md`](./history.md) — evolution: shipped phases with
  rationale + adaptations.
- [`../plan.md`](../plan.md) — forward-looking specs for any
  in-flight phase.
- [`../CLAUDE.md`](../CLAUDE.md) — working-day reference: gotchas,
  conventions, phase progress, scsynth-specific quirks.

This document describes **what's there now and how it fits
together**, not how it got there. Read here for system shape;
read `CLAUDE.md` for "what to know before editing"; read
`history.md` for "why was this built".

---

## 1. What sc-app is

A browser-first oscilloscope + recorder for SuperCollider's
`scsynth`, with a step sequencer for SuperDirt patterns layered
on top. Two deployment shapes:

- **Tauri desktop app** — a native window pointing a webview at a
  loopback HTTP server on the local machine. macOS / Windows /
  Linux .app/.dmg/.deb/AppImage targets.
- **Headless bridge** (`sc-app bridge`) — same Rust binary minus
  the Tauri webview. Runs under systemd on a Pi or any Linux box;
  any browser on the same machine (or LAN, if you punch the
  loopback bind) loads the bundled SPA from the same HTTP
  endpoint.

Both modes share **all** code paths. The webview is just a browser
pointed at `http://127.0.0.1:<port>`; the bridge subcommand
serves the same HTTP + WebSocket endpoints either way. There is
no `tauri://` custom protocol post-Phase-25.

scsynth is **not** managed by sc-app — it must be running before
the user connects, at the address in `config.json -> scsynth`
(default `127.0.0.1:57110`). Same for sclang+SuperDirt at
`127.0.0.1:57120`. The bridge is a thin proxy + session manager
between the webview and these servers; the user runs them under
their own process supervisor (`yarn osc`, the systemd units in
`scripts/`, or hand).

---

## 2. Process and thread model

```
┌────────────────────────────────────────────────────────────┐
│  Browser (Tauri webview OR external Chrome/Firefox/Safari) │
│  ┌─────────────────────────┐    ┌─────────────────────────┐│
│  │ Main thread              │   │ OSC worker (module       ││
│  │  - React render loop    ◀────▶  worker)                 ││
│  │  - Controllers          │    │  - WebSocket transport   ││
│  │  - Reactive stores      │    │  - OSC encode/decode     ││
│  │  - Pattern bank         │    │  - Sequencer pump        ││
│  │  - WAV writer           │    │  - Clock watchdog        ││
│  │                         │    │  - Per-scope WS lifecycle││
│  └─────────────────────────┘    └─────────────────────────┘│
└────────────────────────────────────────────────────────────┘
                       │ /ws (OSC bytes), /ws/scope (chunks)
                       │ HTTP (sessions, scope diagnostics)
                       ▼
┌────────────────────────────────────────────────────────────┐
│  sc-app Rust binary  (Tauri-wrapped or `bridge` subcommand) │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ tokio runtime                                         │  │
│  │  - axum HTTP+WS server (loopback bind)               │  │
│  │  - SessionStore (Arc<RwLock<HashMap>>)               │  │
│  │  - One UDP socket per route target per Session       │  │
│  │  - SHM mmap (lazy, per Session) for ScopeOut2 reads  │  │
│  │  - TTL eviction job (1 min scan)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
                       │ UDP /ws-routed by OSC address prefix
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌────────────────┐              ┌──────────────────────────┐
│ scsynth        │              │ sclang + SuperDirt       │
│ 127.0.0.1:57110│              │ 127.0.0.1:57120          │
│  - audio engine│              │  - /dirt/* responders     │
│  - SynthDefs   │              │  - /clock/* responders    │
│  - tap synths  │              │  - /scope/* responders    │
│  - SHM scope   │              │  - \scAppClock at root    │
│    buffers     │              │    group head             │
└────────────────┘              └──────────────────────────┘
```

Thread highlights:

- **Main thread** runs React + all controllers. Mostly UI and
  orchestration; no audio-critical timing.
- **OSC worker** (one module Web Worker spawned by `WorkerClient`)
  runs the WebSocket I/O, OSC encode/decode, the sequencer pump,
  the clock watchdog, and the scope-buffer postMessage fan-out.
  This is where the timing-critical work lives — workers are not
  throttled by Chromium when the tab is backgrounded.
- **Rust tokio runtime** runs the bridge: axum server, per-session
  UDP sockets, scope-SHM polling driven by observed
  `/clock/tick` events, the TTL eviction job.

Inter-thread / inter-process boundaries:

| From → To | Mechanism |
|---|---|
| Main → Worker | `postMessage` typed via `MainToWorker` enum |
| Worker → Main | `postMessage` typed via `WorkerToMain` enum |
| Worker → Bridge | WebSocket frames (binary) |
| Bridge → Worker | WebSocket frames (binary) |
| Bridge ↔ scsynth/sclang | UDP datagrams (OSC) |
| Bridge ↔ scsynth | mmap of scsynth's POSIX shared memory segment |

Type definitions for the worker boundary live in
`src/server/workerProtocol.ts`. There is no codegen — TypeScript
discriminated unions on both sides keep the protocol
type-checked.

---

## 3. Frontend (main thread)

### 3.1. Layered structure

```
src/
├── AppShell.tsx                bootstrap + heartbeat + dashboard
├── main.tsx                    React entry, CSS imports
│
├── server/                     scsynth-transport layer
│   ├── WorkerClient.ts          postMessage wrapper around oscWorker
│   ├── workerProtocol.ts        Main↔Worker message + type defs
│   ├── GroupController          parent group lifecycle (/g_new,/n_run)
│   ├── SynthDefRegistry         idempotent /d_recv tracker
│   ├── IdAllocator              monotonic ID minter (nodes, buffers, buses)
│   ├── ServerErrorBus           decoded /fail ring + toast
│   ├── serverInfo               /version, /status parsers
│   └── sessionBootstrap         GET-or-POST /api/session, sessionStorage
│
├── clock/                      ClockController + clockClient
├── group/                      (no separate folder — GroupController is in server/)
├── synth/                      producer side
│   ├── SynthManager             auto-allocates buses; mints SynthControllers
│   └── SynthController          one tone synth, runtime gain/freq/gate
│
├── synthdefs/                  byte compilers (one file per SynthDef)
│   ├── bufferTapSynthDef         ScopeOut2.ar tap (Phase 31+)
│   ├── toneSynthDef              tone synths
│   └── …
│
├── buffer/                     consumer-tap layer (Phase 16+)
│   ├── BufferManager            ref-counted (inputBus, channels, chunkSize) keys
│   └── BufferController         one tap synth + scope_buffer alloc + WS sub
│
├── scope/                      consumer
│   ├── ScopeManager             scope cards
│   ├── ScopeController          owns a BufferHandle, drives ScopeView
│   └── scopeClient.ts           /scope/* OSC builders + parsers + probe HTTP
│
├── recording/                  consumer
│   ├── RecordingManager
│   ├── RecordingController      owns a BufferHandle, runs WAV writer + gap log
│   ├── envelopeBuffer.ts        min/max-per-column waveform compaction
│   ├── wavWriter.ts             float32 WAV header + sample writer
│   └── download.ts              save-as via Tauri fs / browser <a download>
│
├── sequencer/                  step sequencer for SuperDirt
│   ├── PatternBank              8-slot store + chain + localStorage persist
│   ├── SequencerController      transport API + bank mutations + pump proxy
│   └── types.ts                 Pattern / Step / Track / ChainState
│
├── dirt/                       SuperDirt OSC client
│   ├── DirtClient               /dirt/play|hello|listSamples|setControlBus
│   └── dirtCommands.ts          message builders
│
├── workers/                    code that runs in the OSC worker context
│   ├── workerBootstrap.ts       sync message buffer + osc-js window shim
│   ├── transport.ts             raw binary WebSocket
│   ├── oscWorker.ts             worker entry: encode/decode + dispatch
│   ├── scopeWire.ts             /ws/scope binary frame decoder
│   ├── sequencerPump.ts       Phase 32 worker-side pump
│   ├── clockWatchdog.ts         Phase 33b worker-side freshness check
│   └── *.test.ts                vitest unit tests
│
├── config/                     clockConfig (deriveClock, AudioEnvironment)
├── util/                       reactiveStore, debugLog, runtime (IS_TAURI)
└── ui/                         React components (panels, toasts, scope view, …)
```

### 3.2. Controller pattern

Almost every domain object follows the same shape:

```ts
class XController {
  // Public API: synchronous methods + observable stores.
  attach() / detach() / dispose() — lifecycle
  store: ReadonlyStore<T>          — state subscribers can react to

  // Internal: holds references to the WorkerClient and
  // collaborating controllers; never imports React.
}
```

A controller is plain TypeScript — no React, no hooks. UI
components subscribe via `useSyncExternalStore` (wrapped by
`@/util/reactiveStore`). Controllers expose `ReadonlyStore<T>`
observables; UI subscribes to whatever it needs to render.

This separation means:
- Controllers are unit-testable without a React renderer.
- Controllers can be swapped out without UI churn.
- UI re-renders only the subtree that subscribes to a changed
  store (no global Context propagation).

Major controllers:

| Controller | Owns |
|---|---|
| `ClockController` | passive observation of the shared clock; `effectiveState` + `lastTick` + `derived` (tickRate, sampleRate, chunkSize). |
| `GroupController` | sc-app's parent group (`/g_new`, `/n_run`); pause/resume drives this group. |
| `SynthManager` + `SynthController` | producers — auto-allocates a bus block, `/s_new`s a tone synth onto it. |
| `BufferManager` + `BufferController` | shared tap layer — one ref-counted entry per `(inputBus, channels, chunkSize)` triple. Each entry: `/scope/allocate` → `/s_new` tap with `ScopeOut2.ar` → worker `subscribeBuffer` (opens `/ws/scope`). |
| `ScopeManager` + `ScopeController` | consumer — takes a user-typed bus, acquires a `BufferHandle` from `BufferManager`, renders. |
| `RecordingManager` + `RecordingController` | consumer — same `BufferHandle` acquisition, runs the WAV writer. |
| `SequencerController` | sequencer transport + bank mutation API; delegates the timing-critical pump to the worker. |
| `DirtClient` | SuperDirt OSC client (`/dirt/play|hello|setControlBus|listSamples`). |
| `ServerErrorBus` | decodes `/fail` replies into typed errors; surfaces via toasts. |
| `PatternBank` | 8-slot reactive store + chain + debounced localStorage save. |

### 3.3. Producer / consumer split

```
                   IdAllocator(bus)
                          │
                          ▼ allocates
                  ┌───────────────┐
                  │ SynthManager  │ ── /s_new tone synths writing onto allocated buses
                  └───────────────┘                 (PRODUCERS)
                          │
                          │ user reads bus number from synth card,
                          │ types it into a Scope or Recording panel
                          ▼
                  ┌───────────────┐
                  │ BufferManager │ ── /scope/allocate + /s_new tap +
                  └───────────────┘    /ws/scope subscribe (per (inBus, ch, chunkSize))
                     │   │   │
        BufferHandles│   │   │ (ref-counted, each consumer holds one)
                     ▼   ▼   ▼
              ┌──────────┬──────────┬──────────┐
              │ Scope #1 │ Scope #2 │ Recording│  (CONSUMERS)
              └──────────┴──────────┴──────────┘
```

Why this split exists:

- The `BufferManager` ref-counts taps by spec, so two scope
  cards on the same bus share **one** tap synth, **one**
  scope-buffer index, **one** `/ws/scope` connection.
- Producers (SynthManager) auto-allocate buses; consumers (Scope/
  Recording) accept user-typed bus numbers and never touch the
  allocator. So bus collisions across consumer types are
  impossible by construction.
- Adding a new consumer type (e.g. spectrum analyzer) means
  adding a new manager that calls `BufferManager.acquire(spec)`.
  The producer side, the OSC layer, and the SHM transport are
  all reused unchanged.

### 3.4. Reactive stores

`src/util/reactiveStore.ts` defines a tiny observable abstraction:

```ts
interface Store<T> {
  get(): T;
  set(next: T): void;
  update(fn: (prev: T) => T): void;
  subscribe(cb: (next: T) => void): () => void;  // returns unsubscribe
}

interface ReadonlyStore<T> { get(); subscribe(); }   // no set/update
```

`Object.is` short-circuits on `set` — a no-op write doesn't fire
subscribers. This composes cleanly with React 18's automatic
batching: a flurry of `set` calls during an event handler
collapses to one render.

The pattern is used everywhere on main: `effectiveState`,
`lastTick`, `transport`, `chainPlaybackIndex`, `recordings`,
`scopes`, `groupState`, `sampleBanks`, etc.

### 3.5. AppShell orchestration

`src/AppShell.tsx` is the React entry. Responsibilities:

1. **Bootstrap** — `sessionBootstrap()` reads
   `sessionStorage["sc.session"]`; GETs the session if present
   (fallback to POST on 404), opens the WebSocket via
   `?session=<uuid>`. Sets `bootstrapState` reactively for the
   loading UI.
2. **`setupDashboard`** — once the WS is open, constructs the
   controller graph: `ServerErrorBus` first, then `GroupController`,
   then `ClockController` (which round-trips `/clock/hello` →
   `/clock/info`), then `SynthManager` / `BufferManager` /
   `ScopeManager` / `RecordingManager` / `SequencerController` /
   `DirtClient`. Returns a `Resources` object that the UI tree
   consumes via React Context.
3. **`/status` heartbeat** — `setInterval(3000)` that sends
   `/status` and updates the footer state-pill from the reply.
   Phase 33a gated this on `document.visibilityState === 'visible'`
   so backgrounded tabs don't false-trigger session teardown.
4. **`teardownServerState`** — disconnect path: recordings →
   scopes → buffers → synths → clock → group, each `try`/`catch`'d.
   Then `bank.dispose()` (flushes localStorage), `client.dispose()`
   (terminates worker), `deleteSession()` (DELETE
   `/api/session/:id`).
5. **`pagehide` listener** — best-effort
   `fetch(DELETE …, { keepalive: true })` so a tab close runs
   the bridge-side cleanup.

---

## 4. OSC worker

Spawned by `WorkerClient` as a module worker. Code lives entirely
under `src/workers/`. The worker context is **not** throttled by
the browser when the tab is backgrounded — this is why the
sequencer pump (Phase 32) and clock watchdog (Phase 33b) live
here.

> **There is exactly ONE Web Worker per session.** `oscWorker.ts`
> is the only `new Worker()` target in the codebase
> (`WorkerClient.ts`); every other file under `src/workers/` is
> a **module** that runs inside that one worker context. They
> share the thread, the transport, and `self.postMessage`. This
> matters because the file naming (`sequencerPump.ts`,
> `clockWatchdog.ts`, `scopeWire.ts`) can read as "one worker
> each" — it isn't.

### 4.1. Module layout

```
oscWorker.ts (entry)
├── workerBootstrap     pre-import sync message buffer + osc-js
│                        window-shim (osc-js needs `window`,
│                        which doesn't exist in workers by
│                        default).
├── transport           raw binary WebSocket. Dispatches inbound
│                        bytes to oscWorker's onMessage.
├── scopeWire           decoder for the 10-byte-header binary
│                        frames coming from /ws/scope.
├── sequencerPump       Phase 32 pump: setInterval(25ms),
│                        encodes /dirt/play bundles with
│                        tickToTimetag, ships via transport.send,
│                        posts stepFired back to main.
├── clockWatchdog       Phase 33b: tracks lastTickAt, runs
│                        unthrottled setInterval, posts
│                        clockFreshness on transitions.
└── (per-scope WS map)  one WebSocket per active BufferSubscription;
                         opened on subscribeBuffer, closed on
                         unsubscribeBuffer. Frames decoded via
                         scopeWire and posted as bufferChunk.
```

### 4.2. Why so much in the worker

The worker's responsibilities have grown organically:

1. **OSC byte-level I/O** (always was the job) — encode/decode is
   non-trivial CPU; keeping it off the React render thread avoids
   stutters.
2. **`/clock/tick` mux** (Phase 30 cleanup) — the worker matches
   the `/clock/tick` reply address and emits typed `clockTick`
   events to main, suppressing them from the generic `onReply`
   channel.
3. **Per-scope WS lifecycle** (Phase 31 post-shipping refactor) —
   each `BufferSubscription` opens its own WebSocket to
   `/ws/scope`. The worker manages the per-`bufferId` map; on
   `subscribeBuffer` it derives the URL from the main WS URL and
   opens, on `unsubscribeBuffer` it closes.
4. **Sequencer pump** (Phase 32) — main posts a snapshot, worker
   runs the timing loop and ships OSC bundles directly via
   `transport.send` (no second postMessage hop for OSC bytes).
5. **Clock watchdog** (Phase 33b) — observes `/clock/tick`
   freshness against a `setInterval` that doesn't get throttled.
   Posts `clockFreshness` only on transitions.

What stays on **main** by design:

- React rendering and layout.
- Bank mutation, snapshot construction.
- WAV writer (works against the postMessage queue of `bufferChunk`
  events; data integrity is preserved because the worker captures
  audio at the right time via SHM).
- All controller state machines (transport / chain / etc).
- File save dialogs (Tauri IPC needs main).

### 4.3. Cross-thread protocol

```ts
// src/server/workerProtocol.ts (excerpt)

type MainToWorker =
  | { type: 'connect'; url: string }
  | { type: 'disconnect' }
  | { type: 'send'; bytes: Uint8Array }
  | { type: 'subscribeBuffer'; subscription: BufferSubscription }
  | { type: 'unsubscribeBuffer'; bufferId: string }
  | { type: 'sequencerStart'; bank: …; clock: …; isGroupPaused: boolean }
  | { type: 'sequencerStop' }
  | { type: 'sequencerBankUpdate'; bank: … }
  | { type: 'sequencerClockUpdate'; clock: … }
  | { type: 'sequencerPauseUpdate'; isGroupPaused: boolean }
  | { type: 'clockWatchdogStart'; tickIntervalMs: number }
  | { type: 'clockWatchdogStop' };

type WorkerToMain =
  | { type: 'ready' } | { type: 'error'; message }
  | { type: 'reply'; reply }              // generic OSC reply
  | { type: 'oscError'; error }            // decoded /fail
  | { type: 'clockTick'; tick }            // /clock/tick decoded
  | { type: 'clockFreshness'; fresh: boolean }
  | { type: 'bufferChunk'; chunk: BufferChunk }   // SHM scope frame
  | { type: 'stepFired'; step }            // sequencer step
  | { type: 'cycleBoundary'; boundary }    // chain entry advance (defined,
                                            //   currently unused)
  | { type: 'log'; level; message };
```

Discriminated unions on both ends; the bridge between them is one
`switch (msg.type)` per direction.

---

## 5. Rust bridge

```
src-tauri/src/
├── main.rs / lib.rs            entry + crate root
├── cli/                        clap subcommand dispatch
│   ├── mod.rs                   parsing + precedence
│   ├── gui.rs                   Tauri Builder + window
│   └── bridge.rs                headless `bridge` subcommand entry
├── config.rs                   Config struct + load + starter
├── logging.rs                  tracing init (stderr + daily-rotated file)
├── scope_shm.rs                Phase 31: mmap RAII + scope_buffer
│                                vector finder + read_scope_slot
└── server/
    ├── mod.rs                   axum router, bind/serve_on, /ws handler
    ├── api.rs                   POST/GET/DELETE /api/session[/:id] +
    │                             GET /api/scope/{probe,layout,headers,debug}
    ├── ws_bridge.rs             main /ws bridge: per-target forwarder
    │                             tasks subscribe to session broadcast
    ├── ws_scope.rs              Phase 31 /ws/scope handler: polls SHM
    │                             on every observed /clock/tick
    ├── routing.rs               RoutingTable + peek_osc_address
    ├── session.rs               Session + SessionStore + TTL eviction
    ├── security.rs              Phase 34 Host + WS Origin validators
    └── static_assets.rs         dist/ resolution + SPA fallback
```

### 5.1. Bridge entry points

The same Rust binary supports two modes, dispatched by clap:

- **GUI mode** (default, no subcommand) — runs through
  `tauri::Builder`. The webview navigates to
  `http://127.0.0.1:<port>` (release) or Vite's
  `http://localhost:1420` (debug). axum runs as a tokio task
  inside the Tauri runtime.
- **`bridge` subcommand** — plain tokio + axum, no Tauri. On
  Linux this means **no GTK init**, so the binary runs cleanly
  under systemd on a headless host. The static `dist/` directory
  is resolved via `tauri::utils::platform::resource_dir` (when
  bundled) or `--dist <path>` (when called from the project tree).

Both modes call the same `serve_on(listener, routes, dist,
session_ttl)` in `server/mod.rs`. The only difference is whether
`tauri::Builder` runs around it.

### 5.2. The Session model (Phase 29)

A **Session** is the unit of bridge-managed state for one
sc-app tab. Created via `POST /api/session` and identified by a
UUID stored in the tab's `sessionStorage`.

```rust
struct Session {
    session_id: Uuid,
    scsynth_addr: SocketAddr,         // the default-route target
    target_sockets: HashMap<SocketAddr, Arc<UdpSocket>>,  // one per route target
    routes: Arc<RoutingTable>,         // shared with AppState
    broadcast_senders: HashMap<SocketAddr, broadcast::Sender<Vec<u8>>>,
    client_id: u32,                    // from /done /notify
    parent_group_id: u32,              // clientId × 100 (or 100 if 0)
    sample_rate: f64,                  // from /status.reply
    last_active: Mutex<Instant>,
    scope_shm: tokio::sync::OnceCell<Arc<ScopeShm>>,  // lazy mmap
}
```

`Session::create` (in `session.rs`):
1. Opens one UDP socket per unique route target (`scsynth`,
   `/dirt → :57120`, `/clock → :57120`, `/scope → :57120` —
   the `/dirt`/`/clock`/`/scope` ones share a target so they
   share a socket).
2. Sends `/notify 1` to scsynth on the default-route socket;
   awaits `/done /notify <clientId>` with a 2 s timeout.
3. Sends `/status` to scsynth; awaits `/status.reply` to capture
   `sampleRate`.
4. Spawns one tokio task per socket that receives UDP bytes and
   broadcasts them via the per-target `broadcast::Sender`.
5. Inserts into `SessionStore` (a global
   `Arc<RwLock<HashMap<Uuid, Arc<Session>>>>`).

`Session::cleanup` (run on DELETE or TTL eviction):
1. `/g_freeAll <parentGroupId>` to scsynth (frees all synths in
   the parent group).
2. `/n_free <parentGroupId>` (frees the group itself).
3. `/notify 0` (drops the client_id slot — scsynth's `maxLogins`
   is 8, so leaks would eventually exhaust it).
4. Drops the sockets and broadcast channels.

A WebSocket `/ws?session=<uuid>` upgrade looks up the session,
spawns per-target forwarder tasks that subscribe to each
broadcast channel and forward inbound UDP bytes to the WS.
WS→UDP routing happens via `RoutingTable::route_for` (see 5.3).

The **TTL eviction job** runs once a minute (`server/mod.rs`):
scans `SessionStore` for entries whose `last_active` is older
than `config.session_ttl_seconds` (default 1800 = 30 min). Each
evicted session runs `cleanup`. This is the safety net for
sessions whose tab was hard-killed without firing `pagehide`.

### 5.3. Routing table

`config.json -> routes` is an ordered list of
`{ prefix: String, target: String }`. The `RoutingTable`
walks them top-to-bottom on every outbound packet:

```rust
fn route_for(&self, packet: &[u8]) -> SocketAddr {
    let address = peek_osc_address(packet)?;  // first OSC address
    for (prefix, target) in &self.routes {
        if address.starts_with(prefix) { return *target; }
    }
    self.default_target  // = config.scsynth
}
```

`peek_osc_address` decodes only enough bytes to extract the
address (no full rosc decode) — hot-path-cheap.

A bundle is routed by the address of its **first** inner
message; mixed-target bundles are unsupported. In practice the
sequencer wraps each `/dirt/play` in its own bundle (one per
step) so this isn't an issue.

Default starter routes:

| Prefix | Target |
|---|---|
| `/dirt` | `127.0.0.1:57120` (sclang+SuperDirt) |
| `/clock` | `127.0.0.1:57120` (sclang's `\scAppClockHello` responder) |
| `/scope` | `127.0.0.1:57120` (sclang's `\scAppScope*` responders) |
| (default) | `127.0.0.1:57110` (scsynth) |

### 5.4. SHM transport (Phase 31)

`scope_shm.rs` mmaps scsynth's POSIX shared memory segment
(`/tmp/boost_interprocess/SuperColliderServer_<port>` on macOS;
`/dev/shm/SuperColliderServer_<port>` on Linux). The segment
holds 128 `scope_buffer` triple-buffer structs (one per
scope-buffer index).

`find_scope_buffer_array` locates the
`bi::vector<offset_ptr<scope_buffer>>` by:
1. Scanning the segment for scope_buffer-shaped structures
   (status field ∈ {0, 1}; stage/in/out a permutation of {0,
   1, 2}).
2. Walking 8 bytes at a time looking for a contiguous run of 128
   offset_ptrs that each resolve to a known scope_buffer offset.
   That run is the vector's payload.

`read_scope_slot(idx)` reads the `_stage` field (which slot the
writer just completed), then the data slot at
`_state[_stage]._data`. Non-mutating — does NOT advance
`_in`/`_out`; only the writer (ScopeOut2) does that. The reader
detects "writer advanced" by tracking the previous `_stage` per
subscription.

Per `/ws/scope` handler (`server/ws_scope.rs`):
- On upgrade, ensure the session-level mmap is open (lazy
  `OnceCell`).
- Subscribe to the session's default-route broadcast channel.
- On every `/clock/tick` observed in the broadcast stream, read
  the slot for this subscription's `scope` index. If `_stage`
  advanced, encode the float32 payload as a 10-byte-header
  binary frame and send it down the WS.
- On WS close, drop the subscription. The mmap stays alive for
  other subscriptions on the same session.

Wire frame format:
```
[ tickIndex u32_le | isGap u8 | channels u8 | frameCount u32_le | float32_le payload ]
  4 bytes            1 byte    1 byte         4 bytes              frameCount × channels × 4 bytes
```
`bufferId` is implicit in the connection (URL-borne, both ends
already know it).

### 5.5. Static assets

`static_assets.rs` resolves `dist/` for the SPA fallback:
- In a Tauri bundle the files land at
  `<resource_dir>/_up_/dist/` (Tauri rewrites the leading `..`
  in `bundle.resources` to `_up_`).
- `bridge` mode uses `tauri::utils::platform::resource_dir` to
  locate it, or `--dist <path>` to override, or `None` to skip
  (any non-`/ws`-non-`/api` request 404s).

`static_or_spa()` serves `index.html` for any path that doesn't
match a real file in `dist/` — standard SPA fallback.

### 5.6. Security middleware (Phase 34)

`security.rs` provides:

- `enforce_host` middleware (layered before `with_state` in
  `serve_on`) — rejects 421 Misdirected Request on any HTTP
  request whose `Host` header isn't a loopback hostname.
- `check_ws_origin` helper (called from `ws_handler` and
  `ws_scope_handler` before `ws.on_upgrade`) — rejects 403
  Forbidden on WS upgrades whose `Origin` header (when present)
  isn't a loopback origin.

Allowlist: hostname ∈ `{127.0.0.1, localhost, ::1}`; origin
schemes ∈ `{http, https}` plus `tauri://localhost`. Port is
intentionally not validated — bridge is loopback-bound so any
port is by definition a loopback port.

Defends against DNS rebinding (Host check) and cross-origin WS
upgrades (Origin check). See history.md Phase 34 for the threat
model and decision rationale.

---

## 6. External services

### 6.1. scsynth (`127.0.0.1:57110`)

The audio engine. sc-app sends:
- `/notify 1` (per session, once at create)
- `/status` (heartbeat + sampleRate)
- `/d_recv` (SynthDef bytecode, on demand)
- `/s_new`, `/n_free`, `/n_run`, `/g_new`, `/g_freeAll` (group +
  synth lifecycle)
- `/sync` (acknowledgment barriers for atomic operations)

Receives via SHM (Phase 31): every active scope subscription's
audio frames are written into the shared scope-buffer pool by
the `ScopeOut2.ar` UGen inside each tap synth. The bridge polls
this on every observed `/clock/tick`.

Reserved IDs (sclang owns these — frontend allocators avoid
them):
- `clockNodeId = 999` (the `\scAppClock` synth)
- `/clock/tick` reply address (any other synth using it would
  produce double-ticks)

Frontend allocators are scoped by `clientId`:
- `IdAllocator(node)` starts at `clientId * 1_000_000 + 1000`
- `IdAllocator(buffer)` (Phase 31 retired this for scope/recording
  use — `/scope/allocate` mints scope-buffer indices instead)
- `IdAllocator(bus)` starts at 32 (skip hardware-reserved)

### 6.2. sclang + SuperDirt (`127.0.0.1:57120`)

sclang acts as the long-running coordinator process:

- Loads SuperDirt at startup, wired to scsynth as a regular
  client (clientId=0, parent group 1).
- Hosts `\scAppClock` at scsynth's root group head (Phase 30).
  This is the global tick clock all sc-app sessions observe. It
  uses `Impulse.kr` + `PulseCount` + `SendReply.kr` to multicast
  `/clock/tick nodeId replyId pulseCount` at
  `sampleRate / chunkSize` Hz. `chunkSize` comes from the
  `SC_APP_CLOCK_CHUNK_SIZE` env var (default 1024).
- Hosts the `/clock/hello` responder that replies on
  `/clock/info` with `[tickRate, value, chunkSize, value,
  sampleRate, value, clockNodeId, value]`.
- Hosts the `/scope/{hello,allocate,free}` responders backed by
  `s.scopeBufferAllocator` (a `StackNumberAllocator(0, 127)` —
  128 slots).
- Forwards `/dirt/play` etc. to SuperDirt.

`scripts/sc-app-superdirt-startup.scd` is the canonical sclang
startup script. `yarn osc` / the Pi systemd unit boot sclang via
this script.

### 6.3. The shared clock (Phase 30)

```
sclang process          scsynth root group         every sc-app session
─────────────────       ──────────────────────     ────────────────────────
Boot:
  Synth(\scAppClock)  ▶ /s_new at root, head
                            │
                            │ SendReply.kr →
                            │   /clock/tick
                            ▼
                          UDP multicast to all
                          /notify'd clients ──────▶ ClockController.handleTick:
                                                     - sets lastTickStore
                                                     - sets _tick0Ms (first tick)
                                                     - clockWatchdog records freshness

OSCdef(\scAppClockHello)
  on /clock/hello:    ▶ reply /clock/info ─────────▶ ClockController.attach:
                          [tickRate, chunkSize,            - stores info
                           sampleRate, clockNodeId]        - starts worker watchdog
```

The clock is "shared" in two senses:
1. All sessions observe the same `/clock/tick` stream — two
   tabs land sequencer steps on the same audio frame.
2. Pause/resume is **local** to each session's parent group —
   the shared clock keeps ticking, only this client's children
   freeze.

Pre-Phase-30 each session ran its own clock SynthDef inside its
parent group, drifting independently. The migration was
substantial; see `history.md` Phase 30.

---

## 7. Key data flows

### 7.1. Session bootstrap

```
Browser              Bridge (axum)            scsynth             sclang
───────              ─────────────             ───────             ──────
load page
sessionBootstrap
  reads sessionStorage
  GET /api/session/:id ▶ session lookup
                       ◀ 200 (existing) or 404
  (on 404 / first time)
  POST /api/session    ▶ Session::create
                          - alloc UDP sockets
                          - /notify 1     ────▶  /done /notify <clientId>
                          - /status       ────▶  /status.reply
                          - SessionStore.insert
                       ◀ { id, clientId,
                           parentGroupId,
                           sampleRate }
  store id in sessionStorage

setupDashboard:
  open WS:
  GET /ws?session=<id> ▶ ws_handler:
                          - check_ws_origin (Phase 34)
                          - get_and_touch session
                          - upgrade
                          - spawn forwarder tasks
                       ◀ 101 Switching Protocols

  ServerErrorBus       (subscribes to onOscError on client)
  GroupController
    .ensureCreated()   ▶ /g_new + /n_run     ────▶  group created
  ClockController
    .attach()          ▶ /clock/hello                     ────▶  /clock/info reply
                       ◀ /clock/info
                       ▶ client.startClockWatchdog(tickIntervalMs)
                          (worker starts watchdog)
  SynthManager etc.    (constructed)
```

### 7.2. OSC command + reply

```
main thread          worker              bridge          scsynth/sclang
───────────          ──────              ──────          ──────────────
client.sendCommand(packet)
  encode bytes
  postMessage{type:'send',bytes}  ▶
                                    transport.send(bytes)
                                                  ──WS──▶
                                                       prefix-match routing
                                                  ──UDP──▶
                                                                 process message
                                                                       │
                                                                       │ reply
                                                  ◀──UDP────────────────┘
                                                       broadcast::send(reply)
                                                  ◀──WS──
                                    transport.onMessage(bytes)
                                    decode → emitReply(packet)
                                    if /clock/tick:
                                      - recordClockTick()
                                      - postMessage{type:'clockTick',tick}
                                    elif /fail:
                                      - postMessage{type:'oscError',error}
                                    else:
                                      - postMessage{type:'reply',reply}  ▶
client.onReply(cb) fires
```

### 7.3. Scope / recording chunk delivery (Phase 31)

```
main thread             worker             bridge            scsynth
───────────             ──────             ──────            ───────
BufferManager.acquire(spec)
  /scope/allocate                                            (sclang)
    ──sendAndAwaitReply──▶               ──UDP──▶  /scope/allocated <idx>
  /s_new bufferTap …
    scopeNum=<idx>,
    sigs from inputBus
    ──sendAndSync──▶                     ──UDP──▶  tap synth /s_new'd
                                                    ScopeOut2.ar starts
                                                    writing into SHM[idx]
  client.subscribeBuffer(spec)
    postMessage{subscribeBuffer}  ▶
                                    derive /ws/scope URL
                                    new WebSocket(url)
                                                  ──HTTP──▶ /ws/scope upgrade:
                                                              - check_ws_origin
                                                              - ensure_scope_shm
                                                              - subscribe to broadcast
                                                  ◀──101──
  …running…                                       
                                                  on /clock/tick:
                                                    read SHM[idx]
                                                    if _stage advanced:
                                                      send 10-byte-header
                                                      binary frame
                                                  ──WS──▶
                                    decode via scopeWire
                                    postMessage{bufferChunk}  ▶
RecordingController.onChunk:
  WAV.appendFrames(chunk)
ScopeView (RAF loop):
  read latestChunkRef.current
  draw
```

### 7.4. Sequencer emission (Phase 32)

```
main thread          worker (sequencerPump)        bridge → sclang+SuperDirt
───────────          ────────────────────────        ─────────────────────────
SequencerController.play()
  snapshot bank + clock
  client.startSequencer(snap, clock, paused)
    postMessage{sequencerStart}  ▶
                                    state.running = true
                                    nextStepTick = nowTick + 5
                                    setInterval(pumpOnce, 25ms)
                                                          
                                    pumpOnce:
                                      - compute nowTick
                                      - while nextStepTick <= horizon:
                                          - encode /dirt/play bundle
                                            with timetag
                                          - transport.send(bytes)  ──WS──▶
                                                                          /dirt-prefixed
                                                                          → :57120
                                                                          → SuperDirt
                                                                          → /s_new on
                                                                            scsynth at
                                                                            sample-accurate
                                                                            timetag
                                          - setTimeout(post stepFired,
                                            audibleStepDelay)

bank.toggleStep / etc.
  bank.slots store fires
  postBankSnapshot via offSlots subscription
    postMessage{sequencerBankUpdate}  ▶
                                    state.bank = new snapshot
                                    next pumpOnce reads new pattern

stepFired listener:
  _transport.set(currentStep)
  chainElapsedSteps++
  if hits target:
    bank.selectIndex(chain[next].slotIndex)
    (triggers another bankUpdate naturally)
                                    ◀──postMessage{stepFired}
```

### 7.5. Disconnect

```
main thread                        bridge
───────────                        ──────
handleDisconnect (button) OR pagehide:

teardownServerState (in order):
  recordings.dispose()
  scopes.dispose()
  buffers.clear()        ← refcount-leak canary
  synths.dispose()
  clock.detach()         ← also stops worker watchdog
  group.dispose()        ← /g_freeAll + /n_free local

bank.dispose()  (flushes localStorage)
client.dispose()  (terminates worker; closes all WS)

deleteSession(sessionId):
  fetch DELETE /api/session/:id
                                   Session::cleanup:
                                     /g_freeAll <parentGroupId>
                                     /n_free <parentGroupId>
                                     /notify 0
                                     drop sockets

clearStoredSession()  (clears sessionStorage)
setBootstrapState({ phase: 'disconnected' })

(safety net: bridge TTL job runs cleanup if pagehide+keepalive
 doesn't make it through)
```

---

## 8. Configuration

`config.json` is the single source of truth for runtime knobs.
Schema in `src-tauri/src/config.rs` (`Config` struct,
`deny_unknown_fields = true`). All fields optional; missing
fields fall through to compiled defaults.

```jsonc
{
  "port": 3000,
  "scsynth": "127.0.0.1:57110",
  "log_dir": "/var/log/sc-app",        // optional; defaults to stderr only
  "session_ttl_seconds": 1800,          // 30 min
  "routes": [
    { "prefix": "/dirt", "target": "127.0.0.1:57120" },
    { "prefix": "/clock", "target": "127.0.0.1:57120" },
    { "prefix": "/scope", "target": "127.0.0.1:57120" }
  ]
}
```

Discovery:

- **GUI mode** reads `app.path().app_config_dir()/config.json`
  and writes a starter file on first launch
  (`Config::write_default_if_missing`). The starter includes the
  three routes above.
- **`bridge` subcommand** uses `--config <path>` if explicit,
  else CWD-relative `./config.json`, else
  `/etc/sc-app/config.json`. Silent if absent.

Precedence for resolution (highest → lowest):
1. CLI flag (bridge only — `--port`, `--scsynth`, `--log-dir`)
2. Env var (`SC_PORT`, `SC_SCSYNTH_ADDR`)
3. `config.json` value
4. Compiled-in default

Caveats:

- A stale starter config from before a route was added breaks
  silently (e.g. a config without `/dirt` falls through to
  scsynth, which logs `/fail /dirt/hello: Command not found`).
  Fix: delete the file to regenerate. `tauri dev` reads
  `app_config_dir`, NOT the project-root config.
- `dist` is NOT in the schema — it has its own resolution path
  (`resource_dir` in bundle, `--dist` override).

---

## 9. Security model

Threat model: a single-user dev / install on a machine the user
trusts. The bridge runs loopback-only; the realistic attackers
are:

1. **Hostile websites the user happens to visit** (DNS rebinding
   or cross-origin WebSocket).
2. **Other browser tabs on the same machine** sharing the
   loopback bind.
3. **(Out of scope)** other local processes / malware.

### 9.1. Defense in place

| Layer | Mechanism |
|---|---|
| Network reachability | axum binds to `127.0.0.1` only — no LAN/internet exposure. |
| DNS rebinding | Host header validation (Phase 34). Rejects 421 on non-loopback `Host`. |
| Cross-origin WS upgrades | Origin header validation (Phase 34) — rejects 403 on non-loopback `Origin`. Missing Origin allowed (browsers always send it on WS; missing means non-browser tooling). |
| Session ID guessability | UUIDv4 = 122 bits of entropy. |
| scsynth-side process kill | Bridge `/g_freeAll` + `/notify 0` on session DELETE. TTL job (1 min scan, 30 min default TTL) catches sessions whose tab was hard-killed. |
| Tauri webview capabilities | `src-tauri/capabilities/default.json` scopes `fs:allow-write-{file,text-file}` to `$DOCUMENT/$DOWNLOAD/$AUDIO/$DESKTOP/$HOME`. |

### 9.2. Out of scope

- **TLS on loopback** — considered (Phase 34 review) and
  rejected: cert-provisioning friction, doesn't compose with
  `yarn dev:full`, doesn't help against same-machine non-browser
  callers anyway. Header validation does the job for the actual
  threat model.
- **Capability tokens** (defense against same-machine non-browser
  attackers) — considered, deferred. The "ship a token in the
  bundled HTML, require it on every API call" pattern would close
  that gap but adds plumbing through `WorkerClient`,
  `bootstrapSession`, and the `/ws/scope` URL builder. Not done.
- **Auth** — sc-app has no user model. The session UUID is the
  only artifact identifying a "client" to the bridge.

---

## 10. Build and deployment modes

### 10.1. Modes

| Mode | What runs | Webview origin | dist served by |
|---|---|---|---|
| `yarn dev` | Vite | `localhost:1420` | Vite (in-memory) |
| `yarn dev:full` | Vite + bridge | `localhost:1420` | Vite; `/ws` + `/api` proxied to bridge :3000 |
| `yarn bridge` | Bridge only | (bring your own browser) | bridge serves `dist/` if built |
| `yarn tauri dev` | Tauri + Vite + bridge | Tauri webview → `localhost:1420` | Vite |
| `yarn tauri build` | Tauri bundle | Tauri webview → `127.0.0.1:<port>` | bridge serves `dist/` from bundled resources |
| systemd `sc-app bridge` | Bridge under systemd (Pi) | (bring your own browser) | bridge serves `dist/` from `--dist` or installed location |

### 10.2. The `dist/` contract

`dist/` ships exactly once via `bundle.resources: ["../dist"]`
in `tauri.conf.json`. There is no `frontendDist`; the
`tauri://` protocol is unused post-Phase-25. Both the webview
(production) and external browsers hit the same axum static
fallback.

Inside the bundle the files land at `<resource_dir>/_up_/dist/`
because Tauri rewrites `..` in `bundle.resources` to `_up_`.
`server/static_assets.rs` knows this prefix.

### 10.3. Workspace packages

Yarn 4 workspace; three local packages referenced from the app
via `workspace:*`:

| Package | Purpose |
|---|---|
| `@sc-app/server-commands` | OSC layer over [`osc-js`](https://github.com/adzialocha/osc-js). Command builders, `encode`/`decode`, bundle + timetag helpers, typed reply accessors. Pure JS; runs in main thread AND worker (via the workerBootstrap window-shim). |
| `@sc-app/synthdef-compiler` | Pure-TS SynthDef (SCgf v2) compiler. Three API layers: `synthdef(name, fn)` sclang-style; typed builders (one class per UGen); low-level `addControl`/`addUgen`. 365 UGens shipped. Has its own vitest suite. |
| `@sc-app/ui-foundation` | Framework-agnostic CSS package. Open Props primitives + semantic tokens + base element styles + a small set of semantic component classes (`.panel`, `.cluster`, `.stack`, `.status-pill`, `.badge`, etc.). Loaded by `src/main.tsx`. |

Vite resolves them via aliases directly to `<pkg>/src/index.ts`
(no pre-build step). `tsc` handles types. The
synthdef-compiler runs its own vitest from inside its folder.

---

## 11. Architectural principles + conventions

### 11.1. Small, sharp boundaries

- **React is in `src/ui/` only.** Controllers are framework-free.
  This separation is enforced by code review, not by the build.
- **OSC stays at the bytes layer below main.** Main constructs
  `OSC.Message`/`OSC.Bundle`, `client.sendCommand` encodes and
  posts bytes. Inbound replies arrive as plain `{ address, args }`
  POJOs (structured-clone-stripped, no class methods).
- **The worker owns one transport, one timing loop family, and
  per-scope WS lifecycle. Nothing else.** When considering moving
  more work into the worker, ask whether it's timing-critical or
  byte-CPU-critical. If neither, keep on main.

### 11.2. Observable state

- **Reactive stores everywhere.** `createStore<T>` /
  `ReadonlyStore<T>` is the universal observable shape.
  `Object.is` short-circuits. React 18 batches.
- **No global Context for app state.** Resources are passed
  explicitly to the dashboard tree via a single context, but
  individual stores are subscribed to via `useSyncExternalStore`
  at the leaf component, so re-render scope stays narrow.

### 11.3. Idempotent setup

- Controllers' `attach()` / `ensureCreated()` / `acquire()` are
  idempotent. Multiple calls return the cached state.
- `/d_recv` SynthDefs are deduped by SynthDef name in
  `SynthDefRegistry`.
- BufferManager dedupes taps by spec.
- This pattern survives reconnection, HMR, and edge cases like a
  panel mounting twice during a transition.

### 11.4. Cleanup is explicit, but the bridge is the safety net

- Every `acquire()` returns a handle with a `release()` method
  that the caller MUST call. The handle wrapper guards against
  double-release with an internal `released` flag.
- `BufferManager.clear()` warns on a non-empty map at teardown
  time — refcount-leak canary.
- Bridge-side `Session::cleanup` (TTL or DELETE) catches the
  case where the frontend never got to release. Default TTL is
  30 min.

### 11.5. Structured clone is the protocol shape

- POJOs only across `postMessage`. No class instances, no
  `Date` / `Map` / `Set` (their prototypes get stripped or they
  serialize awkwardly).
- This constraint shapes the bank snapshot, the clock snapshot,
  and the buffer subscription. Audit on every protocol change.

### 11.6. Don't fight the audio engine's clock

- All audio-aligned scheduling uses `tickToTimetag(tick0Ms,
  targetTick, tickRate)` — anchored to scsynth's clock via the
  first observed `/clock/tick`. Never use `Date.now()` directly
  for audio scheduling.
- `Date.now()` IS used for non-audio freshness checks (clock
  watchdog, heartbeat) where wall-clock alignment doesn't matter
  but determinism under fake timers does.
- `performance.now()` is reserved for in-thread timing
  measurements; cross-thread comparisons are wrong (different
  `timeOrigin`).

### 11.7. scsynth conventions worth keeping in mind

These don't fit neatly elsewhere; cross-reference `CLAUDE.md`
for the full list.

- **Group ordering invariant:** shared clock at root group's
  head; sc-app parent group at root's tail (`AddToTail`); inside
  the parent group, every tap synth `AddToTail` so it processes
  after the clock on every control block.
- **Reserved IDs:** `clockNodeId = 999`; client allocators start
  at `clientId * 1_000_000 + 1000`.
- **scsynth's OSC clock vs wall clock:** scsynth calibrates its
  scheduling clock to the audio callback, drifting 10–24 ms
  from `Date.now()`. SuperDirt's `playFunc` adds a 200 ms
  latency floor; we mirror that with
  `SUPERDIRT_SAFETY_LOOKAHEAD_MS = 200` in the sequencer pump.
- **Tick-anchored math:** `Impulse.kr(freq, phase=0)` fires at
  t=0, so tick `N` corresponds to audio frame
  `(N-1) × samplesPerTick`. (Phase 31 retired the clientside
  `/b_getn` parity formula that this affected.)

---

## 12. Where to look next

| Question | Where |
|---|---|
| Why was X built that way? | `docs/history.md`, the relevant Phase entry |
| What's currently in flight? | `plan.md` (top of file says "no phase in flight" or names one) |
| What gotchas should I know before editing? | `CLAUDE.md`, the "Gotchas to not relearn" section |
| How do I run this on a Pi? | `docs/raspberry-pi.md` |
| What does this OSC builder do? | `packages/server-commands/src/commands/<address>.ts` + its README |
| What does this UGen do? | `packages/synthdef-compiler/src/specs/<group>.ts` + its README |
| What state is in the bank's localStorage? | `src/sequencer/PatternBank.ts` (look for `SerializedBankV*`) |
| What does this `/fail` mean? | `src/server/ServerErrorBus.ts` + scsynth source |
| What's the chunkSize × sampleRate trade-off? | `CLAUDE.md`, the practical reference table |
