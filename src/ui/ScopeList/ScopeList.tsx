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
/** Decimation factors offered to the user. Each must divide the
 *  clock's `samplesPerTick` evenly — `chunkSize = samplesPerTick /
 *  decimation` is computed in the `onAdd` handler. With the default
 *  1024 samples/tick all five values divide cleanly. Higher
 *  decimation = lower effective sample rate = less data per /b_setn,
 *  but zero-order-hold means high-frequency content will alias
 *  visibly above ~`effectiveRate / 2`. */
const DECIMATION_OPTIONS = [1, 2, 4, 8, 16] as const;
const DEFAULT_DECIMATION = 4;

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
  const [decimation, setDecimation] = useState<number>(DEFAULT_DECIMATION);
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
      const chunkSize = samplesPerTick / decimation;
      await manager.add({
        channels,
        label: label.trim() || undefined,
        source,
        detail: { chunkSize, decimation },
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
  }, [
    manager,
    channels,
    freqMono,
    freqL,
    freqR,
    label,
    decimation,
    samplesPerTick,
  ]);

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
            `chunkSize × decimation must equal samplesPerTick (${samplesPerTick}). ` +
            `Higher decimation trades visual detail for less /b_setn traffic.`
          }
        >
          decimation&nbsp;
          <select
            value={decimation}
            disabled={busy}
            onChange={(e) => setDecimation(Number(e.target.value))}
          >
            {DECIMATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}× ({samplesPerTick / d} samples,{' '}
                {(clock.env.sampleRate / d / 1000).toFixed(1)} kHz)
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
          {scope.detail.decimation}× ({(scope.effectiveRate / 1000).toFixed(1)} kHz) · {chunksPerSec}/s
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
