import type {
    StripRuntime, ScPluginNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScUgenNode, ScControlNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode, ScVarNode, ScSelectNode, ScOptionNode, ScRadioGroupNode, ScRadioNode,
} from "@/types/parsers";
import {ELEMENTS} from "@/constants/sc-elements";

export type HtmlProps<T> = Omit<StripRuntime<T>, 'id' | 'type' | 'children'>;

function extractPluginProps(el: Element): Omit<HtmlProps<ScPluginNode>, 'name'> {
    return {
        title: el.querySelector('title')?.textContent ?? '',
        run: el.getAttribute('run') !== 'false',
    };
}

function extractGroupProps(el: Element): HtmlProps<ScGroupNode> {
    return {
        name: el.getAttribute('name') ?? '',
        run: el.getAttribute('run') !== 'false',
    };
}

function extractSynthProps(el: Element): HtmlProps<ScSynthNode> {
    return {
        name: el.getAttribute('name') ?? '',
        bind: el.getAttribute('bind') ?? '',
        run: el.getAttribute('run') !== 'false',
    };
}

function extractSynthDefProps(el: Element): HtmlProps<ScSynthDefNode> {
    return {
        name: el.getAttribute('name') ?? '',
    };
}

function extractUgenProps(el: Element): HtmlProps<ScUgenNode> {
    return {
        name: el.getAttribute('name') ?? '',
        ugen: el.getAttribute('type') ?? '',
        rate: el.getAttribute('rate') ?? 'ar',
        op: el.getAttribute('op') ?? undefined,
    };
}

function extractControlProps(el: Element): HtmlProps<ScControlNode> {
    const name = el.getAttribute('name') ?? '';
    const bind = el.getAttribute('bind');
    return bind ? {name, bind} : {name, value: Number(el.getAttribute('value') ?? '0')};
}

function extractVarProps(el: Element): HtmlProps<ScVarNode> {
    return {
        name: el.getAttribute('name') ?? '',
        value: Number(el.getAttribute('value') ?? '0'),
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

function extractSelectProps(el: Element): HtmlProps<ScSelectNode> {
    return {bind: el.getAttribute('bind') ?? ''};
}

function extractOptionProps(el: Element): HtmlProps<ScOptionNode> {
    return {
        value: Number(el.getAttribute('value') ?? '0'),
        label: el.getAttribute('label') ?? '',
    };
}

function extractRadioGroupProps(el: Element): HtmlProps<ScRadioGroupNode> {
    return {
        bind: el.getAttribute('bind') ?? '',
        orientation: (el.getAttribute('orientation') ?? 'horizontal') as 'horizontal' | 'vertical',
    };
}

function extractRadioProps(el: Element): HtmlProps<ScRadioNode> {
    return {
        value: Number(el.getAttribute('value') ?? '0'),
        label: el.getAttribute('label') ?? '',
        width: Number(el.getAttribute('width') ?? '24'),
        height: Number(el.getAttribute('height') ?? '24'),
        src: el.getAttribute('src') ?? '',
        fgcolor: el.getAttribute('fgcolor') ?? '',
        bgcolor: el.getAttribute('bgcolor') ?? '',
    };
}

export function extractProps(type: string, el: Element): Record<string, unknown> {
    switch (type) {
        case ELEMENTS.SC_PLUGIN:
            return {children: [], ...extractPluginProps(el)};
        case ELEMENTS.SC_GROUP:
            return {children: [], ...extractGroupProps(el)};
        case ELEMENTS.SC_SYNTH:
            return {children: [], ...extractSynthProps(el)};
        case ELEMENTS.SC_SYNTHDEF:
            return {children: [], ...extractSynthDefProps(el)};
        case ELEMENTS.SC_UGEN:
            return {children: [], ...extractUgenProps(el)};
        case ELEMENTS.SC_CONTROL:
            return extractControlProps(el);
        case ELEMENTS.SC_VAR:
            return extractVarProps(el);
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
        case ELEMENTS.SC_SELECT:
            return {children: [], ...extractSelectProps(el)};
        case ELEMENTS.SC_OPTION:
            return extractOptionProps(el);
        case ELEMENTS.SC_RADIO_GROUP:
            return {children: [], ...extractRadioGroupProps(el)};
        case ELEMENTS.SC_RADIO:
            return extractRadioProps(el);
        default:
            throw new Error(`Unknown element type: ${type}`);
    }
}
