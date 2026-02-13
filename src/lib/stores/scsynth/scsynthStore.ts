import type {StateCreator} from "zustand";
import type {ScsynthState} from "@/types/stores";
import {ConnectionStatus, DEFAULT_CLIENT_ID, DEFAULT_OPTIONS, DEFAULT_STATUS, DEFAULT_VERSION} from "@/constants/store";

export const scsynthSlice: StateCreator<ScsynthState> = (set) => ({
  clientId: DEFAULT_CLIENT_ID,
  options: DEFAULT_OPTIONS,
  connectionStatus: ConnectionStatus.DISCONNECTED,
  status: DEFAULT_STATUS,
  version: DEFAULT_VERSION,
  setClient: (clientId) => set({clientId}),
  setOptions: (opts) => set((state) => ({options: {...state.options, ...opts}})),
  setConnectionStatus: (connectionStatus) => set({connectionStatus}),
  setStatus: (status) => set({status}),
  setVersion: (version) => set({version}),
  clearClient: () => set({status: DEFAULT_STATUS, version: DEFAULT_VERSION }),
});
