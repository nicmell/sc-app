# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`history.md`](./history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 26 in flight.** Phases 0–25 shipped (see `history.md`).
Phase 26 below brings forward the SuperDirt work prototyped on the
`superdirt` branch with a single OSC connection from the frontend,
demuxed inside the bridge by a config-driven prefix route table.
Architecture **D-generic** chosen; A and C summarised as
alternatives considered. Earlier longer-term candidates remain in
*Future Improvements*.

---

## Phase 26 — SuperDirt via bridge-internal OSC router (D-generic)

**Goal.** Bring SuperDirt back online without the second WebSocket
that the `superdirt` branch shipped. The frontend keeps exactly
one `WorkerClient` / one `/ws`; everything OSC — scsynth control,
buffer reads, `/dirt/play`, `/dirt/hello` — flows through it.
Inside the bridge, a config-driven prefix-match table demuxes
each outbound packet to the appropriate UDP target. Each per-WS
session opens N+1 sockets (one per unique target) and fans
replies back into the same WS.

The frontend's `DirtPanel` REPL + event log + `/dirt/play`
builder all come forward unchanged in shape. What goes away is
connection management — there's no host/port input, no second-WS
lifecycle, no second status badge. Aliveness becomes a
`/dirt/hello` round-trip on dashboard mount; failure surfaces
inline in the panel.

**Architectural call: D-generic.** Three options were weighed (A:
separate `sc-app proxy` subcommand; C: sclang as OSC front;
D: bridge does the demux). The chosen path generalises D to a
config-driven route table — same per-process footprint as today,
~115 LoC of new bridge code, future targets add as config entries
with no code edits. The full comparison + rejection rationale is
in *Alternatives considered* below.

### Architecture: bridge as OSC router

```
Frontend (one WorkerClient, one /ws)
  ↓ WS bytes
Bridge (Rust): per-session opens N+1 UDP sockets
  ├── outbound: peek OSC address, prefix-match against route
  │             table, send via the matching socket
  └── inbound: N+1 recv tasks, each fans replies back to the WS
  ↓ UDP
scsynth (default route)        sclang+SuperDirt (/dirt/*)
:57110                         :57120
```

Where N is the number of configured `routes` entries plus the
default. Adding a third target (metronome, MIDI bridge,
analyzer, …) is one entry in `config.json`, no code edits.

#### Config schema

`config.json` gains a `routes: [{ prefix, target }]` field. The
existing `scsynth` field stays as the implicit *default* route
target — packets not matching any prefix go there. So a config
without `routes` behaves identically to today.

```json
{
  "port": 3000,
  "scsynth": "127.0.0.1:57110",
  "log_dir": "/var/log/sc-app",
  "routes": [
    { "prefix": "/dirt", "target": "127.0.0.1:57120" }
  ]
}
```

`prefix` matches the OSC address with `starts_with`. The bridge
walks the array top-to-bottom, first match wins; user is
responsible for ordering most-specific prefixes first (Q5
revisits this).

`target` is `host:port`, parsed at boot via `lookup_host`.
Resolution failure at boot is a config error.

#### Implementation outline

New module `src-tauri/src/server/routing.rs`:
```rust
pub struct RoutingTable {
    routes: Vec<(String, SocketAddr)>,   // user order preserved
    default: SocketAddr,
}

impl RoutingTable {
    pub fn from_config(default: SocketAddr, routes: &[Route]) -> Result<Self> { … }
    pub fn route_for(&self, address: &str) -> SocketAddr { … }
    pub fn unique_targets(&self) -> Vec<SocketAddr> { … }  // for socket binding
}

/// Peek the OSC address from a UDP payload without full decode.
/// For a `#bundle`, return the address of the first inner message.
/// For a bare message, return its address. None on parse failure
/// (caller falls back to the default route).
pub fn peek_osc_address(bytes: &[u8]) -> Option<&str> { … }
```

Per-WS state in `ws_bridge.rs::handle_ws`:
```rust
// Boot the session:
//   For each unique target in routes.unique_targets():
//     bind ephemeral UDP, connect(target), insert into a map.
//     Spawn a recv task that loops sock.recv() and forwards to WS.
//     Only the default target's recv task runs `Session::snoop`
//     (Phase 22 /done /notify capture is scsynth-specific).
//
// WS→UDP loop:
//   addr = peek_osc_address(bytes)?  // None → default route
//   target = routes.route_for(addr)
//   if target == default: session.snoop_outbound(bytes)
//   sockets[target].send(bytes)
//
// Cleanup tail (on WS close):
//   recv_tasks.iter().for_each(|t| t.abort())
//   session.cleanup(sockets[default])
//   // /g_freeAll, /n_free, /notify 0 — scsynth-specific,
//   // not relevant to other targets.
```

#### Edge cases

- **Route target unreachable at boot.** UDP `connect()` doesn't
  validate the peer; sends to a non-listening peer silently
  drop. So bridge boots fine even if SuperDirt isn't running.
  Hello probe times out → frontend panel shows `unreachable`.
  Same flexibility as today.
- **Same target under multiple prefixes.** Allowed.
  `unique_targets()` deduplicates so one socket serves all
  prefixes pointing at that target — saves resources, simpler
  reply pump.
- **Empty prefix `""`.** Would shadow the default route. Almost
  certainly a config typo. Reject at config-load with a helpful
  message rather than allow it.
- **Trailing-slash precision.** `prefix: "/dirt"` matches both
  `/dirt` and `/dirt/play`. `prefix: "/dirt/"` matches only the
  latter. Up to the user; document literally.
- **No-match on a packet.** Always falls back to the default
  route (scsynth). No "reject unknown" alternative; safer to
  forward to scsynth than to drop, and scsynth itself surfaces
  bad addresses via `/fail`.
- **Bundle handling.** Peek the address of the first inner
  message; route the whole bundle by that. Mixed-target bundles
  are unsupported — document as a known limitation. No real
  use case driver.
- **Phase 22 snoop scope.** `/done /notify` snoop runs only on
  the *default route's* inbound stream (scsynth-specific reply).
  `/notify 0` snoop runs only when the outbound target *is* the
  default. Non-default targets have no scsynth-style state to
  reset.

### Alternatives considered

- **A — Separate `sc-app proxy` subcommand.** Same routing
  semantics as D-generic, but as a third subcommand of the
  existing binary, external to the bridge. ~150 LoC + an extra
  process per deployment. Rejected because D-generic gets the
  same extensibility (config-driven routes) without the extra
  process, the systemd unit, or the supervisor-script
  bookkeeping. A remains the right shape if external
  observability of the routing layer (independent restart,
  traffic-capture as a separate concern, mock targets in test)
  becomes load-bearing — the routing module from D lifts cleanly
  into a `proxy` subcommand at that point, identical logic just
  hosted differently.
- **C — sclang as the OSC front.** Frontend-side single WS
  preserved, but sclang owns the routing decision and
  raw-forwards non-`/dirt/*` to scsynth. Rejected on hot-path
  latency: sclang's single-threaded interpreter contends with
  SuperDirt pattern parsing for the same loop, producing bursty
  jitter on the `/b_setn` reply path under load. Phase 17's
  reorder buffer absorbs *some* jitter but not unbounded
  amounts. C remains viable for fundamentally-Tidal-driven
  workflows where scope/recording is incidental, not always-on.

### Comparison (decision audit)

| Dimension | A | C | D-generic (chosen) |
|---|---|---|---|
| **Single WS** | yes | yes | yes |
| **New Rust LoC** | ~150 | 0 | ~115 |
| **New sclang LoC** | 0 | ~50 | 0 |
| **New runtime processes** | +1 | 0 | 0 |
| **Hot-path latency** | ~100 µs deterministic | ~100 µs–few ms (interpreter) | direct UDP, no extra hop |
| **Adding a 3rd target** | CLI flag, no code | sclang code edit | config entry, no code |
| **Bridge purity** | preserved | preserved | router (small step from Phase 22) |
| **Crash isolation** | proxy independent | sclang crash kills all routing | scsynth/dirt independent |
| **Pi systemd footprint** | 3 units | 2 units | 2 units |
| **Cleanly fits N targets** | unbounded | unbounded | unbounded |
| **Mock target / traffic capture** | trivial (proxy is the right place) | hard | future bridge module |

D-generic and A are functionally identical on extensibility; the
trade is "extra process" vs "router lives inside bridge." Without
operational pressure to keep the routing layer external, the
in-bridge form wins on simplicity.

### What the route table enables (future)

The point of the generic shape is that future targets are config
additions. Concrete candidates, none committed:

- **Metronome service** — sclang or Rust process listening on
  `/metronome/*`. Click track on a dedicated bus. Useful for
  live coding.
- **MIDI bridge** — sclang or any MIDI-capable process listening
  on `/midi/*` to send to MIDI out. Hardware sync, hardware
  synth control.
- **Spectral analyzer** — Python or Rust process consuming an
  audio bus (via OSC tap or direct JACK) and exposing
  `/analyze/*` for FFT data, peak detection.
- **Pattern player (non-Dirt)** — custom rhythm sequencer,
  separate from SuperDirt, listening on `/seq/*`.
- **Hardware controller bridge** — `/ctrl/*` from a knob
  surface, unifying physical controls into the OSC bus.

Each is "spawn a process, add a route." No bridge code.

### What comes from the `superdirt` branch

**Brought forward unchanged:**
- `superdirt/` git submodule (vendored SuperDirt source).
- `superdirt-deps/` tree + `scripts/setup-superdirt-deps.sh`.
- `scripts/sc-app-superdirt-startup.scd` (sclang init script).
- `scripts/sc-app-scsynth.service` (Pi systemd template).
- `scripts/cleanup.sh`.
- `src/dirt/dirtCommands.ts` (typed builders for `/dirt/play`,
  `/dirt/hello`, `/dirt/handshake`, `/dirt/setControlBus` +
  reply addresses).
- `src/dirt/types.ts` (minus `parseHostPort`; `DirtStatus`
  shrinks per Q1).
- `src/dirt/replParser.ts` (REPL command parser, no networking).
- `src/ui/DirtPanel/*` (REPL UI + bounded event-log ring).

**Rewritten:**
- `src/dirt/DirtClient.ts` — drops the `/ws/dirt` lifecycle.
  Constructor takes a `WorkerClient`; encodes `OSC.Message` /
  `OSC.Bundle` and calls `client.sendCommand`. Replies arrive
  via `client.onReply` filtered for `/dirt/*`. `connect()`
  collapses to "send `/dirt/hello`, await
  `/dirt/hello/reply`" — health probe only, no socket
  lifecycle. `host`/`port` constructor args go away.
- `DirtPanel` — drop the connection-string input + Connect /
  Disconnect buttons. Three states from the hello probe:
  `probing` (initial), `alive` (reply received within timeout),
  `unreachable` (timeout — REPL still usable, sends are no-ops
  if the route isn't configured).

**Dropped entirely:**
- `src-tauri/src/server/ws_dirt.rs` and the `/ws/dirt` route in
  `server/mod.rs`.
- `src/dirt/parseHostPort.ts` — connection routing is now in
  the bridge config.
- `scripts/start-scsynth.sh` and `scripts/start-superdirt.sh` —
  replaced by `scripts/start-osc.sh` (unified supervisor) plus
  optional `*-only.sh` variants (Q3).

### Frontend wiring

- `WorkerClient` — already a generic `onReply` pump. Verify
  `oscWorker.ts` doesn't filter `/dirt/*` addresses; if it does,
  remove the filter.
- `AppShell.DashboardResources` — `dirtClient: DirtClient`
  constructed with `new DirtClient(client)`. Lifecycle
  simplifies: no `disconnect()` (no socket to close); chunkSize
  re-init flow drops the "dirt survives re-init" special case.

### Launch story

`scripts/start-osc.sh` (replaces start-scsynth.sh +
start-superdirt.sh):

```bash
#!/usr/bin/env bash
set -euo pipefail

# scsynth (background)
scsynth -u 57110 -b 262144 -m 262144 -w 2048 -n 32768 -l 8 -i 2 -o 2 &
scsynth_pid=$!

# sclang + SuperDirt (background)
sclang -l <generated-conf> "$STARTUP_SCD" &
sclang_pid=$!

trap "kill $scsynth_pid $sclang_pid 2>/dev/null" EXIT
wait
```

Two supervised processes. Routing happens inside the bridge once
the user runs `yarn bridge` (or `tauri dev`).

Yarn scripts:
- `yarn osc` — runs `start-osc.sh` (scsynth + sclang+SuperDirt).
- `yarn scsynth-only`, `yarn superdirt-only` — debug variants
  that boot one component (Q3).
- `yarn superdirt-setup`, `yarn cleanup` — unchanged.

### Bridge config

`config.json` keeps `scsynth` as the default route target and
adds optional `routes`:

```json
{
  "port": 3000,
  "scsynth": "127.0.0.1:57110",
  "routes": [
    { "prefix": "/dirt", "target": "127.0.0.1:57120" }
  ]
}
```

Empty/absent `routes` ⇒ identical to today's single-target
behaviour. SuperDirt unconfigured ⇒ `/dirt/*` sends silently
drop, hello probe times out, panel shows `unreachable`.

### Files (planned)

```
src-tauri/src/config.rs          EDIT — add `routes: Vec<Route>` field;
                                        `Route { prefix, target }`.

src-tauri/src/server/routing.rs  NEW  — RoutingTable + peek_osc_address.

src-tauri/src/server/mod.rs      EDIT — pass RoutingTable into AppState;
                                        ws_handler builds per-session
                                        sockets from it.

src-tauri/src/server/ws_bridge.rs
                                 EDIT — multi-socket setup, outbound
                                        prefix routing, per-target
                                        recv tasks, cleanup limited to
                                        default route.

src-tauri/src/server/session.rs  EDIT — minor: snoop_outbound called
                                        only when target == default.

src/dirt/DirtClient.ts           REWRITE — WorkerClient-based, no WS.
src/dirt/dirtCommands.ts         KEEP
src/dirt/types.ts                SHRINK (DirtStatus per Q1)
src/dirt/replParser.ts           KEEP
src/dirt/parseHostPort.ts        DELETE
src/ui/DirtPanel/*               REWRITE (drop connection UI)

src-tauri/src/server/ws_dirt.rs  DELETE
                                 (and drop /ws/dirt route)

scripts/start-osc.sh             NEW  — unified supervisor
scripts/start-scsynth.sh         DELETE or RENAME (Q3)
scripts/start-superdirt.sh       DELETE or RENAME (Q3)
scripts/setup-superdirt-deps.sh  KEEP
scripts/sc-app-superdirt-startup.scd
                                 KEEP
scripts/sc-app-scsynth.service   KEEP
scripts/cleanup.sh               KEEP

superdirt/                       NEW (git submodule)
superdirt-deps/                  NEW (gitignored)

CLAUDE.md                        EDIT — architecture diagram, routes
                                        config, dev commands.
docs/raspberry-pi.md             EDIT — config.json with routes; systemd
                                        units (Q4).
plan.md                          MOVE entry → history.md on completion.
```

### Sub-phases

Each step is an independently-verifiable commit.

**26a — Bridge router.** Add `routes` to config + `RoutingTable`
+ `peek_osc_address` + multi-socket per-WS setup + per-target
recv tasks + cleanup-on-default-only. Verify pass-through:
`routes: []` (or absent) makes the bridge behave identically to
today. Then with one route entry pointing at a synthetic
`nc -lu 57199` listener, verify packets to addresses matching
that prefix arrive there and replies fan back to the WS. No
frontend changes yet.

**26b — SuperDirt foundations.** Bring forward `superdirt/`
submodule + `superdirt-deps/` + setup-superdirt-deps + sclang
startup script + scsynth flag values. Add `start-osc.sh`. Add
`{ prefix: "/dirt", target: "127.0.0.1:57120" }` to local
config. Verify `/dirt/play` reaches sclang and the reply lands
back at the bridge.

**26c — Frontend rewire.** Bring `dirtCommands` / `types` /
`replParser` / `DirtPanel`; rewrite `DirtClient` against
`WorkerClient`. Hello probe in `setupDashboard` per Q1/Q2.
Wire `DirtPanel` into the dashboard. End-to-end: REPL `bd`
plays a kick. Verify exactly one WS in DevTools.

**26d — Documentation.** `CLAUDE.md` architecture diagram +
routes section. `docs/raspberry-pi.md` install + systemd units
(Q4). `history.md` Phase 26 entry. README run-modes section.

### Acceptance criteria

- Frontend opens exactly one WS. DevTools Network panel shows
  one upgraded `/ws` connection, no `/ws/dirt`.
- `yarn osc` brings up scsynth + sclang+SuperDirt with one
  command.
- Existing oscilloscope / recording flows behave identically to
  pre-Phase-26 master (the demux is transparent for `/s_new`,
  `/b_getn`, etc.).
- `DirtPanel` shows `alive` after dashboard mount when SuperDirt
  is up; REPL `bd` plays a kick within ≤ 200 ms.
- Disconnect → reconnect cycle leaves no leaked sockets:
  `netstat` count stable across N cycles.
- Bridge config with `routes: []` (or absent) operates
  identically to today (single-target backward-compat).
- A synthetic third route entry pointing at a `nc -lu` listener
  works without recompilation.

### Decisions (locked)

- **Q1. `DirtStatus`:** three-state enum
  `'probing' | 'alive' | 'unreachable'`.
- **Q2. Hello probe cadence:** once at dashboard mount. Future
  enhancement: on-demand "ping" button if needed.
- **Q3. Individual debug scripts:** rename + keep
  (`start-scsynth-only.sh`, `start-superdirt-only.sh`) alongside
  unified `start-osc.sh`.
- **Q4. Pi systemd shape:** three units —
  `scsynth.service`, `sc-app-superdirt.service`,
  `sc-app-bridge.service` — with `After=` / `Wants=` chains.
- **Q5. Route order in config:** user's explicit order;
  top-to-bottom first-match-wins. Document the most-specific-
  first convention; no auto-sort, no startup warning (yet).
- **Q6. `/healthz` endpoint:** deferred. Add when a real
  operator need surfaces.

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
   config if a deployment uses a non-default
   `numAudioBusChannels`.
4. **Phase boundary parity.** `completedHalf = tickIndex % 2` (see
   Phase 5 / 8 gotchas in `history.md`). The original plan had it
   inverted; verified empirically.
5. **`BufWr` is zero-order-hold.** Does not anti-alias on
   decimation. After Phase 13's revert to `decimation = 1` this
   is no longer an issue — every audio frame is written. If a
   future feature reintroduces decimation, plan for a proper
   anti-aliased path.
6. **Recording memory ceiling.** Float32 stereo at 48 kHz =
   ~23 MB/min. Practical comfortable ceiling ~10–15 min before
   RAM pressure. Streaming-to-disk (Future Improvement #2)
   addresses this.
7. **WAV 4 GB header limit.** Float32 stereo at 48 kHz → ~3h45m
   max file size in the WAV header. Above the RAM ceiling, so not
   binding in practice. RF64 deferred.
8. **Reconnection.** Out of scope. App expects manual reload on
   WS loss (the runtime error modal facilitates that). Future
   Improvement #3.
9. **Ordering constraints within parent group.** Clock at head;
   everything else `AddToTail`; producers must be created before
   consumers that read their buses. Documented in `CLAUDE.md`.

---

## Future Improvements

Follow-on phases, in rough order of value / effort ratio. None are
blocked by anything currently shipped.

### 1. Spectral scope (FFT view)

Add a `compileFFTScopeSynthDef` that runs `FFT.kr` on the input
bus into a 1024-bin buffer (one FFT every tick — natural cadence
given `samplesPerTick = 1024`). Worker reads the buffer the same
way as a time-domain scope; main thread renders log-magnitude
bars or a filled spectrogram. Post-Phase-16, this is "add a
consumer that subscribes to a `BufferController`" — no new synth
or buffer.

**Cost:** ~1 day. Most of the work is the renderer.

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

A small label registry — "synth out", "FX return", "monitor mix"
— would let recordings + scopes show meaningful names instead of
ad-hoc memorisation. The bus number stays the source of truth;
the label is purely UI.

**Cost:** ~½ day.

### 8. Per-scope/recording independent pause

Today `/n_run 0` on the parent group freezes everything.
Sometimes you want to pause one scope while keeping the rest
running. Implementable as `/n_run 0 nodeId` on the specific
synth, with state tracked per-controller.

**Cost:** ~½ day.

### 9. Hardware-output-bus tapping (record bus 0/1 directly)

Phase 26 works around scsynth's hardware-output read semantics
by routing SuperDirt to a private bus (16) with a monitor synth
mirroring to bus 0/1. sc-app records the private bus + speakers
play via the monitor. Works, but means: any non-sc-app source
that writes directly to bus 0/1 (a third-party synth, an MIDI-
driven pattern, etc.) can't be tapped — sc-app's `bufferTap`
uses `In.ar(0)`, which returns silence for `< numOutputBusChannels`
buses regardless of node tree position.

The cleaner fix: compile a second variant of `bufferTapSynthDef`
that uses `InFeedback.ar` instead of `In.ar`. `InFeedback` reads
the bus without the auto-zero treatment at the cost of a one-
block delay (~21 ms at chunkSize 1024 / 48 kHz — within the
recording's tick window, no impact on offsets). The controller
picks the variant based on `bus < numOutputBusChannels`.

Or expose a "source is hardware out" flag on the
RecordingController / ScopeController so the user can override
when the auto-detect heuristic isn't right (e.g. a hardware bus
that's been re-routed by an external sclang script).

**Cost:** ~½ day. New synthdef variant + a `bus <
numOutputBusChannels` check in `BufferManager.acquire`. After
this lands, `~dirtBus = 16` workaround in
`scripts/sc-app-superdirt-startup.scd` can be reverted to
`~dirtBus = 0` (no monitor synth, just direct hardware out) and
sc-app records bus 0 transparently.
