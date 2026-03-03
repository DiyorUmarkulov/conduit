# Benchmarks

Conduit benchmark suite is executed by:

1. `node scripts/run-benchmarks.mjs`
2. `node scripts/check-benchmarks.mjs benchmarks/results/latest.json benchmarks/thresholds.json`

## Metrics

- dispatch throughput (`dispatch.ops_per_sec`)
- routing throughput and tail latency (`routing.ops_per_sec`, `routing.p95_ms`)
- JSON roundtrip throughput (`serialization.json_roundtrip_ops_per_sec`)
- outbox relay throughput (`outbox_relay.ops_per_sec`)

## Thresholds

Gate thresholds are stored in `benchmarks/thresholds.json`.
Adjust them deliberately when intentional architectural changes affect performance.
