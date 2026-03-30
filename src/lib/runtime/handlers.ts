import type {
    ScElementNode, ScElementNodeBase, ScParentNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScUgenNode,
    ScRunNode,
    ScPluginNode, PluginRuntime, NodeRuntime, UgenRuntime, InputRuntime, OverrideEntry, StripRuntime,
} from "@/types/parsers";
import {isSynth, isNode, isParent} from "@/lib/utils/guards";
import {ELEMENTS} from "@/constants/sc-elements";
import {synthDefManager} from "@/lib/synthdef";

export interface RuntimeContext {
    rootId: string;
    tree: ScElementNodeBase;
    nodes: Record<string, ScElementNode>;
    synthdefs: ScSynthDefNode[];
    scope: ScElementNodeBase[];
    visit: () => void;
    parentNode?: ScParentNode;
    overrides?: OverrideEntry[];
    path: (name?: string) => string;
}

// --- Helpers ---

export function checkDuplicateNames(scope: ScElementNodeBase[]): void {
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

function findOverride(ctx: RuntimeContext, type: "control" | "run", name: string): number | undefined {
    return ctx.overrides?.find(e => e.type === type && e.targetNode === ctx.path() && e.name === name)?.value;
}

function resolve(ctx: RuntimeContext, path: string[]): ScElementNode | undefined {
    const [name, ...rest] = path;
    const idx = ctx.scope.findIndex(s => 'name' in s && s.name === name);
    if (idx < 0) return undefined;

    const nodePath = ctx.path(name);
    const childPath = (child?: string) => child ? `${nodePath}.${child}` : nodePath;

    const target = ctx.nodes[ctx.scope[idx].id] ?? processElement({...ctx, tree: ctx.scope[idx], path: childPath});

    if (rest.length === 0) return target;
    if (!isParent(target)) return undefined;
    return resolve({...ctx, scope: [...target.children, ...ctx.scope], parentNode: target, path: childPath}, rest);
}

function resolveControlBind(ctx: RuntimeContext): { target: ScElementNode; controlName: string; defaultValue: number } {
    const n = ctx.tree as { bind: string; type: string };
    const segments = n.bind.split('.');
    const controlName = segments.pop()!;
    const target = segments.length > 0 ? resolve(ctx, segments) : ctx.parentNode as ScElementNode | undefined;
    if (!target || (!isSynth(target) && target.type !== 'sc-group')) {
        throw new Error(`<${n.type} bind="${n.bind}">: does not match any <sc-synth> or <sc-group> in scope`);
    }
    if (!(controlName in target.controls)) {
        throw new Error(`<${n.type} bind="${n.bind}">: control "${controlName}" is not declared on <${target.type} name="${target.name}">`);
    }
    const defaultValue = target.controls[controlName];
    return {target, controlName, defaultValue};
}

function resolveVisualBind(ctx: RuntimeContext): InputRuntime {
    const {target, controlName} = resolveControlBind(ctx);
    return {rootId: ctx.rootId, targetNode: target.id, name: controlName};
}

// --- Handlers ---

const pluginHandler = (ctx: RuntimeContext): PluginRuntime => {
    const n = ctx.tree as StripRuntime<ScPluginNode>;
    try {
        ctx.visit();
        return {
            rootId: ctx.rootId,
            run: findOverride(ctx, "run", n.id) ?? (n.run ? 1 : 0),
            loaded: true,
            controls: {},
        };
    } catch (e) {
        Object.assign(n, {children: []});
        for (const id of Object.keys(ctx.nodes)) {
            if (id !== n.id) delete ctx.nodes[id];
        }
        return {
            rootId: ctx.rootId,
            run: 0,
            loaded: false,
            controls: {},
            error: e instanceof Error ? e.message : String(e),
        };
    }
};

function nodeRuntime(ctx: RuntimeContext): NodeRuntime {
    const n = ctx.tree as StripRuntime<ScGroupNode | ScSynthNode>;
    const controls = {...n.controls};
    for (const name of Object.keys(controls)) {
        controls[name] = findOverride(ctx, "control", name) ?? controls[name];
    }
    return {
        rootId: ctx.rootId,
        run: findOverride(ctx, "run", n.name) ?? (n.run ? 1 : 0),
        controls,
    };
}

const groupHandler = (ctx: RuntimeContext): NodeRuntime => {
    ctx.visit();
    return nodeRuntime(ctx);
};

const synthHandler = (ctx: RuntimeContext): NodeRuntime => {
    const n = ctx.tree as StripRuntime<ScSynthNode>;
    if (n.bind && !resolve(ctx, [n.bind])) {
        throw new Error(`<sc-synth bind="${n.bind}">: does not match any <sc-synthdef>`);
    }
    return nodeRuntime(ctx);
};

const synthDefHandler = (ctx: RuntimeContext): UgenRuntime => {
    ctx.visit();
    const n = ctx.tree as StripRuntime<ScSynthDefNode>;
    ctx.synthdefs.push(n as unknown as ScSynthDefNode);
    const ugenChildren = n.children.filter((c): c is ScUgenNode => c.type === 'sc-ugen');
    if (ugenChildren.length > 0) {
        const specsMap = new Map(ugenChildren.map(c =>
            [c.name, {name: c.name, type: c.ugen, rate: c.rate, inputs: c.controls}]
        ));
        synthDefManager.compile(ctx.rootId, n.id, n.name, n.controls, specsMap);
    }
    return {rootId: ctx.rootId};
};

const ugenHandler = (ctx: RuntimeContext): UgenRuntime => {
    const n = ctx.tree as StripRuntime<ScUgenNode>;
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

const inputHandler = (ctx: RuntimeContext): InputRuntime => {
    const {target, controlName} = resolveControlBind(ctx);
    return {rootId: ctx.rootId, targetNode: target.id, name: controlName};
};

const runHandler = (ctx: RuntimeContext): InputRuntime => {
    const n = ctx.tree as StripRuntime<ScRunNode>;
    const target = n.bind ? resolve(ctx, n.bind.split('.')) : ctx.parentNode as ScElementNode | undefined;
    if (n.bind && (!target || !isNode(target))) {
        throw new Error(`<sc-run>: bind "${n.bind}" does not match any <sc-synth> or <sc-group> in scope`);
    }
    const targetId = target ? target.id : '';
    const targetName = target && 'name' in target ? (target as { name: string }).name : '';
    return {rootId: ctx.rootId, targetNode: targetId, name: targetName};
};

const ifHandler = (ctx: RuntimeContext): InputRuntime => {
    ctx.visit();
    return resolveVisualBind(ctx);
};

// --- Dispatch ---

export function processElement(ctx: RuntimeContext): ScElementNode {
    const existing = ctx.nodes[ctx.tree.id];
    if (existing) {
        return existing
    }
    let runtime: unknown;
    switch (ctx.tree.type) {
        case ELEMENTS.SC_PLUGIN: runtime = pluginHandler(ctx); break;
        case ELEMENTS.SC_GROUP: runtime = groupHandler(ctx); break;
        case ELEMENTS.SC_SYNTH: runtime = synthHandler(ctx); break;
        case ELEMENTS.SC_SYNTHDEF: runtime = synthDefHandler(ctx); break;
        case ELEMENTS.SC_UGEN: runtime = ugenHandler(ctx); break;
        case ELEMENTS.SC_RANGE:
        case ELEMENTS.SC_CHECKBOX: runtime = inputHandler(ctx); break;
        case ELEMENTS.SC_RUN: runtime = runHandler(ctx); break;
        case ELEMENTS.SC_DISPLAY: runtime = resolveVisualBind(ctx); break;
        case ELEMENTS.SC_IF: runtime = ifHandler(ctx); break;
        default: {
            throw new Error(`Unknown element type: ${(ctx.tree as ScElementNodeBase).type}`);
        }
    }
    Object.assign(ctx.tree, {runtime});
    const node = ctx.tree as unknown as ScElementNode;
    ctx.nodes[node.id] = node;
    if (ctx.parentNode) {
        ctx.parentNode.children.push(node);
    }
    return node;
}
