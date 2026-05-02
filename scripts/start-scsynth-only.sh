#!/usr/bin/env bash
# Boot scsynth on UDP 57110 with SuperDirt-required server options.
# Foreground; Ctrl-C to stop.
#
# scsynth's defaults are far too small for SuperDirt — Dirt-Samples
# alone needs >1k sample buffers, the per-orbit graph needs ~256 MB
# of real-time memory, and SC 3.14's default `maxLogins = 64` exceeds
# sclang's hardcoded ≤32 cap on /notify mirroring. Without the flags
# below, sclang attaches but SuperDirt's init crashes on buffer
# allocation / memory check, leading to "Group not found" cascades
# at orbit-mount time.
#
# Flags below mirror the s.options.* block from upstream's
# superdirt_startup.scd:
#   -b 262144  — sample buffer slots
#   -m 262144  — real-time memory in KB
#   -w 2048    — wire buffer slots
#   -n 32768   — max nodes
#   -l 8       — max simultaneous logins (≤ 32 sclang cap)
#   -i 2 -o 2  — stereo in / stereo out
#
# UGen plugin path (`-U`):
#   - macOS: scsynth's compiled-in default doesn't include our
#     superdirt-deps/sc3-plugins, so we pass an explicit list
#     (stock + sc3-plugins).
#   - Linux: apt-installed sc3-plugins lives in scsynth's compiled-in
#     default plugin path, so we don't override -U.
#
# This is the dev convenience. On the Pi, scsynth runs as a systemd
# service — see scripts/sc-app-scsynth.service for a template that
# uses the same flags.
#
# Wire: `yarn scsynth-only`. Pair with `yarn superdirt-only` (sclang attaches
# + mounts SuperDirt on top of this scsynth).
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

# Pre-flight: refuse to start if something already binds UDP 57110.
# Without this, scsynth's bind() failure surfaces as
# "libc++abi: terminating" + SIGABRT — a confusing crash for what's
# usually just a leftover scsynth from a previous session.
if command -v lsof >/dev/null 2>&1; then
  occupant="$(lsof -nP -iUDP:57110 2>/dev/null | tail -n +2 | head -1 || true)"
  if [ -n "$occupant" ]; then
    pid="$(printf '%s' "$occupant" | awk '{print $2}')"
    cmd="$(printf '%s' "$occupant" | awk '{print $1}')"
    cat >&2 <<EOF
error: UDP port 57110 already in use by $cmd (pid $pid)

Kill it first:
  kill $pid
EOF
    exit 1
  fi
fi

# SuperDirt-friendly server options. Same values as upstream's
# s.options.* block; same on macOS and Linux.
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
    # apt-installed sc3-plugins (supercollider-sc3-plugins package)
    # lives in scsynth's compiled-in default plugin path — no -U
    # override needed.
    echo "starting scsynth (Linux, using compiled-in plugin path)"
    echo "  for sc3-plugins UGens: sudo apt install supercollider-sc3-plugins"
    exec scsynth "${COMMON_OPTS[@]}"
    ;;
  *)
    die "unsupported OS: $(uname -s)"
    ;;
esac
