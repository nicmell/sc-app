import {oscService} from '@/lib/osc';
import {
  newSynthMessage,
  freeNodeMessage,
  nodeRunMessage,
  groupTailMessage,
  defRecvBytesMessage
} from '@/lib/osc/messages.ts';
import {nodesApi} from '@/lib/stores/api';
import {isSynth} from '@/lib/stores/nodes/slice';
import {synthDef} from '@/lib/ugen/synthdef';
import {control} from '@/lib/ugen/control';
import {UGen, Rate, type UGenInput} from '@/lib/ugen/ugen';
import {UGEN_REGISTRY} from './internal/ugen-registry.ts';
import {ScNode} from './internal/sc-node.ts';
import type {ScUGen} from './sc-ugen.ts';

function resolveInput(
  raw: string,
  ugenMap: Record<string, UGen>,
  controls: Record<string, UGen>,
): UGenInput {
  if (raw.startsWith('#')) {
    const ref = raw.slice(1);
    const dotIndex = ref.indexOf('.');
    if (dotIndex >= 0) {
      const id = ref.slice(0, dotIndex);
      const outputIdx = parseInt(ref.slice(dotIndex + 1), 10);
      const ugen = ugenMap[id];
      if (!ugen) throw new Error(`Unknown sc-ugen reference: #${id}`);
      return ugen.output(outputIdx);
    }
    const ugen = ugenMap[ref];
    if (!ugen) throw new Error(`Unknown sc-ugen reference: #${ref}`);
    return ugen;
  }
  if (raw.startsWith('@')) {
    const name = raw.slice(1);
    const ctrl = controls[name];
    if (!ctrl) throw new Error(`Unknown param reference: @${name}`);
    return ctrl;
  }
  return parseFloat(raw);
}

function parseRate(rate: string): Rate {
  if (rate === 'kr') return Rate.Control;
  if (rate === 'ir') return Rate.Scalar;
  return Rate.Audio;
}

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
    this.name = '';
  }

  protected firstUpdated() {
    const params: Record<string, number> = {};
    for (const el of this.registeredElements) {
      Object.assign(params, el.getParams());
    }

    if (this.hasAttribute('name')) {
      this._createSynth(params);
    } else {
      this._buildAndSendDef(params);
    }
  }

  private _createSynth(params: Record<string, number>) {
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

  private _buildAndSendDef(params: Record<string, number>) {
    const defName = `_sc${this.nodeId}`;
    const scUgens = [...this.querySelectorAll<ScUGen>('sc-ugen')];

    const def = synthDef(defName, () => {
      const controls: Record<string, UGen> = {};
      for (const [name, value] of Object.entries(params)) {
        controls[name] = control(name, value);
      }

      const ugenMap: Record<string, UGen> = {};
      for (const el of scUgens) {
        const entry = UGEN_REGISTRY[el.type];
        if (!entry) throw new Error(`Unknown UGen type: ${el.type}`);

        const rate = parseRate(el.rate);
        const inputs: UGenInput[] = [];

        for (const paramName of entry.params) {
          const raw = el.getAttribute(paramName);
          if (raw == null) continue;
          const parts = raw.split(',');
          for (const part of parts) {
            inputs.push(resolveInput(part.trim(), ugenMap, controls));
          }
        }

        const ugen = new UGen(el.type, rate, inputs, entry.numOutputs);
        if (el.id) ugenMap[el.id] = ugen;
      }
    });

    const bytes = def.toBytes();
    oscService.send(defRecvBytesMessage(bytes));

    this.name = defName;
    setTimeout(() => this._createSynth(params), 50);
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
