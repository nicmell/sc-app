# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`docs/history.md`](./docs/history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 30 — Shared Audio Clock** is in flight; spec below.
Phases 0–29 are in [`docs/history.md`](./docs/history.md).
After 30 the next planned piece of work picks from the
[Future Improvements](#future-improvements) list — none is
blocked by anything currently shipped, so promotion to a numbered
phase is on demand.

---

## Phase 30 — Shared Audio Clock (sclang-owned)

**Goal.** One clock synth on scsynth, owned by sclang at startup,
living **outside every client's parent group**. All sc-app sessions
become passive observers — no `/s_new`, no `/n_free`, no
`start/stop/reset` on the clock. Multiple tabs (and any future
non-browser client) see the same `/tr` stream and can derive a
common audio-frame anchor, enabling sample-accurate cross-client
sync. The clock cannot be killed by any client's `/g_freeAll` or
`/n_free` because it isn't a child of their groups.

### Why

- **Cross-client sync.** Two tabs running sequencers can land steps
  on the same audio frame. Today each tab anchors its own
  `tick0Ms` from its own `/tr` arrival — delivery-latency variance
  guarantees ~1 ms misalignment between tabs.
- **Clock survives session churn.** Today a client's reload
  briefly tears down its clock synth (parent group is `g_freeAll`'d
  on session DELETE). A shared clock at scsynth root doesn't blink.
- **`clockBus` becomes a constant.** All tap synths across all
  sessions read the same bus — simpler `IdAllocator` math, no
  per-session bus allocation.
- **Removes the "any client can break everyone" footgun.** A
  misbehaving client cannot accidentally free the clock.

### Architecture

- **Owner: sclang** (the SuperDirt process, attached to scsynth).
  Compiles + `/s_new`s the clock synth in `s.doWhenBooted` of
  `scripts/sc-app-superdirt-startup.scd`. SynthDef compilation
  moves from `src/synthdefs/clockSynthDef.ts` (frontend) to a
  sclang `SynthDef.new`. The `Impulse.kr → SendTrig 1000` and
  `Phasor.ar → Out.ar(clockBus)` halves are unchanged in shape.
- **Fixed allocations.**
  - `clockBus = 16` — well past the hw-reserved range
    (numInputs + numOutputs = 4 in our config) and below any
    `IdAllocator` range. Reserved as a constant; `IdAllocator(bus)`
    must skip it.
  - `trigId = 1000` — already reserved as `CLOCK_TRIG_ID`, just
    moves from per-session-owned to globally-owned.
  - `clockNodeId = 999` (or similar high reserved value) — banned
    from `IdAllocator(node)` allocation across all clients.
- **Routing.** New OSC prefix `/clock` in `config.json` routes →
  `127.0.0.1:57120` (same target as `/dirt`, but a separate prefix
  for legibility and future-proofing). The bridge's existing
  prefix-match demux already handles new prefixes — no Rust code.
- **Hello round-trip.** `OSCdef(\scAppClockHello, …, '/clock/hello')`
  on the sclang side replies to `/clock/info` carrying
  `tickRate`, `chunkSize`, `sampleRate`, `clockBus`, `trigId`,
  and `currentTickIndex`. Lets a freshly-attached client populate
  `ClockDerived` without waiting for a `/tr`.
- **`/tr` propagation is free.** scsynth multicasts `SendTrig`
  replies to every UDP peer that has `/notify 1`'d. Each session's
  socket already does this in `Session::create`, so the clock's
  trigger fans out to all attached WS via existing per-session
  `tokio::sync::broadcast` channels. **No bridge changes required**
  for the trig path.

### Files (planned)

**Backend / sclang.**
- `scripts/sc-app-superdirt-startup.scd` — extend the
  `s.doWhenBooted` block to:
  - Compile and send the clock `SynthDef`.
  - Allocate `~scAppClockNode = 999`, `~scAppClockBus = 16`.
  - `Synth.new(\scAppClock, [\clockBus, ~scAppClockBus],
    target: RootNode(s), addAction: \addToHead)`.
  - `OSCdef(\scAppClockHello, …)` on `/clock/hello`.
  - Post `[sc-app] clock running on bus 16, trigId 1000`.
- `config.json` (project + starter) — add
  `{ "prefix": "/clock", "target": "127.0.0.1:57120" }`. Update
  `Config::starter()` so new installs land with the route. Old
  user-written configs without the route fail loudly on
  `/clock/hello` — document migration in CLAUDE.md.

**Frontend.**
- `src/clock/ClockController.ts` — major rewrite (constructor
  signature changes, public surface shrinks dramatically):
  - Remove: `start`, `stop`, `pause`, `resume`, `reset`, `dispose`'s
    `/n_free` path, `clockNodeId`, internal SynthDef load via
    registry, `clockBus` field (now a constant from `/clock/info`).
  - New: `attach()` async fn that fires `/clock/hello` and resolves
    on `/clock/info`. `tick0Ms` capture stays — it's still the
    first observed `/tr`'s arrival timestamp on the main thread.
  - `effectiveStateStore` collapses to two states: `'attached'` /
    `'detached'`. No more `'paused'` (clock is never paused) or
    `'stopped'` (clients don't own it).
- `src/clock/clockClient.ts` (NEW) — typed `/clock/hello` request
  + `/clock/info` reply parser. Mirrors the `dirtCommands.ts` shape.
- `src/synthdefs/clockSynthDef.ts` — **DELETE.** SynthDef lives in
  sclang now. Update `src/synthdefs/index.ts` exports.
- `src/server/SynthDefRegistry.ts` — drop the
  `compileClockSynthDef` registration call site (was in
  `setupDashboard`).
- `src/AppShell.tsx` / `setupDashboard` — adapt:
  - Don't allocate `clockBus` from `ids.bus`. Read from
    `/clock/info`. Pass to `BufferManager` constructor as a
    constant.
  - Don't pass `chunkSize` into `setupDashboard` from the
    frontend dropdown. Read from `/clock/info`.
  - `ClockController` instantiation simplifies — no `nodeIds`, no
    `bufferIds`, no `clockBus` arg.
- `src/ui/header/HeaderChunkSizeDropdown.tsx` (or wherever) —
  **delete the dropdown** (Phase 30c). chunkSize becomes a
  server-config-only setting; in-place re-init disappears.
- `src/util/IdAllocator.ts` (or wherever it's defined) — banned
  ids list: skip `clockNodeId = 999` for node allocator, skip
  `clockBus = 16` for bus allocator.

### Open questions

1. **Does `~scAppClock` survive a sclang restart?** No — if sclang
   reboots, the clock dies until sclang reinits. Acceptable trade-off;
   sclang is the existing single point of failure for SuperDirt
   anyway. Bridge could surface a "clock detached" warning if `/tr`
   stops arriving for > N ticks; punt to a Phase 30 follow-up.
2. **chunkSize migration UX.** Three options:
   - **(a)** Remove the dropdown entirely; chunkSize is a
     server-config knob requiring sclang restart.
   - **(b)** Keep the dropdown but route `/clock/setChunkSize`
     to sclang, which `/n_free`s + re-`/s_new`s the clock. All
     sessions re-init their tap synths.
   - **(c)** Make it display-only.
   - **Recommended:** (a) for 30c, (b) as a Future Improvement.
     Removes a UX feature but consolidates the source of truth.
3. **Permission filtering for the clock node id.** A misbehaving
   client could `/n_free 999` and kill the shared clock for
   everyone. Two paths:
   - **Convention.** Document `nodeId 999` as off-limits, rely on
     `IdAllocator` to skip it. Clients with debugging tools can
     still break it.
   - **Bridge filtering.** Add a Rust-side packet filter in
     `routing.rs` that drops `/n_free <id>` if `id ∈ {999}`.
     Cheap to implement and provides hard guarantee.
   - **Recommended:** convention in Phase 30, filtering as a
     Phase 30+ follow-up if it's a real problem.
4. **Cross-client `tick0Ms` consistency.** Each session's
   `tick0Ms = Date.now()` at first `/tr` arrival has delivery-latency
   variance (~1 ms intra-machine, more across the network).
   `/clock/info`'s `currentTickIndex` lets a client anchor on an
   absolute audio frame instead — but it's the absolute-frame
   anchor that matters, not the wall-clock `tick0Ms`. Decide
   whether `tickToTimetag` should switch from `tick0Ms`-based to
   audio-frame-based math. Probably stays as-is (timetags must be
   wall-clock-ms regardless), but document.
5. **Pause semantics.** Today `GroupController.pause` (`/n_run 0`
   on parent group) freezes everything including the clock —
   because the clock is *in* the parent group. Post-30, the clock
   keeps ticking; `/n_run 0` only freezes the client's tap synths.
   Tap synths' `Phasor.ar` halts when paused; on resume, they
   re-align with `clockBus` because `clockBus` kept advancing.
   **Verify** the parity formula `completedHalf = tickIndex % 2`
   still holds across a pause boundary — the worker's
   `nextDeliverableTick` may need a re-anchor after `/n_run 1`.

### Acceptance criteria

- Two sc-app tabs open simultaneously. Both display the same
  `tickRate` / `chunkSize` from `/clock/info`. Both observe the
  same `/tr` tickIndex stream within delivery jitter (≤ ~5 ms
  intra-machine).
- Reload tab A; tab B's `/tr` stream continues uninterrupted —
  no missing ticks in tab B's debug log spanning the reload.
- Click Disconnect on tab A; tab B keeps clocking.
- A client cannot break the clock: simulate a malicious
  `/n_free 999` from tab A; tab B's clock keeps running. (With
  convention-only enforcement this is a "nice to have"; with
  bridge filtering it's a hard guarantee.)
- chunkSize dropdown is gone (or is display-only). The
  `/clock/info` reply is the sole source of truth.
- `setupDashboard` no longer takes `chunkSize` from a frontend
  source; it derives everything from `/clock/info`.

### Cross-cutting risks

- **Tap synth alignment after `/n_run` cycles.** Tap synths
  reading `clockBus` derive their write phase from the bus's
  current value at re-/s_new time. Need to verify the
  `completedHalf` parity formula in the worker still holds when
  the tap is added mid-clock-cycle (vs. today's at-tick-0
  startup). May need to extend the per-tap "skip first tick"
  logic to align on the next clean half boundary regardless of
  parity.
- **Stale `config.json` on existing installs.** Users with a
  pre-Phase-30 starter config will be missing the `/clock` route
  → `/clock/hello` falls through to the default scsynth route →
  scsynth replies `/fail /clock/hello: Command not found` and
  the dashboard hangs in `attaching` state. Mitigation: surface a
  clear toast "Bridge config missing /clock route — see CLAUDE.md
  Phase 30 migration"; document the fix.
- **sclang as single point of failure.** If sclang crashes or is
  restarted (e.g., during dev), the clock dies and all `/tr`s
  stop. Today's per-session clocks survive sclang independently.
  Mitigation: bridge watchdog → toast on `/tr` silence > N ticks.

### Sub-phases

- **30a** — sclang clock synth + `/clock/hello` responder.
  Backend-only. Tested via `oscdump` or a hand-rolled OSC client.
- **30b** — Frontend `ClockController` observer rewrite. Existing
  chunkSize dropdown stays as a no-op (logs warning). Tap synths,
  recordings, scopes start using the shared clockBus.
- **30c** — chunkSize dropdown removal. CLAUDE.md update.
- **30d** — Cleanup: delete `clockSynthDef.ts`, prune
  `IdAllocator` callers that referenced clockBus / clockNodeId.
  Final CLAUDE.md / NOTES.md sweep.

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
