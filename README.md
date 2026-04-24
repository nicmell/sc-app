# SC-App — SCSynth Oscilloscope & Recorder

Browser-first web app (also packaged as a Tauri desktop app) that
drives SuperCollider's `scsynth` to render live oscilloscopes of one
or more audio buses, synchronised by a global server-side clock, with
optional sample-accurate WAV recording.

See [`plan.md`](./plan.md) for the full implementation plan.

## Prerequisites

- Rust (stable) + `cargo`
- Node 22+ and Yarn 4 (via Corepack)
- `scsynth` running on UDP `127.0.0.1:57110` at 48 kHz (not managed by
  this app — boot it yourself with e.g. `sclang`, Supernova, or
  SuperCollider's standalone `scsynth` binary)

## Run modes

### Native Tauri app (dev, with HMR)

```bash
yarn tauri dev
```

Starts the Rust backend (which hosts the WS↔UDP bridge on :3000 and
the Tauri webview), plus the Vite dev server on :1420 for the
frontend. The webview loads from :1420; frontend connects to :3000 for
OSC traffic.

### Native Tauri app (production bundle)

```bash
yarn tauri build
```

Produces a bundled desktop app under `src-tauri/target/release/bundle/`.

### Standalone HTTP server (browser mode)

Build the frontend, then start the Rust backend in `serve` mode:

```bash
yarn build
cargo run --manifest-path src-tauri/Cargo.toml -- serve
```

Defaults: port 3000, scsynth `127.0.0.1:57110`, dist dir `./dist`. All
overridable via flags or env (`SC_PORT`, `SC_SCSYNTH_ADDR`,
`SC_DIST_DIR`). Visit `http://127.0.0.1:3000/`.

### Frontend-only dev (HMR without Tauri)

Run the bridge standalone alongside `yarn dev`:

```bash
# Terminal 1 — bridge only (missing dist/ is fine, /ws still works)
cargo run --manifest-path src-tauri/Cargo.toml -- serve

# Terminal 2 — Vite dev server on :1420
yarn dev
```

Open `http://127.0.0.1:1420/`. `VITE_OSC_WS_URL` (in
`.env.development`) points the frontend's WebSocket at
`http://127.0.0.1:3000`.
