import {oscService} from '@/lib/osc';
import {
  newGroupMessage,
  groupTailMessage,
  groupFreeAllMessage,
  freeNodeMessage
} from '@/lib/osc/messages.ts';
import {nodesApi} from '@/lib/stores/api';
import {type ScNode as IScNode} from './context.ts';
import {ScNode} from './internal/sc-node.ts';

export class ScGroup extends ScNode {
  private registeredNodes = new Set<IScNode>();

  protected get type() { return 'group' as const; }

  get isRunning() { return false; }

  get inputs(): Record<string, any> { return {}; }

  registerNode(node: IScNode) {
    this.registeredNodes.add(node);
  }

  unregisterNode(node: IScNode) {
    this.registeredNodes.delete(node);
  }

  protected firstUpdated() {
    const group = this._group.value;
    const groupId = group?.nodeId ?? oscService.defaultGroupId();
    group?.registerNode(this);
    nodesApi.newGroup({nodeId: this.nodeId, groupId});
    oscService.send(
      newGroupMessage(this.nodeId),
      groupTailMessage(groupId, -1),
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._group.value?.unregisterNode(this);
    if (this.loaded) {
      nodesApi.freeNode(this.nodeId);
      oscService.send(
        groupFreeAllMessage(this.nodeId),
        freeNodeMessage(this.nodeId),
      );
    }
  }
}
