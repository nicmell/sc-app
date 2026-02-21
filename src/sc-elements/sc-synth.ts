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
import {get} from '@/lib/utils/get';
import type {UGenItem} from '@/types/stores';
import {UGEN_REGISTRY} from './internal/ugen-registry.ts';
import {ScNode} from './internal/sc-node.ts';

interface ResolveContext {
  inputs: Record<string, UGen>;
  ugens: Record<string, UGen>;
}

function resolveInput(raw: string, ctx: ResolveContext): UGenInput {
  const resolved = get(ctx, raw);
  if (resolved instanceof UGen) return resolved;
  const parent = get(ctx, raw.split('.').slice(0, -1).join('.'));
  if (parent instanceof UGen) {
    return parent.output(parseInt(raw.split('.').pop()!, 10))
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

  get inputs(): Record<string, any> {
    const n = nodesApi.items.find(n => n.nodeId === this.nodeId);
    return n && isSynth(n) ? n.inputs : {};
  }

  get ugens(): UGenItem[] {
    const n = nodesApi.items.find(n => n.nodeId === this.nodeId);
    return n && isSynth(n) ? n.ugens : [];
  }

  constructor() {
    super();
    this.name = '';
  }

  private _serializeUGens(): UGenItem[] {
    return this.registeredUGens.map(el => {
      const entry = UGEN_REGISTRY[el.type];
      const inputs: Record<string, any> = {};
      if (entry) {
        for (const paramName of entry.inputs) {
          const val = el.getAttribute(paramName);
          if (val != null) inputs[paramName] = val;
        }
      }
      return {type: el.type, rate: el.rate, id: el.id, inputs};
    });
  }

  protected firstUpdated() {
    const inputs: Record<string, any> = {};
    for (const el of this.registeredElements) {
      Object.assign(inputs, el.getInputs());
    }

    const ugens = this._serializeUGens();

    if (this.hasAttribute('name')) {
      this._createSynth(inputs, ugens);
    } else {
      this._buildAndSendDef(inputs, ugens);
    }
  }

  private _createSynth(inputs: Record<string, any>, ugens: UGenItem[]) {
    const group = this._group.value;
    const groupId = group?.nodeId ?? oscService.defaultGroupId();
    group?.registerNode(this);
    nodesApi.newSynth({nodeId: this.nodeId, groupId, inputs, ugens});
    oscService.send(
      newSynthMessage(this.name, this.nodeId, 0, 0, inputs),
      nodeRunMessage(-1, 0),
      groupTailMessage(groupId, -1),
    );
  }

  private _buildAndSendDef(inputs: Record<string, any>, ugens: UGenItem[]) {
    const defName = `_sc${this.nodeId}`;

    const def = synthDef(defName, () => {
      const ctx: ResolveContext = {inputs: {}, ugens: {}};
      for (const [name, value] of Object.entries(inputs)) {
        ctx.inputs[name] = control(name, parseFloat(value));
      }

      for (const item of ugens) {
        const entry = UGEN_REGISTRY[item.type];
        if (!entry) throw new Error(`Unknown UGen type: ${item.type}`);

        const rate = parseRate(item.rate);
        const resolved: UGenInput[] = [];

        for (const paramName of entry.inputs) {
          const raw = item.inputs[paramName];
          if (raw == null) continue;
          const parts = raw.split(',');
          for (const part of parts) {
            resolved.push(resolveInput(part.trim(), ctx));
          }
        }

        const ugen = new UGen(item.type, rate, resolved, entry.numOutputs);
        if (item.id) ctx.ugens[item.id] = ugen;
      }
    });

    const bytes = def.toBytes();
    oscService.send(defRecvBytesMessage(bytes));

    this.name = defName;
    setTimeout(() => this._createSynth(inputs, ugens), 50);
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
