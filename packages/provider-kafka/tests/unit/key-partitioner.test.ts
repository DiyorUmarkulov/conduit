import { describe, expect, it } from "vitest";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";

import { createKeyPartitioner } from "../../src/partitioning/key-partitioner.js";

const createRequest = (payload: unknown): ProviderDispatchRequest => ({
  envelope: EnvelopeBuilder.command("order.create", payload)
    .withSourceService("api")
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

describe("createKeyPartitioner", () => {
  it("selects partition key from payload fields", () => {
    const resolver = createKeyPartitioner({
      rules: [{ pattern: "order.*", candidate_fields: ["order_id"] }]
    });

    const key = resolver(createRequest({ order_id: "o-1" }));

    expect(key).toBe("o-1");
  });

  it("falls back to idempotency key", () => {
    const resolver = createKeyPartitioner();
    const key = resolver(createRequest({}));

    expect(key).toBe("idem-1");
  });
});
