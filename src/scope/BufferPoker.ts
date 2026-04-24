/**
 * One-shot `/b_getn` helper: send the read, await the matching
 * `/b_setn` reply, hand back a `Float32Array`.
 *
 * scsynth correlates `/b_setn` replies to `/b_getn` requests by
 * bufnum only — there's no request id. If two reads are in flight
 * against the same buffer, we can't tell which reply belongs to
 * which. The poker serialises per-bufnum: a second `poke()` for
 * the same bufnum shares the first one's in-flight promise.
 *
 * Main-thread use only — Phase 8's tick-driven chunk loop runs in
 * the worker and uses its own reply-matching path.
 */

import type OSC from 'osc-js';
import { BSetnReply, bGetn } from '@sc-app/server-commands';
import type { WorkerClient } from './WorkerClient';

const DEFAULT_TIMEOUT_MS = 2000;

export class BufferPoker {
  private readonly inFlight = new Map<number, Promise<Float32Array>>();

  constructor(private readonly client: WorkerClient) {}

  poke(
    bufnum: number,
    start: number,
    count: number,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<Float32Array> {
    const existing = this.inFlight.get(bufnum);
    if (existing) return existing;

    const task = this.doPoke(bufnum, start, count, timeoutMs);
    this.inFlight.set(bufnum, task);
    task.finally(() => {
      if (this.inFlight.get(bufnum) === task) {
        this.inFlight.delete(bufnum);
      }
    });
    return task;
  }

  private async doPoke(
    bufnum: number,
    start: number,
    count: number,
    timeoutMs: number,
  ): Promise<Float32Array> {
    const reply = await this.client.sendAndAwaitReply(
      bGetn(bufnum, start, count),
      (r) => r.address === BSetnReply.address && r.args[0] === bufnum,
      timeoutMs,
    );
    return BSetnReply.samples(reply as unknown as OSC.Message);
  }
}
