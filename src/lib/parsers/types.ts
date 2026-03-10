export type ScElementNode = {
  id: string;
  tagName: string;
  attributes: Record<string, string>;
  descendants: ScElementNode[];
}

export interface PluginTreeEntry {
  tree: ScElementNode[];
  state: Record<string, any>;
  html: string;
  title?: string;
}
