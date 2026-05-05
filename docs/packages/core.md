---
description: Conduit bus, routing, envelopes, middleware, retries, and DLQ contracts (@theconduit/core).
---

# Core library

**npm:** `@theconduit/core`

Runtime kernel: **operation bus**, **semver-aware routing**, **envelopes**, **dispatch middleware**, **retries**, **DLQ contracts**, optional **request–reply correlation**, and **security/auth** helpers. Every transport and integration package builds on this.

## When it helps

- You want one API for **commands** and **events** across in-memory, SQL outbox, or brokers.
- You need **structured envelopes** (metadata, schema version, trace/idempotency hints) and a **middleware pipeline** before handlers run.
- You are standardizing **retries**, **DLQ**, and **backpressure** at the route level.

## Minimal example

Wire a route, register an in-memory transport (from [`@theconduit/provider-inmemory`](./provider-inmemory)), dispatch one command:

```ts
import { ConduitBuilder, EnvelopeBuilder } from "@theconduit/core";
import { InMemoryDLQManager, InMemoryProvider } from "@theconduit/provider-inmemory";

const builder = new ConduitBuilder();

builder
  .addRoute(
    builder
      .route("order.create")
      .type("COMMAND")
      .via("INMEMORY")
      .onExhausted("DLQ")
  )
  .registerProvider(new InMemoryProvider())
  .withDlqManager(new InMemoryDLQManager())
  .withProductionDefaults();

const bus = builder.build();

bus.registerCommandHandler("order.create", async (envelope) => ({
  accepted: true,
  order_id: envelope.payload.order_id
}));

await bus.dispatch(
  EnvelopeBuilder.command("order.create", { order_id: "o-1" })
    .withSourceService("api")
    .build()
);
```

Same `ConduitBuilder` / handlers / envelopes when you swap `.via("INMEMORY")` for `OUTBOX`, `KAFKA`, etc.

## Install

```bash
pnpm add @theconduit/core
```

## Module surface

Single entry: `@theconduit/core`. Main concepts:

| Area | Types / symbols (representative) |
| --- | --- |
| Bus | `ConduitBuilder`, `ConduitBus` |
| Routing | `RouteBuilder`, `RouteConfig`, `ON_EXHAUSTED_ACTION`, `BACKOFF_STRATEGY`, `JITTER_MODE` |
| Envelope | `EnvelopeBuilder`, envelope types under `./envelope` |
| Providers | `ITransportProvider`, `ProviderDispatchRequest`, `PROVIDER_DISPATCH_STATUSES` |
| Handlers | `registerCommandHandler`, `registerEventHandler`, `CommandHandlerOptions`, `EventHandlerOptions` |
| Correlation | `dispatchAndWaitForReply`, `resolveReply` (requires `withCorrelationStore` on builder) |
| Middleware | `createValidationMiddleware`, `createTracingMiddleware`, `createMetricsMiddleware`, `createLoggingMiddleware`, `createIdempotencyHintMiddleware`, `DispatchMiddleware` |
| Production wiring | `withProductionDefaults({ logger, tracer, metrics_registry, ... })` |
| DLQ | `IDLQManager` and related types |
| Observability | `ILogger`, `ITracer`, `IMetricsRegistry` interfaces |

## Route configuration

Each route binds an **operation name** and **type** (`COMMAND` / `EVENT`) to a **provider id** string that must match `ITransportProvider.name` (for example `INMEMORY`, `OUTBOX`, `KAFKA`).

- **Retry**: `RetryConfig` with `max_attempts`, `strategy` (`FIXED` \| `LINEAR` \| `EXPONENTIAL`), delays, optional `jitter`, optional `retry_on(error)`.
- **On exhaustion**: `on_exhausted` — `DLQ`, `LOG_AND_DROP`, or `RAISE`.
- **Optional**: `timeout_ms`, `reply_to`, `backpressure` policy.

## Builder → bus

1. `new ConduitBuilder()`
2. `addRoute(...)` or `defineRoute(name, fn)`
3. `registerProvider(provider)` for each transport used in routes
4. Optional: `withDlqManager`, `withRetryExecutor`, `withCorrelationStore`, `use(middleware)`, `withProductionDefaults()`
5. `build()` → `ConduitBus`

## Dispatch

- `dispatch(envelope)` — returns `DispatchResult`.
- `dispatchAndWaitForReply(envelope, { timeout_ms, correlation_id, signal })` — requires correlation store; pairs with `resolveReply` for reply envelopes.

## Peer packages

All `@theconduit/provider-*`, `@theconduit/nestjs`, `@theconduit/express`, `@theconduit/testing`, and `@theconduit/cli` depend on **core** (CLI also uses outbox for migrations).

## Further reading

- [Getting started](../guides/getting-started)
- [Choosing a transport](../guides/choosing-provider)
- [Timeouts & resilience](../guides/transport-hardening)
- [Security](../guides/security-guide)
