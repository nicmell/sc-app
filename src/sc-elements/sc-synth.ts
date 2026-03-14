import {oscService} from '@/lib/osc';
import {
  newSynthMessage,
  freeNodeMessage,
  groupTailMessage
} from '@/lib/osc/messages.ts';
import {ScNode} from './internal/sc-node.ts';

export class ScSynth extends ScNode {
  static properties = {
    ...ScNode.properties,
    bind: {type: String},
  };

  declare bind: string;

  constructor() {
    super();
    this.bind = 'default';
  }

  protected firstUpdated() {
    oscService.send(
      newSynthMessage(this.bind, this.nodeId, 0, 0, this.getControls()),
      groupTailMessage(this.groupId, -1),
    );
    this._loaded = true;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._loaded) {
      oscService.send(freeNodeMessage(this.nodeId));
    }
  }
}
