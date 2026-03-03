#!/usr/bin/env bash
set -euo pipefail

pnpm -r publish --dry-run --no-git-checks
