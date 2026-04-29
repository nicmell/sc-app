#!/usr/bin/env bash
# Launch scsynth on UDP 57110, sized for SuperDirt + sc-app.
#
# scsynth's defaults are hopelessly small for SuperDirt — Dirt-Samples
# alone is >1k buffers, and SuperDirt's per-orbit graph uses tens of MB
# of real-time memory. Without these explicit flags, sclang+SuperDirt
# fails at buffer allocation and orbit setup:
#
#   ERROR: maxLogins should be <= 32, tried to set to 64
#   ERROR: No more buffer numbers
#   SuperDirt: not enough free memory to start
#
# Flags below mirror what the upstream superdirt_startup.scd sets via
# s.options.* before its s.reboot{}, but we apply them at scsynth's
# command line because in our workflow scsynth is user-managed and
# sclang only attaches.
#
#   -b 262144  — sample buffer slots (Dirt-Samples ≫ default 1024)
#   -m 262144  — real-time memory in KB (default 8192 is far too low)
#   -w 2048    — wire buffer slots
#   -n 32768   — max nodes
#   -l 8       — max simultaneous logins (sclang refuses values >32 to
#                 mirror, default 64 in SC 3.14 doesn't pass that gate)
#   -i 2 -o 2  — stereo in / stereo out
#
# UGen plugin path (`-U`) handling per platform:
#   - macOS: scsynth's compiled-in default doesn't include our
#     superdirt-deps/sc3-plugins, so we pass an explicit -U list
#     (stock plugins + sc3-plugins).
#   - Linux: apt-installed sc3-plugins lives in scsynth's compiled-in
#     default path (/usr/lib/SuperCollider/plugins/), so we don't
#     touch -U.
#
# Wire: `yarn scsynth`. Pair with `yarn superdirt`.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPS="$REPO_ROOT/superdirt-deps"

die() { printf 'error: %s\n' "$*" >&2; exit 1; }

if ! command -v scsynth >/dev/null 2>&1; then
  cat >&2 <<EOF
error: scsynth not found in PATH

Install SuperCollider (https://supercollider.github.io/) and ensure
scsynth is on PATH. On macOS the binary lives at:
  /Applications/SuperCollider.app/Contents/Resources/scsynth
EOF
  exit 1
fi

# SuperDirt-friendly server options. Same on macOS and Linux.
COMMON_OPTS=(-u 57110 -b 262144 -m 262144 -w 2048 -n 32768 -l 8 -i 2 -o 2)

case "$(uname -s)" in
  Darwin*)
    SC_STOCK_PLUGINS="${SC_APP_STOCK_PLUGINS:-/Applications/SuperCollider.app/Contents/Resources/plugins}"
    [ -d "$SC_STOCK_PLUGINS" ] || die "stock plugins dir not found at $SC_STOCK_PLUGINS"
    if [ -d "$DEPS/sc3-plugins" ]; then
      echo "starting scsynth (macOS, sc3-plugins from superdirt-deps/)"
      exec scsynth "${COMMON_OPTS[@]}" -U "$SC_STOCK_PLUGINS:$DEPS/sc3-plugins"
    else
      echo "starting scsynth (macOS, sc3-plugins not installed — global effects unavailable)"
      echo "  run 'yarn superdirt-setup' to install sc3-plugins"
      exec scsynth "${COMMON_OPTS[@]}"
    fi
    ;;
  Linux*)
    # apt-installed sc3-plugins (supercollider-sc3-plugins package) lives in
    # scsynth's compiled-in default plugin path — no -U override needed.
    echo "starting scsynth (Linux, using compiled-in plugin path)"
    echo "  for sc3-plugins UGens: sudo apt install supercollider-sc3-plugins"
    exec scsynth "${COMMON_OPTS[@]}"
    ;;
  *)
    die "unsupported OS: $(uname -s)"
    ;;
esac
