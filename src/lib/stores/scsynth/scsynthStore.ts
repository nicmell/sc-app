import type {ScsynthOptions, ScsynthState, ScsynthStatus} from "@/types/stores";
import type {ConnectionStatus} from "@/types/stores";
import {ConnectionStatus as Status, DEFAULT_CLIENT_ID, DEFAULT_OPTIONS, DEFAULT_STATUS, DEFAULT_VERSION} from "@/constants/store";
import {createSlice, type InferAction} from "@/lib/stores/utils";

const initialState: ScsynthState = {
  clientId: DEFAULT_CLIENT_ID,
  options: DEFAULT_OPTIONS,
  connectionStatus: Status.DISCONNECTED,
  status: DEFAULT_STATUS,
  version: DEFAULT_VERSION,
};

const slice = createSlice({
  name: "scsynth",
  initialState,
  reducers: {
    setClient: (state, action: { payload: number }) => {
      state.clientId = action.payload;
    },
    setOptions: (state, action: { payload: Partial<ScsynthOptions> }) => {
      Object.assign(state.options, action.payload);
    },
    setConnectionStatus: (state, action: { payload: ConnectionStatus }) => {
      state.connectionStatus = action.payload;
    },
    setStatus: (state, action: { payload: ScsynthStatus }) => {
      state.status = action.payload;
    },
    setVersion: (state, action: { payload: string }) => {
      state.version = action.payload;
    },
    clearClient: (state) => {
      state.status = DEFAULT_STATUS;
      state.version = DEFAULT_VERSION;
    },
  },
});

export const scsynthInitialState = slice.initialState;
export const scsynthReducer = slice.reducer;
export const {setClient, setOptions, setConnectionStatus, setStatus, setVersion, clearClient} = slice.actions;
export type ScsynthAction = InferAction<typeof slice>;
