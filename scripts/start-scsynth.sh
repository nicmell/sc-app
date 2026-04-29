#!/usr/bin/env bash
# Launch scsynth on UDP 57110 with sc3-plugins included on its UGen
# search path (`-U`), so SuperDirt's global-effect synthdefs (which
# reference SwitchDelay, MdaPiano, FM7, etc.) actually load.
#
# This is a convenience wrapper. You can equivalently run scsynth
# yourself:
#   scsynth -u 57110 -U <SC.app>/Contents/Resources/plugins:<path>/superdirt-deps/sc3-plugins
#
# If sc3-plugins isn't installed (yarn superdirt-setup skipped or
# failed), this falls back to plain `scsynth -u 57110` and warns
# that global effects won't work.
#
# Wire: `yarn scsynth`. Pair with `yarn superdirt` (which attaches
# sclang + SuperDirt to this scsynth).
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

# Stock plugins path — must be passed alongside sc3-plugins because
# scsynth's `-U` flag REPLACES the compiled-in default search path.
case "$(uname -s)" in
  Darwin*)
    SC_STOCK_PLUGINS="/Applications/SuperCollider.app/Contents/Resources/plugins"
    ;;
  Linux*)
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

SC_STOCK_PLUGINS="${SC_APP_STOCK_PLUGINS:-$SC_STOCK_PLUGINS}"
[ -d "$SC_STOCK_PLUGINS" ] || die "stock plugins dir not found at $SC_STOCK_PLUGINS"

if [ -d "$DEPS/sc3-plugins" ]; then
  PLUGIN_PATH="$SC_STOCK_PLUGINS:$DEPS/sc3-plugins"
  echo "starting scsynth -u 57110 with sc3-plugins"
  echo "  -U $PLUGIN_PATH"
  exec scsynth -u 57110 -U "$PLUGIN_PATH"
else
  echo "starting scsynth -u 57110 (sc3-plugins not installed — global effects unavailable)"
  echo "  run 'yarn superdirt-setup' to install sc3-plugins"
  exec scsynth -u 57110
fi
