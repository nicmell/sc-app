import {BaseHandler} from "./types";
import type {ParseContext} from "../index";
import {resolveBindEntry} from "../index";

export class MidiHandler extends BaseHandler {
    extractProps(el: Element): Record<string, unknown> {
        return {
            type: 'sc-midi',
            bind: el.getAttribute('bind') ?? '',
            value: Number(el.getAttribute('value')) || 0,
            octaves: Number(el.getAttribute('octaves')) || 2,
            octave: Number(el.getAttribute('octave')) || 4,
        };
    }

    process(ctx: ParseContext): ParseContext {
        const {bind, value, entryId} = resolveBindEntry(ctx.el, ctx);
        const octaves = Number(ctx.el.getAttribute('octaves')) || 2;
        const octave = Number(ctx.el.getAttribute('octave')) || 4;
        ctx.elements.push({type: 'sc-midi', id: ctx.id, boxId: ctx.boxId, bind, value, octaves, octave, runtime: {value: entryId}});
        return ctx;
    }
}
