# Outbox Provider Guide

`@theconduit/provider-outbox` stores dispatch records in `conduit_outbox` and delivers them asynchronously via relay workers.

## Components

- `OutboxProvider`: writes pending records.
- `OutboxRelay`: claims records and invokes handlers.
- `OutboxRelayScheduler`: polling loop over relay.
- `OutboxDLQManager`: in-memory DLQ implementation.
- DB adapters: `InMemoryOutboxAdapter`, `PgOutboxAdapter`, `MySqlOutboxAdapter`, `SqliteOutboxAdapter`.
- SQL templates: `OUTBOX_SQL_MIGRATIONS`.

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
const dlq = new OutboxDLQManager();

const provider = new OutboxProvider(adapter);
const relay = new OutboxRelay(adapter, provider, {
  batch_size: 100,
  max_parallelism: 8,
  dlq_manager: dlq
});

const scheduler = new OutboxRelayScheduler(relay, {
  poll_interval_ms: 100,
  on_error: (error) => console.error("relay error", error)
});

const bus = new ConduitBuilder()
  .registerProvider(provider)
  .withDlqManager(dlq)
  .build();

scheduler.start();
```

## Partition ordering

For strict per-aggregate ordering, set partition key and use ordered relay mode:

```ts
import {
  createOrderedOutboxRelay,
  createPayloadPartitionKeyResolver,
  OutboxProvider
} from "@conduit/provider-outbox";

const provider = new OutboxProvider(adapter, {
  partition_key_resolver: createPayloadPartitionKeyResolver({
    candidate_fields: ["order_id", "aggregate_id"],
    fallback_to_operation_id: true
  })
});

const relay = createOrderedOutboxRelay(adapter, provider, {
  max_parallelism: 16
});
```

## Adapter guidance

- `PgOutboxAdapter`: preferred for production PostgreSQL.
- `MySqlOutboxAdapter`: production MySQL 8+ with skip-locked claim flow.
- `SqliteOutboxAdapter`: single-process/single-node workloads.
- `InMemoryOutboxAdapter`: local development and tests.

## Operational checklist

- Alert on growing pending count.
- Track retry rate and failed count.
- Record relay run stats (`claimed`, `delivered`, `retried`, `failed`, `dlq`).
- Provide runbook for DLQ replay after mitigation.
