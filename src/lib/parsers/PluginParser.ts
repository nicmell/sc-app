import {ELEMENTS} from "@/constants/sc-elements";
import type {ScElementNode, ScPluginNode, NodeRuntime, RuntimeValueEntry} from "../../types/parsers";
import {extractProps, propsMatch} from "./extractProps";
import {processRuntime, processPluginRuntime} from "./processRuntime";

const SC_TAGS = [
    ELEMENTS.SC_GROUP,
    ELEMENTS.SC_SYNTH,
    ELEMENTS.SC_SYNTHDEF,
    ELEMENTS.SC_RANGE,
    ELEMENTS.SC_CHECKBOX,
    ELEMENTS.SC_RUN,
    ELEMENTS.SC_DISPLAY,
    ELEMENTS.SC_IF,
] as const;

export interface WalkContext {
    element: Element;
    saved?: ScElementNode;
    boxId: string;
    offset: number;
    runtime: Map<string, RuntimeValueEntry>;
    parentNode?: ScElementNode;
    scope: ScElementNode[];
    walk: (ctx: WalkContext) => ScElementNode[];
}

export interface ParseResult {
    tree: ScElementNode[];
    values: Record<string, RuntimeValueEntry>;
    runtime: NodeRuntime;
}

export function parse(element: Element, saved?: ScElementNode, boxId?: string): ParseResult {
    const ctx: WalkContext = {
        element,
        saved,
        boxId: boxId ?? '',
        offset: 0,
        runtime: new Map<string, RuntimeValueEntry>(),
        scope: [],
        walk: walkChildren,
    };
    const tree = walkChildren(ctx);

    // Process runtime for entire tree after all ids are finalized
    const pluginNode = {type: 'sc-plugin', id: ctx.boxId} as ScPluginNode;
    processPluginRuntime(pluginNode, ctx);
    processTree(tree, pluginNode, ctx);

    const values: Record<string, RuntimeValueEntry> = {};
    for (const [id, entry] of ctx.runtime) {
        values[id] = entry;
    }
    return {tree, values, runtime: pluginNode.runtime};
}

function processElement(ctx: WalkContext): ScElementNode {
    const tag = ctx.element.tagName.toLowerCase();
    const savedChildren = ctx.saved && 'children' in ctx.saved ? ctx.saved.children : undefined;
    const savedChild = savedChildren?.[ctx.offset];
    const matched = savedChild?.type === tag ? savedChild : undefined;
    if (savedChild && !matched) {
        console.warn(`[plugin hydration] tag mismatch at offset ${ctx.offset}: <${tag}> vs saved <${savedChild.type}>`);
    }

    const node = extractProps(tag, ctx.element, {...ctx, saved: matched});

    if (matched && propsMatch(node, matched)) {
        node.id = matched.id;
        ctx.element.setAttribute('id', matched.id);
    } else {
        if (matched) console.warn(`[plugin hydration] props mismatch for <${tag}>`);
        ctx.element.setAttribute('id', node.id);
    }

    return node;
}

function processTree(children: ScElementNode[], parent: ScElementNode, ctx: WalkContext) {
    ctx.scope = children;
    ctx.parentNode = parent;
    for (const child of children) {
        processRuntime(child, ctx);
        if ('children' in child) {
            processTree(child.children, child, ctx);
        }
    }
}

export function walkChildren(ctx: WalkContext): ScElementNode[] {
    function visit(element: Element): ScElementNode[] {
        const result: ScElementNode[] = [];
        for (const child of Array.from(element.children)) {
            const tag = child.tagName.toLowerCase();
            if (SC_TAGS.includes(tag as any)) {
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
