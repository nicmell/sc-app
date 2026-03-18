import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import type {ScElementNode, ScPluginNode, NodeRuntime, RuntimeValueEntry} from "../../types/parsers";
import {extractProps, propsMatch} from "./extractProps";
import {processRuntime} from "./processRuntime";

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
    node: ScElementNode;
    element: Element;
    saved?: ScElementNode[];
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
        node: {} as ScElementNode,
        element,
        saved: saved ? [saved] : [],
        boxId: boxId ?? '',
        offset: 0,
        runtime: new Map<string, RuntimeValueEntry>(),
        scope: [],
        walk: walkChildren,
    };

    const pluginNode = {type: 'sc-plugin', id: ctx.boxId, runtime: {}} as ScPluginNode;
    processRuntime({...ctx, node: pluginNode});

    const values: Record<string, RuntimeValueEntry> = {};
    for (const [id, entry] of ctx.runtime) {
        values[id] = entry;
    }
    return {tree: pluginNode.children, values, runtime: pluginNode.runtime};
}

function processElement(ctx: WalkContext): ScElementNode {
    const tag = ctx.element.tagName.toLowerCase();
    const savedChild = ctx.saved?.[ctx.offset];
    const matched = savedChild?.type === tag ? savedChild : undefined;
    if (savedChild && !matched) {
        console.warn(`[plugin hydration] tag mismatch at offset ${ctx.offset}: <${tag}> vs saved <${savedChild.type}>`);
    }

    const props = extractProps(tag, ctx.element);
    const id = matched && propsMatch(props, matched) ? matched.id : randomId();
    ctx.element.setAttribute('id', id);

    return {type: tag, id, runtime: {}, ...props} as ScElementNode;
}

function walkChildren(ctx: WalkContext): ScElementNode[] {
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
        for (const node of result) {
            processRuntime({...ctx, node, scope: result});
        }
        return result;
    }
    return visit(ctx.element);
}
