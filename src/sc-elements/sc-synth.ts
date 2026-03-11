import {oscService} from '@/lib/osc';
import {
  newSynthMessage,
  freeNodeMessage,
  groupTailMessage
} from '@/lib/osc/messages.ts';
import {layoutApi} from '@/lib/stores/api';
import {findElementByPath} from '@/lib/parsers';
import {ScNode} from './internal/sc-node.ts';

const SKIP_ATTRS = new Set(['name', 'synthdef', 'class', 'style', 'slot', 'title']);

export class ScSynth extends ScNode {
  static properties = {
    ...ScNode.properties,
    synthdef: {type: String},
  };

  declare synthdef: string;

  constructor() {
    super();
    this.synthdef = 'default';
  }

  get isRunning() {
    const box = layoutApi.getById(this.boxId);
    if (!box?.elements) return false;
    const el = findElementByPath(box.elements, this.pathSegments);
    return el?.type === 'sc-synth' ? (el.isRunning ?? false) : false;
  }

  private _collectParams(): Record<string, number> {
    const params: Record<string, number> = {};
    for (const attr of this.attributes) {
      if (SKIP_ATTRS.has(attr.name)) {
        continue
      }
      const val = Number(attr.value);
      if (!isNaN(val)) {
        params[attr.name] = val;
      }
    }
    return params;
  }

  protected firstUpdated() {
    const params = this._collectParams();
    oscService.send(
      newSynthMessage(this.synthdef, this.nodeId, 0, 0, params),
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
