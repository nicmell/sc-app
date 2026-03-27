import type {LayoutOptions, ScsynthOptions, OptionsState} from "@/types/stores";
import {createSlice} from "@/lib/stores/utils";
import {SliceName, OptionsAction} from "@/constants/store";
import {DEFAULT_OPTIONS as DEFAULT_LAYOUT_OPTIONS} from "@/constants/layout";
import {DEFAULT_OPTIONS as DEFAULT_SCSYNTH_OPTIONS} from "@/constants/osc";

const initialState: OptionsState = {
    theme: {mode: "adaptive", primaryColor: "#396cd8"},
    layout: DEFAULT_LAYOUT_OPTIONS,
    scsynth: DEFAULT_SCSYNTH_OPTIONS,
};

export const optionsSlice = createSlice({
    name: SliceName.OPTIONS,
    initialState,
    reducers: {
        [OptionsAction.SET_THEME]: (state, action: { payload: Partial<OptionsState['theme']> }) => {
            Object.assign(state.theme, action.payload);
        },
        [OptionsAction.SET_LAYOUT]: (state, action: { payload: Partial<LayoutOptions> }) => {
            Object.assign(state.layout, action.payload);
        },
        [OptionsAction.SET_SCSYNTH]: (state, action: { payload: Partial<ScsynthOptions> }) => {
            Object.assign(state.scsynth, action.payload);
        },
    },
});
