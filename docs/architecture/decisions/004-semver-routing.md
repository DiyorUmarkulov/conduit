# ADR 004: Semver-Based Handler Resolution

## Status
Accepted

## Context
Multiple producer versions can coexist during rolling deploys and service migrations.

## Decision
Handlers declare semver ranges. Router resolves handlers against envelope schema versions.

## Consequences
- Safe progressive upgrades.
- Reduced need for lock-step deployments.
- Version compatibility remains explicit in registration.
