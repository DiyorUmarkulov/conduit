import { describe, expect, it } from "vitest";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import { InMemoryOutboxAdapter } from "../../src/adapters/inmemory-adapter.js";
import { OutboxProvider } from "../../src/outbox-provider.js";
import { OutboxRelay } from "../../src/outbox-relay.js";
import { createPayloadPartitionKeyResolver } from "../../src/partition/partition-key-resolver.js";

const createRequest = (
  handler: ProviderDispatchRequest["handler"],
  orderId: string,
  seq: number
): ProviderDispatchRequest => ({
  envelope: EnvelopeBuilder.command("order.applystep", {
    order_id: orderId,
    seq
  })
    .withSourceService("workflow")
    .withIdempotencyKey(`${orderId}:${seq}`)
    .build(),
  route: {
    operation_name: "order.applystep",
    operation_type: "COMMAND",
    provider: "OUTBOX",
    on_exhausted: "DLQ"
  },
  handler
});

describe("OutboxRelay partition ordering", () => {
  it("preserves in-order handling for the same partition key under parallelism", async () => {
    const adapter = new InMemoryOutboxAdapter();
    const provider = new OutboxProvider(adapter, {
      partition_key_resolver: createPayloadPartitionKeyResolver()
    });

    const seenByOrder = new Map<string, number[]>();
    const activeByOrder = new Map<string, number>();

    const handler: ProviderDispatchRequest["handler"] = {
      id: "handler-1",
      operation_name: "order.applystep",
      operation_type: "COMMAND",
      version_range: ">=1.0.0 <2.0.0",
      handle: async (envelope) => {
        const payload = envelope.payload as {
          order_id: string;
          seq: number;
        };

        const inFlight = activeByOrder.get(payload.order_id) ?? 0;
        activeByOrder.set(payload.order_id, inFlight + 1);

        if (inFlight > 0) {
          throw new Error(`Parallel execution for same partition: ${payload.order_id}`);
        }

        await new Promise((resolve) => {
          setTimeout(resolve, 3);
        });

        const current = seenByOrder.get(payload.order_id) ?? [];
        current.push(payload.seq);
        seenByOrder.set(payload.order_id, current);

        activeByOrder.set(payload.order_id, (activeByOrder.get(payload.order_id) ?? 1) - 1);
      }
    };

    for (let step = 1; step <= 8; step += 1) {
      await provider.dispatch(createRequest(handler, "o-1", step));
    }

    for (let step = 1; step <= 8; step += 1) {
      await provider.dispatch(createRequest(handler, "o-2", step));
    }

    const relay = new OutboxRelay(adapter, provider, {
      batch_size: 16,
      max_parallelism: 4,
      partition_ordering: "BY_PARTITION_KEY"
    });

    for (let step = 0; step < 16; step += 1) {
      await relay.runOnce();

      if ((await adapter.pendingCount("order.applystep")) === 0) {
        break;
      }
    }

    const deliveredRecords = await adapter.list({ status: "DELIVERED" });

    expect(deliveredRecords).toHaveLength(16);
    expect(seenByOrder.get("o-1")).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(seenByOrder.get("o-2")).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
