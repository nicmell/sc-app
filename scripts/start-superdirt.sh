#!/usr/bin/env bash
# Boot scsynth + SuperDirt via sclang, pinned to the vendored
# superdirt/ submodule and superdirt-deps/ tree.
#
# We pass `-l <generated-config>` to sclang so only these paths
# contribute to the compiled class library:
#
#   <SCClassLibrary>          # SuperCollider standard library
#   superdirt/                # our vendored SuperDirt (submodule)
#   superdirt-deps/Vowel      # Vowel quark (SuperDirt dep)
#   superdirt-deps/sc3-plugins  # optional UGens for global effects
#
# Anything in the user's ~/Library/.../downloaded-quarks (StrudelDirt,
# etc.) is invisible to this run — no class-name conflicts.
#
# Once running:
#   - sc-app's main connect targets scsynth on 127.0.0.1:57110
#   - sc-app's Dirt panel targets SuperDirt on 127.0.0.1:57120
# Both consumers share one scsynth instance.
#
# Wire: `yarn superdirt`. Pre-req: `yarn superdirt-setup` (one-time).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUPERDIRT="$REPO_ROOT/superdirt"
DEPS="$REPO_ROOT/superdirt-deps"
STARTUP="$REPO_ROOT/scripts/sc-app-superdirt-startup.scd"

die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# ── Locate sclang + SCClassLibrary ───────────────────────────────────
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
      die "SCClassLibrary not found — set SC_APP_CLASSLIB env var to override"
    fi
    if [ -d "/usr/lib/SuperCollider/plugins" ]; then
      SC_STOCK_PLUGINS="/usr/lib/SuperCollider/plugins"
    elif [ -d "/usr/local/lib/SuperCollider/plugins" ]; then
      SC_STOCK_PLUGINS="/usr/local/lib/SuperCollider/plugins"
    else
      SC_STOCK_PLUGINS=""
    fi
    ;;
  *)
    die "unsupported OS: $(uname -s)"
    ;;
esac

# Allow override (e.g. for non-default install paths).
SCCLASSLIB="${SC_APP_CLASSLIB:-$SCCLASSLIB}"
SC_STOCK_PLUGINS="${SC_APP_STOCK_PLUGINS:-$SC_STOCK_PLUGINS}"

# ── Pre-flight checks ────────────────────────────────────────────────
[ -d "$SCCLASSLIB" ] || die "SCClassLibrary not found at $SCCLASSLIB"
[ -d "$SUPERDIRT/classes" ] || die "$SUPERDIRT not initialised — run: git submodule update --init"
[ -d "$DEPS/Dirt-Samples" ] || die "Dirt-Samples missing — run: yarn superdirt-setup"
[ -d "$DEPS/Vowel" ] || die "Vowel quark missing — run: yarn superdirt-setup"
[ -f "$STARTUP" ] || die "startup file not found at $STARTUP"

# ── Generate sclang config ───────────────────────────────────────────
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
echo "starting sclang on $STARTUP"
echo "  sclang config → $CONF"
echo "  superdirt → $SUPERDIRT"
echo "  deps → $DEPS"
if [ ! -d "$DEPS/sc3-plugins" ]; then
  echo "  (sc3-plugins not installed — global effects unavailable)"
fi
echo "  scsynth → 127.0.0.1:57110"
echo "  SuperDirt → 127.0.0.1:57120 (12 orbits)"
echo "  Ctrl-C to stop both."

# Sample path passes through env var; the .scd reads it via "VAR".getenv
export SC_APP_DIRT_SAMPLES="$DEPS/Dirt-Samples/*"

# Plugin search path for scsynth (the audio server, distinct from
# sclang's class library). sc3-plugins ships UGen .scx binaries
# alongside .sc class files; sclang found them via includePaths but
# scsynth needs them on its `-U` flag too. The .scd builds
# `s.options.ugenPluginsPath = [stock, sc3-plugins]` if BOTH env vars
# are set; otherwise it leaves the option at default and scsynth uses
# its compiled-in plugin paths (stock UGens only — global effects
# like delay/reverb won't work, sample playback will).
if [ -n "$SC_STOCK_PLUGINS" ] && [ -d "$DEPS/sc3-plugins" ]; then
  export SC_APP_STOCK_PLUGINS_PATH="$SC_STOCK_PLUGINS"
  export SC_APP_SC3_PLUGINS_PATH="$DEPS/sc3-plugins"
fi

exec sclang -l "$CONF" "$STARTUP"
