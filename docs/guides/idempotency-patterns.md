# Idempotency Patterns

Conduit delivers with `at-least-once` semantics, so handlers must be idempotent.

## Why this matters

Retries, process restarts, and network faults can cause duplicate delivery attempts. Correctness must come from handler-side dedupe logic.

## Commands: business key or idempotency key ledger

Use one of these keys as your dedupe identity:

- `envelope.metadata.idempotency_key` (preferred for commands)
- domain key (for example `order_id`)

Typical ledger columns:

- `key` (unique)
- `status` (`processing`, `completed`, `failed`)
- `result_hash` or `result_ref`
- timestamps + TTL retention marker

Pseudo-flow:

1. Try insert `processing` row for dedupe key.
2. If row already exists and `completed`, return previously known success outcome.
3. Execute side effect transactionally.
4. Mark row `completed`.

## Events: `(operation_id, handler_id)` dedupe

For event consumers, a common key is `(operation_id, handler_id)`.

- first-time event -> process and persist mark
- duplicate event -> noop

This protects projections and notifications from duplicate updates.

## Keep dedupe write close to side effects

Do not split dedupe write and side effect into unrelated transactions. Treat them as one atomic unit where possible.

## Practical recommendations

- Always set `idempotency_key` on commands from caller boundary.
- Keep dedupe entries long enough to cover worst-case retry windows.
- Log duplicate hits as debug-level signal, not as errors.
- Monitor duplicate rate per operation to catch producer retries or replay storms.
