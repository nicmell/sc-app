/**
 * One source synth — owns a `tone1ch` / `tone2ch` synth on
 * scsynth, plus the reactive freq / amp / gate state the
 * `SynthsPanel` UI binds to.
 *
 * Producer-side mirror of `ScopeController` (the consumer side):
 * a synth controller owns the bus that a scope or recorder later
 * taps. There's no buffer, no worker subscription, no chunk
 * pipeline — just `/s_new` once on `start()` and `/n_set` on
 * each runtime control change. `/n_set` is fire-and-forget (no
 * /sync), so freq / amp / gate setters are synchronous and
 * optimistically update the local store.
 */

import {
  AddToTail,
  nFree,
  nSet,
  sNew,
} from '@sc-app/server-commands';
import {
  compileToneSynthDef,
  toneSynthDefName,
} from '@/synthdefs/toneSynthDef';
import type { GroupController } from '@/server/GroupController';
import type { IdAllocator } from '@/server/IdAllocator';
import { createStore, type ReadonlyStore } from '@/util/reactiveStore';
import type { SynthDefRegistry } from '@/server/SynthDefRegistry';
import type { WorkerClient } from '@/server/WorkerClient';

export type SynthKind = 'mono' | 'stereo';

/** Oscillator selection — maps to the `waveform` kr control on the
 *  tone synthdef via `WAVEFORM_INDEX`. Switchable at runtime. */
export type Waveform = 'sine' | 'square' | 'saw';

/** Index used by `Select.ar` inside the tone synthdef. Order
 *  matters — must match the synthdef's array of source oscillators. */
export const WAVEFORM_INDEX: Record<Waveform, number> = {
  sine: 0,
  square: 1,
  saw: 2,
};

export const WAVEFORMS: readonly Waveform[] = ['sine', 'square', 'saw'];

export interface SynthControllerOptions {
  client: WorkerClient;
  registry: SynthDefRegistry;
  group: GroupController;
  ids: { node: IdAllocator };
  /** Stable id for UI list keys. */
  synthId: string;
  kind: SynthKind;
  /** First bus index in this synth's contiguous block (auto-
   *  allocated by the manager — `nextBlock(channels)`). */
  inputBus: number;
  label?: string;
  /** Mono: length 1 array of the freq. Stereo: length 2 of
   *  [freqL, freqR]. Defaults: mono=[440], stereo=[440, 660]. */
  initialFreqs?: readonly number[];
  initialAmp?: number;
  /** Whether the gate starts open (audible) or closed. Default
   *  true — matches the previous bundled-source UX where adding a
   *  scope immediately played sound. */
  initialGate?: boolean;
  /** Initial oscillator waveform. Default `'sine'`. */
  initialWaveform?: Waveform;
}

const DEFAULT_AMP = 0.2;
const DEFAULT_WAVEFORM: Waveform = 'sine';

function defaultFreqs(kind: SynthKind): readonly number[] {
  return kind === 'mono' ? [440] : [440, 660];
}

export class SynthController {
  readonly synthId: string;
  readonly kind: SynthKind;
  readonly channels: 1 | 2;
  readonly inputBus: number;
  readonly label: string;

  private readonly client: WorkerClient;
  private readonly registry: SynthDefRegistry;
  private readonly group: GroupController;
  private readonly nodeIds: IdAllocator;

  private readonly nodeIdStore = createStore<number | null>(null);
  private readonly freqsStore: ReturnType<
    typeof createStore<readonly number[]>
  >;
  private readonly ampStore: ReturnType<typeof createStore<number>>;
  private readonly gateOpenStore: ReturnType<typeof createStore<boolean>>;
  private readonly waveformStore: ReturnType<typeof createStore<Waveform>>;

  private started = false;

  constructor(opts: SynthControllerOptions) {
    this.client = opts.client;
    this.registry = opts.registry;
    this.group = opts.group;
    this.nodeIds = opts.ids.node;
    this.synthId = opts.synthId;
    this.kind = opts.kind;
    this.channels = opts.kind === 'mono' ? 1 : 2;
    this.inputBus = opts.inputBus;
    this.label = opts.label ?? `synth ${opts.synthId.slice(0, 6)}`;

    const freqs = opts.initialFreqs ?? defaultFreqs(opts.kind);
    if (freqs.length !== this.channels) {
      throw new Error(
        `SynthController: initialFreqs length ${freqs.length} doesn't ` +
          `match channels ${this.channels}`,
      );
    }
    this.freqsStore = createStore<readonly number[]>(freqs);
    this.ampStore = createStore<number>(opts.initialAmp ?? DEFAULT_AMP);
    this.gateOpenStore = createStore<boolean>(opts.initialGate ?? true);
    this.waveformStore = createStore<Waveform>(
      opts.initialWaveform ?? DEFAULT_WAVEFORM,
    );
  }

  /** Current scsynth node id, or `null` while stopped. */
  get nodeId(): ReadonlyStore<number | null> {
    return this.nodeIdStore;
  }
  /** Current freq value(s) — length matches `channels`. */
  get freqs(): ReadonlyStore<readonly number[]> {
    return this.freqsStore;
  }
  get amp(): ReadonlyStore<number> {
    return this.ampStore;
  }
  /** True when gate=1 (audible). */
  get gateOpen(): ReadonlyStore<boolean> {
    return this.gateOpenStore;
  }
  /** Current oscillator waveform — switchable at runtime via `setWaveform`. */
  get waveform(): ReadonlyStore<Waveform> {
    return this.waveformStore;
  }

  /** /s_new the tone synth with the current freq / amp / gate
   *  state. Idempotent. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const synthName = toneSynthDefName(this.channels);
    await this.registry.ensureLoaded(
      synthName,
      compileToneSynthDef(this.channels),
    );

    const nodeId = this.nodeIds.next();
    const controls: Record<string, number> = {
      outBus: this.inputBus,
      amp: this.ampStore.get(),
      gate: this.gateOpenStore.get() ? 1 : 0,
      waveform: WAVEFORM_INDEX[this.waveformStore.get()],
    };
    const freqs = this.freqsStore.get();
    if (this.kind === 'mono') {
      controls.freq = freqs[0];
    } else {
      controls.freqL = freqs[0];
      controls.freqR = freqs[1];
    }

    await this.client.sendAndSync(
      sNew(synthName, nodeId, AddToTail, this.group.groupId, controls),
    );
    this.nodeIdStore.set(nodeId);
  }

  /** /n_free the synth. The bus block stays "owned" by this
   *  controller (the IdAllocator is monotonic — buses don't
   *  recycle within a session). */
  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    const id = this.nodeIdStore.get();
    if (id !== null) {
      try {
        await this.client.sendAndSync(nFree(id));
      } catch (err) {
        console.warn(`[sc:synth ${this.synthId}] nFree failed`, err);
      }
    }
    this.nodeIdStore.set(null);
  }

  /** Update one frequency control (idx 0 = freq / freqL, idx 1 =
   *  freqR for stereo). Fires `/n_set` if the synth is running and
   *  optimistically updates the local store. Bounds-checks `idx`
   *  against `channels`. */
  setFreq(idx: 0 | 1, hz: number): void {
    if (!Number.isFinite(hz) || hz <= 0) return;
    if (idx >= this.channels) return;
    const next = [...this.freqsStore.get()];
    next[idx] = hz;
    this.freqsStore.set(next);
    const id = this.nodeIdStore.get();
    if (id === null) return;
    const key = this.kind === 'mono' ? 'freq' : idx === 0 ? 'freqL' : 'freqR';
    this.client.sendCommand(nSet(id, { [key]: hz }));
  }

  setAmp(value: number): void {
    if (!Number.isFinite(value) || value < 0) return;
    this.ampStore.set(value);
    const id = this.nodeIdStore.get();
    if (id === null) return;
    this.client.sendCommand(nSet(id, { amp: value }));
  }

  setGate(open: boolean): void {
    if (this.gateOpenStore.get() === open) return;
    this.gateOpenStore.set(open);
    const id = this.nodeIdStore.get();
    if (id === null) return;
    this.client.sendCommand(nSet(id, { gate: open ? 1 : 0 }));
  }

  /** Switch the oscillator at runtime. The synthdef runs all three
   *  oscillators in parallel under a `Select.ar`, so this is a pure
   *  control change — no /s_new, no /n_replace, no audio dropout. */
  setWaveform(w: Waveform): void {
    if (this.waveformStore.get() === w) return;
    this.waveformStore.set(w);
    const id = this.nodeIdStore.get();
    if (id === null) return;
    this.client.sendCommand(nSet(id, { waveform: WAVEFORM_INDEX[w] }));
  }
}
