import type {
    ScElementNode, ScParentNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScUgenNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode,
    ScPluginNode, PluginRuntime, NodeRuntime, UgenRuntime, InputRuntime, RuntimeValueEntry,
} from "@/types/parsers";
import {findElementByPath} from "@/lib/utils/elementTree";
import {isSynthDef, isSynth, isGroup, isNode} from "@/lib/utils/guards";
import {synthDefManager} from "@/lib/synthdef";
import {ELEMENTS} from "@/constants/sc-elements";

export interface RuntimeContext {
    rootId: string;
    entries: Map<string, RuntimeValueEntry>;
    persistedEntries: Record<string, RuntimeValueEntry>;
    nodesMap: Map<string, ScElementNode>;
    scope: ScElementNode[];
    offset: number;
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

function processPluginRuntime(ctx: RuntimeContext): PluginRuntime {
    const n = ctx.scope[ctx.offset] as ScPluginNode;
    return {
        run: findOrCreateEntry(ctx, "run", n.id, n.id, 1),
        controls: {},
        loaded: false,
    };
}

function processGroupRuntime(ctx: RuntimeContext): NodeRuntime {
    const n = ctx.scope[ctx.offset] as ScGroupNode;
    return {
        run: n.runtime.run || findOrCreateEntry(ctx, "run", n.id, n.name, n.running ? 1 : 0),
        controls: {...n.runtime.controls},
    };
}

function processSynthRuntime(ctx: RuntimeContext): NodeRuntime {
    const n = ctx.scope[ctx.offset] as ScSynthNode;
    if (n.bind) {
        let found = false;
        for (const node of ctx.nodesMap.values()) {
            if (isSynthDef(node) && node.name === n.bind) { found = true; break; }
        }
        if (!found) {
            throw new Error(`<sc-synth bind="${n.bind}">: does not match any <sc-synthdef>`);
        }
    }
    const controls: Record<string, string> = {...n.runtime.controls};
    for (const [name, value] of Object.entries(n.controls)) {
        if (!controls[name]) {
            controls[name] = findOrCreateEntry(ctx, "control", n.id, name, value);
        }
    }
    return {
        run: n.runtime.run || findOrCreateEntry(ctx, "run", n.id, n.name, n.running ? 1 : 0),
        controls,
    };
}

function processSynthDefRuntime(ctx: RuntimeContext): UgenRuntime {
    const n = ctx.scope[ctx.offset] as ScSynthDefNode;
    const ugenChildren = n.children.filter((c): c is ScUgenNode => c.type === 'sc-ugen');
    if (ugenChildren.length > 0) {
        const specsMap = new Map(ugenChildren.map(c => {
            return [c.name, {name: c.name, type: c.ugen, rate: c.rate, inputs: c.controls}];
        }));
        synthDefManager.compile(ctx.rootId, n.id, n.name, n.controls, specsMap);
    }
    return {} as UgenRuntime;
}

function processUgenRuntime(ctx: RuntimeContext): UgenRuntime {
    const n = ctx.scope[ctx.offset] as ScUgenNode;
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

function processControlRuntime(ctx: RuntimeContext): InputRuntime {
    const n = ctx.scope[ctx.offset] as ScRangeNode | ScCheckboxNode;
    const {target, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", target.id, controlName, defaultValue);
    if (isNode(target)) {
        target.runtime.controls[controlName] = entryId;
    }
    return {value: entryId};
}

function processRunRuntime(ctx: RuntimeContext): InputRuntime {
    const n = ctx.scope[ctx.offset] as ScRunNode;
    let target: ScElementNode | undefined;
    if (n.bind) {
        target = findElementByPath(ctx.scope, n.bind.split('.'));
        if (!target || (!isSynth(target) && !isGroup(target))) {
            throw new Error(`<sc-run>: bind "${n.bind}" does not match any <sc-synth> or <sc-group> in scope`);
        }
    } else if (ctx.parentNode && isNode(ctx.parentNode)) {
        target = ctx.parentNode;
    }
    const targetId = target ? target.id : '';
    const targetName = target && 'name' in target ? (target as {name: string}).name : '';
    const entryId = findOrCreateEntry(ctx, "run", targetId, targetName, 1);
    if (target && isNode(target)) {
        target.runtime.run = entryId;
    }
    return {value: entryId};
}

function processVisualRuntime(ctx: RuntimeContext): InputRuntime {
    const n = ctx.scope[ctx.offset] as ScDisplayNode | ScIfNode;
    const {target, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", target.id, controlName, defaultValue);
    return {value: entryId};
}

function resolveControlBind(n: {bind: string; type: string}, ctx: RuntimeContext): {target: ScElementNode; controlName: string; defaultValue: number} {
    const segments = n.bind.split('.');
    const controlName = segments[segments.length - 1];
    let target: ScElementNode | undefined;
    if (segments.length > 1) {
        target = findElementByPath(ctx.scope, segments.slice(0, -1));
    } else if (ctx.parentNode && isNode(ctx.parentNode)) {
        target = ctx.parentNode;
    }
    if (!target || (!isSynth(target) && !isGroup(target))) {
        throw new Error(`<${n.type} bind="${n.bind}">: does not match any <sc-synth> or <sc-group> in scope`);
    }
    const defaultValue = isSynth(target) ? (target.controls[controlName] ?? 0) : 0;
    return {target, controlName, defaultValue};
}

export function dispatchRuntime(ctx: RuntimeContext): ScElementNode["runtime"] {
    const node = ctx.scope[ctx.offset];
    switch (node.type) {
        case ELEMENTS.SC_PLUGIN:   return processPluginRuntime(ctx);
        case ELEMENTS.SC_GROUP:    return processGroupRuntime(ctx);
        case ELEMENTS.SC_SYNTH:    return processSynthRuntime(ctx);
        case ELEMENTS.SC_SYNTHDEF: return processSynthDefRuntime(ctx);
        case ELEMENTS.SC_UGEN:     return processUgenRuntime(ctx);
        case ELEMENTS.SC_RANGE:
        case ELEMENTS.SC_CHECKBOX: return processControlRuntime(ctx);
        case ELEMENTS.SC_RUN:      return processRunRuntime(ctx);
        case ELEMENTS.SC_DISPLAY:
        case ELEMENTS.SC_IF:       return processVisualRuntime(ctx);
        default: throw new Error(`Unknown element type: ${(node as ScElementNode).type}`);
    }
}
