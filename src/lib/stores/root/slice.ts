import scsynth from "../scsynth";
import layout from "../layout";
import theme from "../theme";
import plugins from "../plugins";
import nodes from "../nodes";
import {combineReducers, createSlice} from "../utils";
import {SliceName} from "@/constants/store";
import type {RootState} from "@/types/stores";

const initialState: RootState = {
  scsynth: scsynth.getInitialState(),
  layout: layout.getInitialState(),
  theme: theme.getInitialState(),
  nodes: nodes.getInitialState(),
  plugins: plugins.getInitialState(),
};

export const rootSlice = createSlice({
  name: SliceName.ROOT,
  initialState,
  reducers: {},
  defaultReducer: combineReducers({
    scsynth: scsynth.reducer,
    layout: layout.reducer,
    theme: theme.reducer,
    nodes: nodes.reducer,
    plugins: plugins.reducer,
  })
});
