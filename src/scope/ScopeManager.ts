/**
 * Multi-scope orchestrator. Owns the list of live `ScopeController`s
 * and the buffer / node id allocators they share.
 *
 * The caller supplies `inputBus` per add — same model as
 * `RecordingManager`. Synth-side bus allocation lives in
 * `SynthManager`; scopes are pure consumers that read whatever bus
 * the user types in.
 *
 * Shared across all scopes: parent group, global clock + clockBus,
 * OSC worker (one tick-driven /b_getn loop multiplexed by
 * `scopeId`), and the compiled `scopeTap{N}ch_{chunkSize}` SynthDef
 * bytes.
 */

import type { ClockController } from '@/clock/ClockController';
import type { GroupController } from '@/server/GroupController';
import type { IdAllocator } from '@/server/IdAllocator';
import { createStore, type ReadonlyStore } from '@/util/reactiveStore';
import { ScopeController } from './ScopeController';
import type { SynthDefRegistry } from '@/server/SynthDefRegistry';
import type { WorkerClient } from '@/server/WorkerClient';

export interface ScopeManagerOptions {
  client: WorkerClient;
  clock: ClockController;
  group: GroupController;
  registry: SynthDefRegistry;
  ids: { node: IdAllocator; buffer: IdAllocator };
}

export interface AddScopeOptions {
  /** First audio bus index in the contiguous block to read. The
   *  user types this in the toolbar; typically copy-pasted from a
   *  Synths panel card. */
  inputBus: number;
  channels: 1 | 2;
  label?: string;
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

  /** Spin up a new scope on the caller-supplied `inputBus`. Starts
   *  the scope synth and registers its worker subscription. */
  async add(opts: AddScopeOptions): Promise<ScopeController> {
    const scopeId = freshScopeId();
    const ctrl = new ScopeController({
      client: this.client,
      clock: this.clock,
      group: this.group,
      registry: this.registry,
      ids: { node: this.ids.node, buffer: this.ids.buffer },
      inputBus: opts.inputBus,
      channels: opts.channels,
      scopeId,
      label: opts.label,
    });
    try {
      await ctrl.start();
    } catch (err) {
      // Best-effort: if start failed mid-way the controller may
      // still hold partial server-side state. Try to stop cleanly.
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
