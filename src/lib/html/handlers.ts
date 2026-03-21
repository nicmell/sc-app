import type {
    StripRuntime, ScPluginNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScUgenNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode,
} from "@/types/parsers";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'running', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);

export function extractPluginProps(id: string): StripRuntime<ScPluginNode> {
    return {type: 'sc-plugin', id, children: []};
}

export function extractGroupProps(id: string, el: Element): StripRuntime<ScGroupNode> {
    return {
        type: 'sc-group',
        id,
        name: el.getAttribute('name') ?? '',
        running: el.getAttribute('running') !== 'false',
        children: [],
    };
}

export function extractSynthProps(id: string, el: Element): StripRuntime<ScSynthNode> {
    return {
        type: 'sc-synth',
        id,
        name: el.getAttribute('name') ?? '',
        bind: el.getAttribute('bind') ?? '',
        controls: collectNumericAttrs(el, SYNTH_SKIP_ATTRS),
        running: el.getAttribute('running') !== 'false',
    };
}

export function extractSynthDefProps(id: string, el: Element): StripRuntime<ScSynthDefNode> {
    return {
        type: 'sc-synthdef',
        id,
        name: el.getAttribute('name') ?? '',
        controls: collectNumericAttrs(el, SYNTHDEF_SKIP_ATTRS),
        children: [],
    };
}

export function extractUgenProps(id: string, el: Element): StripRuntime<ScUgenNode> {
    return {
        type: 'sc-ugen',
        id,
        name: el.getAttribute('name') ?? '',
        ugen: el.getAttribute('type') ?? '',
        rate: el.getAttribute('rate') ?? 'ar',
        controls: collectUgenInputs(el),
    };
}

export function extractRangeProps(id: string, el: Element): StripRuntime<ScRangeNode> {
    return {type: 'sc-range', id, bind: el.getAttribute('bind') ?? ''};
}

export function extractCheckboxProps(id: string, el: Element): StripRuntime<ScCheckboxNode> {
    return {type: 'sc-checkbox', id, bind: el.getAttribute('bind') ?? ''};
}

export function extractRunProps(id: string, el: Element): StripRuntime<ScRunNode> {
    return {type: 'sc-run', id, bind: el.getAttribute('bind') ?? ''};
}

export function extractDisplayProps(id: string, el: Element): StripRuntime<ScDisplayNode> {
    return {
        type: 'sc-display',
        id,
        bind: el.getAttribute('bind') ?? '',
        format: el.getAttribute('format') ?? '',
    };
}

export function extractIfProps(id: string, el: Element): StripRuntime<ScIfNode> {
    return {type: 'sc-if', id, bind: el.getAttribute('bind') ?? '', children: []};
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

function collectUgenInputs(el: Element): Record<string, string> {
    const inputs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
        if (!UGEN_SKIP_ATTRS.has(attr.name)) inputs[attr.name] = attr.value;
    }
    return inputs;
}
