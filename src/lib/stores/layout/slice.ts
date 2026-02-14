import type {LayoutState, BoxItem} from "@/types/stores";
import {DEFAULT_LAYOUT} from "@/constants/osc";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, LayoutAction} from "@/constants/store";

function nextBoxId(layout: BoxItem[]): string {
  let max = 0;
  for (const item of layout) {
    const m = item.i.match(/^box-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `box-${max + 1}`;
}

const initialState: LayoutState = {
  layout: DEFAULT_LAYOUT,
};

export const layoutSlice = createSlice({
  name: SliceName.LAYOUT,
  initialState,
  reducers: {
    [LayoutAction.SET_LAYOUT]: (state, action: { payload: BoxItem[] }) => {
      state.layout = action.payload;
    },
    [LayoutAction.RESET_LAYOUT]: (state) => {
      state.layout = DEFAULT_LAYOUT;
    },
    [LayoutAction.REMOVE_BOX]: (state, action: { payload: string }) => {
      state.layout = state.layout.filter(item => item.i !== action.payload);
    },
    [LayoutAction.ADD_BOX]: (state, action: { payload: {x: number; y: number; w: number; h: number} }) => {
      const {x, y, w, h} = action.payload;
      const id = nextBoxId(state.layout);
      state.layout = [...state.layout, {i: id, x, y, w, h}];
    },
  },
});
