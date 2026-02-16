import type {GroupsState} from "@/types/stores";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, GroupsAction} from "@/constants/store";

const initialState: GroupsState = {
  items: [],
};

export const groupsSlice = createSlice({
  name: SliceName.GROUPS,
  initialState,
  reducers: {
    [GroupsAction.NEW_GROUP]: (state, action: { payload: { nodeId: number; params: Record<string, number> } }) => {
      state.items.push({nodeId: action.payload.nodeId, isRunning: false, params: action.payload.params});
    },
    [GroupsAction.FREE_GROUP]: (state, action: { payload: number }) => {
      state.items = state.items.filter(g => g.nodeId !== action.payload);
    },
    [GroupsAction.SET_RUNNING]: (state, action: { payload: { nodeId: number; isRunning: boolean } }) => {
      const group = state.items.find(g => g.nodeId === action.payload.nodeId);
      if (group) group.isRunning = action.payload.isRunning;
    },
    [GroupsAction.SET_PARAMS]: (state, action: { payload: { nodeId: number; params: Record<string, number> } }) => {
      const group = state.items.find(g => g.nodeId === action.payload.nodeId);
      if (group) Object.assign(group.params, action.payload.params);
    },
  },
});
