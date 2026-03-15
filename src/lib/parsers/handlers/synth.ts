import {BaseHandler} from "./types";
import type {ParseContext} from "../index";
import type {ScSynthNode} from "@/types/parsers";
import {randomId} from "@/lib/utils/randomId";

const SKIP_ATTRS = new Set(['id', 'name', 'bind', 'is-running', 'class', 'style', 'slot', 'title']);

function collectControls(el: Element): Record<string, number> {
    const controls: Record<string, number> = {};
    for (const attr of Array.from(el.attributes)) {
        if (SKIP_ATTRS.has(attr.name)) continue;
        const val = Number(attr.value);
        if (!isNaN(val)) controls[attr.name] = val;
    }
    return controls;
}

export class SynthHandler extends BaseHandler {
    extractProps(el: Element): Record<string, unknown> {
        return {
            type: 'sc-synth',
            name: el.getAttribute('name') ?? '',
            bind: el.getAttribute('bind') ?? undefined,
            isRunning: el.getAttribute('is-running') !== 'false',
            controls: collectControls(el),
        };
    }

    validateBindings(ctx: ParseContext): void {
        const name = ctx.el.getAttribute('name') ?? '';
        const bind = ctx.el.getAttribute('bind') ?? undefined;
        if (bind && !ctx.scope.some(n => n.type === 'sc-synthdef' && n.name === bind)) {
            throw new Error(`<sc-synth name="${name}">: bind "${bind}" does not match any <sc-synthdef> in scope`);
        }
    }

    process(ctx: ParseContext): ParseContext {
        const name = ctx.el.getAttribute('name') ?? '';
        const bind = ctx.el.getAttribute('bind') ?? undefined;
        const controls = collectControls(ctx.el);
        const isRunning = ctx.el.getAttribute('is-running') !== 'false';

        const controlEntries: Record<string, string> = {};
        for (const [controlName, defaultValue] of Object.entries(controls)) {
            const entryId = randomId();
            ctx.runtime.push({id: entryId, type: "control", targetNode: ctx.id, boxId: ctx.boxId, value: defaultValue});
            controlEntries[controlName] = entryId;
        }

        const rEntryId = randomId();
        ctx.runtime.push({id: rEntryId, type: "run", targetNode: ctx.id, boxId: ctx.boxId, value: isRunning ? 1 : 0});

        const node: ScSynthNode = {type: 'sc-synth', id: ctx.id, boxId: ctx.boxId, name, bind, controls, isRunning, runtime: {run: rEntryId, controls: controlEntries}};
        ctx.elements.push(node);
        ctx.scope.push(node);
        return ctx;
    }
}
