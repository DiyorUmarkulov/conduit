---
description: Visual model of the bus, one message’s path, and how transports fit in.
---

# How Conduit works

Read this page once, then follow [Getting started](getting-started) to type the same flow in code. The same flows are also stored as Mermaid sources under `docs/architecture/diagrams/` in the repository for review in git.

## Mental model: commands and events

Conduit routes **operation names** (for example `order.create`, `order.created`) to handlers. You declare whether an operation is a **COMMAND** (work to do, usually one logical consumer) or an **EVENT** (something happened; many subscribers may react).

```mermaid
flowchart LR
  subgraph producers["Your code"]
    API["HTTP / job / CLI"]
  end

  subgraph bus["Conduit bus"]
    R["Route + middleware"]
    P["Provider (transport)"]
  end

  subgraph handlers["Handlers"]
    H1["Command handler"]
    H2["Event handlers"]
  end

  API -->|"dispatch(envelope)"| R
  R --> P
  P --> H1
  P --> H2
```

Delivery is **at-least-once**: retries and duplicates are normal; handlers should be **idempotent** where it matters (see [Idempotency](idempotency-patterns)).

## One message’s path

From `dispatch` to a handler, Conduit resolves the route, runs middleware, asks the **provider** to deliver, then executes your handler. Failures can trigger retries or DLQ according to the route.

```mermaid
flowchart LR
  A[dispatch envelope] --> B[route resolve]
  B --> C[middleware pipeline]
  C --> D[provider dispatch]
  D --> E[handler execution]
  E --> F[success or retry / DLQ]
```

### Sequence view

```mermaid
sequenceDiagram
  participant App as Application
  participant Bus as Conduit bus
  participant MW as Middleware
  participant Prov as Provider
  participant H as Handler

  App->>Bus: dispatch(envelope)
  Bus->>Bus: resolve route (COMMAND / EVENT)
  Bus->>MW: pipeline
  MW->>Prov: deliver / enqueue
  Prov->>H: invoke handler
  H-->>Prov: result / throw
  Prov-->>Bus: ack, retry, or DLQ policy
  Bus-->>App: completion / error
```

For **in-memory**, “provider dispatch” is immediate. For **brokers** or **outbox**, the same logical steps apply; the provider may persist or publish before your handler runs on a worker.

## Choosing a transport (high level)

Match **environment** and **durability** needs first; keep handlers and routes stable when you swap providers.

```mermaid
flowchart TD
  Q{Need cross-process / survive restarts?}

  Q -->|No — tests or single process| INMEM["INMEMORY"]
  Q -->|Yes — same DB transaction as domain write| OB["OUTBOX + relay"]
  Q -->|Yes — central broker| BRK["Kafka / RabbitMQ / NATS"]

  INMEM --> PK["@theconduit/provider-inmemory"]
  OB --> PO["@theconduit/provider-outbox"]
  BRK --> K["@theconduit/provider-kafka"]
  BRK --> R["@theconduit/provider-rabbitmq"]
  BRK --> N["@theconduit/provider-nats"]
```

Details and trade-offs: [Choosing a transport](choosing-provider).

## Transactional outbox (when you use OUTBOX)

The app writes to **`conduit_outbox`** in the same transaction as your domain data. A **relay** process claims work and drives delivery (retries, DLQ). Your handlers still look like ordinary Conduit handlers.

```mermaid
flowchart LR
  DB[(conduit_outbox)] --> Claim[claim pending]
  Claim --> Relay[relay worker]
  Relay --> Handler[handler]
  Relay --> Retry[retry schedule]
  Relay --> DLQ[(conduit_outbox_dlq)]
```

Deep dive: [Transactional outbox](outbox-provider) and [SQL outbox package](../packages/provider-outbox).

## Where to go next

| Step | Doc |
| --- | --- |
| Install and first `dispatch` | [Getting started](getting-started) |
| Pick Kafka vs SQL vs in-memory | [Choosing a transport](choosing-provider) |
| Package map | [Overview](../packages/) |
