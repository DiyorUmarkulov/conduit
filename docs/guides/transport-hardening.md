# Transport Hardening Guide

Use resilience controls in broker providers to keep publish path predictable under failures.

## Scope

Applies to:

- `@theconduit/provider-kafka`
- `@theconduit/provider-rabbitmq`
- `@theconduit/provider-nats`

## Built-in controls

- route-aware retry policy
- publish timeout
- max in-flight guard
- circuit breaker
- backlog accounting (`lag/backlog + in-flight`)

RabbitMQ additionally supports pooled confirm channels via `RabbitMQChannelPool`.

## Recommended starting defaults

- `max_in_flight`: `1000-5000`
- `publish_timeout_ms`: `200-1500`
- circuit breaker `failure_threshold`: `10-30`
- circuit breaker `reset_timeout_ms`: `5000-15000`
- retry policy: exponential + full jitter, 3-7 attempts

Tune per workload and latency SLO.

## Example provider configuration

```ts
const provider = new KafkaProvider(producerClient, {
  publish_timeout_ms: 1_000,
  max_in_flight: 2_000,
  default_retry: {
    max_attempts: 5,
    strategy: "EXPONENTIAL",
    initial_delay_ms: 50,
    max_delay_ms: 2_000,
    jitter: "FULL"
  },
  circuit_breaker: {
    failure_threshold: 20,
    reset_timeout_ms: 10_000,
    half_open_max_calls: 2
  }
});
```

## Failure semantics

If publish keeps failing after retries, dispatch raises error and route exhaustion policy decides next behavior (`DLQ`, `LOG_AND_DROP`, or `RAISE`).

## Production practices

- Track in-flight and timeout errors separately from broker errors.
- Add alerts for circuit-breaker open events.
- Validate overload behavior with load tests before rollout.
- Keep per-provider dashboards (latency, retries, backlog, DLQ).
