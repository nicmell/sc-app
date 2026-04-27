/**
 * Multi-synth orchestrator. Owns the live list of source-synth
 * controllers and the bus / node id allocators they share with
 * the rest of the dashboard.
 *
 * Each `add()` call auto-allocates a contiguous bus block via
 * `ids.bus.nextBlock(channels)` — synths are exclusive owners of
 * the bus they write to, and the user reads the bus number off the
 * card to wire it into a scope or recording.
 *
 * Mirrors `ScopeManager` / `RecordingManager` in shape: reactive
 * `synths` store + `add` / `remove` / `clear`.
 */

import type { GroupController } from './GroupController';
import type { IdAllocator } from './IdAllocator';
import { createStore, type ReadonlyStore } from './reactiveStore';
import { SynthController, type SynthKind } from './SynthController';
import type { SynthDefRegistry } from './SynthDefRegistry';
import type { WorkerClient } from './WorkerClient';

export interface SynthManagerOptions {
  client: WorkerClient;
  group: GroupController;
  registry: SynthDefRegistry;
  ids: { node: IdAllocator; bus: IdAllocator };
}

export interface AddSynthOptions {
  kind: SynthKind;
  label?: string;
  /** Mono: length 1; stereo: length 2. Defaults applied by
   *  `SynthController` if omitted. */
  freqs?: readonly number[];
  amp?: number;
  /** Whether to start with gate open (default true — synth plays
   *  immediately on Add, matching the previous bundled-source UX). */
  gate?: boolean;
}

function freshSynthId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `synth-${Math.random().toString(36).slice(2, 10)}`;
}

export class SynthManager {
  private readonly client: WorkerClient;
  private readonly group: GroupController;
  private readonly registry: SynthDefRegistry;
  private readonly ids: SynthManagerOptions['ids'];

  private readonly synthsStore = createStore<SynthController[]>([]);

  constructor(opts: SynthManagerOptions) {
    this.client = opts.client;
    this.group = opts.group;
    this.registry = opts.registry;
    this.ids = opts.ids;
  }

  get synths(): ReadonlyStore<SynthController[]> {
    return this.synthsStore;
  }

  async add(opts: AddSynthOptions): Promise<SynthController> {
    const channels = opts.kind === 'mono' ? 1 : 2;
    const inputBus = this.ids.bus.nextBlock(channels);
    const synthId = freshSynthId();
    const ctrl = new SynthController({
      client: this.client,
      registry: this.registry,
      group: this.group,
      ids: { node: this.ids.node },
      synthId,
      kind: opts.kind,
      inputBus,
      label: opts.label,
      initialFreqs: opts.freqs,
      initialAmp: opts.amp,
      initialGate: opts.gate,
    });
    try {
      await ctrl.start();
    } catch (err) {
      // Best-effort cleanup on partial failure. The bus block is
      // burnt regardless — IdAllocator is monotonic — but a small
      // gap in the bus space is harmless.
      try {
        await ctrl.stop();
      } catch {
        /* swallow — original error is the meaningful one */
      }
      throw err;
    }
    this.synthsStore.update((list) => [...list, ctrl]);
    return ctrl;
  }

  async remove(synthId: string): Promise<void> {
    const ctrl = this.synthsStore.get().find((s) => s.synthId === synthId);
    if (!ctrl) return;
    try {
      await ctrl.stop();
    } finally {
      this.synthsStore.update((list) =>
        list.filter((s) => s.synthId !== synthId),
      );
    }
  }

  /** Stop every synth and empty the list. Run as part of the
   *  disconnect / re-init cleanup chain before `group.free()` so
   *  /n_free's land cleanly rather than racing the group teardown. */
  async clear(): Promise<void> {
    const list = this.synthsStore.get();
    this.synthsStore.set([]);
    await Promise.all(
      list.map(async (ctrl) => {
        try {
          await ctrl.stop();
        } catch (err) {
          console.warn(
            `[sc:synth-manager] stop ${ctrl.synthId} failed`,
            err,
          );
        }
      }),
    );
  }
}
