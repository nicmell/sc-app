import {BaseHandler} from "./types";
import type {ParseContext} from "../index";
import type {ScElementNode, ScPluginNode} from "@/types/parsers";
import {runtimeApi} from "@/lib/stores/api";
import {walkChildren} from "../index";

export class PluginHandler extends BaseHandler {
    extractProps(): Record<string, unknown> {
        return {type: 'sc-plugin'};
    }

    process(ctx: ParseContext): ParseContext {
        const saved = runtimeApi.getBox(ctx.id);
        const children: ScElementNode[] = [];
        walkChildren({...ctx, saved: saved?.children, elements: children});
        const node: ScPluginNode = {type: 'sc-plugin', id: ctx.id, children, runtime: {loaded: true, title: ctx.el.querySelector('title')?.textContent ?? undefined}};
        ctx.elements.push(node);
        ctx.scope.push(node);
        return ctx;
    }
}
