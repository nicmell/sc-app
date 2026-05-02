import {
  useCallback,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ScopeController } from '@/scope/ScopeController';
import type { ScopeManager } from '@/scope/ScopeManager';
import { ScopeView } from '@/ui/ScopeView';
import './ScopeList.css';

type Channels = number;

interface ScopeListProps {
  manager: ScopeManager;
}

const DEFAULT_INPUT_BUS = 16;

export function ScopeList({ manager }: ScopeListProps) {
  const scopes = useSyncExternalStore(
    (cb) => manager.scopes.subscribe(cb),
    () => manager.scopes.get(),
  );

  const [inputBus, setInputBus] = useState(DEFAULT_INPUT_BUS);
  const [channels, setChannels] = useState<Channels>(1);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAdd = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await manager.add({
        inputBus,
        channels,
        label: label.trim() || undefined,
      });
      setLabel('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[sc:scope-list] add failed', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [manager, inputBus, channels, label]);

  const onClear = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await manager.clear();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[sc:scope-list] clear failed', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [manager]);

  return (
    <section className="panel scope-list">
      <header>Scopes</header>
      <div className="cluster">
        <label>
          bus&nbsp;
          <input
            type="number"
            min={0}
            step={1}
            value={inputBus}
            disabled={busy}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isInteger(v) && v >= 0) setInputBus(v);
            }}
          />
        </label>
        <label>
          channels&nbsp;
          <select
            value={channels}
            disabled={busy}
            onChange={(e) => setChannels(Number(e.target.value) as Channels)}
          >
            <option value={1}>1 (mono)</option>
            <option value={2}>2 (stereo)</option>
          </select>
        </label>
        <label>
          label&nbsp;
          <input
            type="text"
            value={label}
            placeholder="optional"
            disabled={busy}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <button type="button" onClick={onAdd} disabled={busy}>
          Add
        </button>
        <button
          type="button"
          data-variant="danger"
          onClick={onClear}
          disabled={busy || scopes.length === 0}
        >
          Clear all
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {scopes.length === 0 ? (
        <p className="empty">no scopes — add one above</p>
      ) : (
        <ul className="scopes">
          {scopes.map((scope) => (
            <ScopeListItem
              key={scope.scopeId}
              scope={scope}
              onRemove={() => manager.remove(scope.scopeId)}
            />
          ))}
        </ul>
      )}
      <Footer scopes={scopes} />
    </section>
  );
}

function ScopeListItem({
  scope,
  onRemove,
}: {
  scope: ScopeController;
  onRemove: () => void | Promise<void>;
}) {
  const chunksPerSec = useSyncExternalStore(
    (cb) => scope.chunksPerSec.subscribe(cb),
    () => scope.chunksPerSec.get(),
  );

  const busDesc =
    scope.channels === 1
      ? `bus ${scope.inputBus}`
      : `bus ${scope.inputBus}..${scope.inputBus + scope.channels - 1}`;

  return (
    <li className="scope-item">
      <div className="scope-item-header">
        <span className="label">{scope.label}</span>
        <span className="meta">
          {scope.channels}ch · {busDesc} · {chunksPerSec}/s
        </span>
        <button type="button" data-variant="danger" data-size="sm" onClick={() => void onRemove()}>
          Remove
        </button>
      </div>
      <ScopeView
        chunkRef={scope.chunkRef}
        effectiveRate={scope.effectiveRate}
        samplesPerChunk={scope.samplesPerChunk}
      />
    </li>
  );
}

function Footer({ scopes }: { scopes: ScopeController[] }) {
  return (
    <div className="footer status">
      <span>{scopes.length} scope{scopes.length === 1 ? '' : 's'}</span>
      <span>·</span>
      <ChunksPerSecTotal scopes={scopes} />
    </div>
  );
}

function ChunksPerSecTotal({ scopes }: { scopes: ScopeController[] }) {
  // Subscribe to every scope's chunksPerSec so the aggregate updates
  // at the rate of any individual scope. Building the deps array
  // outside the hook keeps us within React's rules-of-hooks.
  const subscribe = useCallback(
    (cb: () => void) => {
      const offs = scopes.map((s) => s.chunksPerSec.subscribe(cb));
      return () => {
        for (const off of offs) off();
      };
    },
    [scopes],
  );
  const getSnapshot = useCallback(
    () => scopes.reduce((acc, s) => acc + s.chunksPerSec.get(), 0),
    [scopes],
  );
  const total = useSyncExternalStore(subscribe, getSnapshot);
  return <span>{total} chunks/s total</span>;
}
