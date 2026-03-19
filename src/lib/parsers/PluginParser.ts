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

function domTag(type: string): string {
    return type === 'sc-plugin' ? 'html' : type;
}

export function parse(element: Element, scPlugin?: ScElementNode, boxId?: string): ParseResult {
    const ctx: WalkContext = {
        node: {type: 'sc-plugin', id: boxId ?? ''} as ScElementNode,
        element,
        saved: scPlugin,
        boxId: boxId ?? '',
        offset: 0,
        runtime: new Map<string, RuntimeValueEntry>(),
        scope: [],
        walk: walkChildren,
    };

    const pluginNode = processElement(element, 'sc-plugin', scPlugin) as ScPluginNode;
    processRuntime({...ctx, node: pluginNode});

    const values: Record<string, RuntimeValueEntry> = {};
    for (const [id, entry] of ctx.runtime) {
        values[id] = entry;
    }
    return {tree: pluginNode.children, values, runtime: pluginNode.runtime};
}

function processElement(el: Element, type: string, saved?: ScElementNode): ScElementNode {
    const tag = el.tagName.toLowerCase();
    if (domTag(type) !== tag) {
        console.warn(`[plugin hydration] tag mismatch: expected <${domTag(type)}> but got <${tag}>`);
    }

    const matched = saved?.type === type ? saved : undefined;
    if (saved && !matched) {
        console.warn(`[plugin hydration] type mismatch: <${type}> vs saved <${saved.type}>`);
    }

    const props = extractProps(type, el);
    const id = matched && propsMatch(props, matched) ? matched.id : randomId()
    el.setAttribute('id', id);

    return {type, id, runtime: {}, ...props} as ScElementNode;
}

function walkChildren(ctx: WalkContext): ScElementNode {
    function visit(element: Element) {
        for (const child of Array.from(element.children)) {
            const tag = child.tagName.toLowerCase();
            if (SC_TAGS.includes(tag as any)) {
                ctx.scope.push(walkChildren({
                    ...ctx,
                }));
                ctx.offset++;
            }
        }
    }
    visit(ctx.element);
    return processRuntime(ctx);
}
