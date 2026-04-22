# scserver-commands

Typed Rust encoders and parsers for the [SuperCollider server command
protocol](https://doc.sccode.org/Reference/Server-Command-Reference.html)
— the OSC messages scsynth accepts at runtime, the replies it sends
back, and the NRT (non-realtime) score file format.

Design sibling to
[`scsynthdef-compiler`](../scsynthdef-compiler/README.md): curated JSON
catalogue → generator → typed Rust builders + Component Model WIT +
jco-friendly TypeScript bindings.

## Layers

- **`ServerMessage`** — one OSC message (address + typed args).
  `encode() -> Vec<u8>` produces wire bytes via
  [`rosc`](https://docs.rs/rosc); `decode(&[u8])` is the inverse.
- **`ServerReply`** — tagged enum over every documented reply
  (`/done`, `/fail`, `/n_go`, `/status.reply`, `/tr`, …).
  `ServerReply::parse(&[u8])` dispatches on the incoming address.
- **`builders::*`** — one typed struct per command, generated from
  `src/assets/commands/*.json`. Required args in the constructor,
  optional trailing args editable via struct update:
  ```rust
  BAlloc { num_channels: Some(2), ..BAlloc::new(0, 8192) }.encode()?;
  ```
- **`args::{ControlId, NumericValue, ControlValue}`** — the three
  polymorphic OSC arg shapes the registry uses. Each has ergonomic
  `From` impls: `"freq".into()` → `ControlId::Name`, `440.0f32.into()`
  → `ControlValue::Float`.
- **`NrtScore`** — timestamped OSC bundles, serialised to the
  length-prefixed binary file scsynth's `-N` mode consumes.

## Regeneration

The entire typed surface comes from one JSON catalogue. A single
script emits builders, the WIT `commands` interface, and the
component Guest forwarders:

```bash
# from the crate root
node scripts/generate.mjs
```

It writes:
- `src/builders/<category>.rs` + `src/builders/mod.rs`
- `wit/commands.wit`
- `src/component_commands.rs`

The catalogue itself (`src/assets/commands/*.json`) is the source of
truth — hand-maintained; seed-scraped from the SC docs at project
start.

## Build targets

Native Rust + tests:

```bash
cargo build -p scserver-commands
cargo test  -p scserver-commands
```

WebAssembly Component + TS bindings (same toolchain as
scsynthdef-compiler):

```bash
cd crates/scserver-commands
cargo component build --release --features component --target wasm32-wasip1
jco transpile ../../target/wasm32-wasip1/release/scserver_commands.wasm -o pkg
```

The WIT world exports three interfaces:

- `core` — `osc-arg` + `server-message` resource + `decode-message` +
  `nrt-score` resource.
- `commands` — 64 typed `<cmd>: func(args: <cmd>-args) -> server-message`
  (plus the three polymorphic arg variants).
- `replies` — `server-reply` variant with 12 cases + typed payload
  records + `parse-reply`.

Two Node smoke tests under `examples/node/` exercise the jco-generated
bindings end-to-end.
