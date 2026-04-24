# SCSynth Oscilloscope & Recorder PoC — Full Implementation Plan

A browser-first web app (running equally well in Tauri) that drives SuperCollider's `scsynth` to render live oscilloscopes of one or more audio buses, synchronized by a global server-side clock, with optional sample-accurate WAV recording of the same buses. The clock doubles as a Start/Stop switch for all audio via the parent group's `/n_run` flag.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Configuration Schema](#core-configuration-schema)
3. [Crate Prerequisites](#crate-prerequisites)
4. [Assumptions & Dependencies](#assumptions--dependencies)
5. [File Layout](#file-layout)
6. [Phase 0 — Tauri Backend + WS↔UDP Bridge + CLI](#phase-0--tauri-backend--wsudp-bridge--cli)
7. [Phase 1 — Worker Transport (bytes only)](#phase-1--worker-transport-bytes-only)
8. [Phase 2 — Typed Command/Reply Proxy](#phase-2--typed-commandreply-proxy)
9. [Phase 3 — SynthDef Compile & Load](#phase-3--synthdef-compile--load)
10. [Phase 4 — Parent Group & `/n_run`](#phase-4--parent-group--n_run-plumbing)
11. [Phase 5 — Global Clock SynthDef (ticks only)](#phase-5--global-clock-synthdef-ticks-only)
12. [Phase 6 — Shared Phasor on Clock Bus](#phase-6--shared-phasor-on-clock-bus)
13. [Phase 7 — Scope SynthDef, Manual Poke](#phase-7--scope-synthdef-manual-poke)
14. [Phase 8 — Worker Tick-Driven Read Loop](#phase-8--worker-tick-driven-read-loop)
15. [Phase 9 — Single-Channel Renderer](#phase-9--single-channel-renderer)
16. [Phase 10 — Multi-Channel](#phase-10--multi-channel)
17. [Phase 11 — Multi-Scope](#phase-11--multi-scope)
18. [Phase 12 — Recording Pipeline](#phase-12--recording-pipeline)
19. [Phase 13 — UI Polish & Teardown](#phase-13--ui-polish--teardown)
20. [Open Points](#open-points)
21. [Milestone Summary](#milestone-summary)

---

## Architecture Overview

```
┌──────────────────────── Browser (Vite app) ────────────────────────┐
│                                                                      │
│  [ ConnectScreen ] ──user clicks Connect──► AppShell ────┐           │
│  (scsynth addr form)                                      │           │
│                                                           ▼           │
│  ┌────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │ Canvas × N │◄─┤ ScopeRenderer×N │◄─┤                         │   │
│  └────────────┘  └─────────────────┘  │                         │   │
│                                       │                         │   │
│  ┌────────────┐  ┌─────────────────┐  │    Scope Worker         │   │
│  │ WAV Blobs  │◄─┤RecordingMgr     │◄─┤    - owns WebSocket     │   │
│  │ (download) │  └─────────────────┘  │    - scserver-commands  │   │
│  └────────────┘                       │      (encode + decode)  │   │
│  ┌────────────┐  ┌─────────────────┐  │    - clock tick router  │   │
│  │ Clock UI   │◄─┤ ClockController │◄─┤    - subscription table │   │
│  └────────────┘  └─────────────────┘  │    - recording writers  │   │
│                          ▲            └───────────┬─────────────┘   │
│                          │ typed cmds             │                 │
│                          └────────────────────────┼─────────────    │
│                                                   │                 │
│                                         ┌─────────▼────────────┐    │
│                                         │ WebSocket (binary)   │    │
│                                         │ /ws?scsynth=HOST:PORT│    │
│                                         └─────────┬────────────┘    │
└───────────────────────────────────────────────────┼─────────────────┘
                                                    │
                                 ┌──────────── src-tauri/ ─────────────┐
                                 │  ┌─────────────────────────────┐    │
                                 │  │ CLI (clap)                  │    │
                                 │  │ `sc-oscilloscope`   → GUI   │    │
                                 │  │ `sc-oscilloscope serve` → HTTP   │
                                 │  └─────────────┬───────────────┘    │
                                 │                ▼                    │
                                 │     ┌────────────────────┐           │
                                 │     │ server/ws_bridge   │ (Phase 0) │
                                 │     │ 1 WS = 1 UDP sock  │           │
                                 │     └──────────┬─────────┘           │
                                 └────────────────┼────────────────────┘
                                                  │ UDP :<picked>
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

## Crate Prerequisites

Two small additions to `scserver-commands`' `replies` surface are required
before implementation begins. Both are straightforward (~30 lines each
across `wit/replies.wit` + `src/replies.rs`) and the current `Other`
fallback keeps behaving for anything unrecognised:

1. **Typed `/b_setn` reply variant.** Without this, scope and recording
   `/b_setn` responses land in `Other { args: list<osc-arg> }` — jco then
   lowers each sample as a boxed `{ tag: 'float32', val: number }` JS
   object. At the plan's targets (250 samples × 48 Hz × N scopes + 1000 ×
   48 Hz × N recordings) this is tens of thousands of allocations per
   second and will destroy sub-tick latency. Adding a typed variant with
   `samples: list<f32>` lets jco lift the payload as `Float32Array` (one
   memcpy, no per-element boxing):
   ```wit
   record b-setn-reply {
       bufnum: s32,
       start:  s32,
       samples: list<f32>,
   }
   variant server-reply { …, b-setn(b-setn-reply), … }
   ```
2. **Typed `/synced` reply variant.** Needed for `sendAndSync` (Phase 2).
   Without it, `/synced` falls through to `Other` and callers have to match
   on `reply.tag === 'other' && reply.val.address === '/synced'`. Cleaner:
   ```wit
   record synced-reply { sync-id: s32 }
   variant server-reply { …, synced(synced-reply), … }
   ```

Both ship as non-breaking additions: any existing caller that was
matching `Other` continues to work; new callers get the typed form.
Do these first and the rest of the plan lands without escape-hatch
matching in app code.

---

## Assumptions & Dependencies

- **scsynth** running on UDP `127.0.0.1:57110` at 48 kHz. Not booted or managed by this app.
- **WS↔UDP bridge is implemented in Phase 0** of this plan as part of
  the Tauri backend (`src-tauri/src/server/ws_bridge.rs`). Endpoint at
  `VITE_OSC_WS_URL` (default `ws://127.0.0.1:3000`). 1 WS binary frame ↔
  1 UDP datagram. The backend boots in two modes: native Tauri app (GUI
  shell) or standalone HTTP server (`sc-oscilloscope serve`) — same
  bridge code path.
- **`scsynthdef-compiler`** and **`scserver-commands`** are the two WASM
  components under `crates/`. Exported TS surface (via jco transpile):
  - `scsynthdef-compiler` → `core.SynthDef` resource (`new /
    addControl(name, default, rate) → UgenInput / addUgen(className, rate,
    inputs, numOutputs, specialIndex) → u32 / toBytes / toJson`),
    `core.parseScgf(bytes)`, `core.registryJson()`. UGen graph is
    stringly-typed; the 365 bundled UGens in the registry cover everything
    this plan needs (`Impulse`, `PulseCount`, `SendTrig`, `Phasor`,
    `BufWr`, `In`, `Out`, `SinOsc`, `SampleRate`, `A2K`, `DC`).
  - `scserver-commands` → `commands.encode(msg: ServerMessage) →
    Uint8Array`, `replies.decode(bytes) → ServerReply`, and
    `nrt.NrtScore` (not used here). `ServerMessage` is a tagged union
    with one variant per command, e.g. `{ tag: 's-new', val: { defName,
    nodeId, addAction, targetId, tail } }`. `ServerReply` is the
    symmetric union: `{ tag: 'tr' | 'n-go' | 'status-reply' | 'done' |
    'fail' | 'b-setn' | 'synced' | … | 'other', val: … }`.
- **Bundle budget.** Both wasm components load in the main thread at
  startup: `scsynthdef_compiler.core.wasm` ~300 KB +
  `scserver_commands.core.wasm` ~220 KB + jco JS glue ~600 KB. Vite
  emits separate chunks. `scsynthdef-compiler` can be initialised lazily
  on first `compile*SynthDef()` call; `scserver-commands` must be ready
  before the worker sends anything.
- **Vite** + TypeScript strict mode.
- **Framework-agnostic UI** in this plan. Code uses plain DOM helpers; porting to React/Solid/Svelte is a wrapper exercise.
- **No filesystem writes.** Recordings accumulate as bytes in the
  worker's heap, finalised into a `Blob` on stop, and surfaced to the
  user via `URL.createObjectURL` + `<a download>`. Uniform behaviour
  across browser and Tauri webview; no `FileSystemFileHandle` gating.
  Practical memory cost: float32 stereo at 48 kHz = ~23 MB/min. Plan
  assumes sessions stay well under system RAM.

---

## File Layout

Final structure after all phases:

```
src-tauri/                            # Phase 0 — Rust backend
  Cargo.toml
  tauri.conf.json
  src/
    main.rs                          # entry — calls cli::run
    lib.rs                           # module declarations
    cli.rs                           # clap CLI: no args → Tauri GUI, `serve` → HTTP
    server/
      mod.rs                         # Hyper HTTP: static assets + SPA fallback + /ws upgrade
      ws_bridge.rs                   # WebSocket ↔ UDP bridge (tokio)

src/
  config/
    clockConfig.ts                   # ClockParams, deriveClock, defaults
  workers/
    scopeWorker.ts                   # Vite ?worker entry
    transport.ts                     # WS wrapper (worker-internal)
    subscriptionTable.ts             # scope + recording subscription registry
    wavWriter.ts                     # in-memory WAV encoder (worker-side)
  scope/
    AppShell.tsx                     # connect ↔ dashboard orchestration (React)
    cmd.ts                           # typed command helpers (sNew, nFree, …)
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
    download.ts                      # Blob → download link helper
  synth/
    clockSynthDef.ts                 # globalClock
    scopeSynthDef.ts                 # scopeTap
    recorderSynthDef.ts              # recorderTap
    testToneSynthDef.ts              # dev: sine on a bus
    testToneStereoSynthDef.ts        # dev: asymmetric stereo
    phaseProbeSynthDef.ts            # dev: reads clockBus via SendTrig
    silentTestSynthDef.ts            # dev: heartbeat via SendTrig
  ui/
    ConnectScreen/                   # initial scsynth-address form (Phase 1)
      ConnectScreen.tsx
      ConnectScreen.scss
      index.ts
    OscConsole/                      # dev: raw byte / typed command console
      OscConsole.tsx
      OscConsole.scss
      index.ts
    SynthDefPanel.tsx                # dev: load synthdefs button
    PhaseProbePanel.tsx              # dev: clockBus readout
    ScopePokerPanel.tsx              # dev: manual /b_getn
    ScopeDebugPanel.tsx              # dev: chunk numeric readout
    ClockPanel.tsx                   # Start/Stop + tick + elapsed
    ScopeView.tsx                    # one canvas + header
    ScopeList.tsx                    # add/remove scopes
    RecordingPanel.tsx               # recording controls + progress
    styles.css
  main.ts                            # boots AppShell — AppShell mounts the rest
```

Files prefixed `dev:` should be gated behind a `?debug` URL flag or a `VITE_DEBUG=1` env flag.

---

## Phase 0 — Tauri Backend + WS↔UDP Bridge + CLI

**Goal.** Fresh Tauri 2 project that boots in two modes — native GUI
shell or standalone HTTP server — and exposes a WebSocket endpoint that
forwards each binary frame as a UDP datagram to scsynth and relays
datagrams back. Nothing audio-specific here; pure transport.

### Files

- `src-tauri/Cargo.toml` — tauri 2, tokio (full), clap, hyper, hyper-tungstenite.
- `src-tauri/src/main.rs` — calls `cli::run(tauri::generate_context!())`.
- `src-tauri/src/lib.rs` — module declarations only.
- `src-tauri/src/cli.rs` — clap derive CLI.
- `src-tauri/src/server/mod.rs` — Hyper HTTP server.
- `src-tauri/src/server/ws_bridge.rs` — WebSocket ↔ UDP bridge.

### `cli.rs`

```rust
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "sc-oscilloscope")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    /// Run as a standalone HTTP server (browser mode).
    Serve {
        /// HTTP port. Env: SC_PORT.
        #[arg(short, long, env = "SC_PORT", default_value = "3000")]
        port: u16,
        /// scsynth address to bridge to. Env: SC_SCSYNTH_ADDR.
        #[arg(long, env = "SC_SCSYNTH_ADDR", default_value = "127.0.0.1:57110")]
        scsynth: String,
    },
}

pub fn run(ctx: tauri::Context<tauri::Wry>) -> std::process::ExitCode {
    match Cli::parse().command {
        None => run_gui(ctx),                     // native Tauri webview
        Some(Command::Serve { port, scsynth }) => run_server(port, scsynth),
    }
}
```

### `server/mod.rs`

Hyper HTTP server. Responsibilities:
- Serve `dist/` static assets (the Vite build) from bundled bytes via
  `tauri::generate_context!()`'s asset map, or from disk in dev.
- SPA fallback — any non-file path returns `index.html`.
- `GET /ws` upgrade → dispatch to `ws_bridge::handle_ws`.

```rust
pub async fn serve(port: u16, scsynth: SocketAddr) -> anyhow::Result<()>;
```

### `server/ws_bridge.rs`

The scsynth address is picked **per WebSocket connection** via a
`?scsynth=HOST:PORT` query parameter on the upgrade URL. This lets the
frontend's Connect Screen (Phase 1) route each session to whatever
scsynth the user pointed at, without restarting the backend. The CLI
`--scsynth` flag becomes a *default* surfaced to the frontend — the
frontend can override it per-connection.

```rust
pub async fn handle_ws(
    upgrade: hyper_tungstenite::HyperWebsocket,
    scsynth: SocketAddr,
) -> anyhow::Result<()> {
    let ws = upgrade.await?;
    let (mut tx, mut rx) = ws.split();

    // Ephemeral UDP socket per connection. scsynth replies to the socket
    // the command came from, so one socket = one client session.
    let sock = Arc::new(UdpSocket::bind("0.0.0.0:0").await?);
    sock.connect(scsynth).await?;

    let sock_recv = sock.clone();
    let recv_task = tokio::spawn(async move {
        let mut buf = vec![0u8; 65536];
        loop {
            let n = sock_recv.recv(&mut buf).await?;
            tx.send(Message::Binary(buf[..n].to_vec().into())).await?;
        }
        #[allow(unreachable_code)] Ok::<_, anyhow::Error>(())
    });

    while let Some(msg) = rx.next().await {
        match msg? {
            Message::Binary(bytes) => { sock.send(&bytes).await?; }
            Message::Close(_) => break,
            _ => {}  // ignore text/ping/pong
        }
    }

    recv_task.abort();
    Ok(())
}
```

**Address resolution in the upgrade handler** (lives in `server/mod.rs`):

```rust
// /ws?scsynth=127.0.0.1:57110
let scsynth: SocketAddr = query_param(&req, "scsynth")
    .unwrap_or(default_scsynth)                    // from CLI flag / env
    .parse()
    .map_err(|e| bad_request(format!("invalid scsynth: {e}")))?;
let (response, upgrade) = hyper_tungstenite::upgrade(req, None)?;
tokio::spawn(ws_bridge::handle_ws(upgrade, scsynth));
Ok(response)
```

If the query param is missing, fall back to the `--scsynth` CLI flag
(for dev convenience). If both are malformed, return HTTP 400 before
the upgrade completes.

**Per-connection UDP socket** is deliberate: scsynth's reply destination
is whatever address sent the command, so isolating each WS session on
its own socket means no cross-client reply contamination — and no
cross-*scsynth* leakage when two connections point at different servers.

### GUI mode

`run_gui` calls `tauri::Builder::default().run(ctx)`. Tauri loads the
Vite dev server (`tauri dev`) or bundled assets (`tauri build`). The
webview talks to the bridge the same way a browser does — via
`ws://127.0.0.1:<port>/ws` — with the server task spun up from inside
the Tauri runtime on a background thread.

Consequence: the browser-path and Tauri-path share 100% of the frontend
code and 100% of the bridge code; the only difference is who hosts the
webview.

### CLI usage

```bash
# Native GUI
cargo tauri dev                                        # dev with HMR
cargo tauri build                                      # produces bundled app

# Standalone HTTP server (browser mode)
cargo run --manifest-path src-tauri/Cargo.toml         # defaults, port 3000
cargo run --manifest-path src-tauri/Cargo.toml -- \
    serve --port 4000 --scsynth 192.168.1.10:57110     # explicit
```

### Acceptance

1. `cargo tauri dev` opens a window, loads the Vite page — an empty
   shell at this phase.
2. `cargo run -- serve` prints `listening on 127.0.0.1:3000`; visiting
   the URL in a browser serves the same shell.
3. From DevTools, open
   `ws://127.0.0.1:3000/ws?scsynth=127.0.0.1:57110`, send hex bytes for
   `/status` → a `/status.reply` binary frame arrives within ~100 ms.
4. Omit the query param → upgrade succeeds using the CLI default.
5. Malformed query param (`?scsynth=notanaddr`) → HTTP 400 before the
   upgrade completes.
6. Two concurrent WS connections to different scsynth addresses →
   replies don't cross (each session has its own UDP socket).
7. Kill scsynth → next send fails silently (UDP); worker surfaces a
   timeout at the application layer.
8. Kill the server (Ctrl-C) → all WS connections close cleanly; no
   panics.

With Phase 0 complete the rest of the plan — Phases 1 through 13 — runs
against a stable bridge. The backend is touched again only in Phase 13
(graceful teardown).

---

## Phase 1 — Worker Transport (bytes only)

**Goal.** WebSocket lives inside a dedicated Web Worker. Main thread
talks to the worker via `postMessage` with raw byte payloads. **A
Connect Screen gates the whole dashboard** — the worker isn't spawned
until the user supplies a scsynth address and clicks Connect. Validates
worker plumbing in isolation from OSC typing.

### Files

- `src/ui/ConnectScreen/ConnectScreen.tsx` + `ConnectScreen.scss` + `index.ts` — initial UI (scsynth address form, React)
- `src/scope/AppShell.tsx` — orchestrates connect-screen ↔ dashboard swap (React)
- `src/workers/scopeWorker.ts` — worker entry
- `src/workers/transport.ts` — WS wrapper, worker-internal
- `src/scope/workerProtocol.ts` — shared types (bytes-only version)
- `src/scope/WorkerClient.ts` — main-thread handle
- `src/scope/reactiveStore.ts` — minimal observable
- `src/ui/OscConsole/OscConsole.tsx` + `index.ts` — dev console

**Stack note.** Phase 1 (and everything after) is written directly for
React + TypeScript — the scaffold is already React, so `ConnectScreen`
is a proper `.tsx` component with typed props/state rather than an
abstract `mount(root, props)` factory. The DOM-agnostic signatures in
earlier drafts of this plan are superseded.

### `ConnectScreen.tsx`

A single-form initial screen, React component. Fields:

- **`scsynth address`** input, default `127.0.0.1:57110`, validated
  against `/^([^\s:]+):(\d{1,5})$/` (host + port).
- **Connect** button, disabled while invalid or already connecting.
- Inline error text if the WS fails to open (malformed address rejected
  by the bridge's HTTP 400, or nothing listening on the target).

```tsx
interface ConnectScreenProps {
  defaultAddress?: string;                  // from localStorage / URL param
  onConnect: (address: string) => Promise<void>;
  error?: string | null;                    // surfaced from AppShell
}

export function ConnectScreen(props: ConnectScreenProps): JSX.Element;
```

Behaviour:
1. Render form; populate input with `defaultAddress` or `'127.0.0.1:57110'`.
2. On submit: call `props.onConnect(address)`. `AppShell` does the
   actual `WorkerClient` construction.
3. While the promise is pending, disable the form and show
   `"Connecting…"`.
4. On reject: re-enable; error surfaced via `props.error`.
5. On resolve: `AppShell` unmounts the connect screen and mounts the
   dashboard in its place.

### `AppShell.ts`

Top-level orchestration. Responsible for the connect ↔ dashboard
transition and for keeping the `WorkerClient` instance alive across
reconnects.

```ts
export class AppShell {
  constructor(private root: HTMLElement);
  /** Entry point — called from main.ts. */
  start(): void;
}
```

Internals:
1. On mount, reads the last-used address from `localStorage['sc.address']`
   (or URL `?scsynth=` param, or default); renders `ConnectScreen` with it.
2. `onConnect(address)`:
   - Persist `localStorage['sc.address'] = address`.
   - Build the WS URL — fall back to `window.location.origin` when
     `VITE_OSC_WS_URL` isn't set (so production `sc-app serve` works
     with no env config):
     ```ts
     const base = import.meta.env.VITE_OSC_WS_URL ?? window.location.origin;
     const wsUrl = new URL('/ws', base);
     // Convert http(s): origins to ws(s): scheme.
     wsUrl.protocol = wsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
     wsUrl.searchParams.set('scsynth', address);
     this.client = new WorkerClient(wsUrl.href);
     ```
   - `await this.client.ready` (times out at ~3 s). A successful `open`
     event already implies the bridge parsed `?scsynth=` without a 400,
     so the address is at least syntactically valid. **No OSC `/status`
     round-trip in Phase 1** — that probe moves to Phase 2 where we
     have typed encode/decode. The bytes-only Phase 1 only proves
     worker plumbing.
   - Switch state to show the dashboard shell.
3. On WS close / error mid-session: switch back to the connect screen,
   surface the error via `props.error`. User clicks Connect to retry.

### Why gate the dashboard

Every subsequent phase (clock, scopes, recordings) assumes a live
connection. Without the gate, the UI has to handle "not yet connected"
states everywhere. One connect point, one disconnection handler,
clean.

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
  /** `url` is the full WS URL including the `?scsynth=HOST:PORT`
   *  query param chosen on the Connect Screen. */
  constructor(url: string);
  readonly ready: Promise<void>;
  send(bytes: Uint8Array): void;
  onRecv(cb: (bytes: Uint8Array) => void): () => void;
  onError(cb: (err: string) => void): () => void;
  dispose(): void;
}
```

- Constructs `new Worker(new URL('../workers/scopeWorker', import.meta.url), { type: 'module' })`.
- Posts `connect` with `url`; `ready` resolves on `ready` event. Times
  out if the bridge rejects the upgrade (bad scsynth address) or the WS
  fails to open within ~3 s.
- `send` posts `{ type: 'send', bytes }` with buffer transferred.
- `dispose` posts `disconnect`, then `worker.terminate()`.

### `OscConsole.ts`

- Textarea for hex input.
- Send button.
- Log panel showing direction, timestamp, length, first 32 bytes in hex.

### Acceptance

1. Page loads → Connect Screen shown with `127.0.0.1:57110` prefilled
   (or whatever was last persisted to `localStorage`). No worker yet.
2. Type a bad address (e.g. `:nope`), try Connect → button disabled
   until the format matches `host:port`.
3. Click Connect with a good address → form disabled, "Connecting…"
   label. DevTools → Application → Workers shows `scopeWorker`; Network
   tab shows the WS URL including `?scsynth=127.0.0.1:57110`.
4. WS opens cleanly → connect screen unmounts, dashboard shell
   appears. Refresh page → previously-used address is prefilled.
5. Paste hex for `/status` in the OSC console, click Send → `recv` log
   entry within ~100 ms (scsynth must be running — this is the Phase 1
   stand-in for the typed round-trip that Phase 2 will automate).
6. Call `client.dispose()` via DevTools → WS closes; Connect Screen
   remounts; reconnecting works from scratch.
7. Syntactically-invalid scsynth address (e.g. `:nope`) → bridge
   rejects the upgrade with HTTP 400 → WS `error` event → connect
   screen shows the error. "Nothing listening" on a syntactically-valid
   address can't be detected in Phase 1 (UDP is fire-and-forget); that
   check becomes Phase 2's `sendAndSync(Status)` with a timeout.
8. Kill the bridge mid-session → `error` event logged; dashboard
   unmounts; Connect Screen shown with last address prefilled.

---

## Phase 2 — Typed Command/Reply Proxy

**Goal.** Replace raw bytes with typed structs at the worker boundary.

### Files touched

- `src/scope/workerProtocol.ts` — typed version
- `src/scope/cmd.ts` — thin typed constructors
- `src/workers/scopeWorker.ts` — encode/decode
- `src/scope/WorkerClient.ts` — typed API
- `src/ui/OscConsole.ts` — structured form UI

### `workerProtocol.ts` (typed)

Types come from the jco-transpiled crate under `crates/scserver-commands/pkg/`
via the `@wasm/scserver-commands` Vite alias (set up in `vite.config.ts`;
see "Build pipeline" below). A `log` channel is added so worker-side
`console.*` calls cross the postMessage boundary into the main-thread
on-screen debug log.

```ts
import type { ServerMessage } from '@wasm/scserver-commands/interfaces/scserver-commands-commands';
import type { ServerReply } from '@wasm/scserver-commands/interfaces/scserver-commands-replies';

export type MainToWorker =
  | { type: 'connect'; url: string }
  | { type: 'disconnect' }
  | { type: 'command'; command: ServerMessage };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'reply'; reply: ServerReply }
  | { type: 'log'; level: 'log' | 'info' | 'warn' | 'error'; message: string };
```

### Worker changes

On `command`: `transport.send(commands.encode(command))`. On incoming
bytes: try `replies.decode(bytes)` → `reply`; on failure post `error`,
don't crash. `decode` is tolerant — unknown reply addresses round-trip
through `ServerReply.Other { address, args }` rather than throwing.

**Race fix for wasm TLA init** — jco's transpiled module uses a
module-level `await $init`. ESM evaluates imports in dependency order
before any top-level code, so `self.addEventListener('message', …)` in
`scopeWorker.ts` only runs *after* the wasm bootstrap resolves. If the
main thread posts `connect` immediately after `new Worker(...)`, that
message is delivered to an EventTarget with no listeners yet — and
silently dropped. A small `src/workers/workerBootstrap.ts` module with
zero imports registers a synchronous buffering listener during its own
evaluation phase (which runs first); the main worker module calls
`setWorkerMessageHandler(real)` after init, draining the buffer in
order.

A companion `src/workers/workerConsoleBridge.ts` (also pre-TLA)
forwards `console.*` calls to the main thread via the new `log`
protocol channel, so the on-screen debug log surfaces worker
diagnostics even before wasm init completes.

### `WorkerClient` changes

```ts
sendCommand(cmd: ServerMessage): void;
onReply(cb: (reply: ServerReply) => void): () => void;

// Correlation-free probe: await the first reply matching a predicate.
// Used for one-shot queries like Status → StatusReply.
async sendAndAwaitReply(
  cmd: ServerMessage,
  match: (reply: ServerReply) => boolean,
  timeoutMs?: number,
): Promise<ServerReply>;

// Primary correlation helper: send cmd, post a separate /sync, resolve
// on the matching /synced.
async sendAndSync(cmd: ServerMessage, timeoutMs?: number): Promise<void>;

// Atomic variant — the command itself embeds the /sync (e.g. /d_recv's
// `completionMsg` field) so the server runs the sync *after* the async
// op completes, no race. Used by SynthDefRegistry (Phase 3) and the
// buffer-alloc flows (Phase 7+).
async sendCommandAndAwaitSync(
  buildCmd: (syncId: number) => ServerMessage,
  timeoutMs?: number,
): Promise<void>;
```

All three match the typed `Synced` variant (see Crate Prerequisites).
The status probe in `AppShell.onConnect` uses `sendAndAwaitReply(cmd.status,
r => r.tag === 'status-reply', 1000)`. SynthDef loading uses
`sendCommandAndAwaitSync`.

### Thin command helpers

Constructing `{ tag: 's-new', val: { defName, nodeId, addAction, targetId, tail: [...] } }` for every call is verbose. A small `src/scope/cmd.ts` module
exports named constructors the rest of the app uses — typed on top of
the jco-generated `ServerMessage`:

```ts
import type { ServerMessage } from '@sc-app/scserver-commands-pkg/interfaces/scserver-commands-commands';
import type { ControlId, ControlValue } from '@sc-app/scserver-commands-pkg/interfaces/scserver-commands-commands';

export const AddToHead = 0;
export const AddToTail = 1;

const ctrl = (name: string): ControlId => ({ tag: 'name', val: name });
const asCtrlVal = (v: number): ControlValue =>
  Number.isInteger(v) ? { tag: 'int', val: v } : { tag: 'float', val: v };

export const sNew = (
  defName: string, nodeId: number, addAction: number, targetId: number,
  controls: Record<string, number> = {},
): ServerMessage => ({
  tag: 's-new',
  val: {
    defName, nodeId, addAction, targetId,
    tail: Object.entries(controls).map(([k, v]) => [ctrl(k), asCtrlVal(v)] as const),
  },
});

export const nRun   = (nodeId: number, flag: 0 | 1): ServerMessage =>
  ({ tag: 'n-run',   val: { tail: [[nodeId, flag]] } });
export const nFree  = (...nodeIds: number[]): ServerMessage =>
  ({ tag: 'n-free',  val: { nodeIds } });
export const gFreeAll = (...groupIds: number[]): ServerMessage =>
  ({ tag: 'g-free-all', val: { groupIds } });
export const bAlloc = (bufnum: number, numFrames: number, numChannels = 1): ServerMessage =>
  ({ tag: 'b-alloc', val: { bufnum, numFrames, numChannels } });
export const bFree  = (bufnum: number): ServerMessage =>
  ({ tag: 'b-free',  val: { bufnum } });
export const bGetn  = (bufnum: number, start: number, count: number): ServerMessage =>
  ({ tag: 'b-getn',  val: { bufnum, tail: [[start, count]] } });
export const gNew   = (newId: number, addAction: number, targetId: number): ServerMessage =>
  ({ tag: 'g-new',   val: { tail: [[newId, addAction, targetId]] } });
export const status: ServerMessage = { tag: 'status' };
export const sync   = (id: number): ServerMessage =>
  ({ tag: 'sync',    val: { aUniqueNumber: id } });
export const dRecv  = (bytes: Uint8Array, completionMsg?: Uint8Array): ServerMessage =>
  ({ tag: 'd-recv',  val: { bufferOfData: bytes, completionMsg } });
```

Now the whole plan uses readable constructors: `client.sendCommand(sNew('sine', 1001, AddToHead, 100, { freq: 440 }))`.

### `OscConsole` upgraded

Kept the Phase 1 hex input as-is; added a **Quick Actions** row above
with buttons: **Status**, **DumpOSC on**, **DumpOSC off**, **QueryTree(0)**,
**sendAndAwaitReply(Status)**. Log entries render typed summaries per
`ServerReply` variant (`status-reply` shows ugens/synths/CPU; `b-setn`
shows bufnum/start/count; `synced` shows the sync id; etc.).

### Build pipeline (added in Phase 2)

- Root `package.json` script `build:wasm` chains `build:wasm:scserver-commands`
  (and `build:wasm:scsynthdef-compiler` once Phase 3 brings it online). Each
  runs `cargo component build --release --features component --target
  wasm32-wasip1` and `jco transpile … -o pkg`. jco's output lives at
  the crate root `pkg/` (gitignored; regenerated on demand).
- `vite.config.ts` aliases `@wasm/scserver-commands` → the crate's
  `pkg/scserver_commands.js`, plus a `@wasm/scserver-commands/…`
  sub-path form. Tsconfig mirrors with `paths`.
- `worker.format: "es"` + `build.target: "es2022"` — jco's generated
  module worker has multiple chunks (ESM code-split requirement) and a
  module-level `await $init` (TLA needs at least ES2022).
- Explicit alias to pin every `@bytecodealliance/preview2-shim/*`
  import to the *browser* branch — the package's export map otherwise
  resolves `node:fs/promises` in Vite, which crashes the worker at
  init.
- `@bytecodealliance/preview2-shim` is a direct dep so Vite's
  resolution pipeline sees it deterministically.

### On-screen debug log (added in Phase 2)

`src/scope/debugLog.ts` monkey-patches `console.*` on the main thread
and mirrors every call into a 500-entry ring buffer; `src/ui/DebugLog/`
renders it as a fixed-bottom collapsible panel, always mounted by
`AppShell`. Worker-side logs cross the postMessage boundary via the
`log` channel (see `workerConsoleBridge.ts` above) and get replayed
through the main-thread console hook, so they appear in the same
panel. Every connect/command/reply path now logs at `[sc:app]`,
`[sc:client]`, `[sc:worker]`, `[sc:transport]` prefixes — useful when
the Tauri webview's DevTools are hard to reach.

### Backend hardening (added in Phase 2)

`src-tauri/src/server/mod.rs` previously did
`ServeDir::new(dist).fallback(ServeFile::new(index))` — which served
`index.html` for *every* 404. Stale cached references to removed
`/assets/scopeWorker-<hash>.js` bundles came back as HTML and tripped
browsers' strict-MIME module-script check with "non-JavaScript MIME
type" errors, burying the real failure. The handler is now scoped:
paths under `/assets/` or with a file extension → loud 404 with a
`text/plain` body; everything else → `index.html` for the React
router.

### Acceptance

1. Click **Status** in the OSC console → the log panel shows
   `status-reply ugens=… synths=… groups=…` within ~50 ms.
2. **DumpOSC on** → subsequent replies still decode (no stream
   corruption from the extra server-printed lines); **DumpOSC off**
   stops them.
3. Bad command object forced in code → worker posts `error`; the UI
   surfaces it; subsequent commands still work.
4. Random garbage frames pushed into the WS → one `error` per frame;
   worker survives; the bridge keeps running.
5. `sendAndAwaitReply(status, r => r.tag === 'status-reply', 1000)`
   resolves within ~50 ms once the connect probe runs.

---

## Phase 3 — SynthDef Compile & Load

**Goal.** Validate the compile-and-upload path end-to-end with a trivial SynthDef.

### Prerequisite (done): typed `ugens` interface with arg-record calling convention

Before Phase 3 proper, `scsynthdef-compiler` needed its typed `ugens`
interface exported *and* reshaped from positional args to named arg
records. The WIT declared 365 typed per-UGen functions but the world
only exported `core`, and each function took positional
`ugen-input` args (`sin-osc: func(def, ugen-rate, freq, phase)`) —
forcing TS callers to wrap every scalar and memorise arg order.

Wiring steps applied:

- `wit/scsynthdef.wit` world gained `export ugens;`.
- Every UGen function's signature changed to take a named arg record:
  ```wit
  record sin-osc-args {
    freq:  option<ugen-input>,   // registry default 440 → optional
    phase: option<ugen-input>,   // registry default 0   → optional
  }
  sin-osc: func(def: borrow<synth-def>, ugen-rate: rate, args: sin-osc-args) -> ugen-input;
  ```
  Field types follow the registry:
  - scalar input with a default → `option<ugen-input>`
  - scalar input without a default → plain `ugen-input` (required)
  - `num-channels` with a default → `option<u32>`
  - variadic arrays → `list<ugen-input>` (required)
  348 UGens get an arg record; 17 argless ones still take only
  `(def, ugen-rate)`. 145 UGens have at least one required field.
- `scripts/generate_ugens_component.mjs` (zero-dep Node ESM) parses
  the `defaults:` entries out of `src/specs/*.rs`, cross-references
  `src/builders/*.rs` for canonical PascalCase class names,
  regenerates the `interface ugens { … }` block of the WIT in place
  (preserving `core` above and the `world` below byte-identical), and
  emits `src/ugens_component.rs` with one Guest impl per UGen. Each
  impl unpacks the args record, applies registry defaults for any
  `None`, then calls a shared `delegate_ugen(...)` helper.
- `src/component.rs` declares `#[path = "ugens_component.rs"] mod
  ugens_component;`.
- **Native Rust builders under `src/builders/*.rs` are deliberately
  untouched** — Rust callers keep the chained
  `SinOsc::ar().freq(x).phase(y).build(&mut def)` API. The arg-record
  change is a WIT/TS-boundary ergonomics improvement only; the
  component bridge lifts the TS-side records and dispatches to the
  same underlying `SynthDef::add_ugen` as the native builders do.
- `cargo component build` + `cargo test` clean; 13 tests pass (7 unit
  + 6 parity).

Net result: frontend callers only name the args they care about.

```ts
// Before (positional, all args required, scalars wrapped):
ugens.sinOsc(def, 'audio',
  { tag: 'constant', val: 220 },
  { tag: 'constant', val: 0 });

// After (named arg record, optional fields, registry fills in defaults):
const k = (v: number): UgenInput => ({ tag: 'constant', val: v });
ugens.sinOsc(def, 'audio', { freq: k(220) });          // phase → 0 (registry)
ugens.out(def, 'audio', { bus: k(0), channelsArray: [osc] });
```

Housekeeping (post-Phase 3):
- `Rate::parse` in `src/rate.rs` now only admits the SC short forms
  `ar` / `kr` / `ir`. The long-form `audio` / `control` / `scalar`
  strings are no longer accepted Rust-side.
- The per-category UGen registry tables moved from `src/ugens/*.rs`
  to `src/specs/*.rs` (same module API via `mod specs`); the generator
  `scripts/generate_ugens_component.mjs` now reads the new path.
  `registry.rs` imports `crate::specs` instead of `crate::ugens`.

### Build pipeline (extended from Phase 2)

- `yarn build:wasm` now chains `build:wasm:scserver-commands` *and*
  `build:wasm:scsynthdef-compiler`.
- `vite.config.ts` adds the `@wasm/scsynthdef-compiler` alias plus
  sub-path variant, mirroring the scserver-commands setup. Tsconfig
  paths follow.

### Files

- `src/synth/noopSynthDef.ts`
- `src/scope/SynthDefRegistry.ts`
- `src/ui/SynthDefPanel/` — `SynthDefPanel.tsx` + `.scss` + `index.ts`
  matching the per-component directory convention used by
  `ConnectScreen` and `OscConsole`.

### `noopSynthDef.ts`

Trivial graph: `Out.ar(0, DC.ar(0))`. Compiled once via the typed
`ugens` interface (not the stringly-typed `core.SynthDef.addUgen`);
result cached at module scope so subsequent calls are free.

```ts
import { core, ugens } from '@wasm/scsynthdef-compiler';
import type { UgenInput } from '@wasm/scsynthdef-compiler/interfaces/scsynthdef-compiler-core';

const k = (v: number): UgenInput => ({ tag: 'constant', val: v });

let cached: Uint8Array | null = null;

export function compileNoopSynthDef(): Uint8Array {
  if (cached) return cached;
  const def = new core.SynthDef('noop');
  const dc = ugens.dc(def, 'audio', { in: k(0) });
  ugens.out(def, 'audio', { bus: k(0), channelsArray: [dc] });
  cached = def.toBytes();
  return cached;
}
```

Every subsequent `src/synth/*.ts` follows the same pattern — module-scope
cached, typed per-UGen calls. The 365-UGen catalogue covers everything
the plan needs.

### `SynthDefRegistry.ts`

```ts
export class SynthDefRegistry {
  constructor(private client: WorkerClient);
  isLoaded(name: string): boolean;
  async ensureLoaded(name: string, bytes: Uint8Array): Promise<void>;
}
```

`ensureLoaded`: if already tracked, no-op. Concurrent callers for the
same name share one request (via an in-flight `Map<name, Promise>`).
Otherwise uses `WorkerClient.sendCommandAndAwaitSync(buildCmd)` (added
in Phase 2) with the `/sync` bytes embedded in `/d_recv`'s
`completionMsg`, so the server runs the sync *after* the synthdef
installs — not racing a separate `/sync`:

```ts
await client.sendCommandAndAwaitSync((syncId) =>
  dRecvWithSync(bytes, commands.encode(sync(syncId))),
);
```

`/d_recv` failure would never run the completion, so `sendCommandAndAwaitSync`
would just time out. To fail fast with a useful message, the registry
races the await against a reply-stream watcher that rejects on
`{ tag: 'fail', val: { address: '/d_recv', error } }`.

### `SynthDefPanel.tsx`

One React component mounted in the dashboard shell. Single button,
label reflects state: `Load noop SynthDef` → `Loading…` → `Loaded ✓`
(or `Retry` if an error occurred, with the error message rendered
below). On click: `registry.ensureLoaded('noop', compileNoopSynthDef())`
then logs the elapsed time via the debug log panel.

### Acceptance

1. Click → `Loaded ✓` within ~50 ms; `[sc:synthdef] noop loaded in
   Nms` appears in the debug log.
2. Second click → promise resolves instantly; no extra `/d_recv`
   frames sent (visible in the OSC console's reply log — no `/synced`
   appears the second time).
3. Corrupt bytes (force-flip one byte in `cached` before posting) →
   `/fail` reply → UI shows the error message; `isLoaded('noop')`
   stays `false`; a retry works.
4. Kill scsynth mid-session, reload the page → reconnect → click
   works again.

---

## Phase 4 — Parent Group & `/n_run` Plumbing

**Goal.** Prove group create/pause/resume/free. First visual state indicator in the UI.

### Files (as landed)

- `src/scope/IdAllocator.ts`
- `src/scope/GroupController.ts`
- `src/synth/silentTestSynthDef.ts` (dev)
- `src/ui/ClockPanel/{ClockPanel.tsx, ClockPanel.scss, index.ts}`
- `src/scope/AppShell.tsx` (extended)
- `src/ui/SynthDefPanel/SynthDefPanel.tsx` (registry hoisted out)

### `IdAllocator.ts`

```ts
export class IdAllocator {
  constructor(base: number);
  next(): number;
}
```

Three instances are created per-connection inside `AppShell.bringUpDashboard`:
```ts
const ids = {
  node: new IdAllocator(1000),
  buffer: new IdAllocator(1000),
  bus: new IdAllocator(32),   // skip hardware-reserved buses
};
```

### `silentTestSynthDef.ts`

Dev heartbeat. The idiomatic sclang form shares one `Impulse.kr` between
the trigger and the counter so they stay phase-locked:

```ts
const imp = ugens.impulse(def, 'control', { freq: k(5) });
const count = ugens.pulseCount(def, 'control', { trig: imp });
ugens.sendTrig(def, 'control', { in: imp, id: k(9999), value: count });
```

Result compiled bytes cached at module scope, same shape as
`noopSynthDef`. `SILENT_TEST_TRIG_ID = 9999` is exported so the panel
can filter incoming `/tr` replies.

### `GroupController.ts`

```ts
export type GroupState = 'stopped' | 'running' | 'paused';

export class GroupController {
  constructor(client: WorkerClient, groupId: number);
  readonly state: ReadonlyStore<GroupState>;

  async ensureCreated(): Promise<void>;   // idempotent; creates group as running
  async pause(): Promise<void>;           // n-run(groupId, 0)
  async resume(): Promise<void>;          // n-run(groupId, 1)
  async free(): Promise<void>;            // g-freeAll + n-free
  async queryTree(): Promise<ServerReply>;
}
```

Convention: group is created as running. `Pause`/`Resume` toggles
`/n_run`. **No `'disconnected'` state** — `AppShell` already unmounts
the whole dashboard on `WorkerClient.onError`, so carrying a disconnect
branch inside the controller would only ever flash for ~1 frame before
the component goes away.

`queryTree()` matches the `/g_queryTree.reply` OSC message which
`scserver-commands` surfaces as `ServerReply { tag: 'other' }` (no
dedicated variant in the typed surface).

### `ClockPanel.tsx` (React)

Rendered inline inside `Dashboard`, *not* fixed-position — the dashboard
already stacks panels vertically (ClockPanel → SynthDefPanel → OscConsole).

- **State pill.** `● Running` / `⏸ Paused` / `○ Stopped`. Colored via
  `.pill.running|paused|stopped` SCSS modifiers.
- **Pause/Resume button.** Label depends on state; disabled when
  `stopped` or while an awaited `/sync` is in flight.
- **QueryTree button.** Calls `group.queryTree()` and logs the raw
  `ServerReply` to the console.
- **Heartbeat readout.** Count of `/tr` replies whose
  `triggerId === SILENT_TEST_TRIG_ID` in the last 1 s. Ring-buffer of
  timestamps, re-rendered on a 200 ms `setInterval`.

State subscription via `useSyncExternalStore` against
`group.state` (which is a `ReadonlyStore<GroupState>` from the existing
`reactiveStore.ts`).

### Dashboard wiring (Phase 4 state)

`AppShell` holds a `resources` object — `{ client, registry, group, ids }`
— created once per connection by `bringUpDashboard(client)`:

```ts
async function bringUpDashboard(client: WorkerClient): Promise<DashboardResources> {
  const ids = { node: new IdAllocator(1000), buffer: new IdAllocator(1000), bus: new IdAllocator(32) };
  const registry = new SynthDefRegistry(client);
  const group    = new GroupController(client, PARENT_GROUP_ID); // = 100

  await registry.ensureLoaded('silentTest', compileSilentTestSynthDef());
  await group.ensureCreated();
  await client.sendAndSync(
    cmd.sNewEasy('silentTest', ids.node.next(), cmd.AddToHead, PARENT_GROUP_ID),
  );
  return { client, registry, group, ids };
}
```

On disconnect (user-initiated), `handleDisconnect` awaits
`group.free()` before `client.dispose()` so the server is left clean.
On unexpected disconnect (WebSocket error), the onError handler just
disposes the client — the group is abandoned but the scsynth process is
being torn down by the same event.

`SynthDefPanel` no longer owns its own `SynthDefRegistry`; it receives
the hoisted instance from the dashboard. Both panels share state, which
matters for Phase 5 onwards.

`PARENT_GROUP_ID = 100` is a named constant inside `AppShell.tsx`
(sclang convention for the default user group).

### Acceptance

1. Connect → dashboard mounts with `● Running` + heartbeat ~5 /s.
2. `Pause` → `⏸ Paused`; heartbeat drops to 0 within ~200 ms.
3. `Resume` → back to ~5 /s; underlying PulseCount continues (visible in the `value` field of subsequent `/tr` replies in the debug log).
4. `QueryTree` → `[sc:clock] queryTree → { tag: 'other', val: { address: '/g_queryTree.reply', args: [...] } }` in the console, with group 100 containing the heartbeat synth.
5. Manual `Disconnect` → `group.free()` fires cleanly (group removed server-side); dashboard → connect screen.
6. Kill bridge → dashboard unmounts within ~1 s via the existing `onError` path.

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

On `registerClock`: remember `trigId`. On decoded reply, when
`reply.tag === 'tr' && reply.val.triggerId === trigId`: emit
`clockTick` with `tickIndex` = `reply.val.value | 0` (coerced from f32),
**suppress** the generic `reply` for that message. Other `tr` replies
with different `triggerId` pass through normally.

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

### Adaptations from the written plan (agreed before implementation)

1. **`ClockController` composes `GroupController` — does not inherit it.**
   Plan said `extends`. Composition scales better to Phase 7+ where
   `ScopeController` / `RecorderController` also need the same group;
   inheritance would have each controller "own" the singleton group.
   `clock.stop()` still maps to `group.pause()` internally, so behaviour
   is unchanged.
2. **`silentTestSynthDef.ts` is deleted** (and the heartbeat code path
   in `ClockPanel`). Phase 5 replaces the dev heartbeat with the real
   clock (trigId 1000), which drives the same slot in the panel.
3. **`trigId` is baked into the compiled SynthDef as a constant
   (`k(1000)`); `tickRate` is a compile-time parameter of
   `compileClockSynthDef(params)` sourced from `ClockParams`.** Plan's
   sclang had both as synth args. Hardcoding `trigId` matches the
   "reserved sentinel" semantic; threading `tickRate` through
   `ClockParams` keeps one source of truth with `deriveClock()`.
4. **Effective state is computed inside the controller, not the panel.**
   `ClockController.effectiveState: ReadonlyStore<'running' | 'paused'
   | 'stopped'>` derives from `group.state + tickFresh`. The panel just
   renders it. Simpler, and makes the watchdog testable in isolation.
5. **`bringUpDashboard` loses its manual `registry.ensureLoaded` +
   `sNew` dance.** Phase 5 consolidates it into `clock.start()`, which
   ensures the group, loads the SynthDef on demand, and adds the clock
   synth at head of the group.

### Prerequisite fix: enable `/notify 1` on connect

`/tr` replies from `SendTrig` are only broadcast to clients that have
registered via `/notify 1`. We were never sending it — symptom was the
Phase 4 heartbeat counter sitting at 0/s even with the synth running.
Fix lands in `AppShell.handleConnect` right after the `/status` probe
and before `bringUpDashboard`. The same flag is required in Phase 5
for the clock ticks and in later phases for `/n_go`, `/n_end`, etc.

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
import { bGetn } from '../scope/cmd';

export class BufferPoker {
  constructor(private client: WorkerClient);
  async poke(bufnum: number, offset: number, count: number): Promise<Float32Array>;
}
```

Sends `bGetn(bufnum, offset, count)`; awaits a reply with
`reply.tag === 'b-setn' && reply.val.bufnum === bufnum`. The typed
variant (see Crate Prerequisites) gives `reply.val.samples` as a
`Float32Array` directly — no boxing, one memcpy from the wasm side.
Serializes pokes per bufnum (simple queue — one request in flight per
buffer, because scsynth matches replies by bufnum only).

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

On decoded reply `{ tag: 'tr', val: { triggerId, value } }` where
`triggerId` matches the registered clock id (`value | 0` is the
`tickIndex`):

```
emit clockTick to main
for each subscription:
    completedHalf = (tickIndex % 2 === 1) ? 0 : 1    // see parity note below
    offset = completedHalf * chunkSize * channels
    count  = chunkSize * channels
    send bGetn(bufnum, offset, count)
    subscription.pendingRead = { tickIndex }
    subscription.parity ^= 1
```

**Parity.** Clock starts at `phase = 0`. First tick fires at phase crossing `chunkSize` → first half `[0, chunkSize)` just completed → read first half. So `tickIndex === 1` → read half 0. `tickIndex === 2` → read half 1. → `completedHalf = 1 - (tickIndex % 2)`. Verify empirically in acceptance test; flip bit if off.

**chunkSize** per subscription: scopes use `scopeChunkSize` from `registerClock`; recordings (Phase 12) use `samplesPerTick`.

### On incoming `BSetn` reply

With the typed variant in place, the worker matches on tag directly and
gets a `Float32Array` for the sample payload — no boxed-per-element JS
objects:

```
// reply: { tag: 'b-setn', val: { bufnum, start, samples: Float32Array } }
entry = table.byBufnum(reply.val.bufnum)
if no entry: forward as generic reply
if no pendingRead: log warning, drop
tickIndex = entry.pendingRead.tickIndex
entry.pendingRead = null
data = reply.val.samples              // already a Float32Array
if entry.kind === 'scope':
    postMessage({ type: 'scopeChunk',
                  chunk: { scopeId, data, channels, tickIndex } },
                [data.buffer])        // transfer ownership, zero-copy
```

**Unknown reply fallback.** Any reply whose address isn't in the typed
catalogue lands in `{ tag: 'other', val: { address, args } }` — the
worker forwards those unchanged as generic `reply` events. `/b_info`
(response to `/b_query`) and `/g_queryTree.reply` come through this path
and callers parse them manually when needed.

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

`start` (using the `scope/cmd` helpers):
1. `registry.ensureLoaded('scopeTap', compileScopeSynthDef())`.
2. `bufnum = ids.buffer.next()`; `nodeId = ids.node.next()`.
3. `await client.sendAndSync(bAlloc(bufnum, clock.derived.scopeRingSize, channels))`.
4. `client.sendCommand(sNew('scopeTap', nodeId, AddToTail, clock.parentGroupId, { in: inputBus, bufnum, clockBus: clock.clockBus, channels }))`.
5. `client.subscribeScope({ scopeId, bufnum, channels })`.
6. `client.onScopeChunk(scopeId, chunk => latestChunk.set(chunk))`.

`stop`: unsubscribe; `client.sendCommand(nFree(nodeId))`; `client.sendCommand(bFree(bufnum))`. Idempotent.

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

**Goal.** Record one or more buses to sample-accurate, gap-reported WAV files. Fully synchronized with global clock — same tick drives every recording and scope. WAVs accumulate in memory and are downloaded as Blobs on stop.

### Files

- `src/synth/recorderSynthDef.ts`
- `src/workers/wavWriter.ts`
- `src/recording/RecordingController.ts`
- `src/recording/RecordingManager.ts`
- `src/recording/download.ts`
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
  sampleRate: number;                                   // from clock.env
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
  // Transferable ArrayBuffers: zero-copy hand-off to main thread.
  wav: ArrayBuffer;                    // complete WAV file with patched header
  gapsJson: string;                    // sidecar JSON, small
}

// MainToWorker:
| { type: 'startRecording'; subscription: RecordingSubscription }
| { type: 'stopRecording'; recordingId: string }

// WorkerToMain:
| { type: 'recordingChunkWritten'; info: RecordingChunkWritten }
| { type: 'recordingGap'; gap: RecordingGap }
| { type: 'recordingDone'; done: RecordingDone }
```

No `FileSystemFileHandle`. The worker holds the entire WAV payload in
memory; on stop it posts the completed `ArrayBuffer` to main with a
`Transferable` (zero-copy hand-off), and the main thread turns it into
a `Blob` and triggers a download.

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
  writer: WavMemoryWriter;
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
    issue bGetn for completed half
    entry.pendingRead = { tickIndex, seq: assign, attempts: 1, timeoutHandle: setTimeout(retry, deadlineMs) }
```

Retry callback:
```
if attempts < maxAttempts:
    re-send bGetn
    attempts++
    reschedule timeout
else:
    record gap: { tickIndex, framesMissing: samplesPerTick }
    write zeros of length samplesPerTick * channels
    pendingRead = null
    advance nextSeqToWrite
```

On typed `b-setn` reply for a recording bufnum:
- Clear timeout, clear pendingRead.
- If `seq === nextSeqToWrite`: append to WAV, advance, drain reorder buffer if any successors waiting.
- If `seq > nextSeqToWrite`: store in reorder buffer.
- If `seq < nextSeqToWrite`: duplicate from retry, discard.

### `wavWriter.ts`

In-memory WAV encoder. Grows a `Uint8Array` with doubling-capacity
strategy; on finalise, patches the two size fields in the header and
returns the complete buffer.

```ts
export class WavMemoryWriter {
  constructor(opts: { sampleRate: number; channels: number; bitDepth: 32 });

  /** Append one chunk of interleaved float32 frames. */
  append(frames: Float32Array): void;

  /** Number of frames appended so far (for UI readouts). */
  readonly framesWritten: number;

  /** Finalise the in-memory file — patches RIFF size + data size in the
   *  header — and returns the complete ArrayBuffer. Transfer ownership
   *  to main thread; writer is unusable after this. */
  finalise(): ArrayBuffer;
}
```

WAV format details:
- RIFF + WAVE chunks.
- `fmt ` subchunk: format code 3 (`WAVE_FORMAT_IEEE_FLOAT`), not 1 (PCM). Bit depth 32.
- `data` subchunk: raw Float32 little-endian interleaved samples.
- Header written with placeholder `RIFF size` and `data size` (zeros); patched in `finalise()`. Total file size must fit in 32 bits — at 48 kHz stereo float32, that's ~3 hours 45 minutes. For longer, use RF64 (out of scope here; document the limit).
- Gaps are tracked separately and posted back as a JSON string in
  `RecordingDone.gapsJson`; the main thread offers them as a sidecar
  `.gaps.json` download alongside the WAV.

**Memory budget.** Float32 at 48 kHz: ~11.5 MB/min mono, ~23 MB/min
stereo. 10-minute stereo ≈ 230 MB, 30-minute stereo ≈ 690 MB. The
doubling-capacity strategy allocates in powers of two — peak transient
footprint is ~2× current size during growth. For long sessions, split
into multiple recordings.

### `RecordingController.ts`

```ts
export interface RecordingResult {
  wavBlob: Blob;                                  // complete WAV file
  gaps: Array<{ tickIndex: number; framesMissing: number }>;
  totalFrames: number;
  durationSeconds: number;
  suggestedFilename: string;                      // e.g. 'bus-16-2026-04-24T18-04-12.wav'
}

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
  /** Populated after `stop()` resolves. Also returned from `stop()`. */
  readonly result: ReadonlyStore<RecordingResult | null>;

  async start(opts: { inputBus: number; channels: number; label?: string }): Promise<void>;
  /** Stops the recorder synth, awaits `recordingDone`, returns the finalised result. */
  async stop(): Promise<RecordingResult>;
}
```

`start` (using the `scope/cmd` helpers):
1. `registry.ensureLoaded('recorderTap', compileRecorderSynthDef())`.
2. `bufnum = ids.buffer.next()`; `nodeId = ids.node.next()`.
3. `await client.sendAndSync(bAlloc(bufnum, recordRingSize, channels))`.
4. `client.sendCommand(sNew('recorderTap', nodeId, AddToTail, parentGroup, { in: inputBus, bufnum, channels, recChunkSize: samplesPerTick }))`.
5. `client.startRecording({ subscription: { recordingId, bufnum, channels, sampleRate: clock.env.sampleRate, retry } })`.
6. Subscribe to `recordingChunkWritten`, `recordingGap`, `recordingDone` for this `recordingId`; update reactive stores.

The recorder's `/b_setn` reads go through the same typed `b-setn`
variant as scopes — the subscription-table entry kind discriminates
whether the payload goes to the renderer or the WAV writer.

`stop`:
1. `client.sendCommand(nFree(nodeId))` — immediately stops new samples.
2. `client.sendCommand(bFree(bufnum))`.
3. `client.stopRecording({ recordingId })` → worker finalises the WAV
   (patches header) and posts `recordingDone` with the `ArrayBuffer`
   transferred (zero-copy).
4. On receipt: wrap as `new Blob([arrayBuffer], { type: 'audio/wav' })`,
   populate `result`, resolve the promise.

### `RecordingManager.ts`

```ts
export class RecordingManager {
  constructor(/* ... */);
  readonly recordings: ReadonlyStore<RecordingController[]>;
  async add(opts: { inputBus: number; channels: number; label?: string }): Promise<RecordingController>;
  async remove(recordingId: string): Promise<void>;
  async stopAll(): Promise<RecordingResult[]>;     // returns one result per stopped recording
}
```

`add` just constructs a `RecordingController` and starts it — no file
picker needed. The user chooses the filename at download time in the
`RecordingPanel`.

#### Download helper

A tiny shared utility used by `RecordingPanel`:

```ts
// src/recording/download.ts
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke after the browser has a chance to consume the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

### `RecordingPanel.ts`

Per recording:
- Status pill: Idle / Recording / Finalizing / Done / Error.
- Elapsed: `framesWritten / sampleRate`, formatted as `mm:ss.mmm`.
- Frame count.
- Gap count (with tooltip listing them).
- Memory estimate: `framesWritten × channels × 4 / 1024^2` MB (rough
  indicator; doubles the number when the backing array grows).
- Stop button.
- Once `state === 'done'`: **Download WAV** button (calls `downloadBlob`
  with `result.wavBlob` + `result.suggestedFilename`). If any gaps were
  logged, also **Download gaps.json** button for the sidecar.

Global: "New recording" button (prompts for bus + channel count only —
no file picker). Recordings stay in memory until downloaded or the page
is reloaded.

### Pause-recording behavior

`/n_run 0` on parent group pauses the recorder synth. No new samples are written to the buffer. The worker's tick stream also halts (clock is in the same group). So: during pause, no ticks → no reads → no new WAV writes. On resume, ticks start again, reads resume, WAV appends contiguously. The WAV represents *running audio time*, not wall time — this is almost always what you want.

### Acceptance

1. **Single mono recording.** 440 Hz tone on bus 16, 5 s recording → Stop
   → Download WAV → file ~960 KB (5 × 48000 × 4 bytes + 44-byte header).
   Open in Audacity → sine wave, no gaps. Sample count = 240000 ±
   `samplesPerTick` (startup skip).
2. **Simultaneous stereo recording + scope on same bus.** Two subscriptions, one bufnum each. Scope updates live; WAV captures fully. WAV content matches what was visible on scope (modulo scope decimation).
3. **Pause/resume.** Record 3 s → Stop → wait 2 s wall time → Start → record 3 s → Stop. WAV is 6 s, contiguous sine, no discontinuity at the pause point.
4. **Multi-bus sample alignment.** Record bus 16 (440 Hz) and bus 17 (660 Hz) simultaneously into two separate WAVs. Open both in a DAW aligned at t=0 → both start and end at the same tick; relative phase is preserved.
5. **Gap handling.** Fault-inject: drop every 50th `/b_setn` → retry succeeds → no gaps in output. Then drop every 50th twice in a row → gap logged; WAV contains zero-fill; sidecar `gaps.json` lists it.
6. **Long-run sanity.** 10-minute stereo recording → post-Stop Blob is
   ~230 MB; download succeeds; Audacity opens it. 30-minute recording
   hits ~690 MB peak RAM — documented ceiling, not a supported target.
7. **Transfer is zero-copy.** During stop, the posted `ArrayBuffer` is
   detached in the worker after transfer (DevTools memory snapshot
   shows it moves, not duplicates).
8. **Teardown.** `stopAll` during recording → WAVs finalize for each
   controller; results accumulate in the panel; server clean.

---

## Phase 13 — UI Polish & Teardown

**Goal.** Production-adjacent UX and resource hygiene.

### Deliverables

- **Unified Clock Panel.** State pill covers both scope and recording states. Clear labels for disconnected state.
- **Connection resilience for PoC.** On WS close, all panels show disconnected state; reload button visible. No automatic reconnect.
- **`beforeunload` handler.** Stops all recordings (finalises WAVs into
  in-memory Blobs), clears all scopes, frees parent group. Note:
  unfinalised recording data is lost on navigation — warn the user via
  `beforeunload` if any recording is `state === 'recording'` or has an
  un-downloaded `result`.
- **Dev-mode toggle.** `?debug` flag shows `OscConsole`, `PhaseProbePanel`, `ScopePokerPanel`, `ScopeDebugPanel`. Off by default.
- **QueryTree diagnostic.** Button in a dev corner. Logs a parsed view of `/g_queryTree.reply` to console — verifies no leaks.
- **Final styling pass.** Coherent spacing, colors, monospace for numbers.

### Acceptance

1. Full session: clock on, 3 scopes, 2 recordings. Stop both recordings
   → both Blobs downloadable via the panel. Close tab → `scsynth` has
   no residual nodes/buffers (verify from a separate OSC client).
   Un-downloaded Blobs are lost (documented behaviour; `beforeunload`
   warns).
2. 5-minute idle with clock running → no memory growth; tick UI still accurate.
3. Kill bridge mid-session → UI goes disconnected; active recordings
   finalise with last-known frame count + gap entry covering the outage;
   Download buttons still work.
4. `?debug` URL shows dev panels; default URL hides them.

---

## Open Points

1. **Crate type surfaces — resolved.** See "Crate Prerequisites" for the
   two typed reply variants (`BSetn`, `Synced`) to add before starting.
   The command side is fully typed via `ServerMessage`; UGens in the
   plan (`Impulse`, `PulseCount`, `SendTrig`, `Phasor`, `BufWr`, `In`,
   `Out`, `SinOsc`, `SampleRate`, `A2K`, `DC`) all exist in the 365-UGen
   catalogue baked into `scsynthdef-compiler`.
2. **`/b_setn` payload — resolved by typed variant.** With the typed
   `BSetn` variant in place, jco lifts `samples: list<f32>` as
   `Float32Array` directly — one memcpy, no per-sample boxing.
3. **Reply correlation for `b-getn`** — scsynth matches replies by bufnum, not by explicit request id. The "one read in flight per bufnum" invariant is what makes this safe; the worker enforces it. Dev-only assertion recommended.
4. **Parent group ID.** Hardcoded 100 in examples; promote to `IdAllocator` allocation (e.g. base 100, one group per app instance).
5. **Clock bus ID.** Allocated from `ids.bus`; starts at 32 to skip hardware-reserved buses. Confirm against scsynth boot config.
6. **Phase boundary parity derivation.** The `completedHalf = 1 - (tickIndex % 2)` formula is an educated guess; verify empirically and flip if wrong.
7. **`BufWr` decimation behavior.** The scope synth relies on `BufWr.ar` at a slow-advancing phase to effectively decimate; this is zero-order-hold, not a proper anti-aliased decimation. Fine for visual scope; revisit if aliasing becomes visible.
8. **Recording memory ceiling.** Float32 stereo at 48 kHz is ~23 MB/min;
   Blob accumulation means a practical 10–15 min comfortable ceiling
   before RAM pressure. Split into multiple recordings for longer
   captures. Streaming-to-disk (File System Access API or Tauri native)
   deferred.
9. **WAV 4 GB header limit.** Float32 stereo at 48 kHz → ~3h45m max file
   size in the WAV header. Well above the RAM ceiling above, so not
   binding in practice. RF64 deferred.
10. **Reconnection.** Out of scope. App expects a manual reload on WS loss.
11. **Ordering constraints within parent group.** Clock must be at head; scopes and recorders at tail; sources (testTone, or real audio synths added later) must be placed before scopes that read them. Caller responsibility; document clearly.
12. **Future: FFT / spectral scopes.** The 250-sample chunk isn't power-of-2. For spectral features, accumulate 4 consecutive chunks into 1000 samples and zero-pad/truncate to 1024. Separate component, no impact on this plan.

---

## Milestone Summary

Both `scserver-commands` and `scsynthdef-compiler` are already
implemented and tested (typed encode/decode, SynthDef builder, jco
bindings, parity harness against sclang). This eliminates the largest
sources of risk the original plan was sized for — no typed-variant
bring-up, no SynthDef wire-format debugging, no stringly-typed guess-
work. Estimates below reflect that.

| Phase | What ships | Duration |
|---|---|---|
| 0 | Tauri skeleton + WS↔UDP bridge (per-session scsynth) + `serve` CLI | 1 day |
| — | **Crate prerequisites** (`BSetn` + `Synced` reply variants) | ¼ day |
| 1 | Connect Screen + Worker transport + OSC console (bytes) | ½ day |
| 2 | Typed command/reply proxy + `cmd.ts` helpers + `sendAndSync` | ½ day |
| 3 | SynthDef compile via `core.SynthDef`, registry + `/d_recv` correlation | ¼ day |
| 4 | Parent group + pause/resume + first state pill | ½ day |
| 5 | Global clock SynthDef + tick stream → UI elapsed/counter | ½ day |
| 6 | Shared phasor on clock bus, verified by probe | ½ day |
| 7 | Scope synth writing, verified by manual poke | ½ day |
| 8 | Tick-driven chunk stream + subscription table + typed `b-setn` | 1 day |
| 9 | Single-channel waveform on canvas | ½ day |
| 10 | Multi-channel interleaved stacked lanes | ¼ day |
| 11 | Multi-scope, shared clock, add/remove | ½ day |
| 12 | Recording pipeline (in-memory Blob, gap handling) | 1 day |
| 13 | UI polish, teardown, dev-flag gating | ½ day |

**Total: ~7.75 days** of focused development for a complete,
clock-synchronized, multi-scope + multi-recorder PoC with a working
Tauri GUI + standalone web server and a Connect Screen gate.

The **critical spine** is Phase 0 through Phase 8: everything after that
is rendering, UX, and recording. A bare-minimum demo (one scope,
numeric readout, no recording) is reachable in ~4 days through Phase 8.

Risk notes:
- Phase 8's parity derivation (`completedHalf = 1 - (tickIndex % 2)`)
  is the one acceptance test most likely to need a bit-flip; budget a
  half-day slip here if you want to be conservative.
- Phase 12's WAV header-patching and interleaving work is boring but
  detail-heavy. The 1-day estimate assumes in-memory accumulation; if
  you later add streaming-to-disk it doubles.
