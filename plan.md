# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`docs/history.md`](./docs/history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 39 — Server abstraction + bridge-owned boot sequence**
is queued; spec below. Phases 0–38 are in
[`docs/history.md`](./docs/history.md).

---

## Phase 39 — Server Abstraction + Bridge-Owned Boot Sequence

**Goal.** Hoist UDP sockets, broadcast channels, the scsynth
`/notify` registration, runtime metadata, and shared-instance
creation up from per-Session into bridge-level **Server**
objects (one per route target). Strip sclang's lib files down
to declarations: SynthDef registration + OSCdef installation +
a single bootstrap reply. The bridge takes over `/notify`,
`/s_new`-of-shared-synths, scope-buffer allocation, and
metadata caching. Sessions become lightweight per-tab WS-state
holders.

### What Phase 38 changed (recap)

Phase 38 retired the binary 0x01/0x02/0x03 wire format. The
main `/ws` is now pure OSC; the outbound middleware system
(`OutboundScopeMiddleware::{Subscribe, Unsubscribe}`) is a
working pattern for "bridge claims an address, mutates per-WS
state, optionally synthesizes a reply via `WsCtx::ws_extras`".
`encode_scope_chunk` proved the rosc-based OSC reply pattern
(blob args, kv pairs).

This simplifies Phase 39 in three concrete ways:

1. **`/scope/{allocate,free}` plug into the existing dispatch
   shape.** No "Phase 38 will add OSC variants" caveat — they
   already exist. Adding `OutboundScopeMiddleware::{Allocate,
   Free}` is mechanical: same registry, same `WsCtx`, same
   `ws_extras` pattern.
2. **Synthetic OSC replies are routine.** rosc 0.11 + the
   blob/string/int OscType surface mean the bridge can produce
   `/scope/allocated <idx>`, `/sc-app/bootstrap/info <kv...>`,
   etc. with a few lines of Rust. No invented protocol; just
   OSC.
3. **Static metadata can ride SessionInfo, not OSC.** Pre-38
   the plan had `/clock/hello` → bridge replies with cached
   `/clock/info`. Post-38 it's cleaner to surface clock /
   sample / scope metadata directly in the JSON response of
   `POST /api/session`. The frontend's `ClockController.attach()`
   collapses from a round-trip to a one-line read. Same for
   `/dirt/listSamples` — included in SessionInfo or fetched
   from `/api/dirt/samples`. **No per-session OSC round-trip
   for static metadata.**

The high-level shift:

```
Pre-39: each Session opens N UDP sockets, runs /notify 1, runs
         /clock/hello (OSC round-trip per session), holds
         clientId + parent_group_id + sample_rate + scope_mode +
         broadcast channels. sclang owns: clock instance, scope-
         buffer allocator, /clock/hello + /scope/{hello,allocate,
         free} responders + /dirt/listSamples responder.

Post-39: bridge opens N UDP sockets at boot (one per route
          target), runs /notify 1 ONCE, fetches a single
          bootstrap blob from sclang, /s_new's the clock with
          chunk_size from bridge config. Sessions hold just
          session_id + sub_client_id + parent_group_id +
          scope_mode (no sockets, no broadcast channels).
          SessionInfo carries clock_info / dirt_buffers /
          scope_layout cached from bootstrap — no per-session
          OSC round-trip for any of it. sclang strips to:
          define SynthDefs (.add), install OSCdefs, respond to
          /sc-app/bootstrap/hello with one metadata blob,
          install SuperDirt. No /clock/hello, no /scope/*
          responders, no /s_new of shared synths at boot.
```

### Architecture

```
Bridge boot:
  1. Build RoutingTable.
  2. For each unique route target, construct a Server:
       Server { socket, broadcast: Sender<Vec<u8>>, metadata,
                _recv_task }
     The recv task fans inbound UDP to broadcast AND peeks
     known reply addresses to populate metadata.
  3. ScsynthServer: send /notify 1, await /done /notify <cid>.
                    Send /status, await /status.reply <sr>.
                    Populate metadata { scsynth_client_id,
                    sample_rate }.
  4. SclangServer: send /sc-app/bootstrap/hello (retries +
                   timeout). Await /sc-app/bootstrap/info reply.
                   Populate metadata { clock_bus, clock_node_id,
                   tick_rate, chunk_size, num_scope_buffers,
                   dirt_buffers, sc_app_synthdefs }.
  5. Bridge → scsynth: /s_new scAppClock 999 0 0
                       'clockBus' <bus> 'chunkSize' <cfg>,
                       wrapped in /sync for synchronous error
                       feedback. Boot fails loudly if /fail
                       arrives.
  6. Initialize bridge-owned scope-buffer allocator (StackAllocator
                       of 0..num_scope_buffers).
  7. Bridge "ready" — sessions can attach.

Bridge shutdown:
  - Free clock synth (/n_free 999).
  - /g_freeAll on every active session's parent group.
  - /notify 0 to scsynth.
  - Drop sockets.

Session attach (POST /api/session):
  - Bridge mints a sub_client_id (monotonic per bridge lifetime).
  - parent_group_id = SESSION_GROUP_BASE + sub_client_id.
  - SessionInfo response includes:
      {
        session_id,
        scsynth_client_id,    // ScsynthServer.metadata
        sub_client_id,        // freshly allocated
        parent_group_id,
        scope_mode,
        sample_rate,
        clock: { clock_bus, clock_node_id, tick_rate, chunk_size },
        scope: { num_scope_buffers },
        dirt: { samples: [{name, count}, …] }    // from sclang bootstrap
      }
  - No /notify, no /clock/hello, no socket bind. Pure bookkeeping.

Session cleanup (DELETE / TTL eviction):
  - /g_freeAll(parent_group_id) + /n_free(parent_group_id).
  - Mark sub_client_id free.
  - No /notify 0 — bridge keeps that for its own lifetime.
```

### Bootstrap protocol

New OSC round-trip between bridge and sclang. Replaces
per-session `/clock/hello` + `/scope/hello` + (lazy)
`/dirt/listSamples`. Single message, single reply, fetched
once at bridge boot.

```
bridge → sclang:  /sc-app/bootstrap/hello
sclang → bridge:  /sc-app/bootstrap/info
                    "clockBus", <bus_index>,
                    "clockNodeId", 999,
                    "tickRate", <derived>,
                    "chunkSize", <from cfg passed at sclang boot>,
                    "sampleRate", <s.sampleRate>,
                    "numScopeBuffers", 128,
                    "dirtSamples", "kick", 4, "snare", 8, ...,
                    "scAppSynthDefs", "scAppClock", "scAppOther", ...
```

Wire format mirrors `/clock/info` (interleaved key-value pairs,
mixing strings and numbers — `OscType` fan-in works fine in
rosc and osc-js). Easy to extend with new keys without breaking
old bridges.

`chunkSize` and `clockBus`: sclang allocates `clockBus` via
`Bus.audio(s, 1)` (server-side allocator picks a free index).
`chunkSize` is owned by the bridge config from this point
forward — sclang receives it via `SC_APP_CLOCK_CHUNK_SIZE` env
(unchanged) only because bridge → sclang config flow doesn't
exist yet; the env var becomes a back-channel until 39e moves
the chunkSize-baked-in tickRate to a control arg.

If sclang isn't reachable at bridge boot: retry with backoff,
log "sclang not reachable; clock + scope + sequencer features
disabled" after timeout, and continue serving HTTP/WS. Sessions
that try to use those features get a clean error.

### sub_client_id allocation

Bridge runs `/notify 1` once → captures `bridge_client_id`.
Sessions get a `sub_client_id`: a small integer (0, 1, 2, ...)
allocated by the bridge from a pool. `parent_group_id`
becomes a unique group-id per session: `SESSION_GROUP_BASE +
sub_client_id`, with `SESSION_GROUP_BASE = 1000` so every
session's group sits well above the clock's node 999 + sclang's
defaultGroup at 1.

Frontend's `IdAllocator` base computation (in `AppShell.tsx`)
shifts:
  Pre-39:  `clientId * 1_000_000 + 1000`
  Post-39: `bridge_client_id * 1_000_000 + sub_client_id * 100_000 + 1000`

100_000 IDs per session ÷ ~10 IDs per typical synth = ~10_000
synths/buffers per session before space contention with the
next sub_client_id. Cap sub_client_id at 9 (leaves headroom)
to keep the partition clean. Hard cap on concurrent sessions
becomes ~9, replacing scsynth's `maxLogins=8` as the binding
constraint.

### Bridge-owned scope-buffer allocator

`StackNumberAllocator(0, num_scope_buffers)` becomes a
`BridgeScopeAllocator` (Rust): a `Mutex<Vec<u32>>` free-list,
populated `0..num_scope_buffers` at bootstrap completion.

The frontend's existing two-step flow stays the same:
`/scope/allocate` → wait for `/scope/allocated <idx>` →
`/s_new bufferTap scopeNum=<idx>` → `/scope/subscribe`.
What changes is **who answers** `/scope/allocate`:

- **Pre-39**: sclang's `\scAppScopeAllocate` OSCdef responds.
- **Post-39**: bridge's `OutboundScopeMiddleware::Allocate`
  pops an index from `BridgeScopeAllocator`, encodes
  `/scope/allocated <idx>` via rosc, pushes it to
  `WsCtx::ws_extras`, and returns `Consumed`. The dispatcher
  flushes `ws_extras` to the WS sink — the frontend sees
  `/scope/allocated` as if it came from sclang, but it's
  bridge-synthesized in microseconds (no UDP round-trip).

Same shape for `OutboundScopeMiddleware::Free` (consume
`/scope/free <idx>`, return idx to the allocator, no reply).

`scope::middleware::register_outbound_middlewares` extends to
register all four variants (`Subscribe`, `Unsubscribe`,
`Allocate`, `Free`). sclang's `scope.scd` is deleted entirely
— `numScopeBuffers` lives in the bootstrap reply and on
SessionInfo.

**Why this is cheap post-Phase-38:** the dispatch shape, the
`ws_extras` plumbing, and the rosc OSC encoder are all proven.
This sub-phase is ~80 lines of Rust + 3 unit tests + a
sclang file deletion.

### Bridge-owned clock instance creation

Today: `scripts/lib/clock.scd` does `.add()` of `\scAppClock`
SynthDef AND `s.sendMsg('/s_new', ...)` to spawn the synth.

Post-39: clock.scd does `.add()` only. The bootstrap reply
includes `"scAppSynthDefs"` listing what's available. The
bridge `/s_new`s the clock with:
  - `node_id = 999` (pinned)
  - `addAction = 0` (addToHead), `target = 0` (root group)
  - `clockBus = <from bootstrap>`
  - `chunkSize = <from bridge config>`

For the SynthDef to accept `chunkSize` as a synth arg, it needs
a small change:

```sclang
SynthDef(\scAppClock, { |clockBus = 0, chunkSize = 1024|
    var tickRate = SampleRate.ir / chunkSize;
    var tick = Impulse.kr(tickRate);
    var count = PulseCount.kr(tick);
    var samplePhase = Phasor.ar(0, 1, 0, 2 * chunkSize);
    SendReply.kr(tick, '/clock/tick', count);
    Out.ar(clockBus, samplePhase);
}).add;
```

`SC_APP_CLOCK_CHUNK_SIZE` env var goes away. Bridge config gains:

```jsonc
{
  "clock": {
    "chunk_size": 1024
  }
}
```

The orchestrator script (`sc-app-superdirt-startup.scd`) drops
its `chunk-size.scd` load + `~scAppParseChunkSize` call.

### Sclang lib generalization

Each install function takes a server-supplied context object so
the bridge can pass through any future runtime config. Today's
`~scAppInstallClock = { |chunkSize| ... }` becomes:

```sclang
~scAppInstallClock = { |bootstrapCtx|
    // bootstrapCtx is a Dictionary populated by the orchestrator;
    // for now just .add() the SynthDef. Bridge will /s_new it.
    SynthDef(\scAppClock, { ... }).add;
    bootstrapCtx[\scAppSynthDefs].add(\scAppClock);
};
```

The orchestrator builds a `bootstrapCtx` dictionary, calls each
install function, then sends the dict back to the bridge as the
bootstrap reply. The pattern is open for future synths: if we
add `scAppRecorder` later, its install function `.add()`s the
SynthDef and registers itself in `bootstrapCtx[\scAppSynthDefs]`;
no other change required, the bridge sees it on next boot.

### Files

**Bridge (Rust):**

| File | Change |
|---|---|
| `src-tauri/src/server/server.rs` (new) | `Server { socket, broadcast, metadata, _recv_task }`. Per-target boot. Eager metadata fetch (ScsynthServer-specific: `/notify`, `/status`, optionally `/sync` for the clock `/s_new`; SclangServer-specific: `/sc-app/bootstrap/hello`). The recv task pre-decodes known reply addresses (`/done`, `/status.reply`, `/sc-app/bootstrap/info`) to populate metadata BEFORE fanning to the broadcast channel. |
| `src-tauri/src/server/server.rs` | `ServerMetadata` struct (per-target): scsynth_client_id + sample_rate (ScsynthServer); clock_bus + clock_node_id + tick_rate + chunk_size + num_scope_buffers + dirt_buffers + sc_app_synthdefs (SclangServer). |
| `src-tauri/src/server/mod.rs` | `AppState` gains `servers: Arc<HashMap<SocketAddr, Arc<Server>>>` + drops `scsynth_addr` (resolved via routing table — e.g. by looking up `route_for("/notify")`). `serve_on` builds Servers at boot, runs handshakes, /s_new's the clock, then opens HTTP listening. |
| `src-tauri/src/server/session.rs` | `Session` shrinks: drops `target_sockets`, `broadcast_senders`, `recv_tasks`, `scsynth_socket`, `client_id`, `sample_rate`, `scope_shm`. Keeps `session_id`, `sub_client_id`, `parent_group_id`, `scope_mode`, `last_active`. `Session::create` becomes pure bookkeeping (allocate sub_client_id, mint UUID, no UDP). `Session::cleanup` becomes `/g_freeAll(parent_group_id) + /n_free(parent_group_id)` via the shared ScsynthServer socket — no `/notify 0`. |
| `src-tauri/src/server/session.rs` | New `SubClientIdAllocator` (Mutex<Vec<u8>> free-list, 0..MAX_SESSIONS). |
| `src-tauri/src/scope/middleware.rs` | New `BridgeScopeAllocator` (Mutex<Vec<u32>>). Two new outbound middlewares: `OutboundScopeMiddleware::{Allocate, Free}`. `Allocate` pops an idx + emits `/scope/allocated <idx>` via `ws_extras`; `Free` pushes idx back. `register_outbound_middlewares` extends to register all four variants. `inbound_bgetn_issue_on_tick` flips from `session.scsynth_addr` to `Server.scsynth.socket()` (the shared one); same for the SHM-mode path's port-derivation (now reads from `Server.metadata`). |
| `src-tauri/src/server/ws_bridge.rs` | Forwarders subscribe to `Server.broadcast` instead of `Session.broadcast_senders`. Per-session per-target `forward_with_dispatch` becomes per-server per-WS. Outbound dispatch's UDP send goes through `Server.send()` not `session.target_sockets[target].send()`. |
| `src-tauri/src/server/api.rs` | `SessionInfo` shape extended (see Architecture section). `POST /api/session` reads from `state.servers[scsynth].metadata` + `state.servers[sclang].metadata` to populate the response. `/api/scope/probe` reads `num_scope_buffers` from SclangServer metadata. |
| `src-tauri/src/config.rs` | New `clock: { chunk_size: u32 }` config field. `SC_APP_CLOCK_CHUNK_SIZE` env var honoured as a back-compat shim until 39d completes. |

**sclang scripts:**

| File | Change |
|---|---|
| `scripts/lib/clock.scd` | Drop `s.sendMsg('/s_new', ...)`. Keep only `SynthDef(\scAppClock, { \|clockBus, chunkSize\| ... }).add;` (chunkSize becomes a control arg; tickRate derives from `SampleRate.ir / chunkSize`). Drop `~scAppClockNodeId = 999` literal — bridge pins the nodeId. Drop `/clock/hello` responder (bootstrap replaces it). Contributes its identity to `bootstrapCtx`. |
| `scripts/lib/scope.scd` | DELETED. Bridge owns the allocator + responders. |
| `scripts/lib/dirt-list-samples.scd` | OSCdef removed. The `~dirt.buffers` snapshot is computed once at bootstrap time and included in the bootstrap reply. |
| `scripts/lib/bootstrap.scd` (new) | Owns the `bootstrapCtx` dictionary + the `/sc-app/bootstrap/hello → /sc-app/bootstrap/info` responder. Lib install functions append to the dict during boot; the responder serializes the dict on demand (kv pairs over OSC, mirroring `/clock/info`'s shape). |
| `scripts/lib/chunk-size.scd` | DELETED. chunkSize lives in bridge config. |
| `scripts/sc-app-superdirt-startup.scd` | Orchestrator simplifies: load libs, install SuperDirt, run each `~scAppInstallX(bootstrapCtx)` to register SynthDefs+OSCdefs+metadata, install bootstrap responder. No more `~scAppParseChunkSize`; no `/s_new scAppClock` (bridge does it). |

**Frontend:**

| File | Change |
|---|---|
| `src/AppShell.tsx` | `IdAllocator` bases use `bridge_client_id * 1_000_000 + sub_client_id * 100_000 + 1000` (from extended SessionInfo). Drop `clock.attach()` round-trip — `ClockController` constructed directly with the metadata SessionInfo carries. |
| `src/clock/ClockController.ts` | `attach()` collapses to "register tick listeners, record `tick0Ms` on first tick". No more `/clock/hello` round-trip; no more `ATTACH_TIMEOUT_MS`. ClockInfo is passed in at construction. |
| `src/session/sessionBootstrap.ts` | `SessionInfo` type extended: `subClientId`, nested `clock`/`scope`/`dirt` objects from cached metadata. Rename `clientId` → `scsynthClientId` for clarity (the bridge-level value, not session-level). |
| `src/scope/scopeClient.ts` | No code change — `/scope/allocate` and `/scope/free` are still OSC messages on the wire, just answered by the bridge instead of sclang. |
| `src/dirt/DirtClient.ts` | Drop the `/dirt/listSamples` round-trip — the sample list arrives in SessionInfo. The `sampleBanks` reactive store is initialized from there. |

### Sub-phases

Order matters. 39c can technically ship before 39a (it's
self-contained), but 39a-then-39b-then-rest is the cleanest
sequence; 39c plugs in naturally after 39b's metadata cache is
in place.

- **39a — `Server` class + shared sockets + bridge-owned `/notify`.** New `server.rs` with the `Server` struct + per-target boot. Sessions drop their `target_sockets`, `broadcast_senders`, `recv_tasks`, and `scsynth_socket` fields; everything routes via `Server`. `/notify 1` runs ONCE at bridge boot (ScsynthServer's recv_task observes `/done /notify <cid>` and populates metadata.scsynth_client_id). Sessions allocate `sub_client_id` from `SubClientIdAllocator`. SessionInfo shape extends. `Session::cleanup` drops `/notify 0`. **All wire-visible behavior the same**, but the underlying socket model is the big change. **Acceptance:** `scsynth -V`'s log shows ONE `/notify` registration across bridge lifetime; 3 concurrent tabs each get distinct `sub_client_id`+`parent_group_id`.
- **39b — Bootstrap protocol + cached metadata.** New `scripts/lib/bootstrap.scd` with the `/sc-app/bootstrap/hello → /sc-app/bootstrap/info` responder. SclangServer's recv_task peeks for `/sc-app/bootstrap/info` at boot, populates metadata. SessionInfo gains nested `clock`/`scope`/`dirt` objects fed from the cache. Per-session `/clock/hello` removed (`ClockController.attach()` shrinks). `/dirt/listSamples` round-trip removed (`DirtClient` reads from SessionInfo). **Acceptance:** open a tab; observe NO `/clock/hello` or `/dirt/listSamples` traffic on `/ws`; clock + sample autocomplete still work.
- **39c — Bridge-owned scope-buffer allocator.** `BridgeScopeAllocator` in Rust. New `OutboundScopeMiddleware::{Allocate, Free}` variants. `register_outbound_middlewares` registers `^/scope/allocate$` and `^/scope/free$`. `Allocate` middleware emits `/scope/allocated <idx>` via `ws_extras`. `scripts/lib/scope.scd` deleted. **Acceptance:** open a scope; `/scope/allocate` doesn't reach sclang (verify by stopping sclang temporarily and confirming scope still allocates); chunks still flow.
- **39d — Bridge-owned clock instance creation.** `\scAppClock` SynthDef gains `chunkSize` control arg; tickRate becomes `SampleRate.ir / chunkSize`. `chunkSize` moves from `SC_APP_CLOCK_CHUNK_SIZE` env to bridge config (`config.clock.chunk_size`). Bridge `/s_new`s the clock at boot via ScsynthServer (wrapped in `/sync` for synchronous error feedback). sclang's `clock.scd` reduces to `.add()` + bootstrap registration. `chunk-size.scd` deleted. **Acceptance:** restart bridge; clock comes up at the configured chunkSize; changing config + restart picks up the new value.
- **39e — sclang lib generalization (cleanup).** Each `~scAppInstallX` takes `bootstrapCtx`. Pattern documented in CLAUDE.md ("sclang declares, bridge instantiates"). No new behavior; reorganization so future shared synths follow the same shape. **Acceptance:** lib files compile + load; orchestrator script reads top-to-bottom as "load, register, expose".

### Acceptance criteria (cumulative)

- `cargo test --lib` green; new tests for `Server` boot,
  bootstrap parsing (kv pairs round-trip), sub_client_id
  allocation, `BridgeScopeAllocator` (alloc/free, exhaustion),
  `/scope/allocate` middleware (synthetic reply byte layout).
- `yarn test`, `yarn tsc`, `yarn build` clean.
- Manual smoke: launch bridge + sclang + scsynth; open 3 tabs;
  verify each gets distinct `sub_client_id` + `parent_group_id`,
  scsynth's log shows ONE `/notify` registration, no
  `/clock/hello` or `/dirt/listSamples` on `/ws`, scopes work
  in both SHM + OSC modes.
- Shut down bridge cleanly: clock synth freed, `/notify 0` sent,
  every active session's parent group freed.

### Cross-cutting risks

- **`/fail` correlation across sessions (NEW post-shared-sockets).**
  scsynth's `/fail` reply goes to the source UDP port of the
  failing command. With per-session sockets (today), `/fail`
  reaches only the offending session. With shared sockets
  (post-39), every WS sees every `/fail`. In practice
  `/fail` is rare (scsynth misuse / bugs); user-facing impact
  is "one tab's mistake shows up as a toast in another tab".
  **Mitigation (deferred)**: bridge maintains a per-WS pending
  outbound map keyed by command-address + key-arg (nodeId for
  `/s_new`, bufnum for `/b_*`). On `/fail` arrival, match by
  args[0] (failed command) + args[2] (id) and route only to
  the issuing WS. Defer to a follow-up phase if it bites.
  Same shape applies to `/done /<cmd>` replies; today
  `sendAndSync` correlates by sync id, which keeps working
  unchanged. Document in CLAUDE.md.
- **Reply correlation for `/scope/allocated` is solved by 39c
  itself.** No round-trip → no correlation problem; the bridge
  synthesizes the reply locally for the requesting WS.
- **`/clock/tick` multicast still works.** scsynth multicasts
  to `/notify`'d clients. With the bridge as the sole `/notify`
  registrant, the bridge's ScsynthServer socket receives every
  tick and broadcasts to every WS. Same end-result as
  per-session `/notify` but with one slot instead of N.
- **sub_client_id range exhaustion.** Cap at 9; over-cap →
  `POST /api/session` returns 503. Practical workload is 1–2
  tabs.
- **Bootstrap race.** Bridge boots → tries
  `/sc-app/bootstrap/hello` → sclang isn't up yet → retries
  (3-second timeout, 5 retries; total 15 s). On final failure,
  log "sclang not reachable; clock + scope + sequencer
  features disabled" and continue serving HTTP/WS. Mirrors the
  existing scsynth attach-mode pattern.
- **SC_APP_CLOCK_CHUNK_SIZE env var migration.** Keep
  env-var-as-fallback for one release; warn-log if set; CLAUDE.md
  migration note.
- **Bridge `/s_new scAppClock` error handling.** Wrap in `/sync`
  for synchronous feedback. ScsynthServer's recv_task observes
  `/done /sync <id>` for success or `/fail /s_new <reason>` for
  failure; either way, bridge boot synchronizes on the outcome.
- **Stripping sclang's `/clock/hello` and `/scope/*` responders
  is observable.** External tools that connect to sclang
  directly (debug scripts, the SuperCollider IDE) won't see
  these responders. Document the bootstrap message as the new
  way; legacy debug scripts can talk to the bridge's HTTP API
  instead.
- **Shared `ScsynthServer.broadcast` channel under load.** All
  WSs subscribe to one channel for scsynth replies. Steady
  state at default config: ~47 Hz `/clock/tick` × N WSs sinks.
  `tokio::sync::broadcast` with capacity 4096 handles this
  comfortably; `Lagged` recovery is the same as today's
  per-session broadcasts. Worth a load-test entry in the
  acceptance smoke (3 tabs simultaneously).

### Phase 39 ordering vs Phase 38

Phase 38 shipped first (commits `5f05ef2`, `b6a7729`,
`efcc25c`). Phase 39 builds on its outbound middleware
infrastructure: 39c is mechanically simple because Phase 38's
`OutboundScopeMiddleware` enum + `WsCtx::ws_extras` + rosc
encoder already cover the heavy lifting.

---

## Open Points

1. **Parent group ID derivation.** `clientId × 100`, falling back
   to `100` when scsynth assigns `clientId = 0`. The fallback
   warns in the debug log. Promotion to a configurable allocator
   has not been needed.
2. **Clock bus ID.** Allocated by sclang via `Bus.audio(s, 1)` at
   server boot (Phase 30). Index reported in `/clock/info`;
   typically <32 in practice. Frontend's `IdAllocator(bus)` starts
   at 32 to avoid hardware-reserved buses. Confirm against scsynth
   boot config if a deployment uses a non-default
   `numAudioBusChannels`.
3. **Recording memory ceiling.** Float32 stereo at 48 kHz =
   ~23 MB/min. Practical comfortable ceiling ~10–15 min before
   RAM pressure. Streaming-to-disk (Future Improvement #2)
   addresses this.
4. **WAV 4 GB header limit.** Float32 stereo at 48 kHz → ~3h45m
   max file size in the WAV header. Above the RAM ceiling, so not
   binding in practice. RF64 deferred.
5. **Reconnection.** Out of scope. App expects manual reload on
   WS loss (the runtime error modal facilitates that). Future
   Improvement #3.
6. **Ordering constraints within parent group.** Clock at head;
   everything else `AddToTail`; producers must be created before
   consumers that read their buses. Documented in `CLAUDE.md`.
7. **Parent group placement at root.** `AddToTail` of the root
   group is now load-bearing (Phase 26 deployments share scsynth
   with sclang+SuperDirt). Documented in `CLAUDE.md` gotchas
   and at the constructor of `GroupController`.

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

Phase 32d bootstrapped vitest at root and added 8 unit tests for
the worker-side sequencer pump (`src/workers/sequencerPump.test.ts`).
The remaining pieces that absorbed real debugging cycles and are
worth pinning:

- `EnvelopeBuffer` — append a known signal, snapshot, verify
  min/max columns.
- `WavMemoryWriter` — append known frames, finalise, parse the
  resulting WAV header.
- `BufferManager` — refcount semantics under interleaved
  acquire/release; lazy SHM probe rejection path.
- `SequencerController` (post-32) — main-thread orchestration:
  mock `WorkerClient`, assert `startSequencer` / `bankUpdate` /
  `setSequencerPaused` get posted on the right state changes.
  (The worker pump itself is covered in 32d's tests.)

Vitest is set up at the root (`yarn test` / `yarn test:watch`)
plus per-workspace under `packages/synthdef-compiler`.

**Cost:** ~½ day for the remaining four targets.

### 6. Persistent UI settings

`localStorage` per-session: last-used scsynth address (already
done), preferred chunkSize, channel count, recording bus, window
size, sequencer pattern bank (lands in Phase 27c).

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

### 9. Wider buffer ring

> **Mostly superseded by Phase 31; partially relevant again
> in Phase 36's OSC fallback mode.** SHM mode (the default)
> has no `/b_getn` and no `late` warnings — the gap concern
> is gone. OSC mode (Phase 36) brings back `/b_getn` as a
> fallback; if a deployment runs heavily in OSC mode and hits
> `late` warnings, a wider OSC-side ring is the targeted
> fix. Keeping the entry below as a roadmap for that case.

Current per-buffer ring is 2 halves (`2 × chunkSize` frames).
At default `chunkSize = 1024 / sampleRate = 48 kHz` this gives a
21 ms safe-read window — too narrow to bump `READ_DELAY_MS` past
scsynth's audio-clock-vs-wall-clock drift (~14–24 ms) without
risking buffer-overwrite gaps. Net visible symptom: scsynth
console emits `late 0.0XX` warnings on every `/b_getn` (cosmetic,
data is correct, but noisy). Phase 30 unblocked this — chunkSize
is now fixed at sclang startup, so a wider ring can be sized once
and stay.

**Two flavours, pick one:**

- **(a) Global ring depth.** One value (`ringHalves = 4` is a
  good default) shared by clockBus's wrap and every tap synth.
  Simplest. Memory at default config: +16 KB / buffer (~32 KB
  total at stereo float32). Bumps `READ_DELAY_MS` to ~30 ms,
  silences the `late` warnings, adds ~25 ms to scope/recording
  chunk arrival latency. **Cost: ~1 day.**

- **(b) Per-acquire ring depth.** `BufferManager.acquire` takes
  optional `ringHalves`; clockBus wraps at a `MAX_RING_HALVES`
  (e.g. 8) so any allowed value (powers of 2, divisors of the
  max) works. `BufferManager` key gains a dimension; worker
  tracks `ringHalves` per bufferId for the `(tickIndex - 2 + N) % N`
  parity formula. UI not exposed in this phase — capability sits
  behind the API for future tuning. Lets a low-latency live
  scope use 2 while a long-running recording uses 8.
  **Cost: ~2 days.**

**Recommendation:** start with (a) if/when you decide to silence
the `/b_getn late` warnings; promote to (b) only if a real
per-scope tuning need shows up. The wire format gets `ringHalves`
in `/clock/info` either way (sclang's clock SynthDef has to
publish its wrap point), so (a) → (b) is a straightforward
later evolution.

**Touch points (either flavour):** `scripts/sc-app-superdirt-startup.scd`
(clock SynthDef wrap + `/clock/info` reply field),
`src/clock/clockClient.ts` (parse `ringHalves`),
`src/synthdefs/bufferTapSynthDef.ts` (cache key + ring math),
`src/buffer/BufferController.ts` (ring frames), worker protocol
+ parity formula in `src/workers/oscWorker.ts`,
`src/config/clockConfig.ts` (bump `READ_DELAY_MS`).

### 10. Cross-session shared taps

> **Largely absorbed by Phase 31.** The bridge owns
> subscription state in 31's design, so deduping
> subscriptions across sessions is a small extension
> (one SHM poll loop per scope buffer index, fanned to
> N attached WS) rather than an architectural rewrite.
> Originally written pre-31 below; the cost estimate
> drops dramatically post-31.

Phase 30 made the clock shared across sessions; the same
template applies to tap synths. Today, if two sc-app tabs both
attach a stereo scope to bus 17 chunkSize 1024, each spins up
its own tap synth + buffer + worker subscription + `/b_getn`
loop firing at the tick rate. With one tap per `(inputBus,
channels, chunkSize, ringHalves)` tuple at scsynth's root group
(owned by sclang or the bridge), all sessions could subscribe
to the same buffer. Direct savings: scsynth CPU (one tap synth
processing audio instead of N), buffer memory (one ring instead
of N), UDP traffic from `/b_getn` (one request per tick instead
of N — see #10 below).

**When this matters.** Multiple clients monitoring the *same*
bus. Probably uncommon for solo dev work; potentially common
for collaborative editing or installation deployments where
several displays render the same waveform.

**Cost:** ~2 days. Needs a coordination protocol (frontend ↔
sclang or ↔ bridge) for "request shared tap on this spec"
with cross-session reference counting; tap synth lifecycle
management owned by the coordinator; Session-attach replay
of the active tap list so a freshly-connecting tab inherits
existing taps. Worth it only when the use case becomes real.

### 11. Bridge-side `/b_getn` dedup

> **Conditionally relevant after Phase 36.** SHM mode (the
> default) has no `/b_getn` to dedup. OSC fallback mode
> (Phase 36) does — but only matters if multiple sessions
> share a bufnum, which depends on #10 (cross-session
> shared taps). Keep on the roadmap for OSC-heavy
> multi-session deployments; not blocking for typical use.

### 12. Boost.Interprocess segment-manager parser

Phase 31's SHM reader uses a heuristic scope_buffer-array
scan: search for the `_stage=0, _in=1, _out=2` trailer
pattern at scsynth boot, find the longest contiguous run of
matches, derive the array start + stride. Works because
Boost's TLSF allocator places sequential `segment.allocate()`
calls contiguously in practice and 128 unused scope_buffers
all share the default-ctor signature.

The "proper" replacement is to walk Boost.Interprocess'
`managed_shared_memory` segment-manager metadata directly:
parse the segment header, walk the named-object index,
resolve `find<server_shared_memory>("SuperColliderServer_<port>")`
to its offset, then walk the `bi::vector<offset_ptr<scope_buffer>>`
explicitly. Robust against future Boost allocator changes
(non-sequential allocation, reordering, etc.); brittle against
Boost major-version layout changes (segment-manager internals
are not a stable ABI).

**Promote when:** the heuristic scan starts failing —
typically because Boost was upgraded and the allocator no
longer places sequentially, OR scsynth changed how it
constructs the shared segment, OR we want to address other
named objects (control buses, custom shared state) where
the heuristic doesn't apply. Until then, the current scan
is fine.

**Cost:** ~1–2 days. The Boost.Interprocess segment manager
header layout is documented in Boost source
(`boost/interprocess/segment_manager.hpp` + the index types
under `boost/interprocess/indexes/`); not difficult, just
mechanical. Keep the heuristic scan in place as a fallback
or comparison/sanity check during development.

Alternative lighter path if a quick fix is needed: a tiny
C++ FFI shim that uses `bi::managed_shared_memory(open_only,
...).find<...>()` directly. Adds Boost + C++ to the build
chain (painful for the Pi cross-compile); decision is "keep
build simple in Rust" vs "outsource fragility to Boost".

Lighter version of #9. Keep tap synths per-session, but have
the bridge notice when N sessions issue `/b_getn` for the same
`(bufnum, offset)` within a tick window and forward only one,
broadcasting the resulting `/b_setn` reply back to all N.
Saves UDP traffic and scsynth CPU under the same workload as
#9, without restructuring tap-synth ownership.

**Caveat.** Only meaningful if multiple sessions actually share
a bufnum — which they currently can't, because tap synths and
their buffers are per-session. So this is dependent on #10 (or
some other cross-session sharing mechanism) shipping first.

**Cost:** ~1 day after #10. Requires the bridge to OSC-decode
inbound `/b_getn` (currently it's a transparent byte-forwarder),
maintain a per-tick coalescing window, and route `/b_setn`
replies by remembering which sessions waited for each request.
