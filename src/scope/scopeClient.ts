/**
 * Typed builders + reply parsers for the Phase 31 SHM scope-buffer
 * OSC surface. The scope buffer index allocator lives in sclang
 * (see `scripts/sc-app-superdirt-startup.scd`'s `\scAppScope*`
 * OSCdefs); this module is the matching frontend wire format.
 *
 * Despite the name "scope", this module is also used by the
 * recording path — recordings consume the same SHM-fed
 * `bufferChunk` event stream as scopes after Phase 31. The
 * `/scope/*` prefix is just SC's vocabulary (scope_buffer is the
 * Boost.Interprocess shared-memory primitive); the sc-app
 * consumer kind is irrelevant.
 *
 * Three addresses:
 *
 *   - `/scope/hello`     — frontend → sclang. Empty args. Replies
 *                          with `/scope/info`.
 *   - `/scope/allocate`  — frontend → sclang. Empty args. Replies
 *                          with either `/scope/allocated <idx>`
 *                          on success, or `/scope/allocateFailed
 *                          <reason>` when the
 *                          StackNumberAllocator(0, 127) is exhausted.
 *   - `/scope/free <idx>` — frontend → sclang. No reply
 *                           (fire-and-forget).
 *
 * The bridge routes the prefix to sclang's UDP port via the
 * `/scope → 127.0.0.1:57120` entry in `config.json`.
 */

import OSC from 'osc-js';
import type { OscArg } from '@sc-app/server-commands';

// ── Outgoing message builders ────────────────────────────────────────

export function scopeHello(): OSC.Message {
  return new OSC.Message('/scope/hello');
}

export function scopeAllocate(): OSC.Message {
  return new OSC.Message('/scope/allocate');
}

export function scopeFree(idx: number): OSC.Message {
  if (!Number.isInteger(idx) || idx < 0) {
    throw new Error(`scopeFree: idx must be a non-negative integer, got ${idx}`);
  }
  return new OSC.Message('/scope/free', idx);
}

// ── Reply addresses ──────────────────────────────────────────────────

export const SCOPE_INFO_REPLY = '/scope/info';
export const SCOPE_ALLOCATED_REPLY = '/scope/allocated';
export const SCOPE_ALLOCATE_FAILED_REPLY = '/scope/allocateFailed';

// ── Reply parsers ────────────────────────────────────────────────────

/** Decoded `/scope/info` payload. */
export interface ScopeInfo {
  /** Total scope buffer slots scsynth allocated at startup. Default
   *  128 (per `server_shm.hpp` `num_scope_buffers`). Informational —
   *  the frontend mainly cares about whether allocation succeeds. */
  numScopeBuffers: number;
}

export function parseScopeInfo(args: readonly OscArg[]): ScopeInfo {
  const map = new Map<string, OscArg>();
  for (let i = 0; i + 1 < args.length; i += 2) {
    const key = args[i];
    if (typeof key !== 'string') continue;
    map.set(key, args[i + 1]);
  }
  const num = (key: string): number => {
    const v = map.get(key);
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new Error(
        `/scope/info: missing or non-numeric "${key}" (got ${JSON.stringify(v)})`,
      );
    }
    return v;
  };
  return {
    numScopeBuffers: num('numScopeBuffers'),
  };
}

/** Decoded `/scope/allocated` payload — just a single int index. */
export interface ScopeAllocated {
  index: number;
}

export function parseScopeAllocated(args: readonly OscArg[]): ScopeAllocated {
  const v = args[0];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
    throw new Error(
      `/scope/allocated: expected non-negative int index, got ${JSON.stringify(v)}`,
    );
  }
  return { index: v };
}

/** Decoded `/scope/allocateFailed` payload — error string. */
export interface ScopeAllocateFailed {
  reason: string;
}

export function parseScopeAllocateFailed(
  args: readonly OscArg[],
): ScopeAllocateFailed {
  const v = args[0];
  return { reason: typeof v === 'string' ? v : 'unknown reason' };
}

// ── HTTP probe ───────────────────────────────────────────────────────

/** Bridge-side probe result for whether the SHM segment is reachable
 *  on this host. Returned by `GET /api/scope/probe`; cached once at
 *  session attach. */
export interface ScopeShmProbe {
  available: boolean;
  path: string | null;
  error: string | null;
}

/** One-shot HTTP fetch for the bridge's `/api/scope/probe` endpoint.
 *  Returns `{ available: false, ... }` on any failure (not just on a
 *  bridge-reported unavailable response); callers should treat
 *  unavailable as a recoverable "no SHM, fall back" condition. */
export async function probeScopeShm(): Promise<ScopeShmProbe> {
  try {
    const res = await fetch('/api/scope/probe');
    if (!res.ok) {
      return {
        available: false,
        path: null,
        error: `HTTP ${res.status}`,
      };
    }
    const json = (await res.json()) as ScopeShmProbe;
    return json;
  } catch (err) {
    return {
      available: false,
      path: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
