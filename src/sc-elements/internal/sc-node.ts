import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {nodeRunMessage, nodeSetMessage} from '@/lib/osc/messages.ts';
import {nodesApi} from '@/lib/stores/api';
import type {AnyElement, InputElement, UGenElement} from '@/types/stores';
import {isInput, isUGen, isScNode} from '@/lib/stores/nodes/slice';
import {nodeContext, type NodeContext, type ScElement} from '../context.ts';

export abstract class ScNode extends LitElement implements ScElement {
  readonly nodeId: number;
  protected registeredElements = new Set<ScElement>();
  protected _group!: ContextConsumer<{__context__: NodeContext}, this>;

  protected abstract get type(): 'synth' | 'group';
  abstract get isRunning(): boolean;
  abstract get elements(): AnyElement[];

  getInputs(): Record<string, any> {
    return {};
  }

  get loaded() {
    return nodesApi.items.some(n => n.nodeId === this.nodeId);
  }

  registerElement(el: ScElement) {
    this.registeredElements.add(el);
  }

  unregisterElement(el: ScElement) {
    this.registeredElements.delete(el);
  }

  onChange(el: ScElement) {
    const inputs = el.getInputs();
    nodesApi.setInputs({nodeId: this.nodeId, inputs});
    oscService.send(nodeSetMessage(this.nodeId, inputs));
  }

  onRun(isRunning: boolean) {
    nodesApi.setRunning({nodeId: this.nodeId, isRunning});
    oscService.send(nodeRunMessage(this.nodeId, isRunning ? 1 : 0));
  }

  constructor() {
    super();
    this.nodeId = oscService.nextNodeId();
    this._group = new ContextConsumer(this, {context: nodeContext, subscribe: false});

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const ctx: NodeContext = {
      get type() { return self.type; },
      nodeId: this.nodeId,
      get loaded() { return self.loaded; },
      get running() { return self.isRunning; },
      get elements() { return self.elements; },
      get inputs(): InputElement[] {
        return self.elements.filter(isInput);
      },
      get ugens(): UGenElement[] {
        return self.elements.filter(isUGen);
      },
      get nodes() {
        return [...self.registeredElements].filter(isScNode);
      },
      registerElement: (el) => this.registerElement(el),
      unregisterElement: (el) => this.unregisterElement(el),
      onChange: (el) => this.onChange(el),
      onRun: (isRunning) => this.onRun(isRunning),
    };
    new ContextProvider(this, {context: nodeContext, initialValue: ctx});
  }


  render() {
    return html`<slot></slot>`;
  }
}
