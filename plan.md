# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`docs/history.md`](./docs/history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 35 — In-Band Scope Chunks** is in flight; spec below.
Phases 0–34 are in [`docs/history.md`](./docs/history.md). After
35 the next planned piece of work picks from the
[Future Improvements](#future-improvements) list.

---

## Phase 35 — In-Band Scope Chunks

**Goal.** Retire the per-scope `/ws/scope` WebSocket adopted in
the Phase 31 post-shipping refactor (commit `dfeb924`) and put
scope chunk delivery back on the main `/ws` connection,
multiplexed by a one-byte op tag. This is fundamentally
reverting `dfeb924` (which itself reverted the in-band design
shipped in `b23f3bf`), with one improvement: integer
subscription IDs in the wire format instead of length-prefixed
string `bufferId`s.

The per-scope WS gave us "subscription = WS lifecycle"
auto-cleanup at the cost of N WebSockets per session, separate
URL building, separate handshakes, separate Origin checks, and a
bigger worker-side state machine (per-bufferId WS map,
mainWsUrl capture, URL builder). For typical 1–4 active
subscriptions the trade-off is bad — the auto-cleanup property
isn't worth the protocol surface.

### What changes

**Wire format on the main `/ws`** — first byte discriminates:

| Byte | Direction | Meaning |
|---|---|---|
| `/` (0x2F) | both | OSC message |
| `#` (0x23) | both | OSC bundle (`#bundle\0`) |
| 0x01 | main → bridge | Subscribe |
| 0x02 | main → bridge | Unsubscribe |
| 0x03 | bridge → main | Chunk |

OSC always starts with `/` or `#`, so 0x01..0x03 are
unambiguous. Frame layouts (all little-endian, packed):

```
0x01 subscribe    [op:u8 | sub_id:u32 | scope:u32 | channels:u32 | chunk:u32]
0x02 unsubscribe  [op:u8 | sub_id:u32]
0x03 chunk        [op:u8 | sub_id:u32 | tick:u32 | is_gap:u8 |
                   channels:u8 | frames:u32 | float32 payload…]
```

`sub_id` is minted by the worker on subscribe — a monotonic
`u32` counter local to the worker. The worker keeps a small
`Map<sub_id, bufferId>` to dispatch incoming chunks back to the
main-thread fan-out. Saves ~30+ bytes per chunk vs the
string-id variant; the bridge never has to interpret the id,
just echo it.

### Files

**Bridge (re-introduce + delete):**

| File | Change |
|---|---|
| `src-tauri/src/server/ws_bridge.rs` | Add back per-WS `ScopeContext` (subscription map keyed by `sub_id`, lazy SHM ensure). On binary recv: peek first byte, route 0x01 / 0x02 to the scope handlers, otherwise existing OSC routing. In `forward_broadcast`: peek for `/clock/tick`; on hit, `read_scope_slot` for every active subscription on this WS, send 0x03 chunks for those whose `_stage` advanced. ~250 lines come back from `b23f3bf` (with sub_id replacing the string bufferId). **Explicit cleanup point:** the `ScopeContext` is owned by `handle_ws_session`'s scope; it drops when the function returns (WS closed). Subscriptions go with it. Add a debug log line at end-of-function naming the count of subscriptions cleaned up. |
| `src-tauri/src/server/ws_scope.rs` | **Delete.** No longer a route. |
| `src-tauri/src/server/mod.rs` | Drop `pub mod ws_scope;`, the `/ws/scope` route, and the now-unused `ws_scope::ws_scope_handler` import. |
| `src-tauri/src/server/session.rs` | `scope_shm: OnceCell<Arc<ScopeShm>>` stays. Now ensured by `ws_bridge` on first 0x01 frame on each WS. |
| `src-tauri/src/scope_shm.rs` | No changes — `read_scope_slot`, `MmapRegion`, `find_scope_buffer_array` all reused. |

**Worker:**

| File | Change |
|---|---|
| `src/workers/oscWorker.ts` | Drop `scopeWebSockets` map, `mainWsUrl` capture, `buildScopeWsUrl`, `openScopeWs`, `closeScopeWs`, `closeAllScopeWs`. Add `subIdByBufferId: Map<bufferId, sub_id>` and `bufferIdBySubId: Map<sub_id, bufferId>`. Add `nextSubId: u32` counter. On `subscribeBuffer`: assign `sub_id`, encode 0x01, send via main transport. On `unsubscribeBuffer`: encode 0x02, drop maps. On main WS recv (in `transport.onMessage`): peek first byte; 0x03 → decode chunk, look up `bufferId` from `sub_id`, post `bufferChunk` to main with the Float32Array transferred. Otherwise existing OSC decode path. |
| `src/workers/scopeWire.ts` | Rewrite as `encodeSubscribe(subId, sub)`, `encodeUnsubscribe(subId)`, `decodeChunk(bytes) → { subId, tickIndex, isGap, channels, frameCount, data }`. Was deleted in `dfeb924`; bring back with the integer-ID variant. |
| `src/server/workerProtocol.ts` | `BufferSubscription` and `BufferChunk` shapes unchanged — `bufferId` stays at the worker→main boundary; the wire format change is below the worker's API. |

**Frontend:**

Zero changes. `BufferHandle.subscribe(cb)`, `latestChunk`,
`release()` semantics are bit-identical. `WorkerClient.subscribeBuffer`
API doesn't change either — only the worker's internal
implementation.

**Tests:**

- `src/workers/sequencerPump.test.ts` and
  `clockWatchdog.test.ts` are unaffected.
- The Rust `security` tests are unaffected.
- One small new Rust test for the in-band routing primitive
  (peek first byte → dispatch correctly), borrowed from
  `b23f3bf`'s test set.

### WS-close cleanup audit (the explicit point)

Per-scope WS gave us "subscription = WS lifecycle"
auto-cleanup. The in-band design removes that property; we MUST
explicitly drop scope subscriptions when the main WS closes.
Concretely:

1. `ScopeContext` is a per-`handle_ws_session` value (not on
   the `Session`). When the function returns, it drops; the
   subscription map drops with it; nothing keeps polling SHM
   for that WS's subscriptions.
2. The `forwarder_tasks.abort()` loop already runs at
   end-of-function; the SHM-poll path lives in
   `forward_broadcast` (same task family), so aborting forces
   any in-flight SHM read to terminate at the next yield.
3. Add a `tracing::debug` line at the cleanup point naming
   `session_id` + count of subscriptions dropped, so the cleanup
   is visible in logs.
4. The `scope_shm: OnceCell` on the `Session` stays — other
   WSs on the same session keep using it. The mmap is dropped
   when the `Session` itself drops (TTL eviction or DELETE).

### Open questions

1. **Idempotency on duplicate subscribe.** If the worker sends
   two 0x01 frames for the same `sub_id` (shouldn't happen, but
   defensive coding), bridge should treat the second as a
   no-op. Easier: use `HashMap::insert` and trust the worker
   never duplicates. Recommendation: trust the worker;
   `tracing::warn` + ignore on the duplicate.
2. **Subscribe before SHM ensure.** First 0x01 frame triggers
   `Session::ensure_scope_shm` — if scsynth isn't local /
   layout finder fails, the call fails and we'd want to send
   some kind of error frame back. Simplest: log + ignore
   (subscription doesn't get installed; consumer never sees
   chunks; the existing `BufferManager.acquire` rejection
   path already covered the local-scsynth requirement at
   probe time, so this is a backstop).
3. **Order of operations on subscribe.** We need to install the
   subscription state BEFORE the next `/clock/tick` arrives or
   we miss the first chunk. Since both run in the same task
   (the WS recv loop and `forward_broadcast` are on the same
   `handle_ws_session` task tree), this is naturally
   serialised. No special handling needed.

### Acceptance criteria

- One main `/ws` WebSocket per session — Browser DevTools shows
  one connection, not 1 + N.
- `BufferHandle` consumer-facing API unchanged: same chunk
  shape, same `subscribe(cb)` semantics, same teardown order.
- WS close drops all that WS's subscriptions (verifiable via
  the new debug log line).
- Foreground audio + scopes + recording all work
  bit-identically with the current per-scope WS deployment.
- `cargo test`, `cargo build`, `yarn tsc --noEmit`, `yarn test`,
  `yarn build` all green.

### Sub-phase shape

One implementation commit. No 35a/b/c — the bridge changes,
worker changes, and `scopeWire.ts` rewrite are tightly coupled
(any one without the others breaks the wire). Plan + close
commits bracket the impl as usual.

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

> **Superseded by Phase 31.** The unified SHM transport
> retires the OSC `/b_getn` path entirely, taking the
> buffer-overwrite gap concern and the `late` warnings
> with it. Keeping the entry below for historical context.

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

> **Obsoleted by Phase 31.** No `/b_getn` requests left
> to dedup — the OSC buffer-data path is gone. Keeping
> the entry below as historical context.

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
