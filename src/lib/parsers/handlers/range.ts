import {BaseHandler} from "./types";
import type {ParseContext} from "../index";
import {resolveBindEntry} from "../index";

export class RangeHandler extends BaseHandler {
    extractProps(el: Element): Record<string, unknown> {
        return {
            type: 'sc-range',
            bind: el.getAttribute('bind') ?? '',
            value: Number(el.getAttribute('value')) || 0,
        };
    }

    process(ctx: ParseContext): ParseContext {
        const {bind, value, entryId} = resolveBindEntry(ctx.el, ctx);
        ctx.elements.push({type: 'sc-range', id: ctx.id, boxId: ctx.boxId, bind, value, runtime: {value: entryId}});
        return ctx;
    }
}
