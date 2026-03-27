import type {
    ScElementNode, ScElementNodeBase, ScParentNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScUgenNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode,
    ScPluginNode, PluginRuntime, NodeRuntime, UgenRuntime, InputRuntime, RuntimeValueEntry, StripRuntime,
} from "@/types/parsers";
import {findElementByPath} from "@/lib/utils/elementTree";
import {isSynthDef, isSynth, isNode} from "@/lib/utils/guards";
import {ELEMENTS} from "@/constants/sc-elements";
import {synthDefManager} from "@/lib/synthdef";

export interface RuntimeContext<T extends ScElementNode = ScElementNode> {
    rootId: string;
    entries: Record<string, RuntimeValueEntry>;
    nodes: Record<string, ScElementNode>;
    synthdefs: ScSynthDefNode[];
    scope: ScElementNodeBase[];
    tree: StripRuntime<T>;
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
    for (const [id, entry] of Object.entries(ctx.entries)) {
        if (entry.type === type && entry.targetNode === targetNode && entry.name === name) {
            return id;
        }
    }
    const id = crypto.randomUUID();
    ctx.entries[id] = {type, rootId: ctx.rootId, targetNode, name, value: defaultValue};
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

function resolveControlBind(n: { bind: string; type: string }, ctx: RuntimeContext): { target: ScElementNode; controlName: string; defaultValue: number } {
    const segments = n.bind.split('.');
    const controlName = segments.pop()!;
    const target = (ctx.parentNode ? findElementByPath(ctx.parentNode, segments) : undefined) as ScElementNode | undefined;
    if (!target || (!isSynth(target) && target.type !== 'sc-group')) {
        throw new Error(`<${n.type} bind="${n.bind}">: does not match any <sc-synth> or <sc-group> in scope`);
    }
    if (!(controlName in target.controls)) {
        throw new Error(`<${n.type} bind="${n.bind}">: control "${controlName}" is not declared on <${target.type} name="${target.name}">`);
    }
    const defaultValue = target.controls[controlName];
    return {target, controlName, defaultValue};
}

function resolveVisualBind(ctx: RuntimeContext<ScDisplayNode | ScIfNode>): InputRuntime {
    const {target, controlName, defaultValue} = resolveControlBind(ctx.tree, ctx);
    const entryId = findOrCreateEntry(ctx, "control", target.id, controlName, defaultValue);
    return {rootId: ctx.rootId, value: entryId};
}

// --- Handlers ---

const pluginHandler = (ctx: RuntimeContext<ScPluginNode>): PluginRuntime => {
    try {
        ctx.visit();
        return {
            rootId: ctx.rootId,
            run: findOrCreateEntry(ctx, "run", ctx.tree.id, ctx.tree.id, 1),
            loaded: true,
            controls: {},
        };
    } catch (e) {
        Object.assign(ctx.tree, {children: []});
        ctx.scope.length = 0;
        for (const id of Object.keys(ctx.nodes)) {
            if (id !== ctx.tree.id) delete ctx.nodes[id];
        }
        for (const id of Object.keys(ctx.entries)) {
            delete ctx.entries[id];
        }
        return {
            rootId: ctx.rootId,
            run: "",
            loaded: false,
            controls: {},
            error: e instanceof Error ? e.message : String(e),
        };
    }
};

const groupHandler = (ctx: RuntimeContext<ScGroupNode>): NodeRuntime => {
    ctx.visit();
    const n = ctx.tree;
    const controls: Record<string, string> = {};
    for (const [name, value] of Object.entries(n.controls)) {
        controls[name] = findOrCreateEntry(ctx, "control", n.id, name, value);
    }
    return {
        rootId: ctx.rootId,
        run: findOrCreateEntry(ctx, "run", n.id, n.name, n.running ? 1 : 0),
        controls,
    };
};

const synthHandler = (ctx: RuntimeContext<ScSynthNode>): NodeRuntime => {
    const n = ctx.tree;
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
        rootId: ctx.rootId,
        run: findOrCreateEntry(ctx, "run", n.id, n.name, n.running ? 1 : 0),
        controls,
    };
};

const synthDefHandler = (ctx: RuntimeContext<ScSynthDefNode>): UgenRuntime => {
    ctx.visit();

    ctx.synthdefs.push(ctx.tree as unknown as ScSynthDefNode);
    const ugenChildren = ctx.tree.children.filter((c): c is ScUgenNode => c.type === 'sc-ugen');
    if (ugenChildren.length > 0) {
        const specsMap = new Map(ugenChildren.map(c =>
            [c.name, {name: c.name, type: c.ugen, rate: c.rate, inputs: c.controls}]
        ));
        synthDefManager.compile(ctx.rootId, ctx.tree.id, ctx.tree.name, ctx.tree.controls, specsMap);
    }
    return {rootId: ctx.rootId};
};

const ugenHandler = (ctx: RuntimeContext<ScUgenNode>): UgenRuntime => {
    const n = ctx.tree;
    for (const [key, value] of Object.entries(n.controls)) {
        if (key === 'op') {
            continue
        }
        const num = Number(value);
        if (!isNaN(num) && value.trim() !== '') {
            continue
        }
        const refId = value.split(':')[0];
        if (ctx.scope.some(s => s.type === 'sc-ugen' && s.name === refId)) {
            continue
        }
        if (ctx.parentNode?.type === 'sc-synthdef' && refId in ctx.parentNode.controls) {
            continue
        }
        throw new Error(`<sc-ugen name="${n.name}">: input "${key}" references unknown "${refId}"`);
    }
    return {rootId: ctx.rootId};
};

const controlHandler = (ctx: RuntimeContext<ScRangeNode | ScCheckboxNode>): InputRuntime => {
    const {target, controlName, defaultValue} = resolveControlBind(ctx.tree, ctx);
    return {rootId: ctx.rootId, value: findOrCreateEntry(ctx, "control", target.id, controlName, defaultValue)};
};

const runHandler = (ctx: RuntimeContext<ScRunNode>): InputRuntime => {
    const n = ctx.tree;
    let target: ScElementNode | undefined;
    if (ctx.parentNode) {
        target = findElementByPath(ctx.parentNode, n.bind ? n.bind.split('.') : []) as ScElementNode | undefined;
    }
    if (n.bind && (!target || !isNode(target))) {
        throw new Error(`<sc-run>: bind "${n.bind}" does not match any <sc-synth> or <sc-group> in scope`);
    }
    const targetId = target ? target.id : '';
    const targetName = target && 'name' in target ? (target as { name: string }).name : '';
    return {rootId: ctx.rootId, value: findOrCreateEntry(ctx, "run", targetId, targetName, 1)};
};

const displayHandler = (ctx: RuntimeContext<ScDisplayNode>): InputRuntime => {
    return resolveVisualBind(ctx);
};

const ifHandler = (ctx: RuntimeContext<ScIfNode>): InputRuntime => {
    ctx.visit();
    return resolveVisualBind(ctx);
};

// --- Dispatch ---

export function processElement<T extends ScElementNode = ScElementNode>(ctx: RuntimeContext<T>): T {
    const c = ctx as RuntimeContext<any>;
    let runtime: unknown;
    switch (ctx.tree.type) {
        case ELEMENTS.SC_PLUGIN: runtime = pluginHandler(c); break;
        case ELEMENTS.SC_GROUP: runtime = groupHandler(c); break;
        case ELEMENTS.SC_SYNTH: runtime = synthHandler(c); break;
        case ELEMENTS.SC_SYNTHDEF: runtime = synthDefHandler(c); break;
        case ELEMENTS.SC_UGEN: runtime = ugenHandler(c); break;
        case ELEMENTS.SC_RANGE:
        case ELEMENTS.SC_CHECKBOX: runtime = controlHandler(c); break;
        case ELEMENTS.SC_RUN: runtime = runHandler(c); break;
        case ELEMENTS.SC_DISPLAY: runtime = displayHandler(c); break;
        case ELEMENTS.SC_IF: runtime = ifHandler(c); break;
        default: {
            throw new Error(`Unknown element type: ${c.tree.type}`);
        }
    }
    Object.assign(ctx.tree, {runtime});
    const node = ctx.tree as unknown as T;
    ctx.nodes[node.id] = node;
    return node;
}
