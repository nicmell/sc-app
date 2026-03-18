import type {
    ScElementNode, ScGroupNode, ScSynthNode, ScSynthDefNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode,
    ScPluginNode, RuntimeValueEntry,
} from "../../types/parsers";
import {findElementByPath} from "./elementTree";
import {isSynthDef, isSynth, isGroup, isNode} from "./guards";
import {compileSynthDef} from "./SynthDefCompiler";
import {runtimeApi} from "@/lib/stores/api";
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

    // 2. Check store for persisted entry
    const savedValues = runtimeApi.values;
    for (const [id, entry] of Object.entries(savedValues)) {
        if (entry.type === type && entry.targetNode === targetNode && entry.boxId === ctx.boxId) {
            if (type === "synthdef" || ('name' in entry && entry.name === name)) {
                ctx.runtime.set(id, entry);
                return id;
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

export function processPluginRuntime(n: ScPluginNode, ctx: WalkContext) {
    const runId = findOrCreateEntry(ctx, "run", n.id, n.id, 1);
    Object.assign(n, {runtime: {run: runId, controls: {}}});
}

export function processGroupRuntime(n: ScGroupNode, ctx: WalkContext) {
    const runId = findOrCreateEntry(ctx, "run", n.id, n.name, n.running ? 1 : 0);
    Object.assign(n, {runtime: {run: runId, controls: {}}});
}

export function processSynthRuntime(n: ScSynthNode, ctx: WalkContext) {
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

export function processSynthDefRuntime(n: ScSynthDefNode, ctx: WalkContext) {
    let bytes: number[] = [];
    if (n.ugens.length > 0) {
        const specsMap = new Map(n.ugens.map(u => [u.name, u]));
        bytes = compileSynthDef(n.name, n.params, specsMap);
    }
    const entryId = findOrCreateEntry(ctx, "synthdef", n.id, n.name, bytes);
    Object.assign(n, {runtime: {value: entryId}});
}

export function processRangeRuntime(n: ScRangeNode, ctx: WalkContext) {
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    // Also update the target node's runtime.controls
    const segments = n.bind.split('.');
    const target = findElementByPath(ctx.scope, segments.slice(0, -1));
    if (target && isNode(target)) {
        target.runtime.controls[controlName] = entryId;
    }
    Object.assign(n, {runtime: {value: entryId}});
}

export function processCheckboxRuntime(n: ScCheckboxNode, ctx: WalkContext) {
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    const segments = n.bind.split('.');
    const target = findElementByPath(ctx.scope, segments.slice(0, -1));
    // Update the target node's runtime.controls. TODO: verify logic behind it
    if (target && isNode(target)) {
        target.runtime.controls[controlName] = entryId;
    }
    Object.assign(n, {runtime: {value: entryId}});
}

export function processRunRuntime(n: ScRunNode, ctx: WalkContext) {
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
    const targetName = target && 'name' in target ? target.name : '';
    const entryId = findOrCreateEntry(ctx, "run", targetId, targetName, 1);
    // Update the target node's runtime.run. TODO: verify logic behind it
    if (target && isNode(target)) {
        target.runtime.run = entryId;
    }
    Object.assign(n, {runtime: {value: entryId}});
}

export function processDisplayRuntime(n: ScDisplayNode, ctx: WalkContext) {
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    Object.assign(n, {runtime: {value: entryId}});
}

export function processIfRuntime(n: ScIfNode, ctx: WalkContext) {
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    Object.assign(n, {runtime: {value: entryId}});
}

function resolveControlBind(n: {bind: string; type: string}, ctx: WalkContext): {targetNode: string; controlName: string; defaultValue: number} {
    const segments = n.bind.split('.');
    const controlName = segments[segments.length - 1];
    const target = findElementByPath(ctx.scope, segments.slice(0, -1));
    if (!target || (!isSynth(target) && !isGroup(target))) {
        throw new Error(`<${n.type} bind="${n.bind}">: does not match any <sc-synth> or <sc-group> in scope`);
    }
    const defaultValue = isSynth(target) ? (target.controls[controlName] ?? 0) : 0;
    return {targetNode: target.id, controlName, defaultValue};
}
