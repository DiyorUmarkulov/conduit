#!/usr/bin/env bash
set -euo pipefail

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to generate API docs" >&2
  exit 1
fi

npx typedoc --entryPoints packages/core/src/index.ts --out docs/api
