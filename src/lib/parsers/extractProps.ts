import {ELEMENTS} from "@/constants/sc-elements";
import {deepEqual} from "@/lib/utils/deepEqual";
import type {
    ScElementNode, UGenSpec, ScGroupNode, ScSynthNode, ScSynthDefNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode, ScPluginNode,
} from "../../types/parsers";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'running', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);

export const RUNTIME_KEYS = [
    'type',
    'id',
    'title',
    'loaded',
    'error',
    'runtime',
    'children'
] as const;

type WithoutRuntime<Node extends ScElementNode> = Omit<Node, typeof RUNTIME_KEYS[number]>

export function propsMatch(fresh: object, saved?: object): boolean {
    const strip = (node: object = {}) => {
        const props: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(node)) {
            if (!RUNTIME_KEYS.includes(key as any)) props[key] = val;
        }
        return props;
    };
    return deepEqual(strip(fresh), strip(saved));
}

export function extractProps(tag: string, el: Element): WithoutRuntime<ScElementNode> {
    switch (tag) {
        case ELEMENTS.SC_PLUGIN:   return extractPluginProps(el);
        case ELEMENTS.SC_GROUP:    return extractGroupProps(el);
        case ELEMENTS.SC_SYNTH:    return extractSynthProps(el);
        case ELEMENTS.SC_SYNTHDEF: return extractSynthDefProps(el);
        case ELEMENTS.SC_RANGE:    return extractRangeProps(el);
        case ELEMENTS.SC_CHECKBOX: return extractCheckboxProps(el);
        case ELEMENTS.SC_RUN:      return extractRunProps(el);
        case ELEMENTS.SC_DISPLAY:  return extractDisplayProps(el);
        case ELEMENTS.SC_IF:       return extractIfProps(el);
        default:
            throw new Error(`Unknown element: <${tag}>`);
    }
}

function extractPluginProps(_: Element): WithoutRuntime<ScPluginNode> {
    return {}
}

function extractGroupProps(el: Element): WithoutRuntime<ScGroupNode> {
    return {
        name: el.getAttribute('name') ?? '',
        running: el.getAttribute('running') !== 'false',
    };
}

function extractSynthProps(el: Element): WithoutRuntime<ScSynthNode> {
    return {
        name: el.getAttribute('name') ?? '',
        bind: el.getAttribute('bind') ?? '',
        controls: collectNumericAttrs(el, SYNTH_SKIP_ATTRS),
        running: el.getAttribute('running') !== 'false',
    };
}

function extractSynthDefProps(el: Element): WithoutRuntime<ScSynthDefNode> {
    return {
        name: el.getAttribute('name') ?? '',
        params: collectNumericAttrs(el, SYNTHDEF_SKIP_ATTRS),
        ugens: collectUGenSpecs(el),
    };
}

function extractRangeProps(el: Element): WithoutRuntime<ScRangeNode> {
    return {
        bind: el.getAttribute('bind') ?? '',
    };
}

function extractCheckboxProps(el: Element): WithoutRuntime<ScCheckboxNode> {
    return {
        bind: el.getAttribute('bind') ?? '',
    };
}

function extractRunProps(el: Element): WithoutRuntime<ScRunNode> {
    return {
        bind: el.getAttribute('bind') ?? '',
    };
}

function extractDisplayProps(el: Element): WithoutRuntime<ScDisplayNode> {
    return {
        bind: el.getAttribute('bind') ?? '',
        format: el.getAttribute('format') ?? '',
    };
}

function extractIfProps(el: Element): WithoutRuntime<ScIfNode> {
    return {
        bind: el.getAttribute('bind') ?? '',
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
