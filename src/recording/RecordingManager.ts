/**
 * Multi-recording orchestrator. Owns the live list of
 * `RecordingController`s and the bus / buffer / node id allocators
 * they share with everything else (clock, scopes).
 *
 * Unlike `ScopeManager`, recordings do *not* auto-allocate a bus —
 * they tap an existing one (a tone, a scope's input, hardware out).
 * The caller supplies `inputBus` and is responsible for verifying
 * audio is actually flowing on it.
 *
 * Lifecycles are independent: `add()` starts immediately, `stopAll()`
 * resolves with one result per stopped controller. Stopped recordings
 * stay in the list (their `state.get() === 'done'`) so the panel can
 * still offer the Download button — the user removes them explicitly.
 */

import type { ClockController } from '@/clock/ClockController';
import type { GroupController } from '@/server/GroupController';
import type { IdAllocator } from '@/server/IdAllocator';
import { createStore, type ReadonlyStore } from '@/util/reactiveStore';
import type { SynthDefRegistry } from '@/server/SynthDefRegistry';
import type { WorkerClient } from '@/server/WorkerClient';
import {
  RecordingController,
  type RecordingResult,
} from './RecordingController';

export interface RecordingManagerOptions {
  client: WorkerClient;
  clock: ClockController;
  group: GroupController;
  registry: SynthDefRegistry;
  ids: { node: IdAllocator; buffer: IdAllocator };
}

export interface AddRecordingOptions {
  inputBus: number;
  channels: 1 | 2;
  label?: string;
  retry?: { maxAttempts: number; deadlineMs: number };
}

function freshRecordingId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `rec-${Math.random().toString(36).slice(2, 10)}`;
}

export class RecordingManager {
  private readonly client: WorkerClient;
  private readonly clock: ClockController;
  private readonly group: GroupController;
  private readonly registry: SynthDefRegistry;
  private readonly ids: { node: IdAllocator; buffer: IdAllocator };

  private readonly recordingsStore = createStore<RecordingController[]>([]);

  constructor(opts: RecordingManagerOptions) {
    this.client = opts.client;
    this.clock = opts.clock;
    this.group = opts.group;
    this.registry = opts.registry;
    this.ids = opts.ids;
  }

  get recordings(): ReadonlyStore<RecordingController[]> {
    return this.recordingsStore;
  }

  /** Construct a controller and start it. Resolves once the worker
   *  subscription is registered and the recorder synth has been
   *  scheduled — recording samples may not have started landing yet. */
  async add(opts: AddRecordingOptions): Promise<RecordingController> {
    const recordingId = freshRecordingId();
    const ctrl = new RecordingController({
      client: this.client,
      clock: this.clock,
      group: this.group,
      registry: this.registry,
      ids: this.ids,
      recordingId,
      inputBus: opts.inputBus,
      channels: opts.channels,
      label: opts.label,
      retry: opts.retry,
    });
    await ctrl.start();
    this.recordingsStore.update((list) => [...list, ctrl]);
    return ctrl;
  }

  /** Drop a (typically already-stopped) recording from the list. The
   *  controller's `result` Blob is released to GC if no other code
   *  retains it — the user has presumably already downloaded the WAV. */
  remove(recordingId: string): void {
    this.recordingsStore.update((list) =>
      list.filter((r) => r.recordingId !== recordingId),
    );
  }

  /** Stop every active recording and wait for each to finalise.
   *  Already-stopped controllers (state === 'done' / 'error') are
   *  returned with their cached result if any.
   *
   *  This is part of the disconnect cleanup chain — call it before
   *  freeing the parent group so worker subscriptions drain cleanly
   *  and the WAVs are still available in memory for the user to
   *  download afterwards. */
  async stopAll(): Promise<RecordingResult[]> {
    const list = this.recordingsStore.get();
    const settled = await Promise.all(
      list.map(async (ctrl) => {
        const state = ctrl.state.get();
        if (state === 'recording') {
          try {
            return await ctrl.stop();
          } catch (err) {
            console.warn(
              `[sc:rec-manager] stop ${ctrl.recordingId} failed`,
              err,
            );
            return null;
          }
        }
        return ctrl.result.get();
      }),
    );
    return settled.filter((r): r is RecordingResult => r !== null);
  }
}
