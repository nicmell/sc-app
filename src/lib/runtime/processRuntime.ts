import {isParent} from "@/lib/utils/guards";
import {type RuntimeContext, dispatchRuntime} from "./handlers";

export function processRuntime(ctx: RuntimeContext): void {
    // 1. Recurse into children of parent nodes FIRST
    for (const node of ctx.scope) {
        if (isParent(node)) {
            processRuntime({...ctx, scope: node.children, parentNode: node});
        }
    }
    // 2. Then process all siblings at this level
    for (let i = 0; i < ctx.scope.length; i++) {
        ctx.scope[i].runtime = dispatchRuntime({...ctx, offset: i});
    }
}
