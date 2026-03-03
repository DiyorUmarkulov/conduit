import { describe, expect, it } from "vitest";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import { InMemoryOutboxAdapter } from "../../src/adapters/inmemory-adapter.js";
import { OutboxProvider } from "../../src/outbox-provider.js";
import { OutboxRelay } from "../../src/outbox-relay.js";
import { OutboxRelayScheduler } from "../../src/outbox-relay-scheduler.js";

describe("OutboxRelayScheduler", () => {
  it("starts and stops polling loop", async () => {
    const adapter = new InMemoryOutboxAdapter();
    const provider = new OutboxProvider(adapter);
    const relay = new OutboxRelay(adapter, provider);

    const request: ProviderDispatchRequest = {
      envelope: EnvelopeBuilder.command("order.create", { order_id: "o-1" })
        .withSourceService("api-gateway")
        .withIdempotencyKey("idem-1")
        .build(),
      route: {
        operation_name: "order.create",
        operation_type: "COMMAND",
        provider: "OUTBOX",
        on_exhausted: "DLQ"
      },
      handler: {
        id: "handler-1",
        operation_name: "order.create",
        operation_type: "COMMAND",
        version_range: ">=1.0.0 <2.0.0",
        handle: async () => ({ ok: true })
      }
    };

    await provider.dispatch(request);

    const scheduler = new OutboxRelayScheduler(relay, {
      poll_interval_ms: 10
    });

    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);

    await new Promise((resolve) => {
      setTimeout(resolve, 40);
    });

    await scheduler.stop();

    const delivered = await adapter.list({ status: "DELIVERED" });

    expect(scheduler.isRunning()).toBe(false);
    expect(delivered).toHaveLength(1);
  });
});
