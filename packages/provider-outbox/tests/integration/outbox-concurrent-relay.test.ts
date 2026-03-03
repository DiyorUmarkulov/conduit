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
    on_exhausted: "DLQ",
    retry: {
      max_attempts: 2,
      strategy: "FIXED",
      initial_delay_ms: 0
    }
  },
  handler
});

describe("OutboxRelay concurrency", () => {
  it("processes queued records without duplicate claims", async () => {
    const adapter = new InMemoryOutboxAdapter();
    const provider = new OutboxProvider(adapter);

    const seen = new Map<string, number>();

    const handler: ProviderDispatchRequest["handler"] = {
      id: "handler-1",
      operation_name: "order.create",
      operation_type: "COMMAND",
      version_range: ">=1.0.0 <2.0.0",
      handle: async (envelope) => {
        const operationId = envelope.operation_id;
        const current = seen.get(operationId) ?? 0;
        seen.set(operationId, current + 1);

        await new Promise((resolve) => {
          setTimeout(resolve, 1);
        });

        return { ok: true };
      }
    };

    const total = 50;

    for (let index = 0; index < total; index += 1) {
      await provider.dispatch(createRequest(handler, index));
    }

    const relayA = new OutboxRelay(adapter, provider, { batch_size: 5 });
    const relayB = new OutboxRelay(adapter, provider, { batch_size: 5 });

    const worker = async (relay: OutboxRelay): Promise<void> => {
      for (let step = 0; step < 50; step += 1) {
        await relay.runOnce();

        const pending = await adapter.pendingCount("order.create");

        if (pending === 0) {
          return;
        }
      }
    };

    await Promise.all([worker(relayA), worker(relayB)]);

    const delivered = await adapter.list({ status: "DELIVERED" });
    const failed = await adapter.list({ status: "FAILED" });

    expect(delivered).toHaveLength(total);
    expect(failed).toHaveLength(0);

    for (const [, count] of seen) {
      expect(count).toBe(1);
    }

    expect(seen.size).toBe(total);
  });
});
