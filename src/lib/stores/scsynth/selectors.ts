import type {ScsynthStatus} from "@/types/stores";
import {ConnectionStatus} from "@/constants/osc";
import root from "@/lib/stores/root/selectors";
import {createSelector} from "@/lib/stores/utils";

function formatStatus(s: ScsynthStatus): string {
  return (
    `CPU: ${s.avgCpu.toFixed(1)}% / ${s.peakCpu.toFixed(1)}% | ` +
    `SR: ${s.sampleRate.toFixed(0)} Hz`
  );
}

const selectors = {
  clientId: createSelector(root.scsynth, s => s.clientId),
  connectionStatus: createSelector(root.scsynth, s => s.connectionStatus),
  isConnected: createSelector(root.scsynth, s => s.connectionStatus === ConnectionStatus.CONNECTED),
  isConnecting: createSelector(root.scsynth, s => s.connectionStatus === ConnectionStatus.CONNECTING),
  options: createSelector(root.scsynth, s => s.options),
  initialNodeId: createSelector(root.scsynth, s => s.options.initialNodeId),
  address: createSelector(root.scsynth, s => `${s.options.host}:${s.options.port}`),
  status: createSelector(root.scsynth, s => s.status),
  statusText: createSelector(root.scsynth, s => formatStatus(s.status)),
  version: createSelector(root.scsynth, s => s.version),
} as const;

export const {clientId, connectionStatus, isConnected, isConnecting, options, initialNodeId, address, status, statusText, version} = selectors;
export default selectors;
