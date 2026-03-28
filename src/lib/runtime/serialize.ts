import type {ScElementNode, ScElementNodeBase, StripRuntime} from "@/types/parsers";
import type {RuntimeState, Preset} from "@/types/stores";
import {isParent, isPlugin, isNode} from "@/lib/utils/guards";
import {cyrb53} from "@/lib/utils/randomId";

function marshalNode(node: ScElementNode, nodes: Record<string, ScElementNode>): StripRuntime<ScElementNode> {
    const {id, type, runtime, children, ...props} = node as any;

    const hash = cyrb53(JSON.stringify(props));

    if (isNode(node)) {
        props.controls = {...node.runtime.controls};
        props.run = node.runtime.run !== 0;
    }

    if (isParent(node)) {
        const marshaledChildren = node.children.map((c: ScElementNode) =>
            marshalNode(nodes[c.id] ?? c, nodes)
        );
        return {type, hash, ...props, children: marshaledChildren} as StripRuntime<ScElementNode>;
    }

    return {type, hash, ...props} as StripRuntime<ScElementNode>;
}

export function marshalPreset(state: RuntimeState): Preset {
    return {
        layout: state.layout.map(box => {
            const node = state.nodes[box.i];
            const tree = node && isPlugin(node)
                ? marshalNode(node, state.nodes)
                : state.savedTrees[box.i] ?? undefined;
            return {...box, tree} as any;
        }),
    };
}

export function unmarshalPreset(preset: Preset): RuntimeState {
    const layout = preset.layout.map(({tree, ...box}) => box);
    const savedTrees: Record<string, ScElementNodeBase> = {};
    for (const item of preset.layout) {
        if (item.tree) {
            savedTrees[item.i] = item.tree as ScElementNodeBase;
        }
    }
    return {layout, nodes: {}, savedTrees};
}
