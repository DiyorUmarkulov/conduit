---
description: RabbitMQ (AMQP) transport for Conduit (@theconduit/provider-rabbitmq).
---

# RabbitMQ transport

**npm:** `@theconduit/provider-rabbitmq` · provider id **`RABBITMQ`**

Publish Conduit envelopes to an **exchange** with **amqplib**, using **channel pooling** for throughput, plus **DLQ** publishing and the same **resilience** knobs as other providers.

## When it helps

- **Task queues** and **workload fan-out** with AMQP routing keys.
- Teams already standardizing on **RabbitMQ** for cross-service messaging.

## Minimal example

```ts
import type { Connection } from "amqplib";
import { ConduitBuilder } from "@theconduit/core";
import {
  PooledAmqplibPublisherClient,
  RabbitMQChannelPool,
  RabbitMQDLQManager,
  RabbitMQProvider
} from "@theconduit/provider-rabbitmq";

// const connection: Connection = await amqp.connect(process.env.AMQP_URL!);

const pool = new RabbitMQChannelPool(connection, {
  size: 8,
  max_pending_acquires: 256,
  acquire_timeout_ms: 2_000
});

const publisher = new PooledAmqplibPublisherClient(pool);

const provider = new RabbitMQProvider(publisher, {
  exchange: "conduit.operations",
  publish_timeout_ms: 5_000,
  max_in_flight: 2_000
});

const dlq = new RabbitMQDLQManager(publisher, {
  exchange: "conduit.dlq",
  routing_key: "dlq"
});

const bus = new ConduitBuilder()
  .registerProvider(provider)
  .withDlqManager(dlq)
  .build();

// Routes use .via("RABBITMQ")
// await pool.close() on shutdown
```

## Install

```bash
pnpm add @theconduit/core @theconduit/provider-rabbitmq amqplib
```

## Exports (overview)

| Symbol | Role |
| --- | --- |
| `RabbitMQProvider` | `ITransportProvider` |
| `AmqplibPublisherClient`, `PooledAmqplibPublisherClient` | Publish clients |
| `RabbitMQChannelPool` | Pooled channels |
| `RabbitMQConsumer` | Consumer lifecycle |
| `RabbitMQDLQManager` | DLQ integration |
| Topology | `ExchangeTopology`, `QueueTopology` helpers |

## Operational notes

Tune **prefetch**, **publisher confirms**, and **topology** (durable queues, DLQ exchanges) for your SLA; pair with route-level `timeout_ms`, `retry`, and `on_exhausted`.

## Further reading

- [Choosing a transport](../guides/choosing-provider)
- [Timeouts & resilience](../guides/transport-hardening)
