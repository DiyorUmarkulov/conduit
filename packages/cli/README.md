# @theconduit/cli

CLI utilities for route inspection, DLQ operations, schema checks, project init, and migration SQL generation.

## Install

```bash
pnpm add -D @theconduit/cli
```

or run directly:

```bash
pnpm exec conduit --help
```

## Commands

- `conduit init [--path <path>] [--force]`
- `conduit routes list [--config <path>] [--json]`
- `conduit dlq inspect [--config <path>] [--operation-name <name>] [--handler-id <id>] [--limit <n>] [--json]`
- `conduit dlq replay --id <entry-id> [--config <path>] [--keep] [--dry-run]`
- `conduit schema validate --file <path> [--json]`
- `conduit schema diff --left <path> --right <path> [--json]`
- `conduit migrate [--dialect postgres|mysql|sqlite] [--out <path>] [--print]`

## Config contract

`conduit.config.js` can export:

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

Notes:

- `conduit.config.js/.mjs/.cjs/.json` are supported.
- `conduit.config.ts` must be precompiled to JavaScript first.
- `migrate` command emits built-in outbox + outbox DLQ SQL templates.

## Related docs

- `docs/guides/cli.md`
- `docs/guides/outbox-provider.md`
