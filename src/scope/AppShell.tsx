import { useCallback, useEffect, useRef, useState } from 'react';
import { ClockPanel } from '@/ui/ClockPanel';
import { ConnectScreen } from '@/ui/ConnectScreen';
import { DebugLog } from '@/ui/DebugLog';
import { RecordingPanel } from '@/ui/RecordingPanel';
import { ScopeList } from '@/ui/ScopeList';
import { DEFAULT_PARAMS } from '@/config/clockConfig';
import { RecordingManager } from '@/recording/RecordingManager';
import {
  gFreeAll,
  nFree,
  notify,
  status,
} from '@sc-app/server-commands';
import { ClockController } from './ClockController';
import { GroupController } from './GroupController';
import { IdAllocator } from './IdAllocator';
import { ScopeManager } from './ScopeManager';
import { SynthDefRegistry } from './SynthDefRegistry';
import { WorkerClient } from './WorkerClient';

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
}

/**
 * Phase 5 dashboard — the dev heartbeat is gone, replaced by the real
 * `globalClock` synth managed by `ClockController`. ClockPanel now
 * renders tickIndex / elapsed / pulse dot driven by the suppressed
 * `/tr` stream.
 */
function Dashboard({
  resources,
  onDisconnect,
}: {
  resources: DashboardResources;
  onDisconnect: () => void;
}) {
  return (
    <main className="dashboard-shell">
      <header>
        <span className="badge">connected</span>
        <button type="button" onClick={onDisconnect}>
          Disconnect
        </button>
      </header>
      <ClockPanel clock={resources.clock} />
      <ScopeList manager={resources.scopeManager} />
      <RecordingPanel
        manager={resources.recordingManager}
        clock={resources.clock}
        sampleRate={resources.clock.env.sampleRate}
      />
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
  await clock.start();
  const scopeManager = new ScopeManager({
    client,
    clock,
    group,
    registry,
    ids,
  });
  const recordingManager = new RecordingManager({
    client,
    clock,
    group,
    registry,
    ids: { node: ids.node, buffer: ids.buffer },
  });
  console.log('[sc:app] dashboard ready');

  return {
    client,
    registry,
    group,
    clock,
    ids,
    scopeManager,
    recordingManager,
    parentGroupId,
    sampleRate,
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
  const [error, setError] = useState<string | null>(null);

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
    // capture scsynth's actual sample rate, which becomes the
    // session-wide `AudioEnvironment.sampleRate`.
    console.log('[sc:app] running /status probe');
    let actualSampleRate: number;
    try {
      const reply = await next.sendAndAwaitReply(
        status(),
        (r) => r.address === '/status.reply',
        STATUS_PROBE_TIMEOUT_MS,
      );
      // args index per scsynth's /status.reply spec:
      // 0=unused, 1=numUgens, 2=numSynths, 3=numGroups, 4=numSynthDefs,
      // 5=avgCpu, 6=peakCpu, 7=nominalSampleRate, 8=actualSampleRate.
      actualSampleRate = reply.args[8] as number;
      if (!Number.isFinite(actualSampleRate) || actualSampleRate <= 0) {
        next.dispose();
        throw new Error(
          `scsynth reported a non-positive sample rate: ${actualSampleRate}`,
        );
      }
      console.log(`[sc:app] /status probe OK (sr=${actualSampleRate})`);
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
    // mid-bring-up WebSocket error still unwinds cleanly.
    next.onError((message) => {
      if (clientRef.current === next) {
        setError(message);
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
        actualSampleRate,
        DEFAULT_PARAMS.chunkSize,
      );
    } catch (err) {
      console.error('[sc:app] dashboard bring-up failed', err);
      next.dispose();
      throw err;
    }

    setError(null);
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
        <Dashboard resources={resources} onDisconnect={handleDisconnect} />
      ) : (
        <ConnectScreen
          defaultAddress={defaultAddress}
          onConnect={handleConnect}
          error={error}
        />
      )}
      <DebugLog />
    </>
  );
}
