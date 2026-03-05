# @theconduit/core

Core contracts, routing, retry, DLQ, observability, and security primitives for Conduit.

## Install

```bash
pnpm add @theconduit/core
```

## Highlights

- `ConduitBuilder` and `ConduitBus` for route/provider wiring and dispatch.
- `EnvelopeBuilder` for validated command/event envelopes.
- Routing by operation name/type and semver handler ranges.
- Retry strategies (`FIXED`, `LINEAR`, `EXPONENTIAL`) with jitter.
- DLQ contracts and in-memory `MapDLQManager`.
- Correlation support for request/reply (`dispatchAndWaitForReply`).
- Built-in middleware for tracing, metrics, logging, validation, and backpressure.
- Security mechanisms: `NoopAuthMechanism`, `HmacAuthMechanism`, `JwtAuthMechanism`, ACL evaluator.

## Quick start

```ts
import {
  ConduitBuilder,
  EnvelopeBuilder,
  InMemoryCorrelationStore,
  createAuthorizationMiddleware,
  ACLBuilder,
  ACLEvaluator
} from "@theconduit/core";
import { InMemoryProvider, InMemoryDLQManager } from "@theconduit/provider-inmemory";

const builder = new ConduitBuilder();
const aclBuilder = new ACLBuilder();

aclBuilder.add(aclBuilder.allow("api-gateway").to("order.*", "COMMAND"));
aclBuilder.denyAll();

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
  .withCorrelationStore(new InMemoryCorrelationStore())
  .use(
    createAuthorizationMiddleware({
      evaluator: new ACLEvaluator(aclBuilder.build())
    })
  );

const bus = builder.build();

bus.registerCommandHandler("order.create", async (envelope) => {
  return {
    ok: true,
    order_id: envelope.payload.order_id
  };
});

await bus.dispatch(
  EnvelopeBuilder.command("order.create", { order_id: "o-1" })
    .withSourceService("api-gateway")
    .withIdempotencyKey("idem-order-o-1")
    .build()
);
```

## Main exports

- `conduit-builder`, `conduit`
- `router/*`
- `envelope/*`
- `retry/*`
- `dlq/*`
- `correlation/*`
- `middleware/*`
- `observability/*`
- `security/*`
- `types/*`

## Related docs

- `docs/guides/getting-started.md`
- `docs/guides/security-guide.md`
- `docs/guides/versioning-guide.md`
- `docs/architecture/decisions/`
