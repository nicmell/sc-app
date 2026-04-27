# Plan 2 — Shared Buffer Layer (Producer/Consumer Refactor)

A self-contained continuation of `plan.md`. Where `plan.md` carried the
project from phase 0 (the WS↔UDP bridge) through phase 15 (the
Synths panel that decoupled producers from scopes), this document
plans the next structural refactor: **decoupling the
buffer + tap-synth + worker-subscription stack from the scope and
recording UIs**, so multiple consumers can share a single bus tap.

`plan.md` shipped two parallel pipelines that each own their own
buffer, tap synth, and worker subscription:

- `ScopeController` → `/b_alloc` + `scopeSynthDef` (`/s_new`) +
  `subscribeScope` in the worker.
- `RecordingController` → `/b_alloc` + `recorderSynthDef`
  (`/s_new`) + `subscribeRecording` in the worker.

Two scopes on the same bus today double the bandwidth (two `/b_getn`
per tick, two tap synths writing identical data into two buffers).
A scope plus a recording on the same bus pay the same cost twice
for no functional reason. The worker subscription table is keyed
per-consumer, so even though the synthdefs are functionally
identical, the worker has no way to coalesce.

This plan introduces a third, shared layer between consumers and
the OSC pipe: a **`BufferController`** that owns one tap synth +
one buffer + one worker subscription, fanning chunks out to N
consumers, plus a **`BufferManager`** that ref-counts controllers
keyed by `(inputBus, channels, chunkSize)`. After the refactor:

- `ScopeController` owns no buffer, no tap synth, no /s_new — just
  a render canvas listening to a buffer's chunk stream.
- `RecordingController` owns no buffer, no tap synth — just a WAV
  writer pipeline listening to a buffer's chunk stream.
- `BufferManager` is the only thing that calls `/b_alloc` /
  `/s_new scopeSynth` / `subscribeBuffer`.

The producer surface (synths) stays exactly as it landed in phase
15. The consumer-facing UIs (`ScopeList`, `RecordingPanel`) stay
visually identical; users still type a bus number.

---

## Table of Contents

1. [Goals & non-goals](#goals--non-goals)
2. [Architecture overview](#architecture-overview)
3. [Decisions locked in](#decisions-locked-in)
4. [Open questions to resolve before phase 1](#open-questions-to-resolve-before-phase-1)
5. [File map](#file-map)
6. [Phase 1 — `BufferController` + `BufferManager` scaffolding](#phase-1--buffercontroller--buffermanager-scaffolding)
7. [Phase 2 — Worker subscription protocol pivot](#phase-2--worker-subscription-protocol-pivot)
8. [Phase 3 — Unify scope + recorder tap synthdefs](#phase-3--unify-scope--recorder-tap-synthdefs)
9. [Phase 4 — Migrate `ScopeController` onto `BufferManager`](#phase-4--migrate-scopecontroller-onto-buffermanager)
10. [Phase 5 — Migrate `RecordingController` onto `BufferManager`](#phase-5--migrate-recordingcontroller-onto-buffermanager)
11. [Phase 6 — `AppShell` wiring, teardown, docs](#phase-6--appshell-wiring-teardown-docs)
12. [Cross-cutting risks & gotchas](#cross-cutting-risks--gotchas)
13. [Acceptance for the whole refactor](#acceptance-for-the-whole-refactor)
14. [Future work this unlocks](#future-work-this-unlocks)

---

## Goals & non-goals

### Goals

1. **De-duplicate bus reads.** Two scopes (or a scope + recording)
   on the same bus produce one `/b_getn` per tick, not two.
2. **Single source of truth for tap state.** One `nodeId` and one
   `bufnum` per `(inputBus, channels, chunkSize)` triple, regardless
   of how many UI components observe it.
3. **Shrink consumer surface.** Both `ScopeController` and
   `RecordingController` should be small enough to read top-to-bottom
   without OSC-protocol context — they become "subscribe to a
   chunk stream, do your thing per chunk."
4. **Make multi-consumer features cheap to add later.** Spectral
   scope (`Future Improvements #16` in `plan.md`), tee-recording
   (record while watching), level meters — all become "add another
   subscriber to an existing `BufferController`" rather than
   "stand up a new buffer + tap synth + subscription."
5. **Preserve every `plan.md` invariant.** Group ordering (synths
   before taps), clockBus-driven `writeIdx`, offset-keyed pending
   reads, tick-ordered delivery for recordings — all kept verbatim,
   just relocated.

### Non-goals

- No change to the producer side (`SynthManager` /
  `SynthController` / `SynthsPanel`). Phase 15 stays.
- No change to the OSC bridge or Rust backend.
- No change to `ScopeView` / `RecordingWaveformView` rendering — the
  RAF loop reading a `useRef<ScopeChunk | null>` survives unchanged.
- No reconnection / disconnected UX work (still
  `Future Improvements #18`).
- No change to chunkSize being a global, header-driven setting.
  Sharing keyed by `(bus, channels, chunkSize)` falls out of that
  invariant — if chunkSize were per-consumer this plan would be
  meaningfully harder.
- No streaming-to-disk recordings (still `Future Improvements #17`).

---

## Architecture overview

### Before (phase 15)

```
Synths panel ──► SynthManager ──► SynthController ──► /s_new tone synth
                                                      writes audio onto bus B
                                                      ▲
Scopes panel ──► ScopeManager ──► ScopeController ───┘
                                  - /b_alloc buf_S
                                  - /s_new scope tap (reads bus B → buf_S)
                                  - subscribeScope(scopeId, buf_S)

Recordings  ──► RecordingManager ──► RecordingController
                                     - /b_alloc buf_R
                                     - /s_new recorder tap (reads bus B → buf_R)
                                     - subscribeRecording(recordingId, buf_R)
```

Two scopes on bus B = two buffers, two tap synths, two `/b_getn`
streams.

### After (this plan)

```
Synths panel ──► SynthManager ──► SynthController ──► /s_new tone synth
                                                      writes audio onto bus B
                                                      ▲
                                  ┌───────────────────┘
                                  │
                            BufferController  ◄── ref-counted by
                            - /b_alloc buf                BufferManager,
                            - /s_new tap synth            keyed (B, ch, chunkSize)
                              (reads bus B → buf)
                            - subscribeBuffer(bufferId, buf)
                            - chunk fan-out (N callbacks)
                                  ▲
        ┌──────────┬──────────────┴─────────────┬───────────┐
        │          │                            │           │
  ScopeCtrl 1  ScopeCtrl 2              RecordingCtrl   (future)
  - draws      - draws                  - WAV writer    spectral
    canvas       canvas                 - reorder           analyzer
                                          buffer
```

`SynthManager` is unchanged. `BufferManager` becomes a peer of
`SynthManager` on `DashboardResources`. `ScopeManager` and
`RecordingManager` shed their buffer + tap concerns and become thin
"create consumer that wraps a `BufferController`" factories.

### Lifecycle

```
ScopeManager.add({inputBus, channels, label})
  ↓
  bufferManager.acquire({inputBus, channels, chunkSize})  // refcount 0 → 1
    ↓ (on first acquire)
    /b_alloc → /s_new tap synth → subscribeBuffer
  ↓
  ScopeController(bufferController, ...)
    ↓
    bufferController.subscribe((chunk) => view.next(chunk))

ScopeManager.remove(scopeId)
  ↓
  scopeController.dispose()
    ↓
    bufferController.unsubscribe(cb)    // N → N-1 listeners
  ↓
  bufferManager.release(bufferController)  // refcount → 0?
    ↓ (only on last release)
    unsubscribeBuffer → /n_free tap synth → /b_free
```

The `BufferManager` is the only place that calls `/b_alloc`,
`/s_new tap`, and `/n_free tap` for non-producer synths.

---

## Decisions locked in

These are the design choices the plan commits to. Each has an
"alternative considered + why rejected" so future-us doesn't
re-litigate them.

### 1. Sharing key: `(inputBus, channels, chunkSize)`

Two consumers share a `BufferController` iff all three components
match. After phase 13.6 chunkSize is a session-global, so in
practice the key collapses to `(inputBus, channels)` — but we keep
chunkSize in the key explicitly so the design survives a future
where the user can pick per-consumer chunk sizes (e.g. wider
window for scopes, tighter for level meters).

**Alternative**: key only on `inputBus`. Rejected because a
1-channel consumer and a 2-channel consumer on the same bus need
different `chunkSize × channels`-sized buffers, and the tap
synthdef name embeds channel count.

### 2. Channel-count discipline

Every `BufferController` is allocated for the full channel count
the consumer requested. **No channel-slice sharing**: a 1-channel
consumer asking for channel 0 of a 2-channel bus does *not* share
the 2-channel consumer's buffer. They get separate
`BufferController`s with separate tap synths.

**Why**: scsynth's `In.ar(bus, channels)` reads a contiguous block
starting at `bus`. Slicing means "ask for channels in a different
shape than the writer wrote" — supportable but adds a lot of
config-shape branching, and is not a use case anyone has asked for.
Cost is one extra tap synth in the rare slice scenario; we accept
it.

### 3. Chunk fan-out: shared `Float32Array`, read-only by contract

Today each `scopeChunk` is a transferred `ArrayBuffer` (zero-copy,
exclusive ownership on the main side). With N consumers we cannot
transfer to all of them. Two options:

- **(A)** Drop the transfer — `postMessage` clones the ArrayBuffer
  (structured clone). N copies, one per consumer.
- **(B)** Drop the transfer — `postMessage` once, the `Float32Array`
  arrives shared, and every consumer is contractually read-only and
  must not retain past one tick.

**Choice: (B).** `ScopeView` already treats incoming chunks as
read-only via `useRef`. `RecordingController`'s WAV writer copies
samples out of the chunk into the wav buffer immediately — also
read-only. The contract is already implicit; we just make it
explicit. Documented at the top of `BufferController` and
`workerProtocol.ts`.

**(A)** is the safe fallback if any future consumer needs to
mutate. Switch is a one-line change in the worker. Phase 1 will
land (B) and revisit only if we add a mutating consumer.

### 4. Lifecycle: prompt teardown, no debounce

When the last consumer releases a `BufferController`, the buffer
and tap synth are torn down immediately (no grace period, no
"keep alive 1 second in case a new consumer arrives"). If a UI
toggles fast (remove → re-add), the user pays a `/b_alloc` +
`/s_new` round-trip — small but visible.

**Alternative**: idle hold (e.g. 500 ms grace before tear-down).
Rejected for phase 1 — adds state and a timer, blurs lifecycle
correctness, and toggling a scope on/off is not a documented hot
path. If users complain we can add it; the hook lives entirely
inside `BufferManager.release` and `BufferController.dispose`.

### 5. Mid-stream join semantics

A consumer that acquires a `BufferController` mid-stream (the
buffer has been running, e.g. another scope was already watching
the bus) starts receiving chunks from the **next tick after
acquire**. Specifically:

- Buffered chunks already delivered to other consumers are NOT
  replayed.
- A late-arriving consumer for a tick whose `/b_getn` is in flight
  but whose reply has not yet been intercepted gets that chunk if
  it arrives — no special handling, the worker just emits to all
  current subscribers when the `/b_setn` lands.

Recordings additionally stamp `acquireTickIndex` and only feed
the WAV writer with chunks whose `tickIndex >= acquireTickIndex`,
so a recording that joins a long-running buffer doesn't get a
half-tick's worth of "join slop."

### 6. Pending-read table: offset-keyed for all buffers

The recording side already runs an offset-keyed `pendingByOffset:
Map<offset, PendingRead>` with capacity 2 (one per ring half) plus
a `reorderBuffer: Map<tickIndex, …>` to deliver in tick order. The
scope side runs a single-slot `pendingRead`. We adopt the recording
pattern uniformly — every `BufferController`'s subscription has
offset-keyed pending and ordered delivery. Scopes don't need
ordering for correctness (they only render the latest), but they
also don't suffer from getting it.

**Why uniformly offset-keyed**: with shared subscriptions, both a
scope and a recording can be reading from the same buffer. The
underlying machinery has to be the recording-strength one — the
scope just doesn't care about the strength.

### 7. Unify the tap synthdefs

`scopeSynthDef(channels, chunkSize)` and
`recorderSynthDef(channels, chunkSize)` are functionally identical:
both read `In.ar(inBus, channels)`, derive `writeIdx` from
`clockBus`, `BufWr.ar` into a ring buffer of `2 × chunkSize` frames.
Phase 3 replaces them with a single `bufferTapSynthDef(channels,
chunkSize)`. Old files are deleted.

**Alternative**: leave them split, add `BufferController` as a
thin wrapper. Rejected — two synthdefs that compile to identical
SCgf bytes (modulo name) is a maintenance burden and uses two
synthdef cache slots on scsynth.

### 8. Producer/consumer ordering invariant unchanged

Tap synths are still `AddToTail` of the parent group, after every
producer synth. The clock-at-head invariant still holds. The "Add
synth, then add scope/recording" UX flow keeps tap synths after
producers naturally — the `BufferManager` doesn't reorder anything.
Documented in `CLAUDE.md` (already covers it for phase 15).

---

## Open questions to resolve before phase 1

These are not blocking but should be answered before code starts.
None should change the phase structure; they tune knobs.

1. **Should `BufferController` expose the latest chunk as a store
   (pull) instead of / in addition to a callback (push)?** Today's
   `ScopeView` reads the chunk from a `useRef` — it doesn't care
   when chunks arrive, only what the latest one is. A
   `ReadonlyStore<ScopeChunk | null>` matches that pattern and would
   let `ScopeView` use `useSyncExternalStore` consistently. The
   recording side needs every chunk in order, so a push callback is
   load-bearing for it. Probably both APIs: `subscribe(cb)` for
   recording-style consumers and `latestChunk: ReadonlyStore<...>`
   for view-style consumers.
2. **Should `BufferManager.acquire` be async (awaits `/b_alloc` +
   `/s_new` + `/sync`) or sync-with-a-pending-store?** Phase 15's
   `SynthManager.add` is async; consumers await it before saving the
   handle. Easiest: keep `acquire` async too. The cost is the first
   consumer to acquire a buffer pays the round-trip; subsequent
   acquirers on an already-allocated buffer return synchronously
   (well, return a resolved Promise — same shape).
3. **What happens to a `BufferController` if its underlying tap
   synth `/n_go` fails on scsynth?** Today `ScopeController.start()`
   surfaces the failure as a thrown promise from `add()`. Same here
   — `acquire` rejects, the consumer-side `add` rejects. Document
   that the buffer is *not* placed in the manager's map until
   `/sync` returns clean.
4. **Should the `BufferManager` expose a debug `inspect()`?** A
   reactive store of `{key, refcount, bufnum, nodeId}[]` would make
   the dev panel useful (and would catch refcount leaks visibly).
   Cheap to add in phase 1.

---

## File map

| File | Phase | Change |
|---|---|---|
| `src/scope/BufferController.ts` | 1 | NEW. Owns one buffer + tap synth + subscription. Refcounted by manager, but doesn't track the count itself. |
| `src/scope/BufferManager.ts` | 1 | NEW. Ref-counted map keyed by `(inputBus, channels, chunkSize)`. |
| `src/scope/workerProtocol.ts` | 2 | Replace `ScopeSubscription` / `RecordingSubscription` with a single `BufferSubscription`. Replace `subscribeScope` / `unsubscribeScope` / `startRecording` / `stopRecording` messages with `subscribeBuffer` / `unsubscribeBuffer`. `ScopeChunk` becomes `BufferChunk` keyed by `bufferId`. Recording-specific events (`recordingChunkWritten`, `recordingGap`, `recordingDone`) move to main thread (the WAV writer relocates). |
| `src/workers/scopeWorker.ts` | 2 | Subscription table re-keyed by `bufferId`. One `/b_getn` per tick per buffer. Unified offset-keyed pending + reorder. WAV writer code deleted from worker. |
| `src/workers/wavWriter.ts` | 5 | Move from worker to main thread (now lives in `src/recording/wavWriter.ts`); same `WavMemoryWriter` API. |
| `src/scope/WorkerClient.ts` | 2 | Replace `subscribeScope` / `subscribeRecording` with `subscribeBuffer(spec, cb)`. Drop `startRecording` / `stopRecording`. |
| `src/synth/bufferTapSynthDef.ts` | 3 | NEW. Single tap synthdef replacing `scopeSynthDef` and `recorderSynthDef`. Cache key `(channels, chunkSize)`. |
| `src/synth/scopeSynthDef.ts` | 3 | DELETE. |
| `src/synth/recorderSynthDef.ts` | 3 | DELETE. |
| `src/scope/ScopeController.ts` | 4 | Drop /b_alloc, /s_new, /b_free, scopeSynthDef import, ringBuffer ownership. Take a `BufferController` in opts; subscribe to its chunk stream; expose the latest-chunk store unchanged. |
| `src/scope/ScopeManager.ts` | 4 | `add()` calls `bufferManager.acquire(spec)`, builds `ScopeController` with the handle. `remove()` calls `release()`. Holds a ref to `BufferManager`. |
| `src/recording/RecordingController.ts` | 5 | Drop /b_alloc, /s_new, /b_free, recorderSynthDef import. Take a `BufferController` in opts. WAV writer + reorder buffer move to this file (relocated from worker). Offset-keyed pending stays in the worker (per-buffer); ordered delivery handled here per recording. |
| `src/recording/RecordingManager.ts` | 5 | Holds a ref to `BufferManager`; `acquire()` / `release()` mirror `ScopeManager`. Drop bus-allocation no-op (already gone in phase 15). |
| `src/recording/wavWriter.ts` | 5 | NEW location (moved from `src/workers/wavWriter.ts`). |
| `src/scope/AppShell.tsx` | 6 | Construct `BufferManager` in `setupDashboard` (after registry, before scope/recording managers). Pass to scope+recording managers. `teardownServerState` clears recordings → scopes → buffers → clock → group. |
| `src/scope/ScopeController.ts` (consumer side) | 6 | Verify `latestChunk` store still updates `ScopeView` via `useRef` — no change to render code. |
| `CLAUDE.md` | 6 | New "Architecture at a glance" diagram with `BufferManager`. New gotcha for refcount lifecycle. Update "Where scsynth conventions matter" with the unified tap synthdef + per-buffer subscription. |
| `plan.md` | 6 | Add a "Phase 16 — Shared Buffer Layer" pointer that says "see plan-2.md." Renumber Future Improvements 16-25 to 17-26. |
| `plan-2.md` | 6 | This file. Add an "as landed" subsection per phase, mirroring plan.md. |

---

## Phase 1 — `BufferController` + `BufferManager` scaffolding

### Goal

Land the new types and classes with no integration. The new files
compile and unit-test against existing utilities; nothing in the
running app touches them yet.

### Files

- NEW `src/scope/BufferController.ts`
- NEW `src/scope/BufferManager.ts`

### Architecture

#### `BufferController.ts`

```ts
export interface BufferSpec {
  inputBus: number;
  channels: 1 | 2;        // extend later if/when needed
  chunkSize: number;
}

export interface BufferControllerOptions {
  client: WorkerClient;
  registry: SynthDefRegistry;
  group: GroupController;
  ids: { node: IdAllocator; buffer: IdAllocator };
  spec: BufferSpec;
}

/** One bus tap = one buffer + one tap synth + one worker subscription.
 *  Owned exclusively by `BufferManager`; consumers receive a
 *  read-only handle and never call `start` / `dispose` directly. */
export class BufferController {
  readonly spec: BufferSpec;

  // Reactive state for the UI / debug panel:
  get bufnum(): ReadonlyStore<number | null>;
  get nodeId(): ReadonlyStore<number | null>;
  /** Latest chunk delivered, or null pre-first-tick. View-style
   *  consumers read this via useSyncExternalStore. */
  get latestChunk(): ReadonlyStore<BufferChunk | null>;

  /** Push-style stream for ordered consumers (recording). The
   *  callback fires on every accepted chunk in tickIndex order.
   *  Returns an unsubscribe fn. */
  subscribe(cb: (chunk: BufferChunk) => void): () => void;

  /** Allocate buffer, /s_new tap synth, subscribeBuffer in worker.
   *  Idempotent — called once by BufferManager on first acquire. */
  async start(): Promise<void>;

  /** Tear down: unsubscribeBuffer → /n_free → /b_free. Idempotent. */
  async dispose(): Promise<void>;
}
```

The `latestChunk` store is updated from inside `subscribe`'s
callback (one fan-out path); push subscribers get the same chunk
synchronously via the same fan-out loop.

#### `BufferManager.ts`

```ts
export class BufferManager {
  /** Acquire a controller for the given spec. Refcount bumped; if
   *  this is the first acquirer the controller's start() runs and
   *  the call awaits its completion. */
  async acquire(spec: BufferSpec): Promise<BufferHandle>;
}

/** A consumer-facing handle to a refcounted controller. Calling
 *  release() decrements the refcount; on zero the controller is
 *  disposed. handle.controller is the BufferController. */
export interface BufferHandle {
  readonly controller: BufferController;
  release(): Promise<void>;
}
```

Internally:

- `private map: Map<string, { ctrl: BufferController; refcount: number }>`
- `keyOf(spec) = '${spec.inputBus}|${spec.channels}|${spec.chunkSize}'`
- `acquire`: lookup; if missing, construct + start, store with
  refcount 1; if hit, increment refcount. Returns a handle.
- `release` (on handle): decrement; if 0, await dispose, remove
  from map.
- `clear()`: dispose all and empty the map. Used by
  `teardownServerState`.

A reactive `ReadonlyStore<BufferControllerSnapshot[]>` exposes
`(spec, refcount, bufnum, nodeId)` for an eventual debug panel.

### Acceptance

1. `yarn tsc --noEmit` clean.
2. `yarn build` clean.
3. New files unreferenced by any other file (no integration yet —
   the next phases consume them). Vite tree-shakes them out of
   prod bundle; tsc verifies the types compile.
4. No behavioural change in the running app.

### Risks

- Designing the API in isolation often misses real-consumer needs.
  Mitigation: phase 4 + 5 may push back small API tweaks (e.g.
  expose chunk count, expose tickIndex of latest chunk). Plan for a
  small post-hoc adjustment commit if so.

---

## Phase 2 — Worker subscription protocol pivot

### Goal

Re-key the worker's subscription table on `bufferId` instead of
`scopeId` / `recordingId`. The protocol now expresses "subscribe to
a buffer" once, with N main-thread fan-out being a main-side
concern. The WAV writer leaves the worker entirely (relocates to
main in phase 5).

This is the highest-blast-radius phase. Land it independently of
phases 3-5 — the existing `ScopeController` and
`RecordingController` continue to call the *new* protocol via a
thin adapter for one commit, then phases 4+5 strip the adapter.

### Files

- `src/scope/workerProtocol.ts`
- `src/workers/scopeWorker.ts`
- `src/scope/WorkerClient.ts`
- (intermediate adapter shim) — kept inside `ScopeController` /
  `RecordingController` for the lifetime of phase 2 only; deleted
  in phases 4 + 5.

### Architecture

#### Protocol (`workerProtocol.ts`)

```ts
export interface BufferSubscription {
  /** Stable id assigned by the BufferManager. */
  bufferId: string;
  bufnum: number;
  channels: number;
  chunkSize: number;
}

export interface BufferChunk {
  bufferId: string;
  /** Read-only by contract — see plan-2.md decision #3. */
  data: Float32Array;
  channels: number;
  tickIndex: number;
}

export type MainToWorker =
  | { type: 'connect'; url: string }
  | { type: 'disconnect' }
  | { type: 'send'; bytes: Uint8Array }
  | { type: 'registerClock'; trigId: number }
  | { type: 'unregisterClock' }
  | { type: 'subscribeBuffer'; subscription: BufferSubscription }
  | { type: 'unsubscribeBuffer'; bufferId: string };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'error'; message: string }
  | { type: 'reply'; reply: OscReply }
  | { type: 'clockTick'; tick: ClockTick }
  | { type: 'bufferChunk'; chunk: BufferChunk }
  | { type: 'log'; level: 'log' | 'info' | 'warn' | 'error'; message: string };
```

Removed: `subscribeScope`, `unsubscribeScope`, `startRecording`,
`stopRecording`, `scopeChunk`, `recordingChunkWritten`,
`recordingGap`, `recordingDone`. Recording-specific events are now
generated on main (phase 5).

#### Worker (`scopeWorker.ts`)

- Subscription table: `Map<bufferId, BufferSubscriptionState>`.
- Per-subscription state: `{ subscription, pendingByOffset:
  Map<offset, PendingRead>, reorderBuffer: Map<tick, BufferChunk>,
  nextDeliverableTick: number }`.
- Per-tick handler: for each subscription, fire `/b_getn` for the
  just-completed half (offset = `(tickIndex - 1) % 2 * chunkSize *
  channels`). Wrap in `OSC.Bundle` with `Date.now() +
  READ_DELAY_MS`. Update `pendingByOffset[offset] = { tickIndex,
  fired: now() }`.
- `/b_setn` handler: lookup subscription by bufnum, find pending by
  offset, build `BufferChunk { bufferId, data, channels, tickIndex
  }`. Buffer-into-`reorderBuffer`; flush in tick order via
  `nextDeliverableTick`. Each flush posts a `bufferChunk` message
  to main.
- The WAV writer + gap detection logic is removed entirely. They
  belong to one specific consumer (recording) and don't need to run
  in the worker.

#### `WorkerClient`

```ts
subscribeBuffer(
  sub: BufferSubscription,
  onChunk: (chunk: BufferChunk) => void,
): { unsubscribe: () => void };
```

Maintains an internal `Map<bufferId, Set<onChunk>>` so multiple
main-thread listeners can attach to the same `bufferId`. The
worker still gets exactly one `subscribeBuffer` per buffer; the
`Set<onChunk>` is the main-side fan-out.

The shape mirrors `subscribeScope` exactly so phase 4 is a
near-mechanical rewrite.

#### Adapter shim (intermediate)

For the lifetime of phase 2 only, `ScopeController` and
`RecordingController` are rewired to call `subscribeBuffer` via a
small inline adapter that allocates a per-controller `bufferId` and
wraps the existing `bufnum` / `chunkSize` they already own. This
is throwaway code — phase 4 and 5 delete it. It exists so phase 2
ships green without depending on the producer-side `BufferManager`
yet.

### Acceptance

1. `yarn tsc --noEmit` clean.
2. `yarn build` clean.
3. Manual smoke test: connect → add synth → add scope → wave
   renders. Add recording → records, downloads WAV, header valid,
   no audible gaps. Indistinguishable from pre-phase-2 behaviour.
4. Worker debug log shows `subscribeBuffer` / `unsubscribeBuffer`
   in place of the old subscription messages. One subscription per
   scope/recording (still one-to-one — sharing comes in phases 4-5).

### Risks

- **Tick-ordering regression for recordings.** The worker's
  per-buffer reorder buffer must replicate phase 12's behaviour
  exactly. Mitigate: lift the existing recording-side reorder code
  verbatim, drop the per-recording keying. Add a 1-tick replay
  test (drop the first tick's reply, verify the next tick's chunk
  doesn't get delivered until the dropped one's retry lands or it's
  declared a gap).
- **Recording gap detection** moves from worker to main. Phase 5
  re-implements it on main using the chunk stream's `tickIndex`
  jumps. In phase 2 it is *temporarily lost*; recordings work but
  gaps are silently recorded as silence with no sidecar JSON.
  Mark this clearly in the phase 2 commit message — a phase 5
  follow-up restores it.

---

## Phase 3 — Unify scope + recorder tap synthdefs

### Goal

Replace `scopeSynthDef` and `recorderSynthDef` with a single
`bufferTapSynthDef`. Cosmetic but cuts a synthdef out of every
session.

### Files

- NEW `src/synth/bufferTapSynthDef.ts`
- DELETE `src/synth/scopeSynthDef.ts`
- DELETE `src/synth/recorderSynthDef.ts`
- `src/scope/BufferController.ts` — point at the new synthdef.

### Architecture

```ts
export function bufferTapSynthDefName(channels: 1 | 2, chunkSize: number): string {
  return `bufferTap${channels}ch_cs${chunkSize}`;
}

const cache = new Map<string, Uint8Array>();

export function compileBufferTapSynthDef(channels: 1 | 2, chunkSize: number): Uint8Array {
  const key = `${channels}|${chunkSize}`;
  // … same shape as scopeSynthDef.compile, derived writeIdx from
  //    clockBus, BufWr.ar into a 2 × chunkSize ring.
}
```

Body is a verbatim copy of `scopeSynthDef.compileScopeSynthDef`
with no changes — they're already byte-identical to
`recorderSynthDef`'s output (modulo synthdef name).

### Acceptance

1. `yarn tsc --noEmit` clean.
2. `yarn build` clean.
3. Smoke test: scopes still render correctly, recordings still
   produce valid WAVs.
4. Inspect scsynth's loaded synthdef list (e.g. `g_dumpTree`) —
   one tap synthdef per `(channels, chunkSize)` combo, not two.

### Risks

- Synthdef byte-identity is asserted but not load-bearing — if the
  three classes (scope, recorder, new tap) had subtle drift this
  unification masks it. Mitigation: cross-check `bufferTapSynthDef`
  bytes against both predecessors before deletion.

---

## Phase 4 — Migrate `ScopeController` onto `BufferManager`

### Goal

`ScopeController` no longer owns a buffer or tap synth. It receives
a `BufferHandle` and subscribes to its chunk stream. `ScopeManager`
acquires/releases handles via the manager.

### Files

- `src/scope/ScopeController.ts`
- `src/scope/ScopeManager.ts`

### Architecture

```ts
export interface ScopeControllerOptions {
  buffer: BufferHandle;
  scopeId: string;
  label?: string;
}

export class ScopeController {
  readonly scopeId: string;
  readonly buffer: BufferHandle;     // exposed for UI: bus, channels
  readonly label: string;

  // Same reactive stores it has now, derived from buffer.controller:
  get latestChunk(): ReadonlyStore<BufferChunk | null>;
  // gain, paused, etc. stay on the controller.

  async dispose(): Promise<void>;     // unsubscribe + release
}
```

`ScopeManager.add({ inputBus, channels, label })`:

1. `const handle = await bufferManager.acquire({ inputBus, channels, chunkSize: clock.chunkSize })`
2. `const ctrl = new ScopeController({ buffer: handle, ... })`
3. push to store, return ctrl.

`ScopeManager.remove(scopeId)`:

1. `await ctrl.dispose()` — drops the buffer subscription, calls
   `handle.release()` which may tear down the underlying
   `BufferController` if last consumer.

The intermediate adapter shim from phase 2 is removed.

### Acceptance

1. `yarn tsc --noEmit` clean.
2. `yarn build` clean.
3. Smoke test:
   - Two scopes on the same bus with the same channels: only one
     `/b_alloc` and one `/s_new tap` is emitted (verify in debug
     log).
   - Remove one scope: tap stays alive (other scope still there).
   - Remove the second: `/n_free tap` and `/b_free` fire.
4. The "scope-before-synth" caveat from `CLAUDE.md` still applies
   — verify nothing in the new flow inadvertently fixes or worsens
   it.

### Risks

- Latest-chunk store has a different update cadence than today
  (it's now driven by the buffer's fan-out, not a per-scope
  subscription). Should be identical in practice but verify
  `ScopeView`'s RAF loop sees the same `tickIndex` progression.

---

## Phase 5 — Migrate `RecordingController` onto `BufferManager`

### Goal

`RecordingController` becomes a pure consumer wrapping a
`BufferHandle`. The WAV writer + gap detection move from the
worker to this file.

### Files

- `src/recording/RecordingController.ts`
- `src/recording/RecordingManager.ts`
- NEW `src/recording/wavWriter.ts` (moved from
  `src/workers/wavWriter.ts`)
- `src/workers/scopeWorker.ts` (delete the WAV writer reference)

### Architecture

```ts
export interface RecordingControllerOptions {
  buffer: BufferHandle;
  recordingId: string;
  label?: string;
  sampleRate: number;
}

export class RecordingController {
  readonly recordingId: string;
  readonly buffer: BufferHandle;

  get framesWritten(): ReadonlyStore<number>;
  get gaps(): ReadonlyStore<RecordingGap[]>;
  get state(): ReadonlyStore<'idle' | 'recording' | 'finalising' | 'done'>;

  async start(): Promise<void>;     // captures acquireTickIndex,
                                    // begins consuming chunks
  async stop(): Promise<RecordingDone>;  // flushes WAV writer,
                                          // returns blob bytes
  async dispose(): Promise<void>;   // release the buffer handle
}
```

Internals:

- `private writer: WavMemoryWriter` — same impl as today, just on
  the main thread now.
- `private acquireTickIndex: number | null` — set on `start()`.
- `private nextExpectedTickIndex: number | null` — drives gap
  detection.
- `private subscribe()` callback (registered with `buffer.controller`):
  - drop the chunk if `tickIndex < acquireTickIndex` (mid-stream
    join slop)
  - if `tickIndex !== nextExpectedTickIndex`, emit a `RecordingGap`
    for the missing window, fill `framesMissing × channels` zeros,
    advance `nextExpectedTickIndex`
  - append the chunk's samples to the writer
  - update `framesWritten` store

`RecordingManager.add({ inputBus, channels, label })`:

1. `const handle = await bufferManager.acquire(...)`
2. `const ctrl = new RecordingController({ buffer: handle, ... })`
3. `await ctrl.start()`

The current "`pendingByOffset` + retries" logic stays in the
worker (it's a buffer-level, not recording-level, concern). The
`reorderBuffer` is also in the worker — recordings get
already-tick-ordered chunks. That makes the recording side simpler
than the current code: it just walks tickIndex and detects gaps.

The retry policy (currently `RecordingSubscription.retry`) becomes a
`BufferSubscription` field — every buffer gets retry-on-late by
default, with the worker emitting a synthetic gap chunk if a tick's
read fails after `maxAttempts`. Scope consumers ignore the gap
chunk (just don't render); recording consumers materialise it as a
`RecordingGap`.

### Acceptance

1. `yarn tsc --noEmit` clean.
2. `yarn build` clean.
3. Smoke test:
   - Single recording on a bus with no scopes: tap synth + buffer
     is allocated, recording produces valid WAV. Same as today.
   - Recording + scope on the same bus: one tap synth + one
     buffer; both consumers receive every chunk; WAV is valid;
     scope renders cleanly.
   - Stop scope first: recording continues uninterrupted
     (refcount 2 → 1, no teardown). Stop recording: WAV finalises;
     refcount 1 → 0, tap + buffer torn down.
   - Forced gap (kill scsynth briefly via Activity Monitor on a
     known-late condition, or just observe a real-world gap) →
     `RecordingGap` events fire, sidecar JSON contains them, WAV
     length matches `framesWritten`.
4. WAV writer correctness preserved: the file from a 5-second
   stationary 440 Hz tone matches a phase-1-era reference WAV
   modulo header timestamp.

### Risks

- **Off-thread → on-thread WAV writer** is a slight CPU shift to
  the main thread. The writer is small (memcpy), but at high
  recording counts × small chunk sizes it could become a frame
  drop in the rendering loop. Mitigation: profile after landing.
  Streaming-to-disk (`Future Improvements #17`) was always the
  long-term plan; this phase doesn't make that harder.
- **Mid-stream-join semantics** are new behaviour — today recording
  always starts a fresh buffer, so there's no "join an existing
  buffer" path. Adding `acquireTickIndex` covers it; verify a
  recording added 5 seconds after a scope on the same bus produces
  a WAV that starts at the recording's start, not the scope's.

---

## Phase 6 — `AppShell` wiring, teardown, docs

### Goal

Hook `BufferManager` into the dashboard lifecycle, update
documentation, finalise plan.md cross-links.

### Files

- `src/scope/AppShell.tsx`
- `CLAUDE.md`
- `plan.md`
- `plan-2.md` (this file — fill in "as landed" subsections per
  phase, like the rest of the project)

### Architecture

`setupDashboard(client, parentGroupId, sampleRate, chunkSize)`
gains:

```ts
const bufferManager = new BufferManager({
  client, registry, group,
  ids: { node: nodeIdAllocator, buffer: bufferIdAllocator },
});
const scopeManager = new ScopeManager({ ..., bufferManager });
const recordingManager = new RecordingManager({ ..., bufferManager });
return { ..., bufferManager, scopeManager, recordingManager, synthManager };
```

`teardownServerState(resources)` order:

```
recordingManager.clear()    // /n_free not directly — releases handles
  → bufferManager refcount goes to 0 for buffers used only by recordings
  → tap synths /n_free, buffers /b_free
scopeManager.clear()        // releases remaining handles
  → bufferManager refcount goes to 0 for the rest
bufferManager.clear()       // safety net: dispose anything still alive
                            // (should be empty by this point — log a
                            //  warn if not, that's a refcount leak)
synthManager.clear()        // producer side
clock.stop()
group.free()
```

The bufferManager.clear safety net is the canary — if a
phase-4-or-5 bug ever fails to release a handle, this path catches
it with a log line rather than a leaked tap synth.

### Documentation updates

#### `CLAUDE.md`

- Replace the architecture diagram with a version that includes
  `BufferManager`. Annotate the producer-vs-consumer split clearly.
- Add a gotcha:

  > **`BufferController` lifecycle is refcounted, not 1:1.** A
  > single bus tap (one `/s_new`, one `/b_alloc`) can serve N
  > consumers. The controller is created on first acquire and torn
  > down on last release. Don't hold a `BufferHandle` in a long-lived
  > closure outside the consumer that owns it — the refcount is the
  > only thing keeping the underlying scsynth resources alive.

- Update "Where scsynth conventions matter":

  > **Tap synths are unified — one `bufferTapSynthDef(channels,
  > chunkSize)` serves both scopes and recordings.** Cache key
  > `(channels, chunkSize)`. The legacy `scopeSynthDef` and
  > `recorderSynthDef` are gone.

- Update the "scope-before-synth" caveat to "consumer-before-
  producer" — it now applies symmetrically to recordings.

#### `plan.md`

Add a phase 16 stub that points to `plan-2.md`:

```
## Phase 16 — Shared Buffer Layer

See `plan-2.md` for the full design. This phase decouples
buffer + tap synth + worker subscription ownership from
`ScopeController` / `RecordingController` and introduces a
ref-counted `BufferManager` so multiple consumers share a single
bus tap.
```

Renumber Future Improvements 16-25 → 17-26.

### Acceptance

1. `yarn tsc --noEmit` clean.
2. `yarn build` clean.
3. Full smoke matrix:
   - Connect → Synths panel + Scopes panel + Recordings panel.
   - Add synth → add scope → recording — verify single tap per bus.
   - Add a second scope on a different bus — verify second tap.
   - Add a third scope on the first scope's bus — verify
     bufferManager refcount = 2 on that buffer (debug panel /
     console).
   - Remove all scopes & recordings — bufferManager empty, no
     leaked tap synths (verify via `g_dumpTree`).
   - Disconnect → reconnect → bufferManager.clear safety log
     should NOT fire (would be a refcount leak).
   - chunkSize re-init — bufferManager clears, all consumers
     re-acquire on the new chunkSize, smoke test passes.
4. Docs updated, `plan.md` cross-link added,
   `plan-2.md` phase "as landed" subsections filled.

### Risks

- **bufferManager.clear safety log firing on legitimate paths** —
  e.g. if a recording is mid-finalise when teardown runs. Audit:
  the manager.clear order is recordings → scopes → buffers, so by
  the time bufferManager.clear runs, any recording-driven
  finalisation should have released its handle. Verify by adding a
  test that finalises a recording during disconnect.

---

## Cross-cutting risks & gotchas

These are not phase-scoped — they touch the whole refactor.

### 1. Refcount correctness under partial failures

`BufferManager.acquire` runs `await ctrl.start()` which can throw
mid-flight (e.g. `/s_new` fails on scsynth). The error path must
either:

- Not insert into the map (preferred — the caller can retry).
- Clean up partial state (free the buffer if alloc succeeded but
  /s_new failed).

This is the same shape as `SynthManager.add`'s try-stop-rethrow
pattern from phase 15. Mirror it.

### 2. Worker subscription dedup vs. main-thread fan-out

The worker has *one* subscription per `bufferId`; the main thread
has *N* listeners per `bufferId`. These two layers must agree on
what counts as "the subscription is alive":

- Worker: a subscription exists between `subscribeBuffer` and
  `unsubscribeBuffer`.
- Main: `WorkerClient.subscribeBuffer` returns one unsubscribe;
  the *last* unsubscribe sends `unsubscribeBuffer` to the worker;
  earlier unsubscribes just remove from the local `Set`.

A subtle bug class: the last main-side unsubscribe fires
`unsubscribeBuffer`, but a `bufferChunk` for that subscription is
already in flight from the worker. The `WorkerClient` must drop
chunks for unknown bufferIds silently (already does, since the
local `Map<bufferId, Set<cb>>` is empty).

### 3. `chunkSize` global re-init

When the user changes chunkSize from the header dropdown,
`teardownServerState` runs and rebuilds everything. The
`BufferManager` is part of `DashboardResources` and gets rebuilt
fresh; the new `bufferManager` has zero entries; consumers
re-acquire with the new chunkSize. Same shape as
`ScopeManager` / `RecordingManager` re-init today. The cache key
`(channels, chunkSize)` for the tap synthdef ensures fresh bytes
are uploaded.

### 4. Group ordering still applies

Tap synths added in any order via `BufferManager.acquire` go
`AddToTail`, so they run after any synth that was created before
them. The "Add synth, then add scope" UX still produces the right
ordering. Sharing buffers does not introduce new ordering hazards
(if anything, it reduces the number of tap synths → fewer ordering
considerations).

### 5. Debug panel temptation

A reactive `BufferManager.snapshot` would make a great
"BuffersPanel" dev UI. Resist scope creep — out of plan-2's
scope, file as a follow-up. Useful for debugging refcount leaks,
worth ~half a day. Lives in `Future Improvements`.

### 6. Recording vs. scope chunk semantics divergence

After phase 5, recordings and scopes consume the same `bufferChunk`
events. A subtle detail:

- Scope cares about *liveness* (the latest chunk).
- Recording cares about *completeness* (every chunk in order, with
  gaps explicitly recorded).

The shared stream gives recording its in-order delivery for free.
But: if the worker drops a chunk silently (e.g. the unified
retry logic gives up), scopes don't notice (they just render the
next one), but recording must produce a `RecordingGap`. This is
why the worker emits a *synthetic gap chunk* on retry exhaustion —
recordings materialise it; scopes ignore it. Document this contract
on `BufferChunk`.

### 7. Test coverage

`Future Improvements #20` (test coverage) is not in scope here, but
this refactor is a forcing function: BufferManager refcount, worker
subscription dedup, recording gap detection — all are testable in
isolation and currently aren't. At minimum, write fixture-style
unit tests for `BufferManager.acquire` / `release` semantics in
phase 1, since they're easy to write and catch the most likely
bugs.

---

## Acceptance for the whole refactor

After phase 6 lands, the following must be true:

1. **Single tap per bus.** Two scopes on the same bus produce one
   `/s_new` and one `/b_alloc`. A recording on the same bus shares
   that tap. Verifiable in the debug log + `g_dumpTree`.
2. **Refcount correctness.** Adding and removing N consumers on the
   same bus in any order leaves the bufferManager with the right
   count after each operation. The last consumer's removal tears
   down the tap.
3. **Behavioural parity.** Scopes render identically to phase 15.
   Recordings produce byte-identical WAVs (modulo header timestamp)
   for known stationary tones.
4. **Phase-15 invariants preserved.** Synths still produce, scopes /
   recordings still consume user-typed bus numbers, chunkSize
   re-init still works, group teardown still cleans up.
5. **Codebase legibility.** `ScopeController` and
   `RecordingController` are each shorter than phase 15 (no buffer
   alloc, no /s_new, no buf_free). The new `BufferController` +
   `BufferManager` are ~150-250 LOC each.
6. **Plan-2.md "as landed" subsections** for each phase populated,
   mirroring `plan.md`.

---

## Future work this unlocks

Strictly out of scope for plan-2 but worth listing:

1. **Spectral scope (FFT view)** (`Future Improvements #16`):
   becomes "add an FFT analyzer that subscribes to a
   `BufferController`." No new tap synth or buffer needed.
2. **Level meters per bus**: another consumer subscribing to the
   same buffer.
3. **Tee-recording**: a single button on a scope card spawns a
   `RecordingController` on the same `BufferHandle`. Trivial after
   this refactor; awkward today.
4. **A `BuffersPanel` debug UI**: live ref-count, bufnum, nodeId
   for every active tap. Diagnoses leaks visually. Cheap to build
   on top of `BufferManager.snapshot`.
5. **Streaming-to-disk recordings** (`Future Improvements #17`):
   the recording-side WAV writer was already moved to main in
   phase 5; piping that into a streaming sink (Tauri fs writer or
   `WritableStream`) is a localised change in
   `RecordingController`.
6. **Per-consumer chunk size**: if and only if a future feature
   wants a different chunk size on the same bus (e.g. an FFT
   analyzer with chunkSize = 2048, scope at 1024), the
   `BufferManager` key already covers it (`(bus, channels,
   chunkSize)`); the analyzer would simply acquire a separate
   `BufferController`. No design change, just the configuration
   knob.
