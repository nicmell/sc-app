# Installing sc-app on a Raspberry Pi 5

End-to-end guide: from a blank Raspberry Pi 5 running Raspberry Pi
OS to a headless `sc-app bridge` running under systemd, served at
`http://<pi-ip>:3000/` to any browser on the LAN.

> **Why headless?** sc-app's `bridge` subcommand is a plain
> tokio + axum process — no `tauri::Builder`, no GTK init. It runs
> as a clean systemd daemon without an X server. The Tauri GUI mode
> isn't useful on a headless Pi, so this guide skips bundling the
> .deb/AppImage entirely and installs from a `cargo build --release`.

---

## 0. Hardware + OS assumptions

- **Raspberry Pi 5**, 4 GB or 8 GB RAM. (4 GB is enough — the build
  peaks at ~1.5 GB.)
- **Raspberry Pi OS 64-bit** (Bookworm or Trixie). 32-bit OS is not
  supported for our toolchain — Pi 5 + 32-bit is unusual anyway.
- **scsynth** runs *on the Pi* in this guide. Make sure a USB or
  HDMI audio device is attached and that the user running scsynth
  is in the `audio` group (default for the `pi` user).
- The Pi has internet access during install (apt + cargo + git).

The rest of this guide assumes you're logged in as a non-root user
(default `pi`) and have `sudo` rights.

---

## 1. System packages

```bash
sudo apt update
sudo apt install -y \
  git curl pkg-config build-essential libssl-dev \
  libwebkit2gtk-4.1-dev libsoup-3.0-dev libgtk-3-dev librsvg2-dev \
  supercollider-server jackd2
```

What this gets you:

- `build-essential`, `pkg-config`, `libssl-dev` — Rust crate build deps.
- `libwebkit2gtk-4.1-dev` + GTK/SOUP/RSVG — required at *build* time
  by the `tauri` crate even though headless mode never opens a
  webview. They're not loaded at runtime when only `bridge` is
  invoked, but the binary must still link against them.
- `supercollider-server` — provides `scsynth` (no sclang / IDE, just
  the audio server). Pulls JACK and a default plugin set.
- `jackd2` — JACK audio server. scsynth uses it on Linux.

> If `apt` complains that `libwebkit2gtk-4.1-dev` is unavailable,
> you're probably on an older Raspberry Pi OS where the package is
> named `libwebkit2gtk-4.0-dev`. Either upgrade to the current
> Raspberry Pi OS release or pin Tauri to the 4.0-compatible
> versions (not covered here).

---

## 2. Node.js (for the frontend build)

The frontend is built once on the Pi (or on your dev box and
copied — see §6). Yarn 4 needs Node ≥ 18.12; Raspberry Pi OS's
default `nodejs` is too old, so use NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable
node --version    # should report v20.x
yarn --version    # should report 4.x once corepack picks it up from package.json
```

`corepack` ships with Node 20 and reads the `packageManager` field
from `package.json` to download the exact yarn version pinned by
the project.

---

## 3. Rust toolchain

Install via `rustup`:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
rustc --version    # should report 1.7x or newer
```

The toolchain installs to `~/.cargo/` and `~/.rustup/`. `cargo` is
on `$PATH` after `source $HOME/.cargo/env` (or after the next login
via `~/.profile`).

---

## 4. Clone and build sc-app

```bash
cd ~
git clone https://github.com/nicmell/sc-app.git
cd sc-app

yarn install
yarn build                              # produces dist/ — the SPA bundle

cargo build --release \
  --manifest-path src-tauri/Cargo.toml  # produces the bridge binary
```

Build times on a Pi 5: ~30 s for `yarn install`, ~10 s for
`yarn build`, **~6–8 min** for the first `cargo build --release`
(subsequent rebuilds are incremental).

After this:

| Path | Size | Purpose |
|---|---:|---|
| `~/sc-app/dist/` | ~5 MB | Static frontend (HTML, JS, CSS, fonts) |
| `~/sc-app/src-tauri/target/release/sc-app` | ~25–35 MB | Stripped release binary |

You can run a smoke test from the build tree:

```bash
./src-tauri/target/release/sc-app bridge --dist dist --port 3000
```

Open `http://<pi-ip>:3000/` from a browser on another machine on
the same LAN. Hit Connect — if scsynth is already running (next
step), the dashboard should come up. `Ctrl-C` to stop.

---

## 5. Install to system locations

We'll put the binary in `/usr/local/bin/`, the static assets in
`/usr/local/share/sc-app/dist/`, and create a dedicated `sc-app`
system user that owns the log directory.

```bash
# Dedicated user — no shell, no home dir on disk; just an identity
# for the systemd unit to drop privileges to.
sudo useradd --system --no-create-home --shell /usr/sbin/nologin sc-app
# Audio group lets it open /dev/snd/* (relevant only if sc-app ever
# needs to ship audio itself; harmless).
sudo usermod -aG audio sc-app

# Binary
sudo install -m 0755 \
  src-tauri/target/release/sc-app /usr/local/bin/sc-app

# Static assets
sudo install -d -m 0755 /usr/local/share/sc-app
sudo cp -r dist /usr/local/share/sc-app/dist

# Log dir
sudo install -d -o sc-app -g sc-app -m 0755 /var/log/sc-app
```

That's the entire layout — five files/dirs the install puts on
disk (see §8 for the summary table).

---

## 6. Alternative: build on your dev box, copy the artifacts

If you'd rather not build on the Pi, you can build on a Linux x86_64
host (cross-compile to ARM64) and `scp` the result. This skips the
Pi-side build deps from §1 (`libwebkit2gtk-4.1-dev` and friends) —
you only need them on the build host.

Cross-compile from an x86_64 Debian/Ubuntu host:

```bash
# On the dev host
rustup target add aarch64-unknown-linux-gnu
sudo apt install gcc-aarch64-linux-gnu

cargo build --release --target aarch64-unknown-linux-gnu \
  --manifest-path src-tauri/Cargo.toml

scp src-tauri/target/aarch64-unknown-linux-gnu/release/sc-app pi@pi5:~/
scp -r dist pi@pi5:~/
```

Then on the Pi run the §5 install steps using the copied files
instead of the build-tree paths. macOS hosts can't easily
cross-compile to ARM64 Linux without Docker; use the Pi-build path
in §4 or set up a Linux VM.

---

## 7. systemd units

Two services: scsynth (the audio server) and sc-app-bridge (the
WS↔UDP bridge + static asset server).

### 7a. scsynth.service

scsynth needs JACK, so we let JACK come up first via the user
session bus or a system-level JACK service. The simplest setup
on a single-user Pi is **`pi` runs JACK + scsynth**, and `sc-app`
just talks to scsynth over UDP/127.0.0.1 — no audio rights needed
on the bridge user. So this unit runs as `pi`, not `sc-app`.

Create `/etc/systemd/system/scsynth.service`:

```ini
[Unit]
Description=SuperCollider scsynth audio server
After=network.target sound.target

[Service]
Type=simple
User=pi
Group=audio
# JACK starts on demand via dbus; scsynth's JACK driver attaches.
Environment=JACK_NO_AUDIO_RESERVATION=1
ExecStart=/usr/bin/scsynth -u 57110 \
  -b 262144 -m 262144 -w 2048 -n 32768 -i 2 -o 2
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Flag rationale:
- `-u 57110` — UDP port for OSC.
- `-b 262144` — buffer count. Default 1024 is too small if you ever
  push the app hard.
- `-m 262144` — server memory (kB).
- `-w 2048` — wire buffers.
- `-n 32768` — node count.
- `-i 2 -o 2` — 2 in, 2 out audio channels. Adjust to your USB
  audio device.

### 7b. sc-app-bridge.service

Create `/etc/systemd/system/sc-app-bridge.service`:

```ini
[Unit]
Description=sc-app WS bridge + static asset server
After=network.target scsynth.service
Wants=scsynth.service

[Service]
Type=simple
User=sc-app
Group=sc-app
Environment=RUST_LOG=info,sc_app_lib=info
ExecStart=/usr/local/bin/sc-app bridge \
  --port 3000 \
  --scsynth 127.0.0.1:57110 \
  --dist /usr/local/share/sc-app/dist \
  --log-dir /var/log/sc-app
Restart=on-failure
RestartSec=5

# Hardening — bridge has no reason to write outside /var/log/sc-app.
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/sc-app
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### 7c. Enable and start

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now scsynth.service
sudo systemctl enable --now sc-app-bridge.service

# Verify
sudo systemctl status scsynth.service sc-app-bridge.service
sudo journalctl -u sc-app-bridge.service -f    # follow live
```

The bridge logs to both stderr (visible via `journalctl`) and the
daily-rotated NDJSON file at
`/var/log/sc-app/sc-app.log.<YYYY-MM-DD>`.

---

## 8. Where everything lives

After install, here's the complete file map:

| Path | Owner | Source |
|---|---|---|
| `/usr/local/bin/sc-app` | root:root | `cargo build --release` output |
| `/usr/local/share/sc-app/dist/` | root:root | `yarn build` output |
| `/var/log/sc-app/` | sc-app:sc-app | created by `install -d` |
| `/var/log/sc-app/sc-app.log.<YYYY-MM-DD>` | sc-app:sc-app | written by the bridge (daily rotation) |
| `/etc/systemd/system/scsynth.service` | root:root | created in §7a |
| `/etc/systemd/system/sc-app-bridge.service` | root:root | created in §7b |
| `~/.cargo/`, `~/.rustup/` | pi:pi | rustup install (build-time only; safe to delete after install if you only deploy and don't rebuild) |
| `~/sc-app/` | pi:pi | source checkout (build-time only; safe to keep for in-place rebuilds, or delete after copying artifacts) |
| `/etc/alternatives/scsynth → /usr/bin/scsynth` | root:root | provided by `supercollider-server` apt package |

Runtime ports:

| Port | Proto | Service |
|---|---|---|
| 57110/UDP | OSC | scsynth |
| 3000/TCP | HTTP+WS | sc-app bridge |

---

## 9. Updating

```bash
cd ~/sc-app
git pull
yarn install                # if package.json changed
yarn build
cargo build --release --manifest-path src-tauri/Cargo.toml

sudo install -m 0755 src-tauri/target/release/sc-app /usr/local/bin/sc-app
sudo rm -rf /usr/local/share/sc-app/dist
sudo cp -r dist /usr/local/share/sc-app/dist

sudo systemctl restart sc-app-bridge.service
```

The bridge restart is hot — clients reconnect via `pagehide` /
manual reload. scsynth doesn't need restarting unless its config
changed.

---

## 10. Uninstall

```bash
sudo systemctl disable --now sc-app-bridge.service scsynth.service
sudo rm /etc/systemd/system/sc-app-bridge.service
sudo rm /etc/systemd/system/scsynth.service
sudo systemctl daemon-reload

sudo rm /usr/local/bin/sc-app
sudo rm -rf /usr/local/share/sc-app
sudo rm -rf /var/log/sc-app
sudo userdel sc-app

# Optional — remove apt packages and toolchains:
sudo apt purge -y supercollider-server jackd2 \
  libwebkit2gtk-4.1-dev libsoup-3.0-dev libgtk-3-dev librsvg2-dev
sudo apt autoremove -y
rustup self uninstall          # interactive
```

---

## Troubleshooting

- **`scsynth: command not found`** — apt package is `supercollider`
  on some distros, `supercollider-server` on Raspberry Pi OS. Try
  `sudo apt install supercollider`.
- **scsynth fails with `Cannot connect to JACK`** — JACK isn't
  running. `sudo systemctl status jack` or set
  `JACK_DEFAULT_SERVER` / start jackd manually. On Pi OS, JACK 2's
  dbus mode usually starts on demand; if not, install
  `pulseaudio-module-jack` or run `jackd -d alsa` first.
- **Webview mode tries to start by accident** — make sure your
  systemd unit invokes `sc-app bridge`, not `sc-app` with no
  subcommand. The latter starts `Builder::run()` which calls
  `gtk::init()` and fails on a headless host.
- **Frontend connects but `Connect` button hangs** — scsynth isn't
  reachable on `127.0.0.1:57110`. Check `nc -uz 127.0.0.1 57110`
  and `journalctl -u scsynth.service`.
- **Browser shows "WebSocket failed"** — likely the `--dist` flag
  is missing or pointing at a stale path; the bridge serves only
  `/ws` and the browser couldn't load the SPA in the first place.
  `curl http://<pi-ip>:3000/` should return HTML.

---

## What this guide skips

- Building the full Tauri `.deb` / AppImage — not useful headless,
  pulls in webkit + GTK at runtime for nothing.
- TLS / reverse proxy — for LAN-only use the plain HTTP listener
  is fine. If you want to expose the bridge externally, put nginx
  or Caddy in front and let it handle TLS + WS upgrades.
- Multi-user setup with separate sc-app users per browser session
  — not currently supported (the bridge has one default scsynth
  target; clients can override per-WS via `?scsynth=HOST:PORT`).
