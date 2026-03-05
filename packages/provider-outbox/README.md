# @theconduit/provider-outbox

Transactional outbox provider, relay, schedulers, adapters, and SQL migrations for durable asynchronous dispatch.

## Install

```bash
pnpm add @theconduit/provider-outbox
```

## Highlights

- `OutboxProvider` enqueues records in durable storage.
- `OutboxRelay` claims pending records and executes handlers.
- `OutboxRelayScheduler` runs relay polling loop.
- Partition-aware ordering (`createOrderedOutboxRelay`).
- Adapters: `InMemoryOutboxAdapter`, `PgOutboxAdapter`, `MySqlOutboxAdapter`, `SqliteOutboxAdapter`.
- Built-in SQL migrations via `OUTBOX_SQL_MIGRATIONS`.

## Quick start

```ts
import { ConduitBuilder } from "@theconduit/core";
import {
  InMemoryOutboxAdapter,
  OutboxProvider,
  OutboxDLQManager,
  OutboxRelayScheduler,
  createOrderedOutboxRelay,
  createPayloadPartitionKeyResolver
} from "@theconduit/provider-outbox";

const adapter = new InMemoryOutboxAdapter();
const provider = new OutboxProvider(adapter, {
  partition_key_resolver: createPayloadPartitionKeyResolver({
    fallback_to_operation_id: true
  })
});
const dlq = new OutboxDLQManager();

const relay = createOrderedOutboxRelay(adapter, provider, {
  batch_size: 100,
  max_parallelism: 8,
  dlq_manager: dlq
});

const scheduler = new OutboxRelayScheduler(relay, {
  poll_interval_ms: 100,
  on_error: (error) => {
    console.error("relay error", error);
  }
});

const bus = new ConduitBuilder()
  .registerProvider(provider)
  .withDlqManager(dlq)
  .build();

scheduler.start();

// ...on shutdown
await scheduler.stop();
```

## Migrations

```ts
import { OUTBOX_SQL_MIGRATIONS } from "@theconduit/provider-outbox";

const postgresMigrationChunks = OUTBOX_SQL_MIGRATIONS.postgres;
```

## Exports

- Provider and relay: `OutboxProvider`, `OutboxRelay`, `OutboxRelayScheduler`
- Partition helpers: `createOrderedOutboxRelay`, `createPayloadPartitionKeyResolver`
- DLQ: `OutboxDLQManager`
- DB adapters: `InMemoryOutboxAdapter`, `PgOutboxAdapter`, `MySqlOutboxAdapter`, `SqliteOutboxAdapter`
- SQL helpers: `OUTBOX_SQL_MIGRATIONS`

## Related docs

- `docs/guides/outbox-provider.md`
- `docs/guides/idempotency-patterns.md`
- `docs/guides/migration-monolith-to-services.md`
