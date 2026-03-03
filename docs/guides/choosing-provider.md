# Choosing Provider

## INMEMORY
Use for local dev, unit tests, or monolith mode where handler execution should be synchronous.

## OUTBOX
Use for production write-paths requiring durable queueing, retries, and replay tooling.

## Selection checklist
- Need durability across process restarts: choose OUTBOX.
- Need highest local dev speed and no external infra: choose INMEMORY.
- Need strict partition order: choose OUTBOX with partition key resolver and ordered relay.
