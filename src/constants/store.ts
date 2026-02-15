export const SliceName = {
  ROOT: "root",
  SCSYNTH: "scsynth",
  LAYOUT: "layout",
  THEME: "theme",
  PLUGINS: "plugins",
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
  REMOVE_BOX: "removeBox",
  ADD_BOX: "addBox",
  SET_OPTIONS: "setOptions",
  SET_BOX_PLUGIN: "setBoxPlugin",
} as const;

export const ThemeAction = {
  SET_MODE: "setMode",
  SET_PRIMARY_COLOR: "setPrimaryColor",
} as const;

export const PluginsAction = {
  ADD_PLUGIN: "addPlugin",
  REMOVE_PLUGIN: "removePlugin",
  LOAD_PLUGIN: "loadPlugin",
} as const;
