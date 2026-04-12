import type {RootState, ScsynthStatus} from "@/types/stores";
import {ConnectionStatus} from "@/constants/osc";
import {createSelector} from "@/lib/stores/utils";

function formatStatus(s: ScsynthStatus): string {
  return (
    `CPU: ${s.avgCpu.toFixed(1)}% / ${s.peakCpu.toFixed(1)}% | ` +
    `SR: ${s.sampleRate.toFixed(0)} Hz`
  );
}

const self = (s: RootState) => s;

export default {
  // root state
  isRunning: (s: RootState) => s.isRunning,
  options: (s: RootState) => s.options,
  layout: (s: RootState) => s.runtime.layout,
  plugins: (s: RootState) => s.plugins,
  runtime: (s: RootState) => s.runtime,

  // scsynth state
  clientId: (s: RootState) => s.clientId,
  connectionStatus: (s: RootState) => s.connectionStatus,
  serverStatus: (s: RootState) => s.serverStatus,
  serverVersion: (s: RootState) => s.serverVersion,

  // scsynth derived
  isConnected: createSelector(self, s => s.connectionStatus === ConnectionStatus.CONNECTED),
  isConnecting: createSelector(self, s => s.connectionStatus === ConnectionStatus.CONNECTING),
  statusText: createSelector(self, s => formatStatus(s.serverStatus)),
};
