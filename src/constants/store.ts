export const SliceName = {
  ROOT: "root",
  SCSYNTH: "scsynth",
  LAYOUT: "layout",
  THEME: "theme",
  PLUGINS: "plugins",
  SYNTHS: "synths",
  GROUPS: "groups",
} as const;

export const SynthsAction = {
  NEW_SYNTH: "newSynth",
  FREE_SYNTH: "freeSynth",
  SET_RUNNING: "setRunning",
  SET_PARAMS: "setParams",
} as const;

export const GroupsAction = {
  NEW_GROUP: "newGroup",
  FREE_GROUP: "freeGroup",
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
