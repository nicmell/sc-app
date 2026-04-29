# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`history.md`](./history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 23 in flight.**
Phases 0–22 + 24 shipped (see `history.md`). Pending phases planned
below; longer-term candidates in *Future Improvements*.

Phase 24 (`/fail` surface) shipped out of order — independent of 23
per the original sequencing note. Phase 23 (logging pipeline) gains
a hookup point for the `/fail` events to be persisted server-side
once it lands.

---

## Phase 23 — Unified logging pipeline

**Goal.** Persist frontend logs in serve mode (today only Tauri
can write to disk via the `fs` plugin; serve-mode logs are
browser-only and lost on refresh). Add structured backend logging
tagged by session. End state: one log file per day per `serve`
instance, containing both bridge events (sessions, errors,
scsynth I/O) and frontend ERROR-level events, all timestamped +
clientId-tagged for cross-correlation. Frontend keeps its
in-memory ring + an IndexedDB persistence layer + a Download
button for end-user "send me the log" workflows.

**Why this framing.** Two audiences — end users / developers want
browser-side context (errors, OSC traffic, state transitions);
serve operators want server-side visibility (sessions, scsynth
health, error rates). Tauri can solve the first locally; serve
can't. Solving them with one architecture (HTTP POST to the
bridge, used by both Tauri and serve) avoids platform forks.
Builds directly on Phase 22's per-session state and `tracing`
foundations.

### Proposed shape

1. **Frontend: in-memory + IndexedDB + Download.** `debugLog.ts`
   keeps the ring buffer; add an IndexedDB layer that mirrors it
   across reloads. Download button dumps NDJSON via
   `<a download>`.

2. **Frontend: ship to backend.** New `src/util/logShipper.ts`
   batches non-ERROR events every Ns (default 5 s) and
   force-flushes ERROR immediately. POSTs NDJSON to
   `/api/logs`.

3. **Bridge: HTTP endpoint.** `POST /api/logs` accepts NDJSON.
   Validates body size, rate-limits per session. Annotates lines
   with the session's `clientId` from Phase 22 state, forwards
   into the bridge's `tracing` pipeline.

4. **Bridge: structured logging.** `eprintln!` → `tracing` spans
   per session. Span carries clientId once notify resolves.

5. **File output.** `tracing-appender` with daily rotation.
   `--log-dir` (default `./logs/`) and `--log-retention-days`
   (default 7). One NDJSON file per day, multi-source (bridge
   events + frontend POST batches), sorted by timestamp.

6. **HTTP, not WebSocket, for shipping.** Chosen because
   (a) multiplexing onto the OSC WS would force a frame
   discriminator and break its `bytes ↔ datagram` simplicity;
   (b) HTTP gives per-batch ack and retry for free; (c) HTTP
   works even when the WS is dead — needed for logging WS-close
   events themselves.

### File map

```
src-tauri/
  Cargo.toml                          # tracing, tracing-subscriber,
                                      # tracing-appender
  src/server/
    mod.rs                            # POST /api/logs route + tracing init
    ws_bridge.rs                      # eprintln! → tracing! (uses Phase 22
                                      # session state for span context)
    log_ingest.rs (NEW)               # NDJSON parse, size/rate caps,
                                      # forward to tracing
src/
  util/
    debugLog.ts                       # add IndexedDB persistence layer
    logShipper.ts (NEW)               # batch + POST /api/logs
  ui/
    DebugLog/                         # add Download button
```

### Acceptance criteria

- Run `serve`, induce a session, hard-kill the browser → the
  day's file in `--log-dir` contains the session's bridge events
  plus any frontend ERROR-level events that flushed.
- File lines are NDJSON, parseable by `jq`, sortable by
  `timestamp`, filterable by `clientId`.
- "Download logs" saves a complete NDJSON of the session's
  frontend ring.
- IndexedDB persists across F5 reloads (panel still shows
  pre-reload entries).
- Rate limit drops a synthetic flood without crashing the bridge
  or filling disk; logs a "logs dropped: N" counter.
- Tauri uses the same `/api/logs` endpoint — no platform fork.

### Open questions

1. **Default log directory.** `./logs/` is convenient but breaks
   if `serve` is launched from `/`. Consider `$STATE_DIRECTORY`
   (systemd) or `~/.local/state/sc-app/`. Punt to a `--log-dir`
   flag with no magic default.
2. **Retention enforcement.** `tracing-appender` doesn't delete
   old files. One-shot cleanup at startup, or background task?
3. **Frontend shipping levels.** Default ship: ERROR + WARN
   (urgent), INFO + DEBUG batched. UI toggle?
4. **Volume cap per session.** ~1 MB/min per clientId? Drop +
   counter, or 429?
5. **Privacy.** Recording labels and scsynth addresses can leak
   to disk. Document; don't filter (operators want them).

### Risks

- **Disk fill on long-running deployments.** 7-day default may be
  generous; configurable.
- **Log flood backpressure.** Buggy frontend in a tight error
  loop spams `/api/logs`. Rate limit + drop is the answer.
- **No new dependency for Tauri.** Tauri already needs the bridge
  for OSC; logging through it is no new constraint.

### Out of scope

- Real-time log tailing in a UI panel (operator dashboard) — WS
  or SSE territory; deferred.
- Centralized shipping to external services (Loki, Datadog).
  Local files only.
- Frontend log filtering UI beyond what `DebugLog` already has.

### Files (as landed)

*To fill in during implementation.*

### Adaptations

*To fill in during implementation.*

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
   Phase 5 / 8 gotchas in `history.md`). The original plan had it
   inverted; verified empirically.
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

Vitest is already set up in workspace packages.

**Cost:** ~1 day.

### 6. Persistent UI settings

`localStorage` per-session: last-used scsynth address (already
done), preferred chunkSize, channel count, recording bus, window
size.

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
