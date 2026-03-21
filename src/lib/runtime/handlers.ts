import type {
    ScElementNode, ScParentNode, ScGroupNode, ScSynthNode, ScSynthDefNode, ScUgenNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode,
    ScPluginNode, PluginRuntime, RuntimeValueEntry,
} from "@/types/parsers";
import {findElementByPath} from "@/lib/utils/elementTree";
import {isSynthDef, isSynth, isGroup, isNode} from "@/lib/utils/guards";
import {synthDefManager} from "@/lib/synthdef";

export interface RuntimeContext {
    boxId: string;
    entries: Map<string, RuntimeValueEntry>;
    persistedEntries: Record<string, RuntimeValueEntry>;
    nodes: Map<string, ScElementNode>;
    scope: ScElementNode[];
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
        if (entry.type === type && entry.targetNode === targetNode && entry.boxId === ctx.boxId
            && 'name' in entry && entry.name === name) {
            return id;
        }
    }

    // 2. Check persisted entries
    for (const [id, entry] of Object.entries(ctx.persistedEntries)) {
        if (entry.type === type && entry.targetNode === targetNode && entry.boxId === ctx.boxId
            && 'name' in entry && entry.name === name) {
            ctx.entries.set(id, entry);
            return id;
        }
    }

    // 3. Create new entry
    const id = crypto.randomUUID();
    ctx.entries.set(id, {type, boxId: ctx.boxId, targetNode, name, value: defaultValue});
    return id;
}

export function processPluginRuntime(n: ScPluginNode, ctx: RuntimeContext): PluginRuntime {
    n.runtime.run = findOrCreateEntry(ctx, "run", n.id, n.id, 1);
    return n.runtime;
}

export function processGroupRuntime(n: ScGroupNode, ctx: RuntimeContext): void {
    if (!n.runtime.run) {
        n.runtime.run = findOrCreateEntry(ctx, "run", n.id, n.name, n.running ? 1 : 0);
    }
}

export function processSynthRuntime(n: ScSynthNode, ctx: RuntimeContext): void {
    if (n.bind) {
        let found = false;
        for (const node of ctx.nodes.values()) {
            if (isSynthDef(node) && node.name === n.bind) { found = true; break; }
        }
        if (!found) {
            throw new Error(`<sc-synth bind="${n.bind}">: does not match any <sc-synthdef>`);
        }
    }
    if (!n.runtime.run) {
        n.runtime.run = findOrCreateEntry(ctx, "run", n.id, n.name, n.running ? 1 : 0);
    }
    for (const [name, value] of Object.entries(n.controls)) {
        if (!n.runtime.controls[name]) {
            n.runtime.controls[name] = findOrCreateEntry(ctx, "control", n.id, name, value);
        }
    }
}

export function processSynthDefRuntime(n: ScSynthDefNode, ctx: RuntimeContext): void {
    const ugenChildren = n.children.filter((c): c is ScUgenNode => c.type === 'sc-ugen');
    if (ugenChildren.length > 0) {
        const specsMap = new Map(ugenChildren.map(c => {
            return [c.name, {name: c.name, type: c.ugen, rate: c.rate, inputs: c.controls}];
        }));
        synthDefManager.compile(ctx.boxId, n.id, n.name, n.controls, specsMap);
    }
}

export function processUgenRuntime(n: ScUgenNode, ctx: RuntimeContext): void {
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
}

export function processControlRuntime(
    n: ScRangeNode | ScCheckboxNode,
    ctx: RuntimeContext,
): void {
    const {target, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", target.id, controlName, defaultValue);
    if (isNode(target)) {
        target.runtime.controls[controlName] = entryId;
    }
    n.runtime.value = entryId;
}

export function processRunRuntime(n: ScRunNode, ctx: RuntimeContext): void {
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
    n.runtime.value = entryId;
}

export function processVisualRuntime(
    n: ScDisplayNode | ScIfNode,
    ctx: RuntimeContext,
): void {
    const {target, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", target.id, controlName, defaultValue);
    n.runtime.value = entryId;
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
