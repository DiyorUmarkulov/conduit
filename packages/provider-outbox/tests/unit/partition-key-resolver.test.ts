import { describe, expect, it } from "vitest";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import { createPayloadPartitionKeyResolver } from "../../src/partition/partition-key-resolver.js";

const baseRequest = (payload: unknown): ProviderDispatchRequest => ({
  envelope: EnvelopeBuilder.command("order.create", payload)
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

describe("createPayloadPartitionKeyResolver", () => {
  it("resolves key from payload fields", () => {
    const resolver = createPayloadPartitionKeyResolver();
    const key = resolver(baseRequest({ order_id: "o-55" }));

    expect(key).toBe("o-55");
  });

  it("falls back to idempotency key when payload has no candidate field", () => {
    const resolver = createPayloadPartitionKeyResolver();
    const key = resolver(baseRequest({ value: 1 }));

    expect(key).toBe("idem-1");
  });

  it("returns operation_id when fallback_to_operation_id is enabled", () => {
    const resolver = createPayloadPartitionKeyResolver({
      fallback_to_operation_id: true
    });

    const request = baseRequest({ value: 1 });
    const { idempotency_key: _omit, ...metadataWithoutIdem } = request.envelope.metadata;
    request.envelope = {
      ...request.envelope,
      metadata: metadataWithoutIdem
    };

    const key = resolver(request);

    expect(key).toBe(request.envelope.operation_id);
  });
});
