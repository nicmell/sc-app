import { layoutSlice } from "./slice";
import selectors from "./selectors";

const { actions, reducer, getInitialState } = layoutSlice;
export default { actions, reducer, getInitialState, selectors };
