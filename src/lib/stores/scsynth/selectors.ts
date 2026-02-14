import type {RootState, ScsynthStatus} from "@/types/stores";
import {ConnectionStatus} from "@/constants/osc";

export const isConnected = (s: RootState) =>
  s.scsynth.connectionStatus === ConnectionStatus.CONNECTED;

export const isConnecting = (s: RootState) =>
  s.scsynth.connectionStatus === ConnectionStatus.CONNECTING;

export const options = (s: RootState) => s.scsynth.options;

export const initialNodeId = (s: RootState) => s.scsynth.options.initialNodeId;

export const address = (s: RootState) =>
  `${s.scsynth.options.host}:${s.scsynth.options.port}`;

function formatStatus(s: ScsynthStatus): string {
  return (
    `CPU: ${s.avgCpu.toFixed(1)}% / ${s.peakCpu.toFixed(1)}% | ` +
    `SR: ${s.sampleRate.toFixed(0)} Hz`
  );
}

export const statusText = (s: RootState) => formatStatus(s.scsynth.status);

export default {isConnected, isConnecting, options, initialNodeId, address, statusText};
