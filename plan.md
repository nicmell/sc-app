# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`docs/history.md`](./docs/history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 27a + 27b + 27c shipped; 27d optional.** Phases 0–26 +
27a + 27b + 27c shipped (see `docs/history.md`; 27a/b/c entries
pending until the parent Phase 27 closes). Phase 27 below
introduces a step-sequencer panel that drives SuperDirt — turning
the dashboard from "oscilloscope + recorder + REPL" into
"oscilloscope + recorder + sequencer." Earlier longer-term
candidates remain in *Future Improvements*.

---

## Phase 27 — Step Sequencer for SuperDirt

**Goal.** Add a step-sequencer panel that drives the existing
`DirtClient`. Users build patterns by toggling cells in a grid;
transport plays the pattern at a configured BPM, sending
`/dirt/play` events at each step with timetags scheduled
sample-accurately on the SuperDirt side. The result is a
self-contained groove-box experience: launch `yarn osc`, open the
dashboard, build a beat in the SequencerPanel, hit Play, hear
SuperDirt do the rest.

The sequencer is intentionally lightweight: a 16-step (configurable
8/16/32) grid, N user-added tracks each with a sample name and a
gain slider, transport controls (BPM, Play/Stop, animated
playhead). No mini-notation parser, no pattern algebra, no
arrangement timeline — those belong to a later phase if at all.

### Architecture

```
Browser (React, main thread)
  ├── SequencerController   pattern state + scheduler + reactive
  │                          stores. JS-side wake-up loop computes
  │                          step times in TICKS against the
  │                          ClockController's tick0Ms anchor;
  │                          ships each /dirt/play in an OSC
  │                          bundle stamped via tickToTimetag for
  │                          sample-accurate playback.
  ├── ClockController       (existing) provides tick0Ms +
  │                          tickRate. Anchor for the sequencer's
  │                          wall-clock math; doesn't drive step
  │                          boundaries directly.
  └── SequencerPanel        TransportBar (BPM, play/stop, length,
                             current step) + TrackRow ×N (sample
                             name input, gain slider, step grid).

DirtClient (Phase 26) ── small extension. Existing
  `play(event, { lookaheadMs })` stays for one-shot REPL use.
  New `playAtTimetag(event, timetag)` accepts a precomputed OSC
  timetag from `tickToTimetag(...)` — that's what the sequencer
  uses.
```

The sequencer doesn't touch scsynth or the bridge directly. All
audio output happens via SuperDirt; the bridge's `/dirt → 57120`
route carries every event. From the bridge's perspective this is
just more `/dirt/play` traffic with explicit timetags.

### Data model

```typescript
interface Track {
  id: string;          // stable for React keys
  sample: string;      // SuperDirt bank name, e.g. "bd", "sn"
  gain: number;        // 0..1, default 0.8
  steps: boolean[];    // length === pattern.length
}

interface Pattern {
  length: number;      // 8 | 16 | 32; default 16
  tracks: Track[];
  bpm: number;         // 60..240; default 120
  subdivision: number; // steps per beat; default 4 (= 1/16ths)
}

interface TransportState {
  isPlaying: boolean;
  currentStep: number;        // 0..length-1, advances during playback
  patternStartTick: number;   // ClockController tickIndex when Play
                              //   hit (plus a small lookahead so the
                              //   first step has time to schedule).
                              //   All step times derive from this +
                              //   stepIntervalTicks to avoid drift.
}
```

`stepIntervalTicks(bpm, subdivision, tickRate) = (60 / bpm / subdivision) * tickRate`.
At BPM=120, subdivision=4, tickRate=46.875 Hz (chunkSize 1024 / 48 k):
`stepIntervalTicks = 0.125 s × 46.875 = 5.86 ticks per step`. Fractional
ticks are fine — `tickToTimetag` accepts them.

For each step, the OSC bundle's timetag is computed against the
audio engine's clock, not the JS wall clock. That gives sample-
accurate playback regardless of JS scheduler jitter.

### Scheduler

JS-side wake-up loop, but the math is anchored to the audio
engine's clock (`ClockController.tick0Ms` + `tickRate`) instead
of `performance.now()`. The wake-up loop just decides *when to
ship the next batch of OSC bundles*; the actual firing is on
SuperDirt's side, controlled by the timetag we stamp into each
bundle.

```typescript
const WAKE_INTERVAL_MS = 25;     // scheduler runs at ~40 Hz
const LOOKAHEAD_TICKS = 5;       // ~100 ms at 47 Hz tickRate
const LOOKAHEAD_HORIZON_TICKS = 5;  // queue events this far ahead

function scheduler() {
  if (!isPlaying) return;
  const tickRate = clock.derived.tickRate;
  const stepIntervalTicks = (60 / pattern.bpm / pattern.subdivision) * tickRate;
  const nowTick = clock.nowTick(performance.now());
  const horizonTick = nowTick + LOOKAHEAD_HORIZON_TICKS;

  while (nextStepTick <= horizonTick) {
    const stepIndex = nextStepIndex % pattern.length;
    const timetag = tickToTimetag(clock.tick0Ms!, nextStepTick, tickRate);
    for (const track of pattern.tracks) {
      if (track.steps[stepIndex]) {
        dirtClient.playAtTimetag(
          { s: track.sample, gain: track.gain },
          timetag,
        );
      }
    }
    // Schedule the playhead update at the actual step time —
    // converted back to ms from the tick anchor.
    const stepTimeMs =
      clock.tick0Ms! + (nextStepTick - 1) * (1000 / tickRate);
    setTimeout(
      () => currentStepStore.set(stepIndex),
      Math.max(0, stepTimeMs - performance.now()),
    );
    nextStepIndex += 1;
    nextStepTick += stepIntervalTicks;
  }
}

setInterval(scheduler, WAKE_INTERVAL_MS);  // or self-rescheduling
                                            //   setTimeout for
                                            //   tighter cleanup
```

Key properties:
- Step times are computed in *ticks* against `tick0Ms`, not
  accumulated from `performance.now()`, so JS timer drift can't
  compound. The audio engine's clock is the truth (matches the
  CLAUDE.md "server's audio clock is truth" invariant).
- Each `/dirt/play` ships inside an `OSC.Bundle` whose timetag
  comes from `tickToTimetag(...)` — sample-accurate on the
  SuperDirt side. The JS lookahead just needs to keep events on
  the wire ahead of their scheduled fire time.
- ~100 ms lookahead is generous: even with a tab-background-
  induced JS stall of ~500 ms, events for the next ~5 ticks are
  already on SuperDirt's queue with proper timetags, so playback
  stays correct until the JS scheduler resumes.
- `currentStepStore` updates fire at the actual step time
  (computed from the tick anchor) so the playhead aligns with
  the audible beat, not the lookahead horizon.
- Sequencer freezes cleanly when the parent group is paused
  (`/n_run 0`): tick events stop, `clock.nowTick(...)` stops
  advancing, and the wake-up loop's `while` condition fails on
  every tick. Resume via the ClockPanel resumes the sequencer
  on the next tick boundary too.

### Sample enumeration via SuperDirt OSC

To avoid making users memorise SuperDirt's 200+ sample-bank names
(`bd`, `sn`, `hh`, `808bd`, `industrial`, …), the sclang startup
script gains a small OSC responder that lists loaded banks on
demand:

```supercollider
// In scripts/sc-app-superdirt-startup.scd, after ~dirt.start(...)
OSCdef(\dirtListSamples, { |msg, time, addr|
    var pairs = ~dirt.soundLibrary.buffers.keys.asArray.sort.collect { |k|
        [k.asString, ~dirt.soundLibrary.buffers[k].size]
    }.flatten;
    addr.sendMsg(*(['/dirt/samples'] ++ pairs));
}, '/dirt/listSamples');
```

The bridge already routes `/dirt/*` to sclang on UDP 57120, so
no routing change is needed. The reply (`/dirt/samples bank1
count1 bank2 count2 …`) flows back through the same socket and
hits sc-app's `WorkerClient.onReply` — `DirtClient` filters
`/dirt/*` and exposes the bank list as a reactive store.

Frontend:

```typescript
// src/dirt/DirtClient.ts (extension)
private readonly _sampleBanks = createStore<ReadonlyArray<{name: string, count: number}>>([]);
readonly sampleBanks: ReadonlyStore<...> = this._sampleBanks;

async listSamples(): Promise<void> {
  // Send /dirt/listSamples; await /dirt/samples reply.
  // Parse interleaved [name, count] pairs from args.
  // Update _sampleBanks store.
}
```

`SequencerController` (or `AppShell`) calls `dirtClient.listSamples()`
once after the hello probe lands `'alive'`. The TrackRow's sample
input uses an HTML `<datalist>` populated from `sampleBanks` so
the user gets autocomplete for free. Bank counts can render as a
muted suffix (`bd (24)`) so users see at a glance which banks
have multiple variants for the `n` parameter.

Total cost: ~10 lines of sclang in the startup script, ~30 lines
of TS in DirtClient + the controller wiring. Worth it — removes
the "what samples are loaded?" friction that otherwise sends
users to sclang's post-window log every session.

### Sub-phases

Each step is an independently-verifiable commit.

**27a — MVP step sequencer.** ✅ Shipped. Single pattern;
configurable length (8/16/32 from the start); arbitrary tracks
(user adds/removes via "+ Track" button); transport (BPM 60–240,
Play/Stop, length picker); per-track sample name + gain slider +
step grid; animated playhead; JS scheduler with ~106 ms lookahead
horizon (5 ticks at chunkSize 1024 / 48 k). Empty pattern by
default. Pattern survives chunkSize re-init via `initialPattern`
threading through `setupDashboard`; playback restarts at step 0.
Sample-name autocomplete fed by `/dirt/listSamples` OSCdef in the
sclang startup script.

**27b — Per-step parameters.** ✅ Shipped. Right-click *or*
shift-click a cell opens a portal-rendered `StepPopover` with
sliders for `amp` / `cutoff` / `speed` / `pan` plus a per-row
clear (⊘) and a header "reset" that drops every override on
the cell at once. Track-level defaults editable via a chevron
that expands an inline `TrackDefaults` panel under the row.
Resolution at fire time: `step.params[k]` → `track.defaults[k]`
→ omit (let SuperDirt default). Override-dot (top-right of the
cell) lights up whenever `step.params` is non-empty; the chevron
on the track row lights up whenever any track default is set.
Popover closes on Escape, click-outside, scroll, or resize. The
data model migrated `Track.steps` from `boolean[]` to `Step[]`
where `Step = { active; params? }`; `params` is dropped entirely
when the last override clears so `stepHasOverrides` stays cheap.

**27c — Pattern bank + persistence.** ✅ Shipped. New
`PatternBank` class (`src/sequencer/PatternBank.ts`) holds an
8-element `Pattern[]` plus an `activeIndex`, all as reactive
stores. `SequencerController` is now a thin wrapper that reads
`bank.activePattern` and forwards mutations through
`bank.updateActivePattern(...)`. Slot switching is mid-playback
safe — the scheduler reads the pattern fresh each pump, so 1..8
A/B'ing just cuts to the new pattern at the next step. The
`BankSelector` row of 8 buttons sits above the transport bar;
filled slots get a small indicator. Document-level keydown
listener gated on editable focus (input/textarea/select/
contenteditable) makes 1..8 keys work without fighting the BPM
field. Persistence: schema-versioned (V1) JSON in
`localStorage['sc.sequencer.bank']`, debounced 500 ms; flushed
synchronously on `bank.dispose()` (called by handleDisconnect,
WS-onError, heartbeat-fail, and reinit-failure). On load,
patterns are sanitised — pre-27b boolean steps coerce to
`{active}`, malformed entries fall back to empty patterns.
Bank is long-lived across chunkSize re-init; live subscriptions
in `SequencerController.pattern` keep firing because the bank
instance is reused.

**27d — Pattern chain mode (optional, defer if not needed).**
Chain patterns into a longer arrangement: pattern A plays for N
cycles, then B for M, etc. UI: a small horizontal strip below the
grid with pattern letters + cycle counts. Loop the chain or play
once. ~½ day. Punt until someone asks for it.

### Files (planned, with 27a + 27b + 27c marks)

✅ = landed. ✳ = touched again in 27b. ✦ = touched again in 27c.

```
src/sequencer/
  types.ts                 ✳ EDIT — Step interface (was boolean),
                                 ParamMap, PARAM_SPECS,
                                 stepHasOverrides, resolveParam
  SequencerController.ts   ✦ EDIT — refactored to read/write through
                                 PatternBank.updateActivePattern;
                                 27b mutation set retained
  scheduler.ts             ✳ EDIT — eventForTrack now takes the Step
                                 and merges resolved params into the
                                 OSC payload
  PatternBank.ts           ✦ NEW  — 8-slot reactive store + debounced
                                 localStorage persistence + sanitise/
                                 migrate on load

src/ui/SequencerPanel/
  SequencerPanel.tsx       ✦ EDIT — now takes `bank` prop; renders
                                 BankSelector; document keydown 1..8
                                 listener gated on editable focus
  BankSelector.tsx         ✦ NEW  — 8-button slot picker with active
                                 + filled indicators
  TransportBar.tsx         ✅ NEW — Play/Stop, BPM input, length
                                 select, "+ Track" button; Play
                                 disabled when clockReady=false
  TrackRow.tsx             ✳ EDIT — chevron expander; hosts
                                 popover state (one slot per row);
                                 portals StepPopover to document.body
  StepCell.tsx             ✳ EDIT — onContextMenu / shift-click open
                                 popover; override-dot in corner;
                                 has-overrides class
  StepPopover.tsx          ✳ NEW — portal-rendered, viewport-clamped,
                                 4 sliders + per-row clear + reset;
                                 closes on outside / Esc / scroll /
                                 resize
  TrackDefaults.tsx        ✳ NEW — inline track-default editor
                                 (chevron-toggled), 4 sliders +
                                 clear buttons
  SequencerPanel.scss      ✳ EDIT — popover, override-dot, chevron,
                                 expander, source-tier opacities
  index.ts                 ✅ NEW

src/dirt/DirtClient.ts     ✅ EDIT — added `playAtTimetag(event, timetag)`
                                  for sample-accurate scheduling.
                                  Added `listSamples(timeoutMs)` +
                                  `sampleBanks` reactive store backed
                                  by `/dirt/samples` reply
                                  (interleaved [name, count] args
                                  parsed by parseSampleBanks helper).
                                  Pending list-samples promise tracked
                                  on a single slot; concurrent calls
                                  rejected.

src/dirt/dirtCommands.ts   ✅ EDIT — added `dirtListSamples()` builder
                                  + DIRT_SAMPLES_REPLY constant.
src/dirt/types.ts          ✅ EDIT — added `SampleBank` interface.

src/AppShell.tsx           ✦ EDIT — added `bank: PatternBank` to
                                  DashboardResources alongside
                                  `sequencer`. Bank is constructed
                                  fresh per handleConnect (loads from
                                  localStorage), reused across
                                  chunkSize re-init, disposed by
                                  handleDisconnect / onError /
                                  heartbeat-fail / reinit-fail (which
                                  flushes a final save). setupDashboard
                                  signature: `initialPattern` →
                                  `bank: PatternBank`. SequencerPanel
                                  now receives `bank` as a prop.

scripts/sc-app-superdirt-startup.scd
                           ✅ EDIT — added /dirt/listSamples OSCdef
                                  flattening ~dirt.buffers into
                                  /dirt/samples reply, registered
                                  after ~dirt.start so the dict is
                                  populated.

CLAUDE.md                  EDIT — add sequencer to architecture
                                  diagram + a short "scheduling"
                                  note in Code conventions; mention
                                  `dirtClient.sampleBanks` reactive
                                  store.
docs/history.md            APPEND — Phase 27 entry on completion.
plan.md                    MOVE entry → docs/history.md on completion.
```

### Acceptance criteria

- Adding a track, typing "bd", toggling 4 cells (e.g. steps 0, 4,
  8, 12), hitting Play with BPM=120 → kick plays at 2 Hz (every
  500 ms). Stop halts within ≤ one step interval.
- Changing BPM mid-playback updates the rate on the next
  scheduled step (no glitch, no skip).
- Adding a second track with "sn" on steps 4 and 12 plays a
  basic kick-snare pattern on top of the kick.
- Pattern length picker (16 → 32) doubles the grid and rescales
  the playhead correctly.
- Per-track gain slider audibly attenuates that track only.
- DirtPanel REPL still works alongside the sequencer (one-shot
  events fire over the same connection; the sequencer doesn't
  monopolise the DirtClient).
- Sequencer freezes when the parent group is paused (via the
  ClockPanel pause); resumes correctly when the group resumes,
  with phase coherent against the audio engine's clock.
- The sample-name input on each TrackRow shows an HTML datalist
  populated from SuperDirt's loaded banks (`bd`, `sn`, `808bd`,
  …) with `(N)` variant counts visible as autocomplete hints.
- A 4-on-the-floor pattern recorded for 30 s through the
  RecordingPanel (bus 0, channels 2) shows kick onsets aligned
  to expected sample boundaries within ≤ 1 ms (sample-accurate
  scheduling via timetag).
- chunkSize re-init from the dashboard header **stops** the
  sequencer (Q8 = ii) but preserves the pattern data on
  DashboardResources for the rebuild. User re-hits Play after
  the rebuild to resume.
- Stop → Play resumes from step 0 (not from the paused
  position). For "resume from where I stopped," see 27d's chain
  mode or a future "pause" toggle.

### Decisions (locked, with my defaults — override before
implementing if you disagree)

- **Q1. Track count: arbitrary.** User adds/removes tracks via
  "+ track" / "× remove" buttons. Same UX as SynthsPanel.
- **Q2. Pattern length: configurable from the start.** 8 / 16 /
  32 picker in TransportBar. Default 16. Per-track length
  variation (polymeters) is out of scope.
- **Q3. Per-track gain in 27a:** include. ~5 LoC of slider and
  it stops the user feeling locked to one volume per sample.
- **Q4. Visual style: compact panel matching dashboard.**
  CSS-grid for the step grid, similar density to ScopeList /
  RecordingPanel. Not a full-width "DAW strip."
- **Q5. Default sample names: empty.** Users type their own.
  More honest than pre-filling `bd` in row 1.
- **Q6. Tempo source: independent.** SequencerController owns
  its own BPM, separate from sc-app's `ClockController`
  (which is driven by chunkSize/sampleRate, not musical tempo).
  The two clocks don't interact.
- **Q7. Multi-cycle: loop by default, no toggle in 27a.** Hit
  Play, pattern loops until Stop. One-shot mode lives in the
  chain phase if needed.

### Open Q (settle before each sub-phase as it starts)

**Q8. Scheduler lifecycle on chunkSize re-init.** When the user
changes chunkSize and `setupDashboard` rebuilds, does the
sequencer keep playing through the rebuild, pause cleanly, or
get re-mounted from scratch? The chunkSize re-init can take ~½ s
(re-uploading SynthDefs, re-creating clock); during that window
the dashboard is unmounted. Easiest answer: pause on re-init,
resume after — but the pattern state must survive. Cleanest:
keep the SequencerController alive across re-init via a separate
lifecycle, but that's an extra plumbing layer.
- (i) Pause + resume; pattern state lives on `DashboardResources`
  and the rebuild reuses it (~10 LoC of plumbing).
- (ii) Stop entirely and reset to step 0; user re-hits Play.
  Simplest, most honest about what re-init means.
- (iii) Hide the issue: forbid chunkSize change while the
  sequencer is playing. Annoying.

Recommendation: (ii) for 27a, revisit if it's a real friction.

**Q9. Sample-name typing UX.** Plain text input, autocomplete
from SuperDirt's loaded banks (the *Sample enumeration via
SuperDirt OSC* section above describes the responder), or both?
- (i) Plain text input — user types `bd`, gets a kick. Sample
  not found = silence. Same UX as DirtPanel's REPL today.
- (ii) Datalist-style autocomplete from a hardcoded bank list.
  Stale if user adds custom banks to `superdirt-deps/Dirt-Samples`.
- **(iii) Live autocomplete via the new `/dirt/listSamples`
  responder.** ← updated recommendation. Cheap to add (responder
  is ~10 lines of sclang), survives custom-sample-pack additions,
  and naturally pairs with showing `(N)` variant counts in the
  dropdown.

Recommendation: **(iii)** for 27a. The responder is cheap and the
UX win (no "what samples are loaded?" trips to the post window)
shows up the first time a user picks a sample. Plain text stays
as the underlying mechanism — the datalist is purely an
autocomplete helper.

**Q10. Step-cell colour coding.** Pure on/off, or visualise
gain / cutoff / etc. via per-cell shading?
- (i) On/off (filled vs empty cell). Simplest, readable.
- (ii) Cell opacity = gain, hue = cutoff (or similar). Pretty
  but easy to overdo.
- (iii) On/off + a single dot for "has per-cell overrides"
  (post-27b only).

Recommendation: (i) for 27a, (iii) when 27b lands.

**Q11. Keyboard shortcuts.** Should Play/Stop bind to spacebar?
Step toggles via numeric input (1-9 = first 9 cells of focused
track)?
- (i) None for 27a; mouse-only.
- (ii) Spacebar Play/Stop only.
- (iii) Full keyboard navigation (arrow keys to move the
  highlight, space to toggle, Enter to add a track, …).

Recommendation: (i) for 27a. Spacebar Play/Stop is a tempting
add but conflicts with text-input focus; defer.

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
