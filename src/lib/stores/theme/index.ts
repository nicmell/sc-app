import { themeSlice } from "./slice";
import selectors from "./selectors";

const { actions, reducer, getInitialState } = themeSlice;
export default { actions, reducer, getInitialState, selectors };
