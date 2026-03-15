import {randomId} from "@/lib/utils/randomId.ts";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {
    ScElementNode,
} from "../../types/parsers";
import {RuntimeEntry} from "@/types/stores";

export {isPlugin, isGroup, isSynth, isNode, isInput, isRun} from "./guards";
export {findElementById, findElementByPath, stripRuntime} from "./elementTree";
export type {PluginTreeEntry, ScPluginNode, PluginRuntime, ScElementNode, ScGroupNode, ScSynthNode, ScSynthDefNode, SynthDefRuntime, ScRangeNode, ScCheckboxNode, ScRunNode, ScMidiNode, UGenSpec, NodeRuntime, InputRuntime} from "../../types/parsers";

import {findElementByPath} from "./elementTree";
import {isSynth, isGroup} from "./guards";
import {getHandler} from "./handlers";
import type {ElementHandler} from "./handlers";

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

export function parse(node: Element, boxId: string): ParseContext {
    return processElement({el: node, id: boxId, offset: 0, scope: [], boxId, runtime: [], elements: []});
}

function resolveId(tag: string, el: Element, ctx: ParseContext, handler: ElementHandler): string {
    const saved = ctx.saved?.[ctx.offset - 1];
    if (saved && saved.type === tag) {
        const props: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(saved)) {
            if (!MATCH_EXCLUDE_KEYS.has(key)) props[key] = val;
        }
        const htmlProps = handler.extractProps(el);
        if (deepEqual(props, htmlProps)) {
            return saved.id;
        }
    }
    return randomId();
}

function processElement(ctx: ParseContext): ParseContext {
    const tag = ctx.el.tagName.toLowerCase();
    const handler = getHandler(tag);

    // 1. ID resolution
    ctx.offset++;
    ctx.id = resolveId(tag, ctx.el, ctx, handler);
    ctx.el.setAttribute('id', ctx.id);

    // 2. Validate bindings
    handler.validateBindings(ctx);

    // 3. Walk children if handler provides a child context
    const childCtx = handler.childContext(ctx);
    if (childCtx) walkChildren(childCtx);

    // 4. Process node (build element, push entries)
    return handler.process(ctx);
}

export function walkChildren(ctx: ParseContext): ParseContext {
    for (const child of Array.from(ctx.el.children)) {
        processElement({...ctx, el: child});
    }
    return ctx;
}

export function resolveBindEntry(el: Element, ctx: ParseContext): { bind: string; value: number; entryId: string } {
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
