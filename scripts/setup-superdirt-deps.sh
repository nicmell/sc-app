#!/usr/bin/env bash
# Fetch SuperDirt's runtime dependencies into superdirt-deps/.
#
# This is the "make sc-app self-contained" step: instead of relying on
# the system's SuperCollider quark folder (which on a typical machine
# may have StrudelDirt, missing Dirt-Samples, etc.), we vendor the
# minimum needed for `yarn superdirt` into a single tree:
#
#   superdirt-deps/
#     Dirt-Samples/   ← audio sample library SuperDirt looks up by name
#     Vowel/          ← quark used by SuperDirt's vowel module
#     sc3-plugins/    ← UGen plugins for global effects (delay/reverb/…)
#                       optional on Linux (skip + manual install path)
#
# Idempotent — re-running skips anything already present. Safe to
# rerun after a partial failure.
#
# Wire: `yarn superdirt-setup`
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPS="$REPO_ROOT/superdirt-deps"
mkdir -p "$DEPS"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
skip() { printf '  \033[33m·\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*" >&2; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

echo "fetching SuperDirt dependencies into $DEPS"
echo

# ── 1. Dirt-Samples (git clone, ~50 MB) ──────────────────────────────
echo "[1/3] Dirt-Samples (audio sample library)"
if [ -d "$DEPS/Dirt-Samples/.git" ]; then
  skip "already present at $DEPS/Dirt-Samples"
else
  git clone --depth 1 https://github.com/tidalcycles/dirt-samples.git "$DEPS/Dirt-Samples"
  ok "cloned"
fi
echo

# ── 2. Vowel quark (git clone, tiny) ─────────────────────────────────
echo "[2/3] Vowel quark"
if [ -d "$DEPS/Vowel/.git" ]; then
  skip "already present at $DEPS/Vowel"
else
  git clone --depth 1 https://github.com/supercollider-quarks/Vowel.git "$DEPS/Vowel"
  ok "cloned"
fi
echo

# ── 3. sc3-plugins (macOS pre-built release; optional) ───────────────
echo "[3/3] sc3-plugins (optional — needed for global effects)"
case "$(uname -s)" in
  Darwin*)
    if [ -d "$DEPS/sc3-plugins" ]; then
      skip "already present at $DEPS/sc3-plugins"
    else
      tmp="$(mktemp -d)"
      trap 'rm -rf "$tmp"' EXIT

      echo "  querying GitHub for latest macOS release…"
      api_response="$(curl -fsSL https://api.github.com/repos/supercollider/sc3-plugins/releases/latest)" \
        || die "failed to query github API for sc3-plugins releases"

      # Match a macOS .zip asset; if multiple variants (arm64/x86_64) exist, take the first.
      url="$(echo "$api_response" \
        | grep -o 'https://github\.com/supercollider/sc3-plugins/releases/download/[^"]*macOS[^"]*\.zip' \
        | head -1)"

      if [ -z "$url" ]; then
        warn "no macOS release asset found — skipping sc3-plugins"
        warn "  global effects (dirt_delay, dirt_reverb, …) will not work"
        warn "  see https://github.com/supercollider/sc3-plugins/releases"
      else
        echo "  downloading $url"
        curl -fsSL "$url" -o "$tmp/sc3-plugins.zip"
        unzip -q "$tmp/sc3-plugins.zip" -d "$tmp/extracted"
        # The release zip extracts to a top-level folder. Find it and move
        # under our deps tree so the path is predictable.
        inner="$(find "$tmp/extracted" -maxdepth 1 -mindepth 1 -type d | head -1)"
        if [ -z "$inner" ]; then
          die "extracted sc3-plugins zip but found no inner directory"
        fi
        mv "$inner" "$DEPS/sc3-plugins"
        ok "installed at $DEPS/sc3-plugins"
      fi

      rm -rf "$tmp"
      trap - EXIT
    fi
    ;;
  Linux*)
    skip "Linux: sc3-plugins must be installed via your package manager"
    skip "  e.g. apt install supercollider-sc3-plugins"
    skip "  or build from source: https://github.com/supercollider/sc3-plugins"
    skip "  (without it, global effects like delay/reverb won't work)"
    ;;
  *)
    skip "unsupported OS: skipping sc3-plugins"
    ;;
esac
echo

echo "done. Dependency tree:"
ls -1 "$DEPS"
echo
echo "next: yarn superdirt"
