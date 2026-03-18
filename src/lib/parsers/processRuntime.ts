import type {
    ScElementNode, ScGroupNode, ScSynthNode, ScSynthDefNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode,
    RuntimeValueEntry,
} from "../../types/parsers";
import {findElementByPath} from "./elementTree";
import {isSynthDef, isSynth, isGroup, isNode} from "./guards";
import type {WalkContext} from "./PluginParser";

function findOrCreateEntry(
    ctx: WalkContext,
    type: "control",
    targetNode: string,
    name: string,
    defaultValue: number,
): string;
function findOrCreateEntry(
    ctx: WalkContext,
    type: "run",
    targetNode: string,
    name: string,
    defaultValue: number,
): string;
function findOrCreateEntry(
    ctx: WalkContext,
    type: "synthdef",
    targetNode: string,
    name: string,
    defaultValue: number[],
): string;
function findOrCreateEntry(
    ctx: WalkContext,
    type: "control" | "run" | "synthdef",
    targetNode: string,
    name: string,
    defaultValue: number | number[],
): string {
    // 1. Check ctx.runtime for existing entry created this parse session
    for (const [id, entry] of ctx.runtime) {
        if (entry.type === type && entry.targetNode === targetNode && entry.boxId === ctx.boxId) {
            if (type === "synthdef" || ('name' in entry && entry.name === name)) {
                return id;
            }
        }
    }

    // 2. Check savedValues for persisted entry
    if (ctx.savedValues) {
        for (const [id, entry] of Object.entries(ctx.savedValues)) {
            if (entry.type === type && entry.targetNode === targetNode && entry.boxId === ctx.boxId) {
                if (type === "synthdef" || ('name' in entry && entry.name === name)) {
                    ctx.runtime.set(id, entry);
                    return id;
                }
            }
        }
    }

    // 3. Create new entry
    const id = crypto.randomUUID();
    let entry: RuntimeValueEntry;
    if (type === "synthdef") {
        entry = {type, boxId: ctx.boxId, targetNode, value: defaultValue as number[]};
    } else {
        entry = {type, boxId: ctx.boxId, targetNode, name, value: defaultValue as number};
    }
    ctx.runtime.set(id, entry);
    return id;
}

export function processGroupRuntime(n: ScGroupNode, _scope: ScElementNode[], ctx: WalkContext) {
    const runId = findOrCreateEntry(ctx, "run", n.name, n.name, n.running ? 1 : 0);
    Object.assign(n, {runtime: {run: runId, controls: {}}});
}

export function processSynthRuntime(n: ScSynthNode, scope: ScElementNode[], ctx: WalkContext) {
    if (n.bind) {
        const target = findElementByPath(scope, n.bind.split('.'));
        if (!target || !isSynthDef(target)) {
            throw new Error(`<sc-synth bind="${n.bind}">: does not match any <sc-synthdef> in scope`);
        }
    }
    const runId = findOrCreateEntry(ctx, "run", n.name, n.name, n.running ? 1 : 0);
    const controls: Record<string, string> = {};
    for (const [name, value] of Object.entries(n.controls)) {
        controls[name] = findOrCreateEntry(ctx, "control", n.name, name, value);
    }
    Object.assign(n, {runtime: {run: runId, controls}});
}

export function processSynthDefRuntime(n: ScSynthDefNode, _scope: ScElementNode[], ctx: WalkContext) {
    const entryId = findOrCreateEntry(ctx, "synthdef", n.name, n.name, []);
    Object.assign(n, {runtime: {value: entryId}});
}

export function processRangeRuntime(n: ScRangeNode, scope: ScElementNode[], ctx: WalkContext) {
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, scope);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    // Also update the target node's runtime.controls
    const segments = n.bind.split('.');
    const target = findElementByPath(scope, segments.slice(0, -1));
    if (target && isNode(target)) {
        target.runtime.controls[controlName] = entryId;
    }
    Object.assign(n, {runtime: {value: entryId}});
}

export function processCheckboxRuntime(n: ScCheckboxNode, scope: ScElementNode[], ctx: WalkContext) {
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, scope);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    const segments = n.bind.split('.');
    const target = findElementByPath(scope, segments.slice(0, -1));
    if (target && isNode(target)) {
        target.runtime.controls[controlName] = entryId;
    }
    Object.assign(n, {runtime: {value: entryId}});
}

export function processRunRuntime(n: ScRunNode, scope: ScElementNode[], ctx: WalkContext) {
    let target: ScElementNode | undefined;
    if (n.bind) {
        target = findElementByPath(scope, n.bind.split('.'));
        if (!target || (!isSynth(target) && !isGroup(target))) {
            throw new Error(`<sc-run>: bind "${n.bind}" does not match any <sc-synth> or <sc-group> in scope`);
        }
    } else if (ctx.parentNode && isNode(ctx.parentNode)) {
        target = ctx.parentNode;
    }
    const targetName = target && 'name' in target ? target.name : '';
    const entryId = findOrCreateEntry(ctx, "run", targetName, targetName, 1);
    // Update the target node's runtime.run
    if (target && isNode(target)) {
        target.runtime.run = entryId;
    }
    Object.assign(n, {runtime: {value: entryId}});
}

export function processDisplayRuntime(n: ScDisplayNode, scope: ScElementNode[], ctx: WalkContext) {
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, scope);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    Object.assign(n, {runtime: {value: entryId}});
}

export function processIfRuntime(n: ScIfNode, scope: ScElementNode[], ctx: WalkContext) {
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, scope);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    Object.assign(n, {runtime: {value: entryId}});
}

function resolveControlBind(n: {bind: string; type: string}, scope: ScElementNode[]): {targetNode: string; controlName: string; defaultValue: number} {
    const segments = n.bind.split('.');
    const controlName = segments[segments.length - 1];
    const target = findElementByPath(scope, segments.slice(0, -1));
    if (!target || (!isSynth(target) && !isGroup(target))) {
        throw new Error(`<${n.type} bind="${n.bind}">: does not match any <sc-synth> or <sc-group> in scope`);
    }
    const targetName = 'name' in target ? target.name : '';
    const defaultValue = isSynth(target) ? (target.controls[controlName] ?? 0) : 0;
    return {targetNode: targetName, controlName, defaultValue};
}
