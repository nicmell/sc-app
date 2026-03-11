import scsynth from "../scsynth";
import layout from "../layout";
import theme from "../theme";
import plugins from "../plugins";
import {combineReducers, createSlice, type CaseReducer} from "../utils";
import {SliceName, RootAction} from "@/constants/store";
import type {RootState} from "@/types/stores";

const initialState: RootState = {
  isRunning: false,
  scsynth: scsynth.getInitialState(),
  layout: layout.getInitialState(),
  theme: theme.getInitialState(),
  plugins: plugins.getInitialState(),
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
    scsynth: scsynth.reducer,
    layout: layout.reducer,
    theme: theme.reducer,
    plugins: plugins.reducer,
  }) as unknown as CaseReducer<RootState>
});
