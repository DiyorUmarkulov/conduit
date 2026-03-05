# @theconduit/provider-nats

NATS transport provider and `nats.js` adapter helpers for Conduit dispatch.

## Install

```bash
pnpm add @theconduit/provider-nats
```

## Highlights

- `NatsProvider` for subject-based asynchronous publish.
- `NatsJsClient` adapter for `nats.js` connection API.
- `NatsDLQManager` for DLQ publishing to dedicated subject.
- Built-in resilience controls: retry, timeout, in-flight limit, circuit breaker.

## Quick start

```ts
import { headers } from "nats";

import { ConduitBuilder } from "@theconduit/core";
import {
  NatsProvider,
  NatsDLQManager,
  NatsJsClient
} from "@theconduit/provider-nats";

const client = new NatsJsClient(natsConnection, () => headers());

const provider = new NatsProvider(client, {
  publish_timeout_ms: 1_000,
  max_in_flight: 2_000,
  subject_resolver: (request) =>
    `conduit.${request.route.operation_type.toLowerCase()}.${request.route.operation_name}`
});

const dlq = new NatsDLQManager(client, {
  subject: "conduit.dlq"
});

const bus = new ConduitBuilder()
  .registerProvider(provider)
  .withDlqManager(dlq)
  .build();
```

## Exports

- `NatsProvider`
- `NatsDLQManager`
- `NatsJsClient`

## Related docs

- `docs/guides/transport-hardening.md`
- `docs/guides/choosing-provider.md`
