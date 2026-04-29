# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`history.md`](./history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 22 in flight; Phases 23–25 sketched as follow-ons.**
Phases 0–21 shipped (see `history.md`). Pending phases planned
below; longer-term candidates in *Future Improvements*.

Sequencing: 22 (per-session bridge state) → 23 (unified logging
pipeline, depends on 22's session state + tracing foundations) →
24 (scsynth `/fail` surface, independent but stronger after 23
lands so errors persist to disk via the log pipeline) → 25
(SuperDirt OSC shell, independent of 22–24 but lands cleaner
*after* 22 so the new `/ws/dirt` route slots into the same
per-session bridge state instead of churning `ws_bridge.rs`
twice).

---

## Phase 22 — Per-session bridge state (first user: disconnect cleanup)

**Goal.** Introduce per-session state in the Rust bridge. The
first user is ungraceful-disconnect cleanup: when a WebSocket
closes for any reason — clean disconnect, network drop, browser
crash, laptop lid — the bridge fires cleanup OSC to scsynth so
the client's parent group, allocated buffers, notify
subscription, and lientId slot are released. Today cleanup runs
only on the frontend (`handleDisconnect`, `pagehide`); ungraceful
closes leak. With `maxLogins = 32`, ~32 dirty disconnects exhaust
scsynth's slot pool until restart.

**Why this framing.** The Rust backend today is 492 LOC of pure
transport — zero application state, `eprintln!`-only logging, no
operator visibility. Several already-roadmapped items need
bridge-side state anyway; this phase is the natural moment to
introduce it. The cleanup fix is the smallest concrete user that
forces the shape into existence.

### Enables (downstream beneficiaries)

None of these ship in Phase 22. Listed so the architectural shift
is honestly priced — and so Approach B's "keep the bridge dumb"
cost is visible: every item below would re-litigate the same
decision under B.

| Capability | Current | After Phase 22 |
|---|---|---|
| Structured logging (`tracing` per-session spans) | `eprintln!` only | session struct = natural span carrier |
| Per-session metrics (frames, bytes, duration) | None | counters live in session struct |
| Session cap + `/sessions` HTTP endpoint | No visibility | trivial once state is per-session |
| `/healthz` operator probe | None | reports session count + scsynth reachability |
| Allow-list for `?scsynth=HOST:PORT` | Open UDP relay (mitigated only by 127.0.0.1 bind) | bridge gains the policy hook point |
| Tauri-managed scsynth lifecycle (FI#4) | Not built | session can hold a sidecar handle |
| Streaming-to-disk WAV (FI#2) | Main-thread only | extends the OSC awareness this phase introduces |
| scsynth crash detection ("no replies for Ns") | Frontend `/status` heartbeat | bridge already snoops replies — easy add |

### Approaches considered

Two designs were weighed before locking in. Recording both so the
trade-off is auditable, and so the rejected approach is on the
shelf if its strengths ever bite.

#### Approach A — Bridge-side OSC-aware cleanup (chosen)

The Rust bridge becomes minimally OSC-aware: snoops `/done
/notify` to learn the session's `clientId`, detects WS close via
the existing `tokio-tungstenite` event stream, and fires three
cleanup messages (`/g_freeAll`, `/n_free`, `/notify 0`) over the
still-alive UDP socket before tearing down. Per-session state
lives in the WS task's stack frame.

#### Approach B — Frontend heartbeat + dumb bridge + reaper task

Bridge stays a pure byte forwarder (status quo). Frontend sends a
periodic app-level heartbeat (e.g. once per second) over a side
channel — either an HTTP `POST /session/heartbeat` or a special
OSC address the bridge intercepts. A separate Rust reaper task
maintains a `Map<sessionId, lastSeen>` plus a `Map<sessionId,
clientId>`; when a session's heartbeat is N seconds stale, the
reaper opens its own UDP socket to scsynth and fires the same
cleanup bundle.

#### Comparison

| Concern | A: Bridge-side | B: Heartbeat + reaper |
|---|---|---|
| **Catches WS-detectable close** (clean close, TCP RST, browser tab close) | Yes, instantly | Yes, but on heartbeat-miss latency (N×period) |
| **Catches half-open TCP** (cable yanked, no RST) | Only when TCP keepalive fires (~2h Linux default) — punt to A' below | Yes, within heartbeat timeout |
| **Catches frozen frontend** (JS event loop stuck, WS still ack'd by OS) | No | Yes |
| **OSC encoding lives where** | In the bridge (small slice) | In the reaper (same slice, different process) |
| **Must know clientId per session** | Yes — snoops `/done /notify` once | Yes — also needs snooping or a frontend-reported channel |
| **Constant network traffic** | None | Heartbeat every N seconds × N clients |
| **Tuning surface** | One knob (cleanup-send delay, ~50 ms) | Two knobs (heartbeat period, staleness threshold) + grace tuning |
| **Moving parts** | One state struct in WS task | Reaper task, two maps, side channel, heartbeat loop on frontend |
| **State on hard server crash** | Lost cleanly with the process | Lost cleanly with the process |
| **Lines of code (rough)** | ~80 Rust + 0 TS | ~200 Rust + ~30 TS + endpoint plumbing |

#### Decision

**A, with the option to add A'** (WS-level `Ping/Pong` frames every
Ns, surfacing missed pongs as a synthetic close) **later** if
half-open TCP becomes a real failure mode. A' is a small
refinement of A — same cleanup path, just a faster detector — not
a different architecture.

A is chosen because:

- The dominant failure cases (tab close, browser crash, network
  drop with TCP signal) are caught by WS close events
  *immediately*. B's heartbeat-miss latency is strictly worse
  for these.
- B's only genuine wins (half-open + frozen frontend) are
  addressable later: half-open via A', frozen frontend via the
  same A' path or a future heartbeat layered on top.
- B doesn't actually avoid OSC awareness — it just relocates it
  to the reaper. The architectural "win" of keeping the bridge
  dumb is illusory once you trace through where clientId
  tracking has to live.
- Less code, fewer knobs, fewer processes.

B stays on the shelf in this section; if a future deployment
shows symptoms A can't catch, revisit.

### Proposed shape

1. **Per-session state.** `ws_bridge.rs` gains a small struct per
   WS connection: `{ client_id: Option<i32>, parent_group_id:
   Option<i32> }`. Stack-allocated, lives for the duration of the
   WS task.

2. **Snoop `/done /notify` on the scsynth → WS reply path.**
   Cheap prefix check first; when the address matches `/done
   /notify`, extract `args[1]` as `clientId` and stash it.
   Compute `parent_group_id = clientId × 100` (with the
   `0 → 100` fallback already used on the frontend).

3. **On WS close, send cleanup over the still-alive UDP socket.**
   Bundle: `/g_freeAll <parentGroupId>`, `/n_free
   <parentGroupId>`, `/notify 0`. Wait ~50 ms (knob), then drop
   the UDP socket. Idempotent — if the frontend already cleaned
   up via `pagehide` / `handleDisconnect`, scsynth no-ops the
   redundant frees and returns `/fail /notify` for the second
   `/notify 0`, which we ignore.

4. **Frontend unchanged.** `handleDisconnect` + `pagehide` still
   fire eagerly. The bridge is a safety net, not a replacement —
   the frontend path stays the fastest cleanup since it can run
   before the WS even closes.

5. **No allocator state on our side.** Each new WS opens a fresh
   ephemeral UDP socket and gets a fresh `clientId` from
   scsynth's notify pool. Session independence is automatic at
   the scsynth level.

### File map

```
src-tauri/
  Cargo.toml                          # add rosc = "0.10"
  src/server/
    ws_bridge.rs                      # main edit: per-session state,
                                      # /done /notify snoop, WS-close
                                      # cleanup
    osc_cleanup.rs (NEW, optional)    # encode helpers for /g_freeAll,
                                      # /n_free, /notify 0; reply-parse
                                      # for /done /notify — split out
                                      # only if ws_bridge gets noisy
```

No frontend changes — TS-side cleanup paths already do their job
for clean closes.

### Acceptance criteria

- Hard-killing a browser tab (or `kill -9` on the WS process) →
  within ~100 ms, scsynth's `/g_queryTree` shows the parent group
  freed.
- Simulated network drop (e.g. `tc qdisc add dev lo root netem
  loss 100%`) → same outcome.
- Clean disconnect path still works: no double-free errors at
  scsynth, no observable difference vs. today. Bridge cleanup
  runs but no-ops because the frontend got there first.
- A second WS connection after a dirty disconnect of the first
  receives a *different* `clientId` from scsynth (proves the slot
  was released).
- Server-side log line per cleanup, e.g. `[ws_bridge] session 7f3a
  closed (clientId=3) — sent cleanup`.

### Open questions

1. **Cleanup-send to socket-drop delay.** UDP is fire-and-forget;
   the bundle must reach scsynth before we drop the local
   socket. 50 ms is generous on localhost; revisit if tests show
   issues. Make it a `const`.
2. **Reply-snoop filter.** Every `/b_setn` reply hits the
   inbound path. Use a byte-prefix check (first 8 bytes start
   with `/done\0\0\0`) before invoking `rosc::decoder` —
   sub-microsecond filter, only the rare `/done` replies pay the
   full decode cost.
3. **Early-close case.** WS closes before `/done /notify`
   arrives → `client_id = None` → skip cleanup. Frontend never
   allocated anything either. No-op is correct.
4. **Logging level.** `info!` for cleanups actually fired,
   `debug!` for "no clientId, nothing to clean". Useful for
   serve-mode operators without being noisy under Tauri.
5. **`rosc` version.** `rosc = "0.10"` is current and minimal.
   Confirm transitive deps are clean at impl time.

### Risks

- **OSC-aware bridge.** The bridge stops being a pure byte
  transport. Justified by the failure case, but the OSC
  awareness must stay tightly scoped: parse `/done` replies,
  encode three cleanup messages — nothing else creeps in.
- **`/notify 0` after slot already released.** scsynth replies
  `/fail /notify "Notification not registered."`; we ignore fail
  replies on cleanup. Doesn't propagate anywhere.
- **`maxLogins` capacity.** Default 32. If a deployment churns
  harder than that, even with cleanup the pool can saturate
  temporarily (cleanup is async wrt new connects). Out of scope
  for this phase; candidate for a future "session capacity
  warning" surface.

### Out of scope (do not creep)

- WS heartbeat / keepalive layer.
- Reconnection + disconnected UX (Future Improvement #3 — a
  frontend concern; this phase fixes the leak, not the user
  experience after a drop).
- Tauri-managed scsynth lifecycle (Future Improvement #4).
- Surfacing `maxLogins` in `/status` UI.
- Frontend changes — current cleanup paths stay as-is.

### Files (as landed)

*To fill in during implementation.*

### Adaptations

*To fill in during implementation.*

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

## Phase 24 — scsynth `/fail` surface

**Goal.** scsynth replies with `/fail /<originatingCommand>
"<error>" [extras]` whenever it rejects a command. Today only one
matcher consumes these (`/fail /d_recv` in `SynthDefRegistry`);
every other `/fail` flows silently into `onReply` and gets
dropped. Surface unmatched `/fail` events through a centralized
error bus, render them in the UI (errors panel + transient toasts
+ header badge), and forward them to the log pipeline.

**Why this framing.** Most user-visible bugs in this app are
silent failures: `/s_new` against a missing SynthDef, `/b_setn`
after a buffer was freed, `/n_free` on a stale node. The decoder
already exists in `@sc-app/server-commands` (`Fail.commandAddress`,
`Fail.error`); the gap is purely "no global subscriber." Pure
frontend phase, closes a major diagnostic hole.

### Proposed shape

1. **Worker emits `oscError`.** On the inbound path, after decode,
   intercept any reply where `address === '/fail'`. Emit a typed
   `oscError` event to main with `{ commandAddress, errorString,
   extras, receivedAt }`. The reply still flows through `onReply`
   so existing awaiters (e.g. `SynthDefRegistry`) keep working —
   emitting both is intentional, simpler than tracking which
   awaiter would have matched.

2. **Main: `ServerErrorBus`.** New controller in `src/server/`,
   exposes `ReadonlyStore<OscError[]>` (ring ~100 entries).
   Subscribes to `oscError` from `WorkerClient`. Forwards each
   event to `console.error` and (when Phase 23 lands) to the log
   shipper.

3. **UI — three surfaces:**
   - **Errors panel** (section in `DebugLog`, or dedicated
     `ErrorsPanel`): timestamp, command, message, extras.
   - **Toast** (corner, auto-dismiss ~5 s): most recent error,
     dismissable, click-through to the panel.
   - **Header badge**: ⚠ N counter; click opens the panel; resets
     to 0 on open.

4. **Suppression: simple first cut, none.** Phase 22 cleanup will
   produce a brief `/fail /notify "Notification not registered"`
   on already-released slots; users see a one-shot toast at
   disconnect, document as benign. If real noise emerges, add
   `markExpected(predicate, ttlMs)` later.

5. **Reuse existing `Fail` accessor** — no new OSC parsing.

### File map

```
src/
  server/
    ServerErrorBus.ts (NEW)           # ring buffer + reactive store
    WorkerClient.ts                   # add onOscError subscription channel
  workers/
    oscWorker.ts                      # intercept /fail on inbound, emit oscError
    workerProtocol.ts                 # add OscError message shape
  ui/
    DebugLog/                         # add Errors section
    ErrorsToast/ (NEW, optional)      # corner toast component
    ClockPanel/                       # or wherever header chrome lives — badge
```

### Acceptance criteria

- Manually fire `/s_new "doesNotExist"` (e.g. via the OscConsole
  if remounted, or a test path) → toast appears, errors panel
  shows the entry, header badge increments.
- `SynthDefRegistry` still rejects on `/fail /d_recv` as today
  (no regression).
- Bus ring caps at ~100 entries — older drop without UI freeze.
- Phase 22 cleanup-time `/fail /notify` shows up as a single
  benign entry (acceptable noise; documented).
- After Phase 23 lands, `/fail` events appear in `--log-dir`
  files server-side, tagged with clientId.

### Open questions

1. **Toast vs. modal.** First cut: toast (non-blocking). Reserve
   `ErrorModal` for fatal runtime errors (scsynth death, WS
   close). Confirm.
2. **Header badge placement.** Next to the `/status` snapshot? Or
   a dedicated dashboard row?
3. **Ring size.** 100 is fine for a first cut — match `debugLog`.
   Configurable later.
4. **Suppression default.** Simple (none) vs. precise
   (`markExpected`). Recommend simple unless cleanup noise turns
   out loud.
5. **Bundle errors.** When a bundled command fails, scsynth emits
   `/fail` with the originating sub-command. `Fail.commandAddress`
   already gives this; ensure the panel shows it prominently.

### Risks

- **Noise overwhelms the panel.** Buggy code path firing `/fail`
  per tick fills the ring in seconds. Mitigate: count consecutive
  duplicates ("12× /fail /s_new …") rather than repeat.
- **Awaiter double-handling.** Both `onReply` matcher and the
  bus see the event. Intentional — simpler than dedup, and the
  raw `/fail` in the panel is useful even when an awaiter
  rejected with a friendlier message.

### Out of scope

- Suppression API (`markExpected`) — added later if needed.
- Categorization beyond raw `/fail` (severity grading, retry
  suggestions).
- scsynth `late N` stdout messages — not OSC; out of frontend
  reach.
- Reconnection on fatal `/fail` patterns.

### Files (as landed)

*To fill in during implementation.*

### Adaptations

*To fill in during implementation.*

---

## Phase 25 — SuperDirt OSC shell

**25a in flight (transport + DirtClient + dev hook landed).** 25b
(panel) and 25c (REPL + log) pending.

**Goal.** Drive a separately-running SuperDirt instance from
sc-app over OSC. A dedicated dashboard panel hosts a
host:port input, Connect/Disconnect buttons, a status pill, and
a Tidal-ish text REPL that emits `/dirt/play` events. Two
independent WebSockets share the Rust bridge: the existing one to
scsynth, a new on-demand one to SuperDirt's UDP port (default
`127.0.0.1:57120`).

**Why this framing.** SuperDirt lives at `superdirt/` as a git
submodule (already added). Architecture overview + integration
options are written up in [`superdirt.md`](./superdirt.md); this
phase implements **Option A** — the thinnest possible client. It's
the smallest piece that produces audible Dirt-style sample
playback from sc-app, and it's the prerequisite for any future
sequencer work (Options B/C in `superdirt.md`). All synthesis,
voice management, and effects stay SuperDirt's problem; sc-app is
a typed OSC dispatcher.

### Approaches considered

Two transport designs were weighed before locking in. Recording
both so the trade-off is auditable.

#### Approach A — Tagged frames over the existing WS (rejected)

One WebSocket with a one-byte target tag prepended to every frame
(`0x00`=scsynth, `0x01`=dirt). Bridge dispatches per-frame to one
of two pre-bound UDP sockets. To support on-demand connect/
disconnect, an in-band JSON control frame (`0xFE`) configures or
clears the dirt peer dynamically.

#### Approach B — Second WebSocket on `/ws/dirt` (chosen)

Independent `/ws/dirt` route in the Rust bridge. Browser opens it
on user "Connect"; closes on "Disconnect". Each WS is single-
purpose, raw OSC bytes, no tagging. UDP socket is bound at WS
open and dropped at WS close — WS open/close *is* the lifecycle.

#### Comparison

| Concern | A: Tagged frames | B: Second WS |
|---|---|---|
| Lifecycle for late-bound dirt | Needs in-band control protocol (`0xFE` JSON) | Native — open/close == connect/disconnect |
| Frame format on hot path (`/b_setn`) | Every frame pays a tag byte | Untouched |
| Reply demux | Single stream, target-byte routes back to two channels | Two streams, naturally separated |
| Failure isolation | One WS dies → both engines down | Independent — dirt drop never touches scsynth |
| Worker plumbing | Worker handles both targets, demuxes | Dirt runs on main thread; worker untouched |
| Bridge code | One WS handler, branching logic | Two WS routes, mostly disjoint |
| Code volume | Higher (tag layer + control protocol) | Lower (separate, simpler routes) |

#### Decision

**B.** With dirt being on-demand and orthogonal to scsynth, the
control-protocol overhead in A exists *only because* we forced
both onto one WS. B's open/close handshake replaces that. Two WS
routes are independently simpler than one branching WS handler.

The existing scsynth path stays in the worker (the `/b_setn` hot
path is the reason it's there); dirt runs on the main thread —
its traffic is sparse and small, and avoiding a second `osc-js`
worker bootstrap is a real saving.

### Architecture

```
Main thread                         Rust bridge                 External
  ├── WorkerClient ── ws:/ws        ── /ws  ── UDP 57110 ────── scsynth
  │   (existing, unchanged)
  └── DirtClient   ── ws:/ws/dirt   ── /ws/dirt?host=&port=── ── superdirt (sclang)
      (new, main thread)               (new, on demand)            (user runs)
```

### Proposed shape

1. **Bridge route.** `GET /ws/dirt` with required query params
   `host` and `port`. On WS open: validate, `UdpSocket::bind` an
   ephemeral local socket, `connect((host, port))`. Two
   `tokio::spawn`'d ferry tasks (WS→UDP, UDP→WS), raw OSC bytes
   each way. On WS close or any task error: drop socket, drop
   tasks. No global state; lives entirely in the WS task's stack
   frame. 400 on bad query params; refuse early before WS upgrade
   completes if practical.

2. **`DirtClient` on main thread.** New `src/dirt/DirtClient.ts`.
   No worker — `osc-js` already runs fine on the main thread
   (`window` is real). API:

   ```ts
   class DirtClient {
     connect(host: string, port: number): Promise<void>
     disconnect(): Promise<void>
     play(event: DirtEventInput, opts?: { lookaheadMs?: number }): void
     hello(timeoutMs?: number): Promise<boolean>
     setControlBus(idx: number, value: number): void
     onReply(cb: (r: { address: string; args: unknown[] }) => void): () => void
     readonly status: ReadonlyStore<'disconnected'|'connecting'|'alive'|'unreachable'>
     readonly recentEvents: ReadonlyStore<DirtEventLog[]>
   }
   ```

   `connect()` resolves only after a `/dirt/hello` round-trip
   succeeds; rejects on timeout (default 1 s) → status
   `'unreachable'`, WS closed. `play()` wraps the message in an
   `OSC.Bundle` with `timetag = Date.now() + lookaheadMs` (default
   100 ms) and ships bytes. Encoding reuses
   `@sc-app/server-commands` osc-js setup.

3. **Typed builders + reply accessors.** New `src/dirt/dirtCommands.ts`
   for `/dirt/play`, `/dirt/hello`, `/dirt/handshake`,
   `/dirt/setControlBus`. Mirrors the pattern in
   `@sc-app/server-commands` but lives in `src/dirt/` for now —
   if it grows, extract to a `packages/dirt-commands` workspace
   package later.

4. **REPL parser.** New `src/dirt/replParser.ts`. Pure function,
   easily unit-tested:
   - First bare token (no `:`) → `s` value.
   - Subsequent `key:value` pairs.
   - Numeric value if `parseFloat(v)` round-trips exact, else
     string.
   - Reject duplicate keys; throw `DirtParseError` with the
     offending token.

   Example: `bd cutoff:800 amp:0.5 n:2` →
   `{ s: 'bd', cutoff: 800, amp: 0.5, n: 2 }`.

5. **`DirtPanel` UI.** New `src/ui/DirtPanel.tsx`. Single
   self-contained panel, **no header chip**. Layout:

   ```
   ┌─ Dirt ─────────────────────────────────────┐
   │ [ 127.0.0.1:57120______ ] [Connect]        │   ← disconnected
   │ [ 127.0.0.1:57120______ ] [Disconnect] ● alive  ← connected
   │                                             │
   │ > bd cutoff:800 amp:0.5    (only when alive)│
   │                                             │
   │ Recent: bd n:2  amp:0.4   3s ago            │
   │ ▼ Replies (3)              (collapsed)      │
   └─────────────────────────────────────────────┘
   ```

   - Input pre-filled with `127.0.0.1:57120` on every mount; **no
     localStorage**. User retypes if they want a different value.
   - `parseHostPort()` handles IPv6 (`[::1]:57120`) by splitting
     on the last `:` outside brackets.
   - Connect button disabled while connecting; replaced by
     Disconnect on `'alive'`.
   - Errors (parse / unreachable / hello timeout) surface as a
     red line below the input, dismissed on next interaction.

6. **Lifecycle hooks in `AppShell`.**
   - `setupDashboard` constructs a `DirtClient` instance (in
     `'disconnected'` state) and stashes it on `DashboardResources`.
   - `teardownServerState` calls `dirtClient.disconnect()` first
     in the chain. Auto-close on scsynth disconnect.
   - chunkSize re-init does **not** touch the dirt client (dirt is
     orthogonal to scsynth's audio config).

7. **Dev hook.** Expose `__sc.dirt` on `window` in dev mode for
   console testing — same pattern as the existing `__sc*`
   globals. Useful for verifying transport before the panel
   exists.

### Implementation order

The phase splits naturally into three contiguous slices. Each
produces something independently observable.

- **25a — transport.** Rust `/ws/dirt` route + `DirtClient`
  skeleton + `__sc.dirt` console hook. Verifiable: in devtools,
  `__sc.dirt.connect('127.0.0.1', 57120)` followed by
  `__sc.dirt.play({s:'bd'})` produces audio (assuming SuperDirt
  is running externally).
- **25b — panel.** `DirtPanel.tsx` with connection string input,
  Connect/Disconnect buttons, status pill. No REPL yet.
- **25c — REPL + log.** Text input + parser, recent-events log,
  reply log toggle.

Each slice is a natural commit boundary. Whether they ship as
sub-phases or as one Phase 25 is a call at impl time; default to
one phase unless 25a stalls on transport quirks.

### File map

```
src-tauri/
  src/server/
    ws_dirt.rs (NEW)              # /ws/dirt route + UDP ferry
    mod.rs (or similar)           # register the new route

src/
  dirt/ (NEW)
    DirtClient.ts                 # main-thread WS + status store
    dirtCommands.ts               # typed OSC builders + reply accessors
    replParser.ts                 # Tidal-ish shorthand → DirtEventInput
    parseHostPort.ts              # `host:port` (IPv6-aware) parser
    types.ts                      # DirtEventInput, DirtStatus, DirtEventLog
  ui/
    DirtPanel.tsx (NEW)           # the panel
  AppShell.tsx                    # construct+dispose DirtClient, render panel
  util/
    runtime.ts (or wherever __sc lives)  # expose __sc.dirt in dev
```

No changes to the existing scsynth WS path, worker, or
`@sc-app/server-commands`.

### Acceptance criteria

**Transport (25a):**
- `__sc.dirt.connect('127.0.0.1', 57120)` against a running
  SuperDirt: status flips to `'alive'` within ~50 ms; subsequent
  `__sc.dirt.play({s:'bd'})` produces audible kick.
- `__sc.dirt.connect('127.0.0.1', 1)` (nothing listening):
  rejects within `timeoutMs`, status → `'unreachable'`, WS closed,
  no zombie tasks Rust-side.
- `__sc.dirt.disconnect()` closes WS; subsequent `play()` warns
  and is a no-op.
- `yarn build` + `yarn tauri dev` + `yarn serve` all work; the
  new route is wired in the shared crate.

**Panel (25b):**
- Panel mounts in `disconnected` state with `127.0.0.1:57120`
  pre-filled. Click Connect → `connecting` → `alive`. Connect
  button replaced by Disconnect.
- Click Disconnect → returns to `disconnected`. Status pill
  reflects state at all times.
- Hard-disconnect from scsynth (return to Connect screen) closes
  the dirt WS as part of `teardownServerState`. Reconnecting to
  scsynth lands in dashboard with dirt back to `disconnected`.
- Bad host:port shows an inline error, doesn't attempt connect.

**REPL (25c):**
- `bd` → audible kick.
- `bd n:2 amp:0.5 cutoff:800` → multi-key event audible with
  expected parameters.
- Parse errors (e.g. `bd cutoff:abc`) surface inline; nothing is
  sent.
- Recent-events log shows last 20 entries with relative
  timestamps.
- Reply log toggle reveals `/dirt/hello/reply` and any other
  `/dirt/*` replies received.

### Open questions

1. **Where is the route table?** `yarn serve` and `yarn tauri
   dev` need to share the new route. Need to read the Rust crate
   and confirm there's a single registration point; if not, light
   refactor first to centralise.
2. **Ferry buffer sizing.** Dirt traffic is small (`/dirt/play`
   ≤ 1 KB typical). Use `tokio::io` defaults; don't over-engineer.
3. **`/dirt/hello` reply matching.** No transaction id in
   SuperDirt's reply, so two concurrent `hello()` calls would
   race. Serialise with a single in-flight flag (reject
   overlapping calls) — fine for what it is.
4. **`cps` semantics in REPL.** Tidal treats `cps` as a per-event
   key, but it's actually per-orbit-permanent in SuperDirt. Match
   SuperDirt's behaviour (treat as a key like any other) and
   document the gotcha in the panel help.
5. **IPv6 input UX.** Forces `[…]:port` brackets. Document via
   placeholder text or inline help; don't auto-detect.
6. **Phase 22 ordering.** If 22 lands first (the in-flight
   per-session bridge state), the new `/ws/dirt` route should
   slot into the same `Cargo.toml` deps and use the same
   `tracing` setup if available. If 25 lands first, 22 picks up
   on the additional route. No hard ordering, but 22-first is
   slightly cleaner.

### Risks

- **Submodule discoverability.** New contributors need to know
  that `git clone` of sc-app should be followed by
  `git submodule update --init` to populate `superdirt/`.
  Document in README. The submodule itself is reference-only —
  no build step, nothing imports from it.
- **OSC port confusion.** scsynth on 57110, SuperDirt on 57120.
  Easy to type the wrong one and wonder why nothing happens.
  Inline placeholder text helps; an alive-status indicator
  catches it within 1 s either way.
- **Sample namespace blindness.** Without a sample browser (Q
  deferred from `superdirt.md`), the user must know that `bd`,
  `sn`, `cp`, etc. exist. Fine for the OSC-shell scope; a real
  blocker for any future sequencer UI (Phase 26+).
- **REPL grammar drift.** Tidal's mini-notation is far richer
  than `key:value`; users coming from Tidal may type
  `bd*4 cp(3,8)` and be surprised. Document scope explicitly:
  this is *event* shorthand, not pattern shorthand.

### Out of scope (do not creep)

- Sequencer / pattern playback. Option B from `superdirt.md`,
  separate phase.
- Native SuperDirt port (Option C). Far future.
- Sample browser / autocomplete for `s` strings.
- Auto-launching `sclang` from sc-app. User runs SuperDirt
  externally; document in README.
- Persistence of the connection string.
- Header-chip status indicator. Single panel only.
- IPv6 auto-formatting / hostname validation beyond
  parse-and-pass.

### Files (as landed)

**25a — transport + DirtClient + dev hook + launch infra:**

```
scripts/
  setup-superdirt-deps.sh             # NEW — yarn superdirt-setup
                                      # fetches Dirt-Samples + Vowel quark
                                      # + sc3-plugins (macOS) into
                                      # superdirt-deps/. Strips macOS
                                      # ._*.scx AppleDouble files.
                                      # Idempotent.
  start-scsynth.sh                    # NEW — yarn scsynth (dev)
                                      # foreground scsynth on 57110
                                      # with SuperDirt-required flags
                                      # + per-OS -U plugin path
  sc-app-scsynth.service              # NEW — systemd unit template
                                      # for Pi prod (same flag set)
  cleanup.sh                          # NEW — yarn cleanup
                                      # wipes superdirt-deps/ + dist/
                                      # + src-tauri/target/ for a
                                      # fresh-slate rebuild
  start-superdirt.sh                  # NEW — yarn superdirt
                                      # generates sclang_conf.yaml at run
                                      # time, includePaths pinned to
                                      # SCClassLibrary + superdirt/ +
                                      # superdirt-deps/{Vowel,sc3-plugins};
                                      # exec sclang -l <conf> startup.scd
  sc-app-superdirt-startup.scd        # NEW — attach-mode startup
                                      # wrapped in Routine.run({…}).
                                      # Polls for serverRunning, then
                                      # /notify + /sync + SuperDirt
                                      # mount. Reads samples path
                                      # from SC_APP_DIRT_SAMPLES.
.gitignore                            # +/superdirt-deps/ entry
package.json                          # +superdirt + superdirt-setup scripts
CLAUDE.md                             # Common commands +yarn superdirt(-setup)
src-tauri/src/server/
  ws_dirt.rs                          # NEW — UDP ferry, mirrors ws_bridge
  mod.rs                              # +/ws/dirt route, DirtWsQuery,
                                      # ws_dirt_handler with hostname
                                      # resolution via tokio::net::lookup_host
src/dirt/
  types.ts                            # NEW — DirtArg, DirtEventInput,
                                      # DirtStatus, DirtReply, DirtEventLog
  dirtCommands.ts                     # NEW — typed builders + reply addrs
  DirtClient.ts                       # NEW — main-thread WS client
src/AppShell.tsx                      # construct DirtClient at handleConnect,
                                      # reuse it across chunkSize re-init,
                                      # disconnect on full disconnect +
                                      # runtime-error paths, expose __scDirt
```

25b (panel) and 25c (REPL + log) — pending.

### Adaptations

- **Dev hook is `__scDirt`, not `__sc.dirt`.** The plan's
  `__sc.dirt` notation was schematic; the in-tree convention is
  flat globals (`__scClient`, `__scGroup`, `__scClock`) on
  `window`, set/cleared by an effect on `resources` change. Phase
  25a follows the existing convention.
- **Hostname resolution in the bridge.** `DirtWsQuery` accepts
  arbitrary `host` strings (not just IP literals); the handler
  resolves via `tokio::net::lookup_host` before WS upgrade so DNS
  failures surface as 400, not as silent WS opens that close
  immediately. Browser-side this means a typo'd hostname rejects
  the `connect()` promise cleanly with the bridge's error text.
- **`setupDashboard` takes a `DirtClient` arg.** Rather than
  creating one internally (which would re-create on every
  chunkSize re-init and lose the user's connection state), the
  caller (`handleConnect` for initial, `runReinit` for in-place
  rebuilds) decides. `handleConnect` constructs `new DirtClient()`
  once; `runReinit` passes `current.dirtClient` through.
- **Launch pinned to vendored submodule.** First-run dogfooding
  found that the user's system quark folder may have StrudelDirt
  (a SuperDirt fork) installed without canonical SuperDirt or
  Dirt-Samples — sclang then picks up StrudelDirt for
  `SuperDirt(2, s)` and tries to load synthdefs that need
  sc3-plugins. Solution: the launch script now passes
  `sclang -l <generated.yaml>` with an explicit `includePaths`
  list — system `SCClassLibrary` + our vendored `superdirt/`
  submodule + `superdirt-deps/{Vowel, sc3-plugins}`. Anything in
  `~/Library/.../downloaded-quarks` is invisible to the run.
  Reproducible across machines, version-locked to the submodule.
- **Custom startup .scd reads samples path from env var.**
  `scripts/sc-app-superdirt-startup.scd` (a trimmed copy of the
  example shipped with the SuperDirt quark) takes the Dirt-Samples
  glob from `SC_APP_DIRT_SAMPLES`, set by the launch script to
  `superdirt-deps/Dirt-Samples/*`. The vendored
  `superdirt/superdirt_startup.scd` is left untouched (upstream
  example).
- **`yarn superdirt-setup` for runtime deps.**
  `scripts/setup-superdirt-deps.sh` clones Dirt-Samples + Vowel.
  On macOS it downloads sc3-plugins **pinned to a specific release
  tag** (`Version-3.13.0`) for reproducibility — re-running yields
  the same binaries every time. Strips macOS AppleDouble
  (`._*.scx`) metadata files from the extracted sc3-plugins so
  scsynth's `-U` scan doesn't log `dlopen … not a valid mach-o
  file` for each. On Linux, the script just *detects* whether
  `supercollider-sc3-plugins` is installed via apt and prints the
  install instruction if not — apt-installed plugins land in
  scsynth's compiled-in default plugin path so no extra wiring is
  needed. Idempotent. The `superdirt-deps/` directory is
  `.gitignore`d.
- **scsynth's lifecycle is external; sclang attaches.** Matches
  the actual deployment model: a separate terminal on dev
  (`yarn scsynth`), a systemd unit on the Pi (template at
  `scripts/sc-app-scsynth.service`). The startup `.scd` uses
  `s.startAliveThread` + a 10s liveness poll, then `s.notify`
  + `s.sync` + `SuperDirt(2, s)` — never `s.reboot`. The whole
  body wraps in `Routine.run({...})` so sclang's command-line
  parser sees a single top-level statement (multiple top-level
  statements with `var` declarations inside `(...);` trip the
  parser).
- **`yarn scsynth` for dev; systemd unit for Pi.**
  `scripts/start-scsynth.sh` is a foreground convenience for the
  dev machine. `scripts/sc-app-scsynth.service` is a systemd
  unit template (User=, audio policy, `ExecStart=` with the same
  flags) for Pi prod. Both pass the SuperDirt-required server
  sizing: `-b 262144 -m 262144 -w 2048 -n 32768 -l 8 -i 2 -o 2`.
  Defaults are too small (Dirt-Samples needs >1k buffers,
  per-orbit graph needs ~256 MB RT memory) and SC 3.14's
  `maxLogins = 64` default exceeds sclang's hardcoded ≤32
  `/notify`-mirror cap. start-scsynth.sh also lsof-checks UDP
  57110 before launch so a leftover scsynth's bind() failure
  surfaces clearly instead of as `libc++abi: terminating`.
- **`yarn cleanup` for repeatable resets.**
  `scripts/cleanup.sh` wipes `superdirt-deps/`, `dist/`, and
  `src-tauri/target/`. Doesn't touch `node_modules/` (yarn-managed)
  or any source. After `yarn cleanup`, the natural sequence is
  `yarn superdirt-setup` + `yarn superdirt` to rebuild from scratch.

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
