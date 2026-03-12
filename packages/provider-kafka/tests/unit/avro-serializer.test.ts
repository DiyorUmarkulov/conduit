import { describe, expect, it } from "vitest";

import { EnvelopeBuilder, type ProviderDispatchRequest } from "@conduit/core";
import { LocalSchemaRegistry } from "@conduit/schema-registry";

import { ConduitAvroSerializer } from "../../src/serialization/avro.serializer.js";

const createRequest = (): ProviderDispatchRequest => ({
  envelope: EnvelopeBuilder.command("order.create", { order_id: "o-1" })
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

describe("ConduitAvroSerializer", () => {
  it("serializes and deserializes a Conduit message", async () => {
    const registry = new LocalSchemaRegistry();
    const serializer = new ConduitAvroSerializer({
      registry,
      subject: () => "conduit.test.order"
    });

    const request = createRequest();
    const encoded = await serializer.serialize(request);
    const decoded = await serializer.deserialize(encoded);

    expect(decoded.envelope.operation_name).toBe("order.create");
    expect((decoded.envelope.payload as { order_id: string }).order_id).toBe("o-1");
    expect(decoded.handler_id).toBe("handler-1");
  });
});
