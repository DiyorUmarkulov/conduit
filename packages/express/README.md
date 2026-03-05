# @theconduit/express

Express middleware helpers for injecting Conduit bus and extracting trace IDs from HTTP headers.

## Install

```bash
pnpm add @theconduit/express
```

## Highlights

- `createConduitMiddleware(bus)` injects `request.conduit.bus`.
- Automatic `traceparent` parsing to `request.conduit.trace_id`.
- `extractTraceId` utility for standalone header parsing.

## Quick start

```ts
import express from "express";

import { ConduitBuilder, EnvelopeBuilder, type ConduitBus } from "@theconduit/core";
import { createConduitMiddleware } from "@theconduit/express";
import { InMemoryProvider, InMemoryDLQManager } from "@theconduit/provider-inmemory";

const app = express();

const bus: ConduitBus = new ConduitBuilder()
  .registerProvider(new InMemoryProvider())
  .withDlqManager(new InMemoryDLQManager())
  .build();

app.use(createConduitMiddleware(bus));

app.post("/orders", async (req, res) => {
  const traceId = req.conduit?.trace_id;

  if (req.conduit) {
    await req.conduit.bus.dispatch(
      EnvelopeBuilder.command("order.create", { order_id: "o-1" })
        .withSourceService("http-api")
        .withTraceId(traceId ?? "fallback-trace-id")
        .build()
    );
  }

  res.json({ accepted: true, trace_id: traceId });
});
```

## Exports

- `createConduitMiddleware`
- `extractTraceId`

## Related docs

- `docs/guides/getting-started.md`
- `docs/guides/transport-hardening.md`
