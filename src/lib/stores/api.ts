import {dispatch, rootStore} from "@/lib/stores/rootStore";
import {setClient, setOptions, setConnectionStatus, setStatus, setVersion, clearClient} from "@/lib/stores/scsynth";
import {selectIsConnected, selectIsConnecting, selectScsynthOptions, selectInitialNodeId, selectAddress, selectStatusText} from "@/lib/stores/scsynth";
import {setLayout, resetLayout} from "@/lib/stores/layout";
import {selectLayout} from "@/lib/stores/layout";
import {setMode, setPrimaryColor} from "@/lib/stores/theme";
import {selectThemeMode, selectPrimaryColor} from "@/lib/stores/theme";
import {ScsynthAction, LayoutAction, ThemeAction} from "@/constants/store";

export const scsynthApi = {
  get isConnected() { return selectIsConnected(rootStore.getState()); },
  get isConnecting() { return selectIsConnecting(rootStore.getState()); },
  get options() { return selectScsynthOptions(rootStore.getState()); },
  get initialNodeId() { return selectInitialNodeId(rootStore.getState()); },
  get address() { return selectAddress(rootStore.getState()); },
  get statusText() { return selectStatusText(rootStore.getState()); },
  [ScsynthAction.SET_CLIENT]: (...args: Parameters<typeof setClient>) => dispatch(setClient(...args)),
  [ScsynthAction.SET_OPTIONS]: (...args: Parameters<typeof setOptions>) => dispatch(setOptions(...args)),
  [ScsynthAction.SET_CONNECTION_STATUS]: (...args: Parameters<typeof setConnectionStatus>) => dispatch(setConnectionStatus(...args)),
  [ScsynthAction.SET_STATUS]: (...args: Parameters<typeof setStatus>) => dispatch(setStatus(...args)),
  [ScsynthAction.SET_VERSION]: (...args: Parameters<typeof setVersion>) => dispatch(setVersion(...args)),
  [ScsynthAction.CLEAR_CLIENT]: () => dispatch(clearClient()),
};

export const layoutApi = {
  get layout() { return selectLayout(rootStore.getState()); },
  [LayoutAction.SET_LAYOUT]: (...args: Parameters<typeof setLayout>) => dispatch(setLayout(...args)),
  [LayoutAction.RESET_LAYOUT]: () => dispatch(resetLayout()),
};

export const themeApi = {
  get mode() { return selectThemeMode(rootStore.getState()); },
  get primaryColor() { return selectPrimaryColor(rootStore.getState()); },
  [ThemeAction.SET_MODE]: (...args: Parameters<typeof setMode>) => dispatch(setMode(...args)),
  [ThemeAction.SET_PRIMARY_COLOR]: (...args: Parameters<typeof setPrimaryColor>) => dispatch(setPrimaryColor(...args)),
};
