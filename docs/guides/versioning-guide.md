# Versioning Guide

Conduit routes handlers by `schema_version` and handler `version_range` (semver).

## Envelope versioning rules

- Put version in `envelope.schema_version`.
- Follow semver semantics:
  - patch: backward-compatible fixes
  - minor: backward-compatible additions
  - major: breaking changes

## Register overlapping handler ranges during rollout

```ts
bus.registerCommandHandler("order.create", handleV1, {
  version_range: ">=1.0.0 <2.0.0"
});

bus.registerCommandHandler("order.create", handleV2, {
  version_range: ">=2.0.0 <3.0.0"
});
```

This allows mixed producers during migration windows.

## Safe rollout flow

1. Add new handler range first.
2. Roll out producers writing new `schema_version`.
3. Track version distribution in logs/metrics.
4. Remove old range after zero traffic window.

## Schema governance

Use `@conduit/schema-registry` to:

- validate payloads against JSON schema
- check compatibility (`BACKWARD`, `FULL`)
- diff schema changes in CI
