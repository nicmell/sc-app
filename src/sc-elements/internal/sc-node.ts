import {LitElement, html} from 'lit';
import {ContextProvider, ContextConsumer} from '@lit/context';
import {oscService} from '@/lib/osc';
import {nodeRunMessage, nodeSetMessage} from '@/lib/osc/messages.ts';
import {nodesApi} from '@/lib/stores/api';
import {nodeContext, type NodeContext, type ScNode as IScNode, type ScElement, type ScUGenData} from '../context.ts';

export abstract class ScNode extends LitElement implements IScNode {
  readonly nodeId: number;
  protected registeredElements = new Set<ScElement>();
  protected registeredUGens: ScUGenData[] = [];
  protected _group!: ContextConsumer<{__context__: NodeContext}, this>;

  protected abstract get type(): 'synth' | 'group';
  abstract get isRunning(): boolean;
  abstract get inputs(): Record<string, any>;

  get loaded() {
    return nodesApi.items.some(n => n.nodeId === this.nodeId);
  }

  registerElement(el: ScElement) {
    this.registeredElements.add(el);
  }

  unregisterElement(el: ScElement) {
    this.registeredElements.delete(el);
  }

  registerUGen(el: ScUGenData) {
    this.registeredUGens.push(el);
  }

  unregisterUGen(el: ScUGenData) {
    const idx = this.registeredUGens.indexOf(el);
    if (idx >= 0) this.registeredUGens.splice(idx, 1);
  }

  registerNode(_node: IScNode) {}

  unregisterNode(_node: IScNode) {}

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
      get inputs() { return self.inputs; },
      registerElement: (el) => this.registerElement(el),
      unregisterElement: (el) => this.unregisterElement(el),
      registerUGen: (el) => this.registerUGen(el),
      unregisterUGen: (el) => this.unregisterUGen(el),
      registerNode: (node) => this.registerNode(node),
      unregisterNode: (node) => this.unregisterNode(node),
      onChange: (el) => this.onChange(el),
      onRun: (isRunning) => this.onRun(isRunning),
    };
    new ContextProvider(this, {context: nodeContext, initialValue: ctx});
  }


  render() {
    return html`<slot></slot>`;
  }
}
