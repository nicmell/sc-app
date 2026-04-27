import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ClockController, ClockState } from '@/clock/ClockController';
import './ClockPanel.scss';

const PULSE_FLASH_MS = 90;

interface ClockPanelProps {
  clock: ClockController;
}

function pillFor(state: ClockState): { className: string; label: string } {
  switch (state) {
    case 'running':
      return { className: 'pill running', label: '● Running' };
    case 'paused':
      return { className: 'pill paused', label: '⏸ Paused' };
    case 'stopped':
      return { className: 'pill stopped', label: '○ Stopped' };
  }
}

function formatElapsed(tickIndex: number, tickRate: number): string {
  // `Impulse.kr(rate, phase=0)` fires at audio frame 0, so tick 1
  // corresponds to elapsed=0. Audio time at tick N is therefore
  // `(N - 1) / rate`, not `N / rate`. Clamp to 0 so a 0/null tick
  // doesn't display a negative time.
  const seconds = Math.max(0, tickIndex - 1) / tickRate;
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  const mmm = Math.floor((seconds * 1000) % 1000)
    .toString()
    .padStart(3, '0');
  return `${mm}:${ss}.${mmm}`;
}

export function ClockPanel({ clock }: ClockPanelProps) {
  const state = useSyncExternalStore(
    (cb) => clock.effectiveState.subscribe(cb),
    () => clock.effectiveState.get(),
  );
  const tick = useSyncExternalStore(
    (cb) => clock.lastTick.subscribe(cb),
    () => clock.lastTick.get(),
  );

  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState(false);
  /** Becomes true the first time the user resumes the clock from
   *  this panel's current mount. Gates the toggle label between
   *  "Start" (initial paused state, before the user has ever pressed)
   *  and "Resume" (paused after they manually paused). Resets on
   *  re-init since `ClockPanel` re-mounts when `clock` changes. */
  const [userStartedOnce, setUserStartedOnce] = useState(false);

  // Brief CSS flash on every tick. Keyed to the tick's `receivedAt`
  // so consecutive ticks retrigger even if `tickIndex` is the same
  // after a reset.
  useEffect(() => {
    if (!tick) return;
    setPulse(true);
    const timer = window.setTimeout(() => setPulse(false), PULSE_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [tick?.receivedAt, tick]);

  const onToggle = useCallback(async () => {
    setBusy(true);
    try {
      if (state === 'running') {
        await clock.stop();
      } else if (state === 'paused') {
        await clock.resume();
        setUserStartedOnce(true);
      }
    } catch (err) {
      console.error('[sc:clock] toggle failed', err);
    } finally {
      setBusy(false);
    }
  }, [clock, state]);

  const onReset = useCallback(async () => {
    setBusy(true);
    try {
      await clock.reset();
    } catch (err) {
      console.error('[sc:clock] reset failed', err);
    } finally {
      setBusy(false);
    }
  }, [clock]);

  const pill = pillFor(state);
  const tickIndex = tick?.tickIndex ?? 0;
  const elapsed = formatElapsed(tickIndex, clock.derived.tickRate);
  const toggleLabel =
    state === 'paused'
      ? userStartedOnce
        ? 'Resume'
        : 'Start'
      : 'Pause';

  return (
    <section className="panel clock-panel">
      <header>Clock</header>
      <div className="row">
        <span className={pill.className}>{pill.label}</span>
        <span className="elapsed">{elapsed}</span>
        <span className="tick">tick {tickIndex}</span>
        <span className={`dot ${pulse ? 'flash' : ''}`} aria-hidden="true" />
        <button
          type="button"
          onClick={onToggle}
          disabled={busy || state === 'stopped'}
        >
          {toggleLabel}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onReset}
          disabled={busy || state === 'stopped'}
        >
          Reset
        </button>
      </div>
    </section>
  );
}
