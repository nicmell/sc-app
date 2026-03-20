import {ELEMENTS} from "@/constants/sc-elements";
import type {UGenSpec} from "../../types/parsers";

const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'running', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);

export function extractGroupProps(el: Element) {
    return {
        name: el.getAttribute('name') ?? '',
        running: el.getAttribute('running') !== 'false',
    };
}

export function extractSynthProps(el: Element) {
    return {
        name: el.getAttribute('name') ?? '',
        bind: el.getAttribute('bind') ?? undefined,
        controls: collectNumericAttrs(el, SYNTH_SKIP_ATTRS),
        running: el.getAttribute('running') !== 'false',
    };
}

export function extractSynthDefProps(el: Element) {
    return {
        name: el.getAttribute('name') ?? '',
        controls: collectNumericAttrs(el, SYNTHDEF_SKIP_ATTRS),
        ugens: collectUGenSpecs(el),
    };
}

export function extractRangeProps(el: Element) {
    return {bind: el.getAttribute('bind') ?? ''};
}

export function extractCheckboxProps(el: Element) {
    return {bind: el.getAttribute('bind') ?? ''};
}

export function extractRunProps(el: Element) {
    return {bind: el.getAttribute('bind') ?? ''};
}

export function extractDisplayProps(el: Element) {
    return {
        bind: el.getAttribute('bind') ?? '',
        format: el.getAttribute('format') ?? '',
    };
}

export function extractIfProps(el: Element) {
    return {bind: el.getAttribute('bind') ?? ''};
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
