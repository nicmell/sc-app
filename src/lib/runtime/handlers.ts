import type {
    ScElementNodeBase, StripRuntime, ScGroupNode, ScSynthNode, ScSynthDefNode, ScUgenNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode,
    ScPluginNode, RuntimeValueEntry, NodeRuntime,
} from "@/types/parsers";
import {findElementByPath} from "@/lib/utils/elementTree";
import {isSynthDef, isSynth, isGroup, isNode} from "@/lib/utils/guards";
import {synthDefManager} from "@/lib/synthdef";

export interface RuntimeContext {
    boxId: string;
    entries: Map<string, RuntimeValueEntry>;
    persistedEntries: Record<string, RuntimeValueEntry>;
    nodes: Map<string, ScElementNodeBase>;
    scope: ScElementNodeBase[];
    parentNode?: ScElementNodeBase;
}

function getRuntime(node: ScElementNodeBase): NodeRuntime {
    return (node as unknown as {runtime: NodeRuntime}).runtime;
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

export function processPluginRuntime(n: StripRuntime<ScPluginNode>, ctx: RuntimeContext): NodeRuntime {
    const runId = findOrCreateEntry(ctx, "run", n.id, n.id, 1);
    const runtime: NodeRuntime = {run: runId, controls: {}};
    Object.assign(n, {runtime});
    return runtime;
}

export function processGroupRuntime(n: StripRuntime<ScGroupNode>, ctx: RuntimeContext): void {
    const runId = findOrCreateEntry(ctx, "run", n.id, n.name, n.running ? 1 : 0);
    Object.assign(n, {runtime: {run: runId, controls: {}}});
}

export function processSynthRuntime(n: StripRuntime<ScSynthNode>, ctx: RuntimeContext): void {
    if (n.bind) {
        const target = findElementByPath(ctx.scope, n.bind.split('.'));
        if (!target || !isSynthDef(target)) {
            throw new Error(`<sc-synth bind="${n.bind}">: does not match any <sc-synthdef> in scope`);
        }
    }
    const runId = findOrCreateEntry(ctx, "run", n.id, n.name, n.running ? 1 : 0);
    const controls: Record<string, string> = {};
    for (const [name, value] of Object.entries(n.controls)) {
        controls[name] = findOrCreateEntry(ctx, "control", n.id, name, value);
    }
    Object.assign(n, {runtime: {run: runId, controls}});
}

export function processSynthDefRuntime(n: StripRuntime<ScSynthDefNode>, ctx: RuntimeContext): void {
    const ugenChildren = n.children.filter(c => c.type === 'sc-ugen');
    if (ugenChildren.length > 0) {
        const specsMap = new Map(ugenChildren.map(c => {
            const u = c as StripRuntime<ScUgenNode>;
            return [u.name, {name: u.name, type: u.ugen, rate: u.rate, inputs: u.controls}];
        }));
        synthDefManager.compile(ctx.boxId, n.id, n.name, n.controls, specsMap);
    }
    Object.assign(n, {runtime: {}});
}

export function processUgenRuntime(n: StripRuntime<ScUgenNode>, ctx: RuntimeContext): void {
    for (const [key, value] of Object.entries(n.controls)) {
        if (key === 'op') continue;
        const num = Number(value);
        if (!isNaN(num) && value.trim() !== '') continue;

        const refId = value.split(':')[0];

        // Check sibling UGens
        if (ctx.scope.some(s => s.type === 'sc-ugen' && 'name' in s && s.name === refId)) continue;

        // Check parent synthdef controls
        if (ctx.parentNode?.type === 'sc-synthdef' && 'controls' in ctx.parentNode) {
            if (refId in (ctx.parentNode as {controls: Record<string, number>}).controls) continue;
        }

        throw new Error(`<sc-ugen name="${n.name}">: input "${key}" references unknown "${refId}"`);
    }
    Object.assign(n, {runtime: {}});
}

export function processControlRuntime(
    n: StripRuntime<ScRangeNode> | StripRuntime<ScCheckboxNode>,
    ctx: RuntimeContext,
): void {
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    // Also update the target node's runtime.controls
    const segments = n.bind.split('.');
    const target = findElementByPath(ctx.scope, segments.slice(0, -1));
    if (target && isNode(target)) {
        getRuntime(target).controls[controlName] = entryId;
    }
    Object.assign(n, {runtime: {value: entryId}});
}

export function processRunRuntime(n: StripRuntime<ScRunNode>, ctx: RuntimeContext): void {
    let target: ScElementNodeBase | undefined;
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
    // Update the target node's runtime.run
    if (target && isNode(target)) {
        getRuntime(target).run = entryId;
    }
    Object.assign(n, {runtime: {value: entryId}});
}

export function processVisualRuntime(
    n: StripRuntime<ScDisplayNode> | StripRuntime<ScIfNode>,
    ctx: RuntimeContext,
): void {
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    Object.assign(n, {runtime: {value: entryId}});
}

function resolveControlBind(n: {bind: string; type: string}, ctx: RuntimeContext): {targetNode: string; controlName: string; defaultValue: number} {
    const segments = n.bind.split('.');
    const controlName = segments[segments.length - 1];
    const target = findElementByPath(ctx.scope, segments.slice(0, -1));
    if (!target || (!isSynth(target) && !isGroup(target))) {
        throw new Error(`<${n.type} bind="${n.bind}">: does not match any <sc-synth> or <sc-group> in scope`);
    }
    const defaultValue = isSynth(target) ? (target.controls[controlName] ?? 0) : 0;
    return {targetNode: target.id, controlName, defaultValue};
}
