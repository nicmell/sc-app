Analyze in the following requirements and all the code deeply, and plan the best changes to implement the following:
- Add a field “values” in the runtimeStore to be a mapped objects of elements with with the following type: 
    
    ``` {type: “control”, boxId: string, targetNode: string, value: number} | {type: “run”,  boxId: string, name: string targetNode: string, value: number} | {type: “synthdef”,  boxId: string, targetNode: string, value: number[]} ```

    They should correspond to the value of a control, to the value of a sc-run input element and the value in bytes of the compiled synthdef. The targetNode should correspond to the id of the group,plugin, synth or synthdef node to which the runtime value is bounded. The boxId should be a the id of the box containing the processed element. The keys of the map should be a randomId generated for the entry.

- During the parsing of the element tree, in the processRuntime step, the various runtime entry values must be computed depending on the type of the processed node element and collected in the runtime field of the WalkContext. If an entry matching for the same targetNode and name is already present in the map the already existing value is taken, else the new entry is added to the map at a new randomId() key.
- After collecting the runtime entries for the node, the node's runtime field should be populated to contain the references to the collected ids. To do so:
    - Modify the sc-group and the sc-node so that the runtime.controls field is an object Record<string, string> where every control is mapped to the corresponding runtime entry id
    - Modify the sc-run and all the sc inputs elements have the runtime value property to be a string containing the id of the corresponding runtime entry
    - Modify the sc-synthdef so that the runtime value property is a string containing the id of the runtime entry with the compiled synthdef
  - When the parsing and processing of the runtime finishes: 
    - The parse function in @src/lib/parsers/PluginParser.ts, should return the map containing all the ids
    - the loadPlugin should dispatch the values collected in the map as a plain object and replace all the entries for the given boxId with the ones accumulated in the map object
    - the unloadPlugin should drop all the runtime values corresponding to the boxId of the unloaded box
- modify all the sc-elements components to infer their value and modify the application state operating on the corresponding runtime entry: 
  - All the sc elements should infer the corresponding controls and runtime property values by looking at the value stored in the runtime array for the containing box
  - Changes in the state triggered by the sc elements should update the corresponding runtime entry value for stored in the runtime field for the box item. All rules about changing specifically a control node or group value, or toggling the isRunning property, should be preserved
  - Ensure all the display and if elements look at the correct runtime value entry for the corresponding node property


---------


Plan the following refactor:
At the moment the hydration of the fetched plugin html and the computing of the runtime entries are executed in the same interaction: our objective is to split the logic so that the html is first parsed and the id for the nodes are assigned, and in a second step the runtime entry values are computed for each node. To do so we need to proceed in the following steps:

- Create a new html module folder in @src/lib that contains all the logic for hydrating the fetched dom with the saved ids: the module should export a single function processHtml that takes a boxId and the fetched document, iterates over every node matching an sc-element, check the properties matching with the ones saved in the store and returns a tree of ScElement nodes deprived of the “runtime” field and any other runtime value.  The procedure should also return a Map<string, ScElementNode> containing the mapping of all the parsed nodes and the corresponding id as values and keys of the map
- Create a new folder runtime in @src/lib that contains all the logic of computing the runtime values from the parsed html: the module exports a single function “processRuntime”, that takes as parameters a parsed tree of ScElementNoded, the map<id, ScElementNode> produced by the processHtml map, and a Map<id, RuntimeEntry> corresponding the map the runtime entries peristed on the store; the processRuntime plugin will first extract the ids from the map of nodes and will prune old entries for old id values from the persisted map, and then iterate over the tree to add the runtime fields to the nodes and create the new entries. the processRuntime function will return the new map of entries to the caller

Both the functions must be called inside the PluginLoader.loadPlugin method, and the values returned so that can be dispatched during the sc-plugin component mount.

