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

# CLI (plugin validation/management)
cargo run --manifest-path src-tauri/Cargo.toml -- validate path/to/plugin.zip
cargo run --manifest-path src-tauri/Cargo.toml -- add path/to/plugin.zip
cargo run --manifest-path src-tauri/Cargo.toml -- list
cargo run --manifest-path src-tauri/Cargo.toml -- remove <name>

# Generate example plugin zips
bash scripts/package_examples.sh tmp
```

## Architecture

### Frontend (`src/`)

- **React** for layout, panels, settings UI (`src/components/`)
- **Lit web components** (`src/sc-elements/`) for plugin content (sc-synth, sc-group, sc-range, sc-checkbox, sc-run, sc-display, sc-if, sc-synthdef)
- **Zustand** store with Redux-style slices + Immer (`src/lib/stores/`)
- **OSC communication** via `osc-js` + custom Tauri UDP plugin (`src/lib/osc/`)
- **HTML parser** (`src/lib/html/`) — walks plugin HTML, builds typed element tree with two-phase hydration
- **Runtime processor** (`src/lib/runtime/`) — creates runtime entries (controls, run states) from element tree
- **SynthDef manager** (`src/lib/synthdef/`) — SynthDef compilation, byte storage, and lookup (singleton `synthDefManager`)
- **Parser utilities** (`src/lib/utils/`) — guards, element tree traversal, props extraction
- **UGen system** (`src/lib/ugen/`) — SuperCollider UGen graph builder, binary SCgf encoder, operator support

### Backend (`src-tauri/src/`)

- `lib.rs` — Tauri glue (sole file with Tauri deps): app builder, commands, URI scheme handler
- `plugin_manager.rs` — Plugin validation (zip, metadata, XSD, assets), CRUD (add/remove/list)
- `http_server.rs` — HTTP router for `app://plugins/` (GET list, POST add, DELETE remove, GET file serving)
- `udp_server.rs` — Async UDP socket management via tokio (no Tauri deps)
- `cli.rs` — CLI for validate/add/remove/list (no Tauri deps)
- `config.rs` — App data dir resolution, config file I/O (`config.json`), plugins dir helper

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
| `runtime` | Plugin element trees, flat nodes map, persisted overrides. Control values stored directly on `NodeRuntime.controls`. Synthdef bytes stored separately in `synthDefManager` |

Each slice has: `slice.ts` (reducer + actions), `selectors.ts`, `index.ts` (barrel).

API layer (`src/lib/stores/api.ts`) wraps each slice for ergonomic dispatch: `layoutApi.setLayout(...)`, `scsynthApi.isConnected`, etc.

Persisted to `config.json` via Zustand persist middleware with custom `tauriStorage` adapter. The `partialize` function serializes state as `ConfigFile` with `activePreset: Preset`. The preset contains layout items with per-box `OverrideEntry[]` arrays (only non-default control/run values). Runtime-only fields (`loaded`, `error`) are stripped.

## Element Tree & Runtime System

Plugin HTML is processed in two phases: HTML parsing (`src/lib/html/`) builds a typed element tree, then runtime processing (`src/lib/runtime/`) creates runtime entries and mutates nodes with runtime references. Shared utilities live in `src/lib/utils/`.

### Node Types (`types/parsers.d.ts`)

| Type | Key Fields | Runtime Type | Description |
|------|-----------|-------------|-------------|
| `ScPluginNode` | title, run, children | `PluginRuntime` (extends NodeRuntime + loaded/error) | Plugin root container |
| `ScGroupNode` | name, run, children | `NodeRuntime` {rootId, run, controls} | Group container |
| `ScSynthNode` | name, bind, run, children | `NodeRuntime` | Synth instance; `bind` references an `sc-synthdef` by name |
| `ScSynthDefNode` | name, children | `UgenRuntime` {rootId} | SynthDef template; children are `ScControlNode[]` + `ScUgenNode[]` |
| `ScUgenNode` | name, ugen, rate, op?, children | `UgenRuntime` | UGen node; children are `ScControlNode[]` for inputs |
| `ScControlNode` | name, value, bind? | `UgenRuntime` | Control parameter declaration. `value` for constants, `bind` for references |
| `ScRangeNode` | bind | `InputRuntime` {rootId, targetNode, name} | Slider/knob bound to a synth control |
| `ScCheckboxNode` | bind | `InputRuntime` | Toggle bound to a synth control |
| `ScRunNode` | bind | `InputRuntime` | Play/pause control |
| `ScDisplayNode` | bind, format | `InputRuntime` | Read-only value display |
| `ScIfNode` | bind, children | `InputRuntime` | Conditional rendering container |

All parent types (`ScParentNode`): plugin, group, synth, synthdef, ugen, sc-if. Controls are declared via `<sc-control>` children — not as HTML attributes (except for synthdef `name` and ugen `name`/`type`/`rate`/`op`).

`StripRuntime<T>` removes `runtime` (and recursively from `children`) to produce `ScElementNodeBase` — the base type used during HTML parsing before runtime is assigned.

### HTML Parser (`src/lib/html/processHtml.ts`)

- `processHtml(args: HtmlRuntimeContext)` → `ScElementNode`
- `hydrate(node, element)` — assigns ID, extracts props, stores `_element` reference on the node
- `walkDom` yields SC elements from the DOM (recurses through non-SC elements like divs)
- `visit(node)` — closure that walks the node's DOM children, hydrates them into a scope, checks for duplicate names, and recursively calls `processHtml` for each child
- Cumulative scopes: each level prepends local scope onto parent scope for bind resolution
- `checkDuplicateNames(scope)` runs once per scope after hydration

### Runtime Processor (`src/lib/runtime/handlers.ts`)

- `processElement(ctx: RuntimeContext)` — idempotent dispatcher (early return if node already in `ctx.nodes`)
- Per-type handlers compute runtime objects:
  - **Plugin/group/synth**: call `visit()` to process children, then `collectControls()` reads `sc-control` children to build `NodeRuntime.controls`, applying overrides from persisted `OverrideEntry` values
  - **SynthDef**: calls `visit()`, collects params from sc-control children, collects ugen specs from sc-ugen children (each ugen's inputs built from its own sc-control children), compiles via `synthDefManager`
  - **UGen**: calls `visit()` to process sc-control children, validates bind references against sibling ugens and parent synthdef params
  - **sc-control**: returns `UgenRuntime` (dummy, no processing needed)
  - **Input/run/display/if**: resolve bind paths via `resolveControlBind`/`resolve`
- `resolve(ctx, path)` — on-demand sibling processing with idempotency. Searches cumulative scope, processes unprocessed nodes via `processElement`, walks populated children for deeper segments
- `collectControls(node)` — filters children for `sc-control` type, returns `Record<string, number>`
- `findOverride(ctx, type, name)` — matches persisted overrides by `targetNode === ctx.path`
- **Validation**: bind paths, synthdef references, ugen input references all validated during processing

### Utilities (`src/lib/utils/`)

- **`guards.ts`** — Type guards (`isParent`, `isNode`, `isControl`, `isPlugin`, etc.) over `<T extends ScElementNodeBase>` with `Extract<T, ...>` return types
- **`elementTree.ts`** — `findElementById` and `findElementByPath` for tree traversal

### SynthDef Manager (`src/lib/synthdef/`)

- **`SynthDefCompiler.ts`** — `compileSynthDef(name, params, specs)` — topologically sorts UGen specs, builds graph via `UGenGraphBuilder`, returns SCgf binary bytes as `number[]`
- **`SynthDefManager.ts`** — Singleton `synthDefManager` storing compiled bytes keyed by node ID. Methods: `compile(boxId, nodeId, name, controls, specs)`, `get(nodeId)`, `clearBox(boxId)`. Bytes are not persisted to `config.json`

## UGen System

Located in `src/lib/ugen/`. Full SuperCollider UGen graph builder and SCgf binary encoder.

- `ugen.ts` — `UGen` class, `Rate` enum (Scalar/Control/Audio), context stack for graph building
- `synthdef.ts` — `SynthDef` class, collects UGens/constants, validates graph, encodes to binary
- `define.ts` — `defineUGen()` / `defineMultiOutUGen()` factories with multi-channel expansion
- `registry.ts` — Runtime lookup table for UGen class specs
- `ugens.ts` — Registers oscillators, noise, filters, envelopes, I/O, analysis
- `operators.ts` — Binary ops (`+`, `*`, etc.) and unary ops (`neg`, `abs`, etc.)
- `control.ts` — `control(name, default)` for named synth parameters
- `encode.ts` — `ByteWriter` for SCgf v2 binary format (big-endian)

## Web Components (`src/sc-elements/`)

Lit-based custom elements for plugin authoring. All registered in `index.ts`.

| Element | Key Properties | Behavior |
|---------|---------------|----------|
| `sc-plugin` | — | Plugin root. Loads HTML, parses tree, updates layout |
| `sc-group` | name | Group container. Sends `/g_new` on create, `/g_freeAll` + `/n_free` on disconnect |
| `sc-synth` | name, bind | Synth instance. Sends `/s_new` on create, `/n_free` on disconnect |
| `sc-synthdef` | name | SynthDef template. Compiles and sends `/d_recv` |
| `sc-control` | name, value, bind | **No web component.** Declares a control parameter (value-based or bind-based). Parsed only |
| `sc-range` | bind, type (knob/slider), min, max, step | Slider or knob. Renders `sc-knob` or `sc-slider` internally |
| `sc-checkbox` | bind | Toggle switch. Renders `sc-switch` internally |
| `sc-run` | bind, run, size, src | Play/pause button. SVG icon or sprite sheet |
| `sc-display` | bind, format | Read-only value display. Printf-style format (`%d`, `%.2f`, `%b`, `%s`) |
| `sc-if` | bind, is-truthy/is-falsy/is-equal/etc. | Conditional rendering |

Internal components in `sc-elements/internal/`:
- `sc-node.ts` — Abstract base for sc-synth/sc-group. Manages nodeId, provides `NodeContext` (via Lit context)
- `sc-knob.ts`, `sc-slider.ts`, `sc-switch.ts` — Low-level UI controls

### Bind Model

All element-to-data references use `bind`:
- **sc-synth** `bind="synthdefName"` — references an `<sc-synthdef>` by name
- **sc-range/sc-checkbox** `bind="synthName.controlName"` — dot-path to a synth control
- **sc-display/sc-if** `bind="synthName.controlName"` — read-only dot-path reference
- **sc-run** `bind="synthOrGroupName"` — references a synth or group (empty = parent context)

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
4. For remaining segments, recurses with `scope: [...target.children, ...ctx.scope]`
5. Returns the final resolved `ScElementNode`

#### Resolution Examples

**Simple bind** — `<sc-range bind="synth.freq"/>`:
- Split: segments = `["synth"]`, controlName = `"freq"`
- `resolve(ctx, ["synth"])` finds "synth" in cumulative scope
- Validates "freq" exists in synth's controls

**Nested path** — `<sc-range bind="outer.inner.deep.freq"/>`:
- `resolve` finds "outer" → processes it (and subtree) → recurses into outer.children
- Finds "inner" → recurses into inner.children → finds "deep"
- Validates "freq" on deep synth

**Cross-level synthdef** — synthdef at root, synth nested in groups:
```xml
<sc-synthdef name="tone" .../>
<sc-group name="outer">
  <sc-synth name="s1" bind="tone"/>
</sc-group>
```
Synth's cumulative scope: `[s1, ...outer_scope, synthdef(tone), ...root_scope]`. `resolve(ctx, ["tone"])` finds the synthdef via ancestor visibility.

**Shadowing** — inner names shadow outer:
```xml
<sc-synthdef name="tone" .../>
<sc-group name="a">
  <sc-synthdef name="tone" .../>  <!-- shadows root-level "tone" -->
  <sc-synth bind="tone"/>         <!-- resolves to inner "tone" -->
</sc-group>
```
`findIndex` returns the first (innermost) match.

**Cross-group isolation** — siblings can't see into each other:
```xml
<sc-group name="a"><sc-synth name="s1"/></sc-group>
<sc-group name="b"><sc-range bind="s1.freq"/></sc-group>  <!-- ERROR: s1 not visible -->
```
"s1" is only in group "a"'s children, not in the root scope. Use `bind="a.s1.freq"` for the full path.

**sc-if transparency** — nameless parents don't create scope boundaries:
```xml
<sc-synth name="osc" .../>
<sc-if bind="osc.gate">
  <sc-display bind="osc.gate"/>  <!-- finds "osc" via cumulative scope -->
</sc-if>
```
sc-if's children scope: `[display, checkbox, ...parent_scope_with_osc]`.

#### On-Demand Processing

`resolve` triggers `processElement` for unprocessed targets. `processElement` is idempotent (early return if node already in `ctx.nodes`). This handles:
- **Forward references**: controls appearing before their target synth in DOM order
- **Cross-level references**: synthdefs at ancestor scope levels
- **Nested resolution**: processing a group processes its entire subtree via `visit`

## Plugin System

**Structure:** zip containing `metadata.json` + entry HTML + optional assets (png/jpeg).

**Validation pipeline** (in `plugin_manager.rs`):
1. Valid zip archive
2. `metadata.json` — name (alphanumeric/-/_), semver version, author, entry path, assets array
3. Entry HTML — validated against XSD schema (`src-tauri/src/xsd/sc-plugin-schema.xsd`)
4. Assets — format detection must match declared type

**Frontend loading** (`src/lib/plugins/PluginManager.ts`):
- Fetches via `app://plugins/{id}/{entry}` URI scheme
- Parses XHTML via DOMParser
- Phase 1: `processHtml()` builds element tree with ID hydration from saved state
- Phase 2: `processRuntime()` creates runtime entries, resolves bindings, compiles synthdefs
- Sanitizes with DOMPurify (forbids script/iframe/object/embed/form)
- Caches as TrustedHTML, renders inside shadow DOM

**Plugin HTML elements** (validated by XSD):
- `<sc-control name="..." value="..."/>` — declares a control parameter (on synth/group/plugin/synthdef)
- `<sc-control name="..." bind="..."/>` — declares a ugen input bound to another ugen or synthdef param
- `<sc-synthdef name="...">` with `<sc-control>` + `<sc-ugen>` children — defines a synth graph
- `<sc-ugen name="..." type="..." rate="..." op="...">` with `<sc-control>` children — a UGen node
- `<sc-synth name="..." bind="synthdefName">` with `<sc-control>` children — synth instance
- `<sc-group name="...">` — groups synths/controls
- `<sc-range>`, `<sc-checkbox>`, `<sc-run>`, `<sc-display>`, `<sc-if>` — UI controls

## OSC Communication (`src/lib/osc/`)

- `OscService.ts` — Singleton managing osc-js connection. Polls `/status` at configurable interval. Dispatches replies to store
- `TauriUdpPlugin.ts` — osc-js plugin adapter wrapping `TauriDatagramSocket`
- `TauriDatagramSocket.ts` — Bridges to Tauri `udp_bind`/`udp_send`/`udp_close` commands
- `messages.ts` — OSC message factories: `/status`, `/s_new`, `/g_new`, `/n_set`, `/n_run`, `/n_free`, `/d_recv`, etc.

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
- Barrel exports via `index.ts`.

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
- Public modules in `lib.rs` for CLI access (`pub mod plugin_manager`, `pub mod cli`)
- XSD schema embedded via `include_str!`

### State

- Never mutate store directly — always dispatch actions via API layer
- Selectors are memoized (`createSelector`) — use them for derived state
- Runtime-only fields (`loaded`, `error`) are stripped during persistence via `partialize` in persist config
- Control values live on `NodeRuntime.controls` (no separate entries map). Overrides persisted as `OverrideEntry[]` per layout box
- Element trees live on `ScPluginNode.children` in the runtime slice

## Key Constants

- Default scsynth: `127.0.0.1:57110`
- Default grid: 8 rows x 12 columns
- Header height: 42px, footer height: 42px
- Tauri identifier: `com.nicmell.scapp`
- OSC polling: 1000ms, reply timeout: 3000ms

## No Linter/Formatter Configured

There is no eslint or prettier config. Rely on TypeScript strict mode (`tsconfig.json`) and consistent patterns.
