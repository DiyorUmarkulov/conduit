# CLI Guide

`@conduit/cli` provides operational commands for route inspection, DLQ management, schema checks, and SQL migration generation.

## Install / run

```bash
pnpm add -D @theconduit/cli
pnpm exec conduit --help
```

## Commands

```bash
conduit init [--path <path>] [--force]
conduit routes list [--config <path>] [--json]
conduit dlq inspect [--config <path>] [--operation-name <name>] [--handler-id <id>] [--limit <n>] [--json]
conduit dlq replay --id <entry-id> [--config <path>] [--keep] [--dry-run]
conduit schema validate --file <path> [--json]
conduit schema diff --left <path> --right <path> [--json]
conduit migrate [--dialect postgres|mysql|sqlite] [--out <path>] [--print]
```

## Config contract

`conduit.config.js` can export object values or factories:

```js
export default {
  routes: [
    {
      operation_name: "order.create",
      operation_type: "COMMAND",
      provider: "OUTBOX",
      on_exhausted: "DLQ"
    }
  ],
  dlq_manager: async () => myDlqManager,
  dispatch: async (envelope) => bus.dispatch(envelope)
};
```

## Config resolution rules

- If `--config` is omitted, CLI checks (in order):
  - `conduit.config.js`
  - `conduit.config.mjs`
  - `conduit.config.cjs`
  - `conduit.config.json`
  - `conduit.config.ts`
- `.ts` configs are not directly executable by Node and must be precompiled to JS.

## Typical workflows

### Inspect current routes

```bash
pnpm exec conduit routes list --config ./conduit.config.js --json
```

### Inspect and replay DLQ entries

```bash
pnpm exec conduit dlq inspect --config ./conduit.config.js --limit 50
pnpm exec conduit dlq replay --config ./conduit.config.js --id <entry-id>
```

### Validate schema changes in CI

```bash
pnpm exec conduit schema validate --file ./schemas/order.create.json
pnpm exec conduit schema diff --left ./schemas/order.v1.json --right ./schemas/order.v2.json --json
```

### Generate outbox migration SQL

```bash
pnpm exec conduit migrate --dialect postgres --out ./migrations/conduit-outbox.sql
```
