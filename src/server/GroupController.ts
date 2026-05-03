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
  AddToTail,
  OSC,
  gFreeAll,
  gNewOne,
  inFuture,
  nFree,
  nRunOne,
  sync,
} from '@sc-app/server-commands';
import type { ReadonlyStore } from '@/util/reactiveStore';
import { createStore } from '@/util/reactiveStore';
import type { WorkerClient } from '@/server/WorkerClient';

export type GroupState = 'stopped' | 'running' | 'paused';

export class GroupController {
  private readonly stateStore = createStore<GroupState>('stopped');
  private created = false;

  constructor(
    private readonly client: WorkerClient,
    readonly groupId: number,
    private readonly targetId = 0,
    // AddToTail (not AddToHead) of the root group: sc-app's parent
    // group sits AFTER any pre-existing default groups belonging to
    // other clients (notably sclang at clientID=0 hosting SuperDirt
    // in Phase 26 deployments). Without this, sc-app's tap synths
    // process before SuperDirt's orbits have written to their output
    // buses, and the tap reads silence even though the audio engine
    // is shipping data to the speakers via dirtMonitor.
    //
    // Pre-Phase-26 single-client deployments are unaffected:
    // AddToTail of an empty root puts the group at index 0 anyway.
    private readonly addAction: number = AddToTail,
  ) {}

  get state(): ReadonlyStore<GroupState> {
    return this.stateStore;
  }

  /** Idempotent — creates the group paused on first call. The
   *  `/g_new` and `/n_run 0` are sent in a single OSC.Bundle so
   *  scsynth never sees a control block where the group is
   *  running. Children added later (the clock synth, scopes,
   *  recorders) inherit the paused state until `resume()`.
   *
   *  Timetag is `Date.now() + 50 ms`, not implicit-now: scsynth's OSC
   *  scheduler runs ~10–20 ms ahead of wall clock (audio-callback
   *  calibrated), so a "now" timetag lands in scsynth's past after
   *  delivery and logs `late 0.0XX`. 50 ms clears the drift with
   *  margin while staying short enough to be invisible at connect
   *  time.
   *
   *  `/sync` is embedded INSIDE the bundle (not sent separately) so
   *  the matching `/synced` only fires once the bundle's timetag has
   *  elapsed and the group really exists. A standalone `/sync` would
   *  race-complete immediately and let the next `/s_new` (the clock)
   *  hit a not-yet-created group. */
  async ensureCreated(): Promise<void> {
    if (this.created) return;
    await this.client.sendCommandAndAwaitSync((syncId) =>
      new OSC.Bundle(
        [
          gNewOne(this.groupId, this.addAction, this.targetId),
          nRunOne(this.groupId, 0),
          sync(syncId),
        ],
        inFuture(50),
      ),
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
