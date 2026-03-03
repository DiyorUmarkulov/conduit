import { describe, expect, it } from "vitest";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import { RabbitMQProvider } from "../../src/rabbitmq-provider.js";

const createRequest = (): ProviderDispatchRequest => ({
  envelope: EnvelopeBuilder.event("inventory.updated", { sku: "sku-1" })
    .withSourceService("inventory")
    .build(),
  route: {
    operation_name: "inventory.updated",
    operation_type: "EVENT",
    provider: "RABBITMQ",
    on_exhausted: "DLQ"
  },
  handler: {
    id: "handler-1",
    operation_name: "inventory.updated",
    operation_type: "EVENT",
    version_range: ">=1.0.0 <2.0.0",
    handle: async () => ({ ok: true })
  }
});

describe("RabbitMQProvider", () => {
  it("publishes message and returns QUEUED", async () => {
    const published: string[] = [];

    const provider = new RabbitMQProvider({
      publish: async (input) => {
        published.push(`${input.exchange}:${input.routing_key}`);
      }
    });

    const result = await provider.dispatch(createRequest());

    expect(result.status).toBe("QUEUED");
    expect(published[0]).toContain("conduit.operations");
  });
});
