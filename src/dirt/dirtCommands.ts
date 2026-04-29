/**
 * Typed builders + reply addresses for SuperDirt's OSC API.
 *
 * Five public addresses — `/dirt/play`, `/dirt/hello`,
 * `/dirt/handshake`, `/dirt/setControlBus` — plus the matching reply
 * addresses. Built on `osc-js` for byte-level parity with everything
 * else in the app. Mirrors the patterns in
 * `@sc-app/server-commands/commands/*` but kept local until / unless
 * a second caller appears (see Phase 25 plan).
 */

import OSC from 'osc-js';
import type { DirtEventInput } from './types';

// ── Outgoing message builders ────────────────────────────────────────

/** `/dirt/play key1 val1 key2 val2 …` — SuperDirt's main entry point.
 *  Payload is a flat sequence of key/value pairs unpacked into an
 *  Event dictionary on the SC side (`SuperDirt.sc:315 event.putPairs`).
 *
 *  The conventional first key is `s` (sample bank name); add `n` to
 *  pick a specific buffer within that bank, plus any per-event modifier
 *  (`amp`, `cutoff`, `room`, `gain`, `speed`, `pan`, `cut`, …). The
 *  full parameter list lives in `superdirt/used-parameters.scd`. */
export function dirtPlay(event: DirtEventInput): OSC.Message {
  const args: Array<string | number> = [];
  for (const [k, v] of Object.entries(event)) {
    args.push(k, v);
  }
  return new OSC.Message('/dirt/play', ...args);
}

/** `/dirt/hello` — heartbeat. SuperDirt replies with
 *  `/dirt/hello/reply`. Used by `DirtClient.connect()` to confirm
 *  SuperDirt is actually listening on the configured UDP port before
 *  flipping `status` to `'alive'`. */
export function dirtHello(): OSC.Message {
  return new OSC.Message('/dirt/hello');
}

/** `/dirt/handshake` — capability query. Reply carries hostname,
 *  port, and the indices of SuperDirt's global control buses
 *  (cps, etc.). Not used by Phase 25a but the builder is here for
 *  symmetry; future phases may need the bus indices to drive cps
 *  externally. */
export function dirtHandshake(): OSC.Message {
  return new OSC.Message('/dirt/handshake');
}

/** `/dirt/setControlBus busIdx value` — set a global control bus by
 *  index. Bus indices are reported by `/dirt/handshake/reply`. */
export function dirtSetControlBus(idx: number, value: number): OSC.Message {
  return new OSC.Message('/dirt/setControlBus', idx, value);
}

// ── Reply addresses ──────────────────────────────────────────────────

export const DIRT_HELLO_REPLY = '/dirt/hello/reply';
export const DIRT_HANDSHAKE_REPLY = '/dirt/handshake/reply';
