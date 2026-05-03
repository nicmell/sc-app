import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ClockController, ClockState } from '@/clock/ClockController';
import type { GroupController } from '@/server/GroupController';
import './ClockPanel.css';

const PULSE_FLASH_MS = 90;

interface ClockPanelProps {
  clock: ClockController;
  /** Phase 30: the shared clock can't be paused (it lives in sclang
   *  outside this client's parent group), so the panel's
   *  Pause/Resume buttons drive the parent group instead. Visually
   *  the user still sees "the clock" pause, because everything in
   *  their parent group (scopes, recordings, tap synths) freezes —
   *  only the trig stream from sclang continues. */
  group: GroupController;
}

/** Map clock state to a foundation .status-pill variant + label.
 *  Phase 28e/5: variants align with the foundation's pill palette
 *  — ok for running (ok-themed pill), warn for paused (amber),
 *  muted for stopped (surface-2 + dim text). */
function pillFor(state: ClockState): {
  variant: 'ok' | 'warn' | 'muted';
  label: string;
} {
  switch (state) {
    case 'running':
      return { variant: 'ok', label: '● Running' };
    case 'paused':
      return { variant: 'warn', label: '⏸ Paused' };
    case 'stopped':
      return { variant: 'muted', label: '○ Stopped' };
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

export function ClockPanel({ clock, group }: ClockPanelProps) {
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

  // Phase 30: pause/resume drive the parent group, not the shared
  // clock. Freezing the group via /n_run 0 stops this client's tap
  // synths, scopes, recordings, and sequencer — everything that
  // anchors on the user's session. The shared clock keeps emitting
  // /tr triggers from sclang; nothing in this client reads them
  // while paused (the sequencer is gated on group.state — see
  // SequencerController).
  const onToggle = useCallback(async () => {
    setBusy(true);
    try {
      if (state === 'running') {
        await group.pause();
      } else if (state === 'paused') {
        await group.resume();
        setUserStartedOnce(true);
      }
    } catch (err) {
      console.error('[sc:clock] toggle failed', err);
    } finally {
      setBusy(false);
    }
  }, [group, state]);

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
      <div className="cluster" data-gap="md">
        <span className="status-pill" data-variant={pill.variant}>
          {pill.label}
        </span>
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
        {/* Phase 30 dropped the Reset button — the shared clock
            lives in sclang and can't be reset by an individual
            client. To restart from tick 0 you'd restart sclang. */}
      </div>
    </section>
  );
}
