/**
 * Multi-scope orchestrator. Owns the list of live `ScopeController`s
 * and the bus / buffer / node id allocators they share.
 *
 * Buses are auto-allocated per scope: `add({ channels, … })` pulls a
 * contiguous block of `channels` ids via `IdAllocator.nextBlock(n)`,
 * so each scope has a private input bus pair and there's no risk of
 * two scopes colliding on the same bus number.
 *
 * What's shared across all scopes:
 *  - the parent group, the global clock + clockBus,
 *  - the scope worker (one tick-driven /b_getn loop multiplexed by
 *    `scopeId`), and
 *  - the compiled `scopeTap{N}ch` SynthDef bytes (cached per channel).
 *
 * What's per-scope:
 *  - `inputBus` block, `bufnum`, scope synth nodeId, optional source
 *    synth, and worker subscription entry.
 */

import type { ClockController } from './ClockController';
import type { GroupController } from './GroupController';
import type { IdAllocator } from './IdAllocator';
import { createStore, type ReadonlyStore } from './reactiveStore';
import {
  ScopeController,
  type ScopeSourceSpec,
} from './ScopeController';
import type { SynthDefRegistry } from './SynthDefRegistry';
import type { WorkerClient } from './WorkerClient';

export interface ScopeManagerOptions {
  client: WorkerClient;
  clock: ClockController;
  group: GroupController;
  registry: SynthDefRegistry;
  ids: { node: IdAllocator; buffer: IdAllocator; bus: IdAllocator };
}

export interface AddScopeOptions {
  channels: 1 | 2;
  label?: string;
  /** Optional bundled signal source — when set, the manager wires a
   *  `testTone` (mono) or `testToneStereo` synth onto this scope's
   *  freshly-allocated bus block so the new scope shows a recognisable
   *  signal immediately. Use `'none'` to leave the bus unsourced. */
  source?: ScopeSourceSpec | 'none';
}

function freshScopeId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `scope-${Math.random().toString(36).slice(2, 10)}`;
}

export class ScopeManager {
  private readonly client: WorkerClient;
  private readonly clock: ClockController;
  private readonly group: GroupController;
  private readonly registry: SynthDefRegistry;
  private readonly ids: ScopeManagerOptions['ids'];

  private readonly scopesStore = createStore<ScopeController[]>([]);

  constructor(opts: ScopeManagerOptions) {
    this.client = opts.client;
    this.clock = opts.clock;
    this.group = opts.group;
    this.registry = opts.registry;
    this.ids = opts.ids;
  }

  /** Live list of running scopes. UI subscribes and re-renders on
   *  add / remove. */
  get scopes(): ReadonlyStore<ScopeController[]> {
    return this.scopesStore;
  }

  /** Spin up a new scope. Allocates a fresh `channels`-wide bus block,
   *  starts the (optional) source + scope synths, and appends the
   *  controller to the shared list. */
  async add(opts: AddScopeOptions): Promise<ScopeController> {
    const inputBus = this.ids.bus.nextBlock(opts.channels);
    const scopeId = freshScopeId();
    const source =
      opts.source === 'none' || opts.source === undefined
        ? undefined
        : opts.source;
    const ctrl = new ScopeController({
      client: this.client,
      clock: this.clock,
      group: this.group,
      registry: this.registry,
      ids: { node: this.ids.node, buffer: this.ids.buffer },
      inputBus,
      channels: opts.channels,
      scopeId,
      label: opts.label,
      source,
    });
    try {
      await ctrl.start();
    } catch (err) {
      // Best-effort: if start failed mid-way the controller may still
      // hold partial server-side state. Try to stop cleanly so we
      // don't leak nodes. Bus ids are intentionally never recycled
      // (the IdAllocator is monotonic) — a failed add just burns a
      // small block, which is fine.
      try {
        await ctrl.stop();
      } catch {
        /* swallow — original error is the meaningful one */
      }
      throw err;
    }
    this.scopesStore.update((list) => [...list, ctrl]);
    return ctrl;
  }

  /** Stop and remove the matching scope. Silent no-op if not found
   *  (already removed elsewhere). */
  async remove(scopeId: string): Promise<void> {
    const ctrl = this.scopesStore.get().find((s) => s.scopeId === scopeId);
    if (!ctrl) return;
    try {
      await ctrl.stop();
    } finally {
      this.scopesStore.update((list) =>
        list.filter((s) => s.scopeId !== scopeId),
      );
    }
  }

  /** Stop every scope and empty the list. Run as part of the
   *  disconnect sequence before `group.free()` — the group cleanup
   *  would otherwise free the synths under us and leave dangling
   *  worker subscriptions / nFree errors in the log. */
  async clear(): Promise<void> {
    const list = this.scopesStore.get();
    this.scopesStore.set([]);
    await Promise.all(
      list.map(async (ctrl) => {
        try {
          await ctrl.stop();
        } catch (err) {
          console.warn(`[sc:scope-manager] stop ${ctrl.scopeId} failed`, err);
        }
      }),
    );
  }
}
