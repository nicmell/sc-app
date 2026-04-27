/**
 * In-memory record of which SynthDefs have been loaded into scsynth
 * during this session. Idempotent `ensureLoaded` so repeated calls
 * for the same name are free.
 *
 * The load itself uses the atomic `/d_recv` + embedded `/sync`
 * pattern: the `/sync` is packaged inside `/d_recv`'s `completionMsg`
 * field so the server runs it exactly *after* the synthdef is
 * installed — no race against a separate `/sync` command.
 */

import { dRecv, encode, sync, Fail } from '@sc-app/server-commands';
import type OSC from 'osc-js';
import type { WorkerClient } from './WorkerClient';
import type { OscReply } from './workerProtocol';

export class SynthDefRegistry {
  private readonly loaded = new Set<string>();
  private readonly inFlight = new Map<string, Promise<void>>();

  constructor(private readonly client: WorkerClient) {}

  isLoaded(name: string): boolean {
    return this.loaded.has(name);
  }

  /**
   * Upload `bytes` as a SynthDef named `name`. No-op if already loaded.
   * Multiple concurrent callers for the same name share one request.
   */
  async ensureLoaded(name: string, bytes: Uint8Array): Promise<void> {
    if (this.loaded.has(name)) return;

    const pending = this.inFlight.get(name);
    if (pending) return pending;

    const task = this.upload(name, bytes);
    this.inFlight.set(name, task);
    try {
      await task;
      this.loaded.add(name);
    } finally {
      this.inFlight.delete(name);
    }
  }

  private async upload(name: string, bytes: Uint8Array): Promise<void> {
    // If `/d_recv` fails, the server replies `/fail` and does *not* run
    // the embedded `/sync` — so `sendCommandAndAwaitSync` would just
    // time out. Race the handshake against a fail watcher so we fail
    // fast with a useful message.
    const failPromise = new Promise<never>((_, reject) => {
      const off = this.client.onReply((reply: OscReply) => {
        if (
          reply.address === Fail.address &&
          Fail.commandAddress(reply as unknown as OSC.Message) === '/d_recv'
        ) {
          off();
          reject(
            new Error(
              `scsynth rejected SynthDef "${name}": ${Fail.error(
                reply as unknown as OSC.Message,
              )}`,
            ),
          );
        }
      });
    });

    const syncPromise = this.client.sendCommandAndAwaitSync((syncId) =>
      dRecv(bytes, encode(sync(syncId))),
    );

    await Promise.race([syncPromise, failPromise]);
  }
}
