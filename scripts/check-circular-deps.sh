#!/usr/bin/env bash
set -euo pipefail

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required for circular dependency checks" >&2
  exit 1
fi

npx madge --circular packages
