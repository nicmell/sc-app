import type {
    ScElementNode, ScElementNodeBase, ScParentNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScUgenNode,
    ScRunNode, ScControlNode, ScVarNode,
    ScPluginNode, PluginRuntime, NodeRuntime, ControlRuntime, VarRuntime, UgenRuntime, SynthDefRuntime, InputRuntime, RunRuntime, OverrideEntry, StripRuntime,
} from "@/types/parsers";
import {isNode, isParent, isControl, isVar, isControlOverride, isRunOverride, isVarOverride} from "@/lib/utils/guards";
import {ELEMENTS} from "@/constants/sc-elements";
import {synthDefManager} from "@/lib/synthdef";

export interface RuntimeContext {
    rootId: string;
    tree: ScElementNodeBase;
    nodes: Map<string, ScElementNode>;
    synthdefs: ScSynthDefNode[];
    scope: ScElementNodeBase[];
    visit: (node: ScElementNodeBase) => ScElementNode;
    parentNode?: ScParentNode;
    overrides?: OverrideEntry[];
    path: string[];
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

function findRunOverride(ctx: RuntimeContext, path: string[]): number | undefined {
    const target = path.join('.');
    return ctx.overrides?.find(e => isRunOverride(e) && e.targetPath === target)?.value;
}

function findControlOverride(ctx: RuntimeContext, path: string[]): number | undefined {
    const target = path.join('.');
    return ctx.overrides?.find(e => isControlOverride(e) && e.targetPath === target)?.value;
}

function findVarOverride(ctx: RuntimeContext, path: string[]): number | undefined {
    const target = path.join('.');
    return ctx.overrides?.find(e => isVarOverride(e) && e.targetPath === target)?.value;
}

function collectControlParams(node: { children: ScElementNodeBase[] }): Record<string, number> {
    const controls: Record<string, number> = {};
    for (const child of node.children) {
        if (isControl(child) && child.value != null) {
            controls[child.name] = child.value;
        }
    }
    return controls;
}

function resolve(ctx: RuntimeContext, path: string[]): ScElementNode | undefined {
    const [name, ...rest] = path;
    const idx = ctx.scope.findIndex(s => 'name' in s && s.name === name);
    if (idx < 0) return undefined;

    // Same-level resolve: sibling shares the same parent path
    const target = ctx.nodes.get(ctx.scope[idx].id) ?? processElement({...ctx, tree: ctx.scope[idx]});

    return walkPath(target, rest);
}

function walkPath(node: ScElementNode, path: string[]): ScElementNode | undefined {
    if (path.length === 0) return node
    if (isParent(node)) {
        const [name, ...rest] = path;
        const child = node.children.find(c => 'name' in c && c.name === name);
        return child ? walkPath(child, rest) : undefined;
    }
    return undefined
}

function resolveControlBind(ctx: RuntimeContext): { target: ScElementNode; controlName: string } {
    const n = ctx.tree as { bind: string; type: string };
    const segments = n.bind.split('.');
    const controlName = segments.pop()!;
    const target = segments.length > 0 ? resolve(ctx, segments) : ctx.parentNode;
    if (!target || !isNode(target)) {
        throw new Error(`<${n.type} bind="${n.bind}">: does not match any node in scope`);
    }
    if (!isParent(target) || !target.children.some(c => (isControl(c) || isVar(c)) && c.name === controlName)) {
        const targetName = 'name' in target ? target.name : target.id;
        throw new Error(`<${n.type} bind="${n.bind}">: control "${controlName}" is not declared on <${target.type} name="${targetName}">`);
    }
    return {target, controlName};
}

function parentId(ctx: RuntimeContext): string {
    return ctx.parentNode?.id ?? '';
}

function resolveVisualBind(ctx: RuntimeContext): InputRuntime {
    const {target, controlName} = resolveControlBind(ctx);
    const control = (target as ScParentNode).children.find(c => (isControl(c) || isVar(c)) && c.name === controlName)!;
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, targetId: control.id};
}

// --- Handlers ---

const pluginHandler = (ctx: RuntimeContext): PluginRuntime => {
    const n = ctx.tree as StripRuntime<ScPluginNode>;
    try {
        ctx.visit(ctx.tree);
        const run = findRunOverride(ctx, ctx.path) ?? (n.run ? 1 : 0)
        return {rootId: ctx.rootId, parentId: '', path: ctx.path, run, loaded: false, nodeId: 0};
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e)
        Object.assign(n, {children: []});
        for (const id of ctx.nodes.keys()) {
            if (id !== n.id) ctx.nodes.delete(id);
        }
        return {rootId: ctx.rootId, parentId: '', path: ctx.path, run: 0, loaded: false, nodeId: 0, error};
    }
};

function nodeRuntime(ctx: RuntimeContext): NodeRuntime {
    const n = ctx.tree as StripRuntime<ScGroupNode | ScSynthNode>;
    const path = [...ctx.path, n.name];
    const run = findRunOverride(ctx, path) ?? (n.run ? 1 : 0)
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, run, loaded: false, nodeId: 0};
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

const synthDefHandler = (ctx: RuntimeContext): SynthDefRuntime => {
    ctx.visit(ctx.tree);
    const n = ctx.tree as StripRuntime<ScSynthDefNode>;
    ctx.synthdefs.push(n as unknown as ScSynthDefNode);
    const params = collectControlParams(n);
    const ugenChildren = n.children.filter((c): c is ScUgenNode => c.type === 'sc-ugen');
    if (ugenChildren.length > 0) {
        const specsMap = new Map(ugenChildren.map(c => {
            const inputs = collectUgenInputs(c);
            if (c.op) inputs['op'] = c.op;
            return [c.name, {name: c.name, type: c.ugen, rate: c.rate, inputs}];
        }));
        synthDefManager.compile(ctx.rootId, n.id, n.name, params, specsMap);
    }
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, loaded: false};
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
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path};
};

const controlHandler = (ctx: RuntimeContext): ControlRuntime => {
    const n = ctx.tree as StripRuntime<ScControlNode>;
    const value = findControlOverride(ctx, [...ctx.path, n.name]) ?? n.value ?? 0;
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, name: n.name, value};
};

const varHandler = (ctx: RuntimeContext): VarRuntime => {
    const n = ctx.tree as StripRuntime<ScVarNode>;
    const value = findVarOverride(ctx, [...ctx.path, n.name]) ?? n.value ?? 0;
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, name: n.name, value};
};

const inputHandler = (ctx: RuntimeContext): InputRuntime => {
    return resolveVisualBind(ctx);
};

const runHandler = (ctx: RuntimeContext): RunRuntime => {
    const n = ctx.tree as StripRuntime<ScRunNode>;
    const target = n.bind ? resolve(ctx, n.bind.split('.')) : ctx.parentNode;
    if (n.bind && (!target || !isNode(target))) {
        throw new Error(`<sc-run>: bind "${n.bind}" does not match any node in scope`);
    }
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, targetId: target ? target.id : ''};
};

const ifHandler = (ctx: RuntimeContext): InputRuntime => {
    ctx.visit(ctx.tree);
    return resolveVisualBind(ctx);
};

// --- Dispatch ---

export function processElement(ctx: RuntimeContext): ScElementNode {
    const existing = ctx.nodes.get(ctx.tree.id);
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
        case ELEMENTS.SC_VAR: runtime = varHandler(ctx); break;
        case ELEMENTS.SC_RANGE:  runtime = inputHandler(ctx); break;
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
    ctx.nodes.set(node.id, node);
    if (ctx.parentNode) {
        ctx.parentNode.children.push(node);
    }
    return node;
}
