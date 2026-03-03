# Monolith To Services Migration

1. Start with `INMEMORY` provider and stable operation contracts.
2. Move selected high-risk routes to `OUTBOX` without changing business handlers.
3. Scale relay workers and monitor DLQ/backlog metrics.
4. Split service boundaries while keeping route contracts stable.
