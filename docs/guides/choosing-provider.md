# Choosing Provider

Pick provider by delivery guarantees, latency profile, and infrastructure requirements.

## Provider matrix

| Provider | Route value | Best for | Durability | Infra |
| --- | --- | --- | --- | --- |
| `@theconduit/provider-inmemory` | `INMEMORY` | local dev, tests, synchronous monolith handlers | process memory only | none |
| `@theconduit/provider-outbox` | `OUTBOX` | reliable write path, retries, replay, controlled async delivery | durable (DB-backed) | SQL database |
| `@theconduit/provider-kafka` | `KAFKA` | high-throughput stream pipelines, partitioned topics | broker-level | Kafka |
| `@theconduit/provider-rabbitmq` | `RABBITMQ` | exchange/routing-key topologies, queue fanout | broker-level | RabbitMQ |
| `@theconduit/provider-nats` | `NATS` | lightweight pub/sub transport and subject-based routing | broker-level | NATS |

## Recommended default path

1. Start with `INMEMORY` while stabilizing operation contracts.
2. Switch critical commands to `OUTBOX` for durability.
3. Introduce Kafka/RabbitMQ/NATS for cross-service transport when needed.

## Decision checklist

- Need guaranteed queue persistence across restarts: use `OUTBOX`.
- Need easiest local setup: use `INMEMORY`.
- Need broker-native fanout/streaming integration: use broker providers.
- Need strict per-aggregate ordering: use `OUTBOX` with partition key resolver and ordered relay.

## Mixed mode is normal

Conduit route-level provider selection lets you run different providers in one service:

- latency-sensitive internal operations on `INMEMORY`
- durable critical commands on `OUTBOX`
- cross-service events on broker provider
