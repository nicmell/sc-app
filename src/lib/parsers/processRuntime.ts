import {ELEMENTS} from "@/constants/sc-elements";
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

export function processRuntime(ctx: WalkContext) {
    switch (ctx.node.type) {
        case ELEMENTS.SC_PLUGIN:   processPluginRuntime(ctx); break;
        case ELEMENTS.SC_GROUP:    processGroupRuntime(ctx); break;
        case ELEMENTS.SC_SYNTH:    processSynthRuntime(ctx); break;
        case ELEMENTS.SC_SYNTHDEF: processSynthDefRuntime(ctx); break;
        case ELEMENTS.SC_RANGE:    processRangeRuntime(ctx); break;
        case ELEMENTS.SC_CHECKBOX: processCheckboxRuntime(ctx); break;
        case ELEMENTS.SC_RUN:      processRunRuntime(ctx); break;
        case ELEMENTS.SC_DISPLAY:  processDisplayRuntime(ctx); break;
        case ELEMENTS.SC_IF:       processIfRuntime(ctx); break;
        default:
            throw new Error()
    }
}

function processPluginRuntime(ctx: WalkContext) {
    const n = ctx.node as ScPluginNode;
    const runId = findOrCreateEntry(ctx, "run", n.id, n.id, 1);
    const children = ctx.walk({...ctx, saved: ctx.scope[ctx.offset], parentNode: n, offset: 0, scope: []});
    Object.assign(n, {runtime: {run: runId, controls: {}}, children});
}

function processGroupRuntime(ctx: WalkContext) {
    const n = ctx.node as ScGroupNode;
    const runId = findOrCreateEntry(ctx, "run", n.id, n.name, n.running ? 1 : 0);
    const children = ctx.walk({...ctx, saved: ctx.scope[ctx.offset], parentNode: n, offset: 0, scope: []});
    Object.assign(n, {runtime: {run: runId, controls: {}}, children});
}

function processSynthRuntime(ctx: WalkContext) {
    const n = ctx.node as ScSynthNode;
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

function processSynthDefRuntime(ctx: WalkContext) {
    const n = ctx.node as ScSynthDefNode;
    let bytes: number[] = [];
    if (n.ugens.length > 0) {
        const specsMap = new Map(n.ugens.map(u => [u.name, u]));
        bytes = compileSynthDef(n.name, n.params, specsMap);
    }
    const entryId = findOrCreateEntry(ctx, "synthdef", n.id, n.name, bytes);
    Object.assign(n, {runtime: {value: entryId}});
}

function processRangeRuntime(ctx: WalkContext) {
    const n = ctx.node as ScRangeNode;
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    const segments = n.bind.split('.');
    const target = findElementByPath(ctx.scope, segments.slice(0, -1));
    if (target && isNode(target)) {
        target.runtime.controls[controlName] = entryId;
    }
    Object.assign(n, {runtime: {value: entryId}});
}

function processCheckboxRuntime(ctx: WalkContext) {
    const n = ctx.node as ScCheckboxNode;
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    const segments = n.bind.split('.');
    const target = findElementByPath(ctx.scope, segments.slice(0, -1));
    if (target && isNode(target)) {
        target.runtime.controls[controlName] = entryId;
    }
    Object.assign(n, {runtime: {value: entryId}});
}

function processRunRuntime(ctx: WalkContext) {
    const n = ctx.node as ScRunNode;
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
    if (target && isNode(target)) {
        target.runtime.run = entryId;
    }
    Object.assign(n, {runtime: {value: entryId}});
}

function processDisplayRuntime(ctx: WalkContext) {
    const n = ctx.node as ScDisplayNode;
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    Object.assign(n, {runtime: {value: entryId}});
}

function processIfRuntime(ctx: WalkContext) {
    const n = ctx.node as ScIfNode;
    const {targetNode, controlName, defaultValue} = resolveControlBind(n, ctx);
    const entryId = findOrCreateEntry(ctx, "control", targetNode, controlName, defaultValue);
    const children = ctx.walk({...ctx, saved: ctx.scope[ctx.offset], parentNode: n, offset: 0, scope: []});
    Object.assign(n, {runtime: {value: entryId}, children});
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
