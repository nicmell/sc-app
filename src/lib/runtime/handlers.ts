import type {
    ScElementItem, ScElementItemBase, ScParentItem, ScGroupItem, ScSynthItem, ScSynthDefItem, ScUgenItem,
    ScRunItem, ScControlItem, ScVarItem,
    ScPluginItem, NodeRuntime, ControlRuntime, VarRuntime, UgenRuntime, SynthDefRuntime, InputRuntime, RunRuntime, OverrideEntry, StripRuntime,
} from "@/types/parsers";
import {isNode, isParent, isControl, isState, isControlOverride, isRunOverride, isVarOverride} from "@/lib/utils/guards";
import {ELEMENTS} from "@/constants/sc-elements";
import {synthDefManager} from "@/lib/synthdef";

export interface RuntimeContext {
    rootId: string;
    tree: ScElementItemBase;
    nodes: Map<string, ScElementItem>;
    synthdefs: ScSynthDefItem[];
    scope: ScElementItemBase[];
    visit: (node: ScElementItemBase) => ScElementItem;
    parentNode?: ScParentItem;
    overrides?: OverrideEntry[];
    path: string[];
}

// --- Helpers ---

export function checkDuplicateNames(scope: ScElementItemBase[]): void {
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

function collectControlParams(node: { children: ScElementItemBase[] }): Record<string, number> {
    const controls: Record<string, number> = {};
    for (const child of node.children) {
        if (isControl(child) && child.value != null) {
            controls[child.name] = child.value;
        }
    }
    return controls;
}

function resolve(ctx: RuntimeContext, path: string[]): ScElementItem | undefined {
    const [name, ...rest] = path;
    const idx = ctx.scope.findIndex(s => 'name' in s && s.name === name);
    if (idx < 0) return undefined;

    // Same-level resolve: sibling shares the same parent path
    const target = ctx.nodes.get(ctx.scope[idx].id) ?? processElement({...ctx, tree: ctx.scope[idx]});

    return walkPath(target, rest);
}

function walkPath(node: ScElementItem, path: string[]): ScElementItem | undefined {
    if (path.length === 0) return node
    if (isParent(node)) {
        const [name, ...rest] = path;
        const child = node.children.find(c => 'name' in c && c.name === name);
        return child ? walkPath(child, rest) : undefined;
    }
    return undefined
}

function resolveControlBind(ctx: RuntimeContext): { target: ScElementItem; controlName: string } {
    const n = ctx.tree as { bind: string; type: string };
    const segments = n.bind.split('.');
    const controlName = segments.pop()!;
    const target = segments.length > 0 ? resolve(ctx, segments) : ctx.parentNode;
    if (!target || !isNode(target)) {
        throw new Error(`<${n.type} bind="${n.bind}">: does not match any node in scope`);
    }
    if (!isParent(target) || !target.children.some(c => isState(c) && c.name === controlName)) {
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
    const control = (target as ScParentItem).children.find(c => isState(c) && c.name === controlName)!;
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, enabled: true, targetId: control.id};
}

// --- Handlers ---

const pluginHandler = (ctx: RuntimeContext): NodeRuntime => {
    const n = ctx.tree as StripRuntime<ScPluginItem>;
    try {
        if (n.error) throw new Error(n.error);
        ctx.visit(ctx.tree);
        const run = findRunOverride(ctx, ctx.path) ?? (n.run ? 1 : 0)
        return {rootId: ctx.rootId, parentId: '', path: ctx.path, enabled: true, run, loaded: false, nodeId: 0};
    } catch (e) {
        Object.assign(n, {children: []});
        for (const id of ctx.nodes.keys()) {
            if (id !== n.id) ctx.nodes.delete(id);
        }
        throw e;
    }
};

function nodeRuntime(ctx: RuntimeContext): NodeRuntime {
    const n = ctx.tree as StripRuntime<ScGroupItem | ScSynthItem>;
    const path = [...ctx.path, n.name];
    const run = findRunOverride(ctx, path) ?? (n.run ? 1 : 0)
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, enabled: true, run, loaded: false, nodeId: 0};
}

const groupHandler = (ctx: RuntimeContext): NodeRuntime => {
    ctx.visit(ctx.tree);
    return nodeRuntime(ctx);
};

const synthHandler = (ctx: RuntimeContext): NodeRuntime => {
    const n = ctx.tree as StripRuntime<ScSynthItem>;
    if (n.bind && !resolve(ctx, [n.bind])) {
        throw new Error(`<sc-synth bind="${n.bind}">: does not match any <sc-synthdef>`);
    }
    ctx.visit(ctx.tree);
    return nodeRuntime(ctx);
};

function collectUgenInputs(node: { children: ScElementItemBase[] }): Record<string, string> {
    const inputs: Record<string, string> = {};
    for (const child of node.children) {
        if (isControl(child)) {
            if (!child.bind && child.value == null) {
                throw new Error(`<sc-control name="${child.name}">: requires either a bind or value attribute`);
            }
            inputs[child.name] = child.bind ?? String(child.value);
        }
    }
    return inputs;
}

const synthDefHandler = (ctx: RuntimeContext): SynthDefRuntime => {
    ctx.visit(ctx.tree);
    const n = ctx.tree as StripRuntime<ScSynthDefItem>;
    ctx.synthdefs.push(n as unknown as ScSynthDefItem);
    const params = collectControlParams(n);
    const ugenChildren = n.children.filter((c): c is ScUgenItem => c.type === 'sc-ugen');
    if (ugenChildren.length > 0) {
        const specsMap = new Map(ugenChildren.map(c => {
            const inputs = collectUgenInputs(c);
            if (c.op) inputs['op'] = c.op;
            return [c.name, {name: c.name, type: c.ugen, rate: c.rate, inputs}];
        }));
        synthDefManager.compile(ctx.rootId, n.id, n.name, params, specsMap);
    }
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, enabled: true, loaded: false};
};

const ugenHandler = (ctx: RuntimeContext): UgenRuntime => {
    ctx.visit(ctx.tree);
    const n = ctx.tree as StripRuntime<ScUgenItem>;
    for (const child of n.children) {
        if (!isControl(child) || !child.bind) continue;
        for (const ref of child.bind.split(',').map(s => s.trim())) {
            const refId = ref.split(':')[0];
            if (!resolve(ctx, [refId])) {
                throw new Error(`<sc-ugen name="${n.name}">: input "${child.name}" references unknown "${refId}"`);
            }
        }
    }
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, enabled: false};
};

const controlHandler = (ctx: RuntimeContext): ControlRuntime => {
    const n = ctx.tree as StripRuntime<ScControlItem>;
    const enabled = ctx.parentNode != null && isNode(ctx.parentNode);
    const value = findControlOverride(ctx, [...ctx.path, n.name]) ?? n.value ?? 0;
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, enabled, name: n.name, value};
};

const varHandler = (ctx: RuntimeContext): VarRuntime => {
    const n = ctx.tree as StripRuntime<ScVarItem>;
    const value = findVarOverride(ctx, [...ctx.path, n.name]) ?? n.value ?? 0;
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, enabled: true, name: n.name, value};
};

const inputHandler = (ctx: RuntimeContext): InputRuntime => {
    return resolveVisualBind(ctx);
};

const runHandler = (ctx: RuntimeContext): RunRuntime => {
    const n = ctx.tree as StripRuntime<ScRunItem>;
    const target = n.bind ? resolve(ctx, n.bind.split('.')) : ctx.parentNode;
    if (n.bind && (!target || !isNode(target))) {
        throw new Error(`<sc-run>: bind "${n.bind}" does not match any node in scope`);
    }
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, enabled: true, targetId: target ? target.id : ''};
};

const ifHandler = (ctx: RuntimeContext): InputRuntime => {
    ctx.visit(ctx.tree);
    return resolveVisualBind(ctx);
};

const selectHandler = (ctx: RuntimeContext): InputRuntime => {
    ctx.visit(ctx.tree);
    return resolveVisualBind(ctx);
};

const optionHandler = (ctx: RuntimeContext): UgenRuntime => {
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, enabled: false};
};

const radioGroupHandler = (ctx: RuntimeContext): InputRuntime => {
    ctx.visit(ctx.tree);
    return resolveVisualBind(ctx);
};

const radioHandler = (ctx: RuntimeContext): UgenRuntime => {
    return {rootId: ctx.rootId, parentId: parentId(ctx), path: ctx.path, enabled: false};
};

// --- Dispatch ---

export function processElement(ctx: RuntimeContext): ScElementItem {
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
        case ELEMENTS.SC_SELECT: runtime = selectHandler(ctx); break;
        case ELEMENTS.SC_OPTION: runtime = optionHandler(ctx); break;
        case ELEMENTS.SC_RADIO_GROUP: runtime = radioGroupHandler(ctx); break;
        case ELEMENTS.SC_RADIO: runtime = radioHandler(ctx); break;
        default: {
            throw new Error(`Unknown element type: ${(ctx.tree as ScElementItemBase).type}`);
        }
    }
    Object.assign(ctx.tree, {runtime});
    const node = ctx.tree as unknown as ScElementItem;
    ctx.nodes.set(node.id, node);
    if (ctx.parentNode) {
        ctx.parentNode.children.push(node);
    }
    return node;
}
