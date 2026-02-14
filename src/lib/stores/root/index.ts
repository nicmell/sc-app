import { rootSlice } from "./slice";
import selectors from "./selectors";

const { actions, reducer, getInitialState } = rootSlice;
export default { actions, reducer, getInitialState, selectors };
