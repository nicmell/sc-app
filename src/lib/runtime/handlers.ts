import type {
    ScElementNode, ScElementNodeBase, ScParentNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScUgenNode,
    ScRunNode,
    ScPluginNode, PluginRuntime, NodeRuntime, ControlRuntime, UgenRuntime, InputRuntime, RunRuntime, OverrideEntry, StripRuntime,
} from "@/types/parsers";
import {isNode, isParent, isControl, isControlOverride, isRunOverride} from "@/lib/utils/guards";
import {ELEMENTS} from "@/constants/sc-elements";
import {synthDefManager} from "@/lib/synthdef";

export interface RuntimeContext {
    rootId: string;
    tree: ScElementNodeBase;
    nodes: Record<string, ScElementNode>;
    synthdefs: ScSynthDefNode[];
    scope: ScElementNodeBase[];
    visit: (node: ScElementNodeBase) => ScElementNode;
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

function findRunOverride(ctx: RuntimeContext): number | undefined {
    return ctx.overrides?.find(e => isRunOverride(e) && e.targetNode === ctx.path)?.value;
}

function findControlOverride(ctx: RuntimeContext, name: string): number | undefined {
    return ctx.overrides?.find(e => isControlOverride(e) && e.targetNode === ctx.path && e.name === name)?.value;
}

function collectControls(node: { children: ScElementNodeBase[] }): Record<string, number> {
    const controls: Record<string, number> = {};
    for (const child of node.children) {
        if (isControl(child)) {
            controls[child.name] = child.value;
        }
    }
    return controls;
}

function resolve(ctx: RuntimeContext, path: string[]): ScElementNode | undefined {
    const [name, ...rest] = path;
    const idx = ctx.scope.findIndex(s => 'name' in s && s.name === name);
    if (idx < 0) return undefined;

    const childPath = ctx.path ? `${ctx.path}.${name}` : name;

    // Same-level resolve: processElement uses correct visit since scope/elements match
    const target = ctx.nodes[ctx.scope[idx].id] ?? processElement({...ctx, tree: ctx.scope[idx], path: childPath});

    if (rest.length === 0) return target;
    if (!isParent(target)) return undefined;

    // Deeper levels: subtree already processed by visit, walk populated children
    return walkPath(target, rest);
}

function walkPath(node: ScElementNode, path: string[]): ScElementNode | undefined {
    if (path.length === 0) return node;
    if (!isParent(node)) return undefined;
    const [name, ...rest] = path;
    const child = node.children.find(c => 'name' in c && c.name === name);
    return child ? walkPath(child, rest) : undefined;
}

function resolveControlBind(ctx: RuntimeContext): { target: ScElementNode; controlName: string } {
    const n = ctx.tree as { bind: string; type: string };
    const segments = n.bind.split('.');
    const controlName = segments.pop()!;
    const target = segments.length > 0 ? resolve(ctx, segments) : ctx.parentNode;
    if (!target || !isNode(target)) {
        throw new Error(`<${n.type} bind="${n.bind}">: does not match any node in scope`);
    }
    const controls = collectControls(target);
    if (!(controlName in controls)) {
        const targetName = 'name' in target ? target.name : target.id;
        throw new Error(`<${n.type} bind="${n.bind}">: control "${controlName}" is not declared on <${target.type} name="${targetName}">`);
    }
    return {target, controlName};
}

function resolveVisualBind(ctx: RuntimeContext): InputRuntime {
    const {target, controlName} = resolveControlBind(ctx);
    return {rootId: ctx.rootId, targetNode: target.id, name: controlName};
}

// --- Handlers ---

const pluginHandler = (ctx: RuntimeContext): PluginRuntime => {
    const n = ctx.tree as StripRuntime<ScPluginNode>;
    try {
        ctx.visit(ctx.tree);
        const run = findRunOverride(ctx) ?? (n.run ? 1 : 0)
        const controls = collectControls(n);
        for (const name of Object.keys(controls)) {
            controls[name] = findControlOverride(ctx, name) ?? controls[name];
        }
        return {rootId: ctx.rootId, run, loaded: true, controls};
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        Object.assign(n, {children: []});
        for (const id of Object.keys(ctx.nodes)) {
            if (id !== n.id) delete ctx.nodes[id];
        }
        return {rootId: ctx.rootId, run: 0, loaded: false, controls: {}, error};
    }
};

function nodeRuntime(ctx: RuntimeContext): NodeRuntime {
    const n = ctx.tree as StripRuntime<ScGroupNode | ScSynthNode>;
    const run = findRunOverride(ctx) ?? (n.run ? 1 : 0)
    const controls = collectControls(n);
    for (const name of Object.keys(controls)) {
        controls[name] = findControlOverride(ctx, name) ?? controls[name];
    }
    return {rootId: ctx.rootId, run, controls};
}

const groupHandler = (ctx: RuntimeContext): NodeRuntime => {
    ctx.visit(ctx.tree);
    return nodeRuntime(ctx);
};

const synthHandler = (ctx: RuntimeContext): NodeRuntime => {
    const n = ctx.tree as StripRuntime<ScSynthNode>;
    if (n.bind && !resolve(ctx, [n.bind])) {
        throw new Error(`<sc-synth bind="${n.bind}">: does not match any <sc-synthdef>`);
    }
    ctx.visit(ctx.tree);
    return nodeRuntime(ctx);
};

function collectUgenInputs(node: { children: ScElementNodeBase[] }): Record<string, string> {
    const inputs: Record<string, string> = {};
    for (const child of node.children) {
        if (isControl(child)) {
            inputs[child.name] = child.bind ?? String(child.value);
        }
    }
    return inputs;
}

const synthDefHandler = (ctx: RuntimeContext): UgenRuntime => {
    ctx.visit(ctx.tree);
    const n = ctx.tree as StripRuntime<ScSynthDefNode>;
    ctx.synthdefs.push(n as unknown as ScSynthDefNode);
    const params = collectControls(n);
    const ugenChildren = n.children.filter((c): c is ScUgenNode => c.type === 'sc-ugen');
    if (ugenChildren.length > 0) {
        const specsMap = new Map(ugenChildren.map(c => {
            const inputs = collectUgenInputs(c);
            if (c.op) inputs['op'] = c.op;
            return [c.name, {name: c.name, type: c.ugen, rate: c.rate, inputs}];
        }));
        synthDefManager.compile(ctx.rootId, n.id, n.name, params, specsMap);
    }
    return {rootId: ctx.rootId};
};

const ugenHandler = (ctx: RuntimeContext): UgenRuntime => {
    ctx.visit(ctx.tree);
    const n = ctx.tree as StripRuntime<ScUgenNode>;
    for (const child of n.children) {
        if (!isControl(child) || !child.bind) continue;
        const refId = child.bind.split(':')[0];
        if (!resolve(ctx, [refId])) {
            throw new Error(`<sc-ugen name="${n.name}">: input "${child.name}" references unknown "${refId}"`);
        }
    }
    return {rootId: ctx.rootId};
};

const controlHandler = (ctx: RuntimeContext): ControlRuntime => {
    return {rootId: ctx.rootId};
};

const inputHandler = (ctx: RuntimeContext): InputRuntime => {
    const {target, controlName} = resolveControlBind(ctx);
    return {rootId: ctx.rootId, targetNode: target.id, name: controlName};
};

const runHandler = (ctx: RuntimeContext): RunRuntime => {
    const n = ctx.tree as StripRuntime<ScRunNode>;
    const target = n.bind ? resolve(ctx, n.bind.split('.')) : ctx.parentNode;
    if (n.bind && (!target || !isNode(target))) {
        throw new Error(`<sc-run>: bind "${n.bind}" does not match any node in scope`);
    }
    return {rootId: ctx.rootId, targetNode: target ? target.id : ''};
};

const ifHandler = (ctx: RuntimeContext): InputRuntime => {
    ctx.visit(ctx.tree);
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
        case ELEMENTS.SC_CONTROL: runtime = controlHandler(ctx); break;
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
