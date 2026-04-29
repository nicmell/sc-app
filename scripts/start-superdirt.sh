#!/usr/bin/env bash
# Boot scsynth + SuperDirt via sclang, pinned to the vendored
# superdirt/ submodule and superdirt-deps/ tree.
#
# sclang owns scsynth's lifecycle: `s.reboot { ... }` in the startup
# .scd sends /quit to any existing scsynth on 57110, then boots a
# fresh one with SuperDirt-required options. sc-app connects to that
# scsynth as a normal OSC client.
#
# We pass `-l <generated-config>` to sclang so only these paths
# contribute to the compiled class library:
#
#   <SCClassLibrary>            # SuperCollider standard library
#   superdirt/                  # our vendored SuperDirt (submodule)
#   superdirt-deps/Vowel        # Vowel quark (SuperDirt dep)
#   superdirt-deps/sc3-plugins  # sc3-plugins .sc class files (macOS)
#
# Anything in the user's ~/Library/.../downloaded-quarks (StrudelDirt,
# etc.) is invisible to this run — no class-name conflicts.
#
# Wire: `yarn superdirt`. Pre-req: `yarn superdirt-setup` (one-time).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPERDIRT="$REPO_ROOT/superdirt"
DEPS="$REPO_ROOT/superdirt-deps"
STARTUP="$REPO_ROOT/scripts/sc-app-superdirt-startup.scd"

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
    SC_STOCK_PLUGINS="/Applications/SuperCollider.app/Contents/Resources/plugins"
    ;;
  Linux*)
    if [ -d "/usr/share/SuperCollider/SCClassLibrary" ]; then
      SCCLASSLIB="/usr/share/SuperCollider/SCClassLibrary"
    elif [ -d "/usr/local/share/SuperCollider/SCClassLibrary" ]; then
      SCCLASSLIB="/usr/local/share/SuperCollider/SCClassLibrary"
    else
      die "SCClassLibrary not found — set SC_APP_CLASSLIB to override"
    fi
    SC_STOCK_PLUGINS=""
    ;;
  *)
    die "unsupported OS: $(uname -s)"
    ;;
esac

SCCLASSLIB="${SC_APP_CLASSLIB:-$SCCLASSLIB}"
SC_STOCK_PLUGINS="${SC_APP_STOCK_PLUGINS:-$SC_STOCK_PLUGINS}"

# ── Pre-flight checks ────────────────────────────────────────────────
[ -d "$SCCLASSLIB" ] || die "SCClassLibrary not found at $SCCLASSLIB"
[ -d "$SUPERDIRT/classes" ] || die "$SUPERDIRT not initialised — run: git submodule update --init"
[ -d "$DEPS/Dirt-Samples" ] || die "Dirt-Samples missing — run: yarn superdirt-setup"
[ -d "$DEPS/Vowel" ] || die "Vowel quark missing — run: yarn superdirt-setup"
[ -f "$STARTUP" ] || die "startup file not found at $STARTUP"

# ── Generate sclang config (pinned includePaths) ─────────────────────
CONF="$(mktemp -t sc-app-sclang-conf.XXXXXX)"
trap 'rm -f "$CONF"' EXIT

{
  echo "includePaths:"
  echo "- $SCCLASSLIB"
  echo "- $SUPERDIRT"
  echo "- $DEPS/Vowel"
  if [ -d "$DEPS/sc3-plugins" ]; then
    echo "- $DEPS/sc3-plugins"
  fi
  echo "excludePaths: []"
  echo "postInlineWarnings: false"
} > "$CONF"

# ── Banner + launch ──────────────────────────────────────────────────
echo "starting sclang (boots scsynth + mounts SuperDirt)"
echo "  superdirt → $SUPERDIRT"
echo "  deps → $DEPS"
if [ ! -d "$DEPS/sc3-plugins" ] && [ "$(uname -s)" = "Darwin" ]; then
  echo "  (sc3-plugins not installed — global effects unavailable)"
fi
echo "  scsynth → 127.0.0.1:57110 (managed by sclang)"
echo "  SuperDirt → 127.0.0.1:57120 (12 orbits)"
echo "  Ctrl-C to stop both."

# Env vars consumed by the .scd. Sample path always set; plugin paths
# only on macOS where sc3-plugins lives outside scsynth's compiled-in
# default plugin path.
export SC_APP_DIRT_SAMPLES="$DEPS/Dirt-Samples/*"
if [ -n "$SC_STOCK_PLUGINS" ] && [ -d "$DEPS/sc3-plugins" ]; then
  export SC_APP_STOCK_PLUGINS_PATH="$SC_STOCK_PLUGINS"
  export SC_APP_SC3_PLUGINS_PATH="$DEPS/sc3-plugins"
fi

exec sclang -l "$CONF" "$STARTUP"
