#!/usr/bin/env bash
# Unified OSC supervisor for the dev workflow.
#
# Spawns scsynth + sclang+(SuperDirt|StrudelDirt) as background
# children; the script itself stays in the foreground as the dev
# console. Ctrl-C cleans up both children via the EXIT trap.
#
# Pre-flight refuses to start if either UDP port is occupied; the
# usual cause is a leftover process from a previous session.
#
# Flavor selection:
#   --flavor superdirt|strudeldirt   CLI flag (highest precedence).
#   SC_APP_DIRT_FLAVOR=…             env var (second).
#   interactive select menu          when neither is set.
#
# Wire: `yarn osc`. Pre-reqs:
#   - `yarn superdirt-setup` (one-time, fetches Dirt-Samples + Vowel
#     + sc3-plugins on macOS — Linux installs sc3-plugins via apt;
#     both flavors share these deps).
#
# Debug variants if you want to run components separately:
#   - `yarn scsynth-only`      — boots only scsynth
#   - `yarn superdirt-only`    — attaches sclang+SuperDirt to a running scsynth
#   - `yarn strudeldirt-only`  — attaches sclang+StrudelDirt to a running scsynth
#
# Pi prod uses systemd units (sc-app-scsynth.service, plus a
# matching sc-app-superdirt.service template — see Phase 26b
# notes); start-osc.sh is the dev convenience.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPS="$REPO_ROOT/superdirt-deps"

die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# ── Flavor selection ─────────────────────────────────────────────────
# Precedence: CLI flag > env var > interactive menu.
FLAVOR="${SC_APP_DIRT_FLAVOR:-}"
while [ $# -gt 0 ]; do
  case "$1" in
    --flavor)
      shift
      [ $# -gt 0 ] || die "--flavor requires an argument (superdirt|strudeldirt)"
      FLAVOR="$1"
      shift
      ;;
    --flavor=*)
      FLAVOR="${1#--flavor=}"
      shift
      ;;
    -h|--help)
      cat <<EOF
usage: $0 [--flavor superdirt|strudeldirt]

Boots scsynth + sclang with the chosen Dirt fork. With no flag
and no SC_APP_DIRT_FLAVOR env var set, prompts interactively.
EOF
      exit 0
      ;;
    *)
      die "unknown argument: $1 (try --help)"
      ;;
  esac
done

if [ -z "$FLAVOR" ]; then
  echo "Which Dirt flavor should we boot?"
  PS3="#? "
  select choice in superdirt strudeldirt; do
    case "$choice" in
      superdirt|strudeldirt)
        FLAVOR="$choice"
        break
        ;;
      *)
        echo "  pick 1 or 2 (Ctrl-C to abort)" >&2
        ;;
    esac
  done
  # If the user EOF'd (Ctrl-D) without a valid pick, bail.
  [ -n "$FLAVOR" ] || die "no flavor selected"
fi

case "$FLAVOR" in
  superdirt|strudeldirt) ;;
  *) die "invalid flavor: $FLAVOR (expected: superdirt | strudeldirt)" ;;
esac

# Verify the chosen flavor's submodule is initialised.
case "$FLAVOR" in
  superdirt)
    [ -d "$REPO_ROOT/superdirt/classes" ] \
      || die "superdirt/ submodule not initialised — run: git submodule update --init superdirt"
    ;;
  strudeldirt)
    [ -d "$REPO_ROOT/strudeldirt/classes" ] \
      || die "strudeldirt/ submodule not initialised — run: git submodule update --init strudeldirt"
    ;;
esac

# ── Pre-flight ───────────────────────────────────────────────────────
command -v scsynth >/dev/null 2>&1 || die "scsynth not found in PATH"
command -v sclang  >/dev/null 2>&1 || die "sclang not found in PATH"
[ -d "$DEPS/Dirt-Samples" ] || die "Dirt-Samples missing — run: yarn superdirt-setup"
[ -d "$DEPS/Vowel" ]        || die "Vowel quark missing — run: yarn superdirt-setup"

# Refuse to start if either UDP port is already bound.
check_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local occ; occ="$(lsof -nP -iUDP:"$port" 2>/dev/null | tail -n +2 | head -1 || true)"
    if [ -n "$occ" ]; then
      local pid; pid="$(printf '%s' "$occ" | awk '{print $2}')"
      local cmd; cmd="$(printf '%s' "$occ" | awk '{print $1}')"
      die "UDP port $port already in use by $cmd (pid $pid). Kill it first: kill $pid"
    fi
  fi
}
check_port 57110
check_port 57120

# ── Children ─────────────────────────────────────────────────────────
SCSYNTH_OPTS=(-u 57110 -b 262144 -m 262144 -w 2048 -n 32768 -l 8 -i 2 -o 2)
case "$(uname -s)" in
  Darwin*)
    SC_STOCK_PLUGINS="${SC_APP_STOCK_PLUGINS:-/Applications/SuperCollider.app/Contents/Resources/plugins}"
    [ -d "$SC_STOCK_PLUGINS" ] || die "stock plugins dir not found at $SC_STOCK_PLUGINS"
    if [ -d "$DEPS/sc3-plugins" ]; then
      SCSYNTH_PLUGIN_ARGS=(-U "$SC_STOCK_PLUGINS:$DEPS/sc3-plugins")
    else
      SCSYNTH_PLUGIN_ARGS=()
    fi
    ;;
  Linux*)
    SCSYNTH_PLUGIN_ARGS=()
    ;;
  *)
    die "unsupported OS: $(uname -s)"
    ;;
esac

cleanup() {
  trap - EXIT INT TERM
  echo
  echo "[osc] shutting down…"
  if [ -n "${scsynth_pid:-}" ] && kill -0 "$scsynth_pid" 2>/dev/null; then
    kill "$scsynth_pid" 2>/dev/null || true
  fi
  if [ -n "${sclang_pid:-}" ]  && kill -0 "$sclang_pid"  2>/dev/null; then
    kill "$sclang_pid"  2>/dev/null || true
  fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[osc] starting scsynth on UDP 57110…"
scsynth "${SCSYNTH_OPTS[@]}" "${SCSYNTH_PLUGIN_ARGS[@]}" &
scsynth_pid=$!

# Give scsynth a moment to bind before sclang tries to attach.
# sc-startup.scd has its own retry loop too, but
# starting it after a brief gap keeps the post-window readable.
sleep 1

case "$FLAVOR" in
  superdirt)
    echo "[osc] starting sclang+SuperDirt (attaches to scsynth)…"
    "$REPO_ROOT/scripts/start-superdirt-only.sh" &
    ;;
  strudeldirt)
    echo "[osc] starting sclang+StrudelDirt (attaches to scsynth)…"
    "$REPO_ROOT/scripts/start-strudeldirt-only.sh" &
    ;;
esac
sclang_pid=$!

echo "[osc] both running. Ctrl-C to stop."
echo "  scsynth   pid=$scsynth_pid (UDP 57110)"
echo "  sclang    pid=$sclang_pid  (UDP 57120, $FLAVOR mounted)"

# Wait for either child to exit. If one dies the trap cleans up the
# other; the script itself exits with the dead child's status.
wait -n "$scsynth_pid" "$sclang_pid"
exit $?
