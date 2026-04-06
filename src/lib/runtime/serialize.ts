import type {ScElementItem, OverrideEntry, PersistedOverrideEntry} from "@/types/parsers";
import type {RuntimeState, Preset, LayoutState} from "@/types/stores";
import {isParent, isPlugin, isNode, isControl, isVar} from "@/lib/utils/guards";

function collectEntries(node: ScElementItem, nodes: Record<string, ScElementItem>): PersistedOverrideEntry[] {
    const entries: PersistedOverrideEntry[] = [];
    const n = nodes[node.id] ?? node;
    if (isNode(n)) {
        const nodeName = 'name' in n ? n.name : '';
        const path = nodeName ? [...n.runtime.path, nodeName].join('.') : n.runtime.path.join('.');
        if (n.runtime.run !== (n.run ? 1 : 0)) {
            entries.push({type: "run", targetPath: path, value: n.runtime.run});
        }
        for (const child of n.children) {
            if (isControl(child) && child.value != null) {
                const controlNode = nodes[child.id] ?? child;
                if (isControl(controlNode) && controlNode.runtime.value !== child.value) {
                    const path = [...child.runtime.path, child.name].join('.')
                    entries.push({type: "control", targetPath: path, value: controlNode.runtime.value});
                }
            }
            if (isVar(child) && child.value != null) {
                const varNode = nodes[child.id] ?? child;
                if (isVar(varNode) && varNode.runtime.value !== child.value) {
                    const path = [...child.runtime.path, child.name].join('.');
                    entries.push({type: "var", targetPath: path, value: varNode.runtime.value});
                }
            }
        }
    }
    if (isParent(n)) {
        for (const child of n.children) {
            entries.push(...collectEntries(nodes[child.id] ?? child, nodes));
        }
    }
    return entries;
}

export function marshalPreset(state: RuntimeState): Preset {
    return {
        layout: state.layout.map(box => {
            const node = state.nodes[box.i];
            if (node && isPlugin(node)) {
                const entries = collectEntries(node, state.nodes);
                return {...box, overrides: entries.length > 0 ? entries : undefined};
            }
            return box;
        }),
    };
}

export function unmarshalPreset(preset: Preset): RuntimeState {
    const layout: LayoutState = [];
    const overrides: OverrideEntry[] = [];
    for (const {overrides: entries = [], ...box} of preset.layout) {
        layout.push(box);
        for (const entry of entries) {
            overrides.push({...entry, rootId: box.i} as OverrideEntry);
        }
    }
    return {layout, nodes: {}, overrides};
}
