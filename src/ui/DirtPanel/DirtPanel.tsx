import { useCallback, useState, useSyncExternalStore } from 'react';
import type { DirtClient } from '@/dirt/DirtClient';
import { parseHostPort } from '@/dirt/parseHostPort';
import type { DirtStatus } from '@/dirt/types';
import './DirtPanel.scss';

const DEFAULT_INPUT = '127.0.0.1:57120';

const STATUS_LABELS: Record<DirtStatus, string> = {
  disconnected: 'disconnected',
  connecting: 'connecting…',
  alive: 'alive',
  unreachable: 'unreachable',
};

interface DirtPanelProps {
  client: DirtClient;
}

/**
 * Phase 25b — connection-management panel for the SuperDirt client.
 *
 * Status flows: disconnected → connecting → (alive | unreachable).
 * The text input + Connect button drive `client.connect(host, port)`;
 * Disconnect appears in place of Connect once `'alive'`. Bad parse
 * or hello-timeout surfaces as a red line below the input.
 *
 * No localStorage — input always pre-fills with `DEFAULT_INPUT` on
 * mount. The lifecycle of the DirtClient is owned by AppShell: it
 * survives chunkSize re-init but is disconnected on full scsynth
 * disconnect or runtime error. This panel just controls the WS.
 */
export function DirtPanel({ client }: DirtPanelProps) {
  const status = useSyncExternalStore(
    (cb) => client.status.subscribe(cb),
    () => client.status.get(),
  );

  const [input, setInput] = useState(DEFAULT_INPUT);
  const [error, setError] = useState<string | null>(null);

  const onInputChange = useCallback(
    (value: string) => {
      setInput(value);
      // Clear stale error on edit so the user gets a clean slate
      // for the next attempt.
      if (error !== null) setError(null);
    },
    [error],
  );

  const onConnect = useCallback(async () => {
    setError(null);
    let parsed;
    try {
      parsed = parseHostPort(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    try {
      await client.connect(parsed.host, parsed.port);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[sc:dirt-panel] connect failed', msg);
      setError(msg);
    }
  }, [client, input]);

  const onDisconnect = useCallback(async () => {
    setError(null);
    try {
      await client.disconnect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[sc:dirt-panel] disconnect failed', msg);
      setError(msg);
    }
  }, [client]);

  // 'connecting' and 'alive' lock the input — changing the target
  // mid-flight or while connected would be confusing. 'unreachable'
  // unlocks so the user can fix the address and retry.
  const inputLocked = status === 'connecting' || status === 'alive';

  return (
    <section className="panel dirt-panel">
      <header>Dirt</header>
      <div className="row toolbar">
        <label className="host-port-field">
          <span>SuperDirt</span>
          <input
            type="text"
            value={input}
            placeholder={DEFAULT_INPUT}
            disabled={inputLocked}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !inputLocked) {
                e.preventDefault();
                void onConnect();
              }
            }}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
          />
        </label>
        {status === 'alive' ? (
          <button
            type="button"
            className="danger"
            onClick={() => void onDisconnect()}
          >
            Disconnect
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void onConnect()}
            disabled={status === 'connecting'}
          >
            {status === 'connecting' ? 'Connecting…' : 'Connect'}
          </button>
        )}
        <span className={`status-pill status-${status}`}>
          <span className="dot" aria-hidden="true">
            ●
          </span>
          {STATUS_LABELS[status]}
        </span>
      </div>
      {error !== null && <p className="error">{error}</p>}
    </section>
  );
}
