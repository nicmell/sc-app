import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNodeBase, ProcessHtmlResult} from "@/types/parsers";
import {
    extractGroupProps, extractSynthProps, extractSynthDefProps,
    extractRangeProps, extractCheckboxProps, extractRunProps,
    extractDisplayProps, extractIfProps,
} from "./handlers";

const EXCLUDE_KEYS = new Set(['id', 'runtime', 'children']);
const PARENT_TAGS: ReadonlySet<string> = new Set([ELEMENTS.SC_GROUP, ELEMENTS.SC_IF, ELEMENTS.SC_PLUGIN]);
const SC_TAGS: ReadonlySet<string> = new Set([
    ELEMENTS.SC_GROUP, ELEMENTS.SC_SYNTH, ELEMENTS.SC_SYNTHDEF,
    ELEMENTS.SC_RANGE, ELEMENTS.SC_CHECKBOX, ELEMENTS.SC_RUN,
    ELEMENTS.SC_DISPLAY, ELEMENTS.SC_IF,
]);

interface HtmlWalkContext {
    element: Element;
    saved?: ScElementNodeBase[];
    offset: number;
    nodes: Map<string, ScElementNodeBase>;
}

function propsMatch(fresh: Record<string, unknown>, saved: ScElementNodeBase): boolean {
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

function processElement(ctx: HtmlWalkContext): ScElementNodeBase {
    const tag = ctx.element.tagName.toLowerCase();
    const savedChild = ctx.saved?.[ctx.offset];
    const matched = savedChild?.type === tag ? savedChild : undefined;
    if (savedChild && !matched) {
        console.warn(`[plugin hydration] tag mismatch at offset ${ctx.offset}: <${tag}> vs saved <${savedChild.type}>`);
    }
    const props = extractProps(tag, ctx.element);
    let node: ScElementNodeBase;

    if (matched && propsMatch(props, matched)) {
        ctx.element.setAttribute('id', matched.id);
        node = matched;
    } else {
        if (matched) console.warn(`[plugin hydration] props mismatch for <${tag}>`);
        const id = randomId();
        ctx.element.setAttribute('id', id);
        node = {id, ...props} as ScElementNodeBase;
    }

    const result: ScElementNodeBase = {
        ...node,
        ...PARENT_TAGS.has(tag) && {
            children: walkChildren({
                element: ctx.element,
                nodes: ctx.nodes,
                saved: matched && 'children' in matched ? (matched as {children: ScElementNodeBase[]}).children : [],
                offset: 0,
            }),
        }
    } as ScElementNodeBase;

    // Populate nodes map with the final object (shared reference)
    ctx.nodes.set(result.id, result);

    return result;
}

function walkChildren(ctx: HtmlWalkContext): ScElementNodeBase[] {
    function visit(element: Element): ScElementNodeBase[] {
        const result: ScElementNodeBase[] = [];
        for (const child of Array.from(element.children)) {
            const tag = child.tagName.toLowerCase();
            if (SC_TAGS.has(tag)) {
                result.push(processElement({...ctx, element: child}));
                ctx.offset++;
            } else {
                result.push(...visit(child));
            }
        }
        return result;
    }

    return visit(ctx.element);
}

export function processHtml(
    docElement: Element,
    saved?: ScElementNodeBase[],
): ProcessHtmlResult {
    const nodes = new Map<string, ScElementNodeBase>();
    const tree = walkChildren({
        element: docElement,
        saved,
        offset: 0,
        nodes,
    });
    return {tree, nodes};
}
