import { describe, expect, it } from "vitest";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import { InMemoryOutboxAdapter } from "../../src/adapters/inmemory-adapter.js";
import { OutboxProvider } from "../../src/outbox-provider.js";

const buildRequest = (): ProviderDispatchRequest => ({
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
});

describe("OutboxProvider", () => {
  it("queues operation into outbox storage", async () => {
    const adapter = new InMemoryOutboxAdapter();
    const provider = new OutboxProvider(adapter);

    const result = await provider.dispatch(buildRequest());

    const pendingRecords = await adapter.list({ status: "PENDING" });

    expect(result.status).toBe("QUEUED");
    expect(pendingRecords).toHaveLength(1);
    expect(pendingRecords[0]?.handler_id).toBe("handler-1");
    expect(pendingRecords[0]?.route.provider).toBe("OUTBOX");
  });
});
