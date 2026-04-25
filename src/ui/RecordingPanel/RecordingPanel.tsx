import {
  useCallback,
  useState,
  useSyncExternalStore,
} from 'react';
import { downloadBlob } from '@/recording/download';
import type {
  RecordingController,
  RecordingState,
} from '@/recording/RecordingController';
import type { RecordingManager } from '@/recording/RecordingManager';
import './RecordingPanel.scss';

type Channels = 1 | 2;

interface RecordingPanelProps {
  manager: RecordingManager;
  /** sampleRate captured from the clock at mount — used purely for
   *  the elapsed-time and memory-estimate readouts. */
  sampleRate: number;
}

const DEFAULT_INPUT_BUS = 16;

export function RecordingPanel({ manager, sampleRate }: RecordingPanelProps) {
  const recordings = useSyncExternalStore(
    (cb) => manager.recordings.subscribe(cb),
    () => manager.recordings.get(),
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
      console.error('[sc:rec-panel] add failed', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [manager, inputBus, channels, label]);

  const onStopAll = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await manager.stopAll();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[sc:rec-panel] stopAll failed', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [manager]);

  const anyActive = recordings.some(
    (r) => r.state.get() === 'recording' || r.state.get() === 'preparing',
  );

  return (
    <section className="recording-panel">
      <header>Recordings</header>
      <div className="row toolbar">
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
          New recording
        </button>
        <button
          type="button"
          className="danger"
          onClick={onStopAll}
          disabled={busy || !anyActive}
        >
          Stop all
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {recordings.length === 0 ? (
        <p className="empty">no recordings — add one above</p>
      ) : (
        <ul className="recordings">
          {recordings.map((rec) => (
            <RecordingItem
              key={rec.recordingId}
              rec={rec}
              sampleRate={sampleRate}
              onRemove={() => manager.remove(rec.recordingId)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RecordingItem({
  rec,
  sampleRate,
  onRemove,
}: {
  rec: RecordingController;
  sampleRate: number;
  onRemove: () => void;
}) {
  const state = useSyncExternalStore(
    (cb) => rec.state.subscribe(cb),
    () => rec.state.get(),
  );
  const framesWritten = useSyncExternalStore(
    (cb) => rec.framesWritten.subscribe(cb),
    () => rec.framesWritten.get(),
  );
  const gaps = useSyncExternalStore(
    (cb) => rec.gaps.subscribe(cb),
    () => rec.gaps.get(),
  );
  const result = useSyncExternalStore(
    (cb) => rec.result.subscribe(cb),
    () => rec.result.get(),
  );
  const error = useSyncExternalStore(
    (cb) => rec.error.subscribe(cb),
    () => rec.error.get(),
  );

  const [busy, setBusy] = useState(false);

  const onStop = useCallback(async () => {
    setBusy(true);
    try {
      await rec.stop();
    } catch (err) {
      console.error(`[sc:rec-panel] stop ${rec.recordingId} failed`, err);
    } finally {
      setBusy(false);
    }
  }, [rec]);

  const onDownloadWav = useCallback(async () => {
    if (!result) return;
    try {
      await downloadBlob(result.wavBlob, {
        filename: `${result.suggestedFilename}.wav`,
        defaultLocation: 'audio',
        filters: [{ name: 'WAV', extensions: ['wav'] }],
      });
    } catch (err) {
      console.error(`[sc:rec-panel] download wav failed`, err);
    }
  }, [result]);

  const onDownloadGaps = useCallback(async () => {
    if (!result || !result.gapsBlob) return;
    try {
      await downloadBlob(result.gapsBlob, {
        filename: `${result.suggestedFilename}.gaps.json`,
        defaultLocation: 'document',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
    } catch (err) {
      console.error(`[sc:rec-panel] download gaps failed`, err);
    }
  }, [result]);

  const elapsedSec = framesWritten / sampleRate;
  const memoryMb = (framesWritten * rec.channels * 4) / (1024 * 1024);
  const busDesc =
    rec.channels === 1
      ? `bus ${rec.inputBus}`
      : `bus ${rec.inputBus}..${rec.inputBus + rec.channels - 1}`;

  return (
    <li className={`recording-item state-${state}`}>
      <div className="recording-item-header">
        <span className="label">{rec.label}</span>
        <StatePill state={state} />
        <span className="meta">
          {rec.channels}ch · {busDesc} · {formatElapsed(elapsedSec)} ·{' '}
          {framesWritten.toLocaleString()} frames · {memoryMb.toFixed(1)} MB
          {gaps.length > 0 && (
            <>
              {' · '}
              <span className="gaps" title={gapsTooltip(gaps)}>
                {gaps.length} gap{gaps.length === 1 ? '' : 's'}
              </span>
            </>
          )}
        </span>
        <div className="actions">
          {(state === 'recording' || state === 'preparing') && (
            <button
              type="button"
              className="danger small"
              onClick={() => void onStop()}
              disabled={busy || state === 'preparing'}
            >
              Stop
            </button>
          )}
          {state === 'done' && result && (
            <>
              <button
                type="button"
                className="small"
                onClick={() => void onDownloadWav()}
                title={`Download ${result.suggestedFilename}.wav`}
              >
                Download WAV
              </button>
              {result.gapsBlob && (
                <button
                  type="button"
                  className="secondary small"
                  onClick={() => void onDownloadGaps()}
                  title="Download the gaps sidecar JSON"
                >
                  Download gaps.json
                </button>
              )}
              <button
                type="button"
                className="secondary small"
                onClick={onRemove}
                title="Discard this recording from the list (frees the WAV blob)"
              >
                Dismiss
              </button>
            </>
          )}
          {state === 'error' && (
            <button
              type="button"
              className="secondary small"
              onClick={onRemove}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
    </li>
  );
}

function StatePill({ state }: { state: RecordingState }) {
  const className = `state-pill ${state}`;
  const label =
    state === 'idle'
      ? 'Idle'
      : state === 'preparing'
        ? '… Preparing'
        : state === 'recording'
          ? '● Recording'
          : state === 'finalizing'
            ? '… Finalizing'
            : state === 'done'
              ? '✓ Done'
              : '⚠ Error';
  return <span className={className}>{label}</span>;
}

function formatElapsed(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mm = Math.floor(safe / 60)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor(safe % 60)
    .toString()
    .padStart(2, '0');
  const mmm = Math.floor((safe * 1000) % 1000)
    .toString()
    .padStart(3, '0');
  return `${mm}:${ss}.${mmm}`;
}

function gapsTooltip(
  gaps: ReadonlyArray<{ tickIndex: number; framesMissing: number }>,
): string {
  const head = gaps
    .slice(0, 6)
    .map((g) => `tick ${g.tickIndex} (-${g.framesMissing})`);
  const more = gaps.length > 6 ? `\n… and ${gaps.length - 6} more` : '';
  return head.join('\n') + more;
}
