# Idempotency Patterns

## Command handlers
Use `metadata.idempotency_key` as dedupe key in persistent storage.

## Event handlers
Use `(operation_id, handler_id)` or domain-specific dedupe keys.

## Storage model
Persist a small execution ledger with statuses (`processing`, `completed`, `failed`) and TTL cleanup.
