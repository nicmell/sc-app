import options from "../options";
import scsynth from "../scsynth";
import plugins from "../plugins";
import runtime from "../runtime";
import {combineReducers, createSlice, type CaseReducer} from "../utils";
import {SliceName, RootAction} from "@/constants/store";
import type {RootState} from "@/types/stores";

const initialState: RootState = {
  isRunning: false,
  options: options.getInitialState(),
  scsynth: scsynth.getInitialState(),
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
  },
  defaultReducer: combineReducers({
    options: options.reducer,
    scsynth: scsynth.reducer,
    plugins: plugins.reducer,
    runtime: runtime.reducer,
  }) as unknown as CaseReducer<RootState>
});
