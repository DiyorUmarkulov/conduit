# Transport Hardening Guide

## Goals
- Keep producer path stable under broker degradation.
- Avoid unbounded memory growth under spikes.
- Fail fast when downstream is unhealthy.

## Built-in controls in broker providers
`@conduit/provider-kafka`, `@conduit/provider-rabbitmq`, `@conduit/provider-nats` now support:
- retry policy (uses route retry config or provider default)
- publish timeout
- max in-flight guard
- circuit breaker (failure threshold + reset timeout)
- for RabbitMQ, pooled confirm channels via `RabbitMQChannelPool` for high concurrent publish throughput

## Recommended production defaults
- `max_in_flight`: 1_000-10_000 depending on instance size.
- `publish_timeout_ms`: 200-2_000 based on latency SLO.
- circuit breaker `failure_threshold`: 10-50.
- circuit breaker `reset_timeout_ms`: 5_000-30_000.
- route retry: exponential with full jitter, 3-7 attempts.
- RabbitMQ channel pool size: start with 4-16 per process and tune by CPU/network saturation.

## Failure semantics
If retries are exhausted, dispatch fails with `DeliveryExhaustedError` and the caller route policy decides follow-up behavior (DLQ, drop, raise).

## Backpressure accounting
Provider backlog includes both broker lag (if lag reader configured) and local in-flight operations.
