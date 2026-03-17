import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId.ts";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode} from "../../types/parsers";
import {
    extractGroupProps, extractSynthProps, extractSynthDefProps,
    extractRangeProps, extractCheckboxProps, extractRunProps,
    extractDisplayProps, extractIfProps,
} from "./extractProps";
import {
    processGroupRuntime, processSynthRuntime, processSynthDefRuntime,
    processRangeRuntime, processCheckboxRuntime, processRunRuntime,
    processDisplayRuntime, processIfRuntime,
} from "./processRuntime";

const EXCLUDE_KEYS = new Set(['id', 'runtime', 'children']);
const PARENT_TAGS: ReadonlySet<string> = new Set([ELEMENTS.SC_GROUP, ELEMENTS.SC_IF]);
const SC_TAGS: ReadonlySet<string> = new Set([
    ELEMENTS.SC_GROUP, ELEMENTS.SC_SYNTH, ELEMENTS.SC_SYNTHDEF,
    ELEMENTS.SC_RANGE, ELEMENTS.SC_CHECKBOX, ELEMENTS.SC_RUN,
    ELEMENTS.SC_DISPLAY, ELEMENTS.SC_IF,
]);


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

function extractProps(tag: string, el: Element): Record<string, unknown> {
    switch (tag) {
        case ELEMENTS.SC_GROUP:    return {type: tag, ...extractGroupProps(el)};
        case ELEMENTS.SC_SYNTH:    return {type: tag, ...extractSynthProps(el)};
        case ELEMENTS.SC_SYNTHDEF: return {type: tag, ...extractSynthDefProps(el)};
        case ELEMENTS.SC_RANGE:    return {type: tag, ...extractRangeProps(el)};
        case ELEMENTS.SC_CHECKBOX: return {type: tag, ...extractCheckboxProps(el)};
        case ELEMENTS.SC_RUN:      return {type: tag, ...extractRunProps(el)};
        case ELEMENTS.SC_DISPLAY:  return {type: tag, ...extractDisplayProps(el)};
        case ELEMENTS.SC_IF:       return {type: tag, ...extractIfProps(el)};
        default: return {type: tag};
    }
}

function processRuntime(node: ScElementNode, scope: ScElementNode[], _ctx: WalkContext) {
    switch (node.type) {
        case ELEMENTS.SC_GROUP:    processGroupRuntime(node, scope); break;
        case ELEMENTS.SC_SYNTH:    processSynthRuntime(node, scope); break;
        case ELEMENTS.SC_SYNTHDEF: processSynthDefRuntime(node, scope); break;
        case ELEMENTS.SC_RANGE:    processRangeRuntime(node, scope); break;
        case ELEMENTS.SC_CHECKBOX: processCheckboxRuntime(node, scope); break;
        case ELEMENTS.SC_RUN:      processRunRuntime(node, scope); break;
        case ELEMENTS.SC_DISPLAY:  processDisplayRuntime(node, scope); break;
        case ELEMENTS.SC_IF:       processIfRuntime(node, scope); break;
    }
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
        node = {id, ...props} as ScElementNode;
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

export function walkChildren(ctx: WalkContext): ScElementNode[] {
    function visit(element: Element): ScElementNode[] {
        const result: ScElementNode[] = [];
        for (const child of Array.from(element.children)) {
            const tag = child.tagName.toLowerCase();
            if (SC_TAGS.has(tag)) {
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
