# @theconduit/nestjs

NestJS-oriented helpers and decorators for wiring Conduit bus integration.

## Install

```bash
pnpm add @theconduit/nestjs
```

## Highlights

- `createConduitModule` factory that exposes `CONDUIT_BUS` token.
- `createConduitBusProvider` helper.
- Handler decorators: `ConduitCommandHandler`, `ConduitEventHandler`.
- `InjectConduitBus` property decorator metadata marker.
- `extractTraceIdFromHttpHeaders` helper.

## Quick start

```ts
import type { ConduitBus } from "@theconduit/core";
import {
  ConduitCommandHandler,
  ConduitEventHandler,
  InjectConduitBus,
  createConduitBusProvider,
  createConduitModule
} from "@theconduit/nestjs";

@ConduitCommandHandler("order.create", { version_range: ">=1.0.0 <2.0.0" })
class OrderCreateHandler {
  @InjectConduitBus()
  private bus!: ConduitBus;
}

@ConduitEventHandler("order.created", { consumer_group: "billing" })
class BillingProjectionHandler {}

const busProvider = createConduitBusProvider(bus);
const conduitModule = createConduitModule({ bus });
```

## Exports

- `createConduitModule`
- `createConduitBusProvider`
- `ConduitCommandHandler`
- `ConduitEventHandler`
- `InjectConduitBus`
- `extractTraceIdFromHttpHeaders`

## Related docs

- `docs/guides/getting-started.md`
- `docs/guides/security-guide.md`
