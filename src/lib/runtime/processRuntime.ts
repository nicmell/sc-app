import {isParent} from "@/lib/utils/guards";
import {type RuntimeContext, dispatchRuntime} from "./handlers";

export function processRuntime(ctx: RuntimeContext): void {
    for (let i = 0; i < ctx.scope.length; i++) {
        const node = ctx.scope[i];
       node.runtime = dispatchRuntime({...ctx, offset: i});
        if (isParent(node)) {
            processRuntime({...ctx, scope: node.children, parentNode: node, offset: 0});
        }
    }
}
