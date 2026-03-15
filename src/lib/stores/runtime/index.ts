import { runtimeSlice } from "./slice";
import selectors from "./selectors";

const { actions, reducer, getInitialState } = runtimeSlice;
export default { actions, reducer, getInitialState, selectors };
