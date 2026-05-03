# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`docs/history.md`](./docs/history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 36 — OSC Fallback for Scope Data** is in flight; spec
below. Phases 0–35 are in [`docs/history.md`](./docs/history.md).
After 36 the next planned piece of work picks from the
[Future Improvements](#future-improvements) list.

---

## Phase 36 — OSC Fallback for Scope Data

**Goal.** Restore a `/b_getn`-based fallback path for
scope/recording when SHM isn't accessible (remote scsynth on a
different machine, scsynth booted with SHM disabled, exotic
deployment). Pre-Phase-31 the OSC scope-data path lived in the
TS worker; per the post-35 design discussion, the new fallback
lives in the Rust bridge so the worker stays uniform.

The frontend can't be entirely mode-blind — the SC side has to
write the data somewhere the bridge can read it, and SHM-write
(`ScopeOut2.ar`) vs OSC-fallback-write (`BufWr.ar`) are
different UGens, hence different SynthDefs. Frontend branches
at the SynthDef + buffer-allocation step. The wire format on
`/ws` (0x01/0x02/0x03) and the worker stay uniform; the bridge
picks SHM or OSC poll under the hood.

### Architecture

```
At session create:
  Bridge probes /tmp/boost_interprocess/SuperColliderServer_<port>
  → Session.scope_mode = ScopeMode::Shm | ScopeMode::Osc
  /api/scope/probe response gains a `mode` field

At BufferManager.acquire():
  Frontend reads probe.mode (cached at bootstrap)
  if Shm:
    /scope/allocate → /s_new bufferTap (ScopeOut2.ar) → 0x01 subscribe
    bridge polls SHM on /clock/tick                  → 0x03 chunks
  if Osc:
    /b_alloc → /s_new bufferTapOsc (BufWr.ar)        → 0x01 subscribe
    bridge polls /b_getn on /clock/tick (intercepts
    /b_setn replies, parses, encodes)                 → 0x03 chunks
```

### The clockBus question

Pre-31 the OSC tap synth used a `clockBus`-driven `Phasor.ar`
to derive a sample-aligned `writeIdx` that wraps every
`2 × chunkSize` samples. `clockBus` was published by the
shared `\scAppClock` synth. We retired it in a post-34 tidy
because nothing read it anymore. **Phase 36 brings it back
unconditionally** — sclang's clock SynthDef adds the Phasor +
`Out.ar(clockBus, …)` again. SHM mode ignores it; OSC mode
reads it. Cost on scsynth's side: one `Out.ar` per audio block,
~zero. Update history.md Phase 30's "post-cleanup" footnote to
reflect the revival rather than rewriting the cleanup.

Local-Phasor alternative was considered and rejected: pre-31
attempts confirmed the kr/ar parity slop that breaks
recording-grade alignment, and we don't want a degraded
fallback for recordings.

### Files

**Bridge:**

| File | Change |
|---|---|
| `src-tauri/src/server/session.rs` | `Session` gains `scope_mode: ScopeMode` (probed once at create). `Session::create` accepts a `force_osc_mode: bool` from `AppState` so the `--no-shm` flag can override SHM-availability detection. |
| `src-tauri/src/server/api.rs` | `/api/scope/probe` extends to `{ available, path, error, mode: 'shm' \| 'osc' }`. The `mode` is read from `Session::scope_mode` (per session) when available, else from a fresh probe. |
| `src-tauri/src/server/mod.rs` + `cli/bridge.rs` | New `--no-shm` CLI flag; flows into `AppState.force_osc_mode`. Useful for testing OSC fallback without disabling SHM at the OS layer. |
| `src-tauri/src/scope_osc.rs` (new) | OSC poll engine: per-WS subscription map (sub_id → bufnum + ring state + pendingByOffset + reorderBuffer); on each `/clock/tick` issues `/b_getn`; `/b_setn` replies are intercepted from the broadcast stream, parsed, encoded as 0x03 chunk frames. Reorder buffer drains in tick order. |
| `src-tauri/src/server/ws_bridge.rs` | `ScopeContext` gains a `ScopeMode` tag. The recv loop's 0x01/0x02 handlers branch on mode. The default-route forwarder (`forward_default_route`) dispatches: SHM → existing `poll_scope_chunks`; OSC → `osc_poll_emit` (issue /b_getn) + filter `/b_setn` replies (intercept if matching a subscribed bufnum, otherwise forward). |
| `src-tauri/src/scope_shm.rs` | No change. `read_scope_slot` still serves SHM mode. |

**Frontend:**

| File | Change |
|---|---|
| `src/synthdefs/bufferTapOscSynthDef.ts` (new) | Pre-31 BufWr-based tap, ported. Reads `clockBus`, derives `writeIdx = (clockPhase % (2 × chunkSize))`, `BufWr.ar(sigs, bufnum, writeIdx)`. Compiled per `(channels, chunkSize)`; cached at module scope. |
| `src/synthdefs/bufferTapSynthDef.ts` | Unchanged (ScopeOut2-based — SHM mode). |
| `src/buffer/BufferManager.ts` | Probe at construction returns `{ available, mode }`. Drop the "reject if unavailable" path — both modes are now valid. Pass `mode` to controllers via `BufferControllerOptions`. |
| `src/buffer/BufferController.ts` | Branches on `mode` at `start()`. SHM path = today. OSC path: `/b_alloc` (allocates `2 × chunkSize × channels`-frame buffer via the resurrected `IdAllocator(buffer)`) → `/s_new bufferTapOsc` with `bufnum, clockBus` → worker `subscribeBuffer({ scopeNum: bufnum, … })`. Dispose: `/n_free` → `/b_free`. The wire-protocol `scopeNum` field is reused as `bufnum` in OSC mode (bridge interprets per-session mode). |
| `src/clock/clockClient.ts` | `ClockInfo` regains `clockBus: number` (which sclang now publishes again). |
| `src/clock/ClockController.ts` | Re-add `clockBus` getter. |
| `src/AppShell.tsx` | Resurrect `IdAllocator(buffer)` (one allocator per session, base = `clientId * 1_000_000 + 5000` to leave space below for nodes). Pass to `BufferManager` via options. The clock attach log line gains `clockBus` again. |
| `src/scope/scopeClient.ts` | `ScopeShmProbe` type extends with `mode: 'shm' \| 'osc'`. |

**Worker:** **no changes.** The 0x01/0x02/0x03 wire format is identical; the worker is mode-blind.

**sclang startup script:** `scripts/lib/clock.scd` — bring back `Bus.audio(s, 1)` allocation, the `Phasor.ar` + `Out.ar(clockBus, …)` inside the SynthDef, the `clockBus` argument in `/s_new`, and the `clockBus` field in `/clock/info`. Also restores the boot-log line that includes the bus index.

### Open questions (resolved)

1. **clockBus revival.** Option 1 (unconditional). One `Out.ar` per audio block on scsynth — negligible.
2. **Mode selection.** Per-session. Probed at `Session::create`; cached on the `Session` struct; same mode for every WS / every subscription on that session.
3. **`/b_setn` interception.** The bridge filters `/b_setn` replies per-WS by matching the bufnum against the active subscription map. Matching: intercept (encode chunk, don't forward). Non-matching: forward to the WS as a regular OSC reply (worker discards — pre-31 behavior).
4. **`/b_setn` correlation under high load.** Port the pre-31 `pendingByOffset: HashMap<offset, PendingRead>` shape to Rust; ring-half tracking via tickIndex parity (read from the broadcast'd `/clock/tick` payload's `args[2]`).
5. **`READ_DELAY_MS = 5 ms`.** Same constant as pre-31. `/b_getn` issued in an `OSC.Bundle` with `timetag = Date.now() + 5ms` so scsynth's scheduler holds the read past the kr/ar slop.
6. **`IdAllocator(buffer)` revival.** Base `clientId * 1_000_000 + 5000`. Allocated only in OSC mode but constructed unconditionally (cheap).
7. **`--no-shm` CLI flag.** Yes — useful for testing. Forces OSC mode at session create regardless of probe result.
8. **Per-WS forwarding of `/b_setn`.** Subscription state is per-WS, not per-session, so the bufnum-filter has to be per-WS. Per-WS forwarder already inspects each broadcast payload (for `/clock/tick`); we extend that inspection.

### Sub-phases

- **36a — Probe + mode advertisement (no behavior change).** Bridge probes SHM at `Session::create`; stores in `Session::scope_mode`. `--no-shm` CLI flag plumbed through `AppState.force_osc_mode`. `/api/scope/probe` returns the new `mode` field. clockBus revived in sclang's clock SynthDef. Frontend `ClockController.clockBus` getter restored; `ScopeShmProbe.mode` plumbed into `BufferManager`. **No functional branching yet — `BufferManager` keeps rejecting when `available: false`.** Lands the surface area; nothing changes for end users.
- **36b — Bridge OSC poll engine.** New `src-tauri/src/scope_osc.rs` with the `/b_getn` issue + `/b_setn` parse + ring-half tracking. Wire into `ws_bridge.rs`'s `ScopeContext` as the alternative branch. Rust unit tests for the parse + ring + reorder logic. **Not triggered in real flow until 36c** — the bridge has the engine but no frontend uses OSC mode yet.
- **36c — Frontend OSC SynthDef + BufferController split.** New `bufferTapOscSynthDef.ts`. `BufferController.start()` branches on mode. `IdAllocator(buffer)` resurrection. End-to-end smoke test using the `--no-shm` flag against a local scsynth.
- **36d — Perf table + close.** Update CLAUDE.md's chunkSize × sampleRate table to distinguish SHM and OSC mode (SHM has no practical cap until ~kHz; OSC caps at the historical 250 Hz). Move Phase 36 to history.md. Refresh `docs/architecture.md` for the dual-mode reality.

### Acceptance criteria

- `/api/scope/probe` reports `mode: 'shm' | 'osc'` correctly across:
  - Local scsynth, no `--no-shm` → mode=shm
  - Local scsynth + `--no-shm` flag → mode=osc (forced)
  - SHM file unreadable / wrong permissions → mode=osc (auto-fallback)
- Frontend takes a scope on a synth bus, sees waveform — in BOTH modes.
- 60 s recording in OSC mode produces a WAV bit-identical to SHM mode (modulo timing jitter; gap log compares).
- The 250 Hz cap is observably real in OSC mode (chunkSize=128 at 48k → fine; chunkSize=64 at 48k → noisy `late` warnings on scsynth's console).
- `cargo test`, `yarn test`, `yarn tsc --noEmit`, `yarn build`, `cargo build` all green.

### Cross-cutting risks

- **OSC poll engine is timing-sensitive code we deleted for good reasons.** Re-implementing in Rust risks the same gap-bug pattern from Phase 12. Mitigation: thorough unit tests for ring math + reorder buffer in 36b; smoke-test in 36c at multiple chunkSize/sampleRate combinations.
- **`/b_setn` UDP fragmentation on real networks.** OSC fallback puts every chunk on UDP. At chunkSize=1024 stereo / 48k = ~370 KB/sec, UDP fragmentation is a real risk for non-loopback deployments at high tick rates. Document the cap; ship.
- **clockBus revival regresses the post-34 tidy.** Acceptable cost. We document the reversal in history.md (the post-34 tidy was right at the time; OSC fallback brought back the consumer).
- **Two-SynthDef branching in BufferController.** Risk of subtle bugs at the path-selection boundary. Mitigation: shared dispose logic; mode is an immutable property of the controller (set at construction, never changes).

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
