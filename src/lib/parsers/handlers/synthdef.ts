import {ELEMENTS} from "@/constants/sc-elements";
import {BaseHandler} from "./types";
import type {ParseContext} from "../index";
import type {ScSynthDefNode, UGenSpec} from "@/types/parsers";
import {compileSynthDef} from "../SynthDefCompiler";
import {deepEqual} from "@/lib/utils/deepEqual";
import {runtimeApi} from "@/lib/stores/api";
import {randomId} from "@/lib/utils/randomId";

const SKIP_ATTRS = new Set(['id', 'name', 'class', 'style', 'slot']);
const UGEN_SKIP_ATTRS = new Set(['id', 'name', 'type', 'rate', 'class', 'style', 'slot']);

function collectParams(el: Element): Record<string, number> {
    const params: Record<string, number> = {};
    for (const attr of Array.from(el.attributes)) {
        if (SKIP_ATTRS.has(attr.name)) continue;
        const val = Number(attr.value);
        if (!isNaN(val)) params[attr.name] = val;
    }
    return params;
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

export class SynthDefHandler extends BaseHandler {
    extractProps(el: Element): Record<string, unknown> {
        return {
            type: 'sc-synthdef',
            name: el.getAttribute('name') ?? '',
            params: collectParams(el),
            ugens: collectUGenSpecs(el),
        };
    }

    process(ctx: ParseContext): ParseContext {
        const name = ctx.el.getAttribute('name') ?? '';
        const params = collectParams(ctx.el);
        const ugens = collectUGenSpecs(ctx.el);

        const saved = ctx.saved?.[ctx.offset - 1];
        const savedDef = saved?.type === 'sc-synthdef' ? saved as ScSynthDefNode : undefined;

        let bytes: number[];
        if (savedDef && savedDef.runtime &&
            deepEqual(params, savedDef.params) &&
            deepEqual(ugens, savedDef.ugens)
        ) {
            const savedEntry = runtimeApi.entries.find(e => e.id === savedDef.runtime.bytes);
            bytes = savedEntry?.type === 'synthdef' ? savedEntry.value : compileSynthDef(name, params, new Map(ugens.map(s => [s.name, s])));
        } else {
            const specsMap = new Map<string, UGenSpec>();
            for (const spec of ugens) specsMap.set(spec.name, spec);
            bytes = compileSynthDef(name, params, specsMap);
        }

        const entryId = randomId();
        ctx.runtime.push({id: entryId, type: "synthdef", targetNode: ctx.id, boxId: ctx.boxId, value: bytes});

        const node: ScSynthDefNode = {type: 'sc-synthdef', id: ctx.id, boxId: ctx.boxId, name, params, ugens, runtime: {bytes: entryId}};
        ctx.elements.push(node);
        ctx.scope.push(node);
        return ctx;
    }
}
