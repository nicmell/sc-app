import {oscService} from '@/lib/osc';
import {
  newSynthMessage,
  freeNodeMessage,
  nodeRunMessage,
  groupTailMessage
} from '@/lib/osc/messages.ts';
import {nodesApi} from '@/lib/stores/api';
import {ScNode} from './internal/sc-node.ts';

const SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot', 'title']);

export class ScSynth extends ScNode {
  static properties = {
    ...ScNode.properties,
    name: {type: String},
  };

  declare name: string;

  constructor() {
    super();
    this.name = 'default';
  }

  protected get type() { return 'synth' as const; }

  get isRunning() {
    const n = nodesApi.items.find(n => n.nodeId === this.nodeId);
    return n !== undefined && n.type === 'synth' ? n.isRunning : false;
  }

  get params() {
    const controls = nodesApi.controls;
    const prefix = this.id + '.';
    const result: Record<string, number> = {};
    for (const key of Object.keys(controls)) {
      if (key.startsWith(prefix)) {
        result[key.slice(prefix.length)] = controls[key];
      }
    }
    return result;
  }

  private _collectParams(): Record<string, number> {
    const params: Record<string, number> = {};
    for (const attr of this.attributes) {
      if (SKIP_ATTRS.has(attr.name)) continue;
      const val = Number(attr.value);
      if (!isNaN(val)) {
        params[attr.name] = val;
      }
    }
    return params;
  }

  protected firstUpdated() {
    const params = this._collectParams();

    nodesApi.newSynth({id: this.id, nodeId: this.nodeId, groupId: this.groupId, params});
    oscService.send(
      newSynthMessage(this.name, this.nodeId, 0, 0, params),
      nodeRunMessage(-1, 0),
      groupTailMessage(this.groupId, -1),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.loaded) {
      nodesApi.freeNode(this.nodeId);
      oscService.send(freeNodeMessage(this.nodeId));
    }
  }
}
