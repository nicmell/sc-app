const SYNTH_SKIP_ATTRS = new Set(['id', 'name', 'bind', 'running', 'class', 'style', 'slot', 'title']);
const SYNTHDEF_SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);

export function extractPluginProps() {
    return {
        children: [] as never[], runtime: {run: '', controls: {}, loaded: false}
    };
}

export function extractGroupProps(el: Element) {
    return {
        name: el.getAttribute('name') ?? '',
        running: el.getAttribute('running') !== 'false',
        children: [] as never[],
        runtime: {run: '', controls: {}},
    };
}

export function extractSynthProps(el: Element) {
    return {
        name: el.getAttribute('name') ?? '',
        bind: el.getAttribute('bind') ?? '',
        controls: collectNumericAttrs(el, SYNTH_SKIP_ATTRS),
        running: el.getAttribute('running') !== 'false',
        runtime: {run: '', controls: {}},
    };
}

export function extractSynthDefProps(el: Element) {
    return {
        name: el.getAttribute('name') ?? '',
        controls: collectNumericAttrs(el, SYNTHDEF_SKIP_ATTRS),
        children: [] as never[],
        runtime: {},
    };
}

export function extractUgenProps(el: Element) {
    return {
        name: el.getAttribute('name') ?? '',
        ugen: el.getAttribute('type') ?? '',
        rate: el.getAttribute('rate') ?? 'ar',
        controls: collectUgenInputs(el),
        runtime: {},
    };
}

export function extractRangeProps(el: Element) {
    return {bind: el.getAttribute('bind') ?? '', runtime: {value: ''}};
}

export function extractCheckboxProps(el: Element) {
    return {bind: el.getAttribute('bind') ?? '', runtime: {value: ''}};
}

export function extractRunProps(el: Element) {
    return {bind: el.getAttribute('bind') ?? '', runtime: {value: ''}};
}

export function extractDisplayProps(el: Element) {
    return {
        bind: el.getAttribute('bind') ?? '',
        format: el.getAttribute('format') ?? '',
        runtime: {value: ''},
    };
}

export function extractIfProps(el: Element) {
    return {bind: el.getAttribute('bind') ?? '', children: [] as never[], runtime: {value: ''}};
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