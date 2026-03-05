# Getting Started

This guide shows the smallest usable Conduit setup and how to evolve it.

## Prerequisites

- Node.js `>=20.11.0`
- `pnpm` (workspace uses `pnpm@9`)

## 1. Install and check workspace

```bash
pnpm install
pnpm typecheck
pnpm test
```

## 2. Wire your first bus

```ts
import { ConduitBuilder, EnvelopeBuilder } from "@conduit/core";
import { InMemoryDLQManager, InMemoryProvider } from "@conduit/provider-inmemory";

const builder = new ConduitBuilder();

builder
  .addRoute(
    builder
      .route("order.create")
      .type("COMMAND")
      .via("INMEMORY")
      .withRetry({
        attempts: 3,
        strategy: "EXPONENTIAL",
        initial_delay_ms: 25,
        max_delay_ms: 500,
        jitter: "FULL"
      })
      .onExhausted("DLQ")
  )
  .registerProvider(new InMemoryProvider())
  .withDlqManager(new InMemoryDLQManager())
  .withProductionDefaults();

const bus = builder.build();
```

## 3. Register handlers

```ts
bus.registerCommandHandler("order.create", async (envelope) => {
  return {
    accepted: true,
    order_id: envelope.payload.order_id
  };
});

bus.registerEventHandler("order.created", async (envelope) => {
  console.log("projection update", envelope.operation_id);
});
```

## 4. Dispatch envelope

```ts
await bus.dispatch(
  EnvelopeBuilder.command("order.create", { order_id: "o-1" })
    .withSourceService("api-gateway")
    .withIdempotencyKey("idem-o-1")
    .build()
);
```

## 5. Move from local mode to durable mode

- Keep contracts and handlers unchanged.
- Replace provider from `INMEMORY` to `OUTBOX` for durable async delivery.
- Add relay worker (`OutboxRelay` / `OutboxRelayScheduler`).

See:

- [Choosing provider](choosing-provider.md)
- [Outbox provider guide](outbox-provider.md)
- [Monolith to services migration](migration-monolith-to-services.md)
