export const SliceName = {
  ROOT: "root",
  OPTIONS: "options",
  SCSYNTH: "scsynth",
  LAYOUT: "layout",
  PLUGINS: "plugins",
  RUNTIME: "runtime",
} as const;

export const OptionsAction = {
  SET_THEME: "setThemeOptions",
  SET_LAYOUT: "setLayoutOptions",
  SET_SCSYNTH: "setScsynthOptions",
} as const;

export const ScsynthAction = {
  SET_CLIENT: "setClient",
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
  SET_BOX_PLUGIN: "setBoxPlugin",
} as const;

export const RuntimeAction = {
  LOAD_PLUGIN: "loadPlugin",
  UNLOAD_PLUGIN: "unloadPlugin",
  SET_CONTROL: "setControl",
  SET_RUNNING: "setRunning",
  NEW_GROUP: "newGroup",
  NEW_SYNTH: "newSynth",
  FREE_GROUP: "freeGroup",
  FREE_SYNTH: "freeSynth",
} as const;

export const RootAction = {
  SET_RUNNING: "setRunning",
} as const;

export const PluginsAction = {
  ADD_PLUGIN: "addPlugin",
  REMOVE_PLUGIN: "removePlugin",
  LOAD_PLUGIN: "loadPlugin",
} as const;
