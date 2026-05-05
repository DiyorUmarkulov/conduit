---
description: In-process Conduit transport for tests and local dev (@theconduit/provider-inmemory).
---

# In-memory transport

**npm:** `@theconduit/provider-inmemory` · provider id **`INMEMORY`**

**In-process** transport: dispatch runs against registered handlers, with an **in-memory DLQ** — no brokers or SQL.

## When it helps

- **Unit tests / CI** without Docker or cloud services.
- **Local apps** before you add Postgres outbox or Kafka; same handlers and envelopes later.

## Minimal example

```ts
import { ConduitBuilder, EnvelopeBuilder } from "@theconduit/core";
import { InMemoryDLQManager, InMemoryProvider } from "@theconduit/provider-inmemory";

const builder = new ConduitBuilder();
builder
  .addRoute(
    builder.route("cart.add").type("COMMAND").via("INMEMORY").onExhausted("DLQ")
  )
  .registerProvider(new InMemoryProvider())
  .withDlqManager(new InMemoryDLQManager());

const bus = builder.build();

bus.registerCommandHandler("cart.add", async (env) => ({
  ok: true,
  line_count: env.payload.items.length
}));

await bus.dispatch(
  EnvelopeBuilder.command("cart.add", { items: [{ sku: "a", qty: 1 }] }).build()
);
```

## Install

```bash
pnpm add @theconduit/core @theconduit/provider-inmemory
```

## Exports

| Symbol | Role |
| --- | --- |
| `INMEMORY_PROVIDER_NAME` | Constant `"INMEMORY"` |
| `InMemoryProvider` | `ITransportProvider` implementation |
| `InMemoryDLQManager` | DLQ manager for local/dev |
| `InMemorySubscription` | Subscription helper (see package types) |

## Further reading

- [Getting started](../guides/getting-started)
- [Choosing a transport](../guides/choosing-provider)
- [Test helpers](./testing) (fake `FAKE` provider for narrower tests)
