import type {
    StripRuntime, ScPluginNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScUgenNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode,
} from "@/types/parsers";
import {ELEMENTS} from "@/constants/sc-elements";

export type HtmlProps<T> = Omit<StripRuntime<T>, 'id' | 'type' | 'children'>;

const GROUP_SKIP_ATTRS = new Set(['id', 'name', 'run', 'class', 'style', 'slot', 'title']);
const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'run', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);

function extractPluginProps(el: Element): HtmlProps<ScPluginNode> {
    return {
        title: el.querySelector('title')?.textContent ?? '',
        run: el.getAttribute('run') !== 'false',
        controls: {}
    };
}

function extractGroupProps(el: Element): HtmlProps<ScGroupNode> {
    return {
        name: el.getAttribute('name') ?? '',
        run: el.getAttribute('run') !== 'false',
        controls: collectNumericAttrs(el, GROUP_SKIP_ATTRS),
    };
}

function extractSynthProps(el: Element): HtmlProps<ScSynthNode> {
    return {
        name: el.getAttribute('name') ?? '',
        bind: el.getAttribute('bind') ?? '',
        controls: collectNumericAttrs(el, SYNTH_SKIP_ATTRS),
        run: el.getAttribute('run') !== 'false',
    };
}

function extractSynthDefProps(el: Element): HtmlProps<ScSynthDefNode> {
    return {
        name: el.getAttribute('name') ?? '',
        controls: collectNumericAttrs(el, SYNTHDEF_SKIP_ATTRS),
    };
}

function extractUgenProps(el: Element): HtmlProps<ScUgenNode> {
    return {
        name: el.getAttribute('name') ?? '',
        ugen: el.getAttribute('type') ?? '',
        rate: el.getAttribute('rate') ?? 'ar',
        controls: collectUgenInputs(el),
    };
}

function extractRangeProps(el: Element): HtmlProps<ScRangeNode> {
    return {bind: el.getAttribute('bind') ?? ''};
}

function extractCheckboxProps(el: Element): HtmlProps<ScCheckboxNode> {
    return {bind: el.getAttribute('bind') ?? ''};
}

function extractRunProps(el: Element): HtmlProps<ScRunNode> {
    return {bind: el.getAttribute('bind') ?? ''};
}

function extractDisplayProps(el: Element): HtmlProps<ScDisplayNode> {
    return {
        bind: el.getAttribute('bind') ?? '',
        format: el.getAttribute('format') ?? '',
    };
}

function extractIfProps(el: Element): HtmlProps<ScIfNode> {
    return {bind: el.getAttribute('bind') ?? ''};
}

export function extractProps(type: string, el: Element): Record<string, unknown> {
    switch (type) {
        case ELEMENTS.SC_PLUGIN:
            return {children: [], ...extractPluginProps(el)};
        case ELEMENTS.SC_GROUP:
            return {children: [], ...extractGroupProps(el)};
        case ELEMENTS.SC_SYNTH:
            return extractSynthProps(el);
        case ELEMENTS.SC_SYNTHDEF:
            return {children: [], ...extractSynthDefProps(el)};
        case ELEMENTS.SC_UGEN:
            return extractUgenProps(el);
        case ELEMENTS.SC_RANGE:
            return extractRangeProps(el);
        case ELEMENTS.SC_CHECKBOX:
            return extractCheckboxProps(el);
        case ELEMENTS.SC_RUN:
            return extractRunProps(el);
        case ELEMENTS.SC_DISPLAY:
            return extractDisplayProps(el);
        case ELEMENTS.SC_IF:
            return {children: [], ...extractIfProps(el)};
        default:
            throw new Error(`Unknown element type: ${type}`);
    }
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
