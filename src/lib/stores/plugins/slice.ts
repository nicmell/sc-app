import type {PluginsState, PluginInfo, PluginError} from "@/types/stores";
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
      if (!state.items.some(p => p.id === action.payload.id)) {
        state.items = [...state.items, action.payload];
      }
    },
    [PluginsAction.REMOVE_PLUGIN]: (state, action: { payload: string }) => {
      state.items = state.items.filter(p => p.id !== action.payload);
    },
    [PluginsAction.LOAD_PLUGIN]: (state, action: { payload: { id: string; loaded: boolean; error?: PluginError; violations?: string[] } }) => {
      const plugin = state.items.find(p => p.id === action.payload.id);
      if (plugin) {
        plugin.loaded = action.payload.loaded;
        plugin.error = action.payload.error;
        plugin.violations = action.payload.violations;
      }
    },
  },
});
