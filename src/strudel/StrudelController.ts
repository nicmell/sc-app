import type { DirtClient } from '@/dirt/DirtClient';
import type { GroupState } from '@/server/GroupController';
import type { ReadonlyStore } from '@/util/reactiveStore';

/** Milliseconds added on top of Strudel's own ~100ms scheduler
 *  latency. Same constant as sequencerPump.ts — keeps the bundle
 *  timetag positive on sclang's scheduling clock. */
const SUPERDIRT_SAFETY_LOOKAHEAD_MS = 200;

/** Minimal slice of `ClockController` the Strudel controller reads.
 *  Only `tick0Ms` is needed — the BPM control owns the tempo, and
 *  Strudel doesn't care about chunkSize/sampleRate/tickRate (its
 *  Cyclist uses its own cps). */
export interface StrudelClockLike {
  readonly tick0Ms: number | null;
}

export interface StrudelControllerOptions {
  dirtClient: DirtClient;
  /** Anchor for phase-locking Strudel's scheduler to scsynth's
   *  audio clock. `getTime()` returns seconds since the shared
   *  clock's first tick, so cycle 0 starts at audio frame 0. */
  clock: StrudelClockLike;
  /** Reactive group state. When `paused`, the parent group's tap
   *  synths and Dirt orbits keep their audio routing but the user
   *  has explicitly stopped — so we drop Strudel emissions to
   *  match the sequencer's pause semantics. */
  groupState: ReadonlyStore<GroupState>;
}

/** Signature of Strudel's defaultOutput callback. The Cyclist
 *  scheduler calls it once per Hap onset:
 *  - hap         — pattern event (hap.value holds SuperDirt params)
 *  - _offsetSecs — seconds from now until onset
 *  - _durSecs    — event duration in seconds
 *  - _cps        — current cycles-per-second
 *  - absTimeSecs — absolute time (in `getTime()` units) when the
 *                  event should play. Under our phase-locked
 *                  setup, this is seconds since `tick0Ms`. */
export type StrudelOutputFn = (
  hap: { value: Record<string, unknown> },
  _offsetSecs: number,
  _durSecs: number,
  _cps: number,
  absTimeSecs: number,
) => void;

/** Controller that owns the time-source + OSC sink for the Strudel
 *  REPL. The StrudelPanel passes both `getTime` and `defaultOutput`
 *  into StrudelMirror so the inner Cyclist and our timetag math
 *  agree on the audio-clock origin.
 *
 *  Constructed in setupDashboard alongside dirtClient. Disposed
 *  by teardownServerState before dirtClient. */
export class StrudelController {
  private readonly dirtClient: DirtClient;
  private readonly clock: StrudelClockLike;
  private readonly groupState: ReadonlyStore<GroupState>;
  private disposed = false;

  /** Time source for StrudelMirror's Cyclist scheduler. Returns
   *  seconds since the shared clock's first tick (`tick0Ms`).
   *  Before the clock anchors, returns 0 — but the Run button is
   *  gated on `clockReady` so the scheduler never starts in that
   *  state. */
  readonly getTime: () => number;

  readonly defaultOutput: StrudelOutputFn;

  constructor({ dirtClient, clock, groupState }: StrudelControllerOptions) {
    this.dirtClient = dirtClient;
    this.clock = clock;
    this.groupState = groupState;

    this.getTime = () => {
      const t0 = this.clock.tick0Ms;
      if (t0 === null) return 0;
      return (Date.now() - t0) / 1000;
    };

    this.defaultOutput = (hap, _offset, _dur, _cps, absTimeSecs) => {
      if (this.disposed) return;
      // Drop emissions while the parent group is paused — same
      // contract the sequencer's worker pump observes.
      if (this.groupState.get() === 'paused') return;

      const t0 = this.clock.tick0Ms;
      // Should never happen — Run is gated on clockReady — but
      // guard anyway so a stale tick0Ms during teardown can't
      // produce a NaN timetag.
      if (t0 === null) return;

      const value = hap.value;
      if (!value || typeof value !== 'object') return;

      // Filter to string/number only — Strudel may attach internal
      // state (Fraction objects, booleans, …) to hap.value that
      // SuperDirt doesn't understand.
      const event: Record<string, string | number> = {};
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'string' || typeof v === 'number') {
          event[k] = v;
        }
      }

      if (!event['s']) return; // no sample → nothing for SuperDirt

      // absTimeSecs is in audio-clock seconds (since tick0Ms). To
      // produce a wall-clock NTP timetag, re-anchor to wall clock
      // and add the SuperDirt safety lookahead.
      const timetag =
        t0 + Math.round(absTimeSecs * 1000) + SUPERDIRT_SAFETY_LOOKAHEAD_MS;
      this.dirtClient.playAtTimetag(event, timetag);
    };
  }

  dispose(): void {
    this.disposed = true;
  }
}
