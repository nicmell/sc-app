import {oscService} from '@/lib/osc';
import {
  newGroupMessage,
  groupTailMessage,
  groupFreeAllMessage,
  freeNodeMessage
} from '@/lib/osc/messages.ts';
import {nodesApi} from '@/lib/stores/api';
import {ScNode} from './internal/sc-node.ts';

export class ScGroup extends ScNode {
  static properties = {
    id: {type: String, reflect: true},
  };

  protected get type() { return 'group' as const; }

  get isRunning() { return false; }

  get params(): Record<string, number> { return {}; }

  protected firstUpdated() {
    nodesApi.newGroup({id: this.id, nodeId: this.nodeId, groupId: this.groupId});
    oscService.send(
      newGroupMessage(this.nodeId),
      groupTailMessage(this.groupId, -1),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.loaded) {
      nodesApi.freeNode(this.nodeId);
      oscService.send(
        groupFreeAllMessage(this.nodeId),
        freeNodeMessage(this.nodeId),
      );
    }
  }
}
