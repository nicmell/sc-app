/**
 * Typed snapshots of scsynth's `/status.reply` and `/version.reply`,
 * plus the parsers that turn the worker's plain `{address, args}`
 * POJOs into them.
 *
 * `/status.reply` is polled on every heartbeat (see `AppShell`) and
 * surfaced in the dashboard footer. `/version.reply` is fetched once
 * per session (in `setupDashboard`) — scsynth's version doesn't
 * change while we're connected.
 *
 * Both parsers are defensive against missing / off-type args: a
 * malformed reply just yields zeros / empty strings rather than
 * throwing, so a future scsynth fork that returns an unexpected
 * shape doesn't crash the dashboard.
 */

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

export interface ScsynthVersion {
  /** Typically `"scsynth"`. */
  progName: string;
  major: number;
  minor: number;
  /** SC reports patch as a string (e.g. `".0"`); preserved verbatim. */
  patch: string;
  branch: string;
  commitHash: string;
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

/** `/version.reply progName major minor patch branch commitHash`. */
export function parseVersion(reply: ReplyLike): ScsynthVersion {
  const args = reply.args;
  return {
    progName: stringArg(args, 0, 'scsynth'),
    major: numericArg(args, 1),
    minor: numericArg(args, 2),
    patch: stringArg(args, 3, ''),
    branch: stringArg(args, 4, ''),
    commitHash: stringArg(args, 5, ''),
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

function stringArg(
  args: ReadonlyArray<unknown>,
  i: number,
  fallback = '',
): string {
  const v = args[i];
  return typeof v === 'string' ? v : fallback;
}
