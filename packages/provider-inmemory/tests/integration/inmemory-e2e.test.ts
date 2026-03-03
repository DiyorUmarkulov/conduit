import { describe, expect, it } from "vitest";

import { ConduitBuilder, EnvelopeBuilder } from "@conduit/core";
import { InMemoryDLQManager } from "../../src/inmemory-dlq.js";
import { InMemoryProvider } from "../../src/inmemory-provider.js";

describe("InMemory provider", () => {
  it("delivers command in-process", async () => {
    const builder = new ConduitBuilder();

    builder.addRoute(
      builder
        .route("order.create")
        .type("COMMAND")
        .via("INMEMORY")
        .withRetry({
          attempts: 1,
          strategy: "FIXED",
          initial_delay_ms: 0
        })
    );

    builder.registerProvider(new InMemoryProvider());

    const bus = builder.build();

    let observed = "";

    bus.registerCommandHandler("order.create", async (envelope) => {
      observed = (envelope.payload as { order_id: string }).order_id;
      return { ok: true };
    });

    const result = await bus.dispatch(
      EnvelopeBuilder.command("order.create", { order_id: "o-1" })
        .withSourceService("api-gateway")
        .withIdempotencyKey("idem-1")
        .build()
    );

    expect(observed).toBe("o-1");
    expect(result.status).toBe("DELIVERED");
  });

  it("moves operation to DLQ when retries are exhausted", async () => {
    const builder = new ConduitBuilder();
    const dlq = new InMemoryDLQManager();

    builder.addRoute(
      builder
        .route("payment.charge")
        .type("COMMAND")
        .via("INMEMORY")
        .withRetry({
          attempts: 2,
          strategy: "FIXED",
          initial_delay_ms: 0
        })
        .onExhausted("DLQ")
    );

    builder.registerProvider(new InMemoryProvider());
    builder.withDlqManager(dlq);

    const bus = builder.build();

    bus.registerCommandHandler("payment.charge", async () => {
      throw new Error("provider unavailable");
    });

    const result = await bus.dispatch(
      EnvelopeBuilder.command("payment.charge", { payment_id: "p-1" })
        .withSourceService("api-gateway")
        .withIdempotencyKey("idem-2")
        .build()
    );

    const entries = await dlq.list();

    expect(result.status).toBe("DLQ");
    expect(entries).toHaveLength(1);
    expect(entries[0]?.attempts).toBe(2);
    expect(entries[0]?.envelope.operation_name).toBe("payment.charge");
  });
});
