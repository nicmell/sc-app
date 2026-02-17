import {oscService} from '@/lib/osc';
import {
  newSynthMessage,
  freeNodeMessage,
  nodeRunMessage,
  groupTailMessage
} from '@/lib/osc/messages.ts';
import {nodesApi} from '@/lib/stores/api';
import {isSynth} from '@/lib/stores/nodes/slice';
import {ScNode} from './internal/sc-node.ts';

export class ScSynth extends ScNode {
  static properties = {
    name: {type: String},
  };

  declare name: string;

  protected get type() { return 'synth' as const; }

  get isRunning() {
    const n = nodesApi.items.find(n => n.nodeId === this.nodeId);
    return n && isSynth(n) ? n.isRunning : false;
  }

  get params() {
    const n = nodesApi.items.find(n => n.nodeId === this.nodeId);
    return n && isSynth(n) ? n.params : {};
  }

  constructor() {
    super();
    this.name = 'default';
  }

  protected firstUpdated() {
    const params: Record<string, number> = {};
    for (const el of this.registeredElements) {
      Object.assign(params, el.getParams());
    }

    const group = this._group.value;
    const groupId = group?.nodeId ?? oscService.defaultGroupId();
    group?.registerNode(this);
    nodesApi.newSynth({nodeId: this.nodeId, groupId, params});
    oscService.send(
      newSynthMessage(this.name, this.nodeId, 0, 0, params),
      nodeRunMessage(-1, 0),
      groupTailMessage(groupId, -1),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._group.value?.unregisterNode(this);
    if (this.loaded) {
      nodesApi.freeNode(this.nodeId);
      oscService.send(freeNodeMessage(this.nodeId));
    }
  }
}
