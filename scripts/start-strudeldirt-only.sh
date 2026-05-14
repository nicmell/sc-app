#!/usr/bin/env bash
# Run sclang and mount StrudelDirt on top of an externally-running
# scsynth. Pinned to the vendored strudeldirt/ submodule and
# superdirt-deps/ tree.
#
# StrudelDirt is a hard fork of SuperDirt adapted for the Strudel.cc
# ecosystem. It exposes the same `SuperDirt` class (identical
# constructor signature) and OSC surface as upstream SuperDirt, so
# the bridge and the `sc-startup.scd` body don't change between
# flavors — only the includePaths entry differs.
#
# scsynth must already be running on UDP 57110 — we don't manage
# its lifecycle. Launch it with:
#   - dev (Mac):   yarn scsynth-only   (foreground; Ctrl-C to stop)
#   - prod (Pi):   systemctl start sc-app-scsynth
#                  (template at scripts/sc-app-scsynth.service)
#
# We pass `-l <generated-config>` to sclang so only these paths
# contribute to the compiled class library:
#
#   <SCClassLibrary>            # SuperCollider standard library
#   strudeldirt/                # our vendored StrudelDirt (submodule)
#   superdirt-deps/Vowel        # Vowel quark (shared dep)
#   superdirt-deps/sc3-plugins  # sc3-plugins .sc class files (macOS)
#
# Anything in the user's ~/Library/.../downloaded-quarks (a
# *system-installed* SuperDirt, etc.) is invisible to this run —
# no class-name conflicts.
#
# Wire: `yarn strudeldirt-only`. Pre-reqs:
#   - `yarn superdirt-setup` (one-time, fetches deps — same deps
#                              power both flavors).
#   - scsynth running on UDP 57110 (yarn scsynth-only or systemd unit)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STRUDELDIRT="$REPO_ROOT/strudeldirt"
DEPS="$REPO_ROOT/superdirt-deps"
STARTUP="$REPO_ROOT/scripts/sc-startup.scd"

die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# ── Locate sclang + per-OS plugin paths ──────────────────────────────
if ! command -v sclang >/dev/null 2>&1; then
  cat >&2 <<EOF
error: sclang not found in PATH

Install SuperCollider (https://supercollider.github.io/) and ensure
sclang is on PATH. On macOS the binary lives at:
  /Applications/SuperCollider.app/Contents/MacOS/sclang
EOF
  exit 1
fi

case "$(uname -s)" in
  Darwin*)
    SCCLASSLIB="/Applications/SuperCollider.app/Contents/Resources/SCClassLibrary"
    ;;
  Linux*)
    if [ -d "/usr/share/SuperCollider/SCClassLibrary" ]; then
      SCCLASSLIB="/usr/share/SuperCollider/SCClassLibrary"
    elif [ -d "/usr/local/share/SuperCollider/SCClassLibrary" ]; then
      SCCLASSLIB="/usr/local/share/SuperCollider/SCClassLibrary"
    else
      die "SCClassLibrary not found — set SC_APP_CLASSLIB to override"
    fi
    ;;
  *)
    die "unsupported OS: $(uname -s)"
    ;;
esac

SCCLASSLIB="${SC_APP_CLASSLIB:-$SCCLASSLIB}"

# ── Pre-flight checks ────────────────────────────────────────────────
[ -d "$SCCLASSLIB" ] || die "SCClassLibrary not found at $SCCLASSLIB"
[ -d "$STRUDELDIRT/classes" ] || die "$STRUDELDIRT not initialised — run: git submodule update --init strudeldirt"
[ -d "$DEPS/Dirt-Samples" ] || die "Dirt-Samples missing — run: yarn superdirt-setup"
[ -d "$DEPS/Vowel" ] || die "Vowel quark missing — run: yarn superdirt-setup"
[ -f "$STARTUP" ] || die "startup file not found at $STARTUP"

# ── Generate sclang config (pinned includePaths) ─────────────────────
CONF="$(mktemp -t sc-app-sclang-conf.XXXXXX)"
trap 'rm -f "$CONF"' EXIT

{
  echo "includePaths:"
  echo "- $SCCLASSLIB"
  echo "- $STRUDELDIRT"
  echo "- $DEPS/Vowel"
  if [ -d "$DEPS/sc3-plugins" ]; then
    echo "- $DEPS/sc3-plugins"
  fi
  echo "excludePaths: []"
  echo "postInlineWarnings: false"
} > "$CONF"

# ── Banner + launch ──────────────────────────────────────────────────
echo "starting sclang (attaches to scsynth + mounts StrudelDirt)"
echo "  strudeldirt → $STRUDELDIRT"
echo "  deps → $DEPS"
echo "  attaching to scsynth at 127.0.0.1:57110 (must already be running)"
echo "  StrudelDirt → 127.0.0.1:57120 (12 orbits)"
echo "  Ctrl-C to stop sclang+StrudelDirt (scsynth survives)."

# Sample path consumed by the .scd's `~dirt.loadSoundFiles`. The
# bridge ALSO reads this env var (or falls back to
# ./superdirt-deps/Dirt-Samples relative to its CWD) to populate
# SessionInfo.dirtSamples via a disk walk.
export SC_APP_DIRT_SAMPLES="$DEPS/Dirt-Samples/*"

# Tag for the .scd's post-boot log line so the operator can tell
# which fork actually loaded (both forks postln "SuperDirt ready ..."
# because both define a class named `SuperDirt`).
export SC_APP_DIRT_FLAVOR="strudeldirt"

exec sclang -l "$CONF" "$STARTUP"
