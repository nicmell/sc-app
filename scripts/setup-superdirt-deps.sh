#!/usr/bin/env bash
# Fetch SuperDirt's runtime dependencies into superdirt-deps/.
#
# This is the "make sc-app self-contained" step: instead of relying on
# the system's SuperCollider quark folder (which on a typical machine
# may have StrudelDirt, missing Dirt-Samples, etc.), we vendor the
# minimum needed for `yarn superdirt-only` into a single tree:
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

# Pinned sc3-plugins release. Bump this when we want a newer cut.
# We pin to a specific release URL rather than querying "latest" from
# the GitHub API so re-running setup gives the same binaries every
# time. Compat note: SC's plugin ABI is stable across minor versions,
# so 3.13.0 plugins load fine in SC 3.14.x. The matching ARM macOS
# build is bundled inside the same zip on releases that support it.
SC3_PLUGINS_TAG="Version-3.13.0"
SC3_PLUGINS_VERSION="3.13.0"

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

# ── 3. sc3-plugins (macOS pre-built; Linux via apt) ──────────────────
echo "[3/3] sc3-plugins (needed for SuperDirt global effects)"
case "$(uname -s)" in
  Darwin*)
    if [ -d "$DEPS/sc3-plugins" ]; then
      skip "already present at $DEPS/sc3-plugins"
    else
      tmp="$(mktemp -d)"
      trap 'rm -rf "$tmp"' EXIT

      url="https://github.com/supercollider/sc3-plugins/releases/download/${SC3_PLUGINS_TAG}/sc3-plugins-${SC3_PLUGINS_VERSION}-macOS.zip"
      echo "  downloading pinned release $SC3_PLUGINS_TAG"
      echo "  $url"
      curl -fsSL "$url" -o "$tmp/sc3-plugins.zip" \
        || die "download failed — check sc3-plugins releases page for current asset URL"
      unzip -q "$tmp/sc3-plugins.zip" -d "$tmp/extracted"
      inner="$(find "$tmp/extracted" -maxdepth 1 -mindepth 1 -type d | head -1)"
      [ -n "$inner" ] || die "extracted sc3-plugins zip but found no inner directory"
      mv "$inner" "$DEPS/sc3-plugins"
      # Strip macOS AppleDouble metadata (._*.scx) — not real Mach-O,
      # scsynth's -U scan logs 'slice is not valid mach-o file' for each.
      find "$DEPS/sc3-plugins" -name '._*' -delete 2>/dev/null || true
      ok "installed at $DEPS/sc3-plugins ($SC3_PLUGINS_TAG)"

      rm -rf "$tmp"
      trap - EXIT
    fi
    ;;
  Linux*)
    # sc3-plugins is a Debian package; installed binaries land in
    # scsynth's compiled-in default plugin path so no `-U` override is
    # needed when launching scsynth on Linux.
    if dpkg -s supercollider-sc3-plugins >/dev/null 2>&1; then
      ok "supercollider-sc3-plugins already installed via apt"
    else
      warn "supercollider-sc3-plugins not installed"
      warn "  install with: sudo apt install supercollider-sc3-plugins"
      warn "  (without it, global effects like delay/reverb won't work)"
    fi
    ;;
  *)
    skip "unsupported OS: skipping sc3-plugins"
    ;;
esac
echo

echo "done. Dependency tree:"
ls -1 "$DEPS"
echo
echo "next:"
echo "  yarn scsynth-only     # boot scsynth (in another terminal)"
echo "  yarn superdirt-only   # start sclang+SuperDirt against it"
