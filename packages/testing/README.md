# @theconduit/testing

Testing helpers and fakes for Conduit routes, providers, envelopes, and handler assertions.

## Install

```bash
pnpm add -D @theconduit/testing
```

## Highlights

- `createConduitTestBus` with pre-wired fake provider + fake DLQ.
- Envelope helpers: `makeCommandEnvelope`, `makeEventEnvelope`.
- Test doubles: `FakeProvider`, `FakeDLQManager`.
- Handler recorder helper: `createRecordedHandler`.

## Quick start

```ts
import { createConduitTestBus, makeCommandEnvelope, createRecordedHandler } from "@theconduit/testing";

const testBus = createConduitTestBus((builder) =>
  builder.addRoute(
    builder.route("cart.checkout").type("COMMAND").via("FAKE").onExhausted("DLQ")
  )
);

const recorded = createRecordedHandler(async () => ({ ok: true }));

testBus.bus.registerCommandHandler("cart.checkout", recorded.handle);

await testBus.bus.dispatch(
  makeCommandEnvelope("cart.checkout", { cart_id: "c-1" }, "idem-c-1")
);

console.log(recorded.calls.length); // 1
console.log(testBus.provider.recordsSnapshot().length); // 1
```

## Exports

- `createConduitTestBus`, `RecordedDispatchBus`
- `makeCommandEnvelope`, `makeEventEnvelope`
- `FakeProvider`, `FakeDLQManager`
- `createRecordedHandler`

## Related docs

- `docs/guides/getting-started.md`
- `docs/guides/idempotency-patterns.md`
