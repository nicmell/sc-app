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
    [GroupsAction.NEW_GROUP]: (state, action: { payload: number }) => {
      state.items.push({nodeId: action.payload});
    },
    [GroupsAction.FREE_GROUP]: (state, action: { payload: number }) => {
      state.items = state.items.filter(g => g.nodeId !== action.payload);
    },
  },
});
