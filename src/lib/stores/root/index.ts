import {scsynthSlice} from "../scsynth";
import {layoutSlice} from "../layout";
import {themeSlice} from "../theme";
import {combineReducers} from "../utils";
import type {RootState} from "@/types/stores";

export const rootInitialState: RootState = {
  scsynth: scsynthSlice.getInitialState(),
  layout: layoutSlice.getInitialState(),
  theme: themeSlice.getInitialState(),
};

export const rootReducer = combineReducers<RootState>({
  scsynth: scsynthSlice.reducer,
  layout: layoutSlice.reducer,
  theme: themeSlice.reducer,
});
