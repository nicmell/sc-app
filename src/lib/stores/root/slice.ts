import scsynth from "../scsynth";
import layout from "../layout";
import theme from "../theme";
import plugins from "../plugins";
import synths from "../synths";
import {combineReducers, createSlice} from "../utils";
import {SliceName} from "@/constants/store";
import type {RootState} from "@/types/stores";

const initialState: RootState = {
  scsynth: scsynth.getInitialState(),
  layout: layout.getInitialState(),
  theme: theme.getInitialState(),
  synths: synths.getInitialState(),
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
    synths: synths.reducer,
    plugins: plugins.reducer,
  })
});
