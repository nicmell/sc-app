import {oscService} from '@/lib/osc';
import {
  newSynthMessage,
  freeNodeMessage,
  nodeRunMessage,
  groupTailMessage,
  defRecvBytesMessage
} from '@/lib/osc/messages.ts';
import {nodesApi} from '@/lib/stores/api';
import {isSynth, isInput, isUGen, isScUGenData} from '@/lib/stores/nodes/slice';
import {synthDef} from '@/lib/ugen/synthdef';
import {control} from '@/lib/ugen/control';
import {UGen, Rate, type UGenInput} from '@/lib/ugen/ugen';
import type {AnyElement, InputElement, UGenElement} from '@/types/stores';
import {UGEN_REGISTRY} from './internal/ugen-registry.ts';
import {ScNode} from './internal/sc-node.ts';

interface ResolveContext {
  inputs: Record<string, UGen>;
  ugens: Record<string, UGen>;
}

function resolveInput(raw: string, ctx: ResolveContext): UGenInput {
  const parts = raw.split('.');
  const id = parts[0];
  if (id in ctx.inputs) return ctx.inputs[id];
  if (id in ctx.ugens) {
    const ugen = ctx.ugens[id];
    return parts.length > 1 ? ugen.output(parseInt(parts[1], 10)) : ugen;
  }
  return parseFloat(raw);
}

function parseRate(rate: string): Rate {
  if (rate === 'kr') return Rate.Control;
  if (rate === 'ir') return Rate.Scalar;
  return Rate.Audio;
}

function inputsFromElements(elements: AnyElement[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const el of elements) {
    if (isInput(el)) result[el.id] = el.value;
  }
  return result;
}

function ugensFromElements(elements: AnyElement[]): UGenElement[] {
  return elements.filter(isUGen);
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

  get elements(): AnyElement[] {
    const n = nodesApi.items.find(n => n.nodeId === this.nodeId);
    return n && isSynth(n) ? n.elements : [];
  }

  constructor() {
    super();
    this.name = '';
  }

  private _serializeUGens(): UGenElement[] {
    return [...this.registeredElements].filter(isScUGenData).map(el => {
      const entry = UGEN_REGISTRY[el.type];
      const inputs: Record<string, any> = {};
      if (entry) {
        for (const paramName of entry.inputs) {
          const val = el.getAttribute(paramName);
          if (val != null) inputs[paramName] = val;
        }
      }
      return {type: 'ugen', ugen: el.type, rate: el.rate, id: el.id, inputs};
    });
  }

  protected firstUpdated() {
    const inputElements: InputElement[] = [];
    for (const el of this.registeredElements) {
      for (const [id, value] of Object.entries(el.getInputs())) {
        inputElements.push({type: 'input', id, value});
      }
    }

    const ugenElements = this._serializeUGens();
    const elements: AnyElement[] = [...inputElements, ...ugenElements];

    if (this.hasAttribute('name')) {
      this._createSynth(elements);
    } else {
      this._buildAndSendDef(elements);
    }
  }

  private _createSynth(elements: AnyElement[]) {
    const group = this._group.value;
    const groupId = group?.nodeId ?? oscService.defaultGroupId();
    group?.registerElement(this);
    const inputs = inputsFromElements(elements);
    nodesApi.newSynth({nodeId: this.nodeId, groupId, elements});
    oscService.send(
      newSynthMessage(this.name, this.nodeId, 0, 0, inputs),
      nodeRunMessage(-1, 0),
      groupTailMessage(groupId, -1),
    );
  }

  private _buildAndSendDef(elements: AnyElement[]) {
    const defName = `_sc${this.nodeId}`;
    const inputs = inputsFromElements(elements);
    const ugens = ugensFromElements(elements);

    const def = synthDef(defName, () => {
      const ctx: ResolveContext = {inputs: {}, ugens: {}};
      for (const [name, value] of Object.entries(inputs)) {
        ctx.inputs[name] = control(name, parseFloat(value));
      }

      for (const item of ugens) {
        const entry = UGEN_REGISTRY[item.ugen];
        if (!entry) throw new Error(`Unknown UGen type: ${item.ugen}`);

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

        const ugen = new UGen(item.ugen, rate, resolved, entry.numOutputs);
        if (item.id) ctx.ugens[item.id] = ugen;
      }
    });

    const bytes = def.toBytes();
    oscService.send(defRecvBytesMessage(bytes));

    this.name = defName;
    setTimeout(() => this._createSynth(elements), 50);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._group.value?.unregisterElement(this);
    if (this.loaded) {
      nodesApi.freeNode(this.nodeId);
      oscService.send(freeNodeMessage(this.nodeId));
    }
  }
}
