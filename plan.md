# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`docs/history.md`](./docs/history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 38 — Drop binary scope wire format** is in flight;
spec below. Phase 39 (Server abstraction + bridge-owned boot
sequence) is queued after — its full spec is also below for
reference. Phases 0–37 are in
[`docs/history.md`](./docs/history.md).

---

## Phase 38 — Pure-OSC Scope Wire Format

**Goal.** Retire the binary 0x01 / 0x02 / 0x03 op-tag mux that
Phase 35 introduced for scope subscribe / unsubscribe / chunk
frames. Replace with proper OSC messages —
`/scope/subscribe`, `/scope/unsubscribe`, `/scope/chunk` — so
the main `/ws` becomes a pure OSC bridge. The Phase 37
middleware infrastructure already holds the dispatch shape;
this phase fills in the outbound `Scope` middleware variants
and switches the worker from binary-frame peeking to plain
OSC decoding.

### Wire format

| Address | Direction | Args |
|---|---|---|
| `/scope/subscribe` | WS → bridge | `subId:i, scope:i, channels:i, chunk:i` |
| `/scope/unsubscribe` | WS → bridge | `subId:i` |
| `/scope/chunk` | bridge → WS | `subId:i, tick:i, isGap:i, channels:i, data:b` |

Notes:

- `isGap` as `i` (0/1) — OSC 1.0 has no bool type.
- `channels` widens from u8 (today's binary frame) to i32 — no
  functional change for typical 1–2 channels; eliminates a
  >255-channel edge case.
- `data` is a blob of `frame_count × channels × 4 bytes` of
  **big-endian** IEEE-754 float32, channel-interleaved. BE for
  consistency with OSC's `,f` type. Documented in module
  docstrings on both ends; pinned by a unit test that asserts
  the exact byte layout for known input floats.
- Worker-side decode: extract the blob `Uint8Array`, byte-swap
  per-float into a fresh `Float32Array`, transfer that to
  main thread (zero-copy across the postMessage boundary). The
  swap cost is ~376 KB/sec/scope at default config — trivial.

The `scope` field on `/scope/subscribe` keeps its dual
meaning: scope-buffer index in SHM mode, bufnum in OSC
fallback mode. Bridge interprets per `Session::scope_mode` (no
change from Phase 36).

### Bridge changes

| File | Change |
|---|---|
| `src-tauri/src/scope/middleware.rs` | Delete `encode_chunk` (binary 0x03 producer). Add `encode_scope_chunk(sub_id, tick, is_gap, channels, frame_count, floats: &[f32]) -> Vec<u8>` returning rosc-encoded `/scope/chunk` bytes (blob arg, BE floats). Delete `ws_scope_subscribe_binary` / `ws_scope_unsubscribe_binary`; replace with `outbound_scope_subscribe(ctx, msg) -> MiddlewareOutcome` / `outbound_scope_unsubscribe(ctx, msg) -> MiddlewareOutcome` taking the parsed `OscMessage` and delegating to the existing `install_subscription` / removal helpers. Drop the `SCOPE_OP_*` constants. |
| `src-tauri/src/scope/middleware.rs` | New `OutboundScopeMiddleware { Subscribe, Unsubscribe }` enum + `run_outbound(variant, ctx, msg) -> MiddlewareOutcome`. Update `register_*_middlewares(out, in, mode)` to register `^/scope/subscribe$` and `^/scope/unsubscribe$` on the outbound registry. |
| `src-tauri/src/server/middleware.rs` | `OutboundMiddleware` enum gains `Scope(OutboundScopeMiddleware)` variant; `_Phantom` placeholder retired. `invoke_outbound` matches the new variant and delegates. The dispatcher needs the parsed `OscMessage` (not just raw bytes) — extend the dispatch contract to decode once at the dispatcher and pass `&OscMessage` to the variant body. |
| `src-tauri/src/server/ws_bridge.rs` | Drop the first-byte peek + 0x01/0x02 branches in the recv loop. Every binary message goes straight through OSC peek + outbound dispatch. The recv loop shrinks to ~30 lines; the `handle_outbound_osc` path becomes the only path. |

### Frontend changes

| File | Change |
|---|---|
| `packages/server-commands/src/commands/scope.ts` (new) | `subscribeMessage(subId, scope, channels, chunkSize) → OSC.Message`, `unsubscribeMessage(subId) → OSC.Message`. Optionally a small `parseScopeChunkReply(args) → DecodedScopeChunk` helper for the worker. |
| `src/workers/scopeWire.ts` | DELETE. The binary frame format is gone; the 0x01/0x02 encoders + 0x03 decoder + `isScopeFrame` peek + `DecodedScopeChunk` move to the `server-commands` package (or vanish where the new flow doesn't need them). |
| `src/workers/oscWorker.ts` | Drop `isScopeFrame` peek + `handleInboundBytes` first-byte branch. Every inbound binary frame goes through `decode(bytes)`. Add a case in the reply pump for `address === "/scope/chunk"`: extract the blob arg as `Uint8Array`, byte-swap into a fresh `Float32Array`, post `bufferChunk` to main with the array transferred. `handleSubscribeBuffer` / `handleUnsubscribeBuffer` use the new builders + `transport.send(encode(message))`. |

### Tests

- Rust: `encode_scope_chunk` round-trip — encode known
  `(sub_id, tick, is_gap, channels, floats)`, decode via
  `rosc::decoder::decode_udp`, assert the unpacked args match
  + the blob bytes are big-endian-equivalent of the input.
  Plus an endianness-pin test: hand-construct the expected
  bytes for a known float (e.g., `1.0_f32` → `0x3F 0x80 0x00
  0x00`) and assert `encode_scope_chunk` produces them.
- Vitest: `parseScopeChunkReply` — decode the same fixture
  bytes the Rust test produces (committed as a hex array in
  the test file), assert the decoded `Float32Array` matches.
- Integration: smoke-test scope flow end-to-end. DevTools WS
  frame inspector should show every frame starting with `/`
  (0x2F) or `#` (0x23) — no 0x01/0x02/0x03.

### Sub-phases

- **38a** — Bridge: replace `encode_chunk` with `encode_scope_chunk`, add the `OutboundScopeMiddleware` variants, register them, drop the first-byte peek in `ws_bridge.rs`. Worker still emits binary 0x01/0x02 + decodes 0x03 → bridge will see those as garbage and drop with a warn. **Frontend won't work end-to-end mid-38a; that's expected. Keep the diff small and land 38b in the same PR if review-by-PR.**
- **38b** — Frontend: new `server-commands/scope.ts` builders + `oscWorker.ts` flips. Wire format change is now bidirectional. Smoke test passes again.
- **38c** — Cleanup: delete `scopeWire.ts`. Update CLAUDE.md (file-tree comment, gotchas) + `docs/architecture.md` 5.4 (drop the binary frame format table; replace with the OSC schema). Move spec to history.md.

Sub-phases 38a + 38b are best landed as one commit (not two)
because the wire format change is bidirectional — half-changed
state means broken scope. Treat 38a as "the bridge half" of
one logical change.

### Acceptance criteria

- `cargo test --lib` green; new `encode_scope_chunk` +
  endianness-pin tests.
- `yarn test` green; new `parseScopeChunkReply` round-trip test.
- `yarn tsc --noEmit`, `yarn build`, `cargo build` clean.
- Manual smoke: take a scope; observe waveform render; record
  60 s on a deterministic synth (sine 440 Hz amp 0.5);
  bit-compare WAV against pre-38 baseline. **Same-byte equal
  is the bar** — the wire-format change must not perturb the
  audio path. (Modulo timing jitter, any difference is a bug.)
- Repeat with `bridge --no-shm` to exercise the OSC fallback
  path (chunk emission goes through `/b_setn` interception →
  `encode_scope_chunk` → WS).

### Cross-cutting risks

- **Endianness foot-gun.** Forgetting to byte-swap on the
  worker side produces noise (every f32 reads as a totally
  different number). The pinned test on both sides catches
  this; but if a future contributor changes one side without
  the other, the test fails immediately. Worth being a loud
  bug, not a silent one.
- **Blob alignment.** OSC blobs are 4-byte aligned; rosc
  handles this on encode. The decoded `Uint8Array` on the
  worker side may not be aligned for direct
  `Float32Array(blob.buffer, byteOffset)` views — the
  byte-swap loop sidesteps this by writing into a fresh
  `Float32Array(frameCount * channels)`.
- **`/scope/chunk` collisions with `/scope/*` route entry.**
  The starter sclang regex `^/(dirt|clock|scope)(/|$)` would
  match `/scope/chunk` and route it to sclang. **But**: the
  middleware-first dispatch order (Phase 37) means the
  outbound `^/scope/subscribe$` and `^/scope/unsubscribe$`
  middlewares claim BEFORE routing kicks in. Inbound
  `/scope/chunk` is BRIDGE → WS only — never enters routing.
  So no collision, but worth keeping in mind: any future
  `/scope/X` address that's purely bridge-handled needs a
  middleware to claim it OR an explicit route entry that
  handles it (or routes nowhere).
- **Worker bundle handling.** osc-js may decode a
  `/scope/chunk` inside a bundle; today's worker flattens
  bundles in `emitReply`. That should keep working, but the
  per-message handler needs to be on the address-match path,
  not the first-byte peek.

### Phase 38 → Phase 39 dependency

Phase 39c (bridge owns scope-buffer allocator) plugs into
Phase 38's outbound `^/scope/subscribe$` middleware — the
bridge picks the index from its own allocator + synthesizes
`/scope/allocated` via `ws_extras`. So Phase 38 must land
first; Phase 39c builds on its dispatch shape.

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

The high-level shift:

```
Pre-39: each Session opens N UDP sockets, runs /notify 1, runs
         /clock/hello, holds clientId + parent_group_id +
         sample_rate + scope_mode + broadcast channels.
         sclang owns: clock instance, scope-buffer allocator,
         /clock/hello + /scope/* responders.

Post-39: bridge opens N UDP sockets at boot (one per route
          target), runs /notify 1 ONCE, fetches a single
          bootstrap blob from sclang, /s_new's the clock with
          chunk_size from bridge config. Sessions hold just
          session_id + sub_client_id + parent_group_id +
          scope_mode (no sockets, no broadcast channels).
          sclang strips to: define SynthDefs (.add), install
          OSCdefs, respond to /sc-app/bootstrap/hello with one
          metadata blob, install SuperDirt. No more /clock/hello,
          /scope/{allocate,free} responders, or /s_new at boot.
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
                    Populate metadata { client_id, sample_rate }.
  4. SclangServer: send /sc-app/bootstrap/hello (with retries +
                   timeout). Await /sc-app/bootstrap/info reply
                   with all sclang-side metadata.
                   Populate metadata { clock_bus, num_scope_buffers,
                   dirt_buffers, ... }.
  5. Bridge → scsynth: /s_new scAppClock <clock_node_id> 0 0
                       'clockBus' <clock_bus> 'chunkSize' <cfg>.
                       Pin clock_node_id = 999 (reserved).
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
      { session_id, sub_client_id, parent_group_id, scope_mode,
        clock_info: { clock_bus, clock_node_id, tick_rate,
                      chunk_size, sample_rate },
        scsynth_client_id  // bridge-level, for IdAllocator base
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
populated 0..num_scope_buffers at bootstrap completion. Phase
38's outbound middleware on `^/scope/subscribe$` picks an index
from the allocator, builds the subscription state, and emits a
synthetic reply via `WsCtx::ws_extras` (`/scope/allocated <idx>`
in OSC form). On unsubscribe, return the index to the
allocator.

Today's sclang `/scope/{allocate,free}` responders go away. The
sclang lib's `scope.scd` shrinks to "/scope/hello → /scope/info"
… or disappears entirely if that responder isn't useful
post-bootstrap (the bootstrap blob carries `numScopeBuffers`).

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
| `src-tauri/src/server/server.rs` (new) | `Server { socket, broadcast, metadata, _recv_task }`. Per-target boot. Eager metadata fetch (ScsynthServer-specific: `/notify`, `/status`; SclangServer-specific: `/sc-app/bootstrap/hello`). |
| `src-tauri/src/server/server.rs` | `ServerMetadata` struct: scsynth_client_id, sample_rate, clock_bus, clock_node_id, tick_rate, chunk_size, num_scope_buffers, dirt_buffers, scAppSynthDefs. |
| `src-tauri/src/server/mod.rs` | `AppState` gains `servers: Arc<HashMap<SocketAddr, Arc<Server>>>` + drops `scsynth_addr` (resolved via routing table from a known route entry, e.g. the one matching `/notify`). `serve_on` builds Servers at boot before spawning the TTL task. |
| `src-tauri/src/server/session.rs` | `Session` shrinks: drops `target_sockets`, `broadcast_senders`, `recv_tasks`, `scsynth_socket`, `client_id`, `sample_rate`, `scope_shm`. Keeps `session_id`, `sub_client_id`, `parent_group_id`, `scope_mode`, `last_active`. `Session::create` becomes pure bookkeeping (no UDP). `Session::cleanup` becomes `/g_freeAll(parent_group_id)` + `/n_free(parent_group_id)` — no `/notify 0`. |
| `src-tauri/src/server/session.rs` | New `SubClientIdAllocator` (Mutex<Vec<u8>> free-list, 0..MAX_SESSIONS). |
| `src-tauri/src/scope/middleware.rs` | New `BridgeScopeAllocator` for scope-buffer indices. Outbound middleware on `^/scope/subscribe$` (Phase 38's variant) picks from this allocator + emits synthetic `/scope/allocated` reply via `ws_extras`. |
| `src-tauri/src/scope/middleware.rs` | `inbound_bgetn_issue_on_tick` updates: `scsynth_socket` lookup via `Server` instead of `Session`. Same for the SHM-mode path (now reads `Server.metadata.scsynth_addr` to derive the SHM port). |
| `src-tauri/src/server/ws_bridge.rs` | Forwarders subscribe to `Server.broadcast` instead of `Session.broadcast_senders`. Per-session per-target `forward_with_dispatch` becomes per-server per-WS. `WsCtx` gains `&Server` references where needed. |
| `src-tauri/src/server/api.rs` | `SessionInfo` shape extended: includes `clock_info` (read from `SclangServer.metadata`), `scsynth_client_id` (read from `ScsynthServer.metadata`). `/api/scope/probe` reads `num_scope_buffers` from server metadata. |
| `src-tauri/src/config.rs` | New `clock: { chunk_size: u32 }` config field. `SC_APP_CLOCK_CHUNK_SIZE` env var still respected as override at sclang boot until 39e fully completes the move. |

**sclang scripts:**

| File | Change |
|---|---|
| `scripts/lib/clock.scd` | Drop `s.sendMsg('/s_new', ...)`. Keep only `SynthDef(\scAppClock, { \|clockBus, chunkSize\| ... }).add;`. SynthDef takes `chunkSize` as a control arg. Drop `~scAppClockNodeId = 999` literal — bridge pins the nodeId. Drop `/clock/hello` responder (replaced by bootstrap). |
| `scripts/lib/scope.scd` | Drop `/scope/{hello,allocate,free}` responders. Bridge owns the allocator now. File can be removed entirely. |
| `scripts/lib/dirt-list-samples.scd` | Convert `/dirt/listSamples` responder to a "fetch buffers from `~dirt.buffers` once" call invoked from the bootstrap responder. Drop the OSCdef. |
| `scripts/lib/bootstrap.scd` (new) | Owns the `bootstrapCtx` dictionary builder + the `/sc-app/bootstrap/hello → /sc-app/bootstrap/info` responder. Each install function appends to the dict; bootstrap responder serializes it. |
| `scripts/lib/chunk-size.scd` | Removed. chunkSize lives in bridge config. |
| `scripts/sc-app-superdirt-startup.scd` | Orchestrator simplifies: load libs, install SuperDirt, install `bootstrap` (which calls each `~scAppInstallX` to populate `bootstrapCtx`). No more `~scAppParseChunkSize` call; no `/s_new scAppClock` (bridge does it). |

**Frontend:**

| File | Change |
|---|---|
| `src/AppShell.tsx` | `IdAllocator` bases use `bridge_client_id * 1_000_000 + sub_client_id * 100_000 + 1000` (from extended SessionInfo). Drop `clock.attach()` round-trip — read clock metadata directly from SessionInfo. |
| `src/clock/ClockController.ts` | `attach()` no longer sends `/clock/hello`. Just registers tick listeners + records `tick0Ms` on first tick. ClockInfo populated from SessionInfo at construction. |
| `src/session/sessionBootstrap.ts` | `SessionInfo` type extended with `clockInfo`, `scsynthClientId`, `subClientId` (or rename `clientId` → `subClientId` for clarity). |
| `src/scope/scopeClient.ts` | `/scope/allocate` ↔ `/scope/allocated` round-trip flows through Phase 38's OSC scope-subscribe path; the bridge's middleware synthesizes the reply. No worker-side change required (the wire is already OSC by Phase 38). |

### Sub-phases

- **39a — `Server` class + shared sockets, sessions still own `/notify`.** New `server.rs` with the `Server` struct + per-target boot. Sessions stop binding their own UDP sockets — they get an `Arc<Server>` per target via `AppState.servers`. The `/notify 1` handshake stays per-session for now (each session sends `/notify 1` via the shared scsynth socket; scsynth still issues a distinct clientId based on... actually it can't, source port is shared — so this sub-phase has a transition wrinkle). **Or**: 39a does both the Server extraction AND the bridge-owned `/notify` together. Cleaner.
- **39b — Bootstrap protocol + metadata caching.** `/sc-app/bootstrap/hello` ↔ `/sc-app/bootstrap/info`. New `scripts/lib/bootstrap.scd`. `SclangServer.metadata` populated. Sessions read clock info from server metadata. Per-session `/clock/hello` removed; `ClockController.attach()` shrinks. `dirt-list-samples.scd` migrates: `~dirt.buffers` snapshot included in bootstrap reply.
- **39c — Bridge owns scope-buffer allocator.** `BridgeScopeAllocator` in Rust. Phase 38's `^/scope/subscribe$` outbound middleware uses it directly + synthesizes `/scope/allocated` reply. sclang's `scope.scd` deleted. Frontend's flow unchanged (it talks OSC; bridge handles in-process).
- **39d — Bridge owns clock instance creation.** `\scAppClock` SynthDef gains `chunkSize` control arg. `chunkSize` moves from `SC_APP_CLOCK_CHUNK_SIZE` env to bridge config. Bridge `/s_new`s the clock at boot (after bootstrap completes). sclang's `clock.scd` reduces to `.add()` + bootstrap registration. `chunk-size.scd` deleted.
- **39e — sclang lib generalization (cleanup).** Refactor remaining install functions to take a `bootstrapCtx` arg; document the "sclang declares, bridge instantiates" pattern. No new behavior; reorganization to make future shared synths follow the same shape.

### Acceptance criteria

- `cargo test --lib` green; new tests for `Server` boot, bootstrap parsing, sub_client_id allocation, bridge-owned scope allocator.
- `yarn test`, `yarn tsc`, `yarn build` clean.
- Manual smoke: launch bridge + sclang + scsynth; observe single `/notify 1` registration on scsynth; open 3 tabs concurrently, verify each gets a distinct `sub_client_id` and `parent_group_id`; take a scope on each, verify chunks flow; close 2 tabs, verify only those parent groups freed (clock + others survive); shut down bridge, verify single `/notify 0` and clock/synth teardown.
- `scsynth -V`'s `/notify` log shows ONE registration per bridge process across the entire bridge lifetime.

### Cross-cutting risks

- **Reply correlation for shared sockets** (covered in design discussion). `/done /sync` is already self-correlating by sync-id; `/scope/allocate` is gone (bridge owns the allocator); `/clock/hello` is gone (bootstrap replaces it). The remaining shared-socket replies are scsynth multicasts (`/n_go`, `/n_end`, `/clock/tick`) which are intentionally fan-out anyway.
- **sub_client_id range exhaustion.** Cap at 9; if the cap is hit, `POST /api/session` returns 503 with a clear error. Practical workload is 1–2 tabs; the cap is a safety net.
- **Bootstrap race.** Bridge boots → tries `/sc-app/bootstrap/hello` → sclang isn't up yet → retries. Need a sane retry policy (3-second timeout, 5 retries; total 15 seconds) and a clear "sclang not reachable" path that lets the bridge serve HTTP/WS without sclang-dependent features. Mirror's the existing scsynth attach-mode pattern.
- **SC_APP_CLOCK_CHUNK_SIZE env var migration.** Pre-39 deployments have it set in their systemd unit / launch script. Post-39 it's a config field. Plan: keep env var honoured for one release as a back-compat alias; warn-log if it's set; CLAUDE.md migration note.
- **Synth-creation error handling on the bridge side.** `/s_new` doesn't have a synchronous reply; if scsynth refuses (duplicate node ID, missing SynthDef), the failure surfaces as `/fail`. Bridge needs to listen for `/fail` matching the `scAppClock` `/s_new` and surface it as a boot error. Wrap the `/s_new` in a `/sync` to make this synchronous.
- **Stripping sclang's `/clock/hello` is observable.** Anyone who connects directly to sclang and sends `/clock/hello` (e.g. a debug script) gets nothing back. Document the migration; the bootstrap wire format is the new way.

### Phase 39 ordering vs Phase 38

Phase 38 (drop binary scope wire format) is largely independent
of Phase 39. The reasonable ordering is:

1. **Phase 38 first** — `/scope/{subscribe,unsubscribe,chunk}` become real OSC. Phase 39's "bridge owns scope allocator" then plugs naturally into the OSC outbound middleware (no binary-frame branch left to worry about).
2. **Phase 39 second** — Server abstraction + bootstrap + sclang lib refactor. Already assumes scope ops are OSC.

Could also do 39 first, then 38, but 38 → 39 is the cleaner dependency direction.

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
