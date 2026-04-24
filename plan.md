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
┌──────────────────────── Browser (Vite app) ─────────────────────────┐
│                                                                     │
│  [ ConnectScreen ] ──user clicks Connect──► AppShell ────┐          │
│  (scsynth addr form)                                     │          │
│                                                          ▼          │
│  ┌────────────┐  ┌─────────────────┐  ┌─────────────────────────┐   │
│  │ Canvas × N │◄─┤ ScopeRenderer×N │◄─┤                         │   │
│  └────────────┘  └─────────────────┘  │                         │   │
│                                       │                         │   │
│  ┌────────────┐  ┌─────────────────┐  │    Scope Worker         │   │
│  │ WAV Blobs  │◄─┤RecordingMgr     │◄─┤    - owns WebSocket     │   │
│  │ (download) │  └─────────────────┘  │    - osc-js decode      │   │
│  └────────────┘                       │      + clock /tr mux    │   │
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
                                 ┌──────────── src-tauri/ ──────────────┐
                                 │  ┌─────────────────────────────┐     │
                                 │  │ CLI (clap)                  │     │
                                 │  │ `sc-oscilloscope`   → GUI   │     │
                                 │  │ `sc-oscilloscope serve` → HTTP    │
                                 │  └─────────────┬───────────────┘     │
                                 │                ▼                     │
                                 │     ┌────────────────────┐           │
                                 │     │ server/ws_bridge   │ (Phase 0) │
                                 │     │ 1 WS = 1 UDP sock  │           │
                                 │     └──────────┬─────────┘           │
                                 └────────────────┼─────────────────────┘
                                                  │ UDP :<picked>
                                                  ▼
                                           ┌──────────┐
                                           │  scsynth │
                                           └──────────┘
```

**Key architectural principles:**

1. **Worker owns the WebSocket.** Main thread never touches `new WebSocket(...)` directly. All OSC traffic flows through typed `postMessage`.
2. **Main thread encodes, worker forwards.** Main thread constructs `OSC.Message` / `OSC.Bundle` via `@sc-app/server-commands` and encodes to bytes locally; the worker only transports bytes and decodes inbound replies into plain `{ address, args }` POJOs.
3. **Global clock, single source of timing.** One `SendTrig` stream from a dedicated clock SynthDef. All scopes and recordings align to these ticks — no custom per-scope timing messages. The first tick establishes a main-thread `tick0Ms` anchor that `tickToTimetag(tickIndex)` uses to convert server-side tick coordinates into NTP timetags for scheduled bundles.
4. **Scheduling via OSC bundle timetags.** Any command that needs sample-accurate timing is wrapped in an `OSC.Bundle` with a future NTP timestamp; scsynth queues the bundle and fires it at that exact audio frame. The default live-command latency budget is 200 ms (sclang convention). Phase 12 (recording start/stop) is the phase that benefits most.
5. **Parent group as master switch.** Every synth (clock, scopes, recorders, audio sources) lives in one group. `/n_run 0/1` on that group pauses/resumes everything in lockstep.
6. **Alignment via shared phasor.** The clock publishes its phasor on an audio bus. Scope synths read it as their `BufWr` index → all scopes write in perfect sync → worker can derive chunk parity from `tickIndex` alone, no server-reported phase needed.
7. **Recordings reuse the tick stream.** Recorder synths run their own full-rate phasor (local, not from the clock bus) sized to `sampleRate / tickRate`. Each tick = one completed half-buffer. Same worker dispatch path as scopes; different downstream sink.

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

## Workspace packages

The app is a yarn workspace with two local TS packages under
`packages/`; the Rust crates that used to back them live in a
sister repo at `git@github.com:nicmell/sc-crates.git` and are no
longer referenced from this project.

### `@sc-app/server-commands` (OSC layer)

Wraps [`osc-js`](https://github.com/adzialocha/osc-js). scsynth
honours NTP timetags on OSC bundles, queueing them internally and
firing at the exact audio frame — this package exposes that
primitive via `OSC.Bundle` + `tickToTimetag`, which is what
Phase 12 recording start/stop uses for sample-accurate alignment.

Shape of the surface:

- **`OSC`** — the `osc-js` default export, re-exported as a named
  symbol. `new OSC.Message(address, ...args)` and `new OSC.Bundle(
  timetag, [packet, …])` are the primary types.
- **`encode(packet)` / `decode(bytes)`** — thin wrappers over
  `osc-js`. Return / accept `OSC.Message | OSC.Bundle`.
- **Command constructors** — per-address functions in
  `commands/{node,group,synthdef,buffer,control,misc}.ts`. Each
  returns an `OSC.Message` with the OSC address as the discriminator
  (`/s_new`, `/n_run`, `/d_recv`, …). Helpers accept the ergonomic
  shape the old `cmd.ts` wrappers did (e.g. `sNew(defName, nodeId,
  addAction, targetId, { freq: 440, bus: 'c10' })`).
- **Reply accessors** — constant address strings (`ADDR_TR`,
  `ADDR_SYNCED`, …) plus tiny positional readers (`Tr.nodeId(msg)`,
  `Synced.syncId(msg)`, `BSetnReply.samples(msg)`, …) that name the
  arg slots for callers. `BSetnReply.samples` copies into a
  `Float32Array` so downstream code gets a tight typed array rather
  than the boxed `number[]` osc-js decode produces.
- **Timetag helpers** — `immediate()`, `atDate(ms)`, `inFuture(ms)`,
  and `tickToTimetag(tick0Ms, tickIndex, tickRate)` — the last one
  turns a server-side tickIndex into a JS ms timestamp for
  `OSC.Bundle`'s constructor, using a one-shot calibration captured
  when tick 0 arrives (see Phase 5's ClockController).

Main ↔ worker interchange: the main thread encodes packets to bytes
via osc-js and posts `{ type: 'send', bytes }` to the worker; the
worker just forwards to the WebSocket. Inbound bytes are decoded in
the worker to an `OSC.Message` / `OSC.Bundle`, flattened if a bundle,
and posted as plain `{ address, args }` POJOs (structured-clone
strips `OSC.Message`'s prototype). `WorkerClient.onReply(cb: (msg:
OscReply) => void)` exposes the POJO directly — consumers match on
`msg.address`.

Why not use `WebsocketClientPlugin`: we keep our thin custom
WebSocket transport (`src/workers/transport.ts`) because the existing
`/tr` intercept for clock ticks is easier to express as a decode
hook in the worker than as `osc.on('/tr', …)` with a secondary mux.
Swap later if it buys enough.

### `@sc-app/synthdef-compiler` (SynthDef compiler)

Pure-TS compiler for the [SynthDef File Format v2][scgf] binary
that scsynth accepts. Byte-identical output to sclang's compiler for
every fixture in the test suite.

[scgf]: https://doc.sccode.org/Reference/Synth-Definition-File-Format.html

Three API layers — all produce the same SCgf v2 bytes:

- **`synthdef(name, fn)`** (recommended) — sclang-style callback:

  ```ts
  const def = synthdef('sine', (g, { freq = 440, amp = 0.5 }) => {
    const osc = g.SinOsc.ar(freq, 0);
    g.Out.ar(0, g.mul(osc, amp));
  });
  ```

  Controls are declared by the callback's second-argument
  destructuring pattern. `ar(v)` / `ir(v)` wrappers override the
  default control rate (kr). The `g` namespace exposes every
  bundled UGen with positional `.ar()` / `.kr()` / `.ir()` methods
  plus arithmetic helpers (`mul`, `add`, `neg`, …).

- **Typed chainable builders** (`@sc-app/synthdef-compiler/builders`)
  — one class per bundled UGen with arg-setter methods and a
  `.build(def)` terminal. The composable primitive the sugar form
  is built on.

- **Low-level `SynthDef.addControl` / `addUgen`** — stringly-typed
  direct API for programmatic construction outside a callback.

Also exports `SynthDef.fromBytes` / `toJson` / `fromJson` for
round-trip / inspection, and `lookupUgen` / `ugensByCategory` for
the bundled registry (365 UGens shipped).

---

## Assumptions & Dependencies

- **scsynth** running on UDP `127.0.0.1:57110` at 48 kHz. Not booted or managed by this app.
- **WS↔UDP bridge is implemented in Phase 0** of this plan as part of
  the Tauri backend (`src-tauri/src/server/ws_bridge.rs`). Endpoint at
  `VITE_OSC_WS_URL` (default `ws://127.0.0.1:3000`). 1 WS binary frame ↔
  1 UDP datagram. The backend boots in two modes: native Tauri app (GUI
  shell) or standalone HTTP server (`sc-oscilloscope serve`) — same
  bridge code path.
- **`@sc-app/server-commands`** (workspace package) — osc-js-based
  OSC layer; see the Workspace Packages section above.
- **`@sc-app/synthdef-compiler`** (workspace package) — pure-TS
  SynthDef compiler; see the Workspace Packages section above. The
  365 bundled UGens cover everything this plan needs (`Impulse`,
  `PulseCount`, `SendTrig`, `Phasor`, `BufWr`, `In`, `Out`,
  `SinOsc`, `SampleRate`, `A2K`, `DC`).
- **Bundle budget.** Both packages are pure JS. `osc-js` is ~6 KB
  gzipped; `@sc-app/synthdef-compiler` ships the UGen registry
  (~250 KB source) that gets tree-shaken to the callers'
  actually-used UGens by Vite. No wasm in the main or worker chunks.
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
packages/                             # yarn workspace — pure-TS libs
  server-commands/                    # osc-js-based OSC layer
    src/
      index.ts
      encode.ts                      # bytes ↔ OSC.Message / OSC.Bundle
      timetag.ts                     # immediate / atDate / inFuture / tickToTimetag
      types.ts                       # OscArg, ControlKey, ControlValue
      replies.ts                     # Tr / Synced / Fail / StatusReply / …
      commands/                      # per-category message constructors
        {node,group,synthdef,buffer,control,misc}.ts
  synthdef-compiler/                  # SCgf v2 compiler (pure TS)
    src/
      index.ts
      synthdef.ts                    # SynthDef class + parseScgf
      rate.ts, operators.ts, registry.ts, ugen-input.ts, error.ts
      sugar/                          # `synthdef(name, fn)` callback form
        {synthdef,controls,graph,parse-fn,graph.types}.ts
      builders/                      # typed chainable builders (365 UGens)
      specs/                          # UGen registry data
    tests/                            # vitest suite (41 tests)
    examples/node/sclang_parity.ts   # optional sclang byte-diff harness

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

src/                                  # app frontend (React)
  config/
    clockConfig.ts                   # ClockParams, deriveClock, defaults
  workers/
    scopeWorker.ts                   # Vite ?worker entry
    workerBootstrap.ts               # pre-import buffer + osc-js window shim
    transport.ts                     # WS wrapper (worker-internal)
    subscriptionTable.ts             # scope + recording subscription registry
    wavWriter.ts                     # in-memory WAV encoder (worker-side)
  scope/
    AppShell.tsx                     # connect ↔ dashboard orchestration (React)
    workerProtocol.ts                # main ↔ worker message shapes
    WorkerClient.ts                  # main-thread wrapper around Worker
    IdAllocator.ts                   # node / buffer / bus ID counters
    SynthDefRegistry.ts              # tracks loaded SynthDefs
    GroupController.ts               # parent group lifecycle
    ClockController.ts               # composes GroupController; owns clock synth
    ScopeController.ts               # one per scope
    ScopeManager.ts                  # collection of scopes
    ScopeRenderer.ts                 # canvas RAF loop
    reactiveStore.ts                 # tiny observable helper
  recording/
    RecordingController.ts           # one per recording
    RecordingManager.ts              # collection of recordings
    download.ts                      # Blob → download link helper
  synth/                              # per-SynthDef compile + cache
    clockSynthDef.ts                 # globalClock
    scopeSynthDef.ts                 # scopeTap
    recorderSynthDef.ts              # recorderTap
    testToneSynthDef.ts              # dev: sine on a bus
    testToneStereoSynthDef.ts        # dev: asymmetric stereo
    phaseProbeSynthDef.ts            # dev: reads clockBus via SendTrig
    noopSynthDef.ts                  # dev: /d_recv smoke-test stub
  ui/                                 # React components
    ConnectScreen/                   # initial scsynth-address form (Phase 1)
    OscConsole/                      # dev: OSC message console
    DebugLog/                        # dev: captured console output
    SynthDefPanel/                   # dev: load synthdefs button
    ClockPanel/                      # Start/Stop + tick + elapsed
    RecordingPanel/                  # recording controls + progress
  main.tsx                           # React root — boots AppShell
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

### `workerProtocol.ts` (as landed after the osc-js migration)

The main thread constructs `OSC.Message` / `OSC.Bundle` via
`@sc-app/server-commands` and encodes to bytes locally. The worker
only transports bytes and decodes inbound replies. `OSC.Message`'s
prototype doesn't survive `postMessage`'s structured clone, so
inbound replies are flattened to plain `{ address, args }` POJOs
(`OscReply`) before posting to main.

```ts
import type { OscArg } from '@sc-app/server-commands';

export interface OscReply {
  address: string;
  args: ReadonlyArray<OscArg>;
}

export interface ClockTick {
  tickIndex: number;
  receivedAt: number;
}

export type MainToWorker =
  | { type: 'connect'; url: string }
  | { type: 'disconnect' }
  | { type: 'send'; bytes: Uint8Array }
  | { type: 'registerClock'; trigId: number }
  | { type: 'unregisterClock' };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'reply'; reply: OscReply }
  | { type: 'clockTick'; tick: ClockTick }
  | { type: 'log'; level: 'log' | 'info' | 'warn' | 'error'; message: string };
```

### Worker changes

On `send`: `transport.send(msg.bytes)`. On incoming bytes:
`decode(bytes)` from `@sc-app/server-commands`, flatten bundles,
dispatch clock-tagged `/tr` to `clockTick` (gated by a registered
trigId), post everything else as `reply`. Decode failures surface
as `error` events; the stream keeps flowing.

**Race fix for async module worker init** — module workers resolve
their import graph asynchronously, so `self.addEventListener('message', …)`
in `scopeWorker.ts` only runs after all imports finish. If the main
thread posts `connect` immediately after `new Worker(...)`, that
message is delivered to an EventTarget with no listeners yet — and
silently dropped. A small `src/workers/workerBootstrap.ts` module
with zero imports registers a synchronous buffering listener during
its own evaluation phase (which runs first); the main worker module
calls `setWorkerMessageHandler(real)` after the rest of its imports
resolve, draining the buffer in order. The same bootstrap aliases
`globalThis.window = globalThis` so osc-js's `typeof global !==
'undefined' ? global : window` lookup resolves in the Worker scope.

A companion `src/workers/workerConsoleBridge.ts` forwards
`console.*` calls to the main thread via the `log` protocol
channel, so the on-screen debug log surfaces worker diagnostics
before the worker is fully wired up.

### `WorkerClient` changes

```ts
sendCommand(packet: OscPacket): void;
onReply(cb: (reply: OscReply) => void): () => void;

// Correlation-free probe: await the first reply matching a predicate.
// Used for one-shot queries like Status → StatusReply.
async sendAndAwaitReply(
  packet: OscPacket,
  match: (reply: OscReply) => boolean,
  timeoutMs?: number,
): Promise<OscReply>;

// Primary correlation helper: send the packet, post a separate /sync,
// resolve on the matching /synced.
async sendAndSync(packet: OscPacket, timeoutMs?: number): Promise<void>;

// Atomic variant — the command itself embeds the /sync (e.g. /d_recv's
// `completionMsg` field) so the server runs the sync *after* the async
// op completes, no race. Used by SynthDefRegistry (Phase 3) and the
// buffer-alloc flows (Phase 7+).
async sendCommandAndAwaitSync(
  buildPacket: (syncId: number) => OscPacket,
  timeoutMs?: number,
): Promise<void>;
```

The status probe in `AppShell.onConnect` uses
`sendAndAwaitReply(status(), r => r.address === '/status.reply', 1000)`.
SynthDef loading uses `sendCommandAndAwaitSync`.

### Thin command helpers

Per-address constructors live in `@sc-app/server-commands/commands/*.ts`;
callers import what they need:

```ts
import { sNew, nRun, nFree, gFreeAll, AddToHead, status } from '@sc-app/server-commands';

// sNew(defName, nodeId, addAction, targetId, controls?)
const m = sNew('sine', 1001, AddToHead, 100, { freq: 440, amp: 0.5 });
client.sendCommand(m);

// Variadic / positional for the simple cases.
client.sendCommand(nRun([1001, 1]));
client.sendCommand(nFree(1001));
client.sendCommand(gFreeAll(100));

// Scheduled via OSC bundle.
import OSC, { inFuture } from '@sc-app/server-commands';
client.sendCommand(new OSC.Bundle([sNew(…)], inFuture(200)));
```

Constructors live in `commands/{node,group,synthdef,buffer,control,misc}.ts`
and re-export through the package barrel. Each returns a configured
`OSC.Message`; bundles are regular `OSC.Bundle` instances.

### `OscConsole` upgraded

Kept the Phase 1 hex input as-is; added a **Quick Actions** row above
with buttons: **Status**, **DumpOSC on**, **DumpOSC off**, **QueryTree(0)**,
**sendAndAwaitReply(Status)**. Log entries render typed summaries per
`ServerReply` variant (`status-reply` shows ugens/synths/CPU; `b-setn`
shows bufnum/start/count; `synced` shows the sync id; etc.).

### Build pipeline (as landed)

- Both packages resolve to their TS sources via workspace aliases in
  `vite.config.ts` (`@sc-app/server-commands` →
  `packages/server-commands/src/index.ts`, same for
  `@sc-app/synthdef-compiler`). Tsconfig mirrors with `paths`. No
  pre-build step — Vite transpiles TS on the fly.
- `worker.format: "es"` + `build.target: "es2022"` — module workers
  need ES2022 for full syntax support; `es` format lets Vite
  code-split the worker bundle.

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

Later ports (superseded during the jco → TS migration):
- The SynthDef compiler was re-implemented in pure TypeScript as
  `@sc-app/synthdef-compiler` (workspace package). `noopSynthDef.ts`
  and `clockSynthDef.ts` now use the `synthdef(name, (g, …) => …)`
  sugar form; the wasm component, jco glue, and `@wasm/*` aliases
  are gone.

### Files

- `src/synth/noopSynthDef.ts`
- `src/scope/SynthDefRegistry.ts`
- `src/ui/SynthDefPanel/` — `SynthDefPanel.tsx` + `.scss` + `index.ts`
  matching the per-component directory convention used by
  `ConnectScreen` and `OscConsole`.

### `noopSynthDef.ts`

Trivial graph: `Out.ar(0, DC.ar(0))`. Compiled once via the
`synthdef(name, fn)` sugar form; result cached at module scope so
subsequent calls are free.

```ts
import { synthdef } from '@sc-app/synthdef-compiler';

let cached: Uint8Array | null = null;

export function compileNoopSynthDef(): Uint8Array {
  if (cached) return cached;
  const def = synthdef('noop', (g) => {
    g.Out.ar(0, g.DC.ar(0));
  });
  cached = def.toBytes();
  return cached;
}
```

Every subsequent `src/synth/*.ts` follows the same pattern —
module-scope cached, `synthdef` sugar body. The 365-UGen catalogue
covers everything the plan needs.

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

### Files (as landed)

- `src/config/clockConfig.ts` — `AudioEnvironment`, `ClockParams`,
  `ClockDerived`, `deriveClock`, `DEFAULT_ENV`, `DEFAULT_PARAMS`,
  plus `CLOCK_TRIG_ID = 1000` (the reserved SendTrig id).
- `src/synth/clockSynthDef.ts` — `compileClockSynthDef(params)`,
  result cached by `tickRate`. Exports `CLOCK_SYNTHDEF_NAME`.
- `src/scope/ClockController.ts` — composition-based; exposes
  `lastTick`, `effectiveState` (stale-tick watchdog folded in),
  plus `start` / `stop` / `resume` / `reset` / `dispose`.
- `src/scope/WorkerClient.ts` — added `registerClock(trigId)`,
  `unregisterClock()`, `onTick(cb)`.
- `src/scope/workerProtocol.ts` — added `ClockTick`,
  `MainToWorker.registerClock|unregisterClock`,
  `WorkerToMain.clockTick`.
- `src/workers/scopeWorker.ts` — suppresses the generic `reply`
  event for `/tr` whose `triggerId` matches the registered clock id
  and dispatches `clockTick` instead.
- `src/ui/ClockPanel/ClockPanel.{tsx,scss}` — rewritten as the v2
  one-row layout: state pill · elapsed · tick N · pulse dot ·
  Pause/Resume · Reset.
- `src/scope/AppShell.tsx` — `bringUpDashboard` now just constructs
  `{ GroupController, ClockController }` and calls `clock.start()`.
  Disconnect calls `clock.dispose()` then `group.free()`.
- *Removed:* `src/synth/silentTestSynthDef.ts` (superseded).

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

**Goal.** Give every future scope / recorder synth a shared audio-rate
time reference so they stay sample-aligned without each maintaining
its own phasor. The clock publishes an audio-rate sample counter on
a bus; consumers derive their own buffer index from it.

### Files (as landed)

- `src/synth/clockSynthDef.ts` — evolved to publish a shared
  sample phase; clock stays oblivious to scope / recorder params.
- `src/synth/phaseProbeSynthDef.ts` — dev diagnostic.
- `src/scope/ClockController.ts` — allocates `clockBus` in its
  constructor, passes it via `/s_new` controls, exposes
  `probePhase(durationMs)`.
- `src/ui/ClockPanel/ClockPanel.tsx` — adds a `Probe` button that
  calls `clock.probePhase()` and logs the aggregate to the debug log.
- `src/config/clockConfig.ts` — new constant `CLOCK_WRAP_TICKS = 2`
  and `PHASE_PROBE_TRIG_ID = 9001`.
- `src/scope/AppShell.tsx` — `bringUpDashboard` threads `ids.bus`
  into `ClockController`; `/status` probe now sanity-checks
  `args[8]` against `DEFAULT_ENV.sampleRate`.

### Decoupled clock SynthDef

The clock knows **only `tickRate` and the server's sample rate**
(via `SampleRate.ir` at synth-spawn time). It does not reference
`scopeChunkSize` or `decimation` — those are scope-level concerns,
owned entirely by Phase 7's scope SynthDef.

Equivalent sclang:

```
SynthDef("globalClock", { |clockBus = 0|
    var tick = Impulse.kr(tickRate);
    SendTrig.kr(tick, trigId, PulseCount.kr(tick));

    var wrap  = SampleRate.ir * (CLOCK_WRAP_TICKS / tickRate);
    var phase = Phasor.ar(0, 1, 0, wrap);
    Out.ar(clockBus, phase);
}).add;
```

The phase advances `+1` per audio sample and wraps at
`CLOCK_WRAP_TICKS × samplesPerTick`. With the default
`CLOCK_WRAP_TICKS = 2`, that's two tick periods (2000 samples at
the default config). Every downstream consumer whose ring size
divides `CLOCK_WRAP_TICKS × samplesPerTick` sees clean wraps — and
the plan's per-scope invariant (`scopeChunkSize × decimation =
samplesPerTick`) guarantees exactly that.

### How consumers derive their index (Phase 7+ preview)

Scope synth:

```
phase    = In.ar(clockBus, 1);
writeIdx = (phase / decimation) mod (scopeChunkSize * 2);
BufWr.ar(sig, bufnum, writeIdx);
```

Recorder synth (no decimation, ring = `samplesPerTick × 2` which
happens to equal the clock's wrap point):

```
phase = In.ar(clockBus, 1);
BufWr.ar(sig, bufnum, phase);     // no mod / div needed
```

### Parity math (feeds Phase 8)

At server audio frame `N × samplesPerTick` (= tick `N`, assuming tick 0
aligned to frame 0):

- clock phase = `(N mod 2) × samplesPerTick`
- scope writeIdx = `((N mod 2) × samplesPerTick / decimation) mod
  (scopeChunkSize × 2)` = `(N mod 2) × scopeChunkSize`

So at tick `N`:
- `N` even → `writeIdx = 0`; the second half (`[chunkSize,
  chunkSize × 2)`) was just completed.
- `N` odd → `writeIdx = chunkSize`; the first half (`[0, chunkSize)`)
  was just completed.

That matches the plan's `completedHalf = 1 - (tickIndex % 2)` formula.

### `ClockController.probePhase(durationMs)`

Replaces the dedicated `PhaseProbePanel.ts` from the original plan.
The controller temporarily adds a `phaseProbe` synth at the tail of
the parent group (so it reads `clockBus` *after* the clock writes
it on each control block), collects its `/tr` replies for
`durationMs`, frees it, and returns aggregate stats:

```ts
interface PhaseProbeResult {
  count: number;
  min: number;
  max: number;
  first: number[];   // first ~10 values in receive order
}
```

The probe uses `PHASE_PROBE_TRIG_ID = 9001`, distinct from the
clock's `CLOCK_TRIG_ID`, so its `/tr` replies flow through
`WorkerClient.onReply` (not the suppressed clock-tick channel).

### Group ordering invariant

The clock synth is added with `AddToHead`. Every synth that reads
`clockBus` (scopes, recorders, the probe) MUST be added with
`AddToTail` so scsynth processes them AFTER the clock on every
control block — otherwise they'd read the previous block's bus
value, introducing ~1 ms lag. Documented in `ClockController`'s
module header; to be enforced by Phase 7's `ScopeController` and
Phase 12's `RecordingController`.

### Sample-rate sanity check

`AppShell.handleConnect` now reads `args[8]` off `/status.reply`
(`actualSampleRate`) and rejects the connect if it diverges from
`DEFAULT_ENV.sampleRate` by more than 0.5 Hz. Phase 6 is the first
phase where a server/client SR mismatch silently miscomputes
`samplesPerTick`, so failing loudly on connect catches the
configuration error up front.

### Acceptance

1. Start dashboard → `[sc:app] starting global clock in group … clockBus=32`
   in the debug log.
2. Click **Probe** in ClockPanel → `[sc:clock] probe phase (~2000 ms)
   bus=32 count=~20 min=… max=… first=[…]` with values roughly
   spanning `[0, 2 × samplesPerTick)`. Count should be close to 20
   (2 s × replyRate 10), min close to 0, max close to `samplesPerTick × 2 - 1`.
3. Pause the clock → Probe shows `count` ≈ 0 (ticks are frozen, the
   probe synth stops firing).
4. Reconnect → probe still works; `clockBus` is freshly allocated.
5. Connect against an scsynth with wrong sample rate → connect
   fails with a clear error, dashboard doesn't mount.

---

## Phase 7 — Scope SynthDef, Manual Poke

**Goal.** Prove the scope SynthDef correctly taps an audio bus, writes
to a ring buffer indexed by the clock's shared phase, and the buffer
contents can be read back via `/b_getn`. First phase where the app
generates and captures real audio.

### Files (as landed)

- `src/synth/scopeSynthDef.ts` — `scopeTap1` (mono for now; channels
  as a compile-time parameter extended in Phase 10). Derives its
  own `writeIdx` from the shared clock phase.
- `src/synth/testToneSynthDef.ts` — `testTone`, a plain sine on a
  configurable bus.
- `src/scope/BufferPoker.ts` — one-shot `/b_getn` helper with
  per-bufnum in-flight deduplication.
- `src/ui/ScopeTestPanel/` — dev panel (Start tone, Start scope,
  Poke, Stop all) replacing the plan's `ScopePokerPanel.ts`.

### `scopeSynthDef.ts`

```ts
synthdef('scopeTap1', (g, { inBus = 0, bufnum = 0, clockBus = 0 }) => {
  const sig = g.In.ar(inBus, 1);
  const phase = g.In.ar(clockBus, 1);
  const writeIdx = g.mod(
    g.div(phase, DEFAULT_PARAMS.decimation),
    DEFAULT_PARAMS.scopeChunkSize * 2,
  );
  g.BufWr.ar([sig], bufnum, writeIdx);
});
```

No `SendReply`, no trigger output of its own — timing comes entirely
from the global clock's `SendTrig`. `decimation` and `scopeChunkSize`
are baked at compile time (per-session config); the clock remains
oblivious to them. `channels` is hardcoded to 1 for Phase 7; Phase 10
adds `compileScopeSynthDef(channels: number)` keyed on channel count.

**Decimation behavior.** `BufWr.ar` writes every audio sample using
`writeIdx` as the index. `writeIdx` advances once every `decimation`
audio samples, so each buffer slot is overwritten `decimation` times
per advance — last-write-wins zero-order-hold decimation. Fine for
a time-domain scope; revisit only if aliasing artifacts become
visible.

### `testToneSynthDef.ts`

```ts
synthdef('testTone', (g, { outBus = 0, freq = 440, amp = 0.2 }) => {
  g.Out.ar(outBus, g.mul(g.SinOsc.ar(freq, 0), amp));
});
```

Placed on a private bus allocated via `ids.bus.next()` so it never
reaches hardware outputs.

### `BufferPoker.ts`

```ts
export class BufferPoker {
  constructor(client: WorkerClient);
  poke(bufnum: number, start: number, count: number, timeoutMs?: number):
    Promise<Float32Array>;
}
```

Sends `bGetn(bufnum, start, count)`; awaits the first `/b_setn`
reply whose `args[0] === bufnum`. Extracts samples via the
`BSetnReply.samples` accessor from `@sc-app/server-commands`
(returns a `Float32Array`, no per-sample boxing). Per-bufnum
serialisation: a second `poke(bufnum, …)` while one is still in
flight shares the same promise — scsynth correlates `/b_setn` by
bufnum only, so we can't tell overlapping requests apart.

Main-thread use only. Phase 8's tick-driven chunk loop runs on
the worker and has its own reply path.

### `ScopeTestPanel.tsx`

Four buttons — **Start tone**, **Start scope**, **Poke**,
**Stop all** — plus a monospace readout. On **Poke**, logs
`length / min / max / rms / first8`. Panel-local state tracks
the allocated node IDs, bus, and bufnum; **Stop all** frees
them in dependency order (scope synth → tone synth → buffer).
No dedicated controller yet — that's Phase 8+.

Each synth is added to the parent group with `AddToTail`, so
scsynth's processing order is `clock → testTone → scopeTap`:
clock writes the phase bus, testTone writes the audio bus, and
scopeTap reads both on the same control block.

### Acceptance

1. Start dashboard, click **Start tone** → tone synth running on a
   fresh private bus (logged).
2. **Start scope** → buffer allocated (`scopeRingSize = 500`),
   scope synth running, bufnum logged.
3. **Poke** → `length=500, min ≈ -0.2, max ≈ 0.2, rms ≈ 0.14` for
   a 440 Hz sine at amp 0.2. `first8` shows a slice of a sinusoid.
4. Pause the clock (ClockPanel **Pause**) → **Poke** returns the
   same array repeatedly (buffer writes frozen).
5. Resume → poke returns updated values.
6. **Stop all** → scope + tone + buffer freed; a subsequent
   **Poke** would return `/fail` (guarded by the panel — Poke
   button is disabled once scope is gone).
7. Disconnect → all resources cleaned up as part of the dashboard
   teardown path.

---

## Phase 8 — Worker Tick-Driven Read Loop

**Goal.** Worker automatically reads completed chunks on every tick. Emits typed `scopeChunk` events. No rendering yet.

### Files (as landed)

- `src/scope/workerProtocol.ts` — adds `ScopeSubscription`,
  `ScopeChunk`, plus `subscribeScope` / `unsubscribeScope` (main →
  worker) and `scopeChunk` (worker → main).
- `src/workers/scopeWorker.ts` — adds the per-bufnum subscription
  table and the read loop. On every clock `/tr`, fires `/b_getn`
  for each subscribed bufnum at the just-completed half offset; on
  `/b_setn` matching a subscribed bufnum, copies samples into a
  `Float32Array` and posts `scopeChunk` with zero-copy buffer
  transfer.
- `src/scope/WorkerClient.ts` — adds
  `subscribeScope(sub, cb): () => void` (returns the unsubscribe
  function — combines registration and dispatch). Internal
  `Map<scopeId, Set<cb>>` routes incoming chunks to listeners.
- `src/ui/ScopeTestPanel/` — extended with **Subscribe** /
  **Unsubscribe** toggle, live chunks-per-second readout, and a
  once-per-second continuity log of last4(N-1) / first4(N) for
  catching parity flips.

(No standalone `subscriptionTable.ts` or `ScopeDebugPanel.ts` —
the table is a private `Map` inside `scopeWorker.ts`, the debug
view is folded into `ScopeTestPanel`. `ScopeController` is deferred
to Phase 11 where multi-scope demands the per-scope class; for
Phase 8 the panel calls `subscribeScope` directly.)

### Protocol additions

```ts
export interface ScopeSubscription {
  scopeId: string;
  bufnum: number;
  chunkSize: number;     // per-subscription, not derived from clock
  channels: number;
}

export interface ScopeChunk {
  scopeId: string;
  data: Float32Array;    // length = chunkSize * channels, interleaved
  channels: number;
  tickIndex: number;
}

// MainToWorker:
| { type: 'subscribeScope'; subscription: ScopeSubscription }
| { type: 'unsubscribeScope'; scopeId: string }

// WorkerToMain:
| { type: 'scopeChunk'; chunk: ScopeChunk }
```

**`chunkSize` per subscription, not on `registerClock`.** Phase 12's
recordings will reuse the exact same machinery with `chunkSize =
samplesPerTick`. Putting `chunkSize` on the subscription rather than
deriving it from a global "clock config" lets the worker stay
oblivious to subscription kind — it just reads
`chunkSize × channels` samples per tick at the parity-determined
offset.

`registerClock` keeps its narrow signature (just `trigId`).

### Worker subscription table

A private `Map<bufnum, SubscriptionEntry>` plus a parallel
`Map<scopeId, bufnum>` for unsubscribe-by-id. Each entry carries
its `ScopeSubscription` and a transient `pendingTickIndex` used
solely as a tag so the dispatched `scopeChunk` can carry the
right `tickIndex`.

### Tick handler

On `/tr` matching the registered clock trigId:

```
tickIndex = packet.args[2] | 0
post clockTick
completedHalf = 1 - (tickIndex % 2)        // see parity derivation
for each subscription:
    offset = completedHalf * chunkSize * channels
    count  = chunkSize * channels
    transport.send(encode(bGetn(bufnum, offset, count)))
    entry.pendingTickIndex = tickIndex
```

**Parity derivation (from Phase 6 design).** The clock publishes
`Phasor.ar(0, 1, 0, 2 × samplesPerTick)`. At tick `N`, the server's
audio frame is `N × samplesPerTick`, so the bus phase is
`(N mod 2) × samplesPerTick`. The scope's
`writeIdx = (phase / decimation) mod (chunkSize × 2)` evaluates to
`(N mod 2) × chunkSize`. Therefore at tick `N` the *just-completed*
half starts at `(1 - N mod 2) × chunkSize`. The acceptance test's
continuity check verifies this empirically — if every other
boundary is glitched, flip the formula.

**No `pendingRead` state machine.** scsynth replies on localhost
within sub-ms; ticks are 21 ms apart. We don't track in-flight
reads or drop overlapping requests. If overlap ever happens, the
later reply just wins and we attribute it to the latest tick.
Acceptable for the scope use case; revisit if real overlap is
observed.

**kr-vs-ar drift between `/tr` and the scope `writeIdx`.** The
clock's `Impulse.kr` is kr-quantised (control-block-aligned, ≤ 64
ar samples = ~1.3 ms of jitter at sr 48 k), but the scope's
`writeIdx` advances against `Phasor.ar` which wraps at exactly
`2 × samplesPerTick` ar frames. Some ticks fire 1–32 ar samples
*short* of the half-boundary, so a same-instant `/b_getn` arriving
at scsynth includes a few "stale" samples from the previous cycle
at the tail of the read. Visible as a vertical step inside an
otherwise-smooth chunk, at a position that varies frame-to-frame
in a periodic pattern (period 8 ticks at the default config).

**Fix: `/b_getn` is sent as an `OSC.Bundle` with timetag
`Date.now() + READ_DELAY_MS` (5 ms).** scsynth's scheduler holds
the bundle until the timetag, by which time the targeted half is
fully written; the read is clean. Adds ~5 ms of display latency,
invisible to the eye. `READ_DELAY_MS` lives in `clockConfig.ts`
so it's tunable in one spot.

### `/b_setn` dispatch

```
if address === '/b_setn':
    bufnum = args[0]
    entry  = subscriptions.get(bufnum)
    if entry:
        count  = args[2]
        data   = new Float32Array(count)
        for i in 0..count: data[i] = args[3 + i]
        post({ type: 'scopeChunk',
               chunk: { scopeId, data, channels, tickIndex: entry.pendingTickIndex } },
             [data.buffer])    // zero-copy transfer
        entry.pendingTickIndex = null
        return
    // Otherwise falls through to the generic reply path so
    // main-thread BufferPokers (Phase 7) still work for
    // non-subscribed bufnums.
```

**Caveat: subscribed bufnum vs. BufferPoker.** A `BufferPoker.poke()`
against a *subscribed* bufnum is intercepted by the worker and never
reaches `onReply`, so the poker hangs. The Phase 7 panel disables
its **Poke** button while subscribed for this reason.

### Mid-run subscribe

The completed-half formula is purely a function of `tickIndex`, so
no per-subscription parity state is needed. On the next tick after
subscribe, the worker fires `/b_getn` for whichever half just
completed.

### `WorkerClient` additions

```ts
subscribeScope(
  sub: ScopeSubscription,
  cb: (chunk: ScopeChunk) => void,
): () => void;
```

Returns the unsubscribe function — combines registration + dispatch
in one call. The unsubscribe is paired with the subscription that
owns it; multiple `cb`s for the same `scopeId` are deduplicated by
identity. The worker is told to remove the subscription only when
the last callback unsubscribes.

### `ScopeTestPanel` extension

The Phase 7 panel grows two artefacts:
- **Subscribe / Unsubscribe** button — toggles a `client.subscribeScope`
  against the panel's existing `bufnum`. While subscribed, **Poke**
  is disabled.
- **Live readout** under the Poke output: `tick=… count=… N/s` plus
  the latest chunk's min/max/rms/first8.
- **Continuity log** — once per second, prints `last4(N-1)` and
  `first4(N)` so a misplaced parity bit jumps out as a step at every
  other boundary.

`ScopeController` is deferred to Phase 11 where multi-scope demands
the per-scope class. For Phase 8 the panel just calls `subscribeScope`
directly.

### Acceptance

1. Tone on bus 16, scope running → chunks arrive at ~48 Hz; `tickIndex` monotonic, contiguous.
2. **Waveform continuity.** Log last 4 samples of chunk N and first 4 of chunk N+1 → visually/numerically continuous. If discontinuous at every other boundary, parity is flipped; fix and retest.
3. Stop → chunks stop. Start → resume, `tickIndex` continues.
4. Fault injection (drop 1-in-20 `/tr` in the worker) → missing ticks logged; next chunk correct. No cascading failure.
5. Stop scope → QueryTree clean.
6. Subscribe mid-run after 10 s → first chunk's waveform is coherent, no glitch visible.

---

## Phase 9 — Single-Channel Renderer

**Goal.** Draw live waveform. Decouple data rate (48 Hz) from render
rate (60 Hz / display refresh).

### Files (as landed)

- `src/ui/ScopeView/ScopeView.tsx` + `.scss` + `index.ts` — pure
  rendering React component.
- `src/ui/ScopeTestPanel/ScopeTestPanel.tsx` — extended to mount
  `<ScopeView>` while subscribed and to update a `chunkRef` on every
  chunk arrival.

(No standalone `ScopeRenderer.ts` class — the RAF loop is owned by
the `ScopeView` component's `useEffect`. No `ScopeController` —
deferred to Phase 11 along with the multi-scope hoist.)

### `ScopeView` props

```ts
export interface ScopeViewProps {
  chunkRef: RefObject<ScopeChunk | null>;
  gain?: number;            // default 1
  strokeStyle?: string;     // default '#6ac46f'
  background?: string;      // default '#15171b'
  height?: number;          // CSS px, default 200
  zeroLineStyle?: string | null; // null disables; default thin grey
}
```

### Rendering pipeline

The component's `useEffect`:
1. Resolves CSS size (`getBoundingClientRect()`) and `devicePixelRatio`.
2. Sizes the canvas backing store to `cssSize × dpr` and applies
   `ctx.setTransform(dpr, 0, 0, dpr, 0, 0)` — only on actual size /
   DPR changes (tracked via a `ResizeObserver` on the container).
   Doing this every frame would clear the canvas and flicker.
3. Drives a `requestAnimationFrame` loop that:
   - Reads `chunkRef.current` — typically the most recent
     `scopeChunk` posted from the worker, or `null` before any
     subscription delivers.
   - Fills the background.
   - Optionally strokes a zero line.
   - For chunks of length ≥ 2, traces a polyline mapping
     `[0, chunkSize-1] → [0, cssWidth]` and `[-1, 1] → [bottom, top]`
     scaled by `gain`. For multi-channel chunks (Phase 10), only
     the first channel is drawn — Phase 10 will replace this with
     stacked-lane rendering.

### Why a ref, not a store / prop

The data rate (48 Hz) is independent of the render rate (60 Hz on
most displays, 120 / 240 on others). A React state/store update
per chunk would force the panel to re-render 48 times/second; we
side-step that by writing to a mutable ref in the subscription
callback and reading it inside the canvas's RAF loop. The panel
only re-renders for *control* state changes (Subscribe/Unsubscribe,
gain input).

### `ScopeTestPanel` integration

While `hasSubscription === true`, the panel mounts `<ScopeView
chunkRef={renderChunkRef} gain={gain} />` plus a small `gain`
number input. The subscription callback writes
`renderChunkRef.current = chunk` first thing — before any state
updates — so the renderer reads the freshest data on every frame.
Unsubscribe / Stop all clears the ref.

### Free behaviour

- **Freeze on pause.** Pausing the clock stops chunks; `chunkRef.current`
  keeps pointing at the last one; RAF redraws the same data.
- **Memory.** Each chunk's `Float32Array` was zero-copy-transferred
  from the worker. Replacing the ref drops the previous reference;
  GC reclaims it. No long-lived retention.
- **DPR / resize.** ResizeObserver triggers a one-shot canvas resize
  + `setTransform`, no per-frame cost.

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

**Sample-accurate start via scheduled bundle.** For a deterministic
onset, the recorder's `/s_new` is wrapped in an `OSC.Bundle` whose
timetag is `tickToTimetag(ctrl.tick0Ms, startTick, ctrl.params.tickRate)`,
where `startTick` is the next upcoming tick boundary chosen by the
controller. scsynth queues the bundle and fires the synth at the
exact audio frame of `startTick`, so the phasor starts at 0 aligned
to that tick's sample. The "skip first tick" heuristic above still
applies as a belt-and-braces measure, but with scheduling the first
half is already a clean chunk — callers that want zero startup delay
can drop the skip. Symmetrically, `stopRecording` schedules
`/n_free` at a future tick so the WAV length is exact.

```ts
// Sketch — inside RecordingController.start(startTick)
const whenMs = tickToTimetag(clock.tick0Ms, startTick, clock.params.tickRate);
await client.sendCommand(
  new OSC.Bundle([
    sNew('recorderTap', nodeId, AddToTail, parentGroupId, {
      in: busIndex, bufnum, channels, recChunkSize: samplesPerTick,
    }),
  ], whenMs),
);
```

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
   The command side is the osc-js-based `@sc-app/server-commands`;
   UGens in the plan (`Impulse`, `PulseCount`, `SendTrig`, `Phasor`,
   `BufWr`, `In`, `Out`, `SinOsc`, `SampleRate`, `A2K`, `DC`) all
   exist in the 365-UGen catalogue baked into
   `@sc-app/synthdef-compiler`.
2. **`/b_setn` payload — resolved by `BSetnReply.samples` helper.**
   osc-js lifts the message as `{ address, args }` with args
   numbers; the reply accessor `BSetnReply.samples(msg)` copies
   into a `Float32Array` once at decode time, avoiding per-sample
   boxing in hot paths downstream.
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

Both `@sc-app/server-commands` and `@sc-app/synthdef-compiler` are
already implemented and tested (OSC encode/decode + bundle/timetag
support, SynthDef builder + sugar API, parity harness against
sclang). This eliminates the largest sources of risk the original
plan was sized for — no encoder/decoder bring-up, no SynthDef
wire-format debugging. Estimates below reflect that.

| Phase | What ships | Duration |
|---|---|---|
| 0 | Tauri skeleton + WS↔UDP bridge (per-session scsynth) + `serve` CLI | 1 day |
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
