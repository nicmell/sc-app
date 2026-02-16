import type {SynthsState} from "@/types/stores";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, SynthsAction} from "@/constants/store";

const initialState: SynthsState = {
  items: [],
};

export const synthsSlice = createSlice({
  name: SliceName.SYNTHS,
  initialState,
  reducers: {
    [SynthsAction.NEW_SYNTH]: (state, action: { payload: { nodeId: number; params: Record<string, number> } }) => {
      state.items.push({nodeId: action.payload.nodeId, isRunning: false, params: action.payload.params});
    },
    [SynthsAction.FREE_SYNTH]: (state, action: { payload: number }) => {
      state.items = state.items.filter(s => s.nodeId !== action.payload);
    },
    [SynthsAction.SET_RUNNING]: (state, action: { payload: { nodeId: number; isRunning: boolean } }) => {
      const synth = state.items.find(s => s.nodeId === action.payload.nodeId);
      if (synth) synth.isRunning = action.payload.isRunning;
    },
    [SynthsAction.SET_PARAMS]: (state, action: { payload: { nodeId: number; params: Record<string, number> } }) => {
      const synth = state.items.find(s => s.nodeId === action.payload.nodeId);
      if (synth) Object.assign(synth.params, action.payload.params);
    },
  },
});
