import {BaseHandler} from "./types";
import type {ParseContext} from "../index";

export class DefaultHandler extends BaseHandler {
    extractProps(el: Element): Record<string, unknown> {
        return {type: el.tagName.toLowerCase()};
    }

    childContext(ctx: ParseContext): ParseContext {
        return ctx;
    }
}
