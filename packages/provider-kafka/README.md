# @theconduit/provider-kafka

Kafka transport provider and adapter interfaces for Conduit dispatch.

## Install

```bash
pnpm add @theconduit/provider-kafka
```

## Highlights

- `KafkaProvider` for queue-style producer dispatch (`status: QUEUED`).
- Adapter interfaces for producer and lag readers.
- KafkaJS adapters: `KafkaJsProducerClient`, `KafkaJsLagReader`.
- `KafkaDLQManager` for publishing DLQ entries to a Kafka topic.
- Built-in resilience controls: retry, timeout, in-flight limit, circuit breaker.

## Quick start

```ts
import { ConduitBuilder } from "@theconduit/core";
import {
  KafkaProvider,
  KafkaDLQManager,
  KafkaJsProducerClient,
  KafkaJsLagReader
} from "@theconduit/provider-kafka";

const producerClient = new KafkaJsProducerClient(kafkaProducer);
const lagReader = new KafkaJsLagReader(kafkaAdmin);

const provider = new KafkaProvider(producerClient, {
  lag_reader: lagReader,
  publish_timeout_ms: 1_000,
  max_in_flight: 2_000,
  circuit_breaker: {
    failure_threshold: 20,
    reset_timeout_ms: 10_000
  }
});

const dlq = new KafkaDLQManager(producerClient, {
  topic: "conduit.dlq"
});

const bus = new ConduitBuilder()
  .registerProvider(provider)
  .withDlqManager(dlq)
  .build();
```

## Exports

- `KafkaProvider`
- `KafkaDLQManager`
- `KafkaJsProducerClient`
- `KafkaJsLagReader`

## Related docs

- `docs/guides/transport-hardening.md`
- `docs/guides/choosing-provider.md`
