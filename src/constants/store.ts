export const SliceName = {
  SCSYNTH: "scsynth",
  LAYOUT: "layout",
  THEME: "theme",
} as const;

export const ScsynthAction = {
  SET_CLIENT: "setClient",
  SET_OPTIONS: "setOptions",
  SET_CONNECTION_STATUS: "setConnectionStatus",
  SET_STATUS: "setStatus",
  SET_VERSION: "setVersion",
  CLEAR_CLIENT: "clearClient",
} as const;

export const LayoutAction = {
  SET_LAYOUT: "setLayout",
  RESET_LAYOUT: "resetLayout",
} as const;

export const ThemeAction = {
  SET_MODE: "setMode",
  SET_PRIMARY_COLOR: "setPrimaryColor",
} as const;
