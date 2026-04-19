# Design Notes

Captured 2026-04-18. A record of an honest architectural review and the design of the planned `sc-pattern` / clock markup, including the design space explored and the approach chosen.

---

## 1. Application assessment

### 1.1 Strengths

- **Client-side synthdef compiler (`src/lib/ugen/`)**. UGen graph builder, topological sort, SCgf binary encoder, 367 UGens auto-registered from Overtone metadata, multi-channel expansion, handling of the `channelsArray`/`inputArray` wire-order quirk. Real compiler engineering; most browser-SC projects push this to a server. Doing it in the client unlocks non-trivial architectural territory.
- **Plugin isolation via Lit + shadow DOM** is the right call. Plugin authors get real DOM boundaries without iframe ceremony. The declarative `<sc-synth bind="…">` markup is approachable for non-programmers.
- **Bind expressions with cycle detection + resolve-on-demand idempotency**. Most hobby projects skip this class of detail; here it's done right.
- **Native/serve duality is clean**. Single `IS_TAURI` switch, `SampleStream` abstraction, URI scheme mirrored as HTTP. The split is intentional, not accidental.
- **Plugin validation pipeline**. XSD schema + metadata linter + asset format sniffing + CLI validator + deliberately-bad example plugins for regression coverage. Strong hygiene.
- **Rust module boundaries**. `ipc/`, `plugin/`, `server/` have clear responsibilities.

### 1.2 Concerns

- **Narrow target audience.** An existing SC user already knows sclang. A non-SC user who wants knobs reaches for Max for Live or TouchOSC. The real niche is "SC practitioners publishing toys for non-technical listeners" — real but small. Every architectural decision should be weighed against a user you've talked to recently.
- **Architecture drift is visible in the git log** — streams consolidated, DiskOut⇄RecordBuf churn, features added and deleted. Normal for solo work but also means the abstractions don't yet pay rent. `SampleStream` now has a single consumer (`createBufferStream`), below the rule-of-three.
- **No test suite.** This is the biggest red flag. The synthdef compiler, SCgf encoder, bind parser, runtime resolver — the exact parts that benefit from unit/snapshot tests — have none. Snapshot-testing compiled bytes for every example plugin would catch entire classes of regression for a day's work.
- **Copy-paste in Lit components.** `sc-waveform` was a near-clone of `sc-record` (~500 LOC). When the next streaming-canvas component lands, a shared base is overdue.
- **Live-waveform path has inherent limits.** The RecordBuf + `/b_getn` poll approach caps phase-offset lag at `frames / sampleRate` (~43 ms at 48 kHz, 2048 frames). Fine for visualisation, weak for anything serious. Scope SHM (see §3.2) is the real fix.
- **UGen registry auto-generated from Overtone metadata.** Depending on another project's data is a dependency risk. Overtone itself has stale entries (patched by the generator script, but every patch is a liability). Scraping scsynth's own help files would be more stable long-term.
- **No linter/formatter.** Relying on TS strict + patterns works solo; painful with contributors.
- **State-management paradigm soup.** Zustand + Redux-style slices + Immer is at least one paradigm too many. Zustand exists specifically to kill Redux ceremony; re-adding slices on top makes code more verbose than either alone.
- **Security model hand-wavy.** Plugins run in the host's shadow DOM with OSC access to scsynth. XSD restricts element types but attribute-level sanitisation (style injection, event handlers, URL exfil) hasn't been audited. A plugin marketplace would need this.
- **Runtime reducer complexity.** Already ~350 lines of visitor code; each new element type threads through parse / runtime / override lookup / partialize. Adding element types is getting expensive.

### 1.3 Usefulness

Genuinely useful for **SC users sharing interactive patches with non-technical people** — teacher-to-student, sound designer-to-client, live coder packaging a performance rig. The value isn't "make a synth easier" (sclang users are fine); it's "package a synth as a drop-dead-simple HTML bundle other people can run." Small but real gap in the ecosystem.

Beyond that niche, probably not. The question that unlocks everything downstream: *who is this for, and have five of them been observed using it?*

### 1.4 Extension priorities (honest ranking)

**High leverage, low risk:**

1. **Tests for the synthdef compiler.** Snapshot SCgf bytes per example plugin. Biggest payoff per hour of any item here.
2. **MIDI input via Web MIDI API.** Trivial to add, massively expands use cases — MIDI controllers driving `sc-range` / `sc-checkbox`.
3. **Plugin registry / `sc-app install foo`.** CLI already has `plugin add <zip>`; only needs a discovery layer.
4. **OSC traffic panel.** `/dumpOSC` is already wired; surfacing it in a dev drawer would help plugin authors enormously.
5. **Plugin hot-reload.** Watch HTML on disk, reload on change. Dev ergonomics win.

**Medium:**

6. **Scope SHM.** SC's shared-memory scope → Rust reader. Real fix for the live-viz gap story. Enables 60 fps visualisation / true oscilloscopes.
7. **Multi-scsynth.** Connect to several, distribute synths across them. Live-performance and distributed-rendering use cases.

**Speculative (but with a decided design — §2):**

8. **Pattern / clock markup (`sc-pattern`, `sc-clock`).** Declarative sequencing. Huge expansion in what plugins can do. Design in §2.
9. **Export to standalone.** Freeze a plugin + serve mode into a static artefact. Turns this into a publishing platform.

---

## 2. sc-pattern / clock markup: design exploration

### 2.1 Context

Declarative sequencing is the single biggest feature this project is missing. sclang's `Pbind` / `TempoClock` is how most SC users actually make music; without it, this app is limited to "knob toys." The design below gives plugin authors declarative sequencing without leaving the XML-markup-as-plugin model.

### 2.2 Three scheduling substrates considered

| Option | Mechanism | Verdict |
|---|---|---|
| Frontend JS loop | `setInterval` / rAF fires `/s_new` OSC at event time | Rejected: ~4 ms resolution floor, GC jitter; browser-tab-backgrounding throttles (~1 Hz), so backgrounded tabs stop the music |
| Frontend look-ahead + scsynth OSC time tags | JS scheduler emits `#bundle` with future timestamps; scsynth queues and fires sample-accurately | Initially preferred for sample accuracy; rejected on reconsideration (see below) |
| **Rust tokio timer** | **Per-pattern `tokio::task` with `sleep_until`; fires `/s_new` directly over UDP** | **Chosen** |

**Tiebreaker**: only the Rust-timer design survives browser tab backgrounding or client disconnect in serve mode. For a "publish a generative plugin and leave it running" use case, this is a correctness requirement, not a preference. Browser-Worker timers throttle hard on hidden tabs and background WebSocket connections can close — either breaks the frontend-driven designs.

**Cost accepted**: implementing a small pattern-stream evaluator in Rust (~150 LOC for the MVP set). In exchange we get event-driven scheduling (no polling), ~1 ms jitter from `tokio::time::sleep_until`, and a backend that is authoritative across clients.

**Rejected design preserved for reference**: frontend Web Worker running a 25 ms tick + 100 ms look-ahead, emitting OSC bundles with NTP time-tagged timestamps via existing `udp_send`. Sample-accurate because scsynth schedules. Dies on tab backgrounding.

### 2.3 Markup design

```xml
<sc-clock name="main" bpm="120"/>

<sc-pattern clock="main" bind="voice" run="true">
    <sc-pbind key="freq">
        <sc-pseq repeat="inf">
            <sc-pvalue>440</sc-pvalue>
            <sc-pvalue>550</sc-pvalue>
            <sc-pvalue>660</sc-pvalue>
            <sc-prand>
                <sc-pvalue>220</sc-pvalue>
                <sc-pvalue>330</sc-pvalue>
            </sc-prand>
        </sc-pseq>
    </sc-pbind>
    <sc-pbind key="amp" value="0.3"/>
    <sc-pbind key="dur" value="0.25"/>
</sc-pattern>
```

**Elements (MVP set):**

| Element | Role |
|---|---|
| `<sc-clock name bpm playing>` | Timekeeper. `bpm` / `playing` are controls, bindable to `sc-range` / `sc-checkbox` / `sc-run`. |
| `<sc-pattern clock bind run>` | Event factory. `bind` references a **synthdef** (every event is a fresh `/s_new`). Owns a private group. |
| `<sc-pbind key>` | One key binding; contains exactly one stream child, or has `value=".."` for a constant. |
| `<sc-pseq repeat>` | Sequence. Cycles through children. `repeat="inf"` or N. |
| `<sc-prand>` | Uniform-random child pick per event. |
| `<sc-pwhite low high>` | Uniform random float in [low, high]. |
| `<sc-pseries start step>` | Arithmetic series. |
| `<sc-pgeom start ratio>` | Geometric series. |
| `<sc-pvalue>` | Leaf value; text content is a number; optionally `bind="var.path"` pulls current value. |
| `<sc-pfunc bind>` | Computed via bind expression (reuses the existing expression parser). |

**Reserved pattern-meta keys** (not forwarded as synth controls, consumed by the engine): `dur`, `delta`, `legato`, `stretch`. Matches SC convention.

XML chosen over a DSL-in-attribute for discoverability + XSD validation. Plugin authors who want terseness can write their own build-time transformations later.

### 2.4 Rust module layout

```
src-tauri/src/pattern/
    mod.rs
    state.rs       — PatternState (Arc<Mutex<…>>), Clock, Pattern types
    stream.rs      — Stream enum + fn next(&mut self, rng) -> Option<f64>
    task.rs        — pattern_task: sleep_until loop with control mpsc
    dispatch.rs    — build + send /s_new OSC via Rust-owned UdpSocket
    commands.rs    — Tauri commands + serve-mode HTTP/WS
```

### 2.5 Core types

```rust
pub struct PatternState {
    clocks: HashMap<ClockId, Clock>,
    patterns: HashMap<PatternId, PatternHandle>,
}

struct PatternHandle {
    spec: Arc<Mutex<Pattern>>,        // mutated by control messages
    control: mpsc::Sender<Ctrl>,      // bpm-change, run-flip, remove
    join: JoinHandle<()>,
}

pub struct Clock {
    bpm: f64,
    playing: bool,
    started_at: Option<Instant>,      // None while paused
    beats_at_start: f64,              // beats accumulated before current resume
}

pub enum Stream {
    Value(f64),
    Seq   { values: Vec<Stream>, cursor: usize, repeat: i32, cycles: i32 },
    Rand  { values: Vec<Stream> },
    White { low: f64, high: f64 },
    Series{ start: f64, step: f64, next: f64 },
    Geom  { start: f64, ratio: f64, next: f64 },
}
```

### 2.6 Scheduling task (one per running pattern)

Event-driven — no polling. `tokio::select!` waits on either the next event's `sleep_until` or a control message.

```rust
async fn pattern_task(
    state: Arc<PatternState>,
    pattern_id: PatternId,
    mut ctrl: mpsc::Receiver<Ctrl>,
    udp: Arc<UdpSocket>,
) {
    loop {
        let next_at: Option<Instant> = compute_next_instant(&state, &pattern_id).await;

        tokio::select! {
            _ = async { if let Some(t) = next_at { sleep_until(t).await } else { pending().await } } => {
                let event = evaluate_event(&state, &pattern_id).await;
                dispatch::send_s_new(&udp, &event).await;
                advance_pattern(&state, &pattern_id, event.dur).await;
                broadcast_update(&event);
            }
            msg = ctrl.recv() => match msg {
                Some(Ctrl::SetRun(r))  => set_run(&state, &pattern_id, r).await,
                Some(Ctrl::BpmChanged) => { /* loop re-reads clock */ }
                Some(Ctrl::Remove) | None => break,
            }
        }
    }
    cleanup(&state, &pattern_id, &udp).await;  // /g_freeAll groupId
}
```

- Idle patterns consume zero CPU (`sleep_until` is backed by a timer wheel, ~1 ms resolution).
- Control messages re-drive the loop; bpm shifts handle themselves.
- Clock pause: `next_at = None` → `pending()` → task sleeps until a `Ctrl::BpmChanged` (or similar) fires on resume.

### 2.7 Clock math (easy to get wrong)

```rust
impl Clock {
    fn current_beats(&self) -> f64 {
        match (self.playing, self.started_at) {
            (true, Some(t0)) => self.beats_at_start + t0.elapsed().as_secs_f64() * self.bpm / 60.0,
            _                => self.beats_at_start,
        }
    }
}

fn set_playing(clock: &mut Clock, on: bool) {
    match (clock.playing, on) {
        (false, true) => { clock.started_at = Some(Instant::now()); clock.playing = true; }
        (true, false) => { clock.beats_at_start = clock.current_beats(); clock.started_at = None; clock.playing = false; }
        _ => {}
    }
}

fn set_bpm(clock: &mut Clock, bpm: f64) {
    clock.beats_at_start = clock.current_beats();
    clock.started_at = clock.playing.then(Instant::now);
    clock.bpm = bpm;
}
```

Invariant to test: `current_beats()` is monotonic and continuous across any combination of play/pause/bpm transitions.

### 2.8 Commands

```rust
#[tauri::command] clock_upsert(id, bpm, playing) -> Result<(), String>;
#[tauri::command] pattern_upsert(spec: PatternSpec) -> Result<(), String>;
#[tauri::command] pattern_remove(id) -> Result<(), String>;
#[tauri::command] pattern_set_run(id, run) -> Result<(), String>;
```

`PatternSpec` carries the stream tree by serde-tagged enum:

```rust
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum StreamSpec {
    Value  { value: f64 },
    Seq    { values: Vec<StreamSpec>, repeat: i32 },
    Rand   { values: Vec<StreamSpec> },
    White  { low: f64, high: f64 },
    Series { start: f64, step: f64 },
    Geom   { start: f64, ratio: f64 },
}
```

Serve mode mirrors via HTTP `POST /patterns`, `DELETE /patterns/{id}`, `POST /clocks/{id}/playing` — same shape as the plugin router.

### 2.9 OSC dispatch: Rust owns its own UDP socket

```rust
let udp = UdpSocket::bind("0.0.0.0:0").await?;
udp.connect(&scsynth_addr).await?;
// Arc<UdpSocket> shared across all pattern_tasks
```

Two OSC paths from this process to scsynth is fine (UDP is connectionless). `/s_new` encoded via the existing `rosc` crate (~20 LOC).

### 2.10 Frontend role (much thinner than the Web-Worker design)

```ts
// src/sc-elements/sc-pattern.ts
protected _sendCreate() {
    const spec = this._buildSpec();  // walks runtime children → StreamSpec tree
    void patternApi.upsert(spec);
}
protected _sendDestroy() { void patternApi.remove(this.id); }
protected _onStateChange(prev, next) {
    if (prev.run !== next.run) void patternApi.setRun(this.id, next.run);
}
```

`patternApi` in `src/lib/patterns/PatternService.ts` wraps invokes (Tauri) or fetch (serve). Mirrors `OscService` shape. No Web Worker, no OSC-bundle encoder, no time-tag math.

### 2.11 UI feedback (Rust → frontend)

Rust emits throttled events (~60 Hz per pattern) for playhead rendering:

```rust
#[derive(Serialize)]
struct PatternEvent {
    pattern_id: String,
    beat: f64,
    values: HashMap<String, f64>,
    cursors: HashMap<StreamId, i32>,
}
```

- Native: `app_handle.emit("pattern:event", &ev)`.
- Serve: broadcast on `/patterns/events` WebSocket.

Frontend `PatternService` subscribes behind `IS_TAURI`, dispatches `UPDATE_PATTERN_CURSOR` action → UI re-renders.

### 2.12 Phased plan

**Phase 1 — Rust MVP (~3 days)**
- Modules: `pattern::{state, stream, task, dispatch, commands}`.
- Streams: Value, Seq.
- One `pattern_task` per pattern, sleep_until loop, mpsc control channel.
- Commands: `clock_upsert`, `pattern_upsert`, `pattern_remove`, `pattern_set_run`.
- Frontend: markup (`sc-clock`, `sc-pattern`, `sc-pbind`, `sc-pseq`, `sc-pvalue`) + runtime handlers + `PatternService`.
- Example: `pattern-plugin` — 4-note arpeggio.

**Phase 2 — Full evaluator + UI feedback**
- Streams: Rand, White, Series, Geom, Func (uses the existing bind-expression parser).
- `pattern:event` emission (native + serve).
- Playhead indicator on `<sc-pattern>`.
- Serve-mode HTTP/WS command surface.

**Phase 3 — Correctness + ergonomics**
- Multi-clock, clock sync.
- Pfin / Pn (`repeat` on pattern level).
- Quantised start (`<sc-pattern quantise="1">` waits for next bar).
- Dev panel listing last N events per pattern.

### 2.13 Risks / early tests

1. **Lock contention** on `Arc<Mutex<PatternState>>`. Mitigation: if profiling shows it under 10+ simultaneous patterns, split to per-pattern `Arc<Mutex<Pattern>>` behind an index.
2. **Stream evaluator correctness.** Snapshot-test the first 20 events of each stream config. Non-negotiable for audio software.
3. **bpm-change continuity.** Unit test: `current_beats()` strictly monotonic + continuous across mid-playback `set_bpm`.
4. **Shutdown order.** On `pattern_remove`: cancel task → await JoinHandle → `/g_freeAll groupId`. Plugin unload must not orphan tasks.
5. **Timer precision.** `sleep_until` has ~1 ms jitter on macOS, better on Linux with RT kernel. Document, don't fix for MVP.
6. **Validation on command entry.** Clock without patterns, pattern without clock — return clear errors, no panics.

### 2.14 What this architecture unlocks for free

- **CLI-driven patterns.** `sc-app pattern run spec.json` — module already owns everything needed. Headless generative installations become possible.
- **Multi-client serve mode.** Several browsers viewing the same server stay in sync because the backend is the single authority.
- **Pattern specs serialise cleanly** (serde) — trivially persistable if config-file round-tripping becomes useful later.

### 2.15 Honest caveat

The Rust-side stream library is a real ongoing cost. The MVP six (Value/Seq/Rand/White/Series/Geom) is ~150 LOC; full sclang-parity (Ppar, Ptuple, Pkey, Pfindur, Pmono, etc.) would be ~1200 LOC and a real domain to own. Defer advanced variants until users ask.

---

## 3. Buffer-stream phase-tracking (WIP — current attempt doesn't work)

Captured 2026-04-19. Records an incomplete investigation: the code landed in this commit is partially implemented but the end-to-end scope in `test-plugin` still fails at runtime. Preserved as a starting point, not as a shipped feature.

### 3.1 Why this work started

The buffer-polling design has an inherent "seam zone": reader and writer advance on independent clocks (tokio wall-clock vs scsynth DSP), their phase offset is set at startup and is effectively random, and when that offset puts the writer's head *inside* a single `/b_getn` read range, scsynth returns a batch that is half from cycle N and half from cycle N−1. This shows up as a mid-frame kink in sc-scope and an audio click in anything that treats the batches as a recording.

Widening `chunks` (the `/b_getn` count per buffer cycle) reduces the probability of this to `≈ 1 / chunks` but doesn't eliminate it. `chunks=8` with `frames=16384` (current scope-plugin default) makes it infrequent enough for visual scope use; for sample-accurate recording it's insufficient. The only principled fix is for the reader to *know where the writer is* and position its reads safely behind the write head.

### 3.2 Intended design

**Writer synthdef** (instead of plain `RecordBuf`):

```
In.ar(bus, 1)        → sig
Phasor.ar(0, 1, 0, frames)   → phase
BufWr.ar(sig, bufnum, phase, loop=1)
A2K.kr(phase)        → phaseKr
SendTrig.kr(Impulse.kr(200), bufnum, phaseKr)
```

`Phasor` makes the write head explicit; `BufWr` writes at that phase; `SendTrig.kr` fires `/tr [nodeID, bufnum, phase]` 200× per second tagged with `bufnum`.

**Rust reader** (`spawn_reader` in `src-tauri/src/ipc/buffer.rs`):

```
On socket startup: send /notify 1 so scsynth broadcasts /tr to this socket.
On each /tr with triggerID == bufnum:
    if first one: anchor = (phase, Instant::now()); samples_issued = phase - safety.
In tick loop:
    if anchor: target = anchor_phase + elapsed_since_anchor * sr - safety_samples
    else:      target = elapsed_since_reader_start * sr         (wall-clock fallback)
    issue /b_getn in chunk-sized increments until samples_issued >= target
```

`safety_samples = 2 × chunk` keeps the reader consistently that many samples behind the writer's current head. Any `/b_getn` range `[R, R + chunk]` ends `chunk` samples before the write head → no straddle, ever.

**Plugin-author contract**: nothing changes for users of the plain `sc-buffer` + `RecordBuf` path (it stays in wall-clock mode and works as before). `sc-test` flips into phase-tracked mode automatically because its auto-generated synthdef emits `/tr`.

### 3.3 What was implemented (present in the repo, not working end-to-end)

1. **`src-tauri/src/ipc/buffer.rs::spawn_reader`** — on first `/tr` with matching bufnum, set a `(phase, Instant)` anchor and reposition `samples_issued = phase − safety_samples`; thereafter `target` is computed from the anchor. Falls back to wall-clock when no `/tr` ever arrives. `/notify 1` sent on socket connect. New `extract_tr_phase` helper alongside renamed `walk_b_setn`.
2. **`src/sc-elements/sc-test.ts`** — recorder synthdef upgraded to the `In + Phasor + BufWr + A2K + Impulse + SendTrig` chain above. `ensureRecorderLoaded()` returns a `Promise<void>` that waits ~100 ms after `/d_recv` before resolving (works around Tauri's per-command concurrency, which was letting small `/s_new` packets overtake the large `/d_recv` blob). `_activate` has an `_activating` reentry guard.
3. **`src/lib/osc/OscService.ts`** — bundle timetag overridden to the OSC "immediately" sentinel (`seconds=0, fractions=1`) instead of `Date.now() + msgLatency`. Addresses a separate issue where the produced timetag was observed to land hundreds of days in the future (suspected clock / osc-js conversion quirk), causing scsynth to schedule the `/g_new` bundles for the future and break any unbundled command that depended on them.

### 3.4 Why it's not working yet

Observed symptom at last test (2026-04-19): scsynth log still shows `FAILURE IN SERVER /s_new Group 1001 not found` and `FAILURE IN SERVER /b_getn index out of range`, even with the three fixes above.

Live hypotheses, roughly ordered by likelihood:

1. **`/tr` routing to the reader socket is not what we assumed.** The SC source's `SendDoneToAllNotified` idiom made it sound like `/tr` broadcasts to every `/notify`-ed client, but some SC versions / client-ID configurations may route only to the creating client. If the recorder synth is owned by the frontend's main socket, the reader's separate socket might never see the `/tr`. Symptom would be "phase anchor never sets" — reader stays in wall-clock mode and the same seam issue comes back, but crucially without the "Group not found" errors we're actually seeing. So this may not be the full story.
2. **The "Group not found" is pre-existing and independent of phase-tracking.** The trace shows `/g_new 1001` bundled vs `/s_new target 1001` un-bundled, and even with the immediate-timetag fix something is making scsynth evaluate the unbundled command before the bundled one. May be a bundle-vs-direct dispatch ordering rule inside scsynth that we haven't pinned down.
3. **`/b_alloc` is async; `/s_new` and `/b_getn` race ahead.** Scsynth's `/b_alloc` schedules allocation on a non-RT thread. Without chaining via completion-message, subsequent commands can hit "buffer not yet allocated" mid-flight. The trace's `/b_getn index out of range` is consistent with this.
4. **Bundle immediate-timetag override is not round-tripping.** We set `bundle.timetag.value.seconds = 0; fractions = 1` after construction — if osc-js captures a copy of the timetag at bundle construction (before our override), the encoded bytes still carry the original future timestamp. Worth verifying by dumping packed bytes.

### 3.5 Alternative designs that would sidestep the routing concerns

1. **Reader-owned synth creation.** Have the Rust reader itself send `/d_recv` + `/b_alloc` + `/s_new` for the recorder — all from its own UDP socket. scsynth then sees that socket as the synth's owner, and `SendTrig`'s `/tr` routes unambiguously back to the reader regardless of `/notify` semantics. `sc-test` reduces to "ask the reader to scope bus N" via a Tauri command. Biggest refactor but cleanest; probably the right end-state.
2. **Control-bus polling instead of `/tr`.** Publish the phase on a control bus (`Out.kr(phaseBus, A2K.kr(phase))`), have the reader `/c_get phaseBus` every ~100 ms. `/c_set` replies go to the `/c_get` sender's socket — no broadcasting, no client-ID confusion. Slightly more OSC traffic (10 Hz vs 200 Hz, but roundtrips); architecturally independent of `/notify`.
3. **Completion-message chaining.** `/d_recv` and `/b_alloc` both accept completion-messages. Fire `/d_recv bytes [/b_alloc [/s_new]]` nested and let scsynth do the sequencing. Robust to async latency, client-side timing irrelevant. Requires extending `defRecvMessage` / `bufAllocMessage` to accept completion args (raw OSC bytes).

My recommendation if this is picked back up: **option 1 (reader-owned synth)**. It makes the `/tr` routing question moot and is the design the Rust reader would eventually need to grow into anyway (so the same code path can back a future headless `sc-app record` CLI command).

### 3.6 Files touched in the WIP commit

- `src-tauri/src/ipc/buffer.rs` — phase-tracked reader path, `/notify 1` on connect, `extract_tr_phase`, renamed walker.
- `src/sc-elements/sc-test.ts` — `SendTrig`-emitting synthdef, promise-based `ensureRecorderLoaded`, `_activating` guard.
- `src/lib/osc/OscService.ts` — immediate-timetag override for bundles.

### 3.7 Minimal reproduction

Load `test-plugin` native (`yarn tauri dev`), enable `dumpOSC 2` on scsynth. The trace ends with `FAILURE IN SERVER /s_new SynthDef not found`, `Group 1001 not found`, `/b_getn index out of range`. Even if a pre-existing plugin (scope-plugin) works visually, test-plugin does not — suggesting the problem is specific to how sc-test's lifecycle interacts with scsynth, not the phase-tracking concept itself.
