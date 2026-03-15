import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId.ts";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {
    ScElementNode,
    ScPluginNode,
    ScGroupNode,
    ScSynthNode,
    ScSynthDefNode,
    UGenSpec
} from "../../types/parsers";
import {compileSynthDef} from "./SynthDefCompiler";
import {findElementByPath} from "./elementTree";
import {isSynth, isGroup, isNode} from "./guards";
import {runtimeApi} from "@/lib/stores/api.ts";
import {RuntimeEntry} from "@/types/stores";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'is-running', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);

const MATCH_EXCLUDE_KEYS = new Set(['id', 'boxId', 'runtime', 'children']);

export interface ParseContext {
    el: Element;
    id: string;
    saved?: ScElementNode[];
    scope: ScElementNode[];
    offset: number;
    boxId: string;
    runtime: RuntimeEntry[];
    elements: ScElementNode[];
}

export class PluginParser {

    parse(node: Element, boxId: string): ParseContext {
        const ctx: ParseContext = {el: node, id: boxId, offset: 0, scope: [], boxId, runtime: [], elements: []};
        return this.processElement(ctx);
    }

    private resolveId(tag: string, el: Element, ctx: ParseContext): string {
        const saved = ctx.saved?.[ctx.offset - 1];
        if (saved && saved.type === tag) {
            const props: Record<string, unknown> = {};
            for (const [key, val] of Object.entries(saved)) {
                if (!MATCH_EXCLUDE_KEYS.has(key)) props[key] = val;
            }
            const htmlProps = this.extractProps(tag, el);
            if (deepEqual(props, htmlProps)) {
                return saved.id;
            }
        }
        return randomId();
    }

    private extractProps(tag: string, el: Element): Record<string, unknown> {
        switch (tag) {
            case ELEMENTS.SC_GROUP:
                return {
                    type: 'sc-group',
                    name: el.getAttribute('name') ?? '',
                    isRunning: el.getAttribute('is-running') !== 'false',
                };
            case ELEMENTS.SC_SYNTH:
                return {
                    type: 'sc-synth',
                    name: el.getAttribute('name') ?? '',
                    bind: el.getAttribute('bind') ?? undefined,
                    isRunning: el.getAttribute('is-running') !== 'false',
                    controls: this.collectNumericAttrs(el, SYNTH_SKIP_ATTRS),
                };
            case ELEMENTS.SC_SYNTHDEF:
                return {
                    type: 'sc-synthdef',
                    name: el.getAttribute('name') ?? '',
                    params: this.collectNumericAttrs(el, SYNTHDEF_SKIP_ATTRS),
                    ugens: this.collectUGenSpecs(el),
                };
            case ELEMENTS.SC_RANGE:
                return {
                    type: 'sc-range',
                    bind: el.getAttribute('bind') ?? '',
                    value: Number(el.getAttribute('value')) || 0,
                };
            case ELEMENTS.SC_CHECKBOX:
                return {
                    type: 'sc-checkbox',
                    bind: el.getAttribute('bind') ?? '',
                    value: Number(el.getAttribute('value')) || 0,
                };
            case ELEMENTS.SC_RUN:
                return {
                    type: 'sc-run',
                    bind: el.getAttribute('bind') ?? '',
                    value: 1,
                };
            case ELEMENTS.SC_MIDI:
                return {
                    type: 'sc-midi',
                    bind: el.getAttribute('bind') ?? '',
                    value: Number(el.getAttribute('value')) || 0,
                    octaves: Number(el.getAttribute('octaves')) || 2,
                    octave: Number(el.getAttribute('octave')) || 4,
                };
            default:
                return {type: tag};
        }
    }

    private processElement(ctx: ParseContext): ParseContext {
        const tag = ctx.el.tagName.toLowerCase();
        ctx.offset++;
        ctx.id = this.resolveId(tag, ctx.el, ctx);
        ctx.el.setAttribute('id', ctx.id);
        switch (tag) {
            case ELEMENTS.SC_PLUGIN: this.processPlugin(ctx); break;
            case ELEMENTS.SC_GROUP: this.processGroup(ctx); break;
            case ELEMENTS.SC_SYNTH: this.processSynth(ctx); break;
            case ELEMENTS.SC_SYNTHDEF: this.processSynthDef(ctx); break;
            case ELEMENTS.SC_RANGE: this.processRange(ctx); break;
            case ELEMENTS.SC_CHECKBOX: this.processCheckbox(ctx); break;
            case ELEMENTS.SC_RUN: this.processRun(ctx); break;
            case ELEMENTS.SC_MIDI: this.processMidi(ctx); break;
            case ELEMENTS.SC_DISPLAY:
            case ELEMENTS.SC_IF: this.resolveBindEntry(ctx.el, ctx); this.walkChildren(ctx); break;
            default: this.walkChildren(ctx); break;
        }
        return ctx;
    }

    private walkChildren(ctx: ParseContext): ParseContext {
        for (const child of Array.from(ctx.el.children)) {
            this.processElement({...ctx, el: child});
        }
        return ctx;
    }

    private processPlugin(ctx: ParseContext): ParseContext {
        const saved = runtimeApi.getBox(ctx.id);
        const children: ScElementNode[] = [];
        this.walkChildren({...ctx, saved: saved?.children, elements: children});
        const node: ScPluginNode = {type: 'sc-plugin', id: ctx.id, children, runtime: {loaded: true, title: ctx.el.querySelector('title')?.textContent ?? undefined}};
        ctx.elements.push(node);
        ctx.scope.push(node);
        return ctx;
    }

    private processGroup(ctx: ParseContext): ParseContext {
        const name = ctx.el.getAttribute('name') ?? '';
        const groupSaved = ctx.saved?.[ctx.offset - 1] as ScGroupNode | undefined;
        const savedChildren = groupSaved?.type === 'sc-group' && groupSaved.name === name
            ? groupSaved.children
            : undefined;
        const isRunning = ctx.el.getAttribute('is-running') !== 'false';

        const rEntryId = randomId();
        ctx.runtime.push({id: rEntryId, type: "run", targetNode: ctx.id, boxId: ctx.boxId, value: isRunning ? 1 : 0});

        const children: ScElementNode[] = [];
        const groupNode: ScGroupNode = {type: 'sc-group', id: ctx.id, boxId: ctx.boxId, name, isRunning, children, runtime: {run: rEntryId, controls: {}}};
        this.walkChildren({
            ...ctx,
            saved: savedChildren,
            offset: 0,
            scope: [...ctx.scope, groupNode],
            elements: children,
        });
        ctx.elements.push(groupNode);
        ctx.scope.push(groupNode);
        return ctx;
    }

    private processSynth(ctx: ParseContext): ParseContext {
        const name = ctx.el.getAttribute('name') ?? '';
        const bind = ctx.el.getAttribute('bind') ?? undefined;
        const controls = this.collectNumericAttrs(ctx.el, SYNTH_SKIP_ATTRS);
        if (bind && !ctx.scope.some(n => n.type === 'sc-synthdef' && n.name === bind)) {
            throw new Error(`<sc-synth name="${name}">: bind "${bind}" does not match any <sc-synthdef> in scope`);
        }
        const isRunning = ctx.el.getAttribute('is-running') !== 'false';

        const controlEntries: Record<string, string> = {};
        for (const [controlName, defaultValue] of Object.entries(controls)) {
            const entryId = randomId();
            ctx.runtime.push({id: entryId, type: "control", targetNode: ctx.id, boxId: ctx.boxId, value: defaultValue});
            controlEntries[controlName] = entryId;
        }

        const rEntryId = randomId();
        ctx.runtime.push({id: rEntryId, type: "run", targetNode: ctx.id, boxId: ctx.boxId, value: isRunning ? 1 : 0});

        const node: ScSynthNode = {type: 'sc-synth', id: ctx.id, boxId: ctx.boxId, name, bind, controls, isRunning, runtime: {run: rEntryId, controls: controlEntries}};
        ctx.elements.push(node);
        ctx.scope.push(node);
        return ctx;
    }

    private processSynthDef(ctx: ParseContext): ParseContext {
        const name = ctx.el.getAttribute('name') ?? '';
        const params = this.collectNumericAttrs(ctx.el, SYNTHDEF_SKIP_ATTRS);
        const ugens = this.collectUGenSpecs(ctx.el);

        const saved = ctx.saved?.[ctx.offset - 1];
        const savedDef = saved?.type === 'sc-synthdef' ? saved as ScSynthDefNode : undefined;

        let bytes: number[];
        if (savedDef && savedDef.runtime &&
            deepEqual(params, savedDef.params) &&
            deepEqual(ugens, savedDef.ugens)
        ) {
            const savedEntry = runtimeApi.entries.find(e => e.id === savedDef.runtime.bytes);
            bytes = savedEntry?.type === 'synthdef' ? savedEntry.value : compileSynthDef(name, params, new Map(ugens.map(s => [s.name, s])));
        } else {
            const specsMap = new Map<string, UGenSpec>();
            for (const spec of ugens) specsMap.set(spec.name, spec);
            bytes = compileSynthDef(name, params, specsMap);
        }

        const entryId = randomId();
        ctx.runtime.push({id: entryId, type: "synthdef", targetNode: ctx.id, boxId: ctx.boxId, value: bytes});

        const node: ScSynthDefNode = {type: 'sc-synthdef', id: ctx.id, boxId: ctx.boxId, name, params, ugens, runtime: {bytes: entryId}};
        ctx.elements.push(node);
        ctx.scope.push(node);
        return ctx;
    }

    private processRange(ctx: ParseContext): ParseContext {
        const {bind, value, entryId} = this.resolveBindEntry(ctx.el, ctx);
        ctx.elements.push({type: 'sc-range', id: ctx.id, boxId: ctx.boxId, bind, value, runtime: {value: entryId}});
        return ctx;
    }

    private processCheckbox(ctx: ParseContext): ParseContext {
        const {bind, value, entryId} = this.resolveBindEntry(ctx.el, ctx);
        ctx.elements.push({type: 'sc-checkbox', id: ctx.id, boxId: ctx.boxId, bind, value, runtime: {value: entryId}});
        return ctx;
    }

    private processRun(ctx: ParseContext): ParseContext {
        const bind = ctx.el.getAttribute('bind') ?? '';
        let rEntryId: string;
        if (bind) {
            const target = ctx.scope.find(n => 'name' in n && n.name === bind);
            if (!target || !isNode(target)) {
                throw new Error(`<sc-run>: bind "${bind}" does not reference a valid sc-synth or sc-group`);
            }
            rEntryId = target.runtime.run;
        } else {
            const parent = [...ctx.scope].reverse().find(n => isNode(n));
            if (parent && isNode(parent)) {
                rEntryId = parent.runtime.run;
            } else {
                rEntryId = randomId();
                ctx.runtime.push({id: rEntryId, type: "run", targetNode: ctx.id, boxId: ctx.boxId, value: 1});
            }
        }
        ctx.elements.push({type: 'sc-run', id: ctx.id, boxId: ctx.boxId, bind, value: 1, runtime: {value: rEntryId}});
        return ctx;
    }

    private processMidi(ctx: ParseContext): ParseContext {
        const {bind, value, entryId} = this.resolveBindEntry(ctx.el, ctx);
        const octaves = Number(ctx.el.getAttribute('octaves')) || 2;
        const octave = Number(ctx.el.getAttribute('octave')) || 4;
        ctx.elements.push({type: 'sc-midi', id: ctx.id, boxId: ctx.boxId, bind, value, octaves, octave, runtime: {value: entryId}});
        return ctx;
    }

    private resolveBindEntry(el: Element, ctx: ParseContext): { bind: string; value: number; entryId: string } {
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
            const existingEntryId = target.runtime.controls[control];
            if (existingEntryId) {
                const entry = ctx.runtime.find(e => e.id === existingEntryId);
                const value = entry && entry.type === 'control' ? entry.value : 0;
                return {bind, value, entryId: existingEntryId};
            }
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
