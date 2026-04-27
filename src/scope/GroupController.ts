/**
 * Owns the app's parent group inside scsynth's node tree. Everything
 * audio-related (clock, scopes, recorders) gets added as children
 * of this group — `/n_run` on the parent then pauses the whole
 * session at once, and `/g_freeAll + /n_free` cleans it up.
 *
 * The group is created **paused**: `ensureCreated()` bundles
 * `/g_new` with `/n_run groupId 0` so scsynth processes both
 * atomically. The clock synth subsequently /s_new'd as a child of a
 * paused group inherits that paused state — no /tr ever fires
 * before the user explicitly presses Start. The previous design
 * (synth-level pause via `/n_run` on the clock's own nodeId)
 * worked but pushed pause semantics down to the wrong layer; the
 * group is the right granularity since pause is supposed to freeze
 * everything in the session, not just the clock.
 *
 * Lifecycle:
 *   stopped → paused (via `ensureCreated` → /g_new + /n_run 0 bundle)
 *   paused ↔ running (`pause` / `resume` → /n_run 0|1)
 *   any → stopped (via `free` → /g_freeAll + /n_free)
 */

import {
  AddToHead,
  OSC,
  gFreeAll,
  gNewOne,
  nFree,
  nRunOne,
} from '@sc-app/server-commands';
import type { ReadonlyStore } from './reactiveStore';
import { createStore } from './reactiveStore';
import type { WorkerClient } from './WorkerClient';

export type GroupState = 'stopped' | 'running' | 'paused';

export class GroupController {
  private readonly stateStore = createStore<GroupState>('stopped');
  private created = false;

  constructor(
    private readonly client: WorkerClient,
    readonly groupId: number,
    private readonly targetId = 0,
    private readonly addAction: number = AddToHead,
  ) {}

  get state(): ReadonlyStore<GroupState> {
    return this.stateStore;
  }

  /** Idempotent — creates the group paused on first call. The
   *  `/g_new` and `/n_run 0` are sent in a single OSC.Bundle so
   *  scsynth never sees a control block where the group is
   *  running. Children added later (the clock synth, scopes,
   *  recorders) inherit the paused state until `resume()`. */
  async ensureCreated(): Promise<void> {
    if (this.created) return;
    await this.client.sendAndSync(
      new OSC.Bundle([
        gNewOne(this.groupId, this.addAction, this.targetId),
        nRunOne(this.groupId, 0),
      ]),
    );
    this.created = true;
    this.stateStore.set('paused');
  }

  async pause(): Promise<void> {
    if (!this.created) return;
    await this.client.sendAndSync(nRunOne(this.groupId, 0));
    this.stateStore.set('paused');
  }

  async resume(): Promise<void> {
    if (!this.created) return;
    await this.client.sendAndSync(nRunOne(this.groupId, 1));
    this.stateStore.set('running');
  }

  /** Frees all children, then the group itself. */
  async free(): Promise<void> {
    if (!this.created) return;
    await this.client.sendAndSync(gFreeAll(this.groupId));
    await this.client.sendAndSync(nFree(this.groupId));
    this.created = false;
    this.stateStore.set('stopped');
  }
}
