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
    [PluginsAction.SET_PLUGIN_FOUND]: (state, action: { payload: { name: string; found: boolean } }) => {
      const plugin = state.items.find(p => p.name === action.payload.name);
      if (plugin) plugin.found = action.payload.found;
    },
    [PluginsAction.SET_PLUGIN_LOADED]: (state, action: { payload: { name: string; loaded: boolean } }) => {
      const plugin = state.items.find(p => p.name === action.payload.name);
      if (plugin) plugin.loaded = action.payload.loaded;
    },
    [PluginsAction.SET_PLUGIN_ERRORS]: (state, action: { payload: { name: string; errors: string[] } }) => {
      const plugin = state.items.find(p => p.name === action.payload.name);
      if (plugin) plugin.errors = action.payload.errors;
    },
  },
});
