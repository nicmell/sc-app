# SCSynth Oscilloscope & Recorder — Plan

Forward-looking spec. Pending phases live here in detail (open
questions, file maps, acceptance criteria). When a phase ships, it
moves to [`docs/history.md`](./docs/history.md).

Project overview, architecture diagram, architectural principles,
audio config schema, file layout, workspace packages, and the
chunkSize × sampleRate practical table all live in
[`CLAUDE.md`](./CLAUDE.md) — don't duplicate them here.

**Phase 29 in design.** Phases 0–28 are in
[`docs/history.md`](./docs/history.md). Phase 29 below is the
active piece of work — bridge-managed per-tab sessions with a
config-fetch endpoint, replacing the per-WS scsynth handshake
with a session-scoped one and removing the ConnectScreen from
the happy path.

---

## Phase 29 — Bridge-managed sessions + auto-connect

**Goal.** Move the scsynth handshake (open UDP socket, `/notify 1`,
capture clientId, capture sampleRate) from the frontend's
`handleConnect` to the Rust bridge, materialised as a per-tab
**Session** keyed by a `sessionStorage`-persisted UUID. The
frontend's first action on boot becomes a `GET`/`POST` to
`/api/session/...`; the response carries everything the
dashboard needs (`clientId`, `scsynth`, `sampleRate`,
`parentGroupId`). The ConnectScreen survives only as the
recovery / manual-override surface for session-creation failure.

The new win — beyond skipping the connect screen — is
**scsynth-side state survives a page reload (F5)**: the bridge
keeps the UDP socket and the `/notify` subscription alive across
WS reconnects within the session's TTL.

### Architectural decisions (locked unless re-opened)

- **Session ID storage = `sessionStorage`, not cookies, not URL.**
  Cookies are shared across tabs of the same browser profile —
  Tab 1 + Tab 2 would share clientId and step on each other's
  IdAllocator ranges. URLs are over-engineering for our case (no
  bookmarking, no sharing). `sessionStorage` is per-tab and
  survives reload, which is exactly the boundary we want.
- **Per-tab → per-session → per-scsynth-clientId.** Each tab gets
  its own bridge-side Session, its own UDP socket(s), its own
  `/notify 1` round-trip → its own clientId from scsynth. The
  existing IdAllocator scoping (`clientId × 1_000_000 + 1000`)
  keeps multi-tab tabs from colliding for free.
- **Bridge doesn't pre-connect at startup.** Sessions are minted
  on-demand by `POST /api/session`. A bridge with no live
  sessions holds zero UDP sockets to scsynth — scsynth being
  down at bridge startup is fine.
- **Reply routing within a session: broadcast to all attached
  WS, frontend filters.** Typically there's exactly one WS per
  session. Multiple WS per session is rare (would need someone
  to deliberately copy `sessionStorage["sc.session"]` across
  windows) and broadcast handles it. Frontend already correlates
  by sync-id / bufnum, so no per-request bookkeeping is needed
  in the bridge.
- **Sessions are in-memory only.** `DashMap<Uuid, Session>` on
  the bridge. Bridge restart = all sessions die = frontend's
  next `GET /api/session/:id` returns 404, which triggers
  `POST /api/session`. No Postgres, no on-disk persistence; the
  cost of "scsynth state lost on bridge restart" is acceptable
  because scsynth restarts already do this anyway.
- **TTL cleanup, not explicit DELETE.** Frontend doesn't reliably
  fire on tab close (we already have this problem with the
  `pagehide` mitigation). A TTL job on the bridge runs `/g_freeAll`
  + `/notify 0` on sessions idle for 30 minutes. The user-facing
  "Reset Session" path is a separate explicit `DELETE` —
  frontend clears `sessionStorage` and triggers a session-fresh
  rebuild.

### Sub-phases

- **29a — Rust: Session module + HTTP endpoints, no WS cutover.**
  ½–1 day. Add `src-tauri/src/server/session.rs` with the
  `Session` struct + `SessionStore` (DashMap). Add
  `src-tauri/src/server/api.rs` with three handlers:
  - `POST /api/session` — opens UDP sockets per route target,
    sends `/notify 1` to scsynth, awaits `/done /notify <cid>`
    with a timeout, sends `/status`, awaits `/status.reply` for
    sampleRate. Returns
    `{ sessionId, clientId, scsynth, sampleRate, parentGroupId }`.
  - `GET /api/session/:id` — read-back. 404 if absent or
    expired.
  - `DELETE /api/session/:id` — explicit teardown:
    `/g_freeAll(parentGroupId)` + `notify 0` + drop UDP sockets.
  WS bridge is unchanged this phase — still opens per-WS UDP
  sockets, ignores the session ID. Tested via curl + integration
  tests in `src-tauri`.
- **29b — Rust: WS bridge cutover.** ½–1 day. `ws_bridge.rs`
  + `routing.rs` refactor: WS upgrade reads `?session=<uuid>`
  query param, looks up the Session, attaches the WS to it.
  Outbound bytes use the Session's pre-bound UDP sockets.
  Inbound replies on the Session's UDP socket(s) fan out to all
  WS attached to the Session. Per-WS UDP sockets are gone.
  WS-disconnect no longer tears down scsynth state — that's the
  Session's job at TTL or explicit DELETE. Acceptance: F5 in
  the dev browser preserves the dashboard's scsynth side
  (clock still ticking, recordings still going, sequencer
  still scheduling).
- **29c — Frontend: bootstrap + skip per-WS handshake.** ½ day.
  New `src/session/sessionBootstrap.ts`: on app start, read
  `sessionStorage["sc.session"]`, call
  `GET /api/session/:id` → on 404 or missing key, `POST
  /api/session`. Persist the returned `sessionId`. Hand the
  rest of the response (`clientId`, `scsynth`, `sampleRate`,
  `parentGroupId`) to `AppShell` via context or a top-level
  state. AppShell's `handleConnect` is rewritten:
  - Skips the per-WS `/notify 1` round-trip (bridge already did
    it; reuse the supplied `clientId`).
  - Skips the `/status` probe (bridge supplied `sampleRate`).
  - Opens WS with `?session=<id>`.
  - Calls `setupDashboard(client, clientId, parentGroupId,
    sampleRate, chunkSize, bank)` directly.
  ConnectScreen demoted: shown only on session-creation failure
  (network error, scsynth-not-responding to `/notify`). The
  retry button POSTs again.
- **29d — TTL cleanup + Reset Session UI.** ¼ day. Bridge:
  background tokio task scans `SessionStore` every 60 s, drops
  sessions with `last_active > 30 min` (configurable in
  `config.json`). On drop, runs the same teardown as `DELETE`
  (best-effort; logs but doesn't block on errors). Frontend:
  small "Reset session" item in the dashboard header overflow
  menu (or just in the existing `Disconnect` button's place,
  with `Disconnect` repurposed) that `DELETE`s the current
  session, clears `sessionStorage`, reloads the tab — the
  bootstrap then runs through `POST /api/session` for a clean
  slate.

### Files (planned)

```
src-tauri/src/server/
  session.rs             NEW — Session struct (session_id,
                              scsynth_socket, sclang_socket map
                              keyed by route target, client_id,
                              sample_rate, parent_group_id,
                              created_at, last_active);
                              SessionStore wrapping DashMap.
  api.rs                 NEW — POST /api/session, GET
                              /api/session/:id, DELETE
                              /api/session/:id. JSON serde.
  ws_bridge.rs           EDIT — accept ?session=<uuid> on WS
                              upgrade, attach to Session.
                              Multiplex outbound through Session
                              sockets. Fan inbound replies out
                              to all WS attached to Session.
  routing.rs             EDIT — RoutingTable now operates against
                              a Session's socket map (one socket
                              per route target, owned by Session).
  mod.rs                 EDIT — wire up SessionStore at app
                              start; mount api routes; spawn TTL
                              cleanup task.
  config.rs              EDIT — add `session_ttl_seconds` config
                              field (default 1800 = 30 min).

src-tauri/src/cli/
  bridge.rs              EDIT (small) — pass SessionStore into
                              the bridge subcommand's server
                              setup.

src/
  session/
    sessionBootstrap.ts  NEW — read sessionStorage, hit
                              /api/session, return SessionInfo.
                              Used by main.tsx before AppShell
                              renders.
    types.ts             NEW — SessionInfo TS shape mirroring
                              the Rust JSON response.
  AppShell.tsx           EDIT — accept SessionInfo from
                              bootstrap; handleConnect skips
                              /notify and /status probes; WS
                              URL adds ?session=<id>.
  main.tsx               EDIT — await sessionBootstrap before
                              rendering AppShell; show a
                              splash + ConnectScreen-shaped
                              fallback on bootstrap failure.

src/ui/ConnectScreen/
  ConnectScreen.tsx      EDIT — demoted to recovery role:
                              shown only when bootstrap fails.
                              Submit button now POSTs to
                              /api/session and reloads on
                              success.

CLAUDE.md                EDIT — update connect handshake
                              section ("/status probe →
                              /notify(1) → setupDashboard"
                              becomes "session bootstrap →
                              setupDashboard"). Document
                              session lifecycle.

docs/history.md          APPEND — Phase 29 entry on completion.
plan.md                  MOVE entry → docs/history.md on
                              completion.
```

### Acceptance criteria (parent phase)

- **First-launch (cold)**: bridge running, scsynth running,
  empty sessionStorage. App boot creates a session
  (`POST /api/session` succeeds), WS connects with the supplied
  ID, dashboard mounts. ConnectScreen never renders.
- **Reload (F5)**: scsynth-side state survives. The clock
  doesn't reset. An in-flight recording continues writing. A
  playing sequencer keeps emitting `/dirt/play`. After
  rehydration, the dashboard shows the same state it had
  pre-reload (synth manager + scope manager + recording
  manager + sequencer all rebuild from `bank` + the bridge's
  reported `parentGroupId`).
- **Tab close**: session lingers; TTL cleanup (≤ TTL window)
  runs `/g_freeAll` + `/notify 0` + drops sockets. No leaked
  scsynth synths after TTL elapses.
- **Two tabs in same browser**: each `sessionStorage` is
  independent → each gets a different sessionId from
  `POST /api/session` → different clientIds → different
  IdAllocator ranges. No `/s_new duplicate node ID` failures
  when both tabs add synths.
- **Bridge restart mid-session**: frontend's next request
  `GET /api/session/:id` returns 404 → frontend bootstraps a
  new session → ConnectScreen briefly shown if the user is
  watching, otherwise transparent. scsynth-side state is lost
  (matches today's behaviour for any disconnect).
- **scsynth not running at session-creation time**:
  `POST /api/session` returns a structured error after the
  `/notify 1` timeout. Frontend renders ConnectScreen with the
  error inline and a "Try again" button that re-POSTs.
- **`Reset Session` button**: clears sessionStorage, calls
  `DELETE /api/session/:id`, reloads. Next bootstrap creates
  a fresh session with a fresh clientId.
- **Multi-WS-per-session edge case**: if two WS attach to the
  same session (someone copied the sessionStorage entry to
  another tab manually), both see all replies. Frontend
  filters correctly because sync-id / bufnum / nodeId
  correlation is already broadcast-safe.
- **TTL stays generous enough not to chew F5'd tabs.** Default
  30 min; the brief "no WS attached" window during a reload
  must not trigger cleanup.

### Open questions to resolve before coding

- **What does the WS look like during the bootstrap window?**
  Currently `wsUrlFor(address)` includes `?scsynth=ADDR` so the
  bridge knows where to send UDP. Post-29: the WS only needs
  `?session=<uuid>`; the bridge looks up the route target via
  the Session. Smooth migration: the bridge accepts EITHER
  query param during a transitional phase — but cleaner to
  ship as one cutover.
- **Does `parentGroupId` need to be in the API response?** Yes
  — currently `AppShell` derives it from `clientId × 100`
  (with the fallback for clientId=0). The bridge already has
  this logic implicitly when minting the session; expose it.
- **What happens if scsynth restarts while sessions are
  alive?** All sessions become stale (their clientIds + groups
  no longer exist scsynth-side). Detection: the bridge's
  shared `/status` heartbeat OR a `/fail` flood. On detection,
  bridge marks all sessions as "scsynth lost" and the next
  WS-side request fails. Frontend already handles WS death;
  could treat session-stale similarly. Decide: implicit
  invalidation via `/fail` count, or explicit
  `s.serverRunning`-style polling on the bridge?
  Recommendation: implicit — start simple, escalate if it
  causes confusion.
- **TTL for desktop Tauri vs. browser-via-bridge?** Tauri
  tabs don't really close (the app exits). Browser tabs do.
  TTL value is the same in both — 30 min — but the desktop
  case rarely hits TTL because a closed Tauri window means
  the bridge process is going down too (in dev with `tauri
  dev`) or sticking around (in production with `bridge` mode +
  Tauri webview pointed at it). Acceptable either way.
- **Session bootstrap blocks first paint.** The `/api/session`
  round-trip happens before AppShell renders. ~50–200 ms.
  Show a splash with the sc-app logo + "starting…" message
  to hide the flash. Acceptable; document as part of 29c.

### Constraints / gotchas

- **scsynth `maxLogins=8` is the per-bridge session ceiling.**
  Each session occupies one `/notify` slot. The SuperDirt
  startup script (`scripts/sc-app-superdirt-startup.scd`)
  already sets `s.options.maxLogins = 8`; if more sessions
  are anticipated, bump there + in the systemd unit + in
  `scripts/start-scsynth-only.sh` together. 8 simultaneous
  sc-app tabs is well above realistic use.
- **Long-lived bridge UDP sockets to scsynth.** Today's bridge
  opens + closes a UDP socket per WS lifetime (seconds to
  minutes). Post-29 a Session's UDP socket lives for TTL
  (minutes to hours). scsynth shouldn't care — UDP sockets
  are cheap server-side — but worth flagging if any deployed
  scsynth has tight `maxLogins` or per-source-port resource
  caps.
- **Bridge becomes the cleanup authority on tab close.**
  Today, WS death → UDP socket dies → scsynth state still
  needs `/g_freeAll` (handled by `pagehide` listener as
  best-effort). Post-29, the WS death is decoupled from the
  Session lifecycle — the Session lives until TTL, even if
  every WS detaches. The Session's TTL-cleanup is the only
  thing that runs `/g_freeAll`. If the bridge crashes
  without persisting sessions, leak is bounded by scsynth's
  next reboot or an explicit cleanup. (Same scenario as
  today's hard-close pattern.)
- **`sessionStorage` is wiped by Incognito / Private mode**
  (per-tab on close). Means private browsing always
  generates a fresh session. Not a problem; document.
- **Frontend code that assumed `clientId` was discoverable
  via `/notify` round-trip needs reviewing.** Specifically,
  `setupDashboard` derives `idBase` from `clientId`; the
  bridge-supplied clientId must be passed through unchanged.
  Worth checking that no other code path re-runs `notify(1)`
  on its own.
- **`ServerErrorBus` must still be wired before the first
  `/s_new`** (Phase 24 / 26 invariant). The new bootstrap
  flow doesn't change this — `setupDashboard` still
  constructs `ServerErrorBus` first. Just don't move it
  earlier in the chain (e.g. into the bootstrap step) without
  thinking; it needs the `WorkerClient`, which needs the
  WS, which needs the session ID.

### Out of scope

- **Multi-user / collaborative sessions.** The "session" here
  is per-browser-tab, not per-human-user. Two users on
  separate machines hitting the same bridge would each get
  their own session naturally. Two users sharing one
  session deliberately (whiteboard-style collaboration) is
  *not* what this enables.
- **Session persistence across bridge restart.** Sessions are
  in-memory only. Adding Postgres / sqlite is over-scope for
  the value (scsynth-side state is also lost across bridge
  restart, so no point in persisting just our half).
- **URL-based session routing (`/session/<id>`).** Not
  needed — `sessionStorage` covers per-tab continuity, and
  the URL doesn't carry useful information (no bookmarking,
  no sharing). React Router can stay out of the codebase.
- **SSR.** Not warranted — Rust bridge is the server, and a
  one-shot HTTP fetch on bootstrap is functionally
  equivalent to SSR-inlining the same JSON. Adding a Node
  runtime to the deployment chain is a regression.
- **Authentication / authorization.** Sessions are
  unauthenticated; anyone with network access to the bridge
  can create one. Acceptable for the Tauri / single-user
  case; revisit if the bridge ever ships behind a public
  endpoint.

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
