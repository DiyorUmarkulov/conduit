---
description: NestJS helpers and decorators for Conduit (@theconduit/nestjs).
---

# NestJS

**npm:** `@theconduit/nestjs`

Small **factories** and **decorators** so a pre-built `ConduitBus` lives in the Nest DI graph as **`CONDUIT_BUS`**, plus **handler class markers** and **`traceparent`** parsing for HTTP.

## When it helps

- You already use **Nest** modules and want handler classes to **declare** which command/event they implement.
- You need **`trace_id`** from incoming HTTP requests for downstream `dispatch` (with core tracing middleware).

## Minimal example

```ts
import type { ConduitBus } from "@theconduit/core";
import {
  ConduitCommandHandler,
  ConduitEventHandler,
  createConduitBusProvider,
  createConduitModule,
  InjectConduitBus
} from "@theconduit/nestjs";

@ConduitCommandHandler("order.create", { version_range: ">=1.0.0 <2.0.0" })
export class OrderCreateHandler {
  @InjectConduitBus()
  private bus!: ConduitBus;

  async handle(payload: unknown) {
    await this.bus.dispatch(/* build envelope from payload */);
  }
}

@ConduitEventHandler("order.created", { consumer_group: "billing" })
export class BillingProjectionHandler {}

// In your AppModule (conceptually):
const bus: ConduitBus = /* ConduitBuilder...build() */;
const busProvider = createConduitBusProvider(bus);
const conduitModule = createConduitModule({ bus });
// Register busProvider + wire discovery so @ConduitCommandHandler classes
// register with the bus onModuleInit (app-specific glue).
```

`createConduitModule` returns a small **module definition** object; wire it the way your codebase registers dynamic providers.

## Install

```bash
pnpm add @theconduit/core @theconduit/nestjs @nestjs/common
```

## Exports

| Symbol | Role |
| --- | --- |
| `createConduitModule({ bus })` | `ConduitModuleDefinition` with `CONDUIT_BUS` |
| `createConduitBusProvider(bus)` | `{ provide: "CONDUIT_BUS", useValue: bus }` |
| `ConduitCommandHandler`, `ConduitEventHandler` | Class decorators + options |
| `InjectConduitBus` | Property metadata for bus injection |
| `extractTraceIdFromHttpHeaders` | `traceparent` → `trace_id` |

## Further reading

- [Getting started](../guides/getting-started)
- [Core library](./core)
- [Express](./express) — similar trace extraction for Express `req`
