/**
 * Pattern bank (Phase 27c). Holds a fixed array of 8 patterns plus
 * an `activeIndex` pointing at the slot the sequencer is currently
 * reading from. Each slot is a full `Pattern` (length, tracks, BPM,
 * subdivision); empty slots hold a freshly-constructed empty
 * pattern.
 *
 * The bank is the source of truth for sequencer state — the
 * `SequencerController` reads `bank.activePattern` and forwards
 * mutations back through `bank.updateActivePattern(...)`. This
 * makes slot switching (1..8 keys) a one-line operation: the
 * controller's pattern store fires automatically.
 *
 * Persistence (debounced 500 ms, schema-versioned):
 * - Storage key: `STORAGE_KEY` below.
 * - Schema is V1 today. Bumping the version is fine; older saves
 *   that don't match are silently dropped (returning a fresh
 *   empty bank) — the user might lose patterns across an upgrade,
 *   but this is a hobby tool and the alternative (writing
 *   migration code for shapes that haven't been designed yet) is
 *   premature.
 * - On any mutation, schedule a flush on the next tick of a
 *   500 ms debounce. A best-effort flush also runs on `dispose`,
 *   so a quick disconnect after a mutation doesn't drop the
 *   in-flight write.
 *
 * Mid-playback slot switching is intentional: the scheduler reads
 * `pattern` fresh on each pump, so switching slots cuts into the
 * new pattern's tracks at the next step. Pattern lengths can
 * differ; `nextStepIndex % pattern.length` keeps the playhead
 * in range.
 */

import { createStore, type ReadonlyStore, type Store } from '@/util/reactiveStore';

import {
  PATTERN_LENGTHS,
  makeEmptyChain,
  makeEmptyPattern,
  type ChainEntry,
  type ChainState,
  type Pattern,
  type PatternLength,
  type Step,
  type Track,
} from './types';

export const SLOT_COUNT = 8;
const STORAGE_KEY = 'sc.sequencer.bank';
const SAVE_DEBOUNCE_MS = 500;

/** V1 (pre-27d) — slots + activeIndex only. Still accepted on
 *  load; promoted to V2 by attaching a default empty chain. */
interface SerializedBankV1 {
  version: 1;
  activeIndex: number;
  slots: Pattern[];
}

/** V2 (27d) — adds `chain`. Saves are V2 going forward. */
interface SerializedBankV2 {
  version: 2;
  activeIndex: number;
  slots: Pattern[];
  chain: ChainState;
}

type SerializedBank = SerializedBankV1 | SerializedBankV2;

interface BankInitialState {
  slots: ReadonlyArray<Pattern>;
  activeIndex: number;
  chain: ChainState;
}

export interface PatternBankOptions {
  /** Override the initial state. If omitted, the bank loads from
   *  `localStorage` (key `sc.sequencer.bank`); if that's empty or
   *  malformed, a fresh bank with 8 empty 16-step patterns is
   *  used. */
  initial?: BankInitialState;
  /** Disable persistence. Used by tests; default off (= persist). */
  disablePersistence?: boolean;
}

export class PatternBank {
  private readonly _slots: Store<ReadonlyArray<Pattern>>;
  private readonly _activeIndex: Store<number>;
  private readonly _activePattern: Store<Pattern>;
  private readonly _chain: Store<ChainState>;
  private readonly persistEnabled: boolean;
  private saveTimer: number | null = null;
  private offSlots: () => void;
  private offIndex: () => void;
  private offChain: () => void;
  private disposed = false;

  constructor(opts: PatternBankOptions = {}) {
    const initial = opts.initial ?? loadFromStorage() ?? freshState();
    const slots = padSlots(initial.slots);
    this._slots = createStore<ReadonlyArray<Pattern>>(slots);
    this._activeIndex = createStore<number>(clampIndex(initial.activeIndex));
    this._activePattern = createStore<Pattern>(slots[this._activeIndex.get()]);
    this._chain = createStore<ChainState>(initial.chain);
    this.persistEnabled = !opts.disablePersistence;

    // Whenever slots OR activeIndex changes, recompute
    // activePattern + schedule a save. The createStore short-
    // circuits on `Object.is` equality, so a no-op `update` (the
    // updater returned the same Pattern reference) doesn't fire
    // either subscriber.
    this.offSlots = this._slots.subscribe((s) => {
      this._activePattern.set(s[this._activeIndex.get()]);
      this.scheduleSave();
    });
    this.offIndex = this._activeIndex.subscribe((i) => {
      this._activePattern.set(this._slots.get()[i]);
      this.scheduleSave();
    });
    this.offChain = this._chain.subscribe(() => this.scheduleSave());
  }

  readonly slots: ReadonlyStore<ReadonlyArray<Pattern>> = {
    get: () => this._slots.get(),
    subscribe: (cb) => this._slots.subscribe(cb),
  };
  readonly activeIndex: ReadonlyStore<number> = {
    get: () => this._activeIndex.get(),
    subscribe: (cb) => this._activeIndex.subscribe(cb),
  };
  readonly activePattern: ReadonlyStore<Pattern> = {
    get: () => this._activePattern.get(),
    subscribe: (cb) => this._activePattern.subscribe(cb),
  };
  readonly chain: ReadonlyStore<ChainState> = {
    get: () => this._chain.get(),
    subscribe: (cb) => this._chain.subscribe(cb),
  };

  /** Switch the active slot. Out-of-range / disposed → no-op.
   *  Same-index → no-op (no spurious save). */
  selectIndex(index: number): void {
    if (this.disposed) return;
    if (index < 0 || index >= SLOT_COUNT) return;
    this._activeIndex.set(index);
  }

  /** Mutate the currently-active pattern. Updater receives the
   *  current pattern and returns a (possibly new) one; if the
   *  reference is unchanged the slots store short-circuits and
   *  no save is scheduled. */
  updateActivePattern(updater: (prev: Pattern) => Pattern): void {
    if (this.disposed) return;
    const i = this._activeIndex.get();
    const slots = this._slots.get();
    const next = updater(slots[i]);
    if (Object.is(next, slots[i])) return;
    const nextSlots = slots.slice();
    nextSlots[i] = next;
    this._slots.set(nextSlots);
  }

  /** Reset a slot to an empty pattern. Idempotent on already-empty
   *  slots (compares by deep equality of the slot to a freshly-
   *  built empty pattern, which is overkill but cheap and avoids
   *  spurious activePattern fires when the user double-clicks
   *  reset). */
  clearSlot(index: number): void {
    if (this.disposed) return;
    if (index < 0 || index >= SLOT_COUNT) return;
    const empty = makeEmptyPattern();
    const slots = this._slots.get();
    if (slotIsEmpty(slots[index])) return;
    const nextSlots = slots.slice();
    nextSlots[index] = empty;
    this._slots.set(nextSlots);
  }

  // ── Chain mutations (Phase 27d) ────────────────────────────────────

  setChainEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this._chain.update((c) => (c.enabled === enabled ? c : { ...c, enabled }));
  }

  setChainLoop(loop: boolean): void {
    if (this.disposed) return;
    this._chain.update((c) => (c.loop === loop ? c : { ...c, loop }));
  }

  /** Append a chain entry. Defaults to (slotIndex=0, cycles=1).
   *  Returns the new entry's index for the UI to focus / scroll
   *  to if it wants. */
  appendChainEntry(slotIndex = 0, cycles = 1): number {
    if (this.disposed) return -1;
    const entry: ChainEntry = {
      slotIndex: clampIndex(slotIndex),
      cycles: clampCycles(cycles),
    };
    let newIndex = -1;
    this._chain.update((c) => {
      newIndex = c.steps.length;
      return { ...c, steps: [...c.steps, entry] };
    });
    return newIndex;
  }

  removeChainEntry(index: number): void {
    if (this.disposed) return;
    this._chain.update((c) => {
      if (index < 0 || index >= c.steps.length) return c;
      const steps = c.steps.slice();
      steps.splice(index, 1);
      return { ...c, steps };
    });
  }

  updateChainEntry(index: number, patch: Partial<ChainEntry>): void {
    if (this.disposed) return;
    this._chain.update((c) => {
      if (index < 0 || index >= c.steps.length) return c;
      const cur = c.steps[index];
      const next: ChainEntry = {
        slotIndex:
          patch.slotIndex !== undefined
            ? clampIndex(patch.slotIndex)
            : cur.slotIndex,
        cycles:
          patch.cycles !== undefined ? clampCycles(patch.cycles) : cur.cycles,
      };
      if (next.slotIndex === cur.slotIndex && next.cycles === cur.cycles) {
        return c;
      }
      const steps = c.steps.slice();
      steps[index] = next;
      return { ...c, steps };
    });
  }

  /** Force a synchronous save (used by `dispose`). */
  flush(): void {
    if (!this.persistEnabled) return;
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    saveToStorage(this.snapshot());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.flush();
    this.offSlots();
    this.offIndex();
    this.offChain();
  }

  // ── private ────────────────────────────────────────────────────────

  private snapshot(): SerializedBankV2 {
    return {
      version: 2,
      activeIndex: this._activeIndex.get(),
      slots: this._slots.get() as Pattern[],
      chain: this._chain.get(),
    };
  }

  private scheduleSave(): void {
    if (!this.persistEnabled || this.disposed) return;
    if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      saveToStorage(this.snapshot());
    }, SAVE_DEBOUNCE_MS);
  }
}

// ── persistence helpers ────────────────────────────────────────────────

function freshState(): BankInitialState {
  return {
    slots: Array.from({ length: SLOT_COUNT }, () => makeEmptyPattern()),
    activeIndex: 0,
    chain: makeEmptyChain(),
  };
}

function padSlots(slots: ReadonlyArray<Pattern>): Pattern[] {
  const out = slots.slice(0, SLOT_COUNT) as Pattern[];
  while (out.length < SLOT_COUNT) out.push(makeEmptyPattern());
  return out;
}

function clampIndex(i: number): number {
  if (!Number.isFinite(i)) return 0;
  if (i < 0) return 0;
  if (i >= SLOT_COUNT) return SLOT_COUNT - 1;
  return Math.floor(i);
}

function loadFromStorage(): BankInitialState | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage can throw in private modes / sandboxed contexts.
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isSerializedBank(parsed)) return null;
  // Sanitise each slot — the user might be loading data from a
  // hand-edited localStorage entry, an older client, or a build
  // with subtly different defaults. Each slot is normalised to
  // the current Pattern shape; anything that can't be coerced
  // falls back to an empty pattern.
  const slots = parsed.slots.map(sanitisePattern);
  // Forward-migrate V1 → V2 by attaching a default empty chain.
  // Don't reject V1 saves — Phase 27c users have valid bank
  // data we want to keep across the upgrade.
  const chain =
    parsed.version === 2
      ? sanitiseChain(parsed.chain)
      : makeEmptyChain();
  return { slots, activeIndex: clampIndex(parsed.activeIndex), chain };
}

function saveToStorage(data: SerializedBankV2): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // QuotaExceededError or sandboxed mode — silently drop. The
    // user can still use the bank in-memory; the next refresh
    // just gets an empty bank.
  }
}

function isSerializedBank(x: unknown): x is SerializedBank {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  if (o.version !== 1 && o.version !== 2) return false;
  if (typeof o.activeIndex !== 'number') return false;
  if (!Array.isArray(o.slots)) return false;
  // V2 must have `chain` (sanitiseChain handles malformed values).
  // V1 has no `chain` field; that's fine, we synthesise one.
  return true;
}

function sanitiseChain(x: unknown): ChainState {
  if (typeof x !== 'object' || x === null) return makeEmptyChain();
  const o = x as Record<string, unknown>;
  const enabled = o.enabled === true;
  const loop = o.loop !== false; // default true
  const stepsRaw = Array.isArray(o.steps) ? (o.steps as unknown[]) : [];
  const steps: ChainEntry[] = [];
  for (const e of stepsRaw) {
    if (typeof e !== 'object' || e === null) continue;
    const eo = e as Record<string, unknown>;
    const slotIndex =
      typeof eo.slotIndex === 'number' && Number.isFinite(eo.slotIndex)
        ? clampIndex(eo.slotIndex)
        : 0;
    const cyclesRaw =
      typeof eo.cycles === 'number' && Number.isFinite(eo.cycles)
        ? eo.cycles
        : 1;
    steps.push({ slotIndex, cycles: clampCycles(cyclesRaw) });
  }
  return { enabled, loop, steps };
}

function clampCycles(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(64, Math.round(n)));
}

/** Coerce an arbitrary deserialised value into the current
 *  Pattern shape. Missing / invalid fields fall back to defaults.
 *  Migration from earlier in-memory shapes (boolean[] steps from
 *  pre-27b) lands here too — `sanitiseStep` accepts both. */
function sanitisePattern(x: unknown): Pattern {
  if (typeof x !== 'object' || x === null) return makeEmptyPattern();
  const o = x as Record<string, unknown>;
  const length = sanitiseLength(o.length);
  const bpm = sanitiseBpm(o.bpm);
  const subdivision = sanitiseSubdivision(o.subdivision);
  const tracks = Array.isArray(o.tracks)
    ? (o.tracks as unknown[]).map((t) => sanitiseTrack(t, length))
    : [];
  return { length, bpm, subdivision, tracks };
}

function sanitiseTrack(x: unknown, length: PatternLength): Track {
  const empty: Track = {
    id: makeReadId(),
    sample: '',
    gain: 0.8,
    defaults: {},
    steps: emptySteps(length),
  };
  if (typeof x !== 'object' || x === null) return empty;
  const o = x as Record<string, unknown>;
  return {
    id: typeof o.id === 'string' && o.id ? o.id : empty.id,
    sample: typeof o.sample === 'string' ? o.sample : '',
    gain:
      typeof o.gain === 'number' && Number.isFinite(o.gain)
        ? clamp(o.gain, 0, 2)
        : 0.8,
    defaults: sanitiseParamMap(o.defaults),
    steps: sanitiseSteps(o.steps, length),
  };
}

function sanitiseSteps(x: unknown, length: PatternLength): Step[] {
  if (!Array.isArray(x)) return emptySteps(length);
  // Truncate or pad to current length.
  const out: Step[] = [];
  for (let i = 0; i < length; i++) {
    out.push(sanitiseStep(x[i]));
  }
  return out;
}

function sanitiseStep(x: unknown): Step {
  if (typeof x === 'boolean') return { active: x }; // pre-27b shape
  if (typeof x !== 'object' || x === null) return { active: false };
  const o = x as Record<string, unknown>;
  const active = o.active === true;
  const params = sanitiseParamMap(o.params);
  return Object.keys(params).length > 0 ? { active, params } : { active };
}

function sanitiseParamMap(x: unknown): Partial<Record<string, number>> {
  if (typeof x !== 'object' || x === null) return {};
  const o = x as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const k of ['amp', 'cutoff', 'speed', 'pan']) {
    const v = o[k];
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

function sanitiseLength(x: unknown): PatternLength {
  if (typeof x === 'number' && PATTERN_LENGTHS.includes(x as PatternLength)) {
    return x as PatternLength;
  }
  return 16;
}

function sanitiseBpm(x: unknown): number {
  if (typeof x !== 'number' || !Number.isFinite(x)) return 120;
  return clamp(Math.round(x), 30, 300);
}

function sanitiseSubdivision(x: unknown): number {
  if (typeof x !== 'number' || !Number.isFinite(x) || x <= 0) return 4;
  return Math.round(x);
}

function emptySteps(length: PatternLength): Step[] {
  return Array.from({ length }, () => ({ active: false }));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** True when a slot is "empty" — no tracks. Used by `clearSlot`
 *  to suppress redundant saves. */
function slotIsEmpty(p: Pattern): boolean {
  return p.tracks.length === 0;
}

let readIdCounter = 0;
function makeReadId(): string {
  readIdCounter += 1;
  return `track-restored-${readIdCounter}`;
}
