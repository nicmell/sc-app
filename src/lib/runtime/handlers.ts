import type {
    ScElementNode, ScElementNodeBase, ScParentNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScUgenNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode,
    ScPluginNode, PluginRuntime, NodeRuntime, UgenRuntime, InputRuntime, RuntimeValueEntry,
} from "@/types/parsers";
import {findElementByPath} from "@/lib/utils/elementTree";
import {isSynthDef, isSynth, isGroup, isNode, isParent} from "@/lib/utils/guards";
import {ELEMENTS} from "@/constants/sc-elements";

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
    walk: () => ScElementNode[];
    parentNode?: ScParentNode;
}

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

function processPluginRuntime(ctx: RuntimeContext<ScPluginNode>): PluginRuntime {
    const n = ctx.node;
    return {
        run: findOrCreateEntry(ctx, "run", n.id, n.id, 1),
        controls: {},
        loaded: false,
    };
}

function processGroupRuntime(ctx: RuntimeContext<ScGroupNode>): NodeRuntime {
    const n = ctx.node;
    return {
        run: findOrCreateEntry(ctx, "run", n.id, n.name, n.running ? 1 : 0),
        controls: {},
    };
}

function processSynthRuntime(ctx: RuntimeContext<ScSynthNode>): NodeRuntime {
    const n = ctx.node;
    if (n.bind) {
        const found = ctx.scope.some(e => isSynthDef(e) && e.name === n.bind);
        if (!found) {
            throw new Error(`<sc-synth bind="${n.bind}">: does not match any <sc-synthdef>`);
        }
    }
    const controls: Record<string, string> = {};
    for (const [name, value] of Object.entries(n.controls)) {
        controls[name] = findOrCreateEntry(ctx, "control", n.id, name, value);
    }
    return {
        run: findOrCreateEntry(ctx, "run", n.id, n.name, n.running ? 1 : 0),
        controls,
    };
}

function processSynthDefRuntime(ctx: RuntimeContext<ScSynthDefNode>): UgenRuntime {
    const n = ctx.node;
    ctx.synthdefs.push(n);
    return {} as UgenRuntime;
}

function processUgenRuntime(ctx: RuntimeContext<ScUgenNode>): UgenRuntime {
    const n = ctx.node;
    for (const [key, value] of Object.entries(n.controls)) {
        if (key === 'op') continue;
        const num = Number(value);
        if (!isNaN(num) && value.trim() !== '') continue;

        const refId = value.split(':')[0];

        // Check sibling UGens
        if (ctx.scope.some(s => s.type === 'sc-ugen' && s.name === refId)) continue;

        // Check parent synthdef controls
        if (ctx.parentNode?.type === 'sc-synthdef' && refId in ctx.parentNode.controls) continue;

        throw new Error(`<sc-ugen name="${n.name}">: input "${key}" references unknown "${refId}"`);
    }
    return {} as UgenRuntime;
}

function processControlRuntime(ctx: RuntimeContext<ScRangeNode | ScCheckboxNode>): InputRuntime {
    const n = ctx.node;
    const {target, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", target.id, controlName, defaultValue);
    if (isNode(target) && target.runtime) {
        target.runtime.controls[controlName] = entryId;
    }
    return {value: entryId};
}

function processRunRuntime(ctx: RuntimeContext<ScRunNode>): InputRuntime {
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
    return {value: entryId};
}

function processVisualRuntime(ctx: RuntimeContext<ScDisplayNode | ScIfNode>): InputRuntime {
    const n = ctx.node;
    const {target, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", target.id, controlName, defaultValue);
    return {value: entryId};
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

export function dispatchRuntime(ctx: RuntimeContext): ScElementNode["runtime"] {
    let runtime: ScElementNode["runtime"];
    switch (ctx.node.type) {
        case ELEMENTS.SC_PLUGIN:   runtime = processPluginRuntime(ctx as RuntimeContext<ScPluginNode>); break;
        case ELEMENTS.SC_GROUP:    runtime = processGroupRuntime(ctx as RuntimeContext<ScGroupNode>); break;
        case ELEMENTS.SC_SYNTH:    runtime = processSynthRuntime(ctx as RuntimeContext<ScSynthNode>); break;
        case ELEMENTS.SC_SYNTHDEF: runtime = processSynthDefRuntime(ctx as RuntimeContext<ScSynthDefNode>); break;
        case ELEMENTS.SC_UGEN:     runtime = processUgenRuntime(ctx as RuntimeContext<ScUgenNode>); break;
        case ELEMENTS.SC_RANGE:
        case ELEMENTS.SC_CHECKBOX: runtime = processControlRuntime(ctx as RuntimeContext<ScRangeNode | ScCheckboxNode>); break;
        case ELEMENTS.SC_RUN:      runtime = processRunRuntime(ctx as RuntimeContext<ScRunNode>); break;
        case ELEMENTS.SC_DISPLAY:
        case ELEMENTS.SC_IF:       runtime = processVisualRuntime(ctx as RuntimeContext<ScDisplayNode | ScIfNode>); break;
        default: throw new Error(`Unknown element type: ${(ctx.node as ScElementNode).type}`);
    }
    ctx.node.runtime = runtime;
    if (isParent(ctx.node)) {
        ctx.node.children = ctx.walk();
    }
    ctx.nodesMap.set(ctx.node.id, ctx.node);
    return runtime;
}
