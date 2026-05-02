# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`docs/history.md`](./docs/history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 27 in design.** Phases 0–26 shipped (see
`docs/history.md`). Phase 27 below introduces a step-sequencer
panel that drives SuperDirt — turning the dashboard from
"oscilloscope + recorder + REPL" into "oscilloscope + recorder +
sequencer." Earlier longer-term candidates remain in
*Future Improvements*.

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
  ├── SequencerController   pattern state + JS scheduler + reactive
  │                          stores. Owns the setTimeout-based
  │                          lookahead loop. Sends /dirt/play via
  │                          DirtClient with `lookaheadMs` set so
  │                          SuperDirt schedules each event at its
  │                          step boundary.
  └── SequencerPanel        TransportBar (BPM, play/stop, length,
                             current step) + TrackRow ×N (sample
                             name input, gain slider, step grid).

DirtClient (Phase 26) ── unchanged. Sequencer just calls
                          dirtClient.play({ s, gain, ... }, { lookaheadMs }).
```

The sequencer doesn't touch scsynth or the bridge. All audio
output happens via SuperDirt; the bridge's `/dirt → 57120` route
carries every event. From the bridge's perspective this is just
more `/dirt/play` traffic.

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
  patternStartTime: number;   // performance.now() when Play hit;
                              //   used to compute step times so we
                              //   don't accumulate setTimeout drift
}
```

`stepTimeMs(stepIndex) = patternStartTime + stepIndex * (60_000 / bpm / subdivision)`.

For a 120 BPM pattern at subdivision=4 (sixteenth notes):
`stepIntervalMs = 60_000 / 120 / 4 = 125 ms`. So 16 steps over
2000 ms = one bar. At 240 BPM: 62.5 ms/step, one bar in 1000 ms.

### Scheduler

JS-side, setTimeout-based, lookahead pattern (the standard
"browser-music scheduling" pattern from the Web Audio docs):

```typescript
const WAKE_INTERVAL_MS = 25;   // scheduler runs at ~40 Hz
const LOOKAHEAD_MS = 100;      // how far ahead we queue events

function scheduler() {
  if (!isPlaying) return;
  const now = performance.now();
  const horizon = now + LOOKAHEAD_MS;

  // Walk forward from the last-scheduled step to the horizon.
  while (nextStepTimeMs <= horizon) {
    const stepIndex = nextStepIndex % pattern.length;
    for (const track of pattern.tracks) {
      if (track.steps[stepIndex]) {
        dirtClient.play(
          { s: track.sample, gain: track.gain },
          { lookaheadMs: nextStepTimeMs - now },
        );
      }
    }
    // Update reactive currentStep just-in-time so the playhead
    // lands close to the audible event (not 100ms early).
    setTimeout(
      () => currentStepStore.set(stepIndex),
      Math.max(0, nextStepTimeMs - now),
    );
    nextStepIndex += 1;
    nextStepTimeMs += stepIntervalMs;
  }
}

setInterval(scheduler, WAKE_INTERVAL_MS);  // or a self-rescheduling
                                            //   setTimeout for
                                            //   tighter cleanup
```

Key properties:
- Step times are computed from `patternStartTime` (a fixed
  reference), not accumulated, so JS timer drift doesn't compound.
- Each `/dirt/play` ships with `lookaheadMs` ≥ 0. SuperDirt
  schedules the event for `Date.now() + lookaheadMs` on its end —
  sample-accurate playback as long as we ship events early enough.
- 100 ms lookahead is generous: even with a system pause / GC
  hiccup of ~50 ms, the scheduler catches up on the next wake-up
  and SuperDirt still gets events in time.
- `currentStepStore` updates fire from scheduled `setTimeout`
  callbacks at each step boundary — the playhead matches the
  audible beat, not the 100 ms-ahead schedule horizon.

### Sub-phases

Each step is an independently-verifiable commit.

**27a — MVP step sequencer.** Single pattern; configurable length
(8/16/32 from the start); arbitrary tracks (user adds/removes via
"+ track" button); transport (BPM 60–240, Play/Stop, length picker);
per-track sample name + gain slider + step grid; animated playhead;
JS scheduler with 100 ms lookahead. Empty pattern by default (no
pre-filled `bd` etc.). Acceptance: type "bd" in row 1, toggle some
cells, hit Play → kick plays at the right rate, BPM change updates
mid-flight, Stop halts cleanly. ~1 day.

**27b — Per-step parameters.** Right-click a cell (or
shift-click) → tiny popup with `amp`, `cutoff`, `speed`, `pan`
sliders. Track-level defaults overridable per-cell. Per-cell
overrides shown as a small dot in the cell. ~½ day.

**27c — Pattern bank + persistence.** Up to 8 patterns,
keyboard-switchable (1–8). Auto-save to `localStorage` on every
mutation (debounced 500 ms). Load on dashboard mount. The pattern
bank is its own reactive store; SequencerController reads the
"active" pattern from it. ~½ day.

**27d — Pattern chain mode (optional, defer if not needed).**
Chain patterns into a longer arrangement: pattern A plays for N
cycles, then B for M, etc. UI: a small horizontal strip below the
grid with pattern letters + cycle counts. Loop the chain or play
once. ~½ day. Punt until someone asks for it.

### Files (planned)

```
src/sequencer/
  types.ts                 NEW — Track, Pattern, TransportState
  SequencerController.ts   NEW — pattern state + scheduler + stores
  scheduler.ts             NEW — setTimeout lookahead loop
                                 (extracted so it's testable in
                                 isolation)

src/ui/SequencerPanel/
  SequencerPanel.tsx       NEW — top-level panel, composes the
                                 transport bar + track list
  TransportBar.tsx         NEW — BPM input, Play/Stop button,
                                 length picker, current step
                                 indicator
  TrackRow.tsx             NEW — sample input, gain slider, N
                                 step cells, remove button
  StepCell.tsx             NEW — toggle button, "current" highlight
  SequencerPanel.scss      NEW — styles
  index.ts                 NEW

src/AppShell.tsx           EDIT — add `sequencer: SequencerController`
                                  to DashboardResources, construct in
                                  setupDashboard, dispose in
                                  teardownServerState. Render
                                  <SequencerPanel /> after <DirtPanel />.

src/dirt/DirtClient.ts     EDIT (minor) — confirm `play(event,
                                  { lookaheadMs })` honours the
                                  override; the existing default
                                  is 100 ms. Sequencer passes its
                                  own per-event lookahead.

CLAUDE.md                  EDIT — add sequencer to architecture
                                  diagram + a short "scheduling"
                                  note in Code conventions.
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
- chunkSize re-init from the dashboard header preserves the
  pattern (sequencer state lives outside `setupDashboard`'s
  rebuild path; it's mounted on `DashboardResources` but the
  `Pattern` value should survive the rebuild).
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
from SuperDirt's loaded banks (sclang prints the list at
startup; we'd need to expose it via OSC), or both?
- (i) Plain text input — user types `bd`, gets a kick. Sample
  not found = silence. Same UX as DirtPanel's REPL today.
- (ii) Datalist-style autocomplete from a static list (we hard-
  code the bank names from Dirt-Samples).
- (iii) Live autocomplete via a `/dirt/listSamples` OSC command
  (would need a SuperDirt-side responder).

Recommendation: (i) for 27a. (ii) is a follow-up if "what
samples do I have" is a frequent question. (iii) is overkill.

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
