---
description: Fakes, builders, and matchers for testing Conduit handlers (@theconduit/testing).
---

# Test helpers

**npm:** `@theconduit/testing` · provider id **`FAKE`**

**Fake** transport and DLQ, **envelope/command/event builders**, **recorded** dispatch helper, and optional **Vitest/Jest matchers** — exercise handlers without brokers or SQL.

## When it helps

- **Handler unit tests**: assert behaviour and DLQ side effects without spinning up Kafka.
- **Router tests**: assert which operations were dispatched and with which payloads (`RecordedDispatchBus`, `FakeProvider` records).

## Minimal example

Routes must use **`.via("FAKE")`** — `createConduitTestBus` injects the fake provider and DLQ for you.

```ts
import { EnvelopeBuilder } from "@theconduit/core";
import { createConduitTestBus } from "@theconduit/testing";

const { bus, provider, dlq } = createConduitTestBus((b) =>
  b.addRoute(b.route("order.cancel").type("COMMAND").via("FAKE").onExhausted("DLQ"))
);

bus.registerCommandHandler("order.cancel", async () => ({ ok: true }));

await bus.dispatch(
  EnvelopeBuilder.command("order.cancel", { order_id: "o-42" }).build()
);

// Inspect what the transport saw
const last = provider.recordsSnapshot().at(-1);
console.assert(last?.request.envelope.operation_name === "order.cancel");
```

Use **in-memory** transport instead when you want the real `INMEMORY` code path under test ([In-memory transport](./provider-inmemory)).

## Install

```bash
pnpm add -D @theconduit/core @theconduit/testing
```

## Exports (overview)

| Symbol | Role |
| --- | --- |
| `createConduitTestBus(configure)` | Pre-registers `FakeProvider` + `FakeDLQManager`, returns `{ bus, provider, dlq }` |
| `FakeProvider`, `FAKE_PROVIDER_NAME` | `ITransportProvider` with dispatch recording (`"FAKE"`) |
| `FakeDLQManager` | In-memory DLQ double |
| Builders | `CommandBuilder`, `EventBuilder`, `makeCommandEnvelope`, … |
| `RecordedDispatchBus` | Wraps a bus and records every `dispatch` envelope |
| `createRecordedHandler` | Handler test double (see package) |
| Matchers | Vitest/Jest matcher registration under `./matchers/*` |

## Further reading

- [Core library](./core)
- [In-memory transport](./provider-inmemory)
