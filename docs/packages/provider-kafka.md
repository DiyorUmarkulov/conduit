---
description: Kafka transport for Conduit via KafkaJS (@theconduit/provider-kafka).
---

# Kafka transport

**npm:** `@theconduit/provider-kafka` · provider id **`KAFKA`**

Produce (and consume via helpers) **Conduit envelopes** on Kafka using **KafkaJS**. Optional **Avro** with **`@theconduit/schema-registry`**, plus **timeouts**, **in-flight limits**, and **circuit breaker** around publish.

## When it helps

- **Event streaming**: commands/events as topics, consumers as independent services.
- **Backpressure**: combine `max_in_flight` / `publish_timeout_ms` with route-level retries ([Timeouts & resilience](../guides/transport-hardening)).

## Minimal example

You provide a KafkaJS producer; wrap it with `KafkaJsProducerClient` (see package). DLQ can publish failed entries to a dedicated topic.

```ts
import { ConduitBuilder } from "@theconduit/core";
import {
  KafkaDLQManager,
  KafkaJsProducerClient,
  KafkaProvider
} from "@theconduit/provider-kafka";
// import { Kafka, logLevel } from "kafkajs";

// const kafka = new Kafka({ clientId: "my-app", brokers: ["localhost:9092"], logLevel: logLevel.NOTHING });
// const producer = kafka.producer();
// await producer.connect();

const producerClient = new KafkaJsProducerClient(producer);

const provider = new KafkaProvider(producerClient, {
  publish_timeout_ms: 5_000,
  max_in_flight: 1_000
});

const dlq = new KafkaDLQManager(producerClient, { topic: "conduit.dlq" });

const bus = new ConduitBuilder()
  .registerProvider(provider)
  .withDlqManager(dlq)
  .build();

// Routes use .via("KAFKA"); default topic pattern:
//   conduit.{command|event}.{operation_name}
```

## Install

```bash
pnpm add @theconduit/core @theconduit/provider-kafka kafkajs
# Optional for Avro:
pnpm add @theconduit/schema-registry avsc
```

## Exports (overview)

| Symbol | Role |
| --- | --- |
| `KafkaProvider` | `ITransportProvider`; wraps `IKafkaProducerClient` |
| `KafkaProviderOptions` | `topic_resolver`, `key_resolver`, `headers_resolver`, `serializer`, `lag_reader`, `default_retry`, `publish_timeout_ms`, `max_in_flight`, `circuit_breaker`, … |
| `KafkaJsProducerClient`, `KafkaJsLagReader` | KafkaJS adapters |
| `KafkaConsumer`, `KafkaProducer` | Lower-level helpers |
| `KafkaDLQManager` | DLQ publishes to a topic |
| Serialization | `serializeConduitMessage` (JSON), Avro path with schema registry |

## Defaults

- Default **topic** pattern: `conduit.{operation_type}.{operation_name}` (lowercased type).
- Default **headers** include `operation_name`, `operation_type`, `trace_id`, `operation_id`, `handler_id`, `source_service`, `schema_version`, `attempt_number`, `produced_at`.

## Further reading

- [Choosing a transport](../guides/choosing-provider)
- [Timeouts & resilience](../guides/transport-hardening)
- [Schema registry](./schema-registry)
