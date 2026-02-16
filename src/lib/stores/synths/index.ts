import { synthsSlice } from "./slice";
import selectors from "./selectors";

const { actions, reducer, getInitialState } = synthsSlice;
export default { actions, reducer, getInitialState, selectors };
