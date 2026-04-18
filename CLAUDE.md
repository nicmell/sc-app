# SC-App

A desktop application for controlling SuperCollider (scsynth) via a plugin-based dashboard UI. Built with Tauri 2 (Rust backend) + React 19 + Lit 3 web components.

## Workflow

- After editing any file in `examples/`, run `bash scripts/package_examples.sh tmp` to repackage the zips.

## Quick Reference

```bash
# Frontend dev server (port 1420)
yarn dev

# Full Tauri app (frontend + backend)
yarn tauri dev

# Type-check
npx tsc --noEmit

# Rust check
cd src-tauri && cargo check

# Standalone HTTP server (browser mode)
yarn build && cargo run --manifest-path src-tauri/Cargo.toml -- serve
# Options: --port <PORT> (default: 3000, env: SC_PORT)
#          --scsynth <ADDR> (default: 127.0.0.1:57110, env: SC_SCSYNTH_ADDR)

# CLI (plugin validation/management)
cargo run --manifest-path src-tauri/Cargo.toml -- plugin validate path/to/plugin.zip
cargo run --manifest-path src-tauri/Cargo.toml -- plugin add path/to/plugin.zip
cargo run --manifest-path src-tauri/Cargo.toml -- plugin list
cargo run --manifest-path src-tauri/Cargo.toml -- plugin remove <name>

# Generate example plugin zips
bash scripts/package_examples.sh tmp

# Regenerate UGen registry from Overtone metadata
node scripts/generate_ugen_db.mjs
```

## Architecture

### Frontend (`src/`)

- **React** for layout, panels, settings UI (`src/components/`)
- **Lit web components** (`src/sc-elements/`) for plugin content — all extend `ScElement<T, S>` base class
- **Zustand** store with Redux-style slices + Immer (`src/lib/stores/`)
- **OSC communication** via `osc-js` + custom Tauri UDP plugin (`src/lib/osc/`)
- **HTML parser** (`src/lib/html/`) — walks plugin HTML, builds typed element tree with two-phase hydration
- **Runtime processor** (`src/lib/runtime/`) — creates runtime entries from element tree
- **SynthDef manager** (`src/lib/synthdef/`) — SynthDef compilation, byte storage, and lookup (singleton `synthDefManager`)
- **Parser utilities** (`src/lib/utils/`) — guards, expression parser
- **UGen system** (`src/lib/ugen/`) — SuperCollider UGen graph builder, binary SCgf encoder, operator support

### Backend (`src-tauri/src/`)

- `main.rs` — Entry point: calls `cli::run(tauri::generate_context!())`
- `lib.rs` — Module declarations only
- `cli.rs` — Clap-based CLI: dispatches to GUI (no args), `serve` (HTTP server), or `plugin` subcommands
- `config.rs` — App data dir resolution, config file I/O (`config.json`), plugins dir helper
- `ipc/` — Tauri IPC boundary (all `#[tauri::command]` functions)
  - `commands.rs` — URI scheme handler (`app://plugins/`) + Tauri commands (`udp_bind`, `udp_send`, `udp_close`, `buffer_subscribe`, `buffer_unsubscribe`)
  - `udp.rs` — Async UDP socket state management via tokio
  - `buffer.rs` — Per-bufnum `/b_getn` reader tasks + `/b_setn` parser (`rosc`). Refcounted subscriptions. Two `BufferSink` impls: `TauriChannelSink` (native mode, `Channel<Vec<f32>>`) and `WsSink` (serve mode, binary WS frames).
- `plugin/` — Plugin system
  - `manager.rs` — Plugin validation (zip, metadata, XSD, assets), CRUD (add/remove/list)
  - `router.rs` — HTTP router for plugin API (GET list, POST add, DELETE remove, GET file serving). Used by both `app://` URI scheme and standalone web server.
  - `cli.rs` — Plugin CLI command handlers (validate, add, remove, list)
  - `xsd/sc-plugin-schema.xsd` — XSD schema for plugin entry HTML validation
- `server/` — Standalone HTTP server (browser mode)
  - `mod.rs` — Hyper-based HTTP server: static asset serving from `context.assets()`, plugin route bridge, SPA fallback. Dispatches `/buffer/{bufnum}` WebSocket upgrades to `buffer_ws`.
  - `ws_bridge.rs` — WebSocket-to-UDP bridge for OSC communication with scsynth
  - `buffer_ws.rs` — Per-buffer WebSocket handler. Reads a 12-byte config header `[bufnum, chunk, frames]`, wires a `WsSink` into `BufferStreamState`, unsubscribes on close.

### Browser Support

The app can run in a browser via `sc-app serve`. Platform detection (`src/lib/env.ts`) exports `IS_TAURI` to branch behavior:

- **Storage**: `tauriStorage` (Tauri FS) vs `browserStorage` (localStorage) — selected in `persist.ts`
- **OSC**: `TauriUdpPlugin` (IPC) vs `OSC.WebsocketClientPlugin` (WebSocket to server) — selected in `OscService.ts`
- **Plugins**: `app://plugins` (URI scheme) vs `/plugins` (HTTP) — selected in `PluginManager.ts`
- **Logging**: `logWriter.ts` skips file writes when `!IS_TAURI`
- **Buffer streams**: `BufferStream` factory in `src/lib/bufferStream/` picks `TauriChannelStream` (invokes `buffer_subscribe` with a typed `Channel<number[]>`) vs `WebSocketStream` (opens `/buffer/{bufnum}`, binary f32 frames with a 4-byte length header).

Tauri module imports use dynamic `await import()` to avoid bundling Tauri-specific code in the browser path.

### App Data Directory

- macOS: `~/Library/Application Support/com.nicmell.scapp/`
- Stores: `config.json` (state persistence) and `plugins/` (zip files)

### App Flow

1. `ConnectScreen` — user enters scsynth address, connects via UDP/OSC
2. `Dashboard` — grid of panels, each can load a plugin
3. Plugins render as Lit web components inside shadow DOM
4. Web components send OSC messages to control synths

## Store Architecture

Six top-level slices in `src/lib/stores/`:

| Slice | Purpose |
|-------|---------|
| `root` | App-level state (`isRunning` flag) |
| `options` | Theme (mode/primaryColor), layout grid (rows/columns), scsynth connection (host/port/polling/timeout/latency) |
| `scsynth` | Connection state, server status (no options — moved to `options` slice) |
| `layout` | Dashboard grid items (BoxItem[]) |
| `plugins` | Installed plugin registry (PluginInfo[]) |
| `runtime` | Plugin element trees, flat nodes map, persisted overrides. Control values stored on individual `ScControlItem.runtime.value`. Synthdef bytes stored separately in `synthDefManager` |

### Runtime Actions

| Action | Payload | Description |
|--------|---------|-------------|
| `LOAD_PLUGIN` | `{id, nodes}` | Populate nodes map for a plugin |
| `UNLOAD_PLUGIN` | `id` | Remove all nodes for a plugin |
| `SET_CONTROL` | `{id, value}` | Update control value, propagate to descendants |
| `SET_VAR` | `{id, value}` | Update var value |
| `SET_RUNNING` | `{nodeId, value}` | Update node run state |
| `NEW_GROUP` | `{id, nodeId}` | Mark group as loaded with OSC nodeId |
| `NEW_SYNTH` | `{id, nodeId}` | Mark synth as loaded with OSC nodeId |
| `FREE_GROUP` | `{id}` | Mark group as unloaded |
| `FREE_SYNTH` | `{id}` | Mark synth as unloaded |
| `LOAD_SYNTHDEF` | `{id}` | Mark synthdef as loaded |
| `ALLOC_BUFFER` | `{id, bufnum}` | Mark buffer as allocated with server bufnum |
| `FREE_BUFFER` | `{id}` | Mark buffer as unloaded |

Each slice has: `slice.ts` (reducer + actions), `selectors.ts`, `index.ts` (barrel).

API layer (`src/lib/stores/api.ts`) wraps each slice for ergonomic dispatch: `layoutApi.setLayout(...)`, `scsynthApi.isConnected`, etc.

Persisted to `config.json` via Zustand persist middleware with custom `tauriStorage` adapter. The `partialize` function serializes state as `ConfigFile` with `activePreset: Preset`. The preset contains layout items with per-box `OverrideEntry[]` arrays (only non-default control/run/var values). Runtime-only fields (`loaded`, `error`) are stripped.

## Element Tree & Runtime System

Plugin HTML is processed in two phases: HTML parsing (`src/lib/html/`) builds a typed element tree, then runtime processing (`src/lib/runtime/`) creates runtime entries and mutates nodes with runtime references. Shared utilities live in `src/lib/utils/`.

### Item Types (`types/parsers.d.ts`)

| Type | Key Fields | Runtime Type | Description |
|------|-----------|-------------|-------------|
| `ScPluginItem` | title, error?, run, children | `NodeRuntime` | Plugin root container |
| `ScGroupItem` | name, run, children | `NodeRuntime` {rootId, parentId, path, enabled, run, loaded, nodeId} | Group container |
| `ScSynthItem` | name, bind, run, children | `NodeRuntime` | Synth instance; `bind` references an `sc-synthdef` by name |
| `ScSynthDefItem` | name, children | `SynthDefRuntime` {rootId, parentId, path, enabled, loaded} | SynthDef template |
| `ScUgenItem` | name, ugen, rate, op?, children | `UgenRuntime` {rootId, parentId, path, enabled} | UGen node (always `enabled: false`) |
| `ScControlItem` | name, value?, bind? | `ControlRuntime` {rootId, parentId, path, enabled, name, value, targets?, expression?} | Control parameter. `enabled: true` when parent is a node; `false` inside synthdefs/ugens |
| `ScVarItem` | name, value?, bind? | `VarRuntime` {same as ControlRuntime} | State variable (no OSC, always `enabled: true`) |
| `ScRangeItem` | bind | `InputRuntime` {rootId, parentId, path, enabled, targetId} | Slider/knob bound to a control or var |
| `ScCheckboxItem` | bind | `InputRuntime` | Toggle bound to a control or var |
| `ScSelectItem` | bind, children | `InputRuntime` | Dropdown selector with sc-option children |
| `ScOptionItem` | value, label | `UgenRuntime` | Declarative option entry (always `enabled: false`) |
| `ScRadioGroupItem` | bind, orientation, children | `InputRuntime` | Radio button group with sc-radio children |
| `ScRadioItem` | value, label, width, height, src, fgcolor, bgcolor | `UgenRuntime` | Declarative radio entry (always `enabled: false`) |
| `ScRunItem` | bind | `RunRuntime` {rootId, parentId, path, enabled, targetId} | Play/pause control |
| `ScDisplayItem` | bind, format | `InputRuntime` | Read-only value display |
| `ScIfItem` | bind, children | `InputRuntime` | Conditional rendering container |
| `ScBufferItem` | name, frames, channels | `BufferRuntime` {name, bufnum, frames, channels, loaded, ...} | Server-side buffer allocation |
| `ScRecordItem` | bind, width, height | `InputRuntime` | Live spectrogram of a bound buffer |

Union types: `ScNodeItem` (group/synth/plugin), `ScParentItem` (all with children), `ScElementItem` (all items).

`StripRuntime<T>` removes `runtime` (and recursively from `children`) to produce `ScElementItemBase` — the base type used during HTML parsing before runtime is assigned.

### HTML Parser (`src/lib/html/processHtml.ts`)

- `processHtml(args: HtmlRuntimeContext)` → `ScElementItem`
- `hydrate(node, element)` — assigns ID, extracts props, stores `_element` reference on the node
- `walkDom` yields SC elements from the DOM (recurses through non-SC elements like divs)
- `visit(node)` — closure that walks the node's DOM children, hydrates them into a scope, checks for duplicate names, and recursively calls `processHtml` for each child
- Cumulative scopes: each level prepends local scope onto parent scope for bind resolution
- `checkDuplicateNames(scope)` runs once per scope after hydration

### Runtime Processor (`src/lib/runtime/handlers.ts`)

- `processElement(ctx: RuntimeContext)` — idempotent dispatcher (early return if node already in `ctx.nodes`)
- Per-type handlers compute runtime objects:
  - **Plugin/group/synth**: call `visit()` to process children. Each `sc-control` child stores its value in `ControlRuntime.value`, with overrides applied from persisted `OverrideEntry` values
  - **SynthDef**: calls `visit()`, collects params from sc-control children, collects ugen specs from sc-ugen children (each ugen's inputs built from its own sc-control children), compiles via `synthDefManager`
  - **UGen**: calls `visit()` to process sc-control children, validates bind references against sibling ugens and parent synthdef params
  - **sc-control**: returns `ControlRuntime` with `enabled: true` when parent is a node (synth/group/plugin), `false` inside synthdefs/ugens. If `bind` is present, resolves via `resolveStateBind` with expression parsing and circular reference detection
  - **sc-var**: same as sc-control but always `enabled: true`
  - **Input/run/display/if/select/radio-group**: resolve bind paths via `resolveControlBind`/`resolveVisualBind`
- `resolve(ctx, path)` — on-demand sibling processing with idempotency. Searches cumulative scope, processes unprocessed nodes via `processElement`, walks populated children for deeper segments
- `collectControlParams(node)` — filters children for `sc-control` type, returns `Record<string, number>` (used for synthdef compilation)
- `resolveStateBind(ctx)` — parses bind expression, resolves variable paths to target IDs, checks for circular references
- **Validation**: bind paths, synthdef references, ugen input references, circular binds all validated during processing

### Utilities (`src/lib/utils/`)

- **`guards.ts`** — Type guards (`isParent`, `isNode`, `isControl`, `isVar`, `isState`, `isInput`, `isVisual`, `isSelect`, `isRadio`, etc.) over `<T extends ScElementItemBase>` with `Extract<T, ...>` return types
- **`expression.ts`** — Arithmetic expression parser and evaluator for bind expressions. Supports `+`, `-`, `*`, `/`, unary `-`, parentheses, multiple variable references

### SynthDef Manager (`src/lib/synthdef/`)

- **`SynthDefCompiler.ts`** — `compileSynthDef(name, params, specs)` — topologically sorts UGen specs, builds graph via `UGenGraphBuilder`, returns SCgf binary bytes as `number[]`. Resolves `op` attribute to `specialIndex` for BinaryOpUGen/UnaryOpUGen. **Important**: `channelsArray`/`inputArray` inputs are appended last in the SCgf wire order (matching SC's `multiNewList` behavior), regardless of their position in the Overtone defaults
- **`SynthDefManager.ts`** — Singleton `synthDefManager` storing compiled bytes keyed by node ID. Methods: `compile(boxId, nodeId, name, controls, specs)`, `get(nodeId)`, `clearBox(boxId)`. Bytes are not persisted to `config.json`

## UGen System

Located in `src/lib/ugen/`. Full SuperCollider UGen graph builder and SCgf binary encoder. See `src/lib/ugen/README.md` for the programmatic JS API documentation.

- `ugen.ts` — `UGen` class, `Rate` enum (Scalar/Control/Audio), context stack for graph building
- `synthdef.ts` — `SynthDef` class, collects UGens/constants, validates graph, encodes to binary (includes `ByteWriter`)
- `define.ts` — `defineUGen()` / `defineMultiOutUGen()` factories with multi-channel expansion
- `registry.ts` — UGen spec registry. Imports JSON metadata from `src/assets/ugens/` and registers 367 UGens on module load
- `operators.ts` — Binary ops (`+`, `*`, etc.) and unary ops (`neg`, `abs`, etc.) with constant folding
- `control.ts` — `control(name, default)` for named synth parameters

### UGen Registry Generation

The UGen registry JSON files in `src/assets/ugens/` are auto-generated from the [Overtone](https://github.com/overtone/overtone) project's UGen metadata — the most complete structured database of SuperCollider UGen specs available.

**To refresh the registry** (e.g., when Overtone adds new UGens):

```bash
node scripts/generate_ugen_db.mjs
```

The script:
1. Downloads `.clj` metadata files from `overtone/overtone` on GitHub (cached in `scripts/tmp/overtone-ugens/`)
2. Parses Clojure/EDN format: extracts name, args (ordered, with defaults), rates, numOutputs
3. Resolves `:extends` inheritance (many UGens inherit args from a base, e.g., `AllpassC` extends `CombN`)
4. Excludes `mul`/`add` params (client-side sugar, not SCgf wire inputs)
5. Renames args to camelCase and applies convention mappings (`signals` → `channelsArray`)
6. Writes JSON files to `src/assets/ugens/` (one per Overtone category: osc, filter, delay, etc.)

At runtime, `src/lib/ugen/registry.ts` imports all JSON files and registers UGens via `registerUGen()`.

**Do not edit the JSON files manually** — regenerate them with the script instead.

**Known Overtone metadata issues** (fixed in the generation script):
- `numOutputs` — Overtone marks some UGens as 0 outputs when SC actually compiles them with 1 (e.g., `RecordBuf`, `BufWr`, `DiskOut`, `Free`, `FreeSelf`, `Pause`, etc.). The script's `ZERO_OUT` set contains only UGens verified to have 0 outputs in sclang. When in doubt, check with `SynthDef(\test, { ... }).children.do { |c| [c.class.name, c.numOutputs].postln }` in sclang.
- `inputArray`/`channelsArray` argument order — Overtone lists these in the user-facing method signature order, but SC's `multiNewList` places them last in the SCgf wire order. The compiler handles this automatically.

## Web Components (`src/sc-elements/`)

Lit-based custom elements for plugin authoring. All registered in `index.ts`.

### Component Hierarchy

```
ScElement<T, S>          Base class: store subscription, _state, _runtime, _onStateChange, _sendCreate/_sendDestroy
├── ScNode<T>            Nodes (group/synth/plugin): context provider, getControls, groupId
│   ├── ScGroup          Sends /g_new, /g_freeAll, /n_free
│   │   └── ScPlugin     Plugin root: loads HTML, processes tree
│   └── ScSynth          Sends /s_new, /n_free
├── ScInput<T>           Inputs bound to controls/vars: shared getState + _dispatchChange
│   ├── ScRange          Knob or slider (renders sc-knob/sc-slider)
│   ├── ScCheckbox       Toggle switch (renders sc-switch)
│   ├── ScSelect         Custom combobox dropdown (provides SelectContext)
│   ├── ScRadioGroup     Radio button group (provides RadioGroupContext)
│   ├── ScDisplay        Read-only formatted value display
│   └── ScIf             Conditional rendering
├── ScState<T>           State elements: name/value props, _match guard
│   ├── ScControl        Synth control: sends /n_set on value change via _onStateChange
│   └── ScVar            State variable: no OSC
├── ScSynthDef           SynthDef: sends /d_recv when parent loaded
├── ScBuffer             Buffer: sends /b_alloc on create, /b_free on destroy
├── ScRecord             Spectrogram: opens BufferStream, FFTs ticks, draws rolling waterfall
├── ScRun                Play/pause: sends /n_run
├── ScOption             Declarative select option (consumes SelectContext)
├── ScRadio              Declarative radio button (consumes RadioGroupContext)
└── ScUgen               Declarative UGen node (no shadow DOM)
```

### Element Table

| Element | Key Properties | Behavior |
|---------|---------------|----------|
| `sc-plugin` | — | Plugin root. Loads HTML, parses tree, creates group on server |
| `sc-group` | name | Group container. Sends `/g_new` on parent enabled, `/g_freeAll` + `/n_free` on destroy |
| `sc-synth` | name, bind | Synth instance. Sends `/s_new` on parent enabled, `/n_free` on destroy |
| `sc-synthdef` | name | SynthDef template. Compiles and sends `/d_recv` when parent loaded |
| `sc-control` | name, value, bind | Control parameter. Sends `/n_set` on value change when `enabled` and parent has nodeId |
| `sc-var` | name, value, bind | State variable. No OSC. Supports bind expressions |
| `sc-range` | bind, type (knob/slider), min, max, step, diameter, width, height, src, sprites, fgcolor, bgcolor | Slider or knob. Dispatches `setControl`/`setVar` |
| `sc-checkbox` | bind, width, height, src, fgcolor, bgcolor | Toggle switch. Dispatches `setControl`/`setVar` |
| `sc-select` | bind | Custom combobox dropdown. Provides `SelectContext` to sc-option children |
| `sc-option` | value, label | Declarative option. Renders itself as a clickable item inside sc-select dropdown |
| `sc-radio-group` | bind, orientation | Radio button group. Provides `RadioGroupContext` to sc-radio children |
| `sc-radio` | value, label, width, height, src, fgcolor, bgcolor | Declarative radio. Renders SVG circle or sprite sheet indicator |
| `sc-run` | bind, size, src, fgcolor, bgcolor | Play/pause button. Sends `/n_run` directly |
| `sc-display` | bind, format | Read-only value display. Printf-style format (`%d`, `%.2f`, `%b`, `%s`) |
| `sc-if` | bind, is-truthy/is-falsy/is-equal/etc. | Conditional rendering |
| `sc-buffer` | name, frames, channels | Allocates a server-side buffer. `bufnum` assigned automatically via `oscService.nextBufNum()` |
| `sc-record` | bind, width, height | Live waterfall spectrogram of a bound buffer. Opens a per-buffer stream (Tauri Channel in native, WebSocket in serve mode). N=1024 Hann-windowed FFT, hop=512, HSL dB colormap. |

Internal components in `sc-elements/internal/`:
- `sc-element.ts` — Abstract base for all sc-elements. Store subscription, `_state`, `_runtime`, `_onStateChange(prev, next)`, `_sendCreate`/`_sendDestroy`, parent context consumer
- `sc-node.ts` — Abstract base for nodes. Context provider, `getControls()`, `groupId`
- `sc-input.ts` — Abstract base for inputs. Shared `getState` (resolves target value), `_dispatchChange`, `resolveStateValue`
- `sc-state.ts` — Abstract base for state elements. `name`/`value` props, `_match` guard
- `sc-knob.ts`, `sc-slider.ts`, `sc-switch.ts` — Low-level UI controls

### Bind Model

All element-to-data references use `bind`:
- **sc-synth** `bind="synthdefName"` — references an `<sc-synthdef>` by name
- **sc-range/sc-checkbox/sc-select/sc-radio-group** `bind="nodeName.controlName"` — dot-path to a control or var
- **sc-display/sc-if** `bind="nodeName.controlName"` — read-only dot-path reference
- **sc-run** `bind="synthOrGroupName"` — references a synth or group (empty = parent context)
- **sc-control/sc-var** `bind="nodeName.controlName"` — mirrors another control/var's value (with optional arithmetic expression)
- **sc-control** `bind="bufferName"` — when bound to an `sc-buffer`, resolves to the buffer's `bufnum` at `/s_new` time (implicit substitution in `ScNode.getControls`)

### Bind Expressions

Controls and vars support arithmetic expressions in `bind` strings:

```html
<sc-var name="doubled" bind="vars.freq * 2"/>
<sc-var name="offset" bind="vars.freq + 100"/>
<sc-var name="scaled" bind="(vars.amp - 0.5) * 2"/>
<sc-var name="sum" bind="vars.x + vars.y"/>
<sc-control name="freq" bind="master.freq * 0.5"/>
```

- Supported operators: `+`, `-`, `*`, `/`, unary `-`, parentheses
- Multiple variable references allowed: `bind="vars.x + vars.y * 2"`
- Expressions are parsed at plugin load time into an AST, evaluated reactively when source values change
- Circular references are detected and throw at parse time

### Bind Resolution & Scoping

Bind paths are resolved by the `resolve` function in `src/lib/runtime/handlers.ts`. Resolution uses **cumulative scopes** — each scope level contains its own siblings prepended onto the parent scope.

#### Scope Construction

When `processHtml`'s visit function processes a parent node's children:
1. Walk the DOM to find SC elements → hydrate into a local scope
2. Build cumulative scope: `[...localScope, ...parentScope]`
3. Each child receives this cumulative scope as `ctx.scope`

This means nodes can see:
- Their own siblings (innermost, found first by `findIndex`)
- Parent-level elements
- Grandparent-level elements, etc. up to the plugin root

#### How `resolve(ctx, path)` Works

1. Takes a dot-separated path split into segments (e.g., `["outer", "inner", "deep"]`)
2. Searches `ctx.scope` (cumulative) for the first segment by `name`
3. If found, ensures the target is processed (on-demand via `processElement` with idempotency)
4. For remaining segments, walks populated children for deeper segments
5. Returns the final resolved `ScElementItem`

#### On-Demand Processing

`resolve` triggers `processElement` for unprocessed targets. `processElement` is idempotent (early return if node already in `ctx.nodes`). This handles:
- **Forward references**: controls appearing before their target synth in DOM order
- **Cross-level references**: synthdefs at ancestor scope levels
- **Nested resolution**: processing a group processes its entire subtree via `visit`

## Plugin System

**Structure:** zip containing `metadata.json` + entry HTML + optional assets (png/jpeg).

**Validation pipeline** (in `plugin/manager.rs`):
1. Valid zip archive
2. `metadata.json` — name (alphanumeric/-/_), semver version, author, entry path, assets array
3. Entry HTML — validated against XSD schema (`src-tauri/src/plugin/xsd/sc-plugin-schema.xsd`)
4. Assets — format detection must match declared type

**Frontend loading** (`src/lib/plugins/PluginManager.ts`):
- `loadPlugin(boxId, rootElement)` — single async method: fetches HTML, parses XML, sets innerHTML, hydrates, processes runtime, returns nodes map
- Plugin element dispatches `runtimeApi.loadPlugin()` and `_sendCreate()`

**Plugin HTML elements** (validated by XSD):
- `<sc-control name="..." value="..."/>` — declares a control parameter (on synth/group/plugin/synthdef)
- `<sc-control name="..." bind="..."/>` — declares a bound control (mirrors another control/var, optionally with arithmetic)
- `<sc-var name="..." value="..."/>` — declares a state variable
- `<sc-var name="..." bind="..."/>` — declares a bound variable (mirrors another, optionally with arithmetic)
- `<sc-synthdef name="...">` with `<sc-control>` + `<sc-ugen>` children — defines a synth graph
- `<sc-ugen name="..." type="..." rate="..." op="...">` with `<sc-control>` children — a UGen node
- `<sc-synth name="..." bind="synthdefName">` with `<sc-control>` children — synth instance
- `<sc-group name="...">` — groups synths/controls
- `<sc-range>`, `<sc-checkbox>`, `<sc-run>`, `<sc-display>`, `<sc-if>` — UI controls
- `<sc-select bind="...">` with `<sc-option>` children — dropdown selector
- `<sc-radio-group bind="..." orientation="...">` with `<sc-radio>` children — radio buttons
- `<sc-buffer name="..." frames="..." channels="..."/>` — allocates a server-side buffer
- `<sc-record bind="bufferName" width="..." height="..."/>` — live spectrogram of the bound buffer

## OSC Communication (`src/lib/osc/`)

- `OscService.ts` — Singleton managing osc-js connection. Polls `/status` at configurable interval. Dispatches replies to store. In Tauri mode uses `TauriUdpPlugin`; in browser mode uses `OSC.WebsocketClientPlugin` (connects to the standalone server's WebSocket endpoint which bridges to scsynth via UDP).
- `TauriUdpPlugin.ts` — osc-js plugin adapter wrapping `TauriDatagramSocket` (Tauri mode only)
- `TauriDatagramSocket.ts` — Bridges to Tauri `udp_bind`/`udp_send`/`udp_close` commands (Tauri mode only)
- `messages.ts` — OSC message factories: `/status`, `/s_new`, `/g_new`, `/n_set`, `/n_run`, `/n_free`, `/d_recv`, `/b_alloc`, `/b_free`, etc.

## Buffer Streaming (`src/lib/bufferStream/`, `src-tauri/src/ipc/buffer.rs`, `src-tauri/src/server/buffer_ws.rs`)

`sc-record` (and future buffer consumers) stream audio data from scsynth without going through osc-js. The Rust reader core owns a tokio task per active bufnum that sends `/b_getn` every ~33 ms and parses `/b_setn` replies with `rosc`, fanning f32 samples out to all registered sinks. Subscriptions are refcounted — two `sc-record`s on the same buffer share a single read loop.

- **Native mode:** `buffer_subscribe` Tauri command wraps a `Channel<Vec<f32>>`; frontend `TauriChannelStream` dispatches ticks via `channel.onmessage`.
- **Serve mode:** `/buffer/{bufnum}` WebSocket route; client opens WS, sends `[bufnum, chunk, frames]` (12 bytes LE), server pushes `[numSamples u32 LE, f32 LE × n]` per tick.

Backpressure: sinks are drop-on-slow. `WsSink` uses a bounded `mpsc(4)`; `TauriChannelSink.send` returns false only when the frontend has dropped the channel.

## Example Plugins (`examples/`)

| Example | Purpose |
|---------|---------|
| `example-plugin` | Basic synth with local synthdef, knobs, sliders, checkbox |
| `group-plugin` | Two synths in a group with local synthdef, per-oscillator controls |
| `synthdef-plugin` | FM synthesis with custom synthdef (SinOsc + MulAdd modulation) |
| `group-bind-plugin` | Group with synths, group-level controls, per-synth run/range/display |
| `forward-ref-plugin` | Controls appear before the synth they reference — tests on-demand resolve |
| `nested-groups-plugin` | Multi-segment resolve paths through nested groups |
| `conditional-plugin` | sc-if with controls binding to siblings — tests sc-if scope transparency |
| `var-plugin` | sc-var elements with bind expressions (mirror, doubled, sum, product) |
| `select-plugin` | sc-select/sc-option dropdowns and sc-radio-group/sc-radio buttons |
| `waveform-plugin` | Select UGen switching between SinOsc/Saw/Pulse via sc-select |
| `record-plugin` | Chirping sine recorded into a buffer with RecordBuf; visualised by sc-record spectrogram. Exercises the per-buffer streaming path end-to-end. |
| `bad-bindings` | Intentional binding errors (typos, missing synths) for testing validation |
| `bad-asset-type` | Invalid asset format for testing validation |
| `bad-asset-mismatch` | Declared vs actual asset type mismatch |
| `bad-entry-xhtml` | Invalid XML for testing validation |
| `bad-entry-schema` | XSD schema violations for testing validation |
| `bad-metadata` | Invalid metadata.json for testing validation |

## Conventions

### Imports

- Absolute via `@/` alias (maps to `src/`). Prefer absolute for cross-directory imports.
- Relative only for same-directory or parent within the same component folder.

### React Components

```tsx
// Named export, props interface, classnames for styling
interface FooProps extends HTMLAttributes<HTMLElement> {
  variant?: "a" | "b";
  size?: "sm" | "md" | "lg";
}

export function Foo({variant = "a", size = "md", className, ...rest}: FooProps) {
  return <div className={cn("foo", `foo--${variant}`, `foo--${size}`, className)} {...rest} />;
}
```

### File Structure

- Component: `ComponentName/ComponentName.tsx` + `ComponentName.scss` + `index.ts`
- Reusable UI primitives live in `src/components/ui/` (Button, IconButton, Modal)
- Domain components at `src/components/` (Dashboard, SettingsDrawer, PluginList, etc.)

### CSS/SCSS

- CSS custom properties for all colors (`--color-bg`, `--color-text`, `--color-surface`, `--color-surface-active`, `--color-border`, `--color-panel-header`, `--color-primary`)
- SCSS variables for local constants (`$header-height`)
- BEM-inspired class naming: `.component-element` or `.component--modifier`
- No CSS modules — global class names, scoped by naming convention

### Rust

- Tauri commands return `Result<T, String>` for frontend error handling
- `lib.rs` is module declarations only — all logic lives in submodules
- CLI uses `clap` derive API with subcommands; `--port`/`--scsynth` support env vars (`SC_PORT`, `SC_SCSYNTH_ADDR`)
- Backend organized into `ipc/` (Tauri commands), `plugin/` (plugin system), `server/` (standalone HTTP)
- XSD schema embedded via `include_str!`

### State

- Never mutate store directly — always dispatch actions via API layer
- Selectors are memoized (`createSelector`) — use them for derived state
- Runtime-only fields (`loaded`, `error`) are stripped during persistence via `partialize` in persist config
- Control values live on individual `ScControlItem.runtime.value` entries. Overrides persisted as `OverrideEntry[]` per layout box
- Element trees live on `ScPluginItem.children` in the runtime slice

## Key Constants

- Default scsynth: `127.0.0.1:57110`
- Default grid: 8 rows x 12 columns
- Header height: 42px, footer height: 42px
- Tauri identifier: `com.nicmell.scapp`
- OSC polling: 1000ms, reply timeout: 3000ms

## No Linter/Formatter Configured

There is no eslint or prettier config. Rely on TypeScript strict mode (`tsconfig.json`) and consistent patterns.
