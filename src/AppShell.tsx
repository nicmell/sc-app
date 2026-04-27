import { useCallback, useEffect, useRef, useState } from 'react';
import { ClockPanel } from '@/ui/ClockPanel';
import { ConnectScreen } from '@/ui/ConnectScreen';
import { DebugLog } from '@/ui/DebugLog';
import { Footer } from '@/ui/Footer';
import { AlertModal, ConfirmModal, LoadingModal } from '@/ui/Modal';
import { RecordingPanel } from '@/ui/RecordingPanel';
import { ScopeList } from '@/ui/ScopeList';
import { SynthsPanel } from '@/ui/SynthsPanel';
import {
  DEFAULT_PARAMS,
  practicalChunkSizes,
} from '@/config/clockConfig';
import { BufferManager } from '@/buffer/BufferManager';
import { RecordingManager } from '@/recording/RecordingManager';
import {
  gFreeAll,
  nFree,
  notify,
  status,
  version,
} from '@sc-app/server-commands';
import { ClockController } from '@/clock/ClockController';
import { GroupController } from '@/server/GroupController';
import { IdAllocator } from '@/server/IdAllocator';
import { ScopeManager } from '@/scope/ScopeManager';
import { SynthDefRegistry } from '@/server/SynthDefRegistry';
import { SynthManager } from '@/synth/SynthManager';
import { WorkerClient } from '@/server/WorkerClient';
import { createStore, type Store } from '@/util/reactiveStore';
import {
  parseStatus,
  parseVersion,
  type ScsynthStatus,
  type ScsynthVersion,
} from '@/server/serverInfo';

const STORAGE_KEY = 'sc.address';
const STATUS_PROBE_TIMEOUT_MS = 1000;
/** Fallback when scsynth returns clientId 0 (can't use root group 0). */
const FALLBACK_PARENT_GROUP_ID = 100;

interface DashboardResources {
  client: WorkerClient;
  registry: SynthDefRegistry;
  group: GroupController;
  clock: ClockController;
  ids: { node: IdAllocator; buffer: IdAllocator; bus: IdAllocator };
  bufferManager: BufferManager;
  synthManager: SynthManager;
  scopeManager: ScopeManager;
  recordingManager: RecordingManager;
  /** Stashed for in-place re-init: re-issuing `notify(1)` over the
   *  same WS would either be rejected by scsynth or hand back a
   *  different `clientId`, orphaning the existing parent group. The
   *  initial connect derives this once; every rebuild reuses it. */
  parentGroupId: number;
  /** Captured from `/status.reply.args[8]` at initial connect. The
   *  re-init path forwards the same value to `setupDashboard` —
   *  scsynth's sample rate doesn't change during a session. */
  sampleRate: number;
  /** Live status snapshot, updated by the heartbeat in `AppShell`.
   *  `null` until the first reply lands (~tick after dashboard
   *  mount). The footer reads this via `useSyncExternalStore`. */
  status: Store<ScsynthStatus | null>;
  /** Fetched once at `setupDashboard` time. `null` if `/version`
   *  timed out (informational only — connect doesn't block on it). */
  version: ScsynthVersion | null;
}

/**
 * Dashboard — the live UI when connected. The header carries the
 * connected-state badge, the chunk-size selector (which drives a
 * full re-init when changed), and the Disconnect button. Below
 * that: clock panel, scope list, recording panel.
 */
function Dashboard({
  resources,
  chunkSize,
  reiniting,
  onChunkSizeChange,
  onDisconnect,
}: {
  resources: DashboardResources;
  chunkSize: number;
  reiniting: boolean;
  onChunkSizeChange: (next: number) => void;
  onDisconnect: () => void;
}) {
  const options = practicalChunkSizes(resources.sampleRate);
  return (
    <main className="dashboard-shell">
      <header>
        <span className="badge">connected</span>
        <label className="chunk-size-picker">
          chunk size&nbsp;
          <select
            value={chunkSize}
            disabled={reiniting}
            onChange={(e) => onChunkSizeChange(Number(e.target.value))}
            title={
              `Tick rate = sampleRate / chunkSize. Changing this ` +
              `re-initialises the dashboard.`
            }
          >
            {options.map((cs) => (
              <option key={cs} value={cs}>
                {cs} ({(resources.sampleRate / cs).toFixed(2)} Hz tick)
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={reiniting}
        >
          Disconnect
        </button>
      </header>
      <ClockPanel clock={resources.clock} />
      <SynthsPanel manager={resources.synthManager} />
      <ScopeList manager={resources.scopeManager} />
      <RecordingPanel
        manager={resources.recordingManager}
        clock={resources.clock}
        sampleRate={resources.clock.env.sampleRate}
      />
      <Footer status={resources.status} version={resources.version} />
    </main>
  );
}

function readInitialAddress(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // localStorage can throw in private modes / sandboxed contexts.
  }
  const urlParam = new URL(window.location.href).searchParams.get('scsynth');
  return urlParam ?? '127.0.0.1:57110';
}

function wsUrlFor(address: string): string {
  const base =
    (import.meta.env.VITE_OSC_WS_URL as string | undefined) ??
    window.location.origin;
  const url = new URL('/ws', base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('scsynth', address);
  return url.href;
}

/**
 * Build (or rebuild, after a chunkSize change) all the per-session
 * server-side state plus the controllers that wrap it. Used by both
 * the initial `handleConnect` and the in-place re-init flow.
 *
 * Inputs are deliberately minimal: the same `client` (WS stays
 * open), the same `parentGroupId` (notify(1) handshake already done
 * at initial connect), the runtime `sampleRate` (from /status), and
 * the chunkSize the dashboard wants this round.
 *
 * Note: the registry is a fresh instance per call. SynthDefs
 * uploaded to scsynth in a previous round persist server-side; the
 * new registry just re-uploads what it doesn't remember on first
 * `ensureLoaded`. Cost: one extra `/d_recv` per (channels,
 * chunkSize) tuple per re-init. Harmless. The IdAllocators reset to
 * 1000/1000/32 — safe because `teardownServerState` runs
 * `group.free()` which `/g_freeAll`s every node and buffer in the
 * parent group, leaving the id space clean.
 */
async function setupDashboard(
  client: WorkerClient,
  parentGroupId: number,
  sampleRate: number,
  chunkSize: number,
): Promise<DashboardResources> {
  const ids = {
    node: new IdAllocator(1000),
    buffer: new IdAllocator(1000),
    bus: new IdAllocator(32),
  };
  const registry = new SynthDefRegistry(client);
  const group = new GroupController(client, parentGroupId);
  const clock = new ClockController({
    client,
    group,
    registry,
    nodeIds: ids.node,
    busIds: ids.bus,
    env: { sampleRate },
    params: { chunkSize },
  });

  console.log(
    `[sc:app] starting global clock in group ${parentGroupId}, ` +
      `clockBus=${clock.clockBus}, sampleRate=${sampleRate}, ` +
      `chunkSize=${chunkSize}, tickRate=${clock.derived.tickRate.toFixed(3)} Hz`,
  );
  // The parent group is created paused inside `clock.start()` (via
  // `GroupController.ensureCreated`'s atomic /g_new + /n_run 0
  // bundle), so the clock synth /s_new'd here lands in a paused
  // group and never ticks until the user clicks Start.
  await clock.start();
  const synthManager = new SynthManager({
    client,
    group,
    registry,
    ids: { node: ids.node, bus: ids.bus },
  });
  const bufferManager = new BufferManager({
    client,
    clock,
    group,
    registry,
    ids: { node: ids.node, buffer: ids.buffer },
  });
  const scopeManager = new ScopeManager({
    bufferManager,
    clock,
  });
  const recordingManager = new RecordingManager({
    client,
    clock,
    group,
    registry,
    ids: { node: ids.node, buffer: ids.buffer },
    bufferManager,
  });

  // One-shot /version fetch. Informational only — fail open with
  // null rather than blocking the dashboard if it times out (which
  // shouldn't happen against a healthy scsynth, but old or exotic
  // forks might not support /version).
  let parsedVersion: ScsynthVersion | null = null;
  try {
    const reply = await client.sendAndAwaitReply(
      version(),
      (r) => r.address === '/version.reply',
      1500,
    );
    parsedVersion = parseVersion(reply);
    console.log(
      `[sc:app] /version reply: ${parsedVersion.progName} ` +
        `${parsedVersion.major}.${parsedVersion.minor}${parsedVersion.patch}` +
        (parsedVersion.branch ? ` (${parsedVersion.branch})` : ''),
    );
  } catch (err) {
    console.warn('[sc:app] /version probe failed (non-fatal):', err);
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
    parentGroupId,
    sampleRate,
    status: createStore<ScsynthStatus | null>(null),
    version: parsedVersion,
  };
}

/**
 * Tear down everything `setupDashboard` builds — but NOT the
 * `WorkerClient` or the `notify(1)` subscription. Re-used by
 * `handleDisconnect` (full shutdown) and the re-init flow
 * (rebuild against the same WS). Each step is best-effort.
 */
async function teardownServerState(resources: DashboardResources): Promise<void> {
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
    await resources.clock.dispose();
  } catch (err) {
    console.warn('[sc:app] clock.dispose failed', err);
  }
  try {
    await resources.group.free();
  } catch (err) {
    console.warn('[sc:app] group.free failed', err);
  }
}

export function AppShell() {
  const [defaultAddress] = useState(readInitialAddress);
  const [resources, setResources] = useState<DashboardResources | null>(null);
  /** Modal-style error shown after a *runtime* failure — typically a
   *  WebSocket close mid-session, or a re-init failure. The
   *  dashboard tears down, the connect screen renders behind, and
   *  this modal fronts it until the user dismisses. (Connect-time
   *  failures, by contrast, surface inline on the connect screen
   *  via `ConnectScreen`'s own `localError` — those are caught from
   *  `handleConnect`'s thrown promise inside the form submit.) */
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  /** Currently-applied chunk size. Updated atomically with
   *  `setResources` after a successful re-init. */
  const [chunkSize, setChunkSize] = useState(DEFAULT_PARAMS.chunkSize);
  /** True while a re-init is in progress — drives the
   *  indeterminate `LoadingModal` overlay. Also disables the
   *  header dropdown and Disconnect button. */
  const [reiniting, setReiniting] = useState(false);
  /** Non-null while the confirm modal is visible. Captures the
   *  pending chunkSize the user picked but hasn't yet committed
   *  (because there's a "dirty" recording — see `onChunkSizeChange`). */
  const [pendingChunkSize, setPendingChunkSize] = useState<number | null>(null);

  // Keep the latest client in a ref so the error-handler effect can
  // tear it down on a stale event without re-subscribing every render.
  const clientRef = useRef<WorkerClient | null>(null);
  useEffect(() => {
    clientRef.current = resources?.client ?? null;
  }, [resources]);

  const handleConnect = useCallback(async (address: string) => {
    console.log('[sc:app] handleConnect', address);
    try {
      window.localStorage.setItem(STORAGE_KEY, address);
    } catch {
      /* ignore */
    }

    const url = wsUrlFor(address);
    console.log('[sc:app] ws url', url);
    const next = new WorkerClient(url);

    try {
      await next.ready;
    } catch (err) {
      console.error('[sc:app] ready failed:', err);
      next.dispose();
      throw err;
    }

    // Status probe — proves the full chain (worker → bridge → UDP →
    // scsynth → back) is actually responsive before mounting the
    // dashboard. Silent UDP "nothing listening" can only be detected
    // here, because UDP sends don't fail. We also use the reply to
    // capture scsynth's sample rate, which becomes the session-wide
    // `AudioEnvironment.sampleRate`.
    //
    // We use `nominalSampleRate` (args[7]) rather than
    // `actualSampleRate` (args[8]) — the latter is the
    // measured-against-audio-hardware rate, which drifts by 10s of
    // ppm (e.g. 48000.28 instead of 48000) due to the audio device's
    // actual crystal. That tiny drift propagates into a non-integer
    // sampleRate that breaks `WavMemoryWriter`'s WAV-header math
    // (the format's rate field is a uint32) and any other consumer
    // that assumes integer Hz. Nominal is what scsynth was *asked*
    // to run at, always an integer round number, and it's what
    // downstream tools (DAWs, ffmpeg, etc.) expect to see in WAV
    // headers anyway. Round defensively in case scsynth ever
    // returns it as 48000.0 — `Math.round` is a no-op on integers.
    console.log('[sc:app] running /status probe');
    let sampleRate: number;
    try {
      const reply = await next.sendAndAwaitReply(
        status(),
        (r) => r.address === '/status.reply',
        STATUS_PROBE_TIMEOUT_MS,
      );
      // args index per scsynth's /status.reply spec:
      // 0=unused, 1=numUgens, 2=numSynths, 3=numGroups, 4=numSynthDefs,
      // 5=avgCpu, 6=peakCpu, 7=nominalSampleRate, 8=actualSampleRate.
      const nominal = reply.args[7] as number;
      const actual = reply.args[8] as number;
      if (!Number.isFinite(nominal) || nominal <= 0) {
        next.dispose();
        throw new Error(
          `scsynth reported a non-positive nominal sample rate: ${nominal}`,
        );
      }
      sampleRate = Math.round(nominal);
      console.log(
        `[sc:app] /status probe OK (nominal=${nominal}, actual=${actual}, ` +
          `using sr=${sampleRate})`,
      );
    } catch (err) {
      console.error('[sc:app] /status probe failed', err);
      next.dispose();
      throw new Error(
        `scsynth didn't reply to /status at ${address}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // Subscribe to async notifications (/tr, /n_go, /n_end, /done, …)
    // and capture the assigned clientId from `/done /notify`. The
    // per-session parent group id is derived from it (see below).
    console.log('[sc:app] enabling /notify');
    let clientId: number;
    try {
      const reply = await next.sendAndAwaitReply(
        notify(1),
        (r) => r.address === '/done' && r.args[0] === '/notify',
        STATUS_PROBE_TIMEOUT_MS,
      );
      clientId = reply.args[1] as number;
      console.log(
        `[sc:app] /notify enabled, clientId=${clientId}, maxLogins=${reply.args[2]}`,
      );
    } catch (err) {
      console.error('[sc:app] /notify failed', err);
      next.dispose();
      throw new Error(
        `scsynth didn't accept /notify at ${address}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    // Per-session root group, derived from the notify-assigned clientId.
    // Reconnects usually get a different clientId (because /notify 0
    // on the prior session frees the slot, but the OS port is also
    // different), so collisions across sessions are avoided as long as
    // scsynth hasn't recycled the slot. `clientId = 0` is the
    // single-client default; we can't use root group 0, so fall back
    // to the old hardcoded 100.
    const parentGroupId =
      clientId > 0 ? clientId * 100 : FALLBACK_PARENT_GROUP_ID;
    if (clientId === 0) {
      console.warn(
        `[sc:app] scsynth returned clientId=0; using fallback group ${FALLBACK_PARENT_GROUP_ID}`,
      );
    }

    // Wire disconnection handler *before* the async bring-up so a
    // mid-bring-up WebSocket error still unwinds cleanly. Runtime
    // errors (post-connect WS death) surface as a modal alert
    // rather than an inline message on the connect screen — the
    // user has been doing real work and deserves an explicit
    // notification of why the dashboard just disappeared.
    next.onError((message) => {
      if (clientRef.current === next) {
        setRuntimeError(message);
        next.dispose();
        clientRef.current = null;
        setResources(null);
      }
    });

    let built: DashboardResources;
    try {
      built = await setupDashboard(
        next,
        parentGroupId,
        sampleRate,
        DEFAULT_PARAMS.chunkSize,
      );
    } catch (err) {
      console.error('[sc:app] dashboard bring-up failed', err);
      next.dispose();
      throw err;
    }

    setResources(built);
  }, []);

  const handleDisconnect = useCallback(async () => {
    const current = resources;
    if (current) {
      // Server-side state goes first (recordings → scopes → clock →
      // group). Then unregister /notify and tear down the worker.
      // Each step is best-effort.
      await teardownServerState(current);
      try {
        await current.client.sendAndSync(notify(0));
      } catch (err) {
        console.warn('[sc:app] /notify 0 on disconnect failed', err);
      }
      current.client.dispose();
      clientRef.current = null;
    }
    setResources(null);
  }, [resources]);

  /** Run a full in-place re-init with `next` as the new chunkSize.
   *  The WS, parentGroupId, and sampleRate stay the same; only
   *  server-side state (clock synth, group, scopes, recordings) is
   *  rebuilt. Loading modal stays up for the duration. */
  const runReinit = useCallback(
    async (next: number) => {
      const current = resources;
      if (!current) return;
      setReiniting(true);
      try {
        await teardownServerState(current);
        const rebuilt = await setupDashboard(
          current.client,
          current.parentGroupId,
          current.sampleRate,
          next,
        );
        setResources(rebuilt);
        setChunkSize(next);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[sc:app] reinit failed', msg);
        // A re-init failure is also a runtime error — the dashboard
        // is gone and the user needs to know why before being sent
        // back to the connect screen.
        setRuntimeError(`Reinitialization failed: ${msg}`);
        // Tear down completely — the previous resources are now stale.
        try {
          current.client.dispose();
        } catch {
          /* best effort */
        }
        clientRef.current = null;
        setResources(null);
      } finally {
        setReiniting(false);
        setPendingChunkSize(null);
      }
    },
    [resources],
  );

  /** Header `<select>` change handler. If any recording is active
   *  or has an un-downloaded `done` Blob, pause the clock and pop
   *  the confirmation modal — otherwise proceed straight to
   *  re-init. */
  const onChunkSizeChange = useCallback(
    (next: number) => {
      if (next === chunkSize) return;
      const current = resources;
      if (!current) {
        setChunkSize(next);
        return;
      }
      const list = current.recordingManager.recordings.get();
      const dirty = list.some((r) => {
        const s = r.state.get();
        if (s === 'recording' || s === 'preparing' || s === 'finalizing') {
          return true;
        }
        if (s === 'done' && r.result.get() !== null) return true;
        return false;
      });
      if (dirty) {
        // Pause the clock so the recording's elapsed counter stops
        // moving while the user decides. clock.stop() pauses the
        // entire parent group via /n_run 0.
        void current.clock.stop().catch((err) => {
          console.warn('[sc:app] clock.stop while confirming reinit failed', err);
        });
        setPendingChunkSize(next);
        return;
      }
      void runReinit(next);
    },
    [chunkSize, resources, runReinit],
  );

  const onConfirmReinit = useCallback(() => {
    if (pendingChunkSize !== null) void runReinit(pendingChunkSize);
  }, [pendingChunkSize, runReinit]);

  const onCancelReinit = useCallback(() => {
    // Resume the clock we paused when we showed the modal — the
    // recording continues, the dropdown effectively reverts to
    // `chunkSize` (we never set it to `pendingChunkSize`).
    void resources?.clock.resume().catch((err) => {
      console.warn('[sc:app] clock.resume on cancel failed', err);
    });
    setPendingChunkSize(null);
  }, [resources]);

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
    const { client, status: statusStore } = resources;
    const HEARTBEAT_INTERVAL_MS = 3000;
    const HEARTBEAT_TIMEOUT_MS = 2000;
    let cancelled = false;

    const tick = async () => {
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
        setRuntimeError(
          `scsynth stopped responding to /status (${msg}). The ` +
            `dashboard has been torn down.`,
        );
        client.dispose();
        clientRef.current = null;
        setResources(null);
      }
    };

    void tick();
    const intervalId = window.setInterval(() => {
      void tick();
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [resources]);

  // Best-effort shutdown when the tab / Tauri window closes. `pagehide`
  // fires synchronously on the main thread; the commands we emit here
  // queue into the worker's message channel and its WebSocket, which
  // typically flush before the process is reaped. If we get killed
  // before they land (hard close / SIGKILL), the leftover state sits
  // on scsynth until manual cleanup or next /g_new-with-same-id fails
  // — current tradeoff; acceptable because the normal disconnect path
  // above handles the happy case cleanly.
  useEffect(() => {
    if (!resources) return;
    const handler = () => {
      const { client, group } = resources;
      try {
        client.sendCommand(gFreeAll(group.groupId));
        client.sendCommand(nFree(group.groupId));
        client.sendCommand(notify(0));
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

  return (
    <>
      {resources ? (
        <Dashboard
          resources={resources}
          chunkSize={chunkSize}
          reiniting={reiniting}
          onChunkSizeChange={onChunkSizeChange}
          onDisconnect={handleDisconnect}
        />
      ) : (
        <ConnectScreen
          defaultAddress={defaultAddress}
          onConnect={handleConnect}
        />
      )}
      {reiniting && (
        <LoadingModal
          title="Reinitializing dashboard…"
          message={
            `Applying chunk size = ${pendingChunkSize ?? chunkSize}. ` +
            `Tearing down current scopes/recordings and rebuilding the ` +
            `clock.`
          }
        />
      )}
      {pendingChunkSize !== null && !reiniting && (
        <ConfirmModal
          title="Reinitialize dashboard?"
          body={
            <>
              <p>
                Active recordings will be stopped, and any recordings in
                this session — including ones already finalised — will
                be lost when the dashboard reinitializes.
              </p>
              <p>
                Cancel and download or dismiss them first if you want
                to keep their WAV files.
              </p>
            </>
          }
          confirmLabel="Reinitialize"
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={onConfirmReinit}
          onCancel={onCancelReinit}
        />
      )}
      {runtimeError !== null && (
        <AlertModal
          title="Connection lost"
          body={
            <>
              <p>
                The connection to scsynth was interrupted and the
                dashboard has been torn down.
              </p>
              <p style={{ opacity: 0.8 }}>{runtimeError}</p>
              <p>Press OK to return to the connect screen.</p>
            </>
          }
          dismissLabel="OK"
          variant="danger"
          onDismiss={() => setRuntimeError(null)}
        />
      )}
      <DebugLog />
    </>
  );
}
