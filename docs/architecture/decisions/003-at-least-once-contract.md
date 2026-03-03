# ADR 003: Delivery Contract Is At-Least-Once

## Status
Accepted

## Context
Distributed systems cannot guarantee exactly-once end-to-end semantics without cost or hidden assumptions.

## Decision
Conduit guarantees at-least-once delivery and requires idempotent handlers for COMMAND/Event processing.

## Consequences
- Retries and redelivery are explicit behavior.
- Idempotency keys are mandatory for commands.
- Operational correctness is easier to reason about under failures.
