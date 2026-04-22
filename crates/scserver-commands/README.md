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
- **`ServerMessage`** — tagged union over every documented command (63
  payload variants + 6 argless unit cases + an `Other { address, args }`
  escape hatch). Construct via `From<Cmd>` or directly:
  ```rust
  let msg: ServerMessage = BAlloc::new(0, 8192).into();
  let bytes = msg.encode()?;        // OSC wire bytes
  ServerMessage::Status.encode()?;  // unit variant
  ```
- **`commands::{ControlId, NumericValue, ControlValue}`** — the three
  polymorphic OSC arg shapes the SC protocol uses. Each has ergonomic
  `From` impls: `"freq".into()` → `ControlId::Name`, `440.0f32.into()`
  → `ControlValue::Float`.
- **`OscMessage`** — one raw OSC wire message (address + typed args).
  The low-level shape every command encodes into.
  `encode() -> Vec<u8>` via [`rosc`](https://docs.rs/rosc);
  `decode(&[u8])` is the inverse.
- **`ServerReply`** — tagged enum over every documented reply
  (`/done`, `/fail`, `/n_go`, `/status.reply`, `/tr`, …).
  `ServerReply::decode(&[u8])` dispatches on the incoming address.
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

## WIT surface

Four interfaces, mirroring the Rust modules:

- **`core`** — just the `osc-arg` variant (primitive OSC arg shape
  shared across the other interfaces).
- **`commands`** — one `x-args` record per command (63 total), plus a
  `server-message` variant that discriminates across them. A single
  exported function `encode(msg: server-message) -> list<u8>` produces
  OSC wire bytes.
- **`nrt`** — `nrt-score` resource that takes `server-message` values at
  timestamped positions and serialises to the NRT score format.
- **`replies`** — `server-reply` variant with 12 cases + typed payload
  records + `decode`.

The generated TS `.d.ts` exposes `ServerMessage` and `ServerReply` as
symmetric discriminated unions:

```ts
// scserver-commands-commands.d.ts
export type ServerMessage =
  | ServerMessageBAlloc       // { tag: 'b-alloc',  val: BAllocArgs }
  | ServerMessageSNew         // { tag: 's-new',    val: SNewArgs }
  | ServerMessageStatus       // { tag: 'status' }  (argless)
  | ServerMessageOther        // { tag: 'other',    val: { address, args } }
  | ...;
export function encode(msg: ServerMessage): Uint8Array;
```

`examples/node/roundtrip.ts` exercises this end-to-end — `commands.encode`,
NRT score assembly, and `replies.decode` round-trips.
