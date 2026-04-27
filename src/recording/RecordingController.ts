/**
 * Per-recording lifecycle controller. Owns one recorder synth, its
 * dedicated buffer, the worker subscription that funnels samples
 * back, and the in-memory WAV writer that materialises them. State
 * is exposed as `ReadonlyStore`s so the UI re-renders only on real
 * change events.
 *
 * Sample-accurate start: when the clock has anchored `tick0Ms`, the
 * controller schedules `/s_new` in an `OSC.Bundle` with timetag at
 * the *next* tick boundary. scsynth's queue holds the synth until
 * exactly that audio frame, so the recorder's `Phasor.ar` starts at
 * 0 aligned to a known tick — and multi-bus recordings started in
 * the same call window share a tick origin and stay phase-locked.
 *
 * Stop is sequenced as `unsubscribeBuffer` → `/n_free` → `/b_free`
 * → finalise WAV on main. The unsubscribe fires first so any late
 * chunks landing in flight are dropped at the WorkerClient's
 * main-side fan-out before they reach this controller.
 *
 * Phase 17 relocated WAV writing from the worker to main: the worker
 * is now subscription-kind-agnostic and just emits `bufferChunk`
 * events (with `isGap: true` on retry exhaustion). This controller
 * runs the `WavMemoryWriter` directly, materialises gap chunks into
 * the sidecar JSON list, and finalises synchronously on stop —
 * eliminating the round-trip wait on `recordingDone` that the
 * Phase 12 worker-side pipeline required. The `wavWriter.ts` file
 * still lives under `src/workers/` and physically moves to
 * `src/recording/` in Phase 20; until then we import it from there
 * (it's pure ArrayBuffer manipulation, works equally on both
 * threads).
 *
 * Phase 17 adapter shim: we still own our own buffer + tap synth +
 * worker subscription. Phase 20 will move the buffer + tap behind
 * `BufferManager.acquire` and let scopes share the tap.
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
} from '@/synthdefs/recorderSynthDef';
import type { ClockController } from '@/clock/ClockController';
import type { GroupController } from '@/server/GroupController';
import type { IdAllocator } from '@/server/IdAllocator';
import { ScopeController } from '@/scope/ScopeController';
import type { SynthDefRegistry } from '@/server/SynthDefRegistry';
import type { WorkerClient } from '@/server/WorkerClient';
import type { BufferChunk } from '@/server/workerProtocol';
import { createStore, type ReadonlyStore } from '@/util/reactiveStore';
import { WavMemoryWriter } from '@/workers/wavWriter';
import {
  EnvelopeBuffer,
  type EnvelopeBufferSnapshot,
} from './envelopeBuffer';

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
  channels: number;
  label?: string;
  /** Override the default `{ maxAttempts: 2, deadlineMs: 12 }` retry
   *  policy. Mostly useful for fault-injection tests. */
  retry?: { maxAttempts: number; deadlineMs: number };
}

const DEFAULT_RETRY = { maxAttempts: 2, deadlineMs: 12 };
/** Number of ticks to wait between `/s_new` being received by the
 *  worker and the synth firing. 2 ticks (~43 ms at 46.875 Hz) is
 *  enough for the bundle to land in scsynth's scheduler queue and
 *  for the bridge round-trip latency. Smaller values risk a "late"
 *  warning from scsynth, which makes the synth fire immediately and
 *  breaks the multi-bus alignment guarantee. */
const START_TICK_LEAD = 2;

export class RecordingController {
  readonly recordingId: string;
  readonly label: string;
  readonly channels: number;
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
  /** WAV writer owns the in-memory buffer that grows chunk-by-chunk.
   *  Created fresh per controller; finalise() runs once on stop and
   *  hands back the underlying ArrayBuffer for the result Blob. */
  private writer: WavMemoryWriter | null = null;
  /** Mutable gap accumulator — updated as `bufferChunk` events with
   *  `isGap: true` arrive. Mirrored into `gapsStore` for the UI. */
  private readonly gapList: Array<{ tickIndex: number; framesMissing: number }> =
    [];
  /** Wall-clock at start, for filename generation. */
  private startedAt: Date | null = null;
  /** Internal scope for the per-tick waveform envelope. Composes a
   *  full ScopeController on the recording's input bus — separate
   *  buffer + synth from the recorder so chunk reads don't fight,
   *  and so the scope's existing pipeline does the /b_setn → main
   *  hand-off for free. */
  private internalScope: ScopeController | null = null;
  private envelopeUnsubscribe: (() => void) | null = null;
  private readonly envelopeBuffer: EnvelopeBuffer;
  private readonly envelopesStore = createStore<EnvelopeBufferSnapshot>({
    mins: [],
    maxs: [],
    firstTickIndex: -1,
    count: 0,
    channels: 1,
  });

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
    this.envelopeBuffer = new EnvelopeBuffer(this.channels);
    this.envelopesStore.set(this.envelopeBuffer.snapshot());
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
  /** Per-tick envelope (min/max per channel) accumulated for the
   *  recording's lifetime. Updated as scope chunks land; persists
   *  after `stop()` so the panel can scroll the full history. */
  get envelopes(): ReadonlyStore<EnvelopeBufferSnapshot> {
    return this.envelopesStore;
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
      const samplesPerTick = this.clock.derived.samplesPerTick;
      const synthName = recorderSynthDefName(this.channels, samplesPerTick);
      await this.registry.ensureLoaded(
        synthName,
        compileRecorderSynthDef(this.channels, samplesPerTick),
      );

      const bufnum = this.bufferIds.next();
      const ringFrames = samplesPerTick * 2;
      await this.client.sendAndSync(bAlloc(bufnum, ringFrames, this.channels));
      this.bufnum = bufnum;

      const nodeId = this.nodeIds.next();
      this.nodeId = nodeId;

      // Construct the WAV writer fresh per start cycle. Holds the
      // entire in-memory recording until finalise() runs in stop().
      this.writer = new WavMemoryWriter({
        sampleRate: this.clock.env.sampleRate,
        channels: this.channels,
      });

      // Register the worker subscription *before* /s_new so the first
      // /b_setn (whichever tick it lands on) is routed through the
      // recording dispatch path. The worker's default
      // `skipFirstTick: true` ensures we don't read the partial-half
      // written between /s_new and the next tick boundary.
      const handle = this.client.subscribeBuffer(
        {
          bufferId: `rec-${this.recordingId}`,
          bufnum,
          channels: this.channels,
          chunkSize: samplesPerTick,
          retry: this.retry,
        },
        (chunk) => this.handleChunk(chunk),
      );
      this.unsubscribe = handle.unsubscribe;

      const sNewMsg = sNew(synthName, nodeId, AddToTail, this.group.groupId, {
        inBus: this.inputBus,
        bufnum,
        clockBus: this.clock.clockBus,
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
          this.clock.derived.tickRate,
        );
        this.client.sendCommand(new OSC.Bundle([sNewMsg], whenMs));
      } else {
        this.client.sendCommand(sNewMsg);
      }

      // Internal "tap scope" on the same input bus. It runs the
      // existing scope pipeline (decimated /b_getn, /b_setn → main
      // via bufferChunk events) so we don't have to add a new worker
      // path. We compute per-tick min/max envelopes from each
      // incoming chunk and append to the envelope buffer that the
      // panel renders. Started AFTER the recorder /s_new is queued
      // so the recorder lands first in the parent group's tail
      // ordering — both are AddToTail so order = /s_new send order.
      const internalScope = new ScopeController({
        client: this.client,
        clock: this.clock,
        group: this.group,
        registry: this.registry,
        ids: { node: this.nodeIds, buffer: this.bufferIds },
        inputBus: this.inputBus,
        channels: this.channels,
        scopeId: `rec-tap-${this.recordingId}`,
        label: `${this.label} (waveform tap)`,
      });
      this.internalScope = internalScope;
      this.envelopeUnsubscribe = internalScope.latestChunk.subscribe(
        (chunk) => {
          if (!chunk) return;
          this.envelopeBuffer.append(chunk.tickIndex, chunk.data);
          this.envelopesStore.set(this.envelopeBuffer.snapshot());
        },
      );
      await internalScope.start();

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
      if (this.envelopeUnsubscribe) {
        this.envelopeUnsubscribe();
        this.envelopeUnsubscribe = null;
      }
      if (this.internalScope) {
        try {
          await this.internalScope.stop();
        } catch {
          /* best effort */
        }
        this.internalScope = null;
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
      this.writer = null;
      throw err;
    }
  }

  /** Tear down server-side state, drop the worker subscription, and
   *  finalise the WAV synchronously on main. Resolves with the
   *  complete `RecordingResult`. */
  async stop(): Promise<RecordingResult> {
    const state = this.stateStore.get();
    if (state === 'done') {
      const cached = this.resultStore.get();
      if (cached) return cached;
    }
    if (state !== 'recording') {
      throw new Error(`RecordingController.stop: invalid state ${state}`);
    }
    this.stateStore.set('finalizing');

    // Tear down the waveform tap scope alongside the recorder. Fire-
    // and-forget — the envelope buffer (held in main memory) survives
    // for post-stop scrolling.
    if (this.envelopeUnsubscribe) {
      this.envelopeUnsubscribe();
      this.envelopeUnsubscribe = null;
    }
    if (this.internalScope) {
      const scope = this.internalScope;
      this.internalScope = null;
      void scope.stop().catch((err) => {
        console.warn(
          `[sc:rec ${this.recordingId}] internal scope stop failed`,
          err,
        );
      });
    }

    // Unsubscribe FIRST so any late `bufferChunk` events landing in
    // flight are dropped at the WorkerClient fan-out before they
    // reach `handleChunk` and append to the writer post-finalise.
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.nodeId !== null) {
      try {
        this.client.sendCommand(nFree(this.nodeId));
      } catch (err) {
        console.warn(`[sc:rec ${this.recordingId}] nFree failed`, err);
      }
      this.nodeId = null;
    }
    if (this.bufnum !== null) {
      try {
        this.client.sendCommand(bFree(this.bufnum));
      } catch (err) {
        console.warn(`[sc:rec ${this.recordingId}] bFree failed`, err);
      }
      this.bufnum = null;
    }

    // Finalise the WAV on main. Synchronous — no round-trip wait on
    // a worker `recordingDone` event the way Phase 12 needed.
    if (!this.writer) {
      throw new Error(
        `RecordingController.stop: writer missing — start() never completed`,
      );
    }
    const totalFrames = this.writer.framesWritten;
    const wav = this.writer.finalise();
    this.writer = null;

    const sampleRate = this.clock.env.sampleRate;
    const wavBlob = new Blob([wav], { type: 'audio/wav' });
    const gapsSnapshot = this.gapList.slice();
    const gapsJson =
      gapsSnapshot.length > 0
        ? JSON.stringify(
            { recordingId: this.recordingId, gaps: gapsSnapshot },
            null,
            2,
          )
        : '';
    const gapsBlob =
      gapsJson.length > 0
        ? new Blob([gapsJson], { type: 'application/json' })
        : null;

    const result: RecordingResult = {
      wavBlob,
      gapsBlob,
      gaps: gapsSnapshot,
      totalFrames,
      durationSeconds: totalFrames / sampleRate,
      suggestedFilename: this.deriveFilename(),
    };

    this.framesWrittenStore.set(totalFrames);
    this.gapsStore.set(gapsSnapshot);
    this.resultStore.set(result);
    this.stateStore.set('done');

    return result;
  }

  // ── Internals ─────────────────────────────────────────────────────

  private handleChunk(chunk: BufferChunk): void {
    if (!this.writer) return;
    // The worker delivers in strict tick order with offset-keyed
    // pending + reorder buffer — appending in arrival order keeps
    // the WAV linear. Gap chunks are zero-filled by the worker, so
    // we append them verbatim and just record the sidecar entry.
    this.writer.append(chunk.data);
    this.framesWrittenStore.set(this.writer.framesWritten);

    if (chunk.isGap) {
      const framesMissing = chunk.data.length / chunk.channels;
      this.gapList.push({ tickIndex: chunk.tickIndex, framesMissing });
      this.gapsStore.set(this.gapList.slice());
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
