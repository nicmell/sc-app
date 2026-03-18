import {ELEMENTS} from "@/constants/sc-elements";
import {randomId} from "@/lib/utils/randomId";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {
    ScElementNode, UGenSpec, ScGroupNode, ScSynthNode, ScSynthDefNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode,
} from "../../types/parsers";
import type {WalkContext} from "./PluginParser";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'running', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);

const RUNTIME_KEYS = [
    'id',
    'title',
    'loaded',
    'error',
    'runtime',
    'children'
] as const;

export function propsMatch(fresh: ScElementNode, saved: ScElementNode): boolean {
    const strip = (node: ScElementNode) => {
        const props: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(node)) {
            if (!RUNTIME_KEYS.includes(key as any)) props[key] = val;
        }
        return props;
    };
    return deepEqual(strip(fresh), strip(saved));
}

export function extractProps(tag: string, el: Element, ctx: WalkContext): ScElementNode {
    switch (tag) {
        case ELEMENTS.SC_GROUP:    return extractGroupProps(el, ctx);
        case ELEMENTS.SC_SYNTH:    return extractSynthProps(el);
        case ELEMENTS.SC_SYNTHDEF: return extractSynthDefProps(el);
        case ELEMENTS.SC_RANGE:    return extractRangeProps(el);
        case ELEMENTS.SC_CHECKBOX: return extractCheckboxProps(el);
        case ELEMENTS.SC_RUN:      return extractRunProps(el);
        case ELEMENTS.SC_DISPLAY:  return extractDisplayProps(el);
        case ELEMENTS.SC_IF:       return extractIfProps(el, ctx);
        default: throw new Error(`Unknown element: <${tag}>`);
    }
}

function extractGroupProps(el: Element, ctx: WalkContext): ScGroupNode {
    return {
        type: 'sc-group',
        id: randomId(),
        name: el.getAttribute('name') ?? '',
        running: el.getAttribute('running') !== 'false',
        children: ctx.walk({...ctx, element: el, offset: 0, scope: []}),
        runtime: {run: '', controls: {}},
    };
}

function extractSynthProps(el: Element): ScSynthNode {
    return {
        type: 'sc-synth',
        id: randomId(),
        name: el.getAttribute('name') ?? '',
        bind: el.getAttribute('bind') ?? '',
        controls: collectNumericAttrs(el, SYNTH_SKIP_ATTRS),
        running: el.getAttribute('running') !== 'false',
        runtime: {run: '', controls: {}},
    };
}

function extractSynthDefProps(el: Element): ScSynthDefNode {
    return {
        type: 'sc-synthdef',
        id: randomId(),
        name: el.getAttribute('name') ?? '',
        params: collectNumericAttrs(el, SYNTHDEF_SKIP_ATTRS),
        ugens: collectUGenSpecs(el),
        runtime: {value: ''},
    };
}

function extractRangeProps(el: Element): ScRangeNode {
    return {
        type: 'sc-range',
        id: randomId(),
        bind: el.getAttribute('bind') ?? '',
        runtime: {value: ''},
    };
}

function extractCheckboxProps(el: Element): ScCheckboxNode {
    return {
        type: 'sc-checkbox',
        id: randomId(),
        bind: el.getAttribute('bind') ?? '',
        runtime: {value: ''},
    };
}

function extractRunProps(el: Element): ScRunNode {
    return {
        type: 'sc-run',
        id: randomId(),
        bind: el.getAttribute('bind') ?? '',
        runtime: {value: ''},
    };
}

function extractDisplayProps(el: Element): ScDisplayNode {
    return {
        type: 'sc-display',
        id: randomId(),
        bind: el.getAttribute('bind') ?? '',
        format: el.getAttribute('format') ?? '',
        runtime: {value: ''},
    };
}

function extractIfProps(el: Element, ctx: WalkContext): ScIfNode {
    return {
        type: 'sc-if',
        id: randomId(),
        bind: el.getAttribute('bind') ?? '',
        children: ctx.walk({...ctx, element: el, offset: 0, scope: []}),
        runtime: {value: ''},
    };
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
