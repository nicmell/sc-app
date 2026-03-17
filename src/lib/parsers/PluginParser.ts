import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId.ts";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScRangeNode, ScCheckboxNode, ScRunNode, UGenSpec} from "../../types/parsers";
/*
import {isGroup, isInput, isRun, isSynth, isSynthDef, isVisual} from "@/lib/parsers/guards.ts";
import {findElementByPath} from "@/lib/parsers/elementTree.ts";
*/

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'running', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);
const EXCLUDE_KEYS = new Set(['id', 'runtime', 'children']);
const PARENT_TAGS: ReadonlySet<string> = new Set([ELEMENTS.SC_GROUP, ELEMENTS.SC_IF]);


export type RuntimeEntry =
    | { type: "control"; name: string, targetNode: string; boxId: string; value: number }
    | { type: "run"; targetNode: string; boxId: string; value: number }
    | { type: "synthdef"; targetNode: string; boxId: string; value: number[] };


export interface WalkContext {
    element: Element;
    saved?: ScElementNode[];
    offset: number;
    runtime: Map<string, RuntimeEntry>
}

type PropsExtractor = (el: Element) => Record<string, unknown>;


const propsExtractors: Record<string, PropsExtractor> = {
    [ELEMENTS.SC_GROUP]: (el) => ({
        name: el.getAttribute('name') ?? '',
        running: el.getAttribute('running') !== 'false',
    }),
    [ELEMENTS.SC_SYNTH]: (el) => ({
        name: el.getAttribute('name') ?? '',
        bind: el.getAttribute('bind') ?? undefined,
        controls: collectNumericAttrs(el, SYNTH_SKIP_ATTRS),
        running: el.getAttribute('running') !== 'false',
    }),
    [ELEMENTS.SC_SYNTHDEF]: (el) => ({
        name: el.getAttribute('name') ?? '',
        params: collectNumericAttrs(el, SYNTHDEF_SKIP_ATTRS),
        ugens: collectUGenSpecs(el),
    }),
    [ELEMENTS.SC_RANGE]: (el) => ({bind: el.getAttribute('bind') ?? ''}),
    [ELEMENTS.SC_CHECKBOX]: (el) => ({bind: el.getAttribute('bind') ?? ''}),
    [ELEMENTS.SC_RUN]: (el) => ({bind: el.getAttribute('bind') ?? ''}),
    [ELEMENTS.SC_DISPLAY]: (el) => ({
        bind: el.getAttribute('bind') ?? '',
        format: el.getAttribute('format') ?? '',
    }),
    [ELEMENTS.SC_IF]: (el) => ({bind: el.getAttribute('bind') ?? ''}),
};

const runtimeHandlers = {
    [ELEMENTS.SC_GROUP]: (n: ScGroupNode) => Object.assign(n, {runtime: {isRunning: n.running, controls: {}}}),
    [ELEMENTS.SC_SYNTH]: (n: ScSynthNode) => Object.assign(n, {runtime: {isRunning: n.running, controls: {...n.controls}}}),
    [ELEMENTS.SC_SYNTHDEF]: (n: ScSynthDefNode) => Object.assign(n, {runtime: {value: []}}),
    [ELEMENTS.SC_RANGE]: (n: ScRangeNode) => Object.assign(n, {runtime: {value: 0}}),
    [ELEMENTS.SC_CHECKBOX]: (n: ScCheckboxNode) => Object.assign(n, {runtime: {value: 0}}),
    [ELEMENTS.SC_RUN]: (n: ScRunNode) => Object.assign(n, {runtime: {value: 1}}),
} as Record<string, (node: ScElementNode, scope: ScElementNode[], ctx: WalkContext) => void>;


export function parse(element: Element, saved?: ScElementNode[]): ScElementNode[] {
    return walkChildren({element, saved, offset: 0, runtime: new Map<string, RuntimeEntry>});
}

function propsMatch(fresh: Record<string, unknown>, saved: ScElementNode): boolean {
    const savedProps: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(saved)) {
        if (!EXCLUDE_KEYS.has(key)) savedProps[key] = val;
    }
    return deepEqual(fresh, savedProps);
}

function extractProps(tag: string, node: Element): Record<string, unknown> {
    const extractor = propsExtractors[tag];
    return {type: tag, ...extractor?.(node)};
}

// TODO: re-enable bind validation and synthdef compilation
function processElement(ctx: WalkContext): ScElementNode {
    const tag = ctx.element.tagName.toLowerCase();
    const savedChild = ctx.saved?.[ctx.offset];
    const matched = savedChild?.type === tag ? savedChild : undefined;
    if (savedChild && !matched) {
        console.warn(`[plugin hydration] tag mismatch at offset ${ctx.offset}: <${tag}> vs saved <${savedChild.type}>`);
    }
    const props = extractProps(tag, ctx.element);
    let node: ScElementNode;

    if (matched && propsMatch(props, matched)) {
        ctx.element.setAttribute('id', matched.id);
        node = matched;
    } else {
        if (matched) console.warn(`[plugin hydration] props mismatch for <${tag}>`);
        const id = randomId();
        ctx.element.setAttribute('id', id);
        node = {...props, id} as ScElementNode;
    }

    return {
        ...node,
        ...PARENT_TAGS.has(tag) && {
            children: walkChildren({
                element: ctx.element,
                runtime: ctx.runtime,
                saved: matched && 'children' in matched ? matched.children : [],
                offset: 0,
            }),
        }
    }
}

function processRuntime(node: ScElementNode, scope: ScElementNode[], ctx: WalkContext) {
    const handler = runtimeHandlers[node.type];
    if (handler) handler(node, scope, ctx);
}

export function walkChildren(ctx: WalkContext): ScElementNode[] {
    function visit(element: Element): ScElementNode[] {
        const result: ScElementNode[] = [];
        for (const child of Array.from(element.children)) {
            const tag = child.tagName.toLowerCase();
            if (tag in propsExtractors) {
                result.push(processElement({element: child, saved: ctx.saved, offset: ctx.offset, runtime: ctx.runtime}));
                ctx.offset++;
            } else {
                result.push(...visit(child));
            }
        }
        for (const node of result) {
            processRuntime(node, result, ctx);
        }
        return result;
    }

    return visit(ctx.element);
}

function collectUGenSpecs(el: Element): UGenSpec[] {
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

function collectNumericAttrs(el: Element, skip: Set<string>): Record<string, number> {
    const params: Record<string, number> = {};
    for (const attr of Array.from(el.attributes)) {
        if (skip.has(attr.name)) continue;
        const val = Number(attr.value);
        if (!isNaN(val)) params[attr.name] = val;
    }
    return params;
}
/*

function validateBind(node: ScElementNode, scope: ScElementNode[], ctx: WalkContext) {
    console.log(ctx)
    if ("bind" in node) {
        if (isSynth(node)) {
            const segments = node.bind.split('.');
            const target = findElementByPath(scope, segments)
            if (node.bind && (!target || !isSynthDef(target))) {
                throw new Error(`<sc-synth bind="${node.bind}">: does not match any <sc-synthdef> in scope`);
            }
        }
        if (isRun(node)) {
            const segments = node.bind.split('.');
            const target = findElementByPath(scope, segments)
            if (node.bind && (!target || !isSynth(target) || isGroup(target))) {
                throw new Error(`<sc-run>: bind "${node.bind}" does not match any <sc-synth> or <sc-group> in scope`);
            }
        }
        if (isInput(node) || isVisual(node)) {
            const segments = node.bind.split('.');
            const target = findElementByPath(scope, segments.slice(0, segments.length - 1))
            if (node.bind && (!target || !isSynth(target) || isGroup(target))) {
                throw new Error(`<${node.type} bind="${node.bind}">: does not match any <sc-synth> or <sc-group> in scope`);
            }
        }
    }
}
*/
