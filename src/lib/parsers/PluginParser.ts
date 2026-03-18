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
    saved: ScElementNode[];
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

function domTag(type: string): string {
    return type === 'sc-plugin' ? 'html' : type;
}

export function parse(element: Element, scPlugin?: ScElementNode, boxId?: string): ParseResult {
    const ctx: WalkContext = {
        node: {type: 'sc-plugin', id: boxId ?? ''} as ScElementNode,
        element,
        saved: scPlugin ? [scPlugin] : [],
        boxId: boxId ?? '',
        offset: 0,
        runtime: new Map<string, RuntimeValueEntry>(),
        scope: [],
        walk: walkChildren,
    };

    const pluginNode = processElement(ctx) as ScPluginNode;
    processRuntime({...ctx, node: pluginNode});

    const values: Record<string, RuntimeValueEntry> = {};
    for (const [id, entry] of ctx.runtime) {
        values[id] = entry;
    }
    return {tree: pluginNode.children, values, runtime: pluginNode.runtime};
}

function processElement(ctx: WalkContext): ScElementNode {
    const tag = ctx.element.tagName.toLowerCase();
    const type = ctx.node.type;
    if (domTag(type) !== tag) {
        console.warn(`[plugin hydration] tag mismatch: expected <${domTag(type)}> but got <${tag}>`);
    }

    const savedChild = ctx.saved[ctx.offset];
    const matched = savedChild?.type === type ? savedChild : undefined;
    if (savedChild && !matched) {
        console.warn(`[plugin hydration] type mismatch at offset ${ctx.offset}: <${type}> vs saved <${savedChild.type}>`);
    }

    const props = extractProps(type, ctx.element);
    const id = matched && propsMatch(props, matched) ? matched.id : (ctx.node.id || randomId());
    ctx.element.setAttribute('id', id);

    return {type, id, runtime: {}, ...props} as ScElementNode;
}

function walkChildren(ctx: WalkContext): ScElementNode[] {
    const scope: ScElementNode[] = [];
    const elements: Element[] = [];

    function visit(element: Element) {
        for (const child of Array.from(element.children)) {
            const tag = child.tagName.toLowerCase();
            if (SC_TAGS.includes(tag as any)) {
                scope.push(processElement({...ctx, element: child, node: {type: tag} as ScElementNode}));
                elements.push(child);
                ctx.offset++;
            } else {
                visit(child);
            }
        }
    }
    visit(ctx.element);

    for (let i = 0; i < scope.length; i++) {
        processRuntime({...ctx, node: scope[i], element: elements[i], scope, offset: i});
    }
    return scope;
}
