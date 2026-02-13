import type {ScsynthAction} from "./scsynth";
import type {LayoutAction} from "./layout";
import type {ThemeAction} from "./theme";

export type RootAction = ScsynthAction | LayoutAction | ThemeAction;
