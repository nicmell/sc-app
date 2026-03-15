import {BaseHandler} from "./types";
import type {ParseContext} from "../index";
import {resolveBindEntry} from "../index";

export class IfHandler extends BaseHandler {
    extractProps(): Record<string, unknown> {
        return {type: 'sc-if'};
    }

    validateBindings(ctx: ParseContext): void {
        resolveBindEntry(ctx.el, ctx);
    }

    childContext(ctx: ParseContext): ParseContext {
        return ctx;
    }
}
