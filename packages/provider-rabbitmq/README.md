# @theconduit/provider-rabbitmq

RabbitMQ transport provider with `amqplib` adapters and pooled channel support.

## Install

```bash
pnpm add @theconduit/provider-rabbitmq
```

## Highlights

- `RabbitMQProvider` publishes envelopes to exchange/routing key.
- `AmqplibPublisherClient` and `PooledAmqplibPublisherClient`.
- `RabbitMQChannelPool` for high-concurrency publish workloads.
- `RabbitMQDLQManager` for DLQ publishing.
- Built-in resilience controls: retry, timeout, in-flight limit, circuit breaker.

## Quick start

```ts
import { ConduitBuilder } from "@theconduit/core";
import {
  RabbitMQProvider,
  RabbitMQDLQManager,
  RabbitMQChannelPool,
  PooledAmqplibPublisherClient
} from "@theconduit/provider-rabbitmq";

const pool = new RabbitMQChannelPool(amqpConnection, {
  size: 8,
  max_pending_acquires: 256,
  acquire_timeout_ms: 2_000
});

const publisher = new PooledAmqplibPublisherClient(pool);

const provider = new RabbitMQProvider(publisher, {
  exchange: "conduit.operations",
  publish_timeout_ms: 1_000,
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

// ...on shutdown
await pool.close();
```

## Exports

- `RabbitMQProvider`
- `RabbitMQDLQManager`
- `AmqplibPublisherClient`
- `PooledAmqplibPublisherClient`
- `RabbitMQChannelPool`

## Related docs

- `docs/guides/transport-hardening.md`
- `docs/guides/choosing-provider.md`
