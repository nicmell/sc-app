import {oscService} from '@/lib/osc';
import {
  newSynthMessage,
  freeNodeMessage,
  groupTailMessage
} from '@/lib/osc/messages.ts';
import {layoutApi} from '@/lib/stores/api';
import {findElementById} from '@/lib/parsers';
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

  private getParams(): Record<string, number> {
    const box = layoutApi.getById(this.boxId);
    const el = box?.elements ? findElementById(box.elements, this.id) : undefined;
    return el?.type === 'sc-synth' ? el.controls : {};
  }

  protected firstUpdated() {
    oscService.send(
      newSynthMessage(this.bind, this.nodeId, 0, 0, this.getParams()),
      groupTailMessage(this.groupId, -1),
    );
    this._oscCreated = true;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._oscCreated) {
      oscService.send(freeNodeMessage(this.nodeId));
    }
  }
}
