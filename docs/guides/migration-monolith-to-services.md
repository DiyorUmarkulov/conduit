# Monolith To Services Migration

This playbook keeps contracts stable while you move execution topology.

## Phase 1: Stabilize contracts in monolith

- Use `INMEMORY` routes for fast iteration.
- Make command/event names and payload schemas explicit.
- Add idempotency handling before introducing distributed transport.

## Phase 2: Introduce durability on write path

- Move critical command routes to `OUTBOX`.
- Start relay workers (`OutboxRelayScheduler`) with DLQ enabled.
- Keep existing handler code unchanged.

## Phase 3: Isolate service boundaries

- Split handlers by bounded context.
- Route cross-service events through broker provider (`KAFKA`, `RABBITMQ`, or `NATS`) where needed.
- Preserve operation names and schema evolution strategy.

## Phase 4: Observe and harden

- Track backlog, relay lag, retries, and DLQ volume.
- Tune retry/circuit-breaker/in-flight settings.
- Add runbooks for DLQ replay and incident recovery.

## Phase 5: Decommission monolith paths

- Remove legacy in-process shortcuts route by route.
- Keep compatibility handler ranges during cutover window.
- Retire old schema versions after consumer migration completes.

## Exit criteria per phase

- No unknown route contracts.
- Idempotency verified under duplicate delivery tests.
- Backlog and DLQ metrics under defined SLO.
