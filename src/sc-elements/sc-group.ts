import {oscService} from '@/lib/osc';
import {
  newGroupMessage,
  groupTailMessage,
  groupFreeAllMessage,
  freeNodeMessage
} from '@/lib/osc/messages.ts';
import {ScNode} from './internal/sc-node.ts';

export class ScGroup extends ScNode {

  protected firstUpdated() {
    oscService.send(
      newGroupMessage(this.nodeId),
      groupTailMessage(this.groupId, -1),
    );
    this._loaded = true;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._loaded) {
      oscService.send(
        groupFreeAllMessage(this.nodeId),
        freeNodeMessage(this.nodeId),
      );
    }
  }
}
