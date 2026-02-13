import type {RootState, ScsynthStatus} from "@/types/stores";
import {ConnectionStatus} from "@/constants/osc";

export const selectIsConnected = (s: RootState) =>
  s.scsynth.connectionStatus === ConnectionStatus.CONNECTED;

export const selectIsConnecting = (s: RootState) =>
  s.scsynth.connectionStatus === ConnectionStatus.CONNECTING;

export const selectScsynthOptions = (s: RootState) => s.scsynth.options;

export const selectInitialNodeId = (s: RootState) => s.scsynth.options.initialNodeId;

export const selectAddress = (s: RootState) =>
  `${s.scsynth.options.host}:${s.scsynth.options.port}`;

function formatStatus(s: ScsynthStatus): string {
  return (
    `CPU: ${s.avgCpu.toFixed(1)}% / ${s.peakCpu.toFixed(1)}% | ` +
    `SR: ${s.sampleRate.toFixed(0)} Hz`
  );
}

export const selectStatusText = (s: RootState) => formatStatus(s.scsynth.status);
