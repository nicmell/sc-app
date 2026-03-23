import type {
    ScElementNode, ScElementNodeBase, ScParentNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScUgenNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode,
    ScPluginNode, UgenRuntime, RuntimeValueEntry,
} from "@/types/parsers";
import {findElementByPath} from "@/lib/utils/elementTree";
import {isSynthDef, isSynth, isGroup, isNode} from "@/lib/utils/guards";
import {ELEMENTS} from "@/constants/sc-elements";

export type RuntimeHandler<T extends ScElementNode> =
    (ctx: RuntimeContext<T>) => { runtime: T["runtime"] };

export interface RuntimeContext<T extends ScElementNode = ScElementNode> {
    rootId: string;
    entries: Map<string, RuntimeValueEntry>;
    persistedEntries: Record<string, RuntimeValueEntry>;
    nodesMap: Map<string, ScElementNode>;
    synthdefs: ScSynthDefNode[];
    scope: ScElementNode[];
    node: T;
    element: Element;
    saved?: ScElementNodeBase;
    visit: () => void;
    parentNode?: ScParentNode;
}

// --- Helpers ---

function findOrCreateEntry(
    ctx: RuntimeContext,
    type: "control" | "run",
    targetNode: string,
    name: string,
    defaultValue: number,
): string {
    // 1. Check ctx.entries for existing entry created this parse session
    for (const [id, entry] of ctx.entries) {
        if (entry.type === type && entry.targetNode === targetNode && entry.name === name) {
            return id;
        }
    }

    // 2. Check persisted entries
    for (const [id, entry] of Object.entries(ctx.persistedEntries)) {
        if (entry.type === type && entry.targetNode === targetNode && entry.name === name) {
            ctx.entries.set(id, entry);
            return id;
        }
    }

    // 3. Create new entry
    const id = crypto.randomUUID();
    ctx.entries.set(id, {type, rootId: ctx.rootId, targetNode, name, value: defaultValue});
    return id;
}

export function checkDuplicateNames(scope: ScElementNode[]): void {
    const seen = new Set<string>();
    for (const el of scope) {
        if ('name' in el && el.name) {
            if (seen.has(el.name as string)) {
                throw new Error(`<${el.type} name="${el.name}">: duplicate name in scope`);
            }
            seen.add(el.name as string);
        }
    }
}

function resolveControlBind(n: {bind: string; type: string}, ctx: RuntimeContext): {target: ScElementNode; controlName: string; defaultValue: number} {
    const segments = n.bind.split('.');
    const controlName = segments.pop()!;
    const target = (ctx.parentNode ? findElementByPath(ctx.parentNode, segments) : undefined) as ScElementNode | undefined;
    if (!target || (!isSynth(target) && !isGroup(target))) {
        throw new Error(`<${n.type} bind="${n.bind}">: does not match any <sc-synth> or <sc-group> in scope`);
    }
    const defaultValue = isSynth(target) ? (target.controls[controlName] ?? 0) : 0;
    return {target, controlName, defaultValue};
}

function resolveVisualBind(ctx: RuntimeContext<ScDisplayNode | ScIfNode>) {
    const {target, controlName, defaultValue} = resolveControlBind(ctx.node, ctx);
    const entryId = findOrCreateEntry(ctx, "control", target.id, controlName, defaultValue);
    return {value: entryId};
}

// --- Handlers ---

const pluginHandler: RuntimeHandler<ScPluginNode> = (ctx) => ({
    runtime: {
        run: findOrCreateEntry(ctx, "run", ctx.node.id, ctx.node.id, 1),
        controls: {},
        loaded: false,
    },
});

const groupHandler: RuntimeHandler<ScGroupNode> = (ctx) => ({
    runtime: {
        run: findOrCreateEntry(ctx, "run", ctx.node.id, ctx.node.name, ctx.node.running ? 1 : 0),
        controls: {},
    },
});

const synthHandler: RuntimeHandler<ScSynthNode> = (ctx) => {
    const n = ctx.node;
    if (n.bind) {
        if (!ctx.scope.some(e => isSynthDef(e) && e.name === n.bind)) {
            throw new Error(`<sc-synth bind="${n.bind}">: does not match any <sc-synthdef>`);
        }
    }
    const controls: Record<string, string> = {};
    for (const [name, value] of Object.entries(n.controls)) {
        controls[name] = findOrCreateEntry(ctx, "control", n.id, name, value);
    }
    return {
        runtime: {
            run: findOrCreateEntry(ctx, "run", n.id, n.name, n.running ? 1 : 0),
            controls,
        },
    };
};

const synthDefHandler: RuntimeHandler<ScSynthDefNode> = (ctx) => {
    ctx.synthdefs.push(ctx.node);
    return { runtime: {} as UgenRuntime };
};

const ugenHandler: RuntimeHandler<ScUgenNode> = (ctx) => {
    const n = ctx.node;
    for (const [key, value] of Object.entries(n.controls)) {
        if (key === 'op') continue;
        const num = Number(value);
        if (!isNaN(num) && value.trim() !== '') continue;
        const refId = value.split(':')[0];
        if (ctx.scope.some(s => s.type === 'sc-ugen' && s.name === refId)) continue;
        if (ctx.parentNode?.type === 'sc-synthdef' && refId in ctx.parentNode.controls) continue;
        throw new Error(`<sc-ugen name="${n.name}">: input "${key}" references unknown "${refId}"`);
    }
    return { runtime: {} as UgenRuntime };
};

const controlHandler = (ctx: RuntimeContext<ScRangeNode | ScCheckboxNode>) => {
    const {target, controlName, defaultValue} = resolveControlBind(ctx.node, ctx);
    const entryId = findOrCreateEntry(ctx, "control", target.id, controlName, defaultValue);
    if (isNode(target) && target.runtime) {
        target.runtime.controls[controlName] = entryId;
    }
    return { runtime: {value: entryId} };
};

const runHandler: RuntimeHandler<ScRunNode> = (ctx) => {
    const n = ctx.node;
    let target: ScElementNode | undefined;
    if (ctx.parentNode) {
        target = findElementByPath(ctx.parentNode, n.bind ? n.bind.split('.') : []) as ScElementNode | undefined;
    }
    if (n.bind && (!target || !isNode(target))) {
        throw new Error(`<sc-run>: bind "${n.bind}" does not match any <sc-synth> or <sc-group> in scope`);
    }
    const targetId = target ? target.id : '';
    const targetName = target && 'name' in target ? (target as {name: string}).name : '';
    const entryId = findOrCreateEntry(ctx, "run", targetId, targetName, 1);
    if (target && isNode(target) && target.runtime) {
        target.runtime.run = entryId;
    }
    return { runtime: {value: entryId} };
};

const displayHandler: RuntimeHandler<ScDisplayNode> = (ctx) => ({
    runtime: resolveVisualBind(ctx),
});

const ifHandler: RuntimeHandler<ScIfNode> = (ctx) => ({
    runtime: resolveVisualBind(ctx),
});

// --- Handler map ---

export const handlers: Record<string, RuntimeHandler<any>> = {
    [ELEMENTS.SC_PLUGIN]: pluginHandler,
    [ELEMENTS.SC_GROUP]: groupHandler,
    [ELEMENTS.SC_SYNTH]: synthHandler,
    [ELEMENTS.SC_SYNTHDEF]: synthDefHandler,
    [ELEMENTS.SC_UGEN]: ugenHandler,
    [ELEMENTS.SC_RANGE]: controlHandler,
    [ELEMENTS.SC_CHECKBOX]: controlHandler,
    [ELEMENTS.SC_RUN]: runHandler,
    [ELEMENTS.SC_DISPLAY]: displayHandler,
    [ELEMENTS.SC_IF]: ifHandler,
};
