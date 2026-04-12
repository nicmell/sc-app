import options from "../options";
import plugins from "../plugins";
import runtime from "../runtime";
import {combineReducers, createSlice, type CaseReducer} from "../utils";
import {SliceName, RootAction, ScsynthAction} from "@/constants/store";
import type {RootState, ScsynthStatus, ConnectionStatus} from "@/types/stores";
import {ConnectionStatus as Status, DEFAULT_CLIENT_ID, DEFAULT_STATUS, DEFAULT_VERSION} from "@/constants/osc";

const initialState: RootState = {
  isRunning: false,
  clientId: DEFAULT_CLIENT_ID,
  connectionStatus: Status.DISCONNECTED,
  serverStatus: DEFAULT_STATUS,
  serverVersion: DEFAULT_VERSION,
  options: options.getInitialState(),
  plugins: plugins.getInitialState(),
  runtime: runtime.getInitialState(),
};

export const rootSlice = createSlice({
  name: SliceName.ROOT,
  initialState,
  reducers: {
    [RootAction.SET_RUNNING]: (state, action: { payload: { isRunning: boolean } }) => {
      state.isRunning = action.payload.isRunning;
    },
    [ScsynthAction.SET_CLIENT]: (state, action: { payload: number }) => {
      state.clientId = action.payload;
    },
    [ScsynthAction.SET_CONNECTION_STATUS]: (state, action: { payload: ConnectionStatus }) => {
      state.connectionStatus = action.payload;
    },
    [ScsynthAction.SET_STATUS]: (state, action: { payload: ScsynthStatus }) => {
      state.serverStatus = action.payload;
    },
    [ScsynthAction.SET_VERSION]: (state, action: { payload: string }) => {
      state.serverVersion = action.payload;
    },
    [ScsynthAction.CLEAR_CLIENT]: (state) => {
      state.serverStatus = DEFAULT_STATUS;
      state.serverVersion = DEFAULT_VERSION;
    },
  },
  defaultReducer: combineReducers({
    options: options.reducer,
    plugins: plugins.reducer,
    runtime: runtime.reducer,
  }) as unknown as CaseReducer<RootState>
});
