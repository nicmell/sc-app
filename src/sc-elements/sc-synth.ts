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

  get isRunning() {
    const box = layoutApi.getById(this.boxId);
    if (!box?.elements) return false;
    const el = findElementById(box.elements, this.id);
    return el?.type === 'sc-synth' ? (el.isRunning ?? false) : false;
  }

  protected firstUpdated() {
    const box = layoutApi.getById(this.boxId);
    const el = box?.elements ? findElementById(box.elements, this.id) : undefined;
    const params = el?.type === 'sc-synth' ? el.controls : {};
    oscService.send(
      newSynthMessage(this.bind, this.nodeId, 0, 0, params),
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
