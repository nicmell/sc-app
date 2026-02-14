import type {PluginsState, PluginInfo} from "@/types/stores";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, PluginsAction} from "@/constants/store";

const initialState: PluginsState = {
  items: [],
};

export const pluginsSlice = createSlice({
  name: SliceName.PLUGINS,
  initialState,
  reducers: {
    [PluginsAction.ADD_PLUGIN]: (state, action: { payload: PluginInfo }) => {
      if (!state.items.some(p => p.name === action.payload.name)) {
        state.items = [...state.items, action.payload];
      }
    },
    [PluginsAction.REMOVE_PLUGIN]: (state, action: { payload: string }) => {
      state.items = state.items.filter(p => p.name !== action.payload);
    },
  },
});
