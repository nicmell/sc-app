#!/usr/bin/env bash
# Boot scsynth + SuperDirt via sclang.
#
# Runs the vendored superdirt/superdirt_startup.scd, which reboots
# scsynth on its default port (57110) with SuperDirt-friendly options
# (numBuffers, memSize, etc.) and then starts SuperDirt listening on
# UDP 57120 with 12 orbits.
#
# Once running:
#   - sc-app's main connect targets scsynth on 127.0.0.1:57110
#   - sc-app's Dirt panel targets SuperDirt on 127.0.0.1:57120
# Both consumers share one scsynth instance.
#
# Requires `sclang` in PATH. SuperCollider on macOS commonly installs
# it at /Applications/SuperCollider.app/Contents/MacOS/sclang — symlink
# or add to PATH if needed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STARTUP_SCD="$REPO_ROOT/superdirt/superdirt_startup.scd"

if ! command -v sclang >/dev/null 2>&1; then
  cat >&2 <<EOF
error: sclang not found in PATH

Install SuperCollider (https://supercollider.github.io/) and ensure
sclang is on PATH. On macOS the binary lives at:
  /Applications/SuperCollider.app/Contents/MacOS/sclang
EOF
  exit 1
fi

if [ ! -f "$STARTUP_SCD" ]; then
  cat >&2 <<EOF
error: $STARTUP_SCD not found

The superdirt/ submodule appears uninitialised. Run:
  git submodule update --init
EOF
  exit 1
fi

echo "starting sclang on $STARTUP_SCD"
echo "  scsynth → 127.0.0.1:57110"
echo "  SuperDirt → 127.0.0.1:57120 (12 orbits)"
echo "  Ctrl-C to stop both."
exec sclang "$STARTUP_SCD"
