#!/usr/bin/env bash
# Run sclang to attach to a running scsynth and start SuperDirt on
# UDP 57120. Pinned to the vendored superdirt/ submodule and
# superdirt-deps/ tree.
#
# scsynth must already be running (we don't manage its lifecycle —
# sc-app may already be connected, and rebooting would kill that).
# Start scsynth either via `yarn scsynth` (which sets -U with
# sc3-plugins for global effects) or directly via `scsynth -u 57110`.
#
# We pass `-l <generated-config>` to sclang so only these paths
# contribute to the compiled class library:
#
#   <SCClassLibrary>          # SuperCollider standard library
#   superdirt/                # our vendored SuperDirt (submodule)
#   superdirt-deps/Vowel      # Vowel quark (SuperDirt dep)
#   superdirt-deps/sc3-plugins  # sc3-plugins .sc class files
#
# Anything in the user's ~/Library/.../downloaded-quarks (StrudelDirt,
# etc.) is invisible to this run — no class-name conflicts.
#
# Wire: `yarn superdirt`. Pre-reqs:
#   - `yarn superdirt-setup` (one-time, fetches deps)
#   - scsynth running (yarn scsynth, or scsynth -u 57110)
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
    ;;
  Linux*)
    if [ -d "/usr/share/SuperCollider/SCClassLibrary" ]; then
      SCCLASSLIB="/usr/share/SuperCollider/SCClassLibrary"
    elif [ -d "/usr/local/share/SuperCollider/SCClassLibrary" ]; then
      SCCLASSLIB="/usr/local/share/SuperCollider/SCClassLibrary"
    else
      die "SCClassLibrary not found — set SC_APP_CLASSLIB env var to override"
    fi
    ;;
  *)
    die "unsupported OS: $(uname -s)"
    ;;
esac

# Allow override (e.g. for non-default install paths).
SCCLASSLIB="${SC_APP_CLASSLIB:-$SCCLASSLIB}"

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
echo "  attaching to scsynth at 127.0.0.1:57110 (must be running)"
echo "  SuperDirt → 127.0.0.1:57120 (12 orbits)"
echo "  Ctrl-C to stop sclang+SuperDirt (scsynth survives)."

# Sample path passes through env var; the .scd reads it via "VAR".getenv.
# scsynth's plugin path (`-U` flag) is scsynth's concern — not threaded
# through here. Use scripts/start-scsynth.sh (yarn scsynth) to launch
# scsynth with sc3-plugins included, or pass `-U <paths>` yourself.
export SC_APP_DIRT_SAMPLES="$DEPS/Dirt-Samples/*"

exec sclang -l "$CONF" "$STARTUP"
