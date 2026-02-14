import type {LayoutState, LayoutOptions, BoxItem} from "@/types/stores";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, LayoutAction} from "@/constants/store";
import {DEFAULT_LAYOUT, DEFAULT_OPTIONS} from "@/constants/layout.ts";

function nextBoxId(items: BoxItem[]): string {
  let max = 0;
  for (const item of items) {
    const m = item.i.match(/^box-(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `box-${max + 1}`;
}

const initialState: LayoutState = {
  items: DEFAULT_LAYOUT,
  options: DEFAULT_OPTIONS,
};

export const layoutSlice = createSlice({
  name: SliceName.LAYOUT,
  initialState,
  reducers: {
    [LayoutAction.SET_LAYOUT]: (state, action: { payload: BoxItem[] }) => {
      state.items = action.payload;
    },
    [LayoutAction.RESET_LAYOUT]: (state) => {
      state.items = DEFAULT_LAYOUT;
    },
    [LayoutAction.REMOVE_BOX]: (state, action: { payload: string }) => {
      state.items = state.items.filter(item => item.i !== action.payload);
    },
    [LayoutAction.ADD_BOX]: (state, action: { payload: {x: number; y: number; w: number; h: number} }) => {
      const {x, y, w, h} = action.payload;
      const id = nextBoxId(state.items);
      state.items = [...state.items, {i: id, x, y, w, h}];
    },
    [LayoutAction.SET_OPTIONS]: (state, action: { payload: Partial<LayoutOptions> }) => {
      state.options = {...state.options, ...action.payload};
    },
  },
});
