import { useSyncExternalStore } from 'react';
import {
  formatVersion,
  type ScsynthStatus,
  type ScsynthVersion,
} from '@/scope/serverInfo';
import type { Store } from '@/scope/reactiveStore';
import './Footer.scss';

export interface FooterProps {
  /** Live `/status.reply` snapshot updated by the heartbeat. `null`
   *  until the first reply lands (~immediately after dashboard mount
   *  thanks to the eager first heartbeat tick). */
  status: Store<ScsynthStatus | null>;
  /** One-shot `/version.reply` captured at session bring-up. `null`
   *  if scsynth didn't reply in time (informational only). */
  version: ScsynthVersion | null;
}

/**
 * Persistent footer at the bottom of the dashboard. Left side:
 * scsynth version (static per session). Right side: live /status
 * snapshot — synth/group/def counts, CPU, sample rate.
 */
export function Footer({ status, version }: FooterProps) {
  const snapshot = useSyncExternalStore(
    (cb) => status.subscribe(cb),
    () => status.get(),
  );

  const versionLabel = version ? formatVersion(version) : 'scsynth (version unknown)';

  return (
    <footer className="dashboard-footer status">
      <span className="version">{versionLabel}</span>
      <span className="sep">·</span>
      <FooterStatus snapshot={snapshot} />
    </footer>
  );
}

function FooterStatus({ snapshot }: { snapshot: ScsynthStatus | null }) {
  if (!snapshot) {
    return <span className="metric placeholder">awaiting /status…</span>;
  }
  const cpuAvg = snapshot.avgCpu.toFixed(1);
  const cpuPeak = snapshot.peakCpu.toFixed(1);
  const sr = Math.round(snapshot.nominalSampleRate);
  return (
    <>
      <span className="metric" title={`avg ${cpuAvg}%, peak ${cpuPeak}%`}>
        CPU {cpuAvg} / {cpuPeak}%
      </span>
      <span className="sep">·</span>
      <span className="metric">
        {snapshot.numSynths} synth{snapshot.numSynths === 1 ? '' : 's'}
      </span>
      <span className="sep">·</span>
      <span className="metric">
        {snapshot.numGroups} group{snapshot.numGroups === 1 ? '' : 's'}
      </span>
      <span className="sep">·</span>
      <span className="metric">{snapshot.numSynthDefs} defs</span>
      <span className="sep">·</span>
      <span
        className="metric"
        title={`actual ${snapshot.actualSampleRate.toFixed(2)} Hz`}
      >
        {sr} Hz
      </span>
    </>
  );
}
