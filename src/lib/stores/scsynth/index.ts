import { scsynthSlice } from "./slice";
import selectors from "./selectors";

const { actions, reducer, getInitialState } = scsynthSlice;
export default { actions, reducer, getInitialState, selectors };
