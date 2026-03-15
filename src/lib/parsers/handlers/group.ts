import {BaseHandler} from "./types";
import type {ParseContext} from "../index";
import type {ScElementNode, ScGroupNode} from "@/types/parsers";
import {randomId} from "@/lib/utils/randomId";
import {walkChildren} from "../index";

export class GroupHandler extends BaseHandler {
    extractProps(el: Element): Record<string, unknown> {
        return {
            type: 'sc-group',
            name: el.getAttribute('name') ?? '',
            isRunning: el.getAttribute('is-running') !== 'false',
        };
    }

    process(ctx: ParseContext): ParseContext {
        const name = ctx.el.getAttribute('name') ?? '';
        const isRunning = ctx.el.getAttribute('is-running') !== 'false';

        const rEntryId = randomId();
        ctx.runtime.push({id: rEntryId, type: "run", targetNode: ctx.id, boxId: ctx.boxId, value: isRunning ? 1 : 0});

        const children: ScElementNode[] = [];
        const groupNode: ScGroupNode = {type: 'sc-group', id: ctx.id, boxId: ctx.boxId, name, isRunning, children, runtime: {run: rEntryId, controls: {}}};

        const groupSaved = ctx.saved?.[ctx.offset - 1] as ScGroupNode | undefined;
        const savedChildren = groupSaved?.type === 'sc-group' && groupSaved.name === name
            ? groupSaved.children
            : undefined;

        walkChildren({
            ...ctx,
            saved: savedChildren,
            offset: 0,
            scope: [...ctx.scope, groupNode],
            elements: children,
        });

        ctx.elements.push(groupNode);
        ctx.scope.push(groupNode);
        return ctx;
    }
}
