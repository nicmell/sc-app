#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OUT_DIR="$PROJECT_DIR/src/assets/synthdefs"
mkdir -p "$OUT_DIR"
sclang "$SCRIPT_DIR/compile_synthdef.scd" "$OUT_DIR"
