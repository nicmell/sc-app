import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ClockPanel } from '@/ui/ClockPanel';
import { DebugLog } from '@/ui/DebugLog';
import { DirtPanel } from '@/ui/DirtPanel';
import { Footer } from '@/ui/Footer';
import { LoadingModal } from '@/ui/Modal';
import { OscConsole } from '@/ui/OscConsole';
import { RecordingPanel } from '@/ui/RecordingPanel';
import { ScopeList } from '@/ui/ScopeList';
import { SequencerPanel } from '@/ui/SequencerPanel';
import { SynthsPanel } from '@/ui/SynthsPanel';
import { ToastContainer, useToasts } from '@/ui/Toast';
import { SessionProvider, type ConnectionStatus } from '@/session/SessionContext';
import { BufferManager } from '@/buffer/BufferManager';
import { DirtClient } from '@/dirt/DirtClient';
import { RecordingManager } from '@/recording/RecordingManager';
import { status } from '@sc-app/server-commands';
import {
  awaitSclangReady,
  bootstrapSession,
  clearStoredSession,
  deleteSession,
  type SessionInfo,
  type ScsynthVersion,
} from '@/session/sessionBootstrap';
import { ClockController } from '@/clock/ClockController';
import type { ClockInfo } from '@/clock/clockClient';
import type { DirtSample } from '@/session/sessionBootstrap';
import { GroupController } from '@/server/GroupController';
import { IdAllocator } from '@/server/IdAllocator';
import { ScopeManager } from '@/scope/ScopeManager';
import { PatternBank } from '@/sequencer/PatternBank';
import { SequencerController } from '@/sequencer/SequencerController';
import { ServerErrorBus } from '@/server/ServerErrorBus';
import { SynthDefRegistry } from '@/server/SynthDefRegistry';
import { SynthManager } from '@/synth/SynthManager';
import { WorkerClient } from '@/server/WorkerClient';
import { createStore, type Store } from '@/util/reactiveStore';
import { parseStatus, type ScsynthStatus } from '@/server/serverInfo';

/** Per-client offset for node + buffer ID allocators.
 *
 *  scsynth doesn't enforce per-client ID ranges — it just rejects
 *  `/s_new` with a duplicate ID. Phase 26 makes this matter: when
 *  sclang+SuperDirt is hosted on the same scsynth (Phase 26
 *  deployment), sclang lives at clientId=0 and allocates synth IDs
 *  starting at 1000+. If sc-app (clientId≥1) also starts at 1000,
 *  the very first `/s_new` for the global clock collides → the
 *  clock never starts, the dashboard sits dead.
 *
 *  Solution: scope sc-app's allocator base by clientId. 1M per
 *  client is generous (scsynth's default `-n 32768` caps concurrent
 *  nodes well below that, and SuperDirt allocates a few hundred at
 *  init + a few per event). Final start = `clientId * 1_000_000 +
 *  ID_ALLOCATOR_START`; clientId=0 falls back to the pre-Phase-26
 *  base (1000) so single-client setups stay byte-identical. */
const PER_CLIENT_ID_OFFSET = 1_000_000;
const PER_SUB_CLIENT_ID_OFFSET = 100_000;
const ID_ALLOCATOR_START = 1000;

interface DashboardResources {
  client: WorkerClient;
  registry: SynthDefRegistry;
  group: GroupController;
  clock: ClockController;
  ids: { node: IdAllocator; bus: IdAllocator; buffer: IdAllocator };
  bufferManager: BufferManager;
  synthManager: SynthManager;
  scopeManager: ScopeManager;
  recordingManager: RecordingManager;
  /** Phase 24 — surfaces unmatched scsynth `/fail` replies. Created
   *  fresh per `setupDashboard` (cheap; no server-side state).
   *  Disposed by `teardownServerState`. */
  errorBus: ServerErrorBus;
  /** Phase 26 — SuperDirt OSC client layered on the same
   *  `WorkerClient`. Sends flow over `/ws`, demuxed to SuperDirt
   *  by the bridge's `/dirt` route. Fresh per `setupDashboard`;
   *  disposed by `teardownServerState`. */
  dirtClient: DirtClient;
  /** Phase 27 — step sequencer driving SuperDirt via `dirtClient`.
   *  Anchored to `clock.tick0Ms`/`tickRate` for sample-accurate
   *  scheduling. Fresh per `setupDashboard`; pattern data lives
   *  on `bank` (below), which survives re-init. */
  sequencer: SequencerController;
  /** Phase 27c — 8-slot pattern bank with localStorage
   *  persistence. Long-lived: created at initial connect (loads
   *  from localStorage), disposed by `handleDisconnect` (which
   *  flushes a final save). The controller reads
   *  `bank.activePattern` and forwards mutations through
   *  `bank.updateActivePattern(...)`. */
  bank: PatternBank;
  /** Phase 29 — bridge-managed session id (uuid stored per-tab
   *  in `sessionStorage`). Used by handleDisconnect to fire
   *  `DELETE /api/session/:id` and by the WS URL builder. */
  sessionId: string;
  /** scsynth's bridge-level clientId. Phase 39a: shared across
   *  all sessions (the bridge runs `/notify 1` once at boot).
   *  Used as the high-order base for IdAllocator partitioning. */
  scsynthClientId: number;
  /** Phase 39a: per-session sub-allocation index (0..MAX_SESSIONS).
   *  Combined with `scsynthClientId` to compute a unique node-ID
   *  range per session: `scsynthClientId * 1_000_000 + subClientId
   *  * 100_000 + 1000`. */
  subClientId: number;
  /** Phase 39a: bridge-allocated unique group id per session
   *  (`SESSION_GROUP_BASE + subClientId`). */
  parentGroupId: number;
  /** Phase 29: bridge-supplied via `SessionInfo` (read from
   *  scsynth's `/status.reply` at session creation). Round to
   *  integer Hz already done bridge-side. */
  sampleRate: number;
  /** Live status snapshot, updated by the heartbeat in `AppShell`.
   *  `null` until the first reply lands (~tick after dashboard
   *  mount). The footer reads this via `useSyncExternalStore`. */
  status: Store<ScsynthStatus | null>;
  /** scsynth version snapshot, captured by the bridge at boot via
   *  `version_handshake` and surfaced through `SessionInfo`. `null`
   *  if scsynth didn't reply to `/version` at bridge boot
   *  (informational only — connect doesn't block on it). */
  version: ScsynthVersion | null;
}

// ConnectionStatus is the shared app-wide enum, re-exported from
// the SessionContext module so any component can read it without
// importing AppShell internals.

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: 'connected',
  connecting: 'connecting…',
  disconnected: 'disconnected',
};

const STATUS_BADGE_VARIANT: Record<ConnectionStatus, string | undefined> = {
  // foundation .badge defaults to ok-themed; explicit data-variant
  // overrides give us the connecting/disconnected chrome.
  connected: undefined,
  connecting: 'warn',
  disconnected: 'error',
};

/** Dashboard chrome shown in every connection state. The header
 *  always renders; the body (panels) is conditional on a live
 *  `resources`. Phase 29d removed the always-mount-or-nothing
 *  dichotomy with ConnectScreen; users now see the same shell
 *  in both connected and disconnected states, with the action
 *  button toggling Connect/Disconnect. */
function Dashboard({
  resources,
  status,
  onConnect,
  onDisconnect,
}: {
  resources: DashboardResources | null;
  status: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <main className="dashboard-shell">
      <DashboardHeader
        status={status}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
      />
      {resources ? <DashboardPanels resources={resources} /> : <DisabledPanels />}
    </main>
  );
}

/** Disabled-panel placeholders rendered while the session is
 *  bootstrapping or disconnected. Each card has the same
 *  chrome as the live panel but with the foundation's
 *  `aria-disabled="true"` styling (opacity dimming +
 *  pointer-events: none). Keeps the dashboard layout stable
 *  across connect/disconnect transitions instead of collapsing
 *  to just-the-header. */
function DisabledPanels() {
  // Order mirrors DashboardPanels so panels don't reflow when
  // we transition between live and disabled states.
  const titles = [
    'Clock',
    'Synths',
    'Scopes',
    'Recordings',
    'Dirt',
    'Sequencer',
    'OSC Console',
  ];
  return (
    <>
      {titles.map((title) => (
        <section key={title} className="panel" aria-disabled="true">
          <header>{title}</header>
          <p className="empty">not connected</p>
        </section>
      ))}
    </>
  );
}

function DashboardHeader({
  status,
  onConnect,
  onDisconnect,
}: {
  status: ConnectionStatus;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <header className="cluster" data-gap="md">
      <span
        className="badge"
        data-variant={STATUS_BADGE_VARIANT[status]}
      >
        {STATUS_LABELS[status]}
      </span>
      {status === 'connected' ? (
        <button
          type="button"
          data-variant="ghost"
          onClick={onDisconnect}
        >
          Disconnect
        </button>
      ) : (
        <button
          type="button"
          onClick={onConnect}
          disabled={status === 'connecting'}
        >
          Connect
        </button>
      )}
    </header>
  );
}

function DashboardPanels({ resources }: { resources: DashboardResources }) {
  // Sequencer's Play button needs the audio clock to be running
  // (`tick0Ms !== null`). `effectiveState` is reactive: 'stopped'
  // until the clock starts, 'running' once /tr packets are
  // flowing, 'paused' across re-init / explicit pause.
  const clockState = useSyncExternalStore(
    (cb) => resources.clock.effectiveState.subscribe(cb),
    () => resources.clock.effectiveState.get(),
  );
  return (
    <>
      <ClockPanel clock={resources.clock} group={resources.group} />
      <SynthsPanel manager={resources.synthManager} />
      <ScopeList manager={resources.scopeManager} />
      <RecordingPanel
        manager={resources.recordingManager}
        clock={resources.clock}
        sampleRate={resources.clock.env.sampleRate}
      />
      <DirtPanel client={resources.dirtClient} />
      <SequencerPanel
        controller={resources.sequencer}
        bank={resources.bank}
        dirtClient={resources.dirtClient}
        clockReady={clockState === 'running'}
      />
      <OscConsole client={resources.client} />
      <Footer status={resources.status} version={resources.version} />
    </>
  );
}

/** Build the WS URL for an existing bridge-managed session.
 *  Phase 29: replaces the pre-29 `wsUrlFor(address)` which used
 *  `?scsynth=` to drive per-WS notify handshake. The session
 *  already did the handshake bridge-side; the WS just attaches. */
function wsUrlFor(sessionId: string): string {
  // Always same-origin: in production the webview / browser hits
  // axum directly; in dev Vite proxies `/ws` to the bridge (see
  // `vite.config.ts`). No env var indirection needed.
  const url = new URL('/ws', window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('session', sessionId);
  return url.href;
}

/**
 * Build all the per-session server-side state plus the controllers
 * that wrap it. Called once per WS connect — there is no in-place
 * re-init flow post-Phase-30 (chunkSize is owned by sclang's shared
 * clock, not the dashboard).
 *
 * Inputs are deliberately minimal: the `client` (WS stays open),
 * the `parentGroupId` (notify(1) handshake already done bridge-side
 * at session create), and the runtime `sampleRate` (from /status,
 * informational only — the authoritative value comes from
 * `/clock/info`).
 *
 * The registry is a fresh instance per call. SynthDefs uploaded to
 * scsynth in a previous round persist server-side; the new registry
 * re-uploads what it doesn't remember on first `ensureLoaded`. Cost:
 * one extra `/d_recv` per `(channels, chunkSize)` tuple per
 * reconnect. Harmless.
 */
async function setupDashboard(
  client: WorkerClient,
  sessionId: string,
  scsynthClientId: number,
  subClientId: number,
  parentGroupId: number,
  sampleRate: number,
  clockInfo: ClockInfo,
  dirtSamples: DirtSample[],
  scsynthVersion: ScsynthVersion | null,
  bank: PatternBank,
): Promise<DashboardResources> {
  // Phase 39a — IdAllocator base partitions across both the
  // scsynth-level clientId AND the bridge-allocated subClientId.
  // The bridge runs /notify 1 once and gets a single clientId;
  // sessions sub-partition that 1M-id slice into 100K-id slices
  // via subClientId. Buffer base sits +5000 above node base.
  const idBase =
    scsynthClientId * PER_CLIENT_ID_OFFSET +
    subClientId * PER_SUB_CLIENT_ID_OFFSET +
    ID_ALLOCATOR_START;
  const ids = {
    node: new IdAllocator(idBase),
    bus: new IdAllocator(32),
    buffer: new IdAllocator(idBase + 5000),
  };

  console.log(
    `[sc:app] setupDashboard scsynthClientId=${scsynthClientId} ` +
      `subClientId=${subClientId} parentGroupId=${parentGroupId} ` +
      `idBase=${idBase} (node allocator start)`,
  );

  // Phase 24: subscribe to /fail replies BEFORE any /s_new fires.
  // Otherwise the very first /fail (e.g. clock /s_new collision with
  // a SuperDirt node) lands before the bus has subscribed and gets
  // dropped silently. Fresh ring per setupDashboard; subscribing on
  // the same WorkerClient again is fine.
  const errorBus = new ServerErrorBus(client);

  const registry = new SynthDefRegistry(client);
  const group = new GroupController(client, parentGroupId);
  // Phase 39b: ClockController takes ClockInfo at construction
  // (cached by the bridge at boot via /sc-app/bootstrap/hello).
  // No per-session /clock/hello round-trip.
  const clock = new ClockController({ client, group, info: clockInfo });

  // Parent group is created here (paused, via
  // `GroupController.ensureCreated`'s atomic /g_new + /n_run 0
  // bundle), separately from the shared clock — which lives in
  // sclang at scsynth's root group, OUTSIDE this client's parent
  // group.
  await group.ensureCreated();
  clock.attach();
  console.log(
    `[sc:app] clock attached — clockBus=${clockInfo.clockBus}, ` +
      `sampleRate=${clockInfo.sampleRate}, chunkSize=${clockInfo.chunkSize}, ` +
      `tickRate=${clock.derived.tickRate.toFixed(3)} Hz (from cached bootstrap)`,
  );
  const synthManager = new SynthManager({
    client,
    group,
    registry,
    ids: { node: ids.node, bus: ids.bus },
  });
  const bufferManager = new BufferManager({
    client,
    group,
    registry,
    ids: { node: ids.node, buffer: ids.buffer },
    clock,
  });
  const scopeManager = new ScopeManager({
    bufferManager,
    clock,
  });
  const recordingManager = new RecordingManager({
    bufferManager,
    clock,
  });

  // Phase 26: SuperDirt client over the same WS. Fire-and-forget
  // hello probe (Q2 = once on mount); status flips when reply
  // lands or the timeout expires.
  // Phase 39b: sample-bank list is seeded from the cached
  // bootstrap snapshot (SessionInfo.dirtSamples) — no per-session
  // /dirt/listSamples round-trip.
  const dirtClient = new DirtClient(client);
  dirtClient.setSampleBanks(dirtSamples);
  void dirtClient.probe();

  // Phase 27a/c: step sequencer. Owns transport + wake loop;
  // pattern state lives on the long-lived `bank`. Reads
  // tick0Ms/tickRate live from `clock` so BPM changes mid-pattern
  // don't require a restart. Adapter object because
  // `ClockController` exposes `tickRate` under `derived`, while
  // the sequencer's `ClockLike` interface keeps the surface flat
  // for testability.
  const sequencer = new SequencerController({
    client,
    clock: {
      get tick0Ms() {
        return clock.tick0Ms;
      },
      get tickRate() {
        return clock.derived.tickRate;
      },
      get chunkSize() {
        return clock.info.chunkSize;
      },
      get sampleRate() {
        return clock.info.sampleRate;
      },
    },
    bank,
    // Phase 30: when the user pauses the parent group, the shared
    // clock keeps ticking but we don't want the sequencer to emit
    // `/dirt/play`. Phase 32 pushed the pump into the worker;
    // SequencerController subscribes to this store and forwards
    // changes via `client.setSequencerPaused()`.
    groupState: group.state,
  });

  // Phase 39 hotfix: scsynth version is captured by the bridge at
  // boot (`version_handshake`) and surfaced via SessionInfo. No
  // per-session OSC round-trip; the value is informational only and
  // displayed in the footer.
  if (scsynthVersion) {
    console.log(
      `[sc:app] scsynth version (cached from bridge): ${scsynthVersion.progName} ` +
        `${scsynthVersion.major}.${scsynthVersion.minor}${scsynthVersion.patch}` +
        (scsynthVersion.branch ? ` (${scsynthVersion.branch})` : ''),
    );
  }

  console.log('[sc:app] dashboard ready');

  return {
    client,
    registry,
    group,
    clock,
    ids,
    bufferManager,
    synthManager,
    scopeManager,
    recordingManager,
    sessionId,
    scsynthClientId,
    subClientId,
    parentGroupId,
    sampleRate,
    status: createStore<ScsynthStatus | null>(null),
    version: scsynthVersion,
    errorBus,
    dirtClient,
    sequencer,
    bank,
  };
}

/**
 * Tear down everything `setupDashboard` builds — but NOT the
 * `WorkerClient` or the `notify(1)` subscription. Used by
 * `handleDisconnect` for full shutdown. Each step is best-effort.
 */
async function teardownServerState(resources: DashboardResources): Promise<void> {
  // Bus disposal is cheap and non-server-touching — drop subscription,
  // clear ring. Run early so any /fail replies during the teardown
  // itself (rare but possible — e.g. /n_free against a stale node)
  // aren't surfaced post-mortem.
  try {
    resources.errorBus.dispose();
  } catch (err) {
    console.warn('[sc:app] errorBus.dispose failed', err);
  }
  // Sequencer first, then dirtClient — sequencer.dispose() stops
  // playback (cancels pending playhead timers) and the wake loop;
  // it must finish before the dirtClient teardown nulls its
  // reply listener.
  try {
    resources.sequencer.dispose();
  } catch (err) {
    console.warn('[sc:app] sequencer.dispose failed', err);
  }
  try {
    resources.dirtClient.dispose();
  } catch (err) {
    console.warn('[sc:app] dirtClient.dispose failed', err);
  }
  try {
    await resources.recordingManager.stopAll();
  } catch (err) {
    console.warn('[sc:app] recordingManager.stopAll failed', err);
  }
  try {
    await resources.scopeManager.clear();
  } catch (err) {
    console.warn('[sc:app] scopeManager.clear failed', err);
  }
  // Buffer manager runs after both consumer-side managers have
  // released their handles. By this point the map should be empty;
  // a warning logs to the console if it's not (refcount-leak
  // canary). Either way the controllers it still holds are
  // disposed (`/n_free` + `/b_free`) here, before `group.free()`
  // would have done a coarser /g_freeAll.
  try {
    await resources.bufferManager.clear();
  } catch (err) {
    console.warn('[sc:app] bufferManager.clear failed', err);
  }
  try {
    await resources.synthManager.clear();
  } catch (err) {
    console.warn('[sc:app] synthManager.clear failed', err);
  }
  try {
    // Phase 30: detach is sync — there's no /n_free to await, the
    // clock keeps running on sclang's side. Just drop the trig
    // listener and the watchdog.
    resources.clock.detach();
  } catch (err) {
    console.warn('[sc:app] clock.detach failed', err);
  }
  try {
    await resources.group.free();
  } catch (err) {
    console.warn('[sc:app] group.free failed', err);
  }
}

/** Phase 29c — bootstrap state machine driving the auto-connect
 *  flow. The frontend hits the bridge once on mount to read or
 *  mint a session; AppShell consumes the resulting `SessionInfo`
 *  to skip the per-WS scsynth handshake and go straight to
 *  setupDashboard.
 *
 *  Phases:
 *  - `pending`: bootstrap in flight (initial render, after retry,
 *    after explicit Reset Session).
 *  - `ready`: bootstrap returned `SessionInfo` — the connect
 *    effect fires `handleConnect(info)` next render.
 *  - `disconnected`: user clicked Disconnect; session DELETEd,
 *    sessionStorage cleared. ConnectScreen offers Reconnect,
 *    which transitions back to `pending`.
 *  - `error`: bootstrap or handleConnect threw. ConnectScreen
 *    shows the message inline + Retry button (→ `pending`). */
type BootstrapState =
  | { phase: 'pending' }
  | { phase: 'ready'; info: SessionInfo }
  | { phase: 'disconnected' }
  | { phase: 'error'; error: string }
  /** Phase 39 hotfix: bridge created the session but sclang
   *  wasn't reachable at boot time. AppShell is polling the
   *  bridge while showing a "waiting for sclang…" banner. */
  | { phase: 'waiting-for-sclang'; sessionId: string };

export function AppShell() {
  const [resources, setResources] = useState<DashboardResources | null>(null);
  const [bootstrapState, setBootstrapState] = useState<BootstrapState>({
    phase: 'pending',
  });
  /** Phase 29d: toast surface for transient errors, warnings,
   *  and successes. Replaces both the AlertModal flow (for
   *  runtime failures) and the ConnectScreen inline error (for
   *  bootstrap failures). Toasts auto-dismiss except errors,
   *  which stay until the user clicks ×. */
  const { toasts, show: showToast, dismiss: dismissToast } = useToasts();

  // Keep the latest client in a ref so the error-handler effect can
  // tear it down on a stale event without re-subscribing every render.
  const clientRef = useRef<WorkerClient | null>(null);
  useEffect(() => {
    clientRef.current = resources?.client ?? null;
  }, [resources]);

  // Phase 29c: bootstrap. On mount and on every transition back
  // into the `pending` phase (e.g. user clicks Retry / Reconnect),
  // hit the bridge to read or mint the per-tab session. Aborts if
  // the component unmounts mid-flight.
  useEffect(() => {
    if (bootstrapState.phase !== 'pending') return;
    let cancelled = false;
    bootstrapSession()
      .then((info) => {
        if (cancelled) return;
        setBootstrapState({ phase: 'ready', info });
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        console.error('[sc:app] session bootstrap failed', message);
        showToast(`Couldn't connect to bridge: ${message}`, 'error');
        setBootstrapState({ phase: 'disconnected' });
      });
    return () => {
      cancelled = true;
    };
  }, [bootstrapState, showToast]);

  /** Phase 29: handleConnect now consumes a `SessionInfo` from
   *  the bridge — the scsynth handshake (`/status` + `/notify 1`)
   *  has already happened bridge-side at session-creation time,
   *  so the WS just attaches and we go straight to setupDashboard.
   *
   *  The WS URL uses `?session=<uuid>`; the bridge forwards bytes
   *  via the Session's pre-bound UDP sockets and broadcasts inbound
   *  replies to all attached WS. */
  const handleConnect = useCallback(async (info: SessionInfo) => {
    console.log('[sc:app] handleConnect', info);

    const url = wsUrlFor(info.sessionId);
    console.log('[sc:app] ws url', url);
    const next = new WorkerClient(url);

    try {
      await next.ready;
    } catch (err) {
      console.error('[sc:app] ready failed:', err);
      next.dispose();
      throw err;
    }

    // Phase 27c: construct the pattern bank up here, before
    // setupDashboard AND before the onError handler so it can
    // dispose the bank on WS death. Constructor loads from
    // localStorage; if bring-up fails, the bank is GC'd
    // untouched (no save happens because nothing has mutated
    // it yet).
    const bank = new PatternBank();

    // Wire disconnection handler *before* the async bring-up so
    // a mid-bring-up WebSocket error still unwinds cleanly.
    // Runtime errors (post-connect WS death) surface as a toast;
    // the dashboard's header drops to "disconnected" and the
    // user can click Connect to retry. Don't DELETE the session
    // — the bridge may still hold it; a fresh bootstrap can
    // reuse on best-case or 404+POST on network blip.
    next.onError((message) => {
      if (clientRef.current === next) {
        showToast(`Connection lost: ${message}`, 'error');
        // Flush any pending pattern saves before the bank is
        // dropped — the user may have been editing right up
        // to the WS death.
        try {
          bank.dispose();
        } catch {
          /* best effort */
        }
        next.dispose();
        clientRef.current = null;
        setResources(null);
        setBootstrapState({ phase: 'disconnected' });
      }
    });

    let built: DashboardResources;
    try {
      // Phase 39b: cached clock metadata is required for dashboard
      // bring-up. Phase 39 hotfix: if sclang wasn't reachable when
      // the session was first created, info.clock will be null —
      // poll the bridge until the lazy bootstrap completes (every
      // GET retriggers the bridge's bootstrap attempt).
      let resolvedInfo = info;
      if (resolvedInfo.clock === null) {
        console.warn(
          '[sc:app] clock metadata missing — waiting for sclang to become reachable',
        );
        setBootstrapState({
          phase: 'waiting-for-sclang',
          sessionId: info.sessionId,
        });
        resolvedInfo = await awaitSclangReady(info.sessionId);
      }
      const clockInfo: ClockInfo =
        resolvedInfo.clock ??
        (() => {
          throw new Error(
            'awaitSclangReady resolved with null clock — invariant violated',
          );
        })();
      built = await setupDashboard(
        next,
        resolvedInfo.sessionId,
        resolvedInfo.scsynthClientId,
        resolvedInfo.subClientId,
        resolvedInfo.parentGroupId,
        resolvedInfo.sampleRate,
        clockInfo,
        resolvedInfo.dirtSamples,
        resolvedInfo.scsynthVersion,
        bank,
      );
    } catch (err) {
      console.error('[sc:app] dashboard bring-up failed', err);
      next.dispose();
      throw err;
    }

    setResources(built);
  }, []);

  // Phase 29c: auto-connect when bootstrap reports a ready
  // session. If handleConnect throws (stale-session /s_new
  // conflict, scsynth gone mid-bootstrap, anything else), we
  // DELETE the session + clear sessionStorage so the next retry
  // mints fresh. The user sees ConnectScreen with the error
  // inline; clicking Retry re-enters `pending`.
  useEffect(() => {
    if (bootstrapState.phase !== 'ready') return;
    if (resources !== null) return;

    let cancelled = false;
    const info = bootstrapState.info;
    handleConnect(info).catch((err) => {
      if (cancelled) return;
      const message = err instanceof Error ? err.message : String(err);
      console.error('[sc:app] handleConnect failed', message);
      showToast(`Failed to connect: ${message}`, 'error');
      void deleteSession(info.sessionId);
      clearStoredSession();
      setBootstrapState({ phase: 'disconnected' });
    });

    return () => {
      cancelled = true;
    };
  }, [bootstrapState, resources, handleConnect, showToast]);

  const handleDisconnect = useCallback(async () => {
    const current = resources;
    if (current) {
      // Server-side state goes first (recordings → scopes → clock →
      // group). Each step is best-effort.
      await teardownServerState(current);
      // dispose() flushes a final save — important if a mutation
      // happened in the last 500 ms.
      try {
        current.bank.dispose();
      } catch (err) {
        console.warn('[sc:app] bank.dispose failed', err);
      }
      current.client.dispose();
      clientRef.current = null;
      // Phase 29: tell the bridge the session is gone. The bridge
      // runs its cleanup bundle (/g_freeAll + /n_free + /notify 0)
      // — same shape as the pre-29 frontend tail, just owned by
      // the bridge now. clearStoredSession ensures the next
      // bootstrap can't hit a 404 on the just-dead id.
      void deleteSession(current.sessionId);
      clearStoredSession();
    }
    setResources(null);
    setBootstrapState({ phase: 'disconnected' });
  }, [resources]);

  // Phase 30c: the chunkSize re-init flow is gone. chunkSize is
  // owned by sclang's shared clock (`SC_APP_CLOCK_CHUNK_SIZE` env
  // var); a different value requires restarting sclang, which all
  // attached sessions then re-attach to via the auto-reconnect on
  // next page load. The header dropdown, runReinit / onChunkSize-
  // Change / onConfirmReinit / onCancelReinit callbacks, and the
  // ConfirmReinitModal all moved out with this phase.

  // scsynth liveness heartbeat + status snapshot. The bridge's
  // WebSocket stays open even when scsynth is killed (UDP doesn't
  // surface "no listener" errors), so without an active probe the
  // dashboard would happily sit there sending /b_getn into the
  // void. Periodically round-trip a /status — on success, parse
  // and push into `resources.status` for the footer; on timeout,
  // treat as scsynth death (runtime error → dispose → tear down,
  // same flow as the existing onError path).
  //
  // 3 s interval + 2 s timeout = up to 5 s detection latency. Lower
  // values would catch faster but burn more bandwidth on a healthy
  // session. /status is a cheap reply (~9 args, < 100 bytes).
  //
  // The first tick runs immediately so the footer doesn't sit blank
  // for the first 3 s of the session.
  useEffect(() => {
    if (!resources) return;
    const { client, status: statusStore, bank } = resources;
    const HEARTBEAT_INTERVAL_MS = 3000;
    const HEARTBEAT_TIMEOUT_MS = 2000;
    let cancelled = false;

    const tick = async () => {
      // Phase 33a: skip the heartbeat while the tab is hidden.
      // Chromium's intensive throttling clamps both `setInterval`
      // and the `sendAndAwaitReply` reject-timer to once-per-minute
      // after ~5 min hidden, while `/status.reply` postMessages
      // still queue from the worker. On the next main-thread flush
      // the timer can fire before the reply lands, and the heartbeat
      // falsely tears down a healthy session. Bridge TTL (default
      // 30 min, scans every minute) is the ground-truth aliveness
      // check — we don't need a per-tab heartbeat in the background.
      if (
        typeof document !== 'undefined' &&
        document.visibilityState !== 'visible'
      ) {
        return;
      }
      try {
        const reply = await client.sendAndAwaitReply(
          status(),
          (r) => r.address === '/status.reply',
          HEARTBEAT_TIMEOUT_MS,
        );
        if (cancelled) return;
        statusStore.set(parseStatus(reply));
      } catch (err) {
        if (cancelled) return;
        // Same dedup guard as the WS-onError path — whichever
        // detects the failure first wins; the loser sees
        // `clientRef.current !== client` and bails, avoiding a
        // double-dispose / double-modal.
        if (clientRef.current !== client) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[sc:app] heartbeat failed:', msg);
        showToast(
          `scsynth stopped responding to /status: ${msg}`,
          'error',
        );
        try {
          bank.dispose();
        } catch {
          /* best effort */
        }
        client.dispose();
        clientRef.current = null;
        setResources(null);
        // Don't DELETE the session — bridge may still have it; a
        // fresh bootstrap can either reuse (best case) or 404+POST.
        setBootstrapState({ phase: 'disconnected' });
      }
    };

    void tick();
    const intervalId = window.setInterval(() => {
      void tick();
    }, HEARTBEAT_INTERVAL_MS);
    // Refresh the footer status immediately when the tab returns;
    // otherwise it would sit stale until the next 3 s interval
    // boundary.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void tick();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [resources]);

  // Best-effort shutdown when the tab / Tauri window closes.
  // Phase 29: send `DELETE /api/session/:id` with `keepalive: true`
  // so the request completes after the page begins unloading. The
  // bridge runs the cleanup bundle (/g_freeAll + /n_free + /notify
  // 0) on receipt — same shape as the pre-29 frontend tail, just
  // owned by the bridge now. If the request fails to land (hard
  // SIGKILL, no keepalive support), the future TTL job (29d)
  // catches the leak.
  useEffect(() => {
    if (!resources) return;
    const sessionId = resources.sessionId;
    const handler = () => {
      try {
        // `keepalive: true` lets the request outlive the page.
        // Result is ignored — we're unloading anyway.
        void fetch(`/api/session/${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
          keepalive: true,
        });
      } catch {
        /* best effort */
      }
    };
    window.addEventListener('pagehide', handler);
    return () => window.removeEventListener('pagehide', handler);
  }, [resources]);

  // beforeunload guard for un-saved recording state. Browsers ignore
  // any custom message and show a generic "leave site?" prompt; we
  // just opt in by setting `returnValue` (and returning a string for
  // the legacy WebKit code path) when there's something the user
  // would lose:
  //
  //  - any recording still actively running (`recording` /
  //    `preparing` / `finalizing`) — its WAV isn't finalised yet, and
  //    the worker's in-memory buffer dies with the page.
  //  - any `done` recording with a non-null `result` — there's a Blob
  //    sitting in memory the user hasn't downloaded *or* dismissed.
  //    Once they hit Download or Dismiss, the warning goes silent.
  //
  // We register the listener once per `resources` epoch and read the
  // recording manager's live store inside the handler so the gate
  // reflects current state without retriggering the effect.
  useEffect(() => {
    if (!resources) return;
    const handler = (e: BeforeUnloadEvent) => {
      const list = resources.recordingManager.recordings.get();
      const dirty = list.some((r) => {
        const state = r.state.get();
        if (
          state === 'recording' ||
          state === 'preparing' ||
          state === 'finalizing'
        ) {
          return true;
        }
        if (state === 'done' && r.result.get() !== null) return true;
        return false;
      });
      if (!dirty) return;
      e.preventDefault();
      // `returnValue = ''` is what modern browsers actually look at;
      // returning a string is the legacy WebKit code path.
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [resources]);

  // Expose the client + clock in dev mode for console poking.
  useEffect(() => {
    if (!resources) return;
    const w = window as unknown as {
      __scClient?: WorkerClient;
      __scGroup?: GroupController;
      __scClock?: ClockController;
    };
    w.__scClient = resources.client;
    w.__scGroup = resources.group;
    w.__scClock = resources.clock;
    return () => {
      delete w.__scClient;
      delete w.__scGroup;
      delete w.__scClock;
    };
  }, [resources]);

  // Phase 29d: derive the dashboard's connection status from
  // the bootstrap state machine + resources. Header chrome reads
  // this to pick the badge variant, the action button label,
  // and whether the chunk-size picker is interactive. Named
  // `connectionStatus` (not just `status`) to avoid shadowing
  // the imported `status` OSC command builder used by the
  // heartbeat tick.
  const connectionStatus: ConnectionStatus = resources
    ? 'connected'
    : bootstrapState.phase === 'pending' ||
        bootstrapState.phase === 'ready' ||
        bootstrapState.phase === 'waiting-for-sclang'
      ? 'connecting'
      : 'disconnected';

  // Loading overlay is up while the bridge session is being
  // bootstrapped. Phase 30c: the re-init flow is gone, so this is
  // now a one-shot at initial connect.
  const showLoadingOverlay = connectionStatus === 'connecting' && !resources;

  const onConnect = useCallback(() => {
    setBootstrapState({ phase: 'pending' });
  }, []);

  return (
    <SessionProvider
      value={{
        status: connectionStatus,
        sessionId: resources?.sessionId ?? null,
      }}
    >
      <Dashboard
        resources={resources}
        status={connectionStatus}
        onConnect={onConnect}
        onDisconnect={handleDisconnect}
      />
      {showLoadingOverlay && (
        <LoadingModal
          title={
            bootstrapState.phase === 'waiting-for-sclang'
              ? 'Waiting for sclang…'
              : 'Connecting…'
          }
          message={
            bootstrapState.phase === 'waiting-for-sclang'
              ? 'Bridge is up; sclang+SuperDirt isn’t reachable yet. Start it; this dialog will close automatically.'
              : 'Establishing the bridge session and connecting to scsynth.'
          }
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <DebugLog errorBus={resources?.errorBus ?? null} />
    </SessionProvider>
  );
}
