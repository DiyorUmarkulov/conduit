# Conduit Documentation

This folder contains guides, architecture artifacts, and decision records for Conduit.

## Start here

- [Getting started](guides/getting-started.md): first route, provider wiring, and first dispatch.
- [Choosing provider](guides/choosing-provider.md): decide between `INMEMORY`, `OUTBOX`, and broker transports.
- [Outbox provider guide](guides/outbox-provider.md): durable queueing, relay, and adapters.
- [Transport hardening](guides/transport-hardening.md): timeout/retry/circuit-breaker and in-flight controls.
- [Security guide](guides/security-guide.md): authentication mechanisms and ACL enforcement.
- [Versioning guide](guides/versioning-guide.md): semver routing and migration windows.
- [Idempotency patterns](guides/idempotency-patterns.md): practical dedupe models for at-least-once delivery.
- [Monolith to services migration](guides/migration-monolith-to-services.md): phased migration playbook.
- [CLI guide](guides/cli.md): route/DLQ/schema/migration commands.

## Reference & packages (site)

Technical package pages are grouped in the docs sidebar by topic (**Intro**, **Outbox**, **Kafka**, **RabbitMQ**, **NATS**, **Framework integrations**). Start from the [overview](packages/index.md), then open the page for the stack you use:

- [Overview](packages/index.md)
- [@theconduit/core](packages/core.md)
- [@theconduit/provider-inmemory](packages/provider-inmemory.md)
- [@theconduit/provider-outbox](packages/provider-outbox.md)
- [@theconduit/provider-kafka](packages/provider-kafka.md)
- [@theconduit/provider-rabbitmq](packages/provider-rabbitmq.md)
- [@theconduit/provider-nats](packages/provider-nats.md)
- [@theconduit/schema-registry](packages/schema-registry.md)
- [@theconduit/nestjs](packages/nestjs.md)
- [@theconduit/express](packages/express.md)
- [@theconduit/testing](packages/testing.md)
- [@theconduit/cli](packages/cli.md)

README stubs in `packages/*/README.md` remain for npm/GitHub browsing.

## Architecture

- Decision records: [`architecture/decisions`](architecture/decisions)
- Mermaid diagrams: [`architecture/diagrams`](architecture/diagrams)
