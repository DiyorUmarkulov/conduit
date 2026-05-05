---
description: SQL transactional outbox and relay for Conduit (@theconduit/provider-outbox).
---

# SQL outbox package

**npm:** `@theconduit/provider-outbox` · provider id **`OUTBOX`**

**Transactional outbox**: enqueue in the **same DB transaction** as domain writes, then **relay** workers deliver rows to handlers. Adapters for **PostgreSQL**, **MySQL**, **SQLite**, plus **`InMemoryOutboxAdapter`** for tests. Bundled **SQL** (`OUTBOX_SQL_MIGRATIONS`) and **DLQ** helpers.

## When it helps

- You must not lose messages if the app crashes **after** the DB commit (classic outbox pattern).
- You want **ordering** per aggregate via `partition_key` and ordered relay (see [Transactional outbox](../guides/outbox-provider)).

## Minimal example (in-memory adapter)

Good for learning and tests; production uses `PgOutboxAdapter` (or MySQL/SQLite) — see the [outbox guide](../guides/outbox-provider).

```ts
import { ConduitBuilder, EnvelopeBuilder } from "@theconduit/core";
import {
  InMemoryOutboxAdapter,
  OutboxDLQManager,
  OutboxProvider,
  OutboxRelay,
  OutboxRelayScheduler
} from "@theconduit/provider-outbox";

const adapter = new InMemoryOutboxAdapter();
const dlq = new OutboxDLQManager();
const provider = new OutboxProvider(adapter);

const relay = new OutboxRelay(adapter, provider, {
  batch_size: 50,
  max_parallelism: 4,
  dlq_manager: dlq
});

const scheduler = new OutboxRelayScheduler(relay, {
  poll_interval_ms: 50,
  on_error: (err) => console.error(err)
});

const builder = new ConduitBuilder();
builder
  .addRoute(builder.route("billing.charge").type("COMMAND").via("OUTBOX").onExhausted("DLQ"))
  .registerProvider(provider)
  .withDlqManager(dlq);

const bus = builder.build();

bus.registerCommandHandler("billing.charge", async () => ({ charged: true }));

scheduler.start();

await bus.dispatch(
  EnvelopeBuilder.command("billing.charge", { invoice_id: "inv-1" }).build()
);

// Later: scheduler.stop() on shutdown
```

## Install

```bash
pnpm add @theconduit/core @theconduit/provider-outbox
```

## Exports (overview)

| Category | Symbols |
| --- | --- |
| Provider | `OutboxProvider`, `OutboxProviderOptions` (`now`, `partition_key_resolver`) |
| Relay | `OutboxRelay`, `OutboxRelayScheduler`, ordered relay factories (see package) |
| Adapters | `IOutboxDbAdapter`, `PgOutboxAdapter`, `MysqlOutboxAdapter`, `SqliteOutboxAdapter`, `InMemoryOutboxAdapter`, SQL utilities |
| Records | `OutboxRecord`, mapper utilities |
| DLQ | `OutboxDLQManager` (and related) |
| Partitioning | `createPayloadPartitionKeyResolver`, etc. |
| Migrations | `OUTBOX_SQL_MIGRATIONS`, `OutboxSqlDialect` in `./migrations/sql` |

## Behaviour notes

- `OutboxProvider.dispatch` persists a row and returns **`QUEUED`**; the **relay** claims rows and runs handlers.
- Optional **`partition_key_resolver`** for ordering / grouping downstream.
- Timestamps use a **monotonic** reservation per provider instance when enqueueing in the same millisecond.

## CLI

Generate DDL with **`@theconduit/cli`**: `conduit migrate --dialect postgres --print`.

## Further reading

- [Transactional outbox](../guides/outbox-provider)
- [ADR: SKIP LOCKED](../architecture/decisions/outbox-skip-locked)
- [CLI (npm package)](./cli)
