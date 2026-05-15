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

### Standalone bridge (browser mode)

Build the frontend, then start the Rust bridge with the bundled
dist as the static fallback:

```bash
yarn build
cargo run --manifest-path src-tauri/Cargo.toml -- bridge --dist dist
```

Defaults: port 3000, scsynth `127.0.0.1:57110`. Override via
`--port` / `--scsynth` flags or `SC_PORT` / `SC_SCSYNTH_ADDR` env
vars. Visit `http://127.0.0.1:3000/`. Inside a `tauri build`
artifact, `--dist` is unnecessary — the bridge resolves `dist/`
from the bundle's resource dir automatically. File logging is
opt-in via `--log-dir` (deploys typically pin the path from a
systemd unit).

### Browser-only dev (HMR without Tauri)

```bash
yarn dev:full
```

This runs Vite on `:1420` (frontend with HMR) and the Rust bridge
on `:3000` concurrently. Vite's `/ws` proxy forwards the WebSocket
upgrade to the bridge so the frontend uses same-origin URLs.
Open `http://127.0.0.1:1420/`.

## Sample playback (SuperDirt / StrudelDirt)

Optional. Drive scsynth's sample-playback layer from sc-app's
sequencer. Two vendored forks are available; pick one at launch.

```bash
yarn superdirt-setup      # one-time: fetches Dirt-Samples + Vowel + sc3-plugins
yarn osc                  # boots scsynth + sclang+<fork>; prompts for flavor
```

`yarn osc` accepts an explicit `--flavor` flag (or
`SC_APP_DIRT_FLAVOR` env var) to skip the interactive picker:

```bash
yarn osc --flavor superdirt
yarn osc --flavor strudeldirt
```

Both flavors expose the same `SuperDirt` class with the same OSC
surface (`/dirt/play`, port 57120), so the bridge needs no
configuration to switch between them — it just talks to whichever
fork is currently mounted. Standalone launchers are also wired:
`yarn superdirt-only` and `yarn strudeldirt-only`, both expect an
externally-running `scsynth`.

### Strudel REPL panel

Once connected, the dashboard includes a **Strudel** live-coding
panel powered by [Strudel](https://strudel.cc) — a JavaScript
reimplementation of TidalCycles. Write mini-notation patterns and
click **Run** (or press `Ctrl+Enter`). Pattern output is routed
through the same OSC bridge as the step sequencer — no extra
WebSocket or bridge configuration needed.

```
s("bd hh*2 sd hh")
note("c3 eb3 g3 bb3").s("piano").slow(2)
```

The panel lazy-loads on first use so the ~450 KB Strudel runtime
never adds to the initial page load.

> **Note:** the Strudel panel includes AGPL-3.0-licensed code from
> `@strudel/core`, `@strudel/web`, `@strudel/codemirror`, and
> related packages.

## Deployment

- **Raspberry Pi 5 (headless)** — see
  [`docs/raspberry-pi.md`](./docs/raspberry-pi.md) for the full
  install-from-scratch guide (apt + rustup + cargo build + systemd
  units). The bridge subcommand runs without GTK init, so no X
  server / xvfb is needed.
