/**
 * Typed snapshot of scsynth's `/status.reply` plus the parser that
 * turns the worker's plain `{address, args}` POJO into it.
 *
 * `/status.reply` is polled on every heartbeat (see `AppShell`) and
 * surfaced in the dashboard footer.
 *
 * The parser is defensive against missing / off-type args: a
 * malformed reply just yields zeros rather than throwing, so a
 * future scsynth fork that returns an unexpected shape doesn't crash
 * the dashboard.
 *
 * Phase 39 hotfix: `/version.reply` parsing moved to the bridge.
 * The bridge captures it at boot via `version_handshake` and surfaces
 * it via `SessionInfo.scsynthVersion`; the frontend just consumes the
 * pre-parsed object. `ScsynthVersion` lives in `sessionBootstrap.ts`
 * (the source of truth for SessionInfo); `formatVersion` re-exported
 * here for the Footer.
 */

import type { ScsynthVersion } from '@/session/sessionBootstrap';
export type { ScsynthVersion } from '@/session/sessionBootstrap';

export interface ScsynthStatus {
  numUgens: number;
  numSynths: number;
  numGroups: number;
  numSynthDefs: number;
  /** Average CPU usage, percent. */
  avgCpu: number;
  /** Peak CPU usage observed since the last `/status` reply. */
  peakCpu: number;
  /** Configured rate (always integer). */
  nominalSampleRate: number;
  /** Hardware-measured rate. Drifts by 10s of ppm vs. nominal. */
  actualSampleRate: number;
}

interface ReplyLike {
  args: ReadonlyArray<unknown>;
}

/** `/status.reply unused numUGens numSynths numGroups numSynthDefs
 *   avgCpu peakCpu nominalSampleRate actualSampleRate`. args[0] is
 *   reserved (always 1). */
export function parseStatus(reply: ReplyLike): ScsynthStatus {
  const args = reply.args;
  return {
    numUgens: numericArg(args, 1),
    numSynths: numericArg(args, 2),
    numGroups: numericArg(args, 3),
    numSynthDefs: numericArg(args, 4),
    avgCpu: numericArg(args, 5),
    peakCpu: numericArg(args, 6),
    nominalSampleRate: numericArg(args, 7),
    actualSampleRate: numericArg(args, 8),
  };
}

/** "scsynth 3.13.0" — patch is concatenated as-is since SC reports it
 *  as a string already (".0", ".0-beta1", etc.). */
export function formatVersion(v: ScsynthVersion): string {
  return `${v.progName} ${v.major}.${v.minor}${v.patch}`;
}

function numericArg(
  args: ReadonlyArray<unknown>,
  i: number,
  fallback = 0,
): number {
  const v = args[i];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return fallback;
}
