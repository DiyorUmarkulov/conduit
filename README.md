# Conduit

Conduit is an operation bus framework for backend command/event delivery with explicit reliability semantics:
- `COMMAND` and `EVENT` are separate contracts.
- Delivery model is `at-least-once`.
- Idempotency is a handler responsibility (explicit, not hidden).

## Current packages

- `@conduit/core`
  - operation envelope contract
  - route registry + pattern matching
  - semver-based handler resolution
  - retry strategies with jitter
  - DLQ abstractions
  - backpressure policy hooks
  - correlation store + `dispatchAndWaitForReply`
  - built-in observability middleware (tracing/metrics/logging)
  - security mechanisms (`NOOP`, `HMAC`, `JWT`)
  - lightweight DI container
- `@conduit/provider-inmemory`
  - synchronous in-process transport provider
  - in-memory DLQ manager
- `@conduit/provider-outbox`
  - transactional outbox queueing provider
  - relay worker with retry/backoff semantics
  - partition-aware ordered relay for high parallelism
  - DB adapters: in-memory, PostgreSQL, MySQL, SQLite
  - SQL migrations for `conduit_outbox` and `conduit_outbox_dlq`
- `@conduit/provider-kafka`
  - Kafka producer-based transport adapter
  - optional lag reader for backpressure integration
  - built-in retry/timeout/circuit-breaker/in-flight protection
  - KafkaJS adapter (`KafkaJsProducerClient`, `KafkaJsLagReader`)
- `@conduit/provider-rabbitmq`
  - RabbitMQ exchange/routing transport adapter
  - optional backlog reader for pressure control
  - built-in retry/timeout/circuit-breaker/in-flight protection
  - amqplib adapter (`AmqplibPublisherClient`)
- `@conduit/provider-nats`
  - NATS publish transport adapter
  - optional backlog reader integration
  - built-in retry/timeout/circuit-breaker/in-flight protection
  - nats.js adapter (`NatsJsClient`)
- `@conduit/schema-registry`
  - local and Confluent-compatible registry adapters
  - compatibility checker and schema diff utilities
- `@conduit/testing`
  - fake provider + fake DLQ + envelope factories for tests
- `@conduit/nestjs`
  - decorators and module helpers for Conduit wiring in NestJS apps
- `@conduit/express`
  - request middleware for bus injection and trace extraction
- `@conduit/cli`
  - `routes list`
  - `dlq inspect`
  - `dlq replay`
  - `init`
  - `schema validate`
  - `schema diff`
  - `migrate`

## Quick start

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Example

```ts
import { ConduitBuilder, EnvelopeBuilder } from "@conduit/core";
import { InMemoryProvider, InMemoryDLQManager } from "@conduit/provider-inmemory";

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
  .withDlqManager(new InMemoryDLQManager());

const bus = builder.build();

bus.registerCommandHandler("order.create", async (envelope) => {
  // business logic
  return { created: true, payload: envelope.payload };
});

await bus.dispatch(
  EnvelopeBuilder.command("order.create", { order_id: "o-1" })
    .withSourceService("api-gateway")
    .withIdempotencyKey("idem-001")
    .build()
);
```
