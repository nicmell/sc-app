import { nodesSlice } from "./slice";
import selectors from "./selectors";

const { actions, reducer, getInitialState } = nodesSlice;
export default { actions, reducer, getInitialState, selectors };
