import scsynth from "../scsynth";
import layout from "../layout";
import theme from "../theme";
import plugins from "../plugins";
import {combineReducers, createSlice} from "../utils";
import {SliceName} from "@/constants/store";
import type {RootState} from "@/types/stores";

const initialState: RootState = {
  scsynth: scsynth.getInitialState(),
  layout: layout.getInitialState(),
  theme: theme.getInitialState(),
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
    plugins: plugins.reducer,
  })
});
