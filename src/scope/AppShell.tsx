import { useCallback, useEffect, useRef, useState } from 'react';
import { ConnectScreen } from '@/ui/ConnectScreen';
import { OscConsole } from '@/ui/OscConsole';
import { WorkerClient } from './WorkerClient';

const STORAGE_KEY = 'sc.address';

/**
 * Phase 1 dashboard shell — placeholder until Phase 4 brings the real
 * ClockPanel / ScopeList / RecordingPanel. Today it just exposes the
 * OSC console so the acceptance tests can manually exercise the bridge.
 */
function Dashboard({ client, onDisconnect }: { client: WorkerClient; onDisconnect: () => void }) {
  return (
    <main className="dashboard-shell">
      <header>
        <span className="badge">connected</span>
        <button type="button" onClick={onDisconnect}>
          Disconnect
        </button>
      </header>
      <OscConsole client={client} />
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

export function AppShell() {
  const [defaultAddress] = useState(readInitialAddress);
  const [client, setClient] = useState<WorkerClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Keep the latest client in a ref so the error-handler effect can
  // tear it down on a stale event without re-subscribing every render.
  const clientRef = useRef<WorkerClient | null>(null);
  useEffect(() => {
    clientRef.current = client;
  }, [client]);

  const handleConnect = useCallback(async (address: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, address);
    } catch {
      /* ignore */
    }

    const url = wsUrlFor(address);
    const next = new WorkerClient(url);

    try {
      await next.ready;
    } catch (err) {
      next.dispose();
      throw err;
    }

    // Wire disconnection handler: any error event after we're "open"
    // means the server went away — kick back to the connect screen.
    next.onError((message) => {
      if (clientRef.current === next) {
        setError(message);
        next.dispose();
        clientRef.current = null;
        setClient(null);
      }
    });

    setError(null);
    setClient(next);
  }, []);

  const handleDisconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.dispose();
      clientRef.current = null;
    }
    setClient(null);
  }, []);

  // Expose the client in dev mode for console poking.
  useEffect(() => {
    if (!client) return;
    (window as unknown as { __scClient?: WorkerClient }).__scClient = client;
    return () => {
      delete (window as unknown as { __scClient?: WorkerClient }).__scClient;
    };
  }, [client]);

  if (!client) {
    return (
      <ConnectScreen
        defaultAddress={defaultAddress}
        onConnect={handleConnect}
        error={error}
      />
    );
  }

  return <Dashboard client={client} onDisconnect={handleDisconnect} />;
}
