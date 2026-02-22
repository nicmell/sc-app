import {oscService} from '@/lib/osc';
import {
  newGroupMessage,
  groupTailMessage,
  groupFreeAllMessage,
  freeNodeMessage
} from '@/lib/osc/messages.ts';
import {nodesApi} from '@/lib/stores/api';
import type {AnyElement} from '@/types/stores';
import {isGroup} from '@/lib/stores/nodes/slice';
import {ScNode} from './internal/sc-node.ts';

export class ScGroup extends ScNode {
  protected get type() { return 'group' as const; }

  get isRunning() { return false; }

  get elements(): AnyElement[] {
    const n = nodesApi.items.find(n => n.nodeId === this.nodeId);
    return n && isGroup(n) ? n.elements : [];
  }

  protected firstUpdated() {
    const group = this._group.value;
    const groupId = group?.nodeId ?? oscService.defaultGroupId();
    group?.registerElement(this);
    nodesApi.newGroup({nodeId: this.nodeId, groupId});
    oscService.send(
      newGroupMessage(this.nodeId),
      groupTailMessage(groupId, -1),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._group.value?.unregisterElement(this);
    if (this.loaded) {
      nodesApi.freeNode(this.nodeId);
      oscService.send(
        groupFreeAllMessage(this.nodeId),
        freeNodeMessage(this.nodeId),
      );
    }
  }
}
