---
description: Express middleware to attach ConduitBus and trace id (@theconduit/express).
---

# Express

**npm:** `@theconduit/express`

**Express** middleware: attach **`ConduitBus`** to each request and read **`trace_id`** from the W3C **`traceparent`** header so `dispatch` uses the same trace as your edge proxy or API gateway.

## When it helps

- **BFF / HTTP API** handlers call `bus.dispatch(...)` and must stay in the same trace as the incoming request.
- You want **`req.conduit.bus`** without passing the bus through every factory manually.

## Minimal example

```ts
import express from "express";
import { ConduitBuilder } from "@theconduit/core";
import { InMemoryProvider } from "@theconduit/provider-inmemory";
import { createConduitMiddleware } from "@theconduit/express";

const bus = new ConduitBuilder()
  .registerProvider(new InMemoryProvider())
  .build();

const app = express();

app.use(createConduitMiddleware(bus));

app.post("/orders", (req, res) => {
  const traceId = req.conduit?.trace_id;
  const b = req.conduit?.bus;
  // await b.dispatch(EnvelopeBuilder.command(...).withTraceId(traceId).build())
  res.json({ traceId });
});
```

(`ConduitRequestLike` is compatible with Express `Request` for `headers` and extended `conduit` field.)

## Install

```bash
pnpm add @theconduit/core @theconduit/express express
```

## Exports

| Symbol | Role |
| --- | --- |
| `createConduitMiddleware(bus)` | Sets `req.conduit = { bus, trace_id? }` |
| `extractTraceId(request)` | Case-insensitive headers + `traceparent` parse |
| Types | `ConduitRequestLike`, `NextFn` |

## Further reading

- [Core library](./core) — tracing middleware on the bus itself
- [NestJS](./nestjs) — `extractTraceIdFromHttpHeaders` for Nest-style carriers
