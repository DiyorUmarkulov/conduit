# Outbox Provider Guide

`@conduit/provider-outbox` stores dispatch requests in `conduit_outbox` and delivers them asynchronously via `OutboxRelay`.

## Adapters

- `InMemoryOutboxAdapter` — test/dev
- `PgOutboxAdapter` — PostgreSQL (`FOR UPDATE SKIP LOCKED`)
- `MySqlOutboxAdapter` — MySQL 8+ (`FOR UPDATE SKIP LOCKED`)
- `SqliteOutboxAdapter` — single-node fallback (no cross-process locking)

## Minimal wiring

```ts
import { ConduitBuilder } from "@conduit/core";
import {
  OutboxProvider,
  OutboxRelay,
  OutboxRelayScheduler,
  PgOutboxAdapter,
  OutboxDLQManager
} from "@conduit/provider-outbox";

const adapter = new PgOutboxAdapter(pgPool);
const provider = new OutboxProvider(adapter);
const relay = new OutboxRelay(adapter, provider, {
  dlq_manager: new OutboxDLQManager()
});

const scheduler = new OutboxRelayScheduler(relay, {
  poll_interval_ms: 100
});

const builder = new ConduitBuilder();
builder
  .registerProvider(provider)
  .withDlqManager(new OutboxDLQManager());

scheduler.start();
```

## Operational notes

- Keep relay stateless and run multiple instances for throughput.
- Use partition keys for ordered streams.
- Alert on growing `PENDING` and `FAILED` counts.
- Reconcile and replay entries from DLQ after incident mitigation.
