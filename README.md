# Conduit

Conduit is an operation bus framework for backend command/event delivery with explicit reliability semantics.

## Principles

- `COMMAND` and `EVENT` are separate contracts.
- Delivery model is `at-least-once`.
- Idempotency is an explicit handler responsibility.
- Routing is semver-aware (`schema_version` + handler `version_range`).

## Package naming

- Published package scope: `@theconduit/*`
- Local monorepo import alias: `@conduit/*` (configured in `tsconfig.base.json`)

The code examples in this repository docs usually use `@conduit/*` so they run inside the monorepo without additional publishing steps.

## Package map

| Package | Purpose |
| --- | --- |
| [@theconduit/core](packages/core/README.md) | Core bus, routing, envelope contracts, retry, middleware, security |
| [@theconduit/provider-inmemory](packages/provider-inmemory/README.md) | In-process sync provider + in-memory DLQ |
| [@theconduit/provider-outbox](packages/provider-outbox/README.md) | Transactional outbox provider, relay, adapters, migrations |
| [@theconduit/provider-kafka](packages/provider-kafka/README.md) | Kafka producer transport + KafkaJS adapters |
| [@theconduit/provider-rabbitmq](packages/provider-rabbitmq/README.md) | RabbitMQ transport + amqplib adapters + channel pool |
| [@theconduit/provider-nats](packages/provider-nats/README.md) | NATS transport + nats.js adapter |
| [@theconduit/schema-registry](packages/schema-registry/README.md) | Registry abstractions, compatibility checks, schema diff/validation |
| [@theconduit/testing](packages/testing/README.md) | Fakes and helpers for tests |
| [@theconduit/nestjs](packages/nestjs/README.md) | NestJS integration helpers and decorators |
| [@theconduit/express](packages/express/README.md) | Express middleware and trace extraction |
| [@theconduit/cli](packages/cli/README.md) | Operational CLI for routes, DLQ, schema, migrations |

## Quick start

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

### Minimal in-memory setup

```ts
import { ConduitBuilder, EnvelopeBuilder } from "@conduit/core";
import { InMemoryDLQManager, InMemoryProvider } from "@conduit/provider-inmemory";

const builder = new ConduitBuilder();

builder
  .addRoute(
    builder
      .route("order.create")
      .type("COMMAND")
      .via("INMEMORY")
      .withRetry({
        attempts: 3,
        strategy: "EXPONENTIAL",
        initial_delay_ms: 25,
        max_delay_ms: 500,
        jitter: "FULL"
      })
      .onExhausted("DLQ")
  )
  .registerProvider(new InMemoryProvider())
  .withDlqManager(new InMemoryDLQManager());

const bus = builder.build();

bus.registerCommandHandler("order.create", async (envelope) => {
  return {
    created: true,
    payload: envelope.payload
  };
});

await bus.dispatch(
  EnvelopeBuilder.command("order.create", { order_id: "o-1" })
    .withSourceService("api-gateway")
    .withIdempotencyKey("idem-001")
    .build()
);
```

## Documentation

- **Browse locally (Docusaurus):** `pnpm docs:dev` — see [`website/README.md`](website/README.md).

- [Docs index](docs/README.md)
- [Getting started guide](docs/guides/getting-started.md)
- [Provider selection guide](docs/guides/choosing-provider.md)
- [Outbox guide](docs/guides/outbox-provider.md)
- [Transport hardening guide](docs/guides/transport-hardening.md)
- [Security guide](docs/guides/security-guide.md)
- [Versioning guide](docs/guides/versioning-guide.md)
- [CLI guide](docs/guides/cli.md)
- [Architecture decisions](docs/architecture/decisions)
- [Architecture diagrams](docs/architecture/diagrams)

## Dev commands

```bash
pnpm build
pnpm test
pnpm typecheck
pnpm e2e
pnpm benchmark
pnpm docs:api
pnpm deps:circular
```

## Benchmarks and e2e

- Benchmarks: `benchmarks/README.md`
- E2E scenarios: `e2e/README.md`

## Contributing

See `CONTRIBUTING.md`.
