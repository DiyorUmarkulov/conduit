---
description: NATS and JetStream transport for Conduit (@theconduit/provider-nats).
---

# NATS transport

**npm:** `@theconduit/provider-nats` · provider ids **`NATS`** (core) and **`NATS_JETSTREAM`** (JetStream)

**NATS** pub/sub and **JetStream** durable consumers for Conduit envelopes, via **nats.js**, with **DLQ** helpers.

## When it helps

- **Cloud-native** mesh: lightweight subjects, optional persistence with **JetStream**.
- **Fire-and-forget** fan-out on core NATS; **replay / retention** when you switch to JetStream.

## Minimal example (core NATS)

`NatsProvider` extends `NatsCoreProvider` — same **`NATS`** provider name.

```ts
import { headers } from "nats";
import { ConduitBuilder } from "@theconduit/core";
import {
  NatsDLQManager,
  NatsJsClient,
  NatsProvider
} from "@theconduit/provider-nats";

// const nc = await connect({ servers: "demo.nats.io" });

const client = new NatsJsClient(nc, () => headers());

const provider = new NatsProvider(client, {
  publish_timeout_ms: 3_000,
  max_in_flight: 2_000,
  subject_resolver: (request) =>
    `conduit.${request.route.operation_type.toLowerCase()}.${request.route.operation_name}`
});

const dlq = new NatsDLQManager(client, { subject: "conduit.dlq" });

const bus = new ConduitBuilder()
  .registerProvider(provider)
  .withDlqManager(dlq)
  .build();

// Routes use .via("NATS")
```

For **JetStream**, register `NatsJetStreamProvider` and routes with `.via("NATS_JETSTREAM")` (see package types and [Choosing a transport](../guides/choosing-provider)).

## Install

```bash
pnpm add @theconduit/core @theconduit/provider-nats nats
```

## Provider ids

| Class | `name` / constant | Route `.via(...)` |
| --- | --- | --- |
| `NatsCoreProvider` / `NatsProvider` | `NATS` | `"NATS"` |
| `NatsJetStreamProvider` | `NATS_JETSTREAM` | `"NATS_JETSTREAM"` |

## Exports (overview)

| Symbol | Role |
| --- | --- |
| `NatsJsClient`, `NatsJsJetStreamClient` | Adapters |
| `NatsCoreProvider`, `NatsProvider`, `NatsJetStreamProvider` | `ITransportProvider` |
| `NatsCoreConsumer`, `NatsJetStreamConsumer` | Consumer helpers |
| `NatsDLQManager` | DLQ publish to a subject |

## JetStream vs core

Use **JetStream** when you need **durable consumers**, **replay**, or stronger delivery guarantees than core pub/sub; still design handlers for **at-least-once** ([ADR](../architecture/decisions/at-least-once-contract)).

## Further reading

- [Choosing a transport](../guides/choosing-provider)
- [Timeouts & resilience](../guides/transport-hardening)
