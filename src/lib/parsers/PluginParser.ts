import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId.ts";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {ScElementNode, UGenSpec} from "../../types/parsers";
import {runtimeApi} from "@/lib/stores/api.ts";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'running', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);
const EXCLUDE_KEYS = new Set(['id', 'runtime', 'children']);
const PARENT_TAGS: ReadonlySet<string> = new Set([ELEMENTS.SC_GROUP, ELEMENTS.SC_IF]);

interface WalkContext {
    element: Element;
    matched: { children: ScElementNode[] } | undefined;
    offset: number;
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

const runtimeDefaults: Record<string, (props: Record<string, unknown>) => unknown> = {
    [ELEMENTS.SC_GROUP]: (p) => ({isRunning: p.running, controls: {}}),
    [ELEMENTS.SC_SYNTH]: (p) => ({isRunning: p.running, controls: {...(p.controls as Record<string, number>)}}),
    [ELEMENTS.SC_SYNTHDEF]: () => ({value: []}),
    [ELEMENTS.SC_RANGE]: () => ({value: 0}),
    [ELEMENTS.SC_CHECKBOX]: () => ({value: 0}),
    [ELEMENTS.SC_RUN]: () => ({value: 1}),
};

export function parsePlugin(boxId: string, node: Element): ScElementNode[] {
    const saved = runtimeApi.getById(boxId);
    const matched = saved && 'children' in saved ? saved : undefined;
    return walkChildren({element: node, matched, offset: 0});
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
function processChildren(ctx: WalkContext): ScElementNode {
    const tag = ctx.element.tagName.toLowerCase();
    const savedChild = ctx.matched?.children[ctx.offset];
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
        const factory = runtimeDefaults[tag];
        node = (factory ? {...props, id, runtime: factory(props)} : {...props, id}) as ScElementNode;
    }

    return {
        ...node,
        ...PARENT_TAGS.has(tag) && {
            children: walkChildren({
                element: ctx.element,
                matched: matched && 'children' in matched ? matched : undefined,
                offset: 0
            }),
        }
    }
}

function walkChildren(ctx: WalkContext): ScElementNode[] {
    function visit(element: Element): ScElementNode[] {
        const result: ScElementNode[] = [];
        for (const child of Array.from(element.children)) {
            const tag = child.tagName.toLowerCase();
            if (tag in propsExtractors) {
                result.push(processChildren({element: child, matched: ctx.matched, offset: ctx.offset}));
                ctx.offset++;
            } else {
                result.push(...visit(child));
            }
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
