import type {
    ScElementNode, ScGroupNode, ScSynthNode, ScSynthDefNode,
    ScRangeNode, ScCheckboxNode, ScRunNode, ScDisplayNode, ScIfNode,
} from "../../types/parsers";
import {findElementByPath} from "./elementTree";
import {isSynthDef, isSynth, isGroup} from "./guards";

export function processGroupRuntime(n: ScGroupNode, _scope: ScElementNode[]) {
    Object.assign(n, {runtime: {isRunning: n.running, controls: {}}});
}

export function processSynthRuntime(n: ScSynthNode, scope: ScElementNode[]) {
    if (n.bind) {
        const target = findElementByPath(scope, n.bind.split('.'));
        if (!target || !isSynthDef(target)) {
            throw new Error(`<sc-synth bind="${n.bind}">: does not match any <sc-synthdef> in scope`);
        }
    }
    Object.assign(n, {runtime: {isRunning: n.running, controls: {...n.controls}}});
}

export function processSynthDefRuntime(n: ScSynthDefNode, _scope: ScElementNode[]) {
    Object.assign(n, {runtime: {value: []}});
}

export function processRangeRuntime(n: ScRangeNode, scope: ScElementNode[]) {
    validateControlBind(n, scope);
    Object.assign(n, {runtime: {value: 0}});
}

export function processCheckboxRuntime(n: ScCheckboxNode, scope: ScElementNode[]) {
    validateControlBind(n, scope);
    Object.assign(n, {runtime: {value: 0}});
}

export function processRunRuntime(n: ScRunNode, scope: ScElementNode[]) {
    if (n.bind) {
        const target = findElementByPath(scope, n.bind.split('.'));
        if (!target || (!isSynth(target) && !isGroup(target))) {
            throw new Error(`<sc-run>: bind "${n.bind}" does not match any <sc-synth> or <sc-group> in scope`);
        }
    }
    Object.assign(n, {runtime: {value: 1}});
}

export function processDisplayRuntime(n: ScDisplayNode, scope: ScElementNode[]) {
    validateControlBind(n, scope);
}

export function processIfRuntime(n: ScIfNode, scope: ScElementNode[]) {
    validateControlBind(n, scope);
}

function validateControlBind(n: {bind: string; type: string}, scope: ScElementNode[]) {
    if (n.bind) {
        const segments = n.bind.split('.');
        const target = findElementByPath(scope, segments.slice(0, segments.length - 1));
        if (!target || (!isSynth(target) && !isGroup(target))) {
            throw new Error(`<${n.type} bind="${n.bind}">: does not match any <sc-synth> or <sc-group> in scope`);
        }
    }
}
