# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`docs/history.md`](./docs/history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 37 — Regex Routing + Address-Keyed Middlewares** is in
flight; spec below. Phases 0–36 are in
[`docs/history.md`](./docs/history.md).

---

## Phase 37 — Regex Routing + Middleware Dispatch (no wire change)

**Goal.** Replace the prefix-based routing table + implicit catch-all
with a regex-based routing table that explicitly enumerates scsynth's
command surface. Add an address-keyed middleware dispatch layer that
runs *before* routing on both directions (WS → bridge → UDP and
UDP → bridge → WS). Middlewares can claim addresses that aren't in
the routes table (e.g., `/scope/subscribe`) or observe addresses
that pass through (e.g., side-effect on `/clock/tick`). Sets the
infrastructure for Phase 38 (drop binary scope wire format; scope
ops become OSC).

### Design

#### Routing config

`routes` becomes an ordered list of `{ pattern: regex, target }`.
Walked top-down, first regex match wins. **No implicit default.**
Starter seeds two entries:

```jsonc
{
  "routes": [
    { "pattern": "^/(dirt|clock|scope)(/|$)", "target": "127.0.0.1:57120" },
    { "pattern": "^/([sngbcdpu]_|notify|status|sync|cmd|dumpOSC|clearSched|error|quit)",
      "target": "127.0.0.1:57110" }
  ]
}
```

If a packet's address matches no `routes` entry **and** no
middleware claims it, drop with a `warn!` log naming the address.

#### Middleware dispatch

Two registries — outbound and inbound — each
`Vec<(Regex, Middleware)>` walked top-down. **Middleware first,
routing second, drop+warn third.**

```
Outbound (WS → bridge → UDP):
  1. peek_osc_address(payload)
  2. for (regex, mw) in outbound_middlewares:
       if regex.matches(address): outcome = mw.handle(ctx, …)
         Consumed              → stop
         ConsumedAndSend(b)    → route `b`; stop
         PassThrough           → break, fall through
  3. routes.route_for(address):
       Some(target) → UDP send
       None         → drop + warn

Inbound (UDP → bridge → WS):
  1. peek_osc_address(payload)
  2. for (regex, mw) in inbound_middlewares: …same shape…
  3. ws_sink.send(payload)  (default: forward as-is)
```

`MiddlewareOutcome::PassThrough` IS the "call next()" semantics.
Middlewares are a fixed in-tree set (~5 for Phase 37); enum dispatch
+ match avoids `dyn Future` boxing on the hot path.

#### Scope middleware bodies

Relocated from `ws_bridge.rs` and `scope/osc.rs` callsites into a
new `src-tauri/src/scope/middleware.rs`. The scope module owns its
middlewares; `server/middleware.rs` only owns the registry types.
`scope::register_middlewares(out, in, scope_mode)` is the seam
called at WS attach.

| Middleware | Direction | Address regex | Behavior |
|---|---|---|---|
| `ScopeSubscribe` | outbound | `^/scope/subscribe$` | Phase 37: also handles 0x01 binary frame via the same body. Phase 38 unifies on the OSC address. |
| `ScopeUnsubscribe` | outbound | `^/scope/unsubscribe$` | Same dual-input shape. |
| `ScopeChunkEmitOnTick` | inbound | `^/clock/tick$` | SHM mode only. Polls SHM for active subs, emits 0x03 chunks. PassThrough so tick still reaches WS. |
| `ScopeBgetnIssueOnTick` | inbound | `^/clock/tick$` | OSC mode only. Issues `/b_getn` for each active sub. PassThrough. |
| `ScopeInterceptBsetn` | inbound | `^/b_setn` | OSC mode only. Bufnum match → `ConsumedAndSend(chunk_bytes)`. No match → PassThrough. |

### Files

| File | Change |
|---|---|
| `src-tauri/Cargo.toml` | Add `regex = "1"` direct dep. |
| `src-tauri/src/config.rs` | `Route { prefix }` → `Route { pattern }`. Starter seeds the two regex entries. Migration: detect `prefix`-shaped configs on load and fail loudly with a one-line migration message. |
| `src-tauri/src/server/routing.rs` | `RoutingTable { routes: Vec<(Regex, SocketAddr)> }`. Compile regexes once in `build()`. `route_for(address) -> Option<SocketAddr>`. Drop `default_target()` and `set_default()`. |
| `src-tauri/src/server/session.rs` | `Session::create` takes `scsynth_addr: SocketAddr` explicitly. |
| `src-tauri/src/server/middleware.rs` | New. `MiddlewareOutcome`, `WsCtx`, `OutboundMiddleware`, `InboundMiddleware`, `MiddlewareRegistry`, async dispatch fn. |
| `src-tauri/src/scope/middleware.rs` | New. Scope middleware bodies relocated from `ws_bridge.rs`. |
| `src-tauri/src/server/ws_bridge.rs` | Recv loop + broadcast forwarder both call into dispatch. 0x01/0x02 first-byte branch stays in 37 but delegates to the scope middleware functions. `forward_default_route` + `forward_broadcast` collapse into `forward_with_dispatch`. |
| `src-tauri/src/cli/{bridge,gui,mod}.rs` | Drop `--scsynth` CLI flag (regex routes table is the source of truth). |

### Acceptance criteria

- `cargo test --lib` green; new tests for regex routing
  (no-match → None, first-wins, anchor edges) + middleware dispatch
  (`Consumed` suppresses, `PassThrough` falls through,
  `ConsumedAndSend` swaps).
- `cargo build`, `yarn tsc`, `yarn test`, `yarn build` clean.
- Manual smoke: `yarn dev:full`, take a scope, observe chunks. Wire
  format unchanged in 37; behavior bit-identical to pre-37.

### Cross-cutting risks

- **Middleware-first ordering inverts the existing intercept order.**
  Today `ws_bridge.rs` peeks for `/clock/tick` IN THE FORWARDER and
  forwards OSC first then runs side-effects. Middleware-first means
  side-effects run *before* the forward — but `PassThrough` continues
  the forward, so net behavior is the same. Verify in smoke testing
  the worker's clock-watchdog still anchors freshness on the OSC
  decode path.
- **Regex compile cost on hot path.** Compile once at `build()`; the
  per-packet cost is `Regex::is_match` on each entry until a hit.
  At ~50 Hz steady state with ~5 middlewares + 2 routes, this is
  irrelevant. Document the cost model.
- **Dispatcher running in two tokio tasks.** Recv loop runs the
  outbound dispatcher; broadcast forwarder runs the inbound
  dispatcher. Both hold `Arc<TokioMutex<ScopeContext>>` per WS. No
  shared mutability beyond what already exists.

### Sub-phases

- **37a** — Regex routing (config.rs, routing.rs, session.rs
  refactor, drop `--scsynth`). Scope code still uses ws_bridge.rs's
  inline 0x01/0x02 handling. Acceptance: bridge boots with new
  config schema; routing tests green.
- **37b** — Middleware dispatch infrastructure
  (`server/middleware.rs`). Stub registries (no entries yet);
  dispatcher fn callable from ws_bridge.rs but not wired in.
  Acceptance: dispatch tests green.
- **37c** — Relocate scope handlers to `scope/middleware.rs`; wire
  ws_bridge.rs to call dispatch on every recv + every broadcast
  payload. Binary 0x01/0x02 first-byte branch becomes a thin shim
  delegating to the scope middleware functions.

### Phase 38 preview (out of scope for 37)

Phase 38 will:
- Replace `encode_chunk` (binary 0x03) with `encode_scope_chunk`
  (rosc-encoded `/scope/chunk` OSC message; blob arg, big-endian
  floats).
- Flip outbound regexes from binary peek to `^/scope/subscribe$` /
  `^/scope/unsubscribe$`.
- Drop the first-byte peek in ws_bridge.rs; drop scopeWire.ts on
  the worker; add `parseScopeChunkReply` + builders to
  `packages/server-commands/src/commands/scope.ts`.

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
