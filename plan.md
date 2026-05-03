# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`docs/history.md`](./docs/history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 31 — SHM Scope Ingestion** is in flight; spec below.
Phases 0–30 are in [`docs/history.md`](./docs/history.md).
After 31 the next planned piece of work picks from the
[Future Improvements](#future-improvements) list below.

---

## Phase 31 — SHM Buffer Ingestion (scopes + recordings)

**Goal.** Replace the OSC `/b_getn` data path entirely with a
shared-memory transport. The tap SynthDef writes audio via
`ScopeOut2` into scsynth's SHM scope-buffer pool; the Rust
bridge mmaps that segment and reads slots using the
triple-buffer protocol with **counter-based gap detection** —
producing recording-grade gap-free output, not just
visualization-grade snapshots. Frames are streamed to the
frontend over the existing WebSocket as a new binary message
type. The bridge polls SHM on every observed `/clock/tick`, so
the chunk-per-tick cadence is preserved bit-for-bit; scopes
and recordings see exactly the same data shape they do today.

The big simplification compared to the previous draft: scopes
and recordings unify onto a **single transport** (SHM). The
tap SynthDef's `BufWr` writer goes away — `ScopeOut2` is the
sole writer, with `scopeFrames = chunkSize` so each completed
slot maps 1:1 to one chunk. Phase 16's "shared tap layer"
stays intact, just simpler: one writer UGen, one transport,
one consumer model.

The user-visible payoffs:
- **No more `/b_setn` `late 0.0XX` warnings** on scsynth's
  console — the entire OSC data path for buffer reads is
  retired (`/b_getn` requests, `/b_setn` replies, all of it).
  Recording's drift-induced lateness goes away alongside the
  scope's, since they share the same transport now.
- **No more buffer-overwrite gap concern** that constrained
  Phase 30's `READ_DELAY_MS = 5`. The triple-buffer protocol
  gives the reader 2 slots of headroom (one being written, two
  completed); reader cadence has to keep up, but doesn't have
  to stay within a single tick interval.
- **Code reduction.** The worker's `pendingByOffset` /
  `reorderBuffer` / retry / timeout machinery for `/b_getn`
  goes away — the bridge's SHM reader replaces it. ~200 lines
  of TS deleted in `oscWorker.ts` alone.
- **Future-proofing.** SHM polling rate is independent of
  `/clock/tick`. Once 31 ships, smoother scope animation (60+
  Hz polling) is a one-line bridge config change.

### Why this is feasible now

- **Phase 30 moved infrastructure ownership to sclang.** The
  same template applies to scope-buffer-index allocation: sclang
  owns `s.scopeBufferAllocator`, and a new `/scope` OSC handler
  in the SuperDirt startup script can mint indices on request
  (mirroring how `/clock/hello` works).
- **Reference implementation exists.** Commit `b4139ea` from a
  sibling project (`src-tauri/src/scope_shm.rs`) ships a
  working SHM reader for scsynth on macOS — but only at the
  naive scan-and-cache level (visualization-grade). For Phase
  31 we need to extend that with the triple-buffer counter
  protocol; the mmap + offset-resolution scaffolding is reusable
  as-is.
- **`ScopeOut2` UGen spec is already correct.** This repo's
  `packages/synthdef-compiler/src/specs/buf_io.ts` has
  `ScopeOut2.numOutputs = 1` (the bug fix from `b4139ea`'s
  parent codebase landed in our UGen DB regeneration). No
  UGen DB work in this phase.

### Why "perfect data" is achievable (not just visualization)

The SC IDE's scope window uses ScopeOut2 + SHM and doesn't
drop samples in normal operation — proven mechanism. The
"naive scope" pattern that produces visualization-grade
tearing is a *reader* limitation, not a *transport*
limitation. With the proper protocol:

1. **Slot sizing.** `ScopeOut2(sigs, scopeNum, maxFrames =
   chunkSize, scopeFrames = chunkSize)`. Each completed slot
   = exactly one chunk's worth of audio.
2. **Triple-buffer protocol.** Three slots per scope buffer
   (writing, just-completed, previous). Writer atomically
   advances a "last completed" pointer + bumps a generation
   counter every time a slot fills. Reader observes the
   counter, reads the slot, observes the counter again — if
   unchanged, slot was read cleanly.
3. **Gap detection via the counter.** Reader tracks "last
   seen counter" per scope buffer. On each tick poll:
   - `delta = current_counter - last_seen_counter`.
   - `delta == 0`: no new slot yet (writer hasn't completed
     one since last poll — rare but possible if scsynth's
     audio thread stalled). Skip; don't emit a chunk.
   - `delta == 1`: normal case. Read the just-completed slot,
     emit one `scopeChunk`.
   - `delta > 1`: reader fell behind by `delta - 1` slots.
     Emit `delta - 1` synthetic zero-fill chunks with
     `isGap: true`, then read and emit the most-recent slot.
     Mirrors the existing OSC retry-exhaustion behaviour
     consumed by `RecordingController`'s gap log.
4. **Reader cadence.** Bridge polls on every `/clock/tick`
   it observes (already `/notify`'d for those). At default
   chunkSize/sampleRate the writer completes one slot per
   tick → reader consumes one slot per tick → no backlog.
   For pathological case where bridge is slow, the
   triple-buffer gives a 2-slot grace window before data is
   actually lost.

So "perfect" here means: **same correctness guarantees as the
current `/b_getn` path** (gap-free in normal operation; gaps
detected, surfaced via `isGap: true`, accumulated in the
recording's gap log on data-loss). The transport changes;
the consumer-facing API doesn't.

### Architecture

**Server side (sclang + scsynth):**

- The shared global clock at scsynth's root group is unchanged.
- A new sclang OSC route `/scope` (added to `config.json` →
  `127.0.0.1:57120`, same target as `/clock` and `/dirt`) hosts
  three responders:
  - `/scope/hello` → `/scope/info` reply: SHM segment path
    (platform-specific), max scope buffer count, slot size
    convention (`scopeFrames = chunkSize`).
  - `/scope/allocate` → `/scope/allocated <index>` reply: pulls
    the next free index from `s.scopeBufferAllocator`.
  - `/scope/free <index>`: returns the index to the allocator
    (fire-and-forget; no reply).
- The tap SynthDef (`bufferTapSynthDef.ts`) gets simplified
  to a single writer:
  ```
  In.ar(inBus, channels)
    → ScopeOut2(sigs, scopeNum, maxFrames=chunkSize,
                scopeFrames=chunkSize)
  ```
  No more `BufWr.ar`, no more `clockBus` reading (ScopeOut2
  manages its own slot timing internally). The `bufnum` synth
  control goes away too. Cache key drops the `(channels,
  chunkSize, ringHalves)` tuple to just `(channels, chunkSize)`
  since the SynthDef is structurally identical regardless of
  scopeNum (which is a /s_new control).
- `BufferController` no longer issues `/b_alloc` — there's no
  Buffer to allocate. The `bufnum` IdAllocator usage in this
  path goes away.

**Bridge side (Rust):**

- New module `src-tauri/src/scope_shm.rs`. Borrow the mmap
  scaffolding from `b4139ea` (file path discovery, mmap RAII
  wrapper) but the read path is new — implements the
  triple-buffer protocol with counter-based gap detection
  (see "Why 'perfect data' is achievable" above for the
  algorithm; reference SC's `ScopeBufferReader` C++ source if
  the Boost.Interprocess descriptor layout needs reverse
  engineering).
  - mmap the platform-appropriate SHM segment:
    - macOS: `/tmp/boost_interprocess/SuperColliderServer_<port>`
    - Linux: `/dev/shm/SuperColliderServer_<port>` (verify in
      31b — Boost.Interprocess uses POSIX `shm_open` on Linux,
      which surfaces in `/dev/shm`).
  - Per-scope-index reader state:
    - mmap region (shared across all subscriptions on the
      session).
    - Cached descriptor offset (resolved on first read by
      walking the Boost.Interprocess named-segment table for
      `scope_buffer_<idx>` or equivalent — TBD in 31b based
      on actual segment layout).
    - Last-seen generation counter.
  - On each poll: read counter; compute delta vs last-seen;
    emit zero-fill chunks for missed slots; read the
    most-recent-completed slot; update last-seen.
- New WS messages (worker ↔ bridge):
  - `subscribeShm { bufferId, scopeNum, channels, chunkSize }`
    — bridge starts polling SHM for that scope buffer index
    on every `/clock/tick` it observes; fans `bufferChunk`
    frames back over the WS.
  - `unsubscribeShm { bufferId }` — bridge stops polling,
    drops state.
- The bridge's per-tick poll triggers off observed
  `/clock/tick` replies (already `/notify`'d). No new timer.

**Worker + frontend:**

- `oscWorker.ts` simplifies dramatically. The
  `subscribeBuffer` / `unsubscribeBuffer` machinery goes away
  — replaced by `subscribeShm` / `unsubscribeShm` shaped the
  same way at the main-thread API level (`subscribeBuffer`
  exposed on `WorkerClient` keeps its signature, internally
  posts `subscribeShm` to the worker which forwards to the
  bridge).
- The worker's `pendingByOffset` map, retry/timeout logic,
  reorder buffer, skipFirstTick handling — all deleted.
  Bridge owns timing now; worker is just a fan-out shim
  (worker ↔ main fan-out by `bufferId` for `bufferChunk`
  events stays).
- `BufferManager.acquire(spec)` flow:
  - Allocate scope buffer index via `/scope/allocate`.
  - `/s_new` the tap synth with `scopeNum = <idx>`.
  - `WorkerClient.subscribeBuffer(spec)` posts `subscribeShm`
    to the worker (which forwards to the bridge).
  - On release: `unsubscribeShm`, `/n_free` the tap, send
    `/scope/free <idx>`.
- Main-thread consumers (`ScopeView`, `RecordingController`)
  see the same `bufferChunk` events they do today, with
  `data: Float32Array`, `tickIndex`, `isGap`. **Zero
  consumer-side code change** — the API is preserved
  bit-identically.

**Recordings:** consume the same `bufferChunk` stream as
scopes. The `RecordingController`'s WAV writer + envelope
buffer + gap log work exactly as today; only the data source
changed (SHM via bridge, not `/b_setn` via worker). Gap
detection semantics preserved: counter-skip → `isGap: true`
chunks → recording's gap log captures it.

**Fallback path** (open question — see below): if SHM is
unavailable (remote scsynth, exotic deployment), the simplest
option is to refuse acquires with a clear error message
("scsynth must be local for scopes/recordings"). Keeping the
old OSC `/b_getn` path as fallback would mean keeping all the
worker machinery we're trying to delete; the simplification
benefit collapses. **Recommendation: ship SHM-only; document
the local-scsynth requirement.**

### Files

**Backend / sclang:**

- `scripts/sc-app-superdirt-startup.scd`:
  - Add `OSCdef(\scAppScopeHello)`, `\scAppScopeAllocate`,
    `\scAppScopeFree` on `/scope/*` addresses.
  - Wrap `s.scopeBufferAllocator` (or whatever the actual
    sclang API is — verify in 31a; might be
    `Server.scopeBufferAllocator` class-side, or a
    per-server instance allocator).
  - Post `[sc-app] /scope/* responders installed` on
    startup.

**Bridge (Rust):**

- `src-tauri/src/scope_shm.rs` (new):
  - mmap RAII + path discovery from `b4139ea` (reusable).
  - **NEW**: triple-buffer-aware reader. Walks
    Boost.Interprocess managed-segment metadata to find
    scope-buffer descriptor by index. Reads generation
    counter, slot pointer, then slot data, then re-reads
    counter for tear detection. Returns
    `Option<(Vec<f32>, missed_slot_count)>` per poll.
  - Per-session subscription map: `HashMap<bufferId,
    SubscriptionState>` where SubscriptionState tracks
    last-seen counter + cached descriptor offset.
- `src-tauri/src/server/ws_bridge.rs` — handle
  `subscribeShm` / `unsubscribeShm` messages from the
  worker; tie subscription state to the WS lifecycle (drop
  on disconnect). On every observed `/clock/tick` (already
  in the inbound stream from scsynth), poll SHM for every
  active subscription on this WS, emit `bufferChunk`
  binary frames over the WS.
- `src-tauri/src/server/api.rs` — `GET /api/scope/probe`
  returns `{ available: bool, path: string | null }`. Used
  once at session attach for the SHM-availability check.
- `config.json` (project) + `Config::starter()` — add
  `{ "prefix": "/scope", "target": "127.0.0.1:57120" }`.

**Frontend:**

- `src/scope/scopeClient.ts` (new) — typed builders for
  `/scope/hello`, `/scope/allocate`, `/scope/free`; reply
  parsers; `probeScopeShm()` HTTP wrapper. Mirrors
  `clockClient.ts` shape. (Despite the name, recordings use
  this too — the prefix is `/scope/*` because that's the SC
  vocabulary; the consumer kind is irrelevant.)
- `src/synthdefs/bufferTapSynthDef.ts` — **substantial
  simplification.** Drop `bufnum` and `clockBus` controls;
  drop `BufWr.ar` and the `clockBus`-driven writeIdx math.
  Add `scopeNum` control + single `ScopeOut2(sigs,
  scopeNum, chunkSize, chunkSize)` UGen. Cache key:
  `(channels, chunkSize)`.
- `src/buffer/BufferController.ts` — drop `/b_alloc` and
  `bufnum` allocation. Drop `subscribeBuffer` /
  `unsubscribeBuffer` calls (replaced by
  `subscribeShm` / `unsubscribeShm` via the WorkerClient).
  Adds `/scope/allocate` round-trip on start, `/scope/free`
  on stop. Tap synth /s_new'd with `scopeNum = <allocated>`.
- `src/buffer/BufferManager.ts` — drop `bufferIds`
  IdAllocator (no more bufnums to allocate). Probe SHM
  availability at construction; refuse acquires with a
  clear error if SHM is unavailable (see open question 4).
- `src/server/WorkerClient.ts` —
  - `subscribeBuffer(spec, cb)` becomes a thin wrapper
    around `subscribeShm` (the public API stays the same;
    consumers don't care about transport).
  - The `BufferSubscription` type drops `bufnum` (no
    Buffer involved); adds `scopeNum`.
- `src/server/workerProtocol.ts` —
  - Replace `subscribeBuffer` / `unsubscribeBuffer`
    MainToWorker messages with `subscribeShm` /
    `unsubscribeShm` (which the worker forwards to the
    bridge as binary WS frames carrying the same
    information; the worker doesn't poll OSC anymore for
    buffer data).
  - `bufferChunk` WorkerToMain stays — same shape
    (`bufferId, data, tickIndex, isGap`).
- `src/workers/oscWorker.ts` — **biggest deletion.**
  - Drop `pendingByOffset`, `reorderBuffer`,
    `nextDeliverableTick`, retry policy, gap synthesis,
    skipFirstTick — all moved to bridge.
  - Drop `fireReads()` and the entire tick-driven
    `/b_getn` loop.
  - Drop `/b_setn` interception in `emitReply`.
  - New: receive bridge-emitted `bufferChunk` binary
    frames, dispatch to listeners by `bufferId`. ~50 lines
    of new code replacing ~300 lines of OSC
    machinery deleted.
- `src/recording/RecordingController.ts` — **no changes.**
  Consumes `bufferChunk` events the same way; gap log,
  WAV writer, envelope buffer all work as-is. (This is the
  payoff of the unified-transport design — the consumer
  layer is completely insulated from the transport
  rewrite.)
- `src/scope/ScopeController.ts` + `ScopeView.tsx` — no
  changes either, for the same reason.

### Open questions

1. **Linux SHM path.** macOS uses
   `/tmp/boost_interprocess/SuperColliderServer_<port>` (per
   `b4139ea`). Linux's Boost.Interprocess implementation uses
   POSIX `shm_open`, which typically surfaces under
   `/dev/shm/<name>`. Need to confirm scsynth's name format
   exactly. Worst case: probe both with `cfg!(target_os)`.
   **Verify in 31b on the Pi target before committing the
   path constant.**

2. **Boost.Interprocess descriptor traversal.** The mmap'd
   region isn't a flat array of scope buffers — it's a
   Boost.Interprocess `managed_shared_memory` segment with an
   internal allocator + named-segment table. To find scope
   buffer index N's descriptor, we need to walk that table.
   `b4139ea`'s naive offset-scan worked for visualization (it
   landed on whatever audio was there), but recording-grade
   reads must address the right buffer specifically.
   **Either**: (a) reverse-engineer the segment layout from
   SC's `SC_Scope.cpp` source — straightforward, the layout
   is small. (b) write a tiny C++ shim that uses
   Boost.Interprocess properly and FFI-call from Rust.
   **Recommendation: (a)** — keeps the bridge in pure Rust;
   the segment layout is stable. Budget half a day for it
   in 31b.

3. **Counter location.** ScopeOut2's triple-buffer state
   includes a write counter (or sequence number) — somewhere
   in the descriptor. Need to identify the exact field. SC's
   server code in `SC_Scope.cpp` has `mGenerationCount`
   (or similarly named) — read once during 31b's
   reverse-engineering. **No decision needed up front; falls
   out of #2.**

4. **SHM unavailable — fail or fallback?** Cases where SHM
   doesn't work:
   - scsynth running on a different machine from the bridge
     (no shared filesystem).
   - SHM segment permission issue.
   - scsynth boot config disabling SHM (rare; possible).
   The previous draft of this plan kept the OSC `/b_getn`
   path as fallback. The unified-transport design relies on
   deleting that path's machinery. Three options:
   - **(a) SHM-only.** Refuse acquires with a clear error
     when SHM is unavailable; document the local-scsynth
     requirement.
   - **(b) Keep the old worker code as a fallback path.**
     Significantly less code reduction; both paths exist.
     The benefit shrinks (the goal was simplification).
   - **(c) Bridge-side OSC fallback.** Bridge does the
     `/b_getn` loop instead of the worker; emits the same
     `bufferChunk` frames. Worker doesn't change shape. But
     this is most of FI #10's work, dragged into 31.
   **Recommendation: (a)** — sc-app deployments all have
   local scsynth (Tauri colocation, Pi systemd colocation,
   `yarn dev:full` colocation). Document the constraint.
   If a remote-scsynth use case ever appears, revisit.

5. **Per-scope index vs shared-per-spec.** Current Phase 16+
   layer shares one tap per `(inputBus, channels, chunkSize)`.
   Two consumers on the same bus → one tap, frames fanned out
   client-side. With SHM, do they share one scope buffer index
   or get one each? **Recommendation: share — same
   `(inputBus, channels, chunkSize)` key produces one scope
   buffer index, fanned out to N listeners client-side via
   the existing fan-out shim in `WorkerClient`.** Matches
   pre-31 semantics; minimizes scopeBufferAllocator
   pressure.

6. **scopeBufferAllocator capacity.** sclang's allocator has
   a finite capacity (typically 128 or 256, depending on
   scsynth's boot config). With a small number of unique
   `(inputBus, channels, chunkSize)` tuples, this is plenty.
   But pathological cases (many sessions × many distinct
   bus configs) could exhaust. **Recommendation: surface OSC
   `/fail` from `/scope/allocate` cleanly via
   `ServerErrorBus`; toast to the user "no more scope
   buffers available — close some scopes/recordings". Not a
   showstopper for typical use.**

7. **Update cadence.** Initial implementation: bridge polls
   SHM on every `/clock/tick` it observes (already
   `/notify`'d for those). At default chunkSize/sampleRate
   that's ~47 Hz — same as the pre-31 `/b_setn` cadence.
   Future: add an optional `pollHz` field to `subscribeShm`
   so individual scope consumers can request 60–120 Hz for
   smoother visualization. **Recommendation: ship with
   tick-rate-only in 31; expose configurable rate as Future
   Improvement once 31's plumbing is in.**

8. **Tap synth ordering invariant.** Pre-31 the tap synth had
   to be in the parent group at-or-after the producer synth
   (control-block order). With ScopeOut2, the same holds —
   ScopeOut2 just reads the input bus on each control block
   and writes to SHM. Producer-before-consumer ordering is
   preserved. **No change to existing CLAUDE.md "Group
   ordering invariant" language; the `clockBus` part
   becomes irrelevant since the tap doesn't read it
   anymore.**

9. **What happens to the worker's purpose?** Pre-31 the
   worker owned (a) the WebSocket, (b) OSC encode/decode,
   (c) the buffer subscription state machine, (d) the fan-out
   to main-thread listeners. After 31: (a) and (b) stay (we
   still send `/dirt/play`, receive `/clock/tick` for
   freshness watchdogs, etc.); (c) moves to the bridge; (d)
   stays. The worker becomes thinner but is still load-
   bearing. **No worker deletion in 31; just simplification.**

### Acceptance criteria

- **Zero `late 0.0XX` warnings on scsynth's console** during
  steady-state operation with one or more scopes/recordings
  active. The OSC `/b_getn` path is gone; the only OSC
  buffer-control traffic remaining is one-shot `/scope/*`
  allocate/free round-trips at acquire/release.
- **Recording quality bit-identical to pre-31.** Run a
  test-tone synth (known signal — sine, sweep, white noise),
  record for N minutes via the SHM path, compare WAV against
  a reference from the pre-31 OSC path. Sample-level
  identical (modulo gap-fill behaviour, which should be
  zero gaps in normal operation).
- **Gap detection works correctly under induced load.** Run
  scsynth on a busy machine (high CPU saturation), verify
  that when the writer outpaces the reader, gaps surface as
  `isGap: true` chunks in the recording's gap log — same
  behaviour as the pre-31 retry-exhaustion path.
- **Two tabs scoping/recording the same bus.** One tap, one
  scope buffer index, one SHM poll loop; frames fanned to
  both tabs. (Worker-side fan-out preserves Phase 16+
  shared-tap semantics.)
- **Session reconnect after sclang restart.** Probe re-runs;
  new scope buffer indices allocated; behaviour resumes
  cleanly (consumers re-acquire their handles transparently).
- **Disconnect.** Scope buffer indices all freed via
  `/scope/free`; no leak in sclang's allocator (verify by
  asking sclang to dump its allocator state, or by repeated
  reconnect cycles confirming no exhaustion).
- **Pi (Linux) + macOS dev: both work end-to-end** with no
  platform-conditional behaviour the user can perceive.
- **Code reduction visible.** `oscWorker.ts` shrinks by
  ~200+ lines (the `/b_getn` machinery deleted). Net diff
  for the phase should be deletion-heavy in TS, even after
  accounting for the Rust additions.

### Cross-cutting risks

- **Boost.Interprocess descriptor reverse-engineering.** Most
  load-bearing piece. If the segment layout is harder to
  parse than expected (e.g., uses templated allocators that
  vary by compiler), 31b stalls. Mitigation: have a fallback
  plan to use a small C++ shim that links Boost.Interprocess
  properly and exposes a C ABI for the bridge to FFI. Keeps
  the rest of 31's design intact; just the read primitive
  comes from C++ instead of pure Rust. Adds a build-time
  dependency we'd rather avoid but acceptable.
- **Linux SHM path discovery.** Real risk if scsynth's
  filename convention on Linux differs from macOS. Mitigate
  by probing under both `/dev/shm/` and `/tmp/boost_interprocess/`
  with clear log messages naming what's missing.
- **Counter monotonicity assumption.** Phase 31's gap
  detection relies on the writer's generation counter
  advancing monotonically. If scsynth's audio thread is
  killed and respawned (rare; happens on `s.reboot`), the
  counter could reset to zero. Reader would interpret as
  "writer skipped 2^32 slots" → flood of fake gaps. Mitigate:
  detect counter resets (large negative jumps) and treat as
  "writer restarted, re-anchor"; surface a one-time toast
  rather than a gap flood.
- **scopeBufferAllocator exhaustion.** sclang's allocator
  capacity (default ~128). Many sessions × distinct bus
  configs could exhaust. Surface `/fail` cleanly; offer
  graceful "no more scope buffers available" toast. Doesn't
  affect typical solo-dev workflow.
- **Recording fidelity vs pre-31.** Major change; needs
  thorough validation. The "bit-identical WAV against pre-31
  reference" criterion catches most regressions. Plan a
  proper test pass in 31e before merging.
- **Worker shrinkage breaking unrelated paths.** Deleting
  ~300 lines from `oscWorker.ts` could inadvertently break
  things that used `/b_setn` for one-shot reads (e.g., dev
  probes, debug commands). Audit `oscWorker.ts` for any
  non-tick-driven `/b_getn` consumers before committing
  the deletion. Likely none, but worth checking.

### Sub-phases

- **31a — sclang `/scope` OSC handler.** Add the three
  responders + `s.scopeBufferAllocator` integration. Test
  via `oscdump` or a hand-rolled OSC client. Backend-only,
  no Rust or frontend changes.

- **31b — Rust SHM reader (the load-bearing one).** Port
  `b4139ea`'s mmap scaffolding; **add the triple-buffer
  protocol with counter-based gap detection** (the new
  work). Reverse-engineer Boost.Interprocess descriptor
  layout from SC source (`SC_Scope.cpp`); document layout
  in code comments for future-us. Verify Linux path on the
  Pi target. Add `GET /api/scope/probe`. Output of this
  phase: a Rust function `read_scope_slot(idx) -> Option<(Vec<f32>, missed_count)>`
  that's correct under the gap-detection criterion. Tested
  by running ScopeOut2 with a known signal and confirming
  the Rust side reads it back sample-accurately.

- **31c — Bridge `subscribeShm` protocol + tick-driven
  poll loop.** New WS message types, per-WS subscription
  state, poll triggered by observed `/clock/tick`. Frames
  emit as binary WS messages with a small header
  (`bufferId, tickIndex, isGap, channels, frameCount`)
  followed by the float32 payload. Tested via a CLI client
  (or a dedicated test fixture) that subscribes, decodes,
  and verifies payload shape.

- **31d — Tap SynthDef rewrite + frontend acquire path.**
  Drop `bufnum` / `clockBus` / `BufWr`; add `scopeNum` /
  `ScopeOut2`. `BufferController` now does
  `/scope/allocate` instead of `/b_alloc`; tap /s_new'd
  with `scopeNum`; `subscribeShm` posted to worker which
  forwards to bridge. End-to-end smoke test with one scope
  on one bus.

- **31e — Worker simplification + recording validation.**
  Delete the OSC `/b_getn` machinery from `oscWorker.ts`
  (`pendingByOffset`, `reorderBuffer`, retry, gap synthesis,
  fireReads). Run a thorough recording validation pass —
  test-tone in, WAV out, sample-level diff against pre-31
  reference. Confirm gap detection works under induced
  load. Final cleanup: delete `bufferTapSynthDef.ts`'s old
  `BufWr`-based logic, IdAllocator usage for bufnums, etc.

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
   Phase 5 / 8 gotchas in `docs/history.md`). The original plan had
   it inverted; verified empirically.
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
10. **Parent group placement at root.** `AddToTail` of the root
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
- `SequencerController` (post-Phase-27) — feed a fake clock,
  assert the schedule queue against expected `dirtClient.play`
  calls.

Vitest is already set up in workspace packages.

**Cost:** ~1 day.

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
