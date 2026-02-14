import type {ScsynthStatus} from "@/types/stores";
import {ConnectionStatus} from "@/constants/osc";
import root from "@/lib/stores/root/selectors";
import {createSelector} from "@/lib/stores/utils";

export const clientId = createSelector(root.scsynth, s => s.clientId);

export const connectionStatus = createSelector(root.scsynth, s => s.connectionStatus);

export const isConnected = createSelector(
  connectionStatus,
  s => s === ConnectionStatus.CONNECTED,
);

export const isConnecting = createSelector(
  connectionStatus,
  s => s === ConnectionStatus.CONNECTING,
);

export const options = createSelector(root.scsynth, s => s.options);

export const initialNodeId = createSelector(options, o => o.initialNodeId);

export const address = createSelector(options, o => `${o.host}:${o.port}`);

export const status = createSelector(root.scsynth, s => s.status);

function formatStatus(s: ScsynthStatus): string {
  return (
    `CPU: ${s.avgCpu.toFixed(1)}% / ${s.peakCpu.toFixed(1)}% | ` +
    `SR: ${s.sampleRate.toFixed(0)} Hz`
  );
}

export const statusText = createSelector(status, formatStatus);

export const version = createSelector(root.scsynth, s => s.version);

export default {clientId, connectionStatus, isConnected, isConnecting, options, initialNodeId, address, status, statusText, version};
