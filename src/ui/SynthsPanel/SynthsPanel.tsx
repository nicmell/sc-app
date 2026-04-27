import {
  useCallback,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  WAVEFORMS,
  type SynthController,
  type SynthKind,
  type Waveform,
} from '@/synth/SynthController';
import type { SynthManager } from '@/synth/SynthManager';
import './SynthsPanel.scss';

interface SynthsPanelProps {
  manager: SynthManager;
}

const DEFAULT_FREQ_MONO = 440;
const DEFAULT_FREQ_STEREO_L = 440;
const DEFAULT_FREQ_STEREO_R = 660;
const DEFAULT_AMP = 0.2;
const DEFAULT_WAVEFORM: Waveform = 'sine';

const FREQ_MIN = 20;
const FREQ_MAX = 20000;
const FREQ_STEP = 1;
const AMP_MIN = 0;
const AMP_MAX = 1;
const AMP_STEP = 0.01;

function formatHz(hz: number): string {
  return `${Math.round(hz)} Hz`;
}

function formatAmp(amp: number): string {
  return amp.toFixed(2);
}

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
  const [waveform, setWaveform] = useState<Waveform>(DEFAULT_WAVEFORM);
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
        waveform,
      });
      // Bump default freqs slightly so consecutive Adds make
      // distinguishable synths without forcing the user to type.
      if (kind === 'mono') {
        setFreqMono((f) => Math.min(FREQ_MAX, f + 110));
      } else {
        setFreqL((f) => Math.min(FREQ_MAX, f + 55));
        setFreqR((f) => Math.min(FREQ_MAX, f + 55));
      }
      setLabel('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[sc:synths-panel] add failed', msg);
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [manager, kind, freqMono, freqL, freqR, amp, waveform, label]);

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
        <label>
          waveform&nbsp;
          <select
            value={waveform}
            disabled={busy}
            onChange={(e) => setWaveform(e.target.value as Waveform)}
          >
            {WAVEFORMS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        {kind === 'mono' ? (
          <label className="range-field">
            <span>freq</span>
            <input
              type="range"
              min={FREQ_MIN}
              max={FREQ_MAX}
              step={FREQ_STEP}
              value={freqMono}
              disabled={busy}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) setFreqMono(v);
              }}
            />
            <span className="range-value">{formatHz(freqMono)}</span>
          </label>
        ) : (
          <>
            <label className="range-field">
              <span>freqL</span>
              <input
                type="range"
                min={FREQ_MIN}
                max={FREQ_MAX}
                step={FREQ_STEP}
                value={freqL}
                disabled={busy}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) setFreqL(v);
                }}
              />
              <span className="range-value">{formatHz(freqL)}</span>
            </label>
            <label className="range-field">
              <span>freqR</span>
              <input
                type="range"
                min={FREQ_MIN}
                max={FREQ_MAX}
                step={FREQ_STEP}
                value={freqR}
                disabled={busy}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v > 0) setFreqR(v);
                }}
              />
              <span className="range-value">{formatHz(freqR)}</span>
            </label>
          </>
        )}
        <label className="range-field">
          <span>amp</span>
          <input
            type="range"
            min={AMP_MIN}
            max={AMP_MAX}
            step={AMP_STEP}
            value={amp}
            disabled={busy}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= 0) setAmp(v);
            }}
          />
          <span className="range-value">{formatAmp(amp)}</span>
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
  const waveform = useSyncExternalStore(
    (cb) => synth.waveform.subscribe(cb),
    () => synth.waveform.get(),
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
        <label>
          waveform&nbsp;
          <select
            value={waveform}
            onChange={(e) =>
              synth.setWaveform(e.target.value as Waveform)
            }
          >
            {WAVEFORMS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        {freqs.map((hz, idx) => (
          <label key={idx} className="range-field">
            <span>
              {synth.kind === 'mono'
                ? 'freq'
                : idx === 0
                  ? 'freqL'
                  : 'freqR'}
            </span>
            <input
              type="range"
              min={FREQ_MIN}
              max={FREQ_MAX}
              step={FREQ_STEP}
              value={hz}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v > 0) {
                  synth.setFreq(idx as 0 | 1, v);
                }
              }}
            />
            <span className="range-value">{formatHz(hz)}</span>
          </label>
        ))}
        <label className="range-field">
          <span>amp</span>
          <input
            type="range"
            min={AMP_MIN}
            max={AMP_MAX}
            step={AMP_STEP}
            value={amp}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= 0) synth.setAmp(v);
            }}
          />
          <span className="range-value">{formatAmp(amp)}</span>
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
