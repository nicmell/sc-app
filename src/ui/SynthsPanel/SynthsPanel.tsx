import {
  useCallback,
  useState,
  useSyncExternalStore,
} from 'react';
import type { SynthController, SynthKind } from '@/scope/SynthController';
import type { SynthManager } from '@/scope/SynthManager';
import './SynthsPanel.scss';

interface SynthsPanelProps {
  manager: SynthManager;
}

const DEFAULT_FREQ_MONO = 440;
const DEFAULT_FREQ_STEREO_L = 440;
const DEFAULT_FREQ_STEREO_R = 660;
const DEFAULT_AMP = 0.2;

export function SynthsPanel({ manager }: SynthsPanelProps) {
  const synths = useSyncExternalStore(
    (cb) => manager.synths.subscribe(cb),
    () => manager.synths.get(),
  );

  const [kind, setKind] = useState<SynthKind>('mono');
  const [freqMono, setFreqMono] = useState(DEFAULT_FREQ_MONO);
  const [freqL, setFreqL] = useState(DEFAULT_FREQ_STEREO_L);
  const [freqR, setFreqR] = useState(DEFAULT_FREQ_STEREO_R);
  const [amp, setAmp] = useState(DEFAULT_AMP);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onAdd = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const freqs = kind === 'mono' ? [freqMono] : [freqL, freqR];
      await manager.add({
        kind,
        label: label.trim() || undefined,
        freqs,
        amp,
      });
      // Bump default freqs slightly so consecutive Adds make
      // distinguishable synths without forcing the user to type.
      if (kind === 'mono') {
        setFreqMono((f) => f + 110);
      } else {
        setFreqL((f) => f + 55);
        setFreqR((f) => f + 55);
      }
      setLabel('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[sc:synths-panel] add failed', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [manager, kind, freqMono, freqL, freqR, amp, label]);

  const onClear = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await manager.clear();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[sc:synths-panel] clear failed', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [manager]);

  return (
    <section className="panel synths-panel">
      <header>Synths</header>
      <div className="row toolbar">
        <label>
          kind&nbsp;
          <select
            value={kind}
            disabled={busy}
            onChange={(e) => setKind(e.target.value as SynthKind)}
          >
            <option value="mono">mono (1ch)</option>
            <option value="stereo">stereo (2ch)</option>
          </select>
        </label>
        {kind === 'mono' ? (
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
          amp&nbsp;
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={amp}
            disabled={busy}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= 0) setAmp(v);
            }}
          />
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
          className="danger"
          onClick={onClear}
          disabled={busy || synths.length === 0}
        >
          Clear all
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {synths.length === 0 ? (
        <p className="empty">no synths — add one above</p>
      ) : (
        <ul className="synths">
          {synths.map((synth) => (
            <SynthsPanelItem
              key={synth.synthId}
              synth={synth}
              onRemove={() => manager.remove(synth.synthId)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SynthsPanelItem({
  synth,
  onRemove,
}: {
  synth: SynthController;
  onRemove: () => void | Promise<void>;
}) {
  const nodeId = useSyncExternalStore(
    (cb) => synth.nodeId.subscribe(cb),
    () => synth.nodeId.get(),
  );
  const freqs = useSyncExternalStore(
    (cb) => synth.freqs.subscribe(cb),
    () => synth.freqs.get(),
  );
  const amp = useSyncExternalStore(
    (cb) => synth.amp.subscribe(cb),
    () => synth.amp.get(),
  );
  const gateOpen = useSyncExternalStore(
    (cb) => synth.gateOpen.subscribe(cb),
    () => synth.gateOpen.get(),
  );

  const busDesc =
    synth.channels === 1
      ? `bus ${synth.inputBus}`
      : `bus ${synth.inputBus}..${synth.inputBus + synth.channels - 1}`;
  const nodeIdLabel = nodeId === null ? 'stopped' : `nodeId ${nodeId}`;

  const onToggleGate = useCallback(() => {
    synth.setGate(!gateOpen);
  }, [synth, gateOpen]);

  return (
    <li className="synth-item">
      <div className="synth-item-header">
        <span className="label">{synth.label}</span>
        <span className="meta">
          {synth.kind} · {nodeIdLabel} · {busDesc}
        </span>
        <button
          type="button"
          className="danger small"
          onClick={() => void onRemove()}
        >
          Remove
        </button>
      </div>
      <div className="row controls">
        {freqs.map((hz, idx) => (
          <label key={idx}>
            {synth.kind === 'mono'
              ? 'freq'
              : idx === 0
                ? 'freqL'
                : 'freqR'}
            &nbsp;
            <input
              type="number"
              min={20}
              max={20000}
              step={10}
              value={hz}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) {
                  synth.setFreq(idx as 0 | 1, v);
                }
              }}
            />
            &nbsp;Hz
          </label>
        ))}
        <label>
          amp&nbsp;
          <input
            type="number"
            min={0}
            max={1}
            step={0.05}
            value={amp}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= 0) synth.setAmp(v);
            }}
          />
        </label>
        <button
          type="button"
          className={gateOpen ? 'danger small' : 'small'}
          onClick={onToggleGate}
          title={
            gateOpen
              ? 'Mute (sets gate=0)'
              : 'Unmute (sets gate=1)'
          }
        >
          {gateOpen ? 'Stop' : 'Start'}
        </button>
      </div>
    </li>
  );
}
