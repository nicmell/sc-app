import type {ScElementNode, OverrideEntry, PersistedOverrideEntry} from "@/types/parsers";
import type {RuntimeState, Preset} from "@/types/stores";
import {isParent, isPlugin, isNode} from "@/lib/utils/guards";

function collectEntries(node: ScElementNode, nodes: Record<string, ScElementNode>, path: string): PersistedOverrideEntry[] {
    const entries: PersistedOverrideEntry[] = [];
    const n = nodes[node.id] ?? node;
    if (isNode(n)) {
        const nodeName = n.name;
        if (n.runtime.run !== (n.run ? 1 : 0)) {
            entries.push({type: "run", targetNode: path, name: nodeName, value: n.runtime.run});
        }
        for (const [name, def] of Object.entries(n.controls)) {
            if (n.runtime.controls[name] !== def) {
                entries.push({type: "control", targetNode: path, name, value: n.runtime.controls[name]});
            }
        }
    }
    if (isParent(n)) {
        for (const child of n.children) {
            const c = nodes[child.id] ?? child;
            const childName = 'name' in c ? c.name as string : '';
            const childPath = childName ? (path ? `${path}.${childName}` : childName) : path;
            entries.push(...collectEntries(c, nodes, childPath));
        }
    }
    return entries;
}

export function marshalPreset(state: RuntimeState): Preset {
    const savedByRoot = new Map<string, PersistedOverrideEntry[]>();
    for (const entry of state.overrides) {
        const {rootId, ...rest} = entry;
        let list = savedByRoot.get(rootId);
        if (!list) { list = []; savedByRoot.set(rootId, list); }
        list.push(rest);
    }

    return {
        layout: state.layout.map(box => {
            const node = state.nodes[box.i];
            if (node && isPlugin(node)) {
                const entries = collectEntries(node, state.nodes, '');
                return {...box, overrides: entries.length > 0 ? entries : undefined};
            }
            const saved = savedByRoot.get(box.i);
            return saved ? {...box, overrides: saved} : box;
        }),
    };
}

export function unmarshalPreset(preset: Preset): RuntimeState {
    const layout = preset.layout.map(({overrides: _overrides, ...box}) => box);
    const overrides: OverrideEntry[] = [];
    for (const item of preset.layout) {
        if (item.overrides) {
            for (const entry of item.overrides) {
                overrides.push({...entry, rootId: item.i});
            }
        }
    }
    return {layout, nodes: {}, overrides};
}
