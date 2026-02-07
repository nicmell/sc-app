# Plan: Tauri v2 OSC-to-SuperCollider App

## Context

Build an example app on the existing Tauri v2 + React + TypeScript scaffold at `/Users/nicolamelloni/Projects/sc-app` that sends OSC messages over UDP to a SuperCollider (scsynth) server. The app uses **osc-js** with a custom plugin on the frontend, and **custom Tauri commands** wrapping `std::net::UdpSocket` on the Rust backend for UDP transport.

**Data flow:**
```
React UI → osc-js (encodes OSC binary) → Custom TauriPlugin
  → invoke("udp_send", { data: number[], target }) → Tauri IPC
  → Rust command → std::net::UdpSocket::send_to() → scsynth
```

---

## Step 1: Install frontend dependencies

```
yarn add osc-js
```

That's it — no plugin packages needed. The Rust side uses only the standard library.

---

## Step 2: Implement Rust UDP commands

**Modify:** `src-tauri/Cargo.toml` — no new crates needed (`std::net::UdpSocket` is in stdlib)

**Modify:** `src-tauri/src/lib.rs`

Create three Tauri commands backed by a managed `UdpSocket` stored in Tauri state:

```rust
use std::net::UdpSocket;
use std::sync::Mutex;
use tauri::State;
```

- **State:** `Mutex<Option<UdpSocket>>` managed by Tauri
- **`udp_bind(local_addr: String)`** — creates a `UdpSocket` bound to the given address (typically `"0.0.0.0:0"` for an ephemeral port), stores it in state
- **`udp_send(target: String, data: Vec<u8>)`** — takes the socket from state, calls `socket.send_to(&data, &target)`. The `data: Vec<u8>` receives a `number[]` from JS, which is exactly the OSC binary bytes
- **`udp_close()`** — drops the socket from state

This approach is simple, stateless-safe (Mutex), and handles binary data natively since `Vec<u8>` maps directly from a JS `number[]` through Tauri's IPC.

Remove the old `greet` command and handler.

---

## Step 3: Create custom osc-js plugin

**Create:** `src/osc/TauriUdpPlugin.ts`

Implements the osc-js plugin interface (5 methods):

| Method | Behavior |
|--------|----------|
| `registerNotify(fn)` | Stores event callback |
| `status()` | Returns connection status constant (-1, 0, 1, 2, 3) |
| `open(options?)` | Calls `invoke("udp_bind", { localAddr: "0.0.0.0:0" })`, fires `notify('open')` |
| `close()` | Calls `invoke("udp_close")`, fires `notify('close')` |
| `send(binary, options?)` | Converts `Uint8Array` → `Array.from(binary)`, calls `invoke("udp_send", { target, data })` |

Constructor accepts `{ targetAddress }` (default `"127.0.0.1:57110"`). The target can be changed at open-time or per-send.

---

## Step 4: Create OSC message helpers

**Create:** `src/osc/oscService.ts`

Factory functions wrapping `new OSC.Message(...)`:
- `createStatusMessage()` → `/status` (no args — scsynth ping)
- `createSynthMessage(name, nodeId, freq, amp)` → `/s_new` with default params
- `createFreeNodeMessage(nodeId)` → `/n_free`

---

## Step 5: Add osc-js TypeScript declarations

**Create:** `src/osc-js.d.ts`

Type declarations for the `osc-js` module (it ships no types): `OSC` class, `OSC.Message`, `OSC.Bundle`, status constants, and the plugin interface.

---

## Step 6: Build the React UI

**Modify:** `src/App.tsx`

Replace the template demo with:
- **Address input** — text field for scsynth address (default `127.0.0.1:57110`)
- **Connect / Disconnect** — manage OSC client lifecycle
- **"Send /status"** — ping scsynth
- **"Play Note"** — `/s_new "default"` (440Hz, amp 0.2)
- **"Free Last Node"** — `/n_free`
- **Status badge** — shows Open / Closed / etc.
- **Log panel** — dark monospace area showing timestamped sent messages and errors

---

## Step 7: Update styles

**Modify:** `src/App.css`

Add styles for connection section, control buttons, and log panel.

---

## Files summary

| Action | File | Purpose |
|--------|------|---------|
| Modify | `src-tauri/src/lib.rs` | UDP socket commands (`udp_bind`, `udp_send`, `udp_close`) via `std::net::UdpSocket` |
| Create | `src/osc/TauriUdpPlugin.ts` | Custom osc-js plugin — bridges to Rust via `invoke()` |
| Create | `src/osc/oscService.ts` | OSC message factory helpers |
| Create | `src/osc-js.d.ts` | TypeScript type declarations for osc-js |
| Modify | `src/App.tsx` | SuperCollider controller UI |
| Modify | `src/App.css` | UI styles |

No changes needed to `Cargo.toml` (stdlib only), `capabilities/default.json`, or `vite.config.ts`.

---

## Verification

1. **Build:** `yarn tauri dev` — app compiles and launches without errors
2. **Binary check:** Log bytes in `TauriUdpPlugin.send()` — `/status` should start with `[47, 115, 116, 97, 116, 117, 115, 0]` ("/status\0")
3. **Network check (no scsynth):** `nc -u -l 57110 | xxd` → click "Send /status" → verify binary arrives
4. **SC integration:** Boot scsynth → "Send /status" works → "Play Note" produces 440Hz tone → "Free Last Node" stops it
