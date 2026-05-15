/**
 * Centralized metronome — single source of truth for app-wide BPM.
 *
 * Long-lived: constructed once per `handleConnect` in `AppShell`
 * (alongside `PatternBank`), passed into `setupDashboard`, and
 * disposed by `handleDisconnect` (which flushes a final save). The
 * value persists across reconnects via localStorage.
 *
 * Consumers (Sequencer pump, Strudel REPL) subscribe to `bpm` and
 * react to changes:
 * - `SequencerController` posts `sequencerMetronomeUpdate` to the
 *   worker pump, which re-derives `stepIntervalTicks` from the
 *   new BPM on its next pump iteration.
 * - `StrudelPanel` calls `mirror.repl.setCps(bpm/60/4)` on the
 *   StrudelMirror's inner Cyclist scheduler.
 *
 * Note this is a *musical* tempo abstraction, distinct from the
 * shared `\scAppClock` ticking at scsynth's chunk rate.
 */

import { createStore, type ReadonlyStore, type Store } from '@/util/reactiveStore';

const STORAGE_KEY = 'sc.metronome';

/** Inclusive bounds. Matches the BPM <input> min/max in the
 *  MetronomePanel. */
export const MIN_BPM = 60;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 120;

/** Debounce window for localStorage writes. Avoids hammering
 *  localStorage when the user is scrubbing the BPM input. */
const SAVE_DEBOUNCE_MS = 500;

export class MetronomeController {
  private readonly _bpm: Store<number>;
  readonly bpm: ReadonlyStore<number>;

  private disposed = false;
  private saveTimer: number | null = null;

  constructor() {
    const initial = loadFromStorage() ?? DEFAULT_BPM;
    this._bpm = createStore<number>(initial);
    this.bpm = this._bpm;
  }

  setBpm(value: number): void {
    if (this.disposed) return;
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(value)));
    if (clamped === this._bpm.get()) return;
    this._bpm.set(clamped);
    this.scheduleSave();
  }

  /** Flush any pending save and stop accepting writes. Called from
   *  `handleDisconnect`. The store itself is GC'd with the
   *  controller; reconnect mints a fresh instance. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
      saveToStorage(this._bpm.get());
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer !== null) return;
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      if (this.disposed) return;
      saveToStorage(this._bpm.get());
    }, SAVE_DEBOUNCE_MS);
  }
}

function loadFromStorage(): number | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return null;
    return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(parsed)));
  } catch {
    return null;
  }
}

function saveToStorage(bpm: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bpm));
  } catch {
    // QuotaExceededError or sandboxed mode — silently drop.
  }
}
