# SC-App

A desktop application for controlling SuperCollider (scsynth) via a plugin-based dashboard UI. Built with Tauri 2 (Rust backend) + React 19 + Lit 3 web components.

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

- **React** for layout, panels, settings UI
- **Lit web components** (`src/sc-elements/`) for plugin content (sc-synth, sc-ugen, sc-knob, sc-slider, etc.)
- **Zustand** store with Redux-style slices + Immer (`src/lib/stores/`)
- **OSC communication** via `osc-js` + custom Tauri UDP plugin (`src/lib/osc/`)

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
5. Plugins can define synths inline via `<sc-ugen>` children — SynthDefs are built client-side and sent via `/d_recv`

## Store Architecture

Four top-level slices in `src/lib/stores/`:

| Slice | Purpose |
|-------|---------|
| `scsynth` | Connection state, server status, options, live node tree |
| `layout` | Dashboard grid items + grid options |
| `theme` | Dark/light mode, primary color |
| `plugins` | Installed plugin registry |

The `nodes` sub-slice (synths, groups) is nested inside `scsynth` — its reducer is delegated via `defaultReducer` and its state lives at `scsynth.nodes`. `SynthItem` stores both `inputs` (param name→value) and `ugens` (serialized UGen graph as `UGenItem[]`).

Each slice has: `slice.ts` (reducer + actions), `selectors.ts`, `index.ts` (barrel).

API layer (`src/lib/stores/api.ts`) wraps each slice for ergonomic dispatch: `layoutApi.setLayout(...)`, `scsynthApi.isConnected`, etc.

Persisted to `config.json` via Zustand persist middleware with custom `tauriStorage` adapter.

## Plugin System

**Structure:** zip containing `metadata.json` + entry HTML + optional assets (png/jpeg).

**Validation pipeline** (in `plugin_manager.rs`):
1. Valid zip archive
2. `metadata.json` — name (alphanumeric/-/_), semver version, author, entry path, assets array
3. Entry HTML — validated against XSD schema (`src-tauri/src/xsd/sc-plugin-schema.xsd`)
4. Assets — format detection must match declared type

**Frontend loading** (`src/lib/plugins/PluginManager.ts`):
- Fetches via `app://plugins/{id}/{entry}` URI scheme
- Sanitizes with DOMPurify (forbids script/iframe/object/embed/form)
- Caches as TrustedHTML, renders inside shadow DOM

### Inline SynthDef Building

Plugins can define synths in two modes:

- **Named synth** (`<sc-synth name="sine">`) — assumes the SynthDef already exists on the server. Sends `/s_new` immediately.
- **Inline synth** (`<sc-synth>` without `name`) — builds a SynthDef from `<sc-ugen>` children, encodes it to binary (SCgf v2), sends `/d_recv`, then `/s_new` after 50ms.

UGen graph is declared in HTML via `<sc-ugen>` elements:

```html
<sc-synth>
  <sc-ugen id="osc" type="SinOsc" rate="ar" freq="inputs.freq" phase="0"/>
  <sc-ugen id="pan" type="Pan2" rate="ar" in="ugens.osc" pos="0" level="inputs.amp"/>
  <sc-ugen type="Out" rate="ar" bus="0" in="ugens.pan.0,ugens.pan.1"/>
  <sc-knob param="freq" min="20" max="2000" value="440" diameter="48"/>
  <sc-knob param="amp" min="0" max="1" value="0.2" diameter="48"/>
</sc-synth>
```

**Input reference syntax** (resolved via `get()` dot-path accessor):
- `inputs.<name>` — references a control param (from sc-knob, sc-slider, sc-switch)
- `ugens.<id>` — references another UGen's output
- `ugens.<id>.<n>` — references a specific output channel (e.g. `ugens.pan.0` for Pan2's left)
- Comma-separated values expand to multiple inputs (e.g. `ugens.pan.0,ugens.pan.1`)
- Bare numbers are parsed as float constants

**UGen registry** (`src/sc-elements/internal/ugen-registry.ts`): maps UGen type names to `{inputs: string[], numOutputs: number}`. Covers oscillators, noise, filters, envelopes, I/O, panning, delays, dynamics, effects, triggers, math, and operators.

**SynthDef encoding** (`src/lib/ugen/`): builds UGen graph in memory and serializes to SuperCollider's binary SynthDef format (SCgf v2).

## SC Elements Architecture (`src/sc-elements/`)

Lit web components for plugin UI. All use `@lit/context` for parent-child communication.

### Context System

`ScNode` (abstract base for `ScSynth`, `ScGroup`) acts as a `ContextProvider`. Children consume context to register themselves:

- **`ScElement`** interface — implemented by controls (sc-knob, sc-slider, sc-switch). Provides `getInputs()` returning `Record<string, number>`.
- **`ScUGenData`** interface — implemented by `ScUGen`. Exposes `type`, `rate`, `id`, and `getAttribute()` for reading dynamic UGen inputs.
- **`ScControl`** (`internal/sc-control.ts`) — base class for param-bearing controls. Handles context registration, `param` property, and `_notifyChange()`.
- **`ScNode`** (`internal/sc-node.ts`) — base class for synth/group nodes. Manages `registeredElements` (Set) and `registeredUGens` (array), provides context, handles `onChange` → store update + OSC message.

### Key Elements

| Element | Purpose |
|---------|---------|
| `sc-synth` | Synth node — named or inline SynthDef |
| `sc-group` | Group node |
| `sc-ugen` | UGen declaration (`display: contents`, renders children via slot) |
| `sc-knob` | Rotary knob param control (extends `ScRange` → `ScControl`) |
| `sc-slider` | Linear slider param control (extends `ScRange` → `ScControl`) |
| `sc-switch` | Toggle switch param control |
| `sc-run` | Play/stop button |
| `sc-display` | Read-only value display |
| `sc-if` | Conditional text display |

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

- CSS custom properties for all colors (`--color-bg`, `--color-text`, `--color-surface`, `--color-border`, `--color-panel-header`, `--color-primary`)
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
- Runtime-only fields (loaded, error, violations on PluginInfo) are excluded from persistence

## Key Constants

- Default scsynth: `127.0.0.1:57110`
- Default grid: 8 rows x 12 columns
- Header height: 48px, footer height: 42px
- Tauri identifier: `com.nicmell.scapp`
- OSC polling: 1000ms, reply timeout: 3000ms

## Example Plugins (`examples/`)

| Plugin | Description |
|--------|-------------|
| `example-plugin` | Named synth (`name="sine"`), knobs + slider + switch |
| `sine-inline` | Inline SinOsc → Pan2 → Out |
| `fm-synth` | Inline FM synthesis: mod SinOsc → MulAdd → carrier SinOsc → Pan2 → Out |
| `noise-filter` | Inline WhiteNoise → RLPF → Pan2 → Out |

## No Linter/Formatter Configured

There is no eslint or prettier config. Rely on TypeScript strict mode (`tsconfig.json`) and consistent patterns.
