import {BaseHandler} from "./types";
import type {ParseContext} from "../index";
import {randomId} from "@/lib/utils/randomId";
import {isNode} from "../guards";

export class RunHandler extends BaseHandler {
    extractProps(el: Element): Record<string, unknown> {
        return {
            type: 'sc-run',
            bind: el.getAttribute('bind') ?? '',
            value: 1,
        };
    }

    validateBindings(ctx: ParseContext): void {
        const bind = ctx.el.getAttribute('bind') ?? '';
        if (bind) {
            const target = ctx.scope.find(n => 'name' in n && n.name === bind);
            if (!target || !isNode(target)) {
                throw new Error(`<sc-run>: bind "${bind}" does not reference a valid sc-synth or sc-group`);
            }
        }
    }

    process(ctx: ParseContext): ParseContext {
        const bind = ctx.el.getAttribute('bind') ?? '';
        let rEntryId: string;
        if (bind) {
            const target = ctx.scope.find(n => 'name' in n && n.name === bind)!;
            rEntryId = (target as { runtime: { run: string } }).runtime.run;
        } else {
            const parent = [...ctx.scope].reverse().find(n => isNode(n));
            if (parent && isNode(parent)) {
                rEntryId = parent.runtime.run;
            } else {
                rEntryId = randomId();
                ctx.runtime.push({id: rEntryId, type: "run", targetNode: ctx.id, boxId: ctx.boxId, value: 1});
            }
        }
        ctx.elements.push({type: 'sc-run', id: ctx.id, boxId: ctx.boxId, bind, value: 1, runtime: {value: rEntryId}});
        return ctx;
    }
}
