import { pluginsSlice } from "./slice";
import selectors from "./selectors";

const { actions, reducer, getInitialState } = pluginsSlice;
export default { actions, reducer, getInitialState, selectors };
