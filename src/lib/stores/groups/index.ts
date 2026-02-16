import { groupsSlice } from "./slice";
import selectors from "./selectors";

const { actions, reducer, getInitialState } = groupsSlice;
export default { actions, reducer, getInitialState, selectors };
