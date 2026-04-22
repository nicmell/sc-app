# scserver-commands

Typed Rust encoders and parsers for the [SuperCollider server command
protocol](https://doc.sccode.org/Reference/Server-Command-Reference.html)
— the OSC messages scsynth accepts at runtime, the replies it sends
back, and the NRT (non-realtime) score file format.

## Layers

- **`commands::*`** — one typed struct per command (`SNew`, `NFree`,
  `BAlloc`, …). Required args in the constructor, optional trailing
  args editable via struct update:
  ```rust
  BAlloc { num_channels: Some(2), ..BAlloc::new(0, 8192) }.encode()?;
  ```
- **`commands::{ControlId, NumericValue, ControlValue}`** — the three
  polymorphic OSC arg shapes the SC protocol uses. Each has ergonomic
  `From` impls: `"freq".into()` → `ControlId::Name`, `440.0f32.into()`
  → `ControlValue::Float`.
- **`ServerMessage`** — one OSC message (address + typed args).
  `encode() -> Vec<u8>` produces wire bytes via
  [`rosc`](https://docs.rs/rosc); `decode(&[u8])` is the inverse.
- **`ServerReply`** — tagged enum over every documented reply
  (`/done`, `/fail`, `/n_go`, `/status.reply`, `/tr`, …).
  `ServerReply::parse(&[u8])` dispatches on the incoming address.
- **`NrtScore`** — timestamped OSC bundles, serialised to the
  length-prefixed binary file scsynth's `-N` mode consumes.

## Source of truth

`src/commands.rs` is the single source of truth for the command
surface — add / remove / tweak commands by editing it directly. When
you do, also update `wit/commands.wit` so the component bindings stay
in sync.

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
