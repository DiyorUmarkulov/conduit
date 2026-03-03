# ADR 005: SKIP LOCKED Claiming For Outbox Relays

## Status
Accepted

## Context
Multiple relay workers must claim work without duplicate processing and without central lock service.

## Decision
Adapters use transactional claiming with `FOR UPDATE SKIP LOCKED` (or nearest equivalent).

## Consequences
- Horizontal relay scaling without duplicate claim collisions.
- Better throughput under high backlog.
- Database capabilities define exact fairness guarantees.
