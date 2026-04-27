import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ClockController } from '@/scope/ClockController';
import type {
  ScopeController,
  ScopeSourceSpec,
} from '@/scope/ScopeController';
import type { ScopeManager } from '@/scope/ScopeManager';
import { ScopeView } from '@/ui/ScopeView';
import './ScopeList.scss';

type Channels = 1 | 2;

interface ScopeListProps {
  manager: ScopeManager;
  clock: ClockController;
}

const DEFAULT_FREQ_MONO = 440;
const DEFAULT_FREQ_STEREO_L = 440;
const DEFAULT_FREQ_STEREO_R = 660;
/** Chunk-size options offered to the user — each must divide the
 *  clock's `samplesPerTick` evenly. With the default 1024 samples/tick
 *  these five values give a clean halving series down to 64. Decimation
 *  is derived (`samplesPerTick / chunkSize`); higher decimation = more
 *  aggressive zero-order-hold downsampling, which can alias visibly
 *  above the per-scope `effectiveRate / 2` (see CLAUDE.md gotcha). */
const CHUNK_SIZE_OPTIONS = [1024, 512, 256, 128, 64] as const;
const DEFAULT_CHUNK_SIZE = 256;

export function ScopeList({ manager, clock }: ScopeListProps) {
  const scopes = useSyncExternalStore(
    (cb) => manager.scopes.subscribe(cb),
    () => manager.scopes.get(),
  );

  const [channels, setChannels] = useState<Channels>(1);
  const [freqMono, setFreqMono] = useState(DEFAULT_FREQ_MONO);
  const [freqL, setFreqL] = useState(DEFAULT_FREQ_STEREO_L);
  const [freqR, setFreqR] = useState(DEFAULT_FREQ_STEREO_R);
  const [label, setLabel] = useState('');
  const [chunkSize, setChunkSize] = useState<number>(DEFAULT_CHUNK_SIZE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const samplesPerTick = clock.derived.samplesPerTick;

  const onAdd = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const source: ScopeSourceSpec =
        channels === 1
          ? { kind: 'mono', freq: freqMono }
          : { kind: 'stereo', freqL, freqR };
      await manager.add({
        channels,
        label: label.trim() || undefined,
        source,
        detail: { chunkSize },
      });
      // Bump the default freq slightly so consecutive Adds make
      // distinguishable scopes without forcing the user to type.
      if (channels === 1) {
        setFreqMono((f) => f + 110);
      } else {
        setFreqL((f) => f + 55);
        setFreqR((f) => f + 55);
      }
      setLabel('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[sc:scope-list] add failed', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [manager, channels, freqMono, freqL, freqR, label, chunkSize]);

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
      <div className="row toolbar">
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
        <label
          title={
            `chunkSize must divide samplesPerTick (${samplesPerTick}). ` +
            `Smaller chunkSize = more aggressive decimation = less ` +
            `/b_setn traffic but lower visual fidelity.`
          }
        >
          chunk size&nbsp;
          <select
            value={chunkSize}
            disabled={busy}
            onChange={(e) => setChunkSize(Number(e.target.value))}
          >
            {CHUNK_SIZE_OPTIONS.map((cs) => (
              <option key={cs} value={cs}>
                {cs} samples (
                {((clock.env.sampleRate * cs) / samplesPerTick / 1000).toFixed(1)} kHz)
              </option>
            ))}
          </select>
        </label>
        {channels === 1 ? (
          <label>
            freq&nbsp;
            <input
              type="number"
              min={20}
              max={20000}
              step={10}
              value={freqMono}
              disabled={busy}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) setFreqMono(v);
              }}
            />
            &nbsp;Hz
          </label>
        ) : (
          <>
            <label>
              freqL&nbsp;
              <input
                type="number"
                min={20}
                max={20000}
                step={10}
                value={freqL}
                disabled={busy}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) setFreqL(v);
                }}
              />
              &nbsp;Hz
            </label>
            <label>
              freqR&nbsp;
              <input
                type="number"
                min={20}
                max={20000}
                step={10}
                value={freqR}
                disabled={busy}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) setFreqR(v);
                }}
              />
              &nbsp;Hz
            </label>
          </>
        )}
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
          className="danger"
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

  const sourceDesc = useMemo(() => {
    if (!scope.source) return 'no source';
    if (scope.source.kind === 'mono') {
      return `tone ${scope.source.freq} Hz`;
    }
    return `tones ${scope.source.freqL}L / ${scope.source.freqR}R Hz`;
  }, [scope.source]);

  const busDesc =
    scope.channels === 1
      ? `bus ${scope.inputBus}`
      : `bus ${scope.inputBus}..${scope.inputBus + scope.channels - 1}`;

  return (
    <li className="scope-item">
      <div className="scope-item-header">
        <span className="label">{scope.label}</span>
        <span className="meta">
          {scope.channels}ch · {busDesc} · {sourceDesc} ·{' '}
          {scope.detail.chunkSize} samples (
          {(scope.effectiveRate / 1000).toFixed(1)} kHz) · {chunksPerSec}/s
        </span>
        <button type="button" className="danger small" onClick={() => void onRemove()}>
          Remove
        </button>
      </div>
      <ScopeView
        chunkRef={scope.chunkRef}
        effectiveRate={scope.effectiveRate}
        samplesPerChunk={scope.detail.chunkSize}
      />
    </li>
  );
}

function Footer({ scopes }: { scopes: ScopeController[] }) {
  // Subscribe to every scope's chunksPerSec so the aggregate updates
  // at the rate of any individual scope. Building the deps array
  // outside the hook keeps us within React's rules-of-hooks.
  return (
    <div className="footer status">
      <span>{scopes.length} scope{scopes.length === 1 ? '' : 's'}</span>
      <span>·</span>
      <ChunksPerSecTotal scopes={scopes} />
    </div>
  );
}

function ChunksPerSecTotal({ scopes }: { scopes: ScopeController[] }) {
  // Cheap re-render driver: sum each scope's chunksPerSec via
  // useSyncExternalStore subscribed to all of them through a
  // synthesized snapshot. Recompute snapshot when the list changes.
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
