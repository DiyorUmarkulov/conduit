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

## Package docs

- [@theconduit/core](../packages/core/README.md)
- [@theconduit/provider-inmemory](../packages/provider-inmemory/README.md)
- [@theconduit/provider-outbox](../packages/provider-outbox/README.md)
- [@theconduit/provider-kafka](../packages/provider-kafka/README.md)
- [@theconduit/provider-rabbitmq](../packages/provider-rabbitmq/README.md)
- [@theconduit/provider-nats](../packages/provider-nats/README.md)
- [@theconduit/schema-registry](../packages/schema-registry/README.md)
- [@theconduit/testing](../packages/testing/README.md)
- [@theconduit/nestjs](../packages/nestjs/README.md)
- [@theconduit/express](../packages/express/README.md)
- [@theconduit/cli](../packages/cli/README.md)

## Architecture

- Decision records: [`architecture/decisions`](architecture/decisions)
- Mermaid diagrams: [`architecture/diagrams`](architecture/diagrams)
