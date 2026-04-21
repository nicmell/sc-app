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

- **`ServerCommand`** — tagged union over every documented command,
  with typed args per variant. `encode() -> Vec<u8>` produces OSC wire
  bytes via [`rosc`](https://docs.rs/rosc); `decode(&[u8])` is the
  inverse.
- **`ServerReply`** — same shape for replies (`/done`, `/fail`,
  `/n_go`, `/status.reply`, `/tr`, `/b_info`, …).
- **`builders::*`** — one fluent struct per command, generated from
  the JSON catalogue. `SNew::new("sine").target(0, AddAction::Head).control("freq", 440).encode()`.
- **`nrt`** — NRT score builder: timestamped bundles, emitted as the
  length-prefixed binary file format that scsynth's `-N` mode reads.

## Source of truth

`src/assets/commands/*.json` is produced by
`scripts/scrape_server_commands.mjs` (hand-maintainable after the
initial scrape). One JSON file per category (master, node, synth,
group, buffer, control, synthdef, unit, nrt, replies).

## Regeneration

```bash
# 1. Refresh the catalogue from the SC docs (rare):
node scripts/scrape_server_commands.mjs

# 2. Regenerate the Rust registry + typed builders:
node scripts/generate_server_commands_rust.mjs

# 3. Regenerate the WIT interface:
node scripts/generate_server_commands_wit.mjs
```

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
