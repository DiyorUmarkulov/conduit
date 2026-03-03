import { describe, expect, it } from "vitest";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import { InMemoryOutboxAdapter } from "../../src/adapters/inmemory-adapter.js";
import { OutboxProvider } from "../../src/outbox-provider.js";
import { OutboxRelay } from "../../src/outbox-relay.js";

const createRequest = (
  handler: ProviderDispatchRequest["handler"],
  id: number
): ProviderDispatchRequest => ({
  envelope: EnvelopeBuilder.command("order.create", { order_id: `o-${id}` })
    .withSourceService("api-gateway")
    .withIdempotencyKey(`idem-${id}`)
    .build(),
  route: {
    operation_name: "order.create",
    operation_type: "COMMAND",
    provider: "OUTBOX",
    on_exhausted: "DLQ"
  },
  handler
});

describe("OutboxRelay parallelism", () => {
  it("processes records concurrently when max_parallelism > 1", async () => {
    const adapter = new InMemoryOutboxAdapter();
    const provider = new OutboxProvider(adapter);

    let inFlight = 0;
    let maxInFlight = 0;

    const handler: ProviderDispatchRequest["handler"] = {
      id: "handler-1",
      operation_name: "order.create",
      operation_type: "COMMAND",
      version_range: ">=1.0.0 <2.0.0",
      handle: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);

        await new Promise((resolve) => {
          setTimeout(resolve, 5);
        });

        inFlight -= 1;
        return { ok: true };
      }
    };

    for (let index = 0; index < 12; index += 1) {
      await provider.dispatch(createRequest(handler, index));
    }

    const relay = new OutboxRelay(adapter, provider, {
      batch_size: 12,
      max_parallelism: 4
    });

    const stats = await relay.runOnce();
    const delivered = await adapter.list({ status: "DELIVERED" });

    expect(stats.delivered).toBe(12);
    expect(delivered).toHaveLength(12);
    expect(maxInFlight).toBeGreaterThan(1);
  });
});
