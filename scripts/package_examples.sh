#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXAMPLES_DIR="$(dirname "$SCRIPT_DIR")/examples"
OUT_DIR="${1:-./out}"
mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"

for dir in "$EXAMPLES_DIR"/*/; do
  name=$(basename "$dir")
  out="$OUT_DIR/$name.zip"
  rm -f "$out"
  (cd "$dir" && zip -r "$out" . -x '.*')
  echo "  $name.zip"
done

echo "Done. Zips written to $OUT_DIR"
