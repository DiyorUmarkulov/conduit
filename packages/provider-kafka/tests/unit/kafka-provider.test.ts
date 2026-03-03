import { describe, expect, it } from "vitest";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import { KafkaProvider } from "../../src/kafka-provider.js";

const createRequest = (): ProviderDispatchRequest => ({
  envelope: EnvelopeBuilder.command("order.create", { order_id: "o-1" })
    .withSourceService("api-gateway")
    .withIdempotencyKey("idem-1")
    .build(),
  route: {
    operation_name: "order.create",
    operation_type: "COMMAND",
    provider: "KAFKA",
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

describe("KafkaProvider", () => {
  it("publishes message and returns QUEUED", async () => {
    const sent: Array<{ topic: string; key?: string; value: string | Uint8Array }> = [];

    const provider = new KafkaProvider({
      send: async (message) => {
        sent.push({
          topic: message.topic,
          ...(message.key ? { key: message.key } : {}),
          value: message.value
        });
      }
    });

    const result = await provider.dispatch(createRequest());

    expect(result.status).toBe("QUEUED");
    expect(sent).toHaveLength(1);
    expect(sent[0]?.topic).toContain("order.create");
  });
});
