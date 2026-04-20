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

## 3. Buffer-stream phase-tracking

Captured 2026-04-19, updated 2026-04-20. The plumbing end-to-end now works — `test-plugin` runs, `sc-test` activates, `/tr` is emitted — but the result is only *partially* clean: seams are noticeably mitigated, not eliminated.

### 3.1 Why this work exists

The buffer-polling design has an inherent "seam zone": reader (tokio wall-clock) and writer (scsynth DSP) advance on independent clocks with a phase offset fixed at startup; when that offset puts the writer's head *inside* a single `/b_getn` read range, the returned batch interleaves samples from two buffer cycles. This renders as a mid-frame kink in `sc-scope` and an audio click in anything that treats the batch as a recording.

Widening `chunks` brings the probability down to `≈ 1 / chunks`, but doesn't eliminate it. For `sc-scope`-class visual use the `chunks=8, frames=16384` default is enough; sample-accurate recording needs the reader to *know* where the writer is and stay consistently behind it.

### 3.2 Current implementation

**Writer synthdef** (compiled once per sc-test component):

```
In.ar(bus, 1)                      → sig
Phasor.ar(0, 1, 0, TEST_FRAMES)    → phase
BufWr.ar(sig, bufnum, phase, 1)
A2K.kr(phase)                      → phaseKr
SendTrig.kr(Impulse.kr(200), bufnum, phaseKr)
```

`Phasor` makes the write head explicit; `BufWr` writes at that phase; `SendTrig.kr` fires `/tr [nodeID, bufnum, phase]` 200× per second tagged with `bufnum`.

**Rust reader** (`spawn_reader` in `src-tauri/src/ipc/buffer.rs`):

```
On socket startup: send /notify 1 so scsynth broadcasts /tr to this socket.
On each /tr with triggerID == bufnum:
    first arrival: samples_issued = phase - safety   (no positive wrap — pos_mod handles
                                                      negatives correctly)
    every arrival: writer_anchor = (phase, Instant::now())
In tick loop (16 ms):
    if anchor: target = anchor_phase + elapsed_since_anchor * sr - safety_samples
    else:      target = elapsed_since_reader_start * sr                (wall-clock fallback)
    issue /b_getn in chunk-sized increments until samples_issued >= target
```

`safety_samples = min(2 × chunk, frames / 2)` keeps the reader that many samples behind the writer.

**Plugin-author contract**: the plain `sc-buffer` + `RecordBuf` path stays in wall-clock mode. `sc-test` flips into phase-tracked mode automatically because its synthdef emits `/tr`.

### 3.3 What was fixed (2026-04-20)

Three classes of problem showed up during integration and have been resolved — the code below works end-to-end now:

1. **OSC reply-driven dispatch**. `OscService` methods for `/g_new`, `/s_new`, `/d_recv`, `/b_alloc` etc. now register a one-shot listener on the matching reply (`/n_go`, `/done`, ...) **before** calling `send()`, and dispatch the `runtimeApi.*` store action only once the reply arrives. Store-`loaded` flags flip *after* scsynth confirms, so children gated on `parent.runtime.loaded` no longer race ahead.
2. **`sc-synth` deps-ready gating**. `ScSynth` tracks a reactive `depsReady` state (parent loaded + target synthdef loaded + every buffer referenced by child `sc-control` `targets` loaded). `/s_new` is deferred in `_onStateChange` until that flag flips true — so `/s_new "foo"` never arrives before `/d_recv foo` has been acknowledged, and `bufnum` substitutions never point at unallocated buffers.
3. **sc-test synthdef cache invalidation**. The module-level `recorderReady` Promise cached `/d_recv` completion across sessions, so after scsynth restarts the cached resolved Promise made `ensureRecorderLoaded` skip re-sending. Dropped the cross-activation cache — compiled bytes are still cached (deterministic) but `/d_recv` is re-sent on every `_activate`. `/d_recv` is idempotent on scsynth, so the duplicate traffic is harmless.

### 3.4 What still isn't perfect

Even with the plumbing correct, the reader is not seam-free. Known reasons, in decreasing order of concern:

1. **Safety budget is marginal for small buffers.** `safety_samples` is clamped to `frames / 2`. For `frames=2048, chunks=2, chunk=1024` (a test configuration), that clamps safety to `1 × chunk`. The read `[writer_pos - chunk, writer_pos]` ends exactly at the writer's head — any positive drift overtakes. `frames ≥ 4 × chunk` is the practical floor; the default `frames=8192, chunks=4` respects it (`safety = 2 × chunk < frames/2`).
2. **`/tr` routing to the reader socket is not fully verified.** SC's `SendDoneToAllNotified` is supposed to broadcast to every `/notify`-ed client, so our reader — which `/notify 1`s on startup — should receive `/tr`. But depending on SC version and client-ID configuration, routing may favour the synth-creator socket. No runtime log confirms anchor is actually being set in practice; adding an `eprintln!` on first anchor would close this loop.
3. **Scsynth's `dumpOSC 1` is incoming-only** (`OscService` configures level 1 on connect). `/tr` is outgoing, so its absence from the console tells you nothing. Verifying `/tr` flow requires setting `dumpOSC 2` manually from sclang, or logging reader-side receipt.

### 3.5 Possible optimisations

Ordered by cost/impact:

1. **Log anchor events.** Trivial — add `eprintln!("reader[{bufnum}] anchored at phase {phase}")` on the first successful `extract_tr_phase`. Turns "is phase tracking engaged?" from guesswork into a single-line check. (~5 LOC.)
2. **Auto-bump `dumpOSC` to level 2 during development.** Option flag, or replace the `1` default in `OscService`'s `open` handler. Trade-off: louder logs. (~1 LOC.)
3. **Enforce `frames ≥ 4 × chunk` at component level.** `sc-buffer` / `sc-test` could validate or auto-round `frames` up. Prevents the "tiny-buffer safety collapse" footgun. (~10 LOC.)
4. **Reader-owned synth creation** (NOTES §3.6 option 1 below). Biggest refactor, but makes `/tr` routing deterministic — scsynth sees the reader's socket as the synth's creator, so `SendTrig` delivery is unambiguous. Same code path eventually backs a headless `sc-app record` CLI.
5. **Control-bus polling instead of `/tr`.** `Out.kr(phaseBus, A2K.kr(phase))`, reader `/c_get phaseBus` every ~100 ms. `/c_set` replies route to the `/c_get` sender's socket — no broadcast, no client-ID confusion. Lower anchor rate, higher bandwidth per anchor. Independent of `/notify` semantics.
6. **Completion-message chaining on `/d_recv` and `/b_alloc`**. Fire `/d_recv bytes [/b_alloc [/s_new]]` nested; scsynth does the sequencing internally. Redundant now that §3.3.1 handles it client-side, but more robust to drop/reorder at the UDP layer.

### 3.6 Files involved

- `src-tauri/src/ipc/buffer.rs` — phase-tracked reader, `/notify 1` on socket connect, `extract_tr_phase`, `walk_b_setn`. Re-anchors on every `/tr`; drops the wrap-to-positive on initial `samples_issued` positioning.
- `src/sc-elements/sc-test.ts` — `SendTrig`-emitting synthdef; `sendRecorderSynthdef()` re-sends `/d_recv` every activation.
- `src/lib/osc/OscService.ts` — `once(address, match)` helper; async create/free methods await their matching scsynth reply before dispatching.
- `src/sc-elements/sc-synth.ts` — reactive `depsReady` state, `/s_new` fired from `_onStateChange` only once synthdef + bound buffers are loaded.
