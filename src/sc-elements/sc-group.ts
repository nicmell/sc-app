import {oscService} from '@/lib/osc';
import {
  newGroupMessage,
  groupTailMessage,
  groupFreeAllMessage,
  freeNodeMessage
} from '@/lib/osc/messages.ts';
import {layoutApi} from '@/lib/stores/api';
import {findElementByPath} from '@/lib/parsers';
import {ScNode} from './internal/sc-node.ts';

export class ScGroup extends ScNode {

  get isRunning() {
    const box = layoutApi.getById(this.boxId);
    if (!box?.elements) return false;
    const el = findElementByPath(box.elements, this.pathSegments);
    return el?.type === 'sc-group' ? (el.isRunning ?? false) : false;
  }

  protected firstUpdated() {
    oscService.send(
      newGroupMessage(this.nodeId),
      groupTailMessage(this.groupId, -1),
    );
    this._oscCreated = true;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._oscCreated) {
      oscService.send(
        groupFreeAllMessage(this.nodeId),
        freeNodeMessage(this.nodeId),
      );
    }
  }
}
