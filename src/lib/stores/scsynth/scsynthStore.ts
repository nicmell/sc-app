import type {ScsynthOptions, ScsynthState, ScsynthStatus} from "@/types/stores";
import type {ConnectionStatus} from "@/types/stores";
import {ConnectionStatus as Status, DEFAULT_CLIENT_ID, DEFAULT_OPTIONS, DEFAULT_STATUS, DEFAULT_VERSION} from "@/constants/osc";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, ScsynthAction} from "@/constants/store";

const initialState: ScsynthState = {
  clientId: DEFAULT_CLIENT_ID,
  options: DEFAULT_OPTIONS,
  connectionStatus: Status.DISCONNECTED,
  status: DEFAULT_STATUS,
  version: DEFAULT_VERSION,
};

const slice = createSlice({
  name: SliceName.SCSYNTH,
  initialState,
  reducers: {
    [ScsynthAction.SET_CLIENT]: (state, action: { payload: number }) => {
      state.clientId = action.payload;
    },
    [ScsynthAction.SET_OPTIONS]: (state, action: { payload: Partial<ScsynthOptions> }) => {
      Object.assign(state.options, action.payload);
    },
    [ScsynthAction.SET_CONNECTION_STATUS]: (state, action: { payload: ConnectionStatus }) => {
      state.connectionStatus = action.payload;
    },
    [ScsynthAction.SET_STATUS]: (state, action: { payload: ScsynthStatus }) => {
      state.status = action.payload;
    },
    [ScsynthAction.SET_VERSION]: (state, action: { payload: string }) => {
      state.version = action.payload;
    },
    [ScsynthAction.CLEAR_CLIENT]: (state) => {
      state.status = DEFAULT_STATUS;
      state.version = DEFAULT_VERSION;
    },
  },
});

export const scsynthInitialState = slice.initialState;
export const scsynthReducer = slice.reducer;
export const {setClient, setOptions, setConnectionStatus, setStatus, setVersion, clearClient} = slice.actions;
export type ScsynthAction = ReturnType<
    | typeof setClient
    | typeof setOptions
    | typeof setConnectionStatus
    | typeof setStatus
    | typeof setVersion
    | typeof clearClient
>;
