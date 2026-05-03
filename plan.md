# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`docs/history.md`](./docs/history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 32 — Worker-Side Sequencer Pump** is in flight; spec below.
Phases 0–31 are in [`docs/history.md`](./docs/history.md). After 32
the next planned piece of work picks from the
[Future Improvements](#future-improvements) list.

---

## Phase 32 — Worker-Side Sequencer Pump

**Goal.** Move the sequencer's pump loop off the main thread's
`setInterval(25 ms)` and into the existing OSC worker, where browser
tab throttling does not apply. `SequencerController` keeps its current
public API and reactive stores; the timing-critical work hops behind
`postMessage` into a new `sequencerWorker.ts` module folded into the
existing worker context (so it can call `transport.send()` directly
without a second postMessage hop).

No new "scheduler" primitive, no registry of pump tasks. The sequencer
is the only consumer today that needs sample-accurate emission
through a wall-clock timer; if a second consumer ever appears, we
extract a shared abstraction from two real cases rather than guessing
its shape now.

### User-visible payoffs

- **No audio dropouts when the tab is backgrounded.** Chromium
  clamps main-thread `setTimeout` / `setInterval` to ~1 Hz on
  hidden tabs; web workers are not throttled. Today the sequencer's
  bundles fall behind their target ticks once the tab loses focus
  and scsynth either logs `late` or drops them. After 32 the
  pump runs in the worker and keeps feeding scsynth bundles ahead
  of time.
- **Same UI surface.** `SequencerPanel` reads the same reactive
  stores (`activeIndex`, playhead). Backgrounded-tab playhead
  lag is accepted — the audio stays correct; the UI catches up
  on refocus.
- **Module boundary cleanup.** A future "high-level music
  construct" can either follow the same controller + worker-
  counterpart pattern (precedent set by `ClockController` for
  `/clock/tick`, by `WorkerClient` for OSC, and now by
  `SequencerController`), or motivate extracting a generic
  scheduler when a second case shows up.

### Architecture

```
SequencerController (main)               sequencerWorker.ts (new, folded into oscWorker)
─────────────────────                    ─────────────────────
PatternBank live ref                     State: bank snapshot, clock snapshot,
.start() ───sequencerStart───▶                  isGroupPaused flag,
.stop()  ───sequencerStop────▶                  pump setInterval (25ms),
.setGroupPaused(b) ──────────▶                  playhead, lookahead heap
on bank change ──snapshot────▶
on clock change ──snapshot───▶           Pump tick (in worker):
                                          - read clock snapshot, compute nowTick
playhead store ◀──stepFired──             - drain events with fireAtTick ≤ nowTick+horizon
cycle boundary ◀─cycleBoundary            - encode /dirt/play OSC + bundle with timetag
  (advances bank.activeIndex)             - transport.send() (direct call, same worker
                                            context — no postMessage hop for OSC bytes)
                                          - postMessage stepFired { stepIndex, tick }
```

Same shape as `WorkerClient` (main proxy) ↔ `oscWorker` (bytes layer),
or `ClockController` (main observer) ↔ the worker's `/clock/tick`
mux. We're adding another responsibility behind its own message
namespace; not a new worker.

### What moves where

- **From `src/sequencer/scheduler.ts pump()` → `src/workers/sequencerWorker.ts`:**
  - `LOOKAHEAD_HORIZON_TICKS`, `SUPERDIRT_SAFETY_LOOKAHEAD_MS`,
    `INITIAL_LOOKAHEAD_TICKS`
  - `tickToTimetag` math (osc-js works in worker via the existing
    `workerBootstrap` `window` shim)
  - `/dirt/play` message construction + bundle wrapping
  - The `setInterval(25)` itself
- **From `SequencerController` (deletion):**
  - `setInterval(this.pumpOnce, 25)` setup in `start()`
  - The pump implementation
- **`SequencerController` keeps:**
  - Public API: `start()`, `stop()`, `setGroupPaused()`, observable stores
  - PatternBank live reference (UI binding)
  - On bank / clock / pause changes: snapshot and post to worker
  - On `stepFired` from worker: update playhead store
  - On `cycleBoundary` from worker: advance `bank.activeIndex`
    (chain mode), then post the new snapshot back

### Files

- `src/workers/sequencerWorker.ts` (new) — pump loop, OSC bundle
  encoding, posts `stepFired` and `cycleBoundary`. Imports
  `transport` from the host `oscWorker.ts` module to send bytes
  without the `send` postMessage hop.
- `src/workers/oscWorker.ts` — wires new message handlers
  (`sequencerStart`, `sequencerStop`, `sequencerBankUpdate`,
  `sequencerClockUpdate`, `sequencerPauseUpdate`) into the existing
  switch.
- `src/sequencer/SequencerController.ts` — rip out
  `setInterval`/`pumpOnce`. Replace with `client.startSequencer(snapshot)`
  / `stopSequencer()`. Subscribe to `client.onStepFired()` and
  `client.onCycleBoundary()`. Bank- and clock-store subscriptions
  post snapshot updates.
- `src/sequencer/scheduler.ts` — likely deletable after fold-in.
  Keep only if a UI-side preview surface ends up reusing
  `computeNextEvents`.
- `src/server/workerProtocol.ts`:
  - `MainToWorker`: `sequencerStart`, `sequencerStop`,
    `sequencerBankUpdate`, `sequencerClockUpdate`,
    `sequencerPauseUpdate`
  - `WorkerToMain`: `stepFired { stepIndex, tick, firedAtMs }`,
    `cycleBoundary { fromIndex, toIndex }`
- `src/server/WorkerClient.ts` — typed wrappers + `onStepFired` /
  `onCycleBoundary` listeners.

No backend changes. The bridge sees the same OSC traffic.

### Open questions

1. **Bundle encoding location.** (a) main encodes pre-bundle messages
   to bytes, worker stamps timetag and sends; or (b) worker encodes
   everything from snapshot data. Recommendation: **(b)** — keeps the
   snapshot semantically clean (already the bank's serializable
   shape, no opaque bytes) and pure encoding works fine in worker.
2. **Snapshot diff vs full re-send on bank edits.** Recommendation:
   full snapshot. Bank is small (~few KB), postMessage is cheap.
3. **Cycle boundary advance.** Worker detects (it's the natural
   pump tick where one cycle's events have been consumed) and
   posts `cycleBoundary` → main advances `bank.activeIndex` → main
   posts new snapshot back. One postMessage round-trip; not
   audio-critical because next cycle's events are already buffered
   in the lookahead.
4. **Tab-refocus event burst.** Worker may have posted many
   `stepFired` events while throttled; they all flush on refocus.
   Cheap mitigation: in `SequencerController`, drop intermediate
   `stepFired`s and apply only the latest per render frame.
5. **`scheduler.ts` keep-or-delete.** Today only the worker needs
   the pump function. Recommendation: **fold** into
   `sequencerWorker.ts`. If a UI consumer surfaces (preview
   "what plays in the next bar"), promote back to a shared module.

### Acceptance criteria

- **Foreground audio parity with pre-32.** Same pattern, listen
  with the tab focused — audibly indistinguishable. Bonus: capture
  scsynth output, sample-diff vs baseline.
- **No audio gaps with the tab backgrounded.** Start a 4-bar loop,
  switch tabs, leave 60 s, refocus. Recorded scsynth output is
  uninterrupted. Today this fails.
- **Playhead catches up on refocus.** Within one render frame,
  the playhead snaps to the current step (latest `stepFired`
  applied; intermediate ones dropped per Q4).
- **Pause/resume works.** Toggle pause while running; OSC emission
  stops mid-cycle; resume continues from the next cycle. Existing
  `isGroupPaused` semantics preserved.
- **Bank edit during play.** Toggle a step while running; change
  takes effect within one cycle (lookahead-horizon delay, same
  as today).
- **At least one new test.** Per FI #5, sequencer was already on
  the test-coverage list. Add a `feed fake clock + bank → assert
  bundle sequence` test as part of 32 — easier before the worker
  hop than to retrofit after.

### Cross-cutting risks

- **PatternBank serialisation shape.** If the bank's reactive
  store value is not already plain-clonable (e.g. contains class
  instances), `postMessage` strips prototypes and the worker
  receives broken state. Audit in 32a; almost certainly already
  plain `{ activeIndex, patterns: Pattern[] }` POJOs, but verify.
- **Clock snapshot freshness.** Worker caches `tick0Ms`,
  `tickRate`, etc. from `ClockController.derived`. After an
  sclang restart + clock re-attach, the snapshot must be re-posted.
  `ClockController.derived` already fires on attach, so subscribing
  to it from `SequencerController` should be enough — verify.
- **postMessage ordering on burst flush.** Worker may flush many
  events at once on tab refocus. Fine for the playhead (visual);
  if a future consumer wants real-time main-thread firing of
  events, they'd need to design for re-ordering.
- **Test coverage debt.** Phase 32 reorganises the most timing-
  sensitive path in the app with no existing test net. The "add
  at least one unit test" criterion is not optional polish.
- **Worker lifecycle.** The worker dies when the WS dies (today's
  disconnect path tears down `WorkerClient`). Confirm the
  sequencer's `setInterval` is cleaned up in the same path —
  no leaked timer if the user disconnects mid-play.

### Sub-phases

- **32a — Protocol + stub worker handler.** Add `sequencerStart/Stop/...`
  message types + `stepFired` / `cycleBoundary` reverse messages.
  Wire `oscWorker.ts` to dispatch to a stub `sequencerWorker.ts`
  that just logs received messages. `SequencerController` not yet
  touched. Verify message flow end-to-end.
- **32b — Move pump logic into worker.** Port `pump()` +
  `tickToTimetag` + bundle encoding into `sequencerWorker.ts`.
  Worker emits OSC bundles via `transport.send()`.
  `SequencerController.start()` switches to posting `sequencerStart`
  instead of starting `setInterval`. Foreground-only audio parity
  pass.
- **32c — Wire `stepFired` / `cycleBoundary` back to UI.** Playhead
  ReadonlyStore driven by worker events; refocus-burst debouncing.
  Delete dead code (`pumpOnce`, main-thread `setInterval`,
  `scheduler.ts` if fully consumed).
- **32d — Backgrounded-tab validation + test.** Run the 60-second
  backgrounded-tab test. Add the unit test (FI #5 carryover).
  Confirm disconnect cleanup tears down the worker timer.

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
