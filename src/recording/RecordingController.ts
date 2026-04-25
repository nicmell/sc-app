/**
 * Per-recording lifecycle controller. Owns one recorder synth, its
 * dedicated buffer, and the worker subscription that funnels samples
 * into an in-memory WAV. State is exposed as `ReadonlyStore`s so the
 * UI re-renders only on real change events; `chunksPerSec`-style
 * derivatives are intentionally not built here — the panel can derive
 * them from `framesWritten` deltas if needed.
 *
 * Sample-accurate start: when the clock has anchored `tick0Ms`, the
 * controller schedules `/s_new` in an `OSC.Bundle` with timetag at
 * the *next* tick boundary. scsynth's queue holds the synth until
 * exactly that audio frame, so the recorder's `Phasor.ar` starts at
 * 0 aligned to a known tick — and multi-bus recordings started in
 * the same call window share a tick origin and stay phase-locked.
 *
 * Stop is sequenced as `/n_free` (stops sample writes immediately)
 * → `/b_free` → `stopRecording` to the worker. The worker drains any
 * in-flight read silently (it'd never come back post-/n_free), then
 * finalises the WAV and posts `recordingDone`. The controller awaits
 * that event and resolves `stop()` with the finalised result.
 */

import {
  AddToTail,
  bAlloc,
  bFree,
  nFree,
  OSC,
  sNew,
  tickToTimetag,
} from '@sc-app/server-commands';
import {
  compileRecorderSynthDef,
  recorderSynthDefName,
} from '@/synth/recorderSynthDef';
import type { ClockController } from '@/scope/ClockController';
import type { GroupController } from '@/scope/GroupController';
import type { IdAllocator } from '@/scope/IdAllocator';
import type { SynthDefRegistry } from '@/scope/SynthDefRegistry';
import type { WorkerClient } from '@/scope/WorkerClient';
import { createStore, type ReadonlyStore } from '@/scope/reactiveStore';

export type RecordingState =
  | 'idle'
  | 'preparing'
  | 'recording'
  | 'finalizing'
  | 'done'
  | 'error';

export interface RecordingResult {
  /** Complete WAV file as a Blob, ready for download. */
  wavBlob: Blob;
  /** Sidecar `gaps.json` Blob — null when no gaps were logged. */
  gapsBlob: Blob | null;
  gaps: ReadonlyArray<{ tickIndex: number; framesMissing: number }>;
  totalFrames: number;
  durationSeconds: number;
  /** Suggested base filename (without extension). The panel adds
   *  `.wav` / `.gaps.json` as appropriate. */
  suggestedFilename: string;
}

export interface RecordingControllerOptions {
  client: WorkerClient;
  clock: ClockController;
  group: GroupController;
  registry: SynthDefRegistry;
  ids: { node: IdAllocator; buffer: IdAllocator };
  recordingId: string;
  inputBus: number;
  channels: 1 | 2;
  label?: string;
  /** Override the default `{ maxAttempts: 2, deadlineMs: 12 }` retry
   *  policy. Mostly useful for fault-injection tests. */
  retry?: { maxAttempts: number; deadlineMs: number };
}

const DEFAULT_RETRY = { maxAttempts: 2, deadlineMs: 12 };
/** Number of ticks to wait between `/s_new` being received by the
 *  worker and the synth firing. 2 ticks (~42 ms at 48 Hz) is enough
 *  for the bundle to land in scsynth's scheduler queue and for the
 *  bridge round-trip latency. Smaller values risk a "late" warning
 *  from scsynth, which makes the synth fire immediately and breaks
 *  the multi-bus alignment guarantee. */
const START_TICK_LEAD = 2;

export class RecordingController {
  readonly recordingId: string;
  readonly label: string;
  readonly channels: 1 | 2;
  readonly inputBus: number;

  private readonly client: WorkerClient;
  private readonly clock: ClockController;
  private readonly group: GroupController;
  private readonly registry: SynthDefRegistry;
  private readonly nodeIds: IdAllocator;
  private readonly bufferIds: IdAllocator;
  private readonly retry: { maxAttempts: number; deadlineMs: number };

  private readonly stateStore = createStore<RecordingState>('idle');
  private readonly framesWrittenStore = createStore<number>(0);
  private readonly gapsStore = createStore<
    ReadonlyArray<{ tickIndex: number; framesMissing: number }>
  >([]);
  private readonly resultStore = createStore<RecordingResult | null>(null);
  private readonly errorStore = createStore<string | null>(null);

  private nodeId: number | null = null;
  private bufnum: number | null = null;
  private unsubscribe: (() => void) | null = null;
  /** Resolves on the next `recordingDone`, set up by `stop()`. */
  private donePromise: Promise<RecordingResult> | null = null;
  private resolveDone: ((result: RecordingResult) => void) | null = null;
  /** Wall-clock at start, for filename generation. */
  private startedAt: Date | null = null;

  constructor(opts: RecordingControllerOptions) {
    this.client = opts.client;
    this.clock = opts.clock;
    this.group = opts.group;
    this.registry = opts.registry;
    this.nodeIds = opts.ids.node;
    this.bufferIds = opts.ids.buffer;
    this.recordingId = opts.recordingId;
    this.label = opts.label ?? `recording ${opts.recordingId.slice(0, 6)}`;
    this.channels = opts.channels;
    this.inputBus = opts.inputBus;
    this.retry = opts.retry ?? DEFAULT_RETRY;
  }

  get state(): ReadonlyStore<RecordingState> {
    return this.stateStore;
  }
  get framesWritten(): ReadonlyStore<number> {
    return this.framesWrittenStore;
  }
  get gaps(): ReadonlyStore<
    ReadonlyArray<{ tickIndex: number; framesMissing: number }>
  > {
    return this.gapsStore;
  }
  /** Populated once `stop()` has resolved; null while running. */
  get result(): ReadonlyStore<RecordingResult | null> {
    return this.resultStore;
  }
  /** Last error message, or null. Set when state transitions to 'error'. */
  get error(): ReadonlyStore<string | null> {
    return this.errorStore;
  }

  /** Allocate buffer, /s_new the recorder synth (sample-accurate when
   *  the clock has tick0Ms; immediate otherwise), and register the
   *  worker subscription. Idempotent — safe to call once. */
  async start(): Promise<void> {
    if (this.stateStore.get() !== 'idle') {
      throw new Error(
        `RecordingController.start: invalid state ${this.stateStore.get()}`,
      );
    }
    this.stateStore.set('preparing');
    this.errorStore.set(null);
    this.startedAt = new Date();

    try {
      const synthName = recorderSynthDefName(this.channels);
      await this.registry.ensureLoaded(
        synthName,
        compileRecorderSynthDef(this.channels),
      );

      const bufnum = this.bufferIds.next();
      const samplesPerTick = this.clock.derived.samplesPerTick;
      const ringFrames = samplesPerTick * 2;
      await this.client.sendAndSync(bAlloc(bufnum, ringFrames, this.channels));
      this.bufnum = bufnum;

      const nodeId = this.nodeIds.next();
      this.nodeId = nodeId;

      // Register the worker subscription *before* /s_new so the first
      // /b_setn (whichever tick it lands on) is routed through the
      // recording dispatch path. The skipFirstTick flag in the worker
      // ensures we don't read the partial-half written between
      // /s_new and the next tick boundary.
      this.unsubscribe = this.client.subscribeRecording(
        {
          recordingId: this.recordingId,
          bufnum,
          channels: this.channels,
          sampleRate: this.clock.env.sampleRate,
          samplesPerTick,
          retry: this.retry,
        },
        {
          onChunk: (info) => {
            this.framesWrittenStore.set(info.framesWritten);
          },
          onGap: (gap) => {
            this.gapsStore.update((list) => [
              ...list,
              { tickIndex: gap.tickIndex, framesMissing: gap.framesMissing },
            ]);
          },
          onDone: (done) => this.handleDone(done),
        },
      );

      const sNewMsg = sNew(synthName, nodeId, AddToTail, this.group.groupId, {
        inBus: this.inputBus,
        bufnum,
      });

      // Sample-accurate start: schedule /s_new at a known future tick
      // so multi-bus recordings created in the same JS turn share a
      // tick origin. Falls back to immediate /s_new when the clock
      // hasn't anchored yet (only happens during the first ~tick of
      // the session).
      const tick0Ms = this.clock.tick0Ms;
      const lastTick = this.clock.lastTick.get();
      if (tick0Ms !== null && lastTick !== null) {
        const startTick = lastTick.tickIndex + START_TICK_LEAD;
        const whenMs = tickToTimetag(
          tick0Ms,
          startTick,
          this.clock.params.tickRate,
        );
        this.client.sendCommand(new OSC.Bundle([sNewMsg], whenMs));
      } else {
        this.client.sendCommand(sNewMsg);
      }

      this.stateStore.set('recording');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.errorStore.set(msg);
      this.stateStore.set('error');
      // Clean up partial state so a retry from the manager doesn't
      // leak the buffer or a dangling subscription.
      if (this.unsubscribe) {
        this.unsubscribe();
        this.unsubscribe = null;
      }
      if (this.bufnum !== null) {
        try {
          this.client.sendCommand(bFree(this.bufnum));
        } catch {
          /* best effort */
        }
        this.bufnum = null;
      }
      this.nodeId = null;
      throw err;
    }
  }

  /** Free the recorder synth + buffer, then ask the worker to
   *  finalise the WAV. Resolves with the complete `RecordingResult`
   *  once `recordingDone` lands. */
  async stop(): Promise<RecordingResult> {
    const state = this.stateStore.get();
    if (state === 'done') {
      const cached = this.resultStore.get();
      if (cached) return cached;
    }
    if (state !== 'recording') {
      throw new Error(
        `RecordingController.stop: invalid state ${state}`,
      );
    }
    this.stateStore.set('finalizing');

    if (this.donePromise === null) {
      this.donePromise = new Promise<RecordingResult>((resolve) => {
        this.resolveDone = resolve;
      });
    }

    if (this.nodeId !== null) {
      try {
        this.client.sendCommand(nFree(this.nodeId));
      } catch (err) {
        console.warn(
          `[sc:rec ${this.recordingId}] nFree failed`,
          err,
        );
      }
    }
    if (this.bufnum !== null) {
      try {
        this.client.sendCommand(bFree(this.bufnum));
      } catch (err) {
        console.warn(
          `[sc:rec ${this.recordingId}] bFree failed`,
          err,
        );
      }
    }
    this.client.stopRecording(this.recordingId);

    return this.donePromise;
  }

  // ── Internals ─────────────────────────────────────────────────────

  private handleDone(done: {
    totalFrames: number;
    gaps: ReadonlyArray<{ tickIndex: number; framesMissing: number }>;
    wav: ArrayBuffer;
    gapsJson: string;
  }): void {
    const sampleRate = this.clock.env.sampleRate;
    const wavBlob = new Blob([done.wav], { type: 'audio/wav' });
    const gapsBlob =
      done.gapsJson.length > 0
        ? new Blob([done.gapsJson], { type: 'application/json' })
        : null;

    const result: RecordingResult = {
      wavBlob,
      gapsBlob,
      gaps: done.gaps,
      totalFrames: done.totalFrames,
      durationSeconds: done.totalFrames / sampleRate,
      suggestedFilename: this.deriveFilename(),
    };

    this.framesWrittenStore.set(done.totalFrames);
    this.gapsStore.set(done.gaps);
    this.resultStore.set(result);
    this.stateStore.set('done');

    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.resolveDone) {
      this.resolveDone(result);
      this.resolveDone = null;
    }
  }

  private deriveFilename(): string {
    const ts = (this.startedAt ?? new Date()).toISOString();
    // Replace ':' with '-' and drop the trailing fractional seconds /
    // 'Z' for filename ergonomics: 2026-04-25T13-22-04.
    const tsClean = ts.replace(/:/g, '-').replace(/\..*$/, '');
    return `recording-bus${this.inputBus}-${tsClean}`;
  }
}
