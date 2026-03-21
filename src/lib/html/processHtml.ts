import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, ScElementNodeBase, ProcessHtmlResult} from "@/types/parsers";
import {isNodeType} from "@/lib/utils/guards";
import {
    extractGroupProps, extractSynthProps, extractSynthDefProps, extractUgenProps,
    extractRangeProps, extractCheckboxProps, extractRunProps,
    extractDisplayProps, extractIfProps,
} from "./handlers";

const EXCLUDE_KEYS = new Set(['id', 'runtime', 'children', 'loaded', 'error', 'title']);
const PARENT_TAGS: ReadonlySet<string> = new Set([ELEMENTS.SC_GROUP, ELEMENTS.SC_IF, ELEMENTS.SC_PLUGIN, ELEMENTS.SC_SYNTHDEF]);
const NODE_TAGS: ReadonlySet<string> = new Set([ELEMENTS.SC_GROUP, ELEMENTS.SC_SYNTH, ELEMENTS.SC_PLUGIN]);
const INPUT_TAGS: ReadonlySet<string> = new Set([ELEMENTS.SC_RANGE, ELEMENTS.SC_CHECKBOX, ELEMENTS.SC_RUN, ELEMENTS.SC_DISPLAY, ELEMENTS.SC_IF]);

function tagToType(tag: string): string {
    if (tag === 'html') return ELEMENTS.SC_PLUGIN;
    return tag as keyof typeof ELEMENTS;
}

function defaultRuntime(type: string): Record<string, unknown> {
    if (NODE_TAGS.has(type)) return {run: '', controls: {}};
    if (INPUT_TAGS.has(type)) return {value: ''};
    return {};
}

function propsMatch(fresh: Record<string, unknown>, saved: ScElementNodeBase): boolean {
    const savedProps: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(saved)) {
        if (!EXCLUDE_KEYS.has(key)) savedProps[key] = val;
    }
    return deepEqual(fresh, savedProps);
}

function extractProps(type: string, el: Element): Record<string, unknown> {
    switch (type) {
        case ELEMENTS.SC_PLUGIN:   return {type};
        case ELEMENTS.SC_GROUP:    return {type, ...extractGroupProps(el)};
        case ELEMENTS.SC_SYNTH:    return {type, ...extractSynthProps(el)};
        case ELEMENTS.SC_SYNTHDEF: return {type, ...extractSynthDefProps(el)};
        case ELEMENTS.SC_UGEN:     return {type, ...extractUgenProps(el)};
        case ELEMENTS.SC_RANGE:    return {type, ...extractRangeProps(el)};
        case ELEMENTS.SC_CHECKBOX: return {type, ...extractCheckboxProps(el)};
        case ELEMENTS.SC_RUN:      return {type, ...extractRunProps(el)};
        case ELEMENTS.SC_DISPLAY:  return {type, ...extractDisplayProps(el)};
        case ELEMENTS.SC_IF:       return {type, ...extractIfProps(el)};
        default: return {type};
    }
}

function processElement(
    element: Element,
    saved: ScElementNodeBase | undefined,
    nodes: Map<string, ScElementNode>,
): ScElementNode {
    const tag = element.tagName.toLowerCase();
    const type = tagToType(tag);
    const matched = saved?.type === type ? saved : undefined;
    if (saved && !matched) {
        console.warn(`[plugin hydration] type mismatch: <${tag}> (${type}) vs saved <${saved.type}>`);
    }
    const props = extractProps(type, element);
    let node: ScElementNodeBase;

    if (matched && propsMatch(props, matched)) {
        element.setAttribute('id', matched.id);
        node = matched;
    } else {
        if (matched) console.warn(`[plugin hydration] props mismatch for <${tag}>`);
        const id = randomId();
        element.setAttribute('id', id);
        node = {id, ...props} as ScElementNodeBase;
    }

    const savedChildren = matched && 'children' in matched
        ? (matched as {children: ScElementNodeBase[]}).children
        : [];

    const result = {
        ...node,
        runtime: defaultRuntime(type),
        ...PARENT_TAGS.has(type) && {
            children: walkChildren(element, savedChildren, nodes),
        },
    } as unknown as ScElementNode;

    nodes.set(result.id, result);
    return result;
}

function walkChildren(
    element: Element,
    saved: ScElementNodeBase[],
    nodes: Map<string, ScElementNode>,
): ScElementNode[] {
    let offset = 0;
    function visit(el: Element): ScElementNode[] {
        const result: ScElementNode[] = [];
        for (const child of Array.from(el.children)) {
            const tag = child.tagName.toLowerCase();
            if (isNodeType(tag)) {
                result.push(processElement(child, saved[offset], nodes));
                offset++;
            } else {
                result.push(...visit(child));
            }
        }
        return result;
    }
    return visit(element);
}

export function processHtml(
    docElement: Element,
    saved?: ScElementNodeBase,
): ProcessHtmlResult {
    const nodes = new Map<string, ScElementNode>();
    const root = processElement(docElement, saved, nodes);
    const children = 'children' in root ? (root as {children: ScElementNode[]}).children : [];
    return {tree: children, nodes};
}
