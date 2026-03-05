import type {ScsynthStatus} from "@/types/stores";
import {ConnectionStatus} from "@/constants/osc";
import root from "@/lib/stores/root/selectors";
import {createSelector, type SliceSelector} from "@/lib/stores/utils";

const createScsynthSelector: SliceSelector<typeof root.scsynth> = (fn) =>
  createSelector(root.scsynth, fn);

function formatStatus(s: ScsynthStatus): string {
  return (
    `CPU: ${s.avgCpu.toFixed(1)}% / ${s.peakCpu.toFixed(1)}% | ` +
    `SR: ${s.sampleRate.toFixed(0)} Hz`
  );
}

export default {
  // state
  clientId: createScsynthSelector(s => s.clientId),
  options: createScsynthSelector(s => s.options),
  connectionStatus: createScsynthSelector(s => s.connectionStatus),
  status: createScsynthSelector(s => s.status),
  version: createScsynthSelector(s => s.version),

  // derived
  isConnected: createScsynthSelector(s => s.connectionStatus === ConnectionStatus.CONNECTED),
  isConnecting: createScsynthSelector(s => s.connectionStatus === ConnectionStatus.CONNECTING),
  address: createScsynthSelector(s => `${s.options.host}:${s.options.port}`),
  statusText: createScsynthSelector(s => formatStatus(s.status)),
};
