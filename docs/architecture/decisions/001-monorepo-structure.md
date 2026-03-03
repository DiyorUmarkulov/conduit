# ADR 001: Monorepo Package Layout

## Status
Accepted

## Context
Conduit consists of a core contract layer and multiple pluggable providers. Changes often span packages and must stay version-compatible.

## Decision
Use a PNPM workspace monorepo with independent npm packages under `packages/*`.

## Consequences
- Unified CI for cross-package regressions
- Local development with workspace linking
- Clear publishing boundaries for public vs internal packages
