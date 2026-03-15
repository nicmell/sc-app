import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId.ts";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {
    ScElementNode,
    ScPluginNode,
    ScGroupNode,
    ScSynthNode,
    ScSynthDefNode,
    ScRangeNode,
    ScCheckboxNode,
    ScRunNode,
    ScMidiNode,
    UGenSpec,
    PluginTreeEntry
} from "../../types/parsers";
import {compileSynthDef} from "./SynthDefCompiler";
import {findElementByPath} from "./elementTree";
import {isSynth, isGroup, isNode} from "./guards";
import {runtimeApi} from "@/lib/stores/api.ts";
import {RuntimeEntry} from "@/types/stores";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'is-running', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);

interface WalkContext {
    saved?: ScElementNode[];
    scope: ScElementNode[];
    offset: number;
    boxId: string;
    runtime: RuntimeEntry[];
}

interface ElementContext {
    el: Element;
    id: string;
}

type ElementHandler = (ectx: ElementContext, ctx: WalkContext) => ScElementNode;

export class PluginParser {
    private readonly handlers: Record<string, ElementHandler> = {
        [ELEMENTS.SC_GROUP]: (ectx, ctx) => this.processGroup(ectx, ctx),
        [ELEMENTS.SC_SYNTH]: (ectx, ctx) => this.processSynth(ectx, ctx),
        [ELEMENTS.SC_SYNTHDEF]: (ectx, ctx) => this.processSynthDef(ectx, ctx),
        [ELEMENTS.SC_RANGE]: (ectx, ctx) => this.processRange(ectx, ctx),
        [ELEMENTS.SC_CHECKBOX]: (ectx, ctx) => this.processCheckbox(ectx, ctx),
        [ELEMENTS.SC_RUN]: (ectx, ctx) => this.processRun(ectx, ctx),
        [ELEMENTS.SC_MIDI]: (ectx, ctx) => this.processMidi(ectx, ctx),
    };

    private static readonly BIND_ONLY_TAGS: Set<string> = new Set([ELEMENTS.SC_DISPLAY, ELEMENTS.SC_IF]);

    parse(node: Element, boxId: string): PluginTreeEntry {
        const saved = runtimeApi.getBox(boxId);
        const ctx: WalkContext = {offset: 0, saved: saved?.children, scope: [], boxId, runtime: []};
        const children = this.walkChildren(node, ctx);
        const html = node.innerHTML;
        const title = node.querySelector('title')?.textContent ?? undefined;
        const plugin: ScPluginNode = {type: 'sc-plugin', id: boxId, boxId, children, runtime: {loaded: true, title, entries: ctx.runtime}};

        return {plugin, html};
    }

    private walkChildren(node: Element, ctx: WalkContext): ScElementNode[] {
        const result: ScElementNode[] = [];
        for (const child of Array.from(node.children)) {
            const tag = child.tagName.toLowerCase();
            if (tag in this.handlers) {
                result.push(this.processElement(child, tag, ctx));
            } else if (PluginParser.BIND_ONLY_TAGS.has(tag)) {
                this.resolveBindEntry(child, ctx);
                result.push(...this.walkChildren(child, ctx));
            } else {
                result.push(...this.walkChildren(child, ctx));
            }
        }
        return result;
    }

    private processElement(el: Element, tag: string, ctx: WalkContext): ScElementNode {
        ctx.offset++;
        const id = el.getAttribute('id') || randomId();
        const node = this.handlers[tag]({el, id}, ctx);
        el.setAttribute('id', node.id);
        ctx.scope.push(node);
        return node;
    }

    private processGroup({el, id}: ElementContext, _ctx: WalkContext): ScGroupNode {
        const name = el.getAttribute('name') ?? '';
        const groupSaved = _ctx.saved?.[_ctx.offset - 1] as ScGroupNode | undefined;
        const savedChildren = groupSaved?.type === 'sc-group' && groupSaved.name === name
            ? groupSaved.children
            : undefined;
        const isRunning = el.getAttribute('is-running') !== 'false';

        const rEntryId = randomId();
        _ctx.runtime.push({id: rEntryId, type: "run", targetNode: id, boxId: _ctx.boxId, value: isRunning ? 1 : 0});

        const groupNode: ScGroupNode = {type: 'sc-group', id, boxId: _ctx.boxId, name, isRunning, children: [], runtime: {run: rEntryId, controls: {}}};
        groupNode.children = this.walkChildren(el, {
            saved: savedChildren,
            offset: 0,
            scope: [..._ctx.scope, groupNode],
            boxId: _ctx.boxId,
            runtime: _ctx.runtime
        });
        return groupNode;
    }

    private processSynth({el, id}: ElementContext, ctx: WalkContext): ScSynthNode {
        const name = el.getAttribute('name') ?? '';
        const bind = el.getAttribute('bind') ?? undefined;
        const controls = this.collectNumericAttrs(el, SYNTH_SKIP_ATTRS);
        if (bind && !ctx.scope.some(n => n.type === 'sc-synthdef' && n.name === bind)) {
            throw new Error(`<sc-synth name="${name}">: bind "${bind}" does not match any <sc-synthdef> in scope`);
        }
        const isRunning = el.getAttribute('is-running') !== 'false';

        const controlEntries: Record<string, string> = {};
        for (const [controlName, defaultValue] of Object.entries(controls)) {
            const entryId = randomId();
            ctx.runtime.push({id: entryId, type: "control", targetNode: id, boxId: ctx.boxId, value: defaultValue});
            controlEntries[controlName] = entryId;
        }

        const rEntryId = randomId();
        ctx.runtime.push({id: rEntryId, type: "run", targetNode: id, boxId: ctx.boxId, value: isRunning ? 1 : 0});

        return {type: 'sc-synth', id, boxId: ctx.boxId, name, bind, controls, isRunning, runtime: {run: rEntryId, controls: controlEntries}};
    }

    private processSynthDef({el, id}: ElementContext, ctx: WalkContext): ScSynthDefNode {
        const name = el.getAttribute('name') ?? '';
        const params = this.collectNumericAttrs(el, SYNTHDEF_SKIP_ATTRS);
        const ugens = this.collectUGenSpecs(el);

        const saved = ctx.saved?.[ctx.offset - 1];
        const savedDef = saved?.type === 'sc-synthdef' ? saved as ScSynthDefNode : undefined;

        let bytes: number[];
        if (savedDef && savedDef.runtime && deepEqual(params, savedDef.params) && deepEqual(ugens, savedDef.ugens)) {
            // Reuse saved bytes entry
            const savedEntry = runtimeApi.entries.find(e => e.id === savedDef.runtime.bytes);
            bytes = savedEntry?.type === 'synthdef' ? savedEntry.value : compileSynthDef(name, params, new Map(ugens.map(s => [s.name, s])));
        } else {
            const specsMap = new Map<string, UGenSpec>();
            for (const spec of ugens) specsMap.set(spec.name, spec);
            bytes = compileSynthDef(name, params, specsMap);
        }

        const entryId = randomId();
        ctx.runtime.push({id: entryId, type: "synthdef", targetNode: id, boxId: ctx.boxId, value: bytes});

        return {type: 'sc-synthdef', id, boxId: ctx.boxId, name, params, ugens, runtime: {bytes: entryId}};
    }

    private processRange({el, id}: ElementContext, ctx: WalkContext): ScRangeNode {
        const {bind, value, entryId} = this.resolveBindEntry(el, ctx);
        return {type: 'sc-range', id, boxId: ctx.boxId, bind, value, runtime: {value: entryId}};
    }

    private processCheckbox({el, id}: ElementContext, ctx: WalkContext): ScCheckboxNode {
        const {bind, value, entryId} = this.resolveBindEntry(el, ctx);
        return {type: 'sc-checkbox', id, boxId: ctx.boxId, bind, value, runtime: {value: entryId}};
    }

    private processRun({el, id}: ElementContext, ctx: WalkContext): ScRunNode {
        const bind = el.getAttribute('bind') ?? '';
        let rEntryId: string;
        if (bind) {
            const target = ctx.scope.find(n => 'name' in n && n.name === bind);
            if (!target || !isNode(target)) {
                throw new Error(`<sc-run>: bind "${bind}" does not reference a valid sc-synth or sc-group`);
            }
            rEntryId = target.runtime.run;
        } else {
            // Find parent node in scope (last node walking backwards)
            const parent = [...ctx.scope].reverse().find(n => isNode(n));
            if (parent && isNode(parent)) {
                rEntryId = parent.runtime.run;
            } else {
                // Fallback: create a standalone run entry
                rEntryId = randomId();
                ctx.runtime.push({id: rEntryId, type: "run", targetNode: id, boxId: ctx.boxId, value: 1});
            }
        }
        return {type: 'sc-run', id, boxId: ctx.boxId, bind, value: 1, runtime: {value: rEntryId}};
    }

    private processMidi({el, id}: ElementContext, ctx: WalkContext): ScMidiNode {
        const {bind, value, entryId} = this.resolveBindEntry(el, ctx);
        const octaves = Number(el.getAttribute('octaves')) || 2;
        const octave = Number(el.getAttribute('octave')) || 4;
        return {type: 'sc-midi', id, boxId: ctx.boxId, bind, value, octaves, octave, runtime: {value: entryId}};
    }

    private resolveBindEntry(el: Element, ctx: WalkContext): { bind: string; value: number; entryId: string } {
        const bind = el.getAttribute('bind') ?? '';
        if (!bind) return {bind, value: 0, entryId: ''};
        const segments = bind.split('.');
        const control = segments.pop()!;
        const target = findElementByPath(ctx.scope, segments);
        if (!target) {
            throw new Error(`<${el.tagName.toLowerCase()}>: bind path "${bind}" does not resolve`);
        }
        if (isSynth(target)) {
            if (!(control in target.controls)) {
                throw new Error(`<${el.tagName.toLowerCase()}>: bind path "${bind}" does not resolve`);
            }
            const entryId = target.runtime.controls[control];
            const entry = ctx.runtime.find(e => e.id === entryId);
            const value = entry && entry.type === 'control' ? entry.value : target.controls[control];
            return {bind, value, entryId};
        }
        if (isGroup(target)) {
            // Check if group already has an entry for this control
            const existingEntryId = target.runtime.controls[control];
            if (existingEntryId) {
                const entry = ctx.runtime.find(e => e.id === existingEntryId);
                const value = entry && entry.type === 'control' ? entry.value : 0;
                return {bind, value, entryId: existingEntryId};
            }
            // Find a synth in scope that has this control to get default value
            const synth = ctx.scope.find(n => isSynth(n) && control in n.controls);
            if (!synth || !isSynth(synth)) {
                throw new Error(`<${el.tagName.toLowerCase()}>: no synth in scope has control "${control}"`);
            }
            const entryId = randomId();
            const value = synth.controls[control];
            ctx.runtime.push({id: entryId, type: "control", targetNode: target.id, boxId: ctx.boxId, value});
            target.runtime.controls[control] = entryId;
            return {bind, value, entryId};
        }
        throw new Error(`<${el.tagName.toLowerCase()}>: bind path "${bind}" does not resolve`);
    }

    private collectUGenSpecs(el: Element): UGenSpec[] {
        const specs: UGenSpec[] = [];

        function walk(node: Element): void {
            for (const child of Array.from(node.children)) {
                if (child.tagName.toLowerCase() === ELEMENTS.SC_UGEN) {
                    const name = child.getAttribute('name');
                    const type = child.getAttribute('type');
                    if (name && type) {
                        const rate = child.getAttribute('rate') ?? 'ar';
                        const inputs: Record<string, string> = {};
                        for (const attr of Array.from(child.attributes)) {
                            if (!UGEN_SKIP_ATTRS.has(attr.name)) inputs[attr.name] = attr.value;
                        }
                        specs.push({name, type, rate, inputs});
                    }
                }
                walk(child);
            }
        }

        walk(el);
        return specs;
    }

    private collectNumericAttrs(el: Element, skip: Set<string>): Record<string, number> {
        const params: Record<string, number> = {};
        for (const attr of Array.from(el.attributes)) {
            if (skip.has(attr.name)) continue;
            const val = Number(attr.value);
            if (!isNaN(val)) params[attr.name] = val;
        }
        return params;
    }
}
