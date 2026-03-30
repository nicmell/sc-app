import type {
    ScElementNode, ScElementNodeBase, ScParentNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScUgenNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode,
    ScPluginNode, PluginRuntime, NodeRuntime, UgenRuntime, InputRuntime, OverrideEntry, StripRuntime,
} from "@/types/parsers";
import {isSynthDef, isSynth, isNode, isParent} from "@/lib/utils/guards";
import {ELEMENTS} from "@/constants/sc-elements";
import {synthDefManager} from "@/lib/synthdef";

export interface RuntimeContext<T extends ScElementNode = ScElementNode> {
    rootId: string;
    offset: number;
    nodes: Record<string, ScElementNode>;
    synthdefs: ScSynthDefNode[];
    elements: Element[];
    scope: ScElementNodeBase[];
    tree: StripRuntime<T>;
    visit: (i: number) => ScElementNode;
    parentNode?: ScParentNode;
    overrides?: OverrideEntry[];
    path: string;
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
    return ctx.overrides?.find(e => e.type === type && e.targetNode === ctx.path && e.name === name)?.value;
}

function resolve(ctx: RuntimeContext, path: string[]): ScElementNode | undefined {
    const [name, ...rest] = path;
    const idx = ctx.scope.findIndex(s => 'name' in s && s.name === name);
    if (idx < 0) return undefined;

    const childName = typeof (ctx.scope[idx] as any).name === 'string' ? (ctx.scope[idx] as any).name : '';
    const childPath = childName ? (ctx.path ? `${ctx.path}.${childName}` : childName) : ctx.path;

    const target = processElement({
        ...ctx,
        tree: ctx.scope[idx] as any,
        offset: idx,
        path: childPath,
    });

    if (rest.length === 0) return target;
    if (!isParent(target)) return undefined;
    return resolve({...ctx, scope: target.children, parentNode: target, path: childPath}, rest);
}

function resolveControlBind(n: { bind: string; type: string }, ctx: RuntimeContext): { target: ScElementNode; controlName: string; defaultValue: number } {
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

function resolveVisualBind(ctx: RuntimeContext<ScDisplayNode | ScIfNode>): InputRuntime {
    const {target, controlName} = resolveControlBind(ctx.tree, ctx);
    return {rootId: ctx.rootId, targetNode: target.id, name: controlName};
}

// --- Handlers ---

const pluginHandler = (ctx: RuntimeContext<ScPluginNode>): PluginRuntime => {
    try {
        ctx.visit(ctx.offset);
        return {
            rootId: ctx.rootId,
            run: findOverride(ctx, "run", ctx.tree.id) ?? (ctx.tree.run ? 1 : 0),
            loaded: true,
            controls: {},
        };
    } catch (e) {
        Object.assign(ctx.tree, {children: []});
        ctx.scope.length = 0;
        for (const id of Object.keys(ctx.nodes)) {
            if (id !== ctx.tree.id) delete ctx.nodes[id];
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

const groupHandler = (ctx: RuntimeContext<ScGroupNode>): NodeRuntime => {
    ctx.visit(ctx.offset);
    const n = ctx.tree;
    const controls = {...n.controls};
    for (const name of Object.keys(controls)) {
        controls[name] = findOverride(ctx, "control", name) ?? controls[name];
    }
    return {
        rootId: ctx.rootId,
        run: findOverride(ctx, "run", n.name) ?? (n.run ? 1 : 0),
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
    const controls = {...n.controls};
    for (const name of Object.keys(controls)) {
        controls[name] = findOverride(ctx, "control", name) ?? controls[name];
    }
    return {
        rootId: ctx.rootId,
        run: findOverride(ctx, "run", n.name) ?? (n.run ? 1 : 0),
        controls,
    };
};

const synthDefHandler = (ctx: RuntimeContext<ScSynthDefNode>): UgenRuntime => {
    ctx.visit(ctx.offset);

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

const inputHandler = (ctx: RuntimeContext<ScRangeNode | ScCheckboxNode>): InputRuntime => {
    const {target, controlName} = resolveControlBind(ctx.tree, ctx);
    return {rootId: ctx.rootId, targetNode: target.id, name: controlName};
};

const runHandler = (ctx: RuntimeContext<ScRunNode>): InputRuntime => {
    const n = ctx.tree;
    const target = n.bind ? resolve(ctx, n.bind.split('.')) : ctx.parentNode as ScElementNode | undefined;
    if (n.bind && (!target || !isNode(target))) {
        throw new Error(`<sc-run>: bind "${n.bind}" does not match any <sc-synth> or <sc-group> in scope`);
    }
    const targetId = target ? target.id : '';
    const targetName = target && 'name' in target ? (target as { name: string }).name : '';
    return {rootId: ctx.rootId, targetNode: targetId, name: targetName};
};

const displayHandler = (ctx: RuntimeContext<ScDisplayNode>): InputRuntime => {
    return resolveVisualBind(ctx);
};

const ifHandler = (ctx: RuntimeContext<ScIfNode>): InputRuntime => {
    ctx.visit(ctx.offset);
    return resolveVisualBind(ctx);
};

// --- Dispatch ---

export function processElement<T extends ScElementNode = ScElementNode>(ctx: RuntimeContext<T>): T {
    const existing = ctx.nodes[ctx.tree.id];
    if (existing) {
        return existing as T
    }
    const c = ctx as RuntimeContext<any>;
    let runtime: unknown;
    checkDuplicateNames(ctx.scope);
    switch (ctx.tree.type) {
        case ELEMENTS.SC_PLUGIN: runtime = pluginHandler(c); break;
        case ELEMENTS.SC_GROUP: runtime = groupHandler(c); break;
        case ELEMENTS.SC_SYNTH: runtime = synthHandler(c); break;
        case ELEMENTS.SC_SYNTHDEF: runtime = synthDefHandler(c); break;
        case ELEMENTS.SC_UGEN: runtime = ugenHandler(c); break;
        case ELEMENTS.SC_RANGE:
        case ELEMENTS.SC_CHECKBOX: runtime = inputHandler(c); break;
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
    if (ctx.parentNode) {
        ctx.parentNode.children.push(node);
    }
    return node;
}
