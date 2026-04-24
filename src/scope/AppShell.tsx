import { useCallback, useEffect, useRef, useState } from 'react';
import { ClockPanel } from '@/ui/ClockPanel';
import { ConnectScreen } from '@/ui/ConnectScreen';
import { DebugLog } from '@/ui/DebugLog';
import { OscConsole } from '@/ui/OscConsole';
import { SynthDefPanel } from '@/ui/SynthDefPanel';
import {
  compileSilentTestSynthDef,
  SILENT_TEST_TRIG_ID,
} from '@/synth/silentTestSynthDef';
import * as cmd from './cmd';
import { GroupController } from './GroupController';
import { IdAllocator } from './IdAllocator';
import { SynthDefRegistry } from './SynthDefRegistry';
import { WorkerClient } from './WorkerClient';

const STORAGE_KEY = 'sc.address';
const STATUS_PROBE_TIMEOUT_MS = 1000;
const PARENT_GROUP_ID = 100;

interface DashboardResources {
  client: WorkerClient;
  registry: SynthDefRegistry;
  group: GroupController;
  ids: { node: IdAllocator; buffer: IdAllocator; bus: IdAllocator };
}

/**
 * Phase 4 dashboard — adds the parent group, a shared SynthDefRegistry,
 * ID allocators, and the dev heartbeat synth alongside the earlier
 * OSC console / SynthDef loader.
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
      <ClockPanel client={resources.client} group={resources.group} />
      <SynthDefPanel registry={resources.registry} />
      <OscConsole client={resources.client} />
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

async function bringUpDashboard(client: WorkerClient): Promise<DashboardResources> {
  const ids = {
    node: new IdAllocator(1000),
    buffer: new IdAllocator(1000),
    bus: new IdAllocator(32),
  };
  const registry = new SynthDefRegistry(client);
  const group = new GroupController(client, PARENT_GROUP_ID);

  console.log('[sc:app] loading silentTest synthdef');
  await registry.ensureLoaded('silentTest', compileSilentTestSynthDef());

  console.log('[sc:app] creating parent group', PARENT_GROUP_ID);
  await group.ensureCreated();

  const heartbeatId = ids.node.next();
  console.log('[sc:app] starting silentTest synth', heartbeatId);
  await client.sendAndSync(
    cmd.sNewEasy('silentTest', heartbeatId, cmd.AddToHead, PARENT_GROUP_ID),
  );
  console.log(`[sc:app] dashboard ready (heartbeat trig=${SILENT_TEST_TRIG_ID})`);

  return { client, registry, group, ids };
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
    // here, because UDP sends don't fail.
    console.log('[sc:app] running /status probe');
    try {
      await next.sendAndAwaitReply(
        cmd.status,
        (reply) => reply.tag === 'status-reply',
        STATUS_PROBE_TIMEOUT_MS,
      );
      console.log('[sc:app] /status probe OK');
    } catch (err) {
      console.error('[sc:app] /status probe failed', err);
      next.dispose();
      throw new Error(
        `scsynth didn't reply to /status at ${address}: ${
          err instanceof Error ? err.message : String(err)
        }`,
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
      built = await bringUpDashboard(next);
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
      try {
        await current.group.free();
      } catch (err) {
        console.warn('[sc:app] group.free on disconnect failed', err);
      }
      current.client.dispose();
      clientRef.current = null;
    }
    setResources(null);
  }, [resources]);

  // Expose the client in dev mode for console poking.
  useEffect(() => {
    if (!resources) return;
    const w = window as unknown as {
      __scClient?: WorkerClient;
      __scGroup?: GroupController;
    };
    w.__scClient = resources.client;
    w.__scGroup = resources.group;
    return () => {
      delete w.__scClient;
      delete w.__scGroup;
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
