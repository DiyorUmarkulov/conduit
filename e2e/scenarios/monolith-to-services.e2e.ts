import { describe, expect, it } from "vitest";

import { ConduitBuilder, EnvelopeBuilder } from "@conduit/core";
import { InMemoryProvider } from "@conduit/provider-inmemory";
import {
  InMemoryOutboxAdapter,
  OutboxProvider,
  OutboxRelay
} from "@conduit/provider-outbox";

export const scenarioName = "monolith-to-services";

describe("E2E monolith-to-services", () => {
  it("keeps business handler intact while switching provider from INMEMORY to OUTBOX", async () => {
    const handledOrderIds: string[] = [];
    const businessHandler = async (payload: { order_id: string }): Promise<void> => {
      handledOrderIds.push(payload.order_id);
    };

    const monolithBuilder = new ConduitBuilder();
    monolithBuilder
      .addRoute(monolithBuilder.route("order.create").type("COMMAND").via("INMEMORY"))
      .registerProvider(new InMemoryProvider());

    const monolithBus = monolithBuilder.build();
    monolithBus.registerCommandHandler("order.create", async (envelope) => {
      await businessHandler(envelope.payload as { order_id: string });
      return { ok: true };
    });

    const first = await monolithBus.dispatch(
      EnvelopeBuilder.command("order.create", { order_id: "o-monolith" })
        .withSourceService("api-gateway")
        .withIdempotencyKey("idem-monolith")
        .build()
    );

    expect(first.status).toBe("DELIVERED");

    const adapter = new InMemoryOutboxAdapter();
    const outboxProvider = new OutboxProvider(adapter);
    const relay = new OutboxRelay(adapter, outboxProvider, {
      batch_size: 10,
      max_parallelism: 2
    });

    const servicesBuilder = new ConduitBuilder();
    servicesBuilder
      .addRoute(servicesBuilder.route("order.create").type("COMMAND").via("OUTBOX"))
      .registerProvider(outboxProvider);

    const servicesBus = servicesBuilder.build();
    servicesBus.registerCommandHandler("order.create", async (envelope) => {
      await businessHandler(envelope.payload as { order_id: string });
      return { ok: true };
    });

    const second = await servicesBus.dispatch(
      EnvelopeBuilder.command("order.create", { order_id: "o-services" })
        .withSourceService("api-gateway")
        .withIdempotencyKey("idem-services")
        .build()
    );

    expect(second.status).toBe("QUEUED");

    for (let index = 0; index < 10; index += 1) {
      await relay.runOnce();

      if ((await adapter.pendingCount("order.create")) === 0) {
        break;
      }
    }

    expect(await adapter.pendingCount("order.create")).toBe(0);
    expect(handledOrderIds).toEqual(["o-monolith", "o-services"]);
  });
});
