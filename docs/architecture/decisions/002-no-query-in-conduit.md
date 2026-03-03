# ADR 002: Query Is Out Of Scope

## Status
Accepted

## Context
Conduit standardizes command/event operational semantics with at-least-once delivery.
Query flows require low-latency request/response contracts and different failure semantics.

## Decision
Queries are not routed through Conduit. Use direct in-process calls or external RPC APIs (gRPC/REST).

## Consequences
- Conduit write-path remains focused and predictable.
- Read-path latency is not impacted by broker/outbox semantics.
- Teams maintain explicit separation between read and write concerns.
