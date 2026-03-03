import { describe, expect, it } from "vitest";

import { ConduitBuilder, EnvelopeBuilder } from "@conduit/core";

import { InMemoryOutboxAdapter } from "../../src/adapters/inmemory-adapter.js";
import { OutboxDLQManager } from "../../src/outbox-dlq.js";
import { OutboxProvider } from "../../src/outbox-provider.js";
import { OutboxRelay } from "../../src/outbox-relay.js";

describe("Outbox provider integration", () => {
  it("returns QUEUED on dispatch and delivers later via relay", async () => {
    const adapter = new InMemoryOutboxAdapter();
    const provider = new OutboxProvider(adapter);
    const relay = new OutboxRelay(adapter, provider);

    const builder = new ConduitBuilder();

    builder.addRoute(
      builder
        .route("order.create")
        .type("COMMAND")
        .via("OUTBOX")
        .withRetry({
          attempts: 2,
          strategy: "FIXED",
          initial_delay_ms: 0
        })
        .onExhausted("DLQ")
    );

    builder.registerProvider(provider);
    builder.withDlqManager(new OutboxDLQManager());

    const bus = builder.build();

    let handled = false;

    bus.registerCommandHandler("order.create", async () => {
      handled = true;
      return { ok: true };
    });

    const dispatchResult = await bus.dispatch(
      EnvelopeBuilder.command("order.create", { order_id: "o-1" })
        .withSourceService("api-gateway")
        .withIdempotencyKey("idem-o-1")
        .build()
    );

    expect(dispatchResult.status).toBe("QUEUED");
    expect(dispatchResult.handler_results[0]?.status).toBe("QUEUED");
    expect(handled).toBe(false);

    const relayResult = await relay.runOnce();
    const deliveredRecords = await adapter.list({ status: "DELIVERED" });

    expect(relayResult.delivered).toBe(1);
    expect(deliveredRecords).toHaveLength(1);
    expect(handled).toBe(true);
  });
});
