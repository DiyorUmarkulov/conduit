# E2E Suite

## Scenarios
- `monolith-to-services.e2e.ts`
- `command-correlation.e2e.ts`
- `event-fanout.e2e.ts`
- `dlq-replay.e2e.ts`
- `broker-stack-smoke.e2e.ts`
- `broker-transports.e2e.ts`
- `broker-transports-load.e2e.ts`

## Run modes
- In-memory only:
  - `pnpm e2e`
- Full broker stack (Redpanda, RabbitMQ, NATS, Postgres):
  - `pnpm e2e:brokers`

## Broker-mode tuning env vars
- `CONDUIT_E2E_BROKER_BATCH` (default `100`)
- `CONDUIT_E2E_BROKER_CONSUME_TIMEOUT_MS` (default `15000`)
- `CONDUIT_E2E_BROKER_BATCH_TIMEOUT_MS` (default `45000`)

## Runtime dependencies for broker scenarios
- `kafkajs`
- `amqplib`
- `nats`

