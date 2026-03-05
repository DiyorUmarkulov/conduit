# @theconduit/provider-inmemory

Synchronous in-process transport provider and in-memory DLQ manager for local dev, tests, and monolith mode.

## Install

```bash
pnpm add @theconduit/provider-inmemory
```

## Highlights

- `InMemoryProvider` dispatches directly to registered handlers.
- `InMemoryDLQManager` extends core `MapDLQManager`.
- Optional synthetic backlog to test backpressure behavior.

## Quick start

```ts
import { ConduitBuilder, EnvelopeBuilder } from "@theconduit/core";
import { InMemoryProvider, InMemoryDLQManager } from "@theconduit/provider-inmemory";

const provider = new InMemoryProvider();
const dlq = new InMemoryDLQManager();
const builder = new ConduitBuilder();

builder
  .addRoute(
    builder
      .route("payment.capture")
      .type("COMMAND")
      .via("INMEMORY")
      .onExhausted("DLQ")
  )
  .registerProvider(provider)
  .withDlqManager(dlq);

const bus = builder.build();

bus.registerCommandHandler("payment.capture", async () => {
  return { status: "captured" };
});

await bus.dispatch(
  EnvelopeBuilder.command("payment.capture", { payment_id: "p-1" })
    .withSourceService("checkout")
    .withIdempotencyKey("capture-p-1")
    .build()
);

provider.setSyntheticBacklog(50);
```

## Exports

- `InMemoryProvider`
- `InMemoryDLQManager`

## Related docs

- `docs/guides/choosing-provider.md`
- `docs/guides/getting-started.md`
