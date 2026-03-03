# CLI Guide

The `@conduit/cli` package provides operational commands for routes and DLQ.

## Commands

- `conduit init [--path conduit.config.js] [--force]`
- `conduit routes list --config conduit.config.js`
- `conduit dlq inspect --config conduit.config.js`
- `conduit dlq replay --config conduit.config.js --id <entry-id>`
- `conduit schema validate --file envelope.json`
- `conduit schema diff --left schema.v1.json --right schema.v2.json`
- `conduit migrate --dialect postgres --out ./migrations/outbox.sql`

## Config contract

`conduit.config.js` should export an object:

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
- `.js/.mjs/.cjs/.json` configs are supported directly.
- `.ts` configs must be precompiled to JS before use.
- `migrate` command generates SQL for outbox + DLQ tables from built-in migration templates.
